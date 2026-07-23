use std::{collections::HashMap, fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::auth::{self, transport_detail, AppState, CommandError};

const DRIVE_FILES_ENDPOINT: &str = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT: &str = "https://www.googleapis.com/upload/drive/v3/files";
const LIBRARY_FILE_NAME: &str = "library.json";
const DEVICES_FILE_NAME: &str = "devices.json";
const MULTIPART_BOUNDARY: &str = "tapedeck-sync-boundary";

#[derive(Serialize, Deserialize, Clone)]
struct DeviceIdentity {
    id: String,
    name: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct DeviceRecord {
    name: String,
    #[serde(rename = "lastActiveAt")]
    last_active_at: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub last_active_at: String,
    pub is_this_device: bool,
}

fn drive_unreachable(error: reqwest::Error) -> CommandError {
    CommandError::new(
        "DRIVE_UNREACHABLE",
        format!(
            "Google Drive could not be reached ({}). Check your connection and try again.",
            transport_detail(&error)
        ),
    )
}

#[derive(Deserialize)]
struct DriveErrorBody {
    error: Option<DriveErrorDetail>,
}
#[derive(Deserialize)]
struct DriveErrorDetail {
    message: Option<String>,
    errors: Option<Vec<DriveErrorItem>>,
}
#[derive(Deserialize)]
struct DriveErrorItem {
    reason: Option<String>,
}

/// Google returns 401/403 for several unrelated reasons — an actually
/// missing OAuth scope, the Drive API not being enabled for the Cloud
/// project, a revoked grant, etc. — so the status code alone can't tell you
/// which; this reads the response body's `reason` to give a message that
/// points at the real fix instead of always saying "sign in again."
async fn ensure_success(
    response: reqwest::Response,
    context: &str,
) -> Result<reqwest::Response, CommandError> {
    if response.status().is_success() {
        return Ok(response);
    }
    let status = response.status();
    let body_text = response.text().await.unwrap_or_default();
    let parsed: Option<DriveErrorBody> = serde_json::from_str(&body_text).ok();
    let reason = parsed
        .as_ref()
        .and_then(|body| body.error.as_ref())
        .and_then(|detail| detail.errors.as_ref())
        .and_then(|errors| errors.first())
        .and_then(|item| item.reason.clone());
    let google_message = parsed
        .and_then(|body| body.error)
        .and_then(|detail| detail.message)
        .filter(|message| !message.is_empty())
        .unwrap_or_else(|| body_text.clone());

    if reason.as_deref() == Some("accessNotConfigured") {
        return Err(CommandError::new(
            "DRIVE_API_DISABLED",
            format!("Google Drive sync isn't enabled for this app's Google Cloud project yet ({google_message}). Enable the Google Drive API for the project, then try again."),
        ));
    }
    if status == reqwest::StatusCode::FORBIDDEN || status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(CommandError::new(
            "DRIVE_SCOPE_MISSING",
            format!("Tapedeck needs permission to sync your library ({google_message}). Sign out and sign in again to grant access."),
        ));
    }
    Err(CommandError::new(
        "DRIVE_ERROR",
        format!("Google Drive {context} failed ({status}): {google_message}"),
    ))
}

/// Looks up a named file in the app's hidden Drive folder. `appDataFolder`
/// is scoped to this app and invisible in the user's regular Drive — Google
/// creates it automatically the first time a file is written there.
async fn find_file_id(
    state: &AppState,
    token: &str,
    name: &str,
) -> Result<Option<String>, CommandError> {
    #[derive(Deserialize)]
    struct FilesList {
        files: Vec<FileMeta>,
    }
    #[derive(Deserialize)]
    struct FileMeta {
        id: String,
    }

    let query = format!("name='{name}' and trashed=false");
    let response = auth::send_with_retry(
        state
            .client
            .get(DRIVE_FILES_ENDPOINT)
            .bearer_auth(token)
            .query(&[
                ("spaces", "appDataFolder"),
                ("q", query.as_str()),
                ("fields", "files(id)"),
            ]),
    )
    .await
    .map_err(drive_unreachable)?;
    let response = ensure_success(response, "lookup").await?;
    let list: FilesList = response.json().await.map_err(|_| {
        CommandError::new(
            "DRIVE_RESPONSE_ERROR",
            "Google Drive returned an unreadable file list.",
        )
    })?;
    Ok(list.files.into_iter().next().map(|file| file.id))
}

async fn download_file(
    state: &AppState,
    token: &str,
    file_id: &str,
) -> Result<Vec<u8>, CommandError> {
    let response = auth::send_with_retry(
        state
            .client
            .get(format!("{DRIVE_FILES_ENDPOINT}/{file_id}"))
            .bearer_auth(token)
            .query(&[("alt", "media")]),
    )
    .await
    .map_err(drive_unreachable)?;
    let response = ensure_success(response, "download").await?;
    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|_| {
            CommandError::new(
                "DRIVE_RESPONSE_ERROR",
                "Google Drive returned an unreadable file.",
            )
        })
}

/// Drive's multipart upload wants an unnamed metadata part and an unnamed
/// content part, distinguished only by Content-Type — not the same shape
/// as a typical multipart/form-data upload, so this is built by hand rather
/// than fought into a form-data library.
fn build_multipart_body(name: &str, content: &[u8]) -> Vec<u8> {
    let metadata = serde_json::json!({ "name": name, "parents": ["appDataFolder"] }).to_string();
    let mut body = Vec::new();
    body.extend_from_slice(
        format!("--{MULTIPART_BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n--{MULTIPART_BOUNDARY}\r\nContent-Type: application/json\r\n\r\n")
            .as_bytes(),
    );
    body.extend_from_slice(content);
    body.extend_from_slice(format!("\r\n--{MULTIPART_BOUNDARY}--").as_bytes());
    body
}

async fn create_file(
    state: &AppState,
    token: &str,
    name: &str,
    content: &[u8],
) -> Result<String, CommandError> {
    #[derive(Deserialize)]
    struct Created {
        id: String,
    }

    let response = auth::send_with_retry(
        state
            .client
            .post(format!("{DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart"))
            .bearer_auth(token)
            .header(
                "Content-Type",
                format!("multipart/related; boundary={MULTIPART_BOUNDARY}"),
            )
            .body(build_multipart_body(name, content)),
    )
    .await
    .map_err(drive_unreachable)?;
    let response = ensure_success(response, "create").await?;
    let created: Created = response.json().await.map_err(|_| {
        CommandError::new(
            "DRIVE_RESPONSE_ERROR",
            "Google Drive returned an unreadable response.",
        )
    })?;
    Ok(created.id)
}

async fn update_file(
    state: &AppState,
    token: &str,
    file_id: &str,
    content: Vec<u8>,
) -> Result<(), CommandError> {
    let response = auth::send_with_retry(
        state
            .client
            .patch(format!(
                "{DRIVE_UPLOAD_ENDPOINT}/{file_id}?uploadType=media"
            ))
            .bearer_auth(token)
            .header("Content-Type", "application/json")
            .body(content),
    )
    .await
    .map_err(drive_unreachable)?;
    ensure_success(response, "update").await?;
    Ok(())
}

async fn write_file(
    state: &AppState,
    token: &str,
    name: &str,
    content: Vec<u8>,
) -> Result<(), CommandError> {
    match find_file_id(state, token, name).await? {
        Some(file_id) => update_file(state, token, &file_id, content).await,
        None => create_file(state, token, name, &content).await.map(|_| ()),
    }
}

fn device_identity_path(app: &AppHandle) -> Result<PathBuf, CommandError> {
    let dir = app.path().app_data_dir().map_err(|error| {
        CommandError::new(
            "APP_DATA_DIR_ERROR",
            format!("Could not locate the app data directory: {error}"),
        )
    })?;
    fs::create_dir_all(&dir).map_err(|error| {
        CommandError::new(
            "APP_DATA_DIR_ERROR",
            format!("Could not create the app data directory: {error}"),
        )
    })?;
    Ok(dir.join("device.json"))
}

/// A stable identity for this install, generated once and cached locally —
/// not tied to the Drive account, so re-signing-in doesn't create a
/// duplicate "device".
fn load_or_create_device_identity(app: &AppHandle) -> Result<DeviceIdentity, CommandError> {
    let path = device_identity_path(app)?;
    if let Ok(contents) = fs::read_to_string(&path) {
        if let Ok(identity) = serde_json::from_str::<DeviceIdentity>(&contents) {
            return Ok(identity);
        }
    }

    let identity = DeviceIdentity {
        id: generate_device_id(),
        name: device_display_name(),
    };
    let contents = serde_json::to_vec_pretty(&identity).map_err(|error| {
        CommandError::new(
            "APP_DATA_DIR_ERROR",
            format!("Could not save this device's identity: {error}"),
        )
    })?;
    fs::write(&path, contents).map_err(|error| {
        CommandError::new(
            "APP_DATA_DIR_ERROR",
            format!("Could not save this device's identity: {error}"),
        )
    })?;
    Ok(identity)
}

fn generate_device_id() -> String {
    use rand::{rngs::OsRng, RngCore};
    let mut bytes = [0_u8; 16];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn device_display_name() -> String {
    gethostname::gethostname()
        .to_string_lossy()
        .trim_end_matches(".local")
        .to_string()
}

/// Downloads the synced library, or `None` if this account has never
/// synced from any device yet. The frontend owns merging this with the
/// local copy (`mergeLibrary` in `lib/library.ts`) — this command is a
/// dumb transport, matching `load_library`/`save_library`'s philosophy of
/// treating the library as an opaque JSON document.
#[tauri::command]
pub async fn drive_download_library(
    state: State<'_, AppState>,
) -> Result<Option<serde_json::Value>, CommandError> {
    let token = auth::access_token(&state).await?;
    let Some(file_id) = find_file_id(&state, &token, LIBRARY_FILE_NAME).await? else {
        return Ok(None);
    };
    let bytes = download_file(&state, &token, &file_id).await?;
    let value = serde_json::from_slice(&bytes).map_err(|_| {
        CommandError::new(
            "DRIVE_RESPONSE_ERROR",
            "The synced library is not valid JSON.",
        )
    })?;
    Ok(Some(value))
}

#[tauri::command]
pub async fn drive_upload_library(
    state: State<'_, AppState>,
    library: serde_json::Value,
) -> Result<(), CommandError> {
    let token = auth::access_token(&state).await?;
    let content = serde_json::to_vec(&library).map_err(|error| {
        CommandError::new(
            "DRIVE_ERROR",
            format!("Could not serialize the library: {error}"),
        )
    })?;
    write_file(&state, &token, LIBRARY_FILE_NAME, content).await
}

/// Marks this device active (creating its identity on first call) and
/// returns the full device list for the sync popover. Combined into one
/// command since the frontend always wants both together after a sync.
#[tauri::command]
pub async fn drive_touch_device(
    app: AppHandle,
    state: State<'_, AppState>,
    now: String,
) -> Result<Vec<DeviceInfo>, CommandError> {
    let identity = load_or_create_device_identity(&app)?;
    let token = auth::access_token(&state).await?;

    let existing_file_id = find_file_id(&state, &token, DEVICES_FILE_NAME).await?;
    let mut devices: HashMap<String, DeviceRecord> = match &existing_file_id {
        Some(file_id) => {
            let bytes = download_file(&state, &token, file_id).await?;
            serde_json::from_slice(&bytes).unwrap_or_default()
        }
        None => HashMap::new(),
    };
    devices.insert(
        identity.id.clone(),
        DeviceRecord {
            name: identity.name.clone(),
            last_active_at: now,
        },
    );

    let content = serde_json::to_vec(&devices).map_err(|error| {
        CommandError::new(
            "DRIVE_ERROR",
            format!("Could not serialize the device list: {error}"),
        )
    })?;
    match existing_file_id {
        Some(file_id) => update_file(&state, &token, &file_id, content).await?,
        None => {
            create_file(&state, &token, DEVICES_FILE_NAME, &content).await?;
        }
    }

    let mut list: Vec<DeviceInfo> = devices
        .into_iter()
        .map(|(id, record)| {
            let is_this_device = id == identity.id;
            DeviceInfo {
                id,
                name: record.name,
                last_active_at: record.last_active_at,
                is_this_device,
            }
        })
        .collect();
    list.sort_by(|a, b| b.last_active_at.cmp(&a.last_active_at));
    Ok(list)
}
