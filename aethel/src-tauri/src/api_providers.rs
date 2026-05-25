use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use crate::auth::get_valid_token;

#[derive(Serialize)]
pub struct UnifiedMediaItem {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub cover_url: Option<String>,
    pub platform: String,
    pub item_type: String, // "track", "playlist", "artist"
}

#[tauri::command]
pub async fn get_spotify_top_tracks(state: State<'_, Mutex<Connection>>) -> Result<Vec<UnifiedMediaItem>, String> {
    let token = get_valid_token("spotify", &state).await?;
    
    let client = reqwest::Client::new();
    
    // Directamente obtenemos las "Canciones que te gustan" (Saved Tracks)
    let res = client.get("https://api.spotify.com/v1/me/tracks?limit=30")
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Error de API Spotify: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let items_wrapper = json["items"].as_array().ok_or("No items array in response")?;
    
    let mut unified_items = Vec::new();
    for wrapper in items_wrapper {
        if let Some(item) = wrapper.get("track") {
            let id = item["id"].as_str().unwrap_or("").to_string();
            let title = item["name"].as_str().unwrap_or("").to_string();
            
            let artist = item["artists"].as_array()
                .and_then(|a| a.first())
                .and_then(|a| a["name"].as_str())
                .map(|s| s.to_string());
                
            let cover_url = item["album"]["images"].as_array()
                .and_then(|i| i.first())
                .and_then(|i| i["url"].as_str())
                .map(|s| s.to_string());

            unified_items.push(UnifiedMediaItem {
                id,
                title,
                artist,
                cover_url,
                platform: "Spotify".to_string(),
                item_type: "track".to_string(),
            });
        }
    }

    Ok(unified_items)
}

#[tauri::command]
pub async fn get_spotify_playlists(state: State<'_, Mutex<Connection>>) -> Result<Vec<UnifiedMediaItem>, String> {
    let token = get_valid_token("spotify", &state).await?;
    
    let client = reqwest::Client::new();
    let res = client.get("https://api.spotify.com/v1/me/playlists?limit=20")
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Error de API Spotify: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let items = json["items"].as_array().ok_or("No items array in response")?;
    
    let mut unified_items = Vec::new();
    for item in items {
        let id = item["id"].as_str().unwrap_or("").to_string();
        let title = item["name"].as_str().unwrap_or("").to_string();
        
        let artist = item["owner"]["display_name"].as_str().map(|s| s.to_string());
            
        let cover_url = item["images"].as_array()
            .and_then(|i| i.first())
            .and_then(|i| i["url"].as_str())
            .map(|s| s.to_string());

        unified_items.push(UnifiedMediaItem {
            id,
            title,
            artist,
            cover_url,
            platform: "Spotify".to_string(),
            item_type: "playlist".to_string(),
        });
    }

    Ok(unified_items)
}

#[tauri::command]
pub async fn get_lastfm_global_charts() -> Result<Vec<UnifiedMediaItem>, String> {
    let client = reqwest::Client::new();
    let api_key = crate::secrets::LASTFM_API_KEY;
    
    let res = client.get(format!("http://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key={}&format=json&limit=20", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let data = json["tracks"]["track"].as_array().ok_or("No data array in response")?;
    
    let mut unified_items = Vec::new();
    for (i, item) in data.iter().enumerate() {
        let title = item["name"].as_str().unwrap_or("").to_string();
        let artist = item["artist"]["name"].as_str().map(|s| s.to_string());
        let cover_url = item["image"].as_array()
            .and_then(|imgs| imgs.last())
            .and_then(|img| img["#text"].as_str())
            .map(|s| s.to_string());

        unified_items.push(UnifiedMediaItem {
            id: format!("lastfm-global-{}", i),
            title,
            artist,
            cover_url,
            platform: "Last.fm".to_string(),
            item_type: "track".to_string(),
        });
    }

    Ok(unified_items)
}

#[tauri::command]
pub async fn get_lastfm_user_top_tracks(username: String) -> Result<Vec<UnifiedMediaItem>, String> {
    if username.is_empty() {
        return Err("No username provided".to_string());
    }

    let client = reqwest::Client::new();
    let api_key = crate::secrets::LASTFM_API_KEY;
    
    let res = client.get(format!("http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user={}&api_key={}&format=json&limit=20", username, api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let data = json["toptracks"]["track"].as_array().ok_or("No data array in response")?;
    
    let mut unified_items = Vec::new();
    for (i, item) in data.iter().enumerate() {
        let title = item["name"].as_str().unwrap_or("").to_string();
        let artist = item["artist"]["name"].as_str().map(|s| s.to_string());
        let cover_url = item["image"].as_array()
            .and_then(|imgs| imgs.last())
            .and_then(|img| img["#text"].as_str())
            .map(|s| s.to_string());

        unified_items.push(UnifiedMediaItem {
            id: format!("lastfm-user-{}", i),
            title,
            artist,
            cover_url,
            platform: "Last.fm".to_string(),
            item_type: "track".to_string(),
        });
    }

    Ok(unified_items)
}

#[tauri::command]
pub async fn get_lyrics(title: String, artist: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let clean_title = title.split(" - ").next().unwrap_or(&title);
    let clean_title = clean_title.split("(").next().unwrap_or(clean_title).trim();
    
    let url = format!("https://api.lyrics.ovh/v1/{}/{}", urlencoding::encode(&artist), urlencoding::encode(clean_title));
    
    let res = client.get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            if let Some(lyrics) = json["lyrics"].as_str() {
                return Ok(lyrics.to_string());
            }
        }
    }
    
    Err("Letra no encontrada en la base de datos abierta.".to_string())
}

#[tauri::command]
pub async fn get_youtube_liked_music(state: State<'_, Mutex<Connection>>) -> Result<Vec<UnifiedMediaItem>, String> {
    let token = get_valid_token("youtube", &state).await?;
    
    let client = reqwest::Client::new();
    // Fetch more results because we need to filter out non-music videos
    let res = client.get("https://www.googleapis.com/youtube/v3/videos?myRating=like&part=snippet&maxResults=50")
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Error de API YouTube: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let items = json["items"].as_array().ok_or("No items array in response")?;
    
    let mut unified_items = Vec::new();
    for item in items {
        let snippet = &item["snippet"];
        let category_id = snippet["categoryId"].as_str().unwrap_or("");
        
        // Category 10 is Music on YouTube
        if category_id != "10" {
            continue;
        }

        let id = item["id"].as_str().unwrap_or("").to_string();
        let title = snippet["title"].as_str().unwrap_or("").to_string();
        let artist = snippet["channelTitle"].as_str().map(|s| s.to_string());
        
        let cover_url = snippet["thumbnails"]["maxres"]["url"].as_str()
            .or_else(|| snippet["thumbnails"]["high"]["url"].as_str())
            .or_else(|| snippet["thumbnails"]["default"]["url"].as_str())
            .map(|s| s.to_string());

        unified_items.push(UnifiedMediaItem {
            id,
            title,
            artist,
            cover_url,
            platform: "YouTube Music".to_string(),
            item_type: "track".to_string(),
        });
        
        if unified_items.len() >= 20 {
            break; // Stop when we have 20 music tracks
        }
    }

    Ok(unified_items)
}
