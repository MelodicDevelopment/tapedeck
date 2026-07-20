use std::{sync::Mutex, time::Duration};

use serde::Serialize;
use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig,
    SeekDirection,
};
use tauri::{AppHandle, Emitter, State, WebviewWindow};

pub struct MediaState(Mutex<Option<MediaControls>>);

impl MediaState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

/// Payload sent to the webview when the OS delivers a media key press.
#[derive(Clone, Serialize)]
struct MediaControlPayload {
    action: &'static str,
    /// Seconds for seek actions, 0.0–1.0 for volume.
    value: Option<f64>,
}

const MEDIA_CONTROL_EVENT: &str = "media-control";

fn payload_for(event: MediaControlEvent) -> Option<MediaControlPayload> {
    let payload = match event {
        MediaControlEvent::Play => MediaControlPayload {
            action: "play",
            value: None,
        },
        MediaControlEvent::Pause | MediaControlEvent::Stop => MediaControlPayload {
            action: "pause",
            value: None,
        },
        MediaControlEvent::Toggle => MediaControlPayload {
            action: "toggle",
            value: None,
        },
        MediaControlEvent::Next => MediaControlPayload {
            action: "next",
            value: None,
        },
        MediaControlEvent::Previous => MediaControlPayload {
            action: "previous",
            value: None,
        },
        MediaControlEvent::SetPosition(MediaPosition(position)) => MediaControlPayload {
            action: "seek",
            value: Some(position.as_secs_f64()),
        },
        MediaControlEvent::SeekBy(direction, amount) => MediaControlPayload {
            action: "seekBy",
            value: Some(signed_seconds(direction, amount.as_secs_f64())),
        },
        MediaControlEvent::Seek(direction) => MediaControlPayload {
            action: "seekBy",
            value: Some(signed_seconds(direction, 10.0)),
        },
        MediaControlEvent::SetVolume(volume) => MediaControlPayload {
            action: "setVolume",
            value: Some(volume),
        },
        MediaControlEvent::OpenUri(_) | MediaControlEvent::Raise | MediaControlEvent::Quit => {
            return None
        }
    };
    Some(payload)
}

fn signed_seconds(direction: SeekDirection, seconds: f64) -> f64 {
    match direction {
        SeekDirection::Forward => seconds,
        SeekDirection::Backward => -seconds,
    }
}

/// Register OS media controls (macOS MPRemoteCommandCenter, Windows SMTC,
/// Linux MPRIS) and forward media key presses to the webview.
pub fn init(app: &AppHandle, window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    let hwnd = Some(window.hwnd()?.0 as *mut std::ffi::c_void);
    #[cfg(not(target_os = "windows"))]
    let hwnd = {
        let _ = window;
        None
    };

    let config = PlatformConfig {
        display_name: "Tapedeck",
        dbus_name: "tapedeck",
        hwnd,
    };

    let mut controls =
        MediaControls::new(config).map_err(|error| format!("media controls init: {error}"))?;

    let handle = app.clone();
    controls
        .attach(move |event| {
            if let Some(payload) = payload_for(event) {
                let _ = handle.emit(MEDIA_CONTROL_EVENT, payload);
            }
        })
        .map_err(|error| format!("media controls attach: {error}"))?;

    // Claim the OS media-key routing immediately: macOS only routes the play
    // key to an app that has reported a playing state at least once — until
    // then the key launches Apple Music. Report "playing" briefly, then
    // settle to paused; Tapedeck stays the now-playing target either way.
    let _ = controls.set_metadata(MediaMetadata {
        title: Some("Tapedeck"),
        artist: Some("Ready to play"),
        album: None,
        cover_url: None,
        duration: None,
    });
    let _ = controls.set_playback(MediaPlayback::Playing { progress: None });

    let state: State<MediaState> = tauri::Manager::state(app);
    *state.0.lock().expect("media controls lock") = Some(controls);

    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let state = tauri::Manager::state::<MediaState>(&handle);
        let Ok(mut guard) = state.0.lock() else {
            return;
        };
        if let Some(controls) = guard.as_mut() {
            let _ = controls.set_playback(MediaPlayback::Paused { progress: None });
        }
    });
    Ok(())
}

#[tauri::command]
pub fn media_set_metadata(
    state: State<MediaState>,
    title: String,
    artist: String,
    cover_url: Option<String>,
    duration_secs: Option<f64>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "media controls lock")?;
    let Some(controls) = guard.as_mut() else {
        return Ok(());
    };
    controls
        .set_metadata(MediaMetadata {
            title: Some(&title),
            artist: Some(&artist),
            album: None,
            cover_url: cover_url.as_deref(),
            duration: duration_secs.map(Duration::from_secs_f64),
        })
        .map_err(|error| format!("media metadata: {error}"))
}

#[tauri::command]
pub fn media_set_playback(
    state: State<MediaState>,
    playing: bool,
    position_secs: Option<f64>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "media controls lock")?;
    let Some(controls) = guard.as_mut() else {
        return Ok(());
    };
    let progress = position_secs.map(|seconds| MediaPosition(Duration::from_secs_f64(seconds)));
    let playback = if playing {
        MediaPlayback::Playing { progress }
    } else {
        MediaPlayback::Paused { progress }
    };
    controls
        .set_playback(playback)
        .map_err(|error| format!("media playback: {error}"))
}
