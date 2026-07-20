use std::{env, fs};

fn main() {
    println!("cargo:rerun-if-env-changed=TAPEDECK_GOOGLE_CLIENT_ID");
    println!("cargo:rerun-if-changed=../.env");

    let client_id = env::var("TAPEDECK_GOOGLE_CLIENT_ID")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            fs::read_to_string("../.env").ok().and_then(|contents| {
                contents.lines().find_map(|line| {
                    let (key, value) = line.split_once('=')?;
                    (key.trim() == "TAPEDECK_GOOGLE_CLIENT_ID")
                        .then(|| value.trim().trim_matches(['\'', '"']).to_owned())
                        .filter(|value| !value.is_empty())
                })
            })
        });
    if let Some(client_id) = client_id {
        println!("cargo:rustc-env=TAPEDECK_GOOGLE_CLIENT_ID={client_id}");
    }

    // Declare app commands so the ACL generates allow-* permissions; without
    // this, the packaged localhost origin cannot invoke any Tapedeck command.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "google_auth_status",
            "sign_in_with_google",
            "sign_out_google",
            "resolve_youtube_source",
        ]),
    ))
    .expect("failed to run tauri-build");
}
