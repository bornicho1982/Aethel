use reqwest::Client;
use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use crate::auth::get_valid_token;

#[derive(Serialize, Deserialize, Debug)]
pub struct LyricsResult {
    pub id: Option<i64>,
    #[serde(rename = "trackName")]
    pub track_name: Option<String>,
    #[serde(rename = "artistName")]
    pub artist_name: Option<String>,
    #[serde(rename = "syncedLyrics")]
    pub synced_lyrics: Option<String>,
    #[serde(rename = "plainLyrics")]
    pub plain_lyrics: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ItunesResult {
    #[serde(rename = "artworkUrl100")]
    pub artwork_url_100: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ItunesResponse {
    pub results: Vec<ItunesResult>,
}

lazy_static::lazy_static! {
    static ref HTTP_CLIENT: Client = Client::builder()
        .user_agent("AethelMediaPlayer/1.0 (Linux)")
        .build()
        .unwrap();
}

#[tauri::command]
pub async fn fetch_lyrics(artist: String, track: String) -> Result<Option<LyricsResult>, String> {
    let url = format!(
        "https://lrclib.net/api/get?artist_name={}&track_name={}",
        urlencoding::encode(&artist),
        urlencoding::encode(&track)
    );

    let res = HTTP_CLIENT
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if res.status().is_success() {
        let lyrics: LyricsResult = res.json().await.map_err(|e| e.to_string())?;
        return Ok(Some(lyrics));
    }

    Ok(None)
}

#[tauri::command]
pub async fn fetch_cover_art(artist: String, album: String, state: State<'_, Mutex<Connection>>) -> Result<Option<String>, String> {
    let term = format!("{} {}", artist, album);
    
    // 1. Try iTunes API
    let itunes_url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=1",
        urlencoding::encode(&term)
    );
    if let Ok(res) = HTTP_CLIENT.get(&itunes_url).send().await {
        if res.status().is_success() {
            if let Ok(data) = res.json::<ItunesResponse>().await {
                if let Some(first_result) = data.results.first() {
                    if let Some(url_100) = &first_result.artwork_url_100 {
                        let hd_url = url_100.replace("100x100bb", "600x600bb");
                        return Ok(Some(hd_url));
                    }
                }
            }
        }
    }

    // 2. Try Spotify API as fallback
    if let Ok(token) = get_valid_token("spotify", &state).await {
        let spotify_url = format!(
            "https://api.spotify.com/v1/search?q={}&type=track&limit=1",
            urlencoding::encode(&term)
        );
        if let Ok(res) = HTTP_CLIENT.get(&spotify_url).bearer_auth(token).send().await {
            if res.status().is_success() {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    if let Some(url) = json["tracks"]["items"].as_array()
                        .and_then(|items| items.first())
                        .and_then(|item| item["album"]["images"].as_array())
                        .and_then(|images| images.first())
                        .and_then(|image| image["url"].as_str()) {
                            return Ok(Some(url.to_string()));
                    }
                }
            }
        }
    }

    Ok(None)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ItunesTrackResult {
    #[serde(rename = "trackName")]
    pub track_name: Option<String>,
    #[serde(rename = "artistName")]
    pub artist_name: Option<String>,
    #[serde(rename = "collectionName")]
    pub collection_name: Option<String>,
    #[serde(rename = "releaseDate")]
    pub release_date: Option<String>,
    #[serde(rename = "primaryGenreName")]
    pub primary_genre_name: Option<String>,
    #[serde(rename = "trackTimeMillis")]
    pub track_time_millis: Option<i64>,
    #[serde(rename = "artworkUrl100")]
    pub artwork_url_100: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ItunesTrackResponse {
    pub results: Vec<ItunesTrackResult>,
}

#[tauri::command]
pub async fn fetch_track_info(artist: String, track: String) -> Result<Option<ItunesTrackResult>, String> {
    let term = format!("{} {}", artist, track);
    let url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=1",
        urlencoding::encode(&term)
    );

    let res = HTTP_CLIENT
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if res.status().is_success() {
        let data: ItunesTrackResponse = res.json().await.map_err(|e| e.to_string())?;
        if let Some(mut first_result) = data.results.into_iter().next() {
            if let Some(url_100) = first_result.artwork_url_100 {
                first_result.artwork_url_100 = Some(url_100.replace("100x100bb", "600x600bb"));
            }
            return Ok(Some(first_result));
        }
    }

    Ok(None)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YouTubeSearchResult {
    pub id: String,
    pub title: String,
    pub channel: Option<String>,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
}

#[tauri::command]
pub async fn search_youtube(query: String) -> Result<Vec<YouTubeSearchResult>, String> {
    let search_query = format!("ytsearch5:{}", query);

    let ytdlp_path = if std::path::Path::new("./yt-dlp").exists() {
        "./yt-dlp"
    } else if std::path::Path::new("../yt-dlp").exists() {
        "../yt-dlp"
    } else {
        return Err("yt-dlp binary not found.".to_string());
    };

    let output = std::process::Command::new(ytdlp_path)
        .arg("--dump-json")
        .arg(&search_query)
        .output()
        .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut results = Vec::new();

        for line in stdout.lines() {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(line) {
                let id = parsed["id"].as_str().unwrap_or("").to_string();
                let title = parsed["title"].as_str().unwrap_or("Unknown").to_string();
                let channel = parsed["uploader"].as_str().map(|s| s.to_string());
                let duration = parsed["duration"].as_f64();
                let thumbnail = parsed["thumbnail"].as_str().map(|s| s.to_string());

                if !id.is_empty() {
                    results.push(YouTubeSearchResult {
                        id,
                        title,
                        channel,
                        duration,
                        thumbnail,
                    });
                }
            }
        }

        return Ok(results);
    }

    let error_msg = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(format!("yt-dlp search failed: {}", error_msg))
}

#[tauri::command]
pub async fn resolve_audio_stream(query: String) -> Result<String, String> {
    let search_query = format!("ytsearch1:{}", query);

    // Check possible locations for yt-dlp (root of project or src-tauri)
    let ytdlp_path = if std::path::Path::new("./yt-dlp").exists() {
        "./yt-dlp"
    } else if std::path::Path::new("../yt-dlp").exists() {
        "../yt-dlp"
    } else {
        return Err(
            "yt-dlp binary not found. Please ensure it is in the project root.".to_string(),
        );
    };

    let output = std::process::Command::new(ytdlp_path)
        .arg("-g")
        .arg(&search_query)
        .arg("-f")
        .arg("bestaudio[ext=m4a]")
        .output()
        .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?;

    if output.status.success() {
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !url.is_empty() {
            return Ok(url);
        }
    }

    let error_msg = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(format!("yt-dlp failed to find stream: {}", error_msg))
}
