use std::collections::HashMap;

use percent_encoding::percent_decode_str;
use reqwest::StatusCode;
use serde::Serialize;
use serde_json::Value;
use tauri::State;
use url::Url;

use crate::auth::{access_token, AppState, CommandError};

const API_ROOT: &str = "https://www.googleapis.com/youtube/v3";
const MAX_TRACKS: usize = 150;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    name: String,
    kind: String,
    description: String,
    thumbnail: String,
    source_url: String,
    tracks: Vec<Track>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Track {
    id: String,
    title: String,
    artist: String,
    duration: u64,
    unavailable: bool,
}

#[derive(Clone, Debug, PartialEq)]
enum Source {
    Playlist {
        id: String,
        canonical_url: String,
    },
    Channel {
        filter: String,
        id: String,
        canonical_url: String,
    },
    Custom {
        id: String,
        canonical_url: String,
    },
}

#[derive(Debug)]
struct SourceMetadata {
    playlist_id: String,
    name: String,
    description: String,
    thumbnail: String,
    kind: String,
}

fn invalid_url() -> CommandError {
    CommandError::new(
        "INVALID_URL",
        "That doesn't look like a YouTube channel or playlist link. Check the URL and try again.",
    )
}

fn decode_path(value: &str) -> String {
    percent_decode_str(value).decode_utf8_lossy().into_owned()
}

fn parse_youtube_source(value: &str) -> Result<Source, CommandError> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > 2048 {
        return Err(CommandError::new(
            "INVALID_URL",
            "Provide a valid YouTube channel or playlist URL.",
        ));
    }

    let normalized = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_owned()
    } else {
        format!("https://{trimmed}")
    };
    let parsed = Url::parse(&normalized).map_err(|_| invalid_url())?;
    let host = parsed
        .host_str()
        .unwrap_or_default()
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    if host != "youtube.com" && host != "music.youtube.com" {
        return Err(invalid_url());
    }

    if let Some((_, playlist_id)) = parsed.query_pairs().find(|(key, _)| key == "list") {
        if playlist_id.is_empty() {
            return Err(invalid_url());
        }
        return Ok(Source::Playlist {
            id: playlist_id.to_string(),
            canonical_url: format!("https://www.youtube.com/playlist?list={}", playlist_id),
        });
    }

    let parts: Vec<String> = parsed
        .path_segments()
        .map(|segments| {
            segments
                .filter(|part| !part.is_empty())
                .map(decode_path)
                .collect()
        })
        .unwrap_or_default();
    let first = parts.first().map(String::as_str).unwrap_or_default();

    if first.starts_with('@') && first.len() > 1 {
        return Ok(Source::Channel {
            filter: "forHandle".to_owned(),
            id: first.to_owned(),
            canonical_url: format!("https://www.youtube.com/{first}"),
        });
    }
    if first == "channel" && parts.get(1).is_some_and(|part| !part.is_empty()) {
        let id = parts[1].clone();
        return Ok(Source::Channel {
            filter: "id".to_owned(),
            canonical_url: format!("https://www.youtube.com/channel/{id}"),
            id,
        });
    }
    if first == "user" && parts.get(1).is_some_and(|part| !part.is_empty()) {
        let id = parts[1].clone();
        return Ok(Source::Channel {
            filter: "forUsername".to_owned(),
            canonical_url: format!("https://www.youtube.com/user/{id}"),
            id,
        });
    }
    if first == "c" && parts.get(1).is_some_and(|part| !part.is_empty()) {
        let id = parts[1].clone();
        return Ok(Source::Custom {
            canonical_url: format!("https://www.youtube.com/c/{id}"),
            id,
        });
    }

    Err(invalid_url())
}

fn canonical_url(source: &Source) -> String {
    match source {
        Source::Playlist { canonical_url, .. }
        | Source::Channel { canonical_url, .. }
        | Source::Custom { canonical_url, .. } => canonical_url.clone(),
    }
}

fn text_at(value: &Value, pointer: &str) -> String {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}

fn best_thumbnail(value: &Value) -> String {
    ["maxres", "standard", "high", "medium", "default"]
        .iter()
        .find_map(|quality| {
            value
                .get(*quality)
                .and_then(|thumbnail| thumbnail.get("url"))
                .and_then(Value::as_str)
        })
        .unwrap_or_default()
        .to_owned()
}

fn youtube_error(status: StatusCode, body: &Value) -> CommandError {
    let reason = body
        .pointer("/error/errors/0/reason")
        .and_then(Value::as_str)
        .unwrap_or_default();

    match (status, reason) {
        (StatusCode::UNAUTHORIZED, _) | (_, "authError") | (_, "insufficientPermissions") => {
            CommandError::new(
                "AUTH_REQUIRED",
                "Your Google session no longer has permission to read YouTube. Sign in again.",
            )
        }
        (_, "quotaExceeded") | (_, "dailyLimitExceeded") => CommandError::new(
            "QUOTA_EXCEEDED",
            "The YouTube API quota is temporarily exhausted. Try again later.",
        ),
        (StatusCode::BAD_REQUEST, _) | (StatusCode::NOT_FOUND, _) => CommandError::new(
            "SOURCE_NOT_FOUND",
            "YouTube could not find that channel or playlist.",
        ),
        _ => CommandError::new(
            "YOUTUBE_REJECTED",
            "YouTube rejected the request. Try signing in again or use another source.",
        ),
    }
}

async fn youtube_get(
    state: &AppState,
    resource: &str,
    params: Vec<(&str, String)>,
    token: &str,
) -> Result<Value, CommandError> {
    let response = state
        .client
        .get(format!("{API_ROOT}/{resource}"))
        .bearer_auth(token)
        .query(&params)
        .send()
        .await
        .map_err(|_| {
            CommandError::new(
                "YOUTUBE_UNREACHABLE",
                "YouTube could not be reached. Check your connection and try again.",
            )
        })?;
    let status = response.status();
    let body = response.json::<Value>().await.map_err(|_| {
        CommandError::new(
            "YOUTUBE_RESPONSE_ERROR",
            "YouTube returned an unreadable response.",
        )
    })?;

    if status.is_success() {
        Ok(body)
    } else {
        Err(youtube_error(status, &body))
    }
}

async fn resolve_channel(
    state: &AppState,
    source: &Source,
    token: &str,
) -> Result<SourceMetadata, CommandError> {
    let (filter, identifier) = match source {
        Source::Channel { filter, id, .. } => (filter.clone(), id.clone()),
        Source::Custom { id, .. } => {
            let search = youtube_get(
                state,
                "search",
                vec![
                    ("part", "snippet".to_owned()),
                    ("q", id.clone()),
                    ("type", "channel".to_owned()),
                    ("maxResults", "1".to_owned()),
                ],
                token,
            )
            .await?;
            let channel_id = text_at(&search, "/items/0/snippet/channelId");
            ("id".to_owned(), channel_id)
        }
        Source::Playlist { .. } => unreachable!("playlist passed to channel resolver"),
    };

    if identifier.is_empty() {
        return Err(CommandError::new(
            "SOURCE_NOT_FOUND",
            "YouTube could not find that channel.",
        ));
    }
    let response = youtube_get(
        state,
        "channels",
        vec![
            ("part", "snippet,contentDetails".to_owned()),
            (filter.as_str(), identifier),
            ("maxResults", "1".to_owned()),
        ],
        token,
    )
    .await?;
    let channel = response.pointer("/items/0").ok_or_else(|| {
        CommandError::new("SOURCE_NOT_FOUND", "YouTube could not find that channel.")
    })?;
    let playlist_id = text_at(channel, "/contentDetails/relatedPlaylists/uploads");
    if playlist_id.is_empty() {
        return Err(CommandError::new(
            "SOURCE_NOT_FOUND",
            "This channel does not expose an uploads playlist.",
        ));
    }

    Ok(SourceMetadata {
        playlist_id,
        name: text_at(channel, "/snippet/title"),
        description: text_at(channel, "/snippet/description"),
        thumbnail: best_thumbnail(
            channel
                .pointer("/snippet/thumbnails")
                .unwrap_or(&Value::Null),
        ),
        kind: "YouTube channel".to_owned(),
    })
}

async fn resolve_playlist(
    state: &AppState,
    playlist_id: &str,
    token: &str,
) -> Result<SourceMetadata, CommandError> {
    let response = youtube_get(
        state,
        "playlists",
        vec![
            ("part", "snippet,contentDetails".to_owned()),
            ("id", playlist_id.to_owned()),
            ("maxResults", "1".to_owned()),
        ],
        token,
    )
    .await?;
    let playlist = response.pointer("/items/0").ok_or_else(|| {
        CommandError::new(
            "SOURCE_NOT_FOUND",
            "YouTube could not find that playlist, or it is private.",
        )
    })?;

    Ok(SourceMetadata {
        playlist_id: text_at(playlist, "/id"),
        name: text_at(playlist, "/snippet/title"),
        description: text_at(playlist, "/snippet/description"),
        thumbnail: best_thumbnail(
            playlist
                .pointer("/snippet/thumbnails")
                .unwrap_or(&Value::Null),
        ),
        kind: "YouTube playlist".to_owned(),
    })
}

async fn load_playlist_items(
    state: &AppState,
    playlist_id: &str,
    token: &str,
) -> Result<Vec<Value>, CommandError> {
    let mut items = Vec::new();
    let mut page_token = String::new();

    loop {
        let remaining = MAX_TRACKS - items.len();
        let mut params = vec![
            ("part", "snippet,contentDetails,status".to_owned()),
            ("playlistId", playlist_id.to_owned()),
            ("maxResults", remaining.min(50).to_string()),
        ];
        if !page_token.is_empty() {
            params.push(("pageToken", page_token.clone()));
        }
        let response = youtube_get(state, "playlistItems", params, token).await?;
        if let Some(next_items) = response.get("items").and_then(Value::as_array) {
            items.extend(next_items.iter().cloned());
        }
        page_token = text_at(&response, "/nextPageToken");
        if page_token.is_empty() || items.len() >= MAX_TRACKS {
            break;
        }
    }

    items.truncate(MAX_TRACKS);
    Ok(items)
}

async fn load_video_details(
    state: &AppState,
    video_ids: &[String],
    token: &str,
) -> Result<HashMap<String, Value>, CommandError> {
    let mut details = HashMap::new();
    for ids in video_ids.chunks(50) {
        let response = youtube_get(
            state,
            "videos",
            vec![
                ("part", "contentDetails,status".to_owned()),
                ("id", ids.join(",")),
                ("maxResults", "50".to_owned()),
            ],
            token,
        )
        .await?;
        if let Some(items) = response.get("items").and_then(Value::as_array) {
            for item in items {
                let id = text_at(item, "/id");
                if !id.is_empty() {
                    details.insert(id, item.clone());
                }
            }
        }
    }
    Ok(details)
}

fn parse_iso_duration(value: &str) -> u64 {
    let Some(body) = value.strip_prefix('P') else {
        return 0;
    };
    let (date, time) = body.split_once('T').unwrap_or((body, ""));
    let days = date
        .strip_suffix('D')
        .and_then(|part| part.parse::<u64>().ok())
        .unwrap_or(0);
    let mut number = String::new();
    let mut hours = 0;
    let mut minutes = 0;
    let mut seconds = 0;
    for character in time.chars() {
        if character.is_ascii_digit() {
            number.push(character);
            continue;
        }
        let parsed = number.parse::<u64>().unwrap_or(0);
        match character {
            'H' => hours = parsed,
            'M' => minutes = parsed,
            'S' => seconds = parsed,
            _ => return 0,
        }
        number.clear();
    }
    days * 86_400 + hours * 3_600 + minutes * 60 + seconds
}

#[tauri::command]
pub async fn resolve_youtube_source(
    url: String,
    state: State<'_, AppState>,
) -> Result<Playlist, CommandError> {
    let source = parse_youtube_source(&url)?;
    let source_url = canonical_url(&source);
    let token = access_token(&state).await?;
    let metadata = match &source {
        Source::Playlist { id, .. } => resolve_playlist(&state, id, &token).await?,
        Source::Channel { .. } | Source::Custom { .. } => {
            resolve_channel(&state, &source, &token).await?
        }
    };
    let playlist_items = load_playlist_items(&state, &metadata.playlist_id, &token).await?;
    let video_ids: Vec<String> = playlist_items
        .iter()
        .filter_map(|item| {
            let id = text_at(item, "/contentDetails/videoId");
            (!id.is_empty()).then_some(id)
        })
        .collect();
    let details = load_video_details(&state, &video_ids, &token).await?;

    let tracks: Vec<Track> = playlist_items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let mut id = text_at(item, "/contentDetails/videoId");
            if id.is_empty() {
                id = format!("unavailable-{index}");
            }
            let detail = details.get(&id);
            let unavailable = detail.is_none()
                || detail.is_some_and(|value| {
                    value.pointer("/status/embeddable").and_then(Value::as_bool) == Some(false)
                        || value
                            .pointer("/status/privacyStatus")
                            .and_then(Value::as_str)
                            != Some("public")
                });
            let owner = text_at(item, "/snippet/videoOwnerChannelTitle");
            let channel = text_at(item, "/snippet/channelTitle");
            let artist = if unavailable {
                "Unavailable on YouTube".to_owned()
            } else if !owner.is_empty() {
                owner
            } else if !channel.is_empty() {
                channel
            } else {
                metadata.name.clone()
            };
            Track {
                id,
                title: {
                    let title = text_at(item, "/snippet/title");
                    if title.is_empty() {
                        "Unavailable video".to_owned()
                    } else {
                        title
                    }
                },
                artist,
                duration: detail
                    .map(|value| parse_iso_duration(&text_at(value, "/contentDetails/duration")))
                    .unwrap_or(0),
                unavailable,
            }
        })
        .collect();

    if tracks.is_empty() {
        return Err(CommandError::new(
            "EMPTY_SOURCE",
            "That source does not contain any videos available to your account.",
        ));
    }

    Ok(Playlist {
        name: if metadata.name.is_empty() {
            "YouTube source".to_owned()
        } else {
            metadata.name
        },
        kind: metadata.kind,
        description: metadata.description,
        thumbnail: metadata.thumbnail,
        source_url,
        tracks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_supported_youtube_sources() {
        assert!(matches!(
            parse_youtube_source("https://www.youtube.com/@lofihiphopmusic"),
            Ok(Source::Channel { filter, id, .. }) if filter == "forHandle" && id == "@lofihiphopmusic"
        ));
        assert!(matches!(
            parse_youtube_source("youtube.com/playlist?list=PL123"),
            Ok(Source::Playlist { id, .. }) if id == "PL123"
        ));
        assert!(parse_youtube_source("https://example.com/playlist?list=PL123").is_err());
    }

    #[test]
    fn parses_youtube_durations() {
        assert_eq!(parse_iso_duration("PT4M3S"), 243);
        assert_eq!(parse_iso_duration("PT1H2M3S"), 3723);
        assert_eq!(parse_iso_duration("P1DT2H"), 93_600);
        assert_eq!(parse_iso_duration("not-a-duration"), 0);
    }
}
