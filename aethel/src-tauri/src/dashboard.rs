use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use reqwest::Client;

#[derive(Serialize, Deserialize, Clone)]
pub struct DashboardTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub platform: String,
    pub cover_url: Option<String>,
}

pub struct DashboardCache {
    pub global_mixer: Mutex<Option<(Instant, Vec<DashboardTrack>)>>,
    pub lastfm_charts: Mutex<Option<(Instant, Vec<DashboardTrack>)>>,
    pub youtube_trends: Mutex<Option<(Instant, Vec<DashboardTrack>)>>,
}

impl DashboardCache {
    pub fn new() -> Self {
        Self {
            global_mixer: Mutex::new(None),
            lastfm_charts: Mutex::new(None),
            youtube_trends: Mutex::new(None),
        }
    }
}

const CACHE_TTL: Duration = Duration::from_secs(2 * 3600); // 2 hours

#[tauri::command]
pub async fn get_global_mixer(state: tauri::State<'_, DashboardCache>) -> Result<Vec<DashboardTrack>, String> {
    {
        let cache = state.global_mixer.lock().map_err(|e| e.to_string())?;
        if let Some((time, data)) = &*cache {
            if time.elapsed() < CACHE_TTL {
                return Ok(data.clone());
            }
        }
    }

    // 1. Fetch Spotify Top 50 Global (Spotify URL)
    let spotify_future = crate::importer::import_from_url("https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF");
    
    // 2. Fetch YouTube Music Top Tracks (Using a generic YT Music trending playlist or charts)
    let yt_future = crate::importer::import_from_url("https://music.youtube.com/playlist?list=RDCLAK5uy_l4p2D305z6uV0G5p8fQzB-hE2x4zQ0Z8U");
    
    // 3. Fetch Last.fm Top Tracks
    let lastfm_future = get_lastfm_charts_direct();

    // Run them in parallel
    let (spotify_res, yt_res, lastfm_res) = tokio::join!(spotify_future, yt_future, lastfm_future);

    let mut mixed_tracks = Vec::new();
    
    let mut spotify_tracks = spotify_res.unwrap_or_else(|_| crate::importer::ImportedPlaylist { name: "".into(), cover_url: None, tracks: vec![] }).tracks.into_iter();
    let mut yt_tracks = yt_res.unwrap_or_else(|_| crate::importer::ImportedPlaylist { name: "".into(), cover_url: None, tracks: vec![] }).tracks.into_iter();
    let mut lastfm_tracks = lastfm_res.unwrap_or_else(|_| vec![]).into_iter();

    // Interleave
    for i in 0..20 {
        if let Some(track) = spotify_tracks.next() {
            mixed_tracks.push(DashboardTrack {
                id: format!("spot_{}", i),
                title: track.title,
                artist: track.artist,
                platform: "Spotify".to_string(),
                cover_url: None, // The frontend will fallback to fetching it or we use generic
            });
        }
        if let Some(track) = yt_tracks.next() {
            mixed_tracks.push(DashboardTrack {
                id: format!("yt_{}", i),
                title: track.title,
                artist: track.artist,
                platform: "YouTube Music".to_string(),
                cover_url: None,
            });
        }
        if let Some(track) = lastfm_tracks.next() {
            mixed_tracks.push(track);
        }
    }

    {
        let mut cache = state.global_mixer.lock().map_err(|e| e.to_string())?;
        *cache = Some((Instant::now(), mixed_tracks.clone()));
    }

    Ok(mixed_tracks)
}

async fn get_lastfm_charts_direct() -> Result<Vec<DashboardTrack>, String> {
    let client = reqwest::Client::new();
    let api_key = crate::secrets::LASTFM_API_KEY;
    let res = client.get(format!("http://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key={}&format=json&limit=20", api_key))
        .send().await.map_err(|e| e.to_string())?;
    
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let mut tracks = Vec::new();
    if let Some(data) = json["tracks"]["track"].as_array() {
        for (i, item) in data.iter().enumerate() {
            let title = item["name"].as_str().unwrap_or("Unknown").to_string();
            let artist = item["artist"]["name"].as_str().unwrap_or("Unknown").to_string();
            let cover_url = item["image"].as_array()
                .and_then(|imgs| imgs.last())
                .and_then(|img| img["#text"].as_str())
                .map(|s| s.to_string());
                
            tracks.push(DashboardTrack {
                id: format!("lastfm_{}", i),
                title,
                artist,
                platform: "Last.fm".to_string(),
                cover_url,
            });
        }
    }
    
    Ok(tracks)
}

#[tauri::command]
pub async fn get_youtube_trends(state: tauri::State<'_, DashboardCache>) -> Result<Vec<DashboardTrack>, String> {
    {
        let cache = state.youtube_trends.lock().map_err(|e| e.to_string())?;
        if let Some((time, data)) = &*cache {
            if time.elapsed() < CACHE_TTL {
                return Ok(data.clone());
            }
        }
    }

    // Since we don't have a direct YT trends endpoint, we'll scrape a well-known trending playlist using our importer
    let yt_res = crate::importer::import_from_url("https://music.youtube.com/playlist?list=RDCLAK5uy_l4p2D305z6uV0G5p8fQzB-hE2x4zQ0Z8U").await?;
    
    let mut tracks = Vec::new();
    for (i, track) in yt_res.tracks.into_iter().enumerate() {
        tracks.push(DashboardTrack {
            id: format!("trend_{}", i),
            title: track.title,
            artist: track.artist,
            platform: "YouTube Music".to_string(),
            cover_url: yt_res.cover_url.clone(), // Generic playlist cover for all
        });
    }

    {
        let mut cache = state.youtube_trends.lock().map_err(|e| e.to_string())?;
        *cache = Some((Instant::now(), tracks.clone()));
    }

    Ok(tracks)
}
