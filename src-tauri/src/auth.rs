use std::{
    io::{ErrorKind, Read, Write},
    net::TcpListener,
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use keyring::Entry;
use rand::{rngs::OsRng, RngCore};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;
use url::Url;

const AUTHORIZATION_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT: &str = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOCATION_ENDPOINT: &str = "https://oauth2.googleapis.com/revoke";
const SCOPES: &str = "openid email profile https://www.googleapis.com/auth/youtube.readonly";
const KEYRING_SERVICE: &str = "com.melodicdevelopment.tapedeck";
const KEYRING_ACCOUNT: &str = "google-refresh-token";
const OAUTH_TIMEOUT: Duration = Duration::from_secs(180);

pub struct AppState {
    pub client: Client,
    session: Mutex<Option<AccessSession>>,
}

#[derive(Clone)]
struct AccessSession {
    access_token: String,
    expires_at: Instant,
    user: GoogleUser,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleUser {
    pub name: String,
    pub email: String,
    pub picture: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub configured: bool,
    pub authenticated: bool,
    pub user: Option<GoogleUser>,
}

#[derive(Clone, Debug, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    fn auth_required() -> Self {
        Self::new(
            "AUTH_REQUIRED",
            "Sign in with Google to load YouTube channels and playlists.",
        )
    }
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: Option<u64>,
    refresh_token: Option<String>,
    scope: Option<String>,
}

#[derive(Deserialize)]
struct TokenErrorResponse {
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Deserialize)]
struct UserInfoResponse {
    name: Option<String>,
    email: Option<String>,
    picture: Option<String>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .expect("Tapedeck HTTP client"),
            session: Mutex::new(None),
        }
    }

    fn session(&self) -> Result<Option<AccessSession>, CommandError> {
        self.session
            .lock()
            .map(|session| session.clone())
            .map_err(|_| {
                CommandError::new(
                    "SESSION_ERROR",
                    "Tapedeck could not read the login session.",
                )
            })
    }

    fn set_session(&self, session: Option<AccessSession>) -> Result<(), CommandError> {
        *self.session.lock().map_err(|_| {
            CommandError::new(
                "SESSION_ERROR",
                "Tapedeck could not update the login session.",
            )
        })? = session;
        Ok(())
    }
}

fn google_env(runtime_key: &str, build_value: Option<&'static str>) -> Option<String> {
    std::env::var(runtime_key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| build_value.map(str::to_owned))
}

fn google_client_id() -> Option<String> {
    google_env(
        "TAPEDECK_GOOGLE_CLIENT_ID",
        option_env!("TAPEDECK_GOOGLE_CLIENT_ID"),
    )
}

// Google's token endpoint rejects "Desktop app" clients without their client
// secret even in the PKCE flow; Google documents that installed-app secrets
// are not confidential, so it ships in the binary alongside the client ID.
fn google_client_secret() -> Option<String> {
    google_env(
        "TAPEDECK_GOOGLE_CLIENT_SECRET",
        option_env!("TAPEDECK_GOOGLE_CLIENT_SECRET"),
    )
}

fn google_client() -> Option<(String, String)> {
    Some((google_client_id()?, google_client_secret()?))
}

fn credential_entry() -> Result<Entry, CommandError> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|_| {
        CommandError::new(
            "CREDENTIAL_STORE_ERROR",
            "Tapedeck could not access the operating system credential vault.",
        )
    })
}

fn read_refresh_token() -> Result<Option<String>, CommandError> {
    match credential_entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err(CommandError::new(
            "CREDENTIAL_STORE_ERROR",
            "Tapedeck could not read the Google login from the operating system credential vault.",
        )),
    }
}

fn store_refresh_token(token: &str) -> Result<(), CommandError> {
    credential_entry()?.set_password(token).map_err(|_| {
        CommandError::new(
            "CREDENTIAL_STORE_ERROR",
            "Tapedeck could not save the Google login in the operating system credential vault.",
        )
    })
}

fn delete_refresh_token() -> Result<(), CommandError> {
    match credential_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err(CommandError::new(
            "CREDENTIAL_STORE_ERROR",
            "Tapedeck could not remove the Google login from the operating system credential vault.",
        )),
    }
}

async fn fetch_user(client: &Client, access_token: &str) -> Result<GoogleUser, CommandError> {
    let response = client
        .get(USERINFO_ENDPOINT)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| {
            CommandError::new(
                "GOOGLE_UNREACHABLE",
                "Google could not be reached. Check your connection and try again.",
            )
        })?;

    if !response.status().is_success() {
        return Err(CommandError::auth_required());
    }

    let profile: UserInfoResponse = response.json().await.map_err(|_| {
        CommandError::new(
            "GOOGLE_RESPONSE_ERROR",
            "Google returned an unreadable account profile.",
        )
    })?;
    let email = profile.email.unwrap_or_default();
    let name = profile
        .name
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| email.clone());

    Ok(GoogleUser {
        name,
        email,
        picture: profile.picture,
    })
}

async fn token_request(
    client: &Client,
    fields: &[(&str, &str)],
) -> Result<TokenResponse, CommandError> {
    let response = client
        .post(TOKEN_ENDPOINT)
        .form(fields)
        .send()
        .await
        .map_err(|_| {
            CommandError::new(
                "GOOGLE_UNREACHABLE",
                "Google could not be reached. Check your connection and try again.",
            )
        })?;

    if !response.status().is_success() {
        let error = response.json::<TokenErrorResponse>().await.ok();
        let is_invalid_grant =
            error.as_ref().and_then(|body| body.error.as_deref()) == Some("invalid_grant");
        if is_invalid_grant {
            let _ = delete_refresh_token();
            return Err(CommandError::auth_required());
        }
        let detail = error
            .and_then(|body| body.error_description)
            .unwrap_or_else(|| "Google rejected the sign-in request.".to_owned());
        return Err(CommandError::new("GOOGLE_AUTH_ERROR", detail));
    }

    response.json().await.map_err(|_| {
        CommandError::new(
            "GOOGLE_RESPONSE_ERROR",
            "Google returned an unreadable sign-in response.",
        )
    })
}

async fn refresh_session(
    state: &AppState,
    refresh_token: &str,
) -> Result<AccessSession, CommandError> {
    let (client_id, client_secret) = google_client().ok_or_else(|| {
        CommandError::new(
            "GOOGLE_CLIENT_NOT_CONFIGURED",
            "This build is missing its Google Desktop OAuth client credentials.",
        )
    })?;
    let token = token_request(
        &state.client,
        &[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ],
    )
    .await?;
    let user = fetch_user(&state.client, &token.access_token).await?;
    Ok(AccessSession {
        access_token: token.access_token,
        expires_at: Instant::now() + Duration::from_secs(token.expires_in.unwrap_or(3600)),
        user,
    })
}

pub async fn access_token(state: &AppState) -> Result<String, CommandError> {
    if let Some(session) = state.session()? {
        if session.expires_at > Instant::now() + Duration::from_secs(30) {
            return Ok(session.access_token);
        }
    }

    let refresh_token = read_refresh_token()?.ok_or_else(CommandError::auth_required)?;
    let session = refresh_session(state, &refresh_token).await?;
    let access_token = session.access_token.clone();
    state.set_session(Some(session))?;
    Ok(access_token)
}

#[tauri::command]
pub async fn google_auth_status(state: State<'_, AppState>) -> Result<AuthStatus, CommandError> {
    if google_client().is_none() {
        return Ok(AuthStatus {
            configured: false,
            authenticated: false,
            user: None,
        });
    }

    if let Some(session) = state.session()? {
        if session.expires_at > Instant::now() + Duration::from_secs(30) {
            return Ok(AuthStatus {
                configured: true,
                authenticated: true,
                user: Some(session.user),
            });
        }
    }

    let Some(refresh_token) = read_refresh_token()? else {
        return Ok(AuthStatus {
            configured: true,
            authenticated: false,
            user: None,
        });
    };

    match refresh_session(&state, &refresh_token).await {
        Ok(session) => {
            let user = session.user.clone();
            state.set_session(Some(session))?;
            Ok(AuthStatus {
                configured: true,
                authenticated: true,
                user: Some(user),
            })
        }
        Err(error) if error.code == "AUTH_REQUIRED" => Ok(AuthStatus {
            configured: true,
            authenticated: false,
            user: None,
        }),
        Err(error) => Err(error),
    }
}

fn random_url_safe(bytes: usize) -> String {
    let mut value = vec![0_u8; bytes];
    OsRng.fill_bytes(&mut value);
    URL_SAFE_NO_PAD.encode(value)
}

fn callback_response(
    listener: TcpListener,
    expected_state: String,
) -> Result<String, CommandError> {
    listener.set_nonblocking(true).map_err(|_| {
        CommandError::new(
            "OAUTH_CALLBACK_ERROR",
            "Tapedeck could not listen for the Google sign-in response.",
        )
    })?;
    let started = Instant::now();

    while started.elapsed() < OAUTH_TIMEOUT {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut bytes = [0_u8; 8192];
                let count = stream.read(&mut bytes).unwrap_or(0);
                let request = String::from_utf8_lossy(&bytes[..count]);
                let target = request
                    .lines()
                    .next()
                    .and_then(|line| line.split_whitespace().nth(1))
                    .unwrap_or("/");
                let callback = Url::parse(&format!("http://127.0.0.1{target}")).map_err(|_| {
                    CommandError::new(
                        "OAUTH_CALLBACK_ERROR",
                        "Google returned an invalid sign-in response.",
                    )
                })?;
                let params = callback
                    .query_pairs()
                    .collect::<std::collections::HashMap<_, _>>();
                let state_matches = params
                    .get("state")
                    .is_some_and(|value| value == &expected_state);

                let result = if !state_matches {
                    Err(CommandError::new(
                        "OAUTH_STATE_MISMATCH",
                        "Tapedeck rejected an unexpected sign-in response. Please try again.",
                    ))
                } else if let Some(error) = params.get("error") {
                    let message = if error == "access_denied" {
                        "Google sign-in was cancelled."
                    } else {
                        "Google could not complete the sign-in."
                    };
                    Err(CommandError::new("GOOGLE_AUTH_CANCELLED", message))
                } else if let Some(code) = params.get("code") {
                    Ok(code.to_string())
                } else {
                    Err(CommandError::new(
                        "OAUTH_CALLBACK_ERROR",
                        "Google did not return a sign-in code.",
                    ))
                };

                let success = result.is_ok();
                let title = if success {
                    "Signed in to Tapedeck"
                } else {
                    "Tapedeck sign-in failed"
                };
                let body = if success {
                    "You can close this window and return to Tapedeck."
                } else {
                    "Return to Tapedeck and try signing in again."
                };
                let html = format!(
                    "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>{title}</title><style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#171512;color:#f0ede7;font:16px system-ui}}main{{max-width:420px;padding:40px;text-align:center}}h1{{font-size:24px}}p{{color:#aaa49a;line-height:1.5}}</style><main><h1>{title}</h1><p>{body}</p></main>"
                );
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    html.len(), html
                );
                let _ = stream.write_all(response.as_bytes());
                return result;
            }
            Err(error) if error.kind() == ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(100));
            }
            Err(_) => {
                return Err(CommandError::new(
                    "OAUTH_CALLBACK_ERROR",
                    "Tapedeck could not receive the Google sign-in response.",
                ));
            }
        }
    }

    Err(CommandError::new(
        "GOOGLE_AUTH_TIMEOUT",
        "Google sign-in timed out. Please try again.",
    ))
}

#[tauri::command]
pub async fn sign_in_with_google(state: State<'_, AppState>) -> Result<AuthStatus, CommandError> {
    let (client_id, client_secret) = google_client().ok_or_else(|| {
        CommandError::new(
            "GOOGLE_CLIENT_NOT_CONFIGURED",
            "This build is missing its Google Desktop OAuth client credentials.",
        )
    })?;
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|_| {
        CommandError::new(
            "OAUTH_CALLBACK_ERROR",
            "Tapedeck could not start the local sign-in callback.",
        )
    })?;
    let port = listener
        .local_addr()
        .map_err(|_| {
            CommandError::new(
                "OAUTH_CALLBACK_ERROR",
                "Tapedeck could not create the sign-in callback URL.",
            )
        })?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}");
    let verifier = random_url_safe(64);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let oauth_state = random_url_safe(32);

    let mut authorization_url =
        Url::parse(AUTHORIZATION_ENDPOINT).expect("valid Google authorization endpoint");
    authorization_url
        .query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", SCOPES)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", &oauth_state)
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent");

    open::that_detached(authorization_url.as_str()).map_err(|_| {
        CommandError::new(
            "BROWSER_OPEN_FAILED",
            "Tapedeck could not open your browser for Google sign-in.",
        )
    })?;

    let code =
        tauri::async_runtime::spawn_blocking(move || callback_response(listener, oauth_state))
            .await
            .map_err(|_| {
                CommandError::new(
                    "OAUTH_CALLBACK_ERROR",
                    "The Google sign-in callback stopped unexpectedly.",
                )
            })??;
    let token = token_request(
        &state.client,
        &[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("code", code.as_str()),
            ("code_verifier", verifier.as_str()),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri.as_str()),
        ],
    )
    .await?;
    // Google's granular consent lets users uncheck individual scopes; without
    // youtube.readonly the session cannot do anything, so reject it up front
    // instead of storing a login that fails on every load. An absent scope
    // field means every requested scope was granted (RFC 6749 §5.1).
    let youtube_granted = token.scope.as_deref().is_none_or(|granted| {
        granted
            .split(' ')
            .any(|scope| scope == "https://www.googleapis.com/auth/youtube.readonly")
    });
    if !youtube_granted {
        let _ = state
            .client
            .post(REVOCATION_ENDPOINT)
            .form(&[("token", token.access_token.as_str())])
            .send()
            .await;
        return Err(CommandError::new(
            "YOUTUBE_SCOPE_MISSING",
            "Google sign-in finished without YouTube access. Sign in again and keep the box that lets Tapedeck view your YouTube account checked.",
        ));
    }
    let refresh_token = token.refresh_token.ok_or_else(|| {
        CommandError::new(
            "REFRESH_TOKEN_MISSING",
            "Google did not return an offline login. Remove Tapedeck from your Google account access and try again.",
        )
    })?;
    store_refresh_token(&refresh_token)?;
    let user = fetch_user(&state.client, &token.access_token).await?;
    state.set_session(Some(AccessSession {
        access_token: token.access_token,
        expires_at: Instant::now() + Duration::from_secs(token.expires_in.unwrap_or(3600)),
        user: user.clone(),
    }))?;

    Ok(AuthStatus {
        configured: true,
        authenticated: true,
        user: Some(user),
    })
}

#[tauri::command]
pub async fn sign_out_google(state: State<'_, AppState>) -> Result<AuthStatus, CommandError> {
    let token = read_refresh_token()?;
    state.set_session(None)?;
    delete_refresh_token()?;

    if let Some(token) = token {
        let _ = state
            .client
            .post(REVOCATION_ENDPOINT)
            .form(&[("token", token.as_str())])
            .send()
            .await;
    }

    Ok(AuthStatus {
        configured: google_client().is_some(),
        authenticated: false,
        user: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_values_are_url_safe() {
        let verifier = random_url_safe(64);
        assert!(verifier.len() >= 43);
        assert!(!verifier.contains('='));
        assert!(!verifier.contains('+'));
        assert!(!verifier.contains('/'));
    }
}
