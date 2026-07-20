mod auth;
mod dns;
mod library;
mod media;
mod youtube;

use tauri::{webview::WebviewWindowBuilder, Manager, WebviewUrl};

#[cfg(not(debug_assertions))]
const DESKTOP_ORIGIN_PORT: u16 = 14_321;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_single_instance::init(
        |app, _arguments, _working_directory| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        },
    ));

    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_localhost::Builder::new(DESKTOP_ORIGIN_PORT).build());

    builder
        .manage(auth::AppState::new())
        .manage(media::MediaState::new())
        .invoke_handler(tauri::generate_handler![
            auth::google_auth_status,
            auth::sign_in_with_google,
            auth::sign_out_google,
            youtube::resolve_youtube_source,
            media::media_set_metadata,
            media::media_set_playback,
            library::load_library,
            library::save_library,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            let url = WebviewUrl::External(
                "http://127.0.0.1:5173/?desktop=1"
                    .parse()
                    .expect("valid Tapedeck development URL"),
            );

            #[cfg(not(debug_assertions))]
            let url = WebviewUrl::External(
                format!("http://localhost:{DESKTOP_ORIGIN_PORT}/?desktop=1")
                    .parse()
                    .expect("valid Tapedeck desktop URL"),
            );

            let window = WebviewWindowBuilder::new(app, "main", url)
                .title("Tapedeck")
                .inner_size(1280.0, 800.0)
                .min_inner_size(720.0, 640.0)
                .center()
                .build()?;

            media::init(app.handle(), &window)?;

            // Closing the window hides it so playback continues in the
            // background (standard macOS music-app behavior); the dock
            // icon brings it back and Cmd+Q still quits for real.
            let close_target = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = close_target.hide();
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running Tapedeck")
        .run(|app, event| {
            // Clicking the dock icon re-shows the hidden window.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            let _ = (&app, &event);
        });
}
