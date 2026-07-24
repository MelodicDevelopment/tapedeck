mod auth;
mod dns;
mod library;
mod media;
mod sync;
mod youtube;

use tauri::{webview::WebviewWindowBuilder, Emitter, Manager, WebviewUrl};

#[cfg(not(debug_assertions))]
const DESKTOP_ORIGIN_PORT: u16 = 14_321;

/// Pulls a video id out of a youtube.com/youtu.be watch URL — the shape the
/// embedded player's own "More videos" overlay and end-screen suggestions
/// link to when clicked. Anything else (channel pages, playlists, other
/// domains entirely) returns `None` so the caller falls back to opening the
/// user's real browser instead.
fn youtube_video_id(url: &tauri::Url) -> Option<String> {
    // Exact match after stripping known prefixes, not `ends_with` — a naive
    // suffix check would also treat e.g. "notyoutube.com" as YouTube.
    let host = url
        .host_str()?
        .trim_start_matches("www.")
        .trim_start_matches("m.");
    if host == "youtu.be" {
        return url
            .path_segments()?
            .next()
            .filter(|id| !id.is_empty())
            .map(str::to_owned);
    }
    if host == "youtube.com" {
        if url.path() == "/watch" {
            return url
                .query_pairs()
                .find(|(key, _)| key == "v")
                .map(|(_, value)| value.into_owned());
        }
        if let Some(id) = url.path().strip_prefix("/shorts/") {
            return (!id.is_empty()).then(|| id.to_owned());
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(
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
            youtube::resolve_video,
            media::media_set_metadata,
            media::media_set_playback,
            library::load_library,
            library::save_library,
            library::export_library,
            sync::drive_download_library,
            sync::drive_upload_library,
            sync::drive_touch_device,
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

            let app_handle = app.handle().clone();
            let window = WebviewWindowBuilder::new(app, "main", url)
                .title("Tapedeck")
                .inner_size(1280.0, 800.0)
                .min_inner_size(720.0, 640.0)
                .center()
                // The embedded YouTube player (and Tapedeck's own "watch on
                // YouTube" links) open external pages via `window.open`
                // (target=_blank). A related-video click inside the player
                // (its "More videos" overlay, end screens) points at a
                // youtube.com/youtu.be watch URL — hand that back to the
                // frontend to play inline instead of leaving the app; any
                // other destination (channel pages, fully external sites)
                // opens in the user's real browser.
                .on_new_window(move |url, _features| {
                    if let Some(video_id) = youtube_video_id(&url) {
                        let _ = app_handle.emit("tapedeck://play-external-video", video_id);
                    } else {
                        let _ = open::that_detached(url.as_str());
                    }
                    tauri::webview::NewWindowResponse::Deny
                })
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

#[cfg(test)]
mod tests {
    use super::youtube_video_id;

    fn id(url: &str) -> Option<String> {
        youtube_video_id(&url.parse().unwrap())
    }

    #[test]
    fn extracts_the_id_from_a_watch_url() {
        assert_eq!(
            id("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_owned())
        );
    }

    #[test]
    fn extracts_the_id_from_a_watch_url_with_extra_query_params() {
        assert_eq!(
            id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=4"),
            Some("dQw4w9WgXcQ".to_owned()),
        );
    }

    #[test]
    fn extracts_the_id_from_a_bare_youtube_com_host_without_www() {
        assert_eq!(
            id("https://youtube.com/watch?v=dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_owned())
        );
    }

    #[test]
    fn extracts_the_id_from_a_youtu_be_short_link() {
        assert_eq!(
            id("https://youtu.be/dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_owned())
        );
    }

    #[test]
    fn extracts_the_id_from_a_youtu_be_short_link_with_query_params() {
        assert_eq!(
            id("https://youtu.be/dQw4w9WgXcQ?t=30"),
            Some("dQw4w9WgXcQ".to_owned())
        );
    }

    #[test]
    fn extracts_the_id_from_a_shorts_url() {
        assert_eq!(
            id("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_owned())
        );
    }

    #[test]
    fn ignores_a_channel_url() {
        assert_eq!(id("https://www.youtube.com/@lofihiphopmusic"), None);
    }

    #[test]
    fn ignores_a_watch_url_missing_the_v_param() {
        assert_eq!(id("https://www.youtube.com/watch?list=PL123"), None);
    }

    #[test]
    fn ignores_an_empty_youtu_be_path() {
        assert_eq!(id("https://youtu.be/"), None);
    }

    #[test]
    fn ignores_a_fully_external_domain() {
        assert_eq!(id("https://example.com/watch?v=dQw4w9WgXcQ"), None);
    }

    #[test]
    fn ignores_a_lookalike_domain() {
        assert_eq!(id("https://notyoutube.com/watch?v=dQw4w9WgXcQ"), None);
        assert_eq!(id("https://evilyoutube.com/watch?v=dQw4w9WgXcQ"), None);
    }

    #[test]
    fn extracts_the_id_from_the_mobile_subdomain() {
        assert_eq!(
            id("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_owned())
        );
    }
}
