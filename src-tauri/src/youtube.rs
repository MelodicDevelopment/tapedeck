use std::collections::HashMap;

use percent_encoding::percent_decode_str;
use reqwest::StatusCode;
use serde::Serialize;
use serde_json::Value;
use tauri::State;
use url::Url;

use crate::auth::{google_env, send_with_retry, transport_detail, AppState, CommandError};

const API_ROOT: &str = "https://www.googleapis.com/youtube/v3";
/// InnerTube is the JSON API youtube.com's own web client uses. It needs no
/// API key and has no quota, which the Data API's `search.list` (100 units
/// per call against a 10k/day budget shared by every install) cannot offer.
const INNERTUBE_SEARCH: &str = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false";
const INNERTUBE_CLIENT_VERSION: &str = "2.20240701.00.00";
/// `SearchFilter.type = video` — keeps channels, playlists, and shelves out.
const INNERTUBE_VIDEO_FILTER: &str = "EgIQAQ%3D%3D";
const WEB_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

fn youtube_api_key() -> Option<String> {
    google_env(
        "TAPEDECK_YOUTUBE_API_KEY",
        option_env!("TAPEDECK_YOUTUBE_API_KEY"),
    )
}

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
pub struct Track {
    id: String,
    title: String,
    artist: String,
    duration: u64,
    unavailable: bool,
    /// The uploader's channel id, so the UI can link to the creator's page.
    #[serde(skip_serializing_if = "Option::is_none")]
    channel_id: Option<String>,
}

fn non_empty(value: String) -> Option<String> {
    (!value.is_empty()).then_some(value)
}

/// A video found by `search_youtube`. Not a `Track` yet: embeddability and
/// privacy aren't known until it is resolved through the Data API on add.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    id: String,
    title: String,
    channel: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    channel_id: Option<String>,
    /// Seconds; 0 when YouTube didn't report a length (live streams).
    duration: u64,
    thumbnail: String,
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
    Video {
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
        "That doesn't look like a YouTube video, channel, or playlist link. Check the URL and try again.",
    )
}

/// YouTube video ids are 11 chars of [A-Za-z0-9_-]; anything else is not a
/// video we can look up.
fn is_video_id(value: &str) -> bool {
    value.len() == 11
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '_' || character == '-'
        })
}

fn video_source(id: &str) -> Result<Source, CommandError> {
    if !is_video_id(id) {
        return Err(invalid_url());
    }
    Ok(Source::Video {
        id: id.to_owned(),
        canonical_url: format!("https://www.youtube.com/watch?v={id}"),
    })
}

fn decode_path(value: &str) -> String {
    percent_decode_str(value).decode_utf8_lossy().into_owned()
}

fn parse_youtube_source(value: &str) -> Result<Source, CommandError> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > 2048 {
        return Err(CommandError::new(
            "INVALID_URL",
            "Provide a valid YouTube video, channel, or playlist URL.",
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
    if host == "youtu.be" {
        let id = parsed
            .path_segments()
            .and_then(|mut segments| segments.next())
            .map(decode_path)
            .unwrap_or_default();
        return video_source(&id);
    }
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

    if let Some((_, video_id)) = parsed.query_pairs().find(|(key, _)| key == "v") {
        return video_source(&video_id);
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
    if matches!(first, "shorts" | "embed" | "live" | "v")
        && parts.get(1).is_some_and(|part| !part.is_empty())
    {
        return video_source(&parts[1]);
    }

    Err(invalid_url())
}

fn canonical_url(source: &Source) -> String {
    match source {
        Source::Playlist { canonical_url, .. }
        | Source::Channel { canonical_url, .. }
        | Source::Custom { canonical_url, .. }
        | Source::Video { canonical_url, .. } => canonical_url.clone(),
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
        (_, "quotaExceeded") | (_, "dailyLimitExceeded") => CommandError::new(
            "QUOTA_EXCEEDED",
            "The YouTube API quota is temporarily exhausted. Try again later.",
        ),
        (StatusCode::UNAUTHORIZED, _) | (StatusCode::FORBIDDEN, _) => CommandError::new(
            "YOUTUBE_API_KEY_ERROR",
            "Tapedeck's YouTube API key was rejected. This is a configuration issue, not something you can fix here.",
        ),
        (StatusCode::BAD_REQUEST, _) | (StatusCode::NOT_FOUND, _) => CommandError::new(
            "SOURCE_NOT_FOUND",
            "YouTube could not find that video, channel, or playlist.",
        ),
        _ => CommandError::new(
            "YOUTUBE_REJECTED",
            "YouTube rejected the request. Try again or use another source.",
        ),
    }
}

async fn youtube_get(
    state: &AppState,
    resource: &str,
    mut params: Vec<(&str, String)>,
    api_key: &str,
) -> Result<Value, CommandError> {
    params.push(("key", api_key.to_owned()));
    let response = send_with_retry(
        state
            .client
            .get(format!("{API_ROOT}/{resource}"))
            .query(&params),
    )
    .await
    .map_err(|error| {
        CommandError::new(
            "YOUTUBE_UNREACHABLE",
            format!(
                "YouTube could not be reached ({}). Check your connection and try again.",
                transport_detail(&error)
            ),
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
    api_key: &str,
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
                api_key,
            )
            .await?;
            let channel_id = text_at(&search, "/items/0/snippet/channelId");
            ("id".to_owned(), channel_id)
        }
        Source::Playlist { .. } | Source::Video { .. } => {
            unreachable!("non-channel source passed to channel resolver")
        }
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
        api_key,
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
    api_key: &str,
) -> Result<SourceMetadata, CommandError> {
    let response = youtube_get(
        state,
        "playlists",
        vec![
            ("part", "snippet,contentDetails".to_owned()),
            ("id", playlist_id.to_owned()),
            ("maxResults", "1".to_owned()),
        ],
        api_key,
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
    api_key: &str,
) -> Result<Vec<Value>, CommandError> {
    let mut items = Vec::new();
    let mut page_token = String::new();

    loop {
        let mut params = vec![
            ("part", "snippet,contentDetails,status".to_owned()),
            ("playlistId", playlist_id.to_owned()),
            ("maxResults", "50".to_owned()),
        ];
        if !page_token.is_empty() {
            params.push(("pageToken", page_token.clone()));
        }
        // Channels without any uploaded videos 404 on their uploads playlist;
        // report that as an empty source instead of "not found".
        let response = match youtube_get(state, "playlistItems", params, api_key).await {
            Ok(response) => response,
            Err(error) if error.code == "SOURCE_NOT_FOUND" && items.is_empty() => break,
            Err(error) => return Err(error),
        };
        if let Some(next_items) = response.get("items").and_then(Value::as_array) {
            items.extend(next_items.iter().cloned());
        }
        page_token = text_at(&response, "/nextPageToken");
        if page_token.is_empty() {
            break;
        }
    }

    Ok(items)
}

async fn load_video_details(
    state: &AppState,
    video_ids: &[String],
    api_key: &str,
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
            api_key,
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
    let api_key = youtube_api_key().ok_or_else(|| {
        CommandError::new(
            "YOUTUBE_API_KEY_NOT_CONFIGURED",
            "This build is missing its YouTube API key.",
        )
    })?;
    if let Source::Video { id, .. } = &source {
        return resolve_single_video(&state, id, source_url, &api_key).await;
    }
    let metadata = match &source {
        Source::Playlist { id, .. } => resolve_playlist(&state, id, &api_key).await?,
        Source::Channel { .. } | Source::Custom { .. } => {
            resolve_channel(&state, &source, &api_key).await?
        }
        Source::Video { .. } => unreachable!("handled above"),
    };
    let playlist_items = load_playlist_items(&state, &metadata.playlist_id, &api_key).await?;
    let video_ids: Vec<String> = playlist_items
        .iter()
        .filter_map(|item| {
            let id = text_at(item, "/contentDetails/videoId");
            (!id.is_empty()).then_some(id)
        })
        .collect();
    let details = load_video_details(&state, &video_ids, &api_key).await?;

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
            let channel_id = if unavailable {
                None
            } else {
                non_empty(text_at(item, "/snippet/videoOwnerChannelId"))
            };
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
                channel_id,
            }
        })
        .collect();

    if tracks.is_empty() {
        return Err(CommandError::new(
            "EMPTY_SOURCE",
            "That source does not contain any public videos.",
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

/// Looks up a single video by id — used when the user clicks a related
/// video inside the embedded YouTube player (its "More videos" overlay,
/// end screens, etc.) so it can play inline instead of just opening a
/// browser tab. Unlike `resolve_youtube_source`, this isn't scoped to any
/// playlist, so title/channel/duration all come from `videos.list` directly.
#[tauri::command]
pub async fn resolve_video(
    video_id: String,
    state: State<'_, AppState>,
) -> Result<Track, CommandError> {
    let api_key = youtube_api_key().ok_or_else(|| {
        CommandError::new(
            "YOUTUBE_API_KEY_NOT_CONFIGURED",
            "This build is missing its YouTube API key.",
        )
    })?;
    fetch_video(&state, &video_id, &api_key)
        .await
        .map(|(track, _)| track)
}

/// A single video saved as its own one-track source.
async fn resolve_single_video(
    state: &AppState,
    video_id: &str,
    source_url: String,
    api_key: &str,
) -> Result<Playlist, CommandError> {
    let (track, video) = fetch_video(state, video_id, api_key).await?;
    Ok(Playlist {
        name: track.title.clone(),
        kind: "YouTube video".to_owned(),
        description: text_at(&video, "/snippet/description"),
        thumbnail: best_thumbnail(video.pointer("/snippet/thumbnails").unwrap_or(&Value::Null)),
        source_url,
        tracks: vec![track],
    })
}

/// `videos.list` for one id, normalized into a Track (plus the raw item for
/// callers that need more of the snippet).
async fn fetch_video(
    state: &AppState,
    video_id: &str,
    api_key: &str,
) -> Result<(Track, Value), CommandError> {
    let response = youtube_get(
        state,
        "videos",
        vec![
            ("part", "snippet,contentDetails,status".to_owned()),
            ("id", video_id.to_owned()),
        ],
        api_key,
    )
    .await?;
    let video = response.pointer("/items/0").ok_or_else(|| {
        CommandError::new(
            "SOURCE_NOT_FOUND",
            "That video could not be found on YouTube.",
        )
    })?;

    let unavailable = video.pointer("/status/embeddable").and_then(Value::as_bool) == Some(false)
        || video
            .pointer("/status/privacyStatus")
            .and_then(Value::as_str)
            != Some("public");
    let title = text_at(video, "/snippet/title");
    let artist = text_at(video, "/snippet/channelTitle");

    let track = Track {
        id: video_id.to_owned(),
        title: if title.is_empty() {
            "Unavailable video".to_owned()
        } else {
            title
        },
        artist: if unavailable {
            "Unavailable on YouTube".to_owned()
        } else if artist.is_empty() {
            "YouTube".to_owned()
        } else {
            artist
        },
        duration: parse_iso_duration(&text_at(video, "/contentDetails/duration")),
        unavailable,
        channel_id: if unavailable {
            None
        } else {
            non_empty(text_at(video, "/snippet/channelId"))
        },
    };
    Ok((track, video.clone()))
}

/// Searches YouTube for videos matching `query` via InnerTube (see the
/// constant's note). Returns the first page of video results.
#[tauri::command]
pub async fn search_youtube(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, CommandError> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": INNERTUBE_CLIENT_VERSION,
                "hl": "en",
                "gl": "US",
            }
        },
        "query": query,
        "params": INNERTUBE_VIDEO_FILTER,
    });
    let response = send_with_retry(
        state
            .client
            .post(INNERTUBE_SEARCH)
            .header("User-Agent", WEB_USER_AGENT)
            .header("X-YouTube-Client-Name", "1")
            .header("X-YouTube-Client-Version", INNERTUBE_CLIENT_VERSION)
            .json(&body),
    )
    .await
    .map_err(|error| {
        CommandError::new(
            "YOUTUBE_UNREACHABLE",
            format!(
                "YouTube could not be reached ({}). Check your connection and try again.",
                transport_detail(&error)
            ),
        )
    })?;
    if !response.status().is_success() {
        return Err(CommandError::new(
            "YOUTUBE_SEARCH_FAILED",
            format!("YouTube search failed (HTTP {}).", response.status().as_u16()),
        ));
    }
    let payload = response.json::<Value>().await.map_err(|_| {
        CommandError::new(
            "YOUTUBE_RESPONSE_ERROR",
            "YouTube returned an unreadable search response.",
        )
    })?;
    Ok(parse_search_results(&payload))
}

/// Pulls `videoRenderer` items out of an InnerTube search response. The
/// layout is deeply nested (section list → item sections → items); anything
/// that isn't a plain video (shelves, ads, channels) is skipped.
fn parse_search_results(payload: &Value) -> Vec<SearchResult> {
    let sections = payload
        .pointer("/contents/twoColumnSearchResultsRenderer/primaryContents/sectionListRenderer/contents")
        .and_then(Value::as_array);
    let Some(sections) = sections else {
        return Vec::new();
    };
    sections
        .iter()
        .filter_map(|section| section.pointer("/itemSectionRenderer/contents")?.as_array())
        .flatten()
        .filter_map(|item| item.get("videoRenderer"))
        .filter_map(parse_video_renderer)
        .collect()
}

fn parse_video_renderer(video: &Value) -> Option<SearchResult> {
    let id = text_at(video, "/videoId");
    if !is_video_id(&id) {
        return None;
    }
    let title = text_at(video, "/title/runs/0/text");
    if title.is_empty() {
        return None;
    }
    let channel = text_at(video, "/ownerText/runs/0/text");
    let channel_id = non_empty(text_at(
        video,
        "/ownerText/runs/0/navigationEndpoint/browseEndpoint/browseId",
    ));
    let duration = parse_clock_duration(&text_at(video, "/lengthText/simpleText"));
    // Thumbnails are listed smallest first; the standard mqdefault frame is
    // what the queue already uses, so prefer the stable i.ytimg.com URL.
    let thumbnail = format!("https://i.ytimg.com/vi/{id}/mqdefault.jpg");
    Some(SearchResult {
        id,
        title,
        channel: if channel.is_empty() {
            "YouTube".to_owned()
        } else {
            channel
        },
        channel_id,
        duration,
        thumbnail,
    })
}

/// "3:26" → 206, "1:02:03" → 3723. Empty or unparseable → 0.
fn parse_clock_duration(value: &str) -> u64 {
    let mut total = 0u64;
    for part in value.trim().split(':') {
        let Ok(number) = part.parse::<u64>() else {
            return 0;
        };
        total = total * 60 + number;
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_innertube_search_results() {
        let payload = serde_json::json!({
            "contents": { "twoColumnSearchResultsRenderer": { "primaryContents": { "sectionListRenderer": { "contents": [
                { "itemSectionRenderer": { "contents": [
                    { "shelfRenderer": {} },
                    { "videoRenderer": {
                        "videoId": "XflAUat6b78",
                        "title": { "runs": [{ "text": "A Sky Full of Stars Cover by Oka" }] },
                        "ownerText": { "runs": [{ "text": "MUSICOKAAY", "navigationEndpoint": { "browseEndpoint": { "browseId": "UCRFPDKnsK0DBN2aPG2wX_3w" } } }] },
                        "lengthText": { "simpleText": "3:00" }
                    } },
                    { "videoRenderer": { "videoId": "live0000001", "title": { "runs": [{ "text": "Live now" }] } } }
                ] } },
                { "continuationItemRenderer": {} }
            ] } } } }
        });
        let results = parse_search_results(&payload);
        assert_eq!(results.len(), 2);
        assert_eq!(
            results[0],
            SearchResult {
                id: "XflAUat6b78".to_owned(),
                title: "A Sky Full of Stars Cover by Oka".to_owned(),
                channel: "MUSICOKAAY".to_owned(),
                channel_id: Some("UCRFPDKnsK0DBN2aPG2wX_3w".to_owned()),
                duration: 180,
                thumbnail: "https://i.ytimg.com/vi/XflAUat6b78/mqdefault.jpg".to_owned(),
            }
        );
        assert_eq!(results[1].channel, "YouTube");
        assert_eq!(results[1].duration, 0);
        assert!(parse_search_results(&serde_json::json!({})).is_empty());
    }

    #[test]
    fn parses_clock_durations() {
        assert_eq!(parse_clock_duration("3:26"), 206);
        assert_eq!(parse_clock_duration("1:02:03"), 3723);
        assert_eq!(parse_clock_duration(""), 0);
        assert_eq!(parse_clock_duration("LIVE"), 0);
    }

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
    fn parses_single_video_urls() {
        for url in [
            "https://www.youtube.com/watch?v=eblCSdq4rzU",
            "https://youtu.be/eblCSdq4rzU?t=10",
            "https://www.youtube.com/shorts/eblCSdq4rzU",
            "youtube.com/embed/eblCSdq4rzU",
        ] {
            assert!(
                matches!(
                    parse_youtube_source(url),
                    Ok(Source::Video { id, canonical_url })
                        if id == "eblCSdq4rzU"
                            && canonical_url == "https://www.youtube.com/watch?v=eblCSdq4rzU"
                ),
                "{url}"
            );
        }
        // A watch URL with a playlist context loads the playlist, as before.
        assert!(matches!(
            parse_youtube_source("https://www.youtube.com/watch?v=eblCSdq4rzU&list=PL123"),
            Ok(Source::Playlist { id, .. }) if id == "PL123"
        ));
        assert!(parse_youtube_source("https://www.youtube.com/watch?v=short").is_err());
    }

    #[test]
    fn parses_youtube_durations() {
        assert_eq!(parse_iso_duration("PT4M3S"), 243);
        assert_eq!(parse_iso_duration("PT1H2M3S"), 3723);
        assert_eq!(parse_iso_duration("P1DT2H"), 93_600);
        assert_eq!(parse_iso_duration("not-a-duration"), 0);
    }
}
