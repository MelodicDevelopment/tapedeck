mod auth;
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
        .invoke_handler(tauri::generate_handler![
            auth::google_auth_status,
            auth::sign_in_with_google,
            auth::sign_out_google,
            youtube::resolve_youtube_source,
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

            WebviewWindowBuilder::new(app, "main", url)
                .title("Tapedeck")
                .inner_size(1280.0, 800.0)
                .min_inner_size(720.0, 640.0)
                .center()
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tapedeck");
}
