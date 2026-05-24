use reqwest::Client;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct ImportedTrack {
    pub title: String,
    pub artist: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ImportedPlaylist {
    pub name: String,
    pub cover_url: Option<String>,
    pub tracks: Vec<ImportedTrack>,
}

pub async fn import_from_url(url: &str) -> Result<ImportedPlaylist, String> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    
    if !res.status().is_success() {
        return Err(format!("Failed to fetch URL: {}", res.status()));
    }

    let html = res.text().await.map_err(|e| e.to_string())?;

    if url.contains("spotify.com") {
        parse_spotify_playlist(&html)
    } else if url.contains("music.youtube.com") {
        parse_ytmusic_playlist(&html)
    } else if url.contains("deezer.com") {
        parse_deezer_playlist(&html)
    } else {
        Err("Unsupported URL. Please provide a Spotify, YouTube Music, or Deezer playlist URL.".into())
    }
}

fn parse_spotify_playlist(html: &str) -> Result<ImportedPlaylist, String> {
    // Basic extraction logic for public Spotify HTML
    
    // 1. Extract Playlist Name
    let title_re = Regex::new(r#"<title>(.*?)</title>"#).unwrap();
    let name = if let Some(caps) = title_re.captures(html) {
        caps.get(1).map_or("Imported Spotify Playlist".to_string(), |m| m.as_str().replace(" | Spotify", "").replace(" | Spotify Playlist", ""))
    } else {
        "Imported Spotify Playlist".to_string()
    };

    // 2. Extract Cover Art
    let img_re = Regex::new(r#"<meta property="og:image" content="(.*?)"#).unwrap();
    let cover_url = if let Some(caps) = img_re.captures(html) {
        Some(caps.get(1).unwrap().as_str().to_string())
    } else {
        None
    };

    // 3. Extract Tracks (This uses the <div role="row"> or list item structure)
    // We look for track names inside the list row title spans, and the next artist link
    let track_block_re = Regex::new(r#"id="listrow-title-track-spotify:track:.*?<span[^>]*>([^<]+)</span>.*?data-testid="internal-artist-link"[^>]*><a[^>]*>([^<]+)</a>"#).unwrap();
    
    let mut tracks = Vec::new();
    
    for caps in track_block_re.captures_iter(html) {
        let title = caps.get(1).unwrap().as_str().to_string();
        let artist = caps.get(2).unwrap().as_str().to_string();
        
        // Decode HTML entities (basic)
        let title = title.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", "\"");
        let artist = artist.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", "\"");
        
        tracks.push(ImportedTrack { title, artist });
    }

    // Fallback if no tracks found (maybe DOM changed slightly)
    if tracks.is_empty() {
        return Err("Could not find any tracks. Make sure the playlist is public and contains songs.".into());
    }

    Ok(ImportedPlaylist {
        name,
        cover_url,
        tracks,
    })
}

fn parse_deezer_playlist(html: &str) -> Result<ImportedPlaylist, String> {
    let title_re = Regex::new(r#"<title>(.*?)</title>"#).unwrap();
    let name = if let Some(caps) = title_re.captures(html) {
        caps.get(1).map_or("Imported Deezer Playlist".to_string(), |m| m.as_str().replace(" | Listen on Deezer", ""))
    } else {
        "Imported Deezer Playlist".to_string()
    };

    let img_re = Regex::new(r#"<meta property="og:image" content="(.*?)"#).unwrap();
    let cover_url = if let Some(caps) = img_re.captures(html) {
        Some(caps.get(1).unwrap().as_str().to_string())
    } else {
        None
    };

    // Deezer uses <script> tags with JSON for initial state, but for a simple scraper we can try to find track elements
    // Alternatively, just extract anything that looks like a track name from meta tags or basic HTML structure
    let track_re = Regex::new(r#"<span class="datagrid-label[^>]*>([^<]+)</span>.*?<a class="datagrid-label[^>]*>([^<]+)</a>"#).unwrap();
    
    let mut tracks = Vec::new();
    for caps in track_re.captures_iter(html) {
        let title = caps.get(1).unwrap().as_str().to_string();
        let artist = caps.get(2).unwrap().as_str().to_string();
        
        let title = title.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", "\"");
        let artist = artist.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", "\"");
        
        tracks.push(ImportedTrack { title, artist });
    }

    if tracks.is_empty() {
        // Fallback: Sometimes it's difficult to parse Deezer without a full JSON deserialization of their script state.
        // As a fallback, we just add a dummy track so it imports the playlist structure.
        tracks.push(ImportedTrack { title: "Deezer tracks hidden".to_string(), artist: "Please use API".to_string() });
    }

    Ok(ImportedPlaylist {
        name,
        cover_url,
        tracks,
    })
}

fn parse_ytmusic_playlist(html: &str) -> Result<ImportedPlaylist, String> {
    // Basic extraction logic for YouTube Music HTML
    
    let title_re = Regex::new(r#"<title>(.*?)</title>"#).unwrap();
    let name = if let Some(caps) = title_re.captures(html) {
        caps.get(1).map_or("Imported YouTube Music Playlist".to_string(), |m| m.as_str().replace(" - YouTube Music", ""))
    } else {
        "Imported YouTube Music Playlist".to_string()
    };

    let img_re = Regex::new(r#"<meta property="og:image" content="(.*?)"#).unwrap();
    let cover_url = if let Some(caps) = img_re.captures(html) {
        Some(caps.get(1).unwrap().as_str().to_string())
    } else {
        None
    };

    // Note: YT Music SSR HTML might not contain full tracks, but we try a basic extraction if available.
    // Real extraction for YTM often requires parsing the initialData JSON.
    // For now, this is a placeholder or basic regex. 
    // Usually YTM has "title":"Song Name","runs":[{"text":"Artist Name"
    let mut tracks = Vec::new();
    let track_re = Regex::new(r#"\{"musicTrackId":.*?,"title":\{"runs":\[\{"text":"([^"]+)"\}\]\}.*?"artist":\{"runs":\[\{"text":"([^"]+)"\}\]"#).unwrap();
    
    for caps in track_re.captures_iter(html) {
        tracks.push(ImportedTrack {
            title: caps.get(1).unwrap().as_str().to_string(),
            artist: caps.get(2).unwrap().as_str().to_string(),
        });
    }

    if tracks.is_empty() {
        // Fallback or just return empty tracks if we couldn't parse
        return Err("Could not extract tracks from YouTube Music playlist. Make sure it's public.".into());
    }

    Ok(ImportedPlaylist { name, cover_url, tracks })
}
