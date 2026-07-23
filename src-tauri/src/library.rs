use std::{fs, path::PathBuf};

use tauri::{AppHandle, Manager};

/// The library (saved sources + mixtapes) is an opaque JSON document owned by
/// the frontend; Rust only guarantees durable, atomic storage of valid JSON.
fn library_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate the app data directory: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Could not create the app data directory: {error}"))?;
    Ok(dir.join("library.json"))
}

#[tauri::command]
pub fn load_library(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = library_path(&app)?;
    let contents = match fs::read_to_string(&path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not read the library: {error}")),
    };
    serde_json::from_str(&contents)
        .map(Some)
        .map_err(|error| format!("The library file is not valid JSON: {error}"))
}

#[tauri::command]
pub fn save_library(app: AppHandle, library: serde_json::Value) -> Result<(), String> {
    let path = library_path(&app)?;
    let temp = path.with_extension("json.tmp");
    let contents = serde_json::to_vec_pretty(&library)
        .map_err(|error| format!("Could not serialize the library: {error}"))?;
    fs::write(&temp, contents).map_err(|error| format!("Could not write the library: {error}"))?;
    fs::rename(&temp, &path).map_err(|error| format!("Could not save the library: {error}"))
}

/// Lets the user pick where to save their exported library instead of
/// silently dropping it in Downloads. Returns false when the user cancels.
#[tauri::command]
pub async fn export_library(app: AppHandle, contents: String) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;

    let chosen = app
        .dialog()
        .file()
        .set_file_name("tapedeck-library.json")
        .add_filter("JSON", &["json"])
        .blocking_save_file();

    let Some(chosen) = chosen else {
        return Ok(false);
    };
    let path = chosen
        .into_path()
        .map_err(|error| format!("Could not resolve the save location: {error}"))?;
    fs::write(&path, contents).map_err(|error| format!("Could not write the library: {error}"))?;
    Ok(true)
}
