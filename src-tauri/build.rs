use std::{env, fs};

fn forward_env(key: &str) {
    println!("cargo:rerun-if-env-changed={key}");

    let value = env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            fs::read_to_string("../.env").ok().and_then(|contents| {
                contents.lines().find_map(|line| {
                    let (name, value) = line.split_once('=')?;
                    (name.trim() == key)
                        .then(|| value.trim().trim_matches(['\'', '"']).to_owned())
                        .filter(|value| !value.is_empty())
                })
            })
        });
    if let Some(value) = value {
        println!("cargo:rustc-env={key}={value}");
    }
}

fn main() {
    println!("cargo:rerun-if-changed=../.env");

    // Google requires the "Desktop app" client secret at the token endpoint
    // even with PKCE; it is not treated as confidential for installed apps.
    forward_env("TAPEDECK_GOOGLE_CLIENT_ID");
    forward_env("TAPEDECK_GOOGLE_CLIENT_SECRET");
    // YouTube Data API access is a plain API key, not part of the OAuth
    // scopes: Tapedeck only ever reads public channel/playlist/video data,
    // never the signed-in user's own YouTube account.
    forward_env("TAPEDECK_YOUTUBE_API_KEY");

    // Declare app commands so the ACL generates allow-* permissions; without
    // this, the packaged localhost origin cannot invoke any Tapedeck command.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "google_auth_status",
            "sign_in_with_google",
            "sign_out_google",
            "resolve_youtube_source",
            "media_set_metadata",
            "media_set_playback",
            "load_library",
            "save_library",
            "export_library",
            "drive_download_library",
            "drive_upload_library",
            "drive_touch_device",
        ]),
    ))
    .expect("failed to run tauri-build");
}
