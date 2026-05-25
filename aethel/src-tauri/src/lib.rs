mod db;
mod mpris;
mod notifications;
mod providers;
mod scanner;
mod server;
mod importer;
mod dashboard;
mod auth;
pub mod api_providers;
mod secrets;

use std::sync::Mutex;
use tokio::sync::Mutex as AsyncMutex;
use rusqlite::Connection;
use serde::Serialize;
use std::sync::Arc;
use tauri::Manager;

#[derive(Serialize)]
pub struct TrackData {
    pub id: i64,
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn scan_directory(
    path: String,
    state: tauri::State<'_, Mutex<Connection>>,
) -> Result<usize, String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    crate::scanner::scan_directory(&path, &mut conn)
}

#[tauri::command]
fn get_tracks(state: tauri::State<'_, Mutex<Connection>>) -> Result<Vec<TrackData>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, path, title, artist, album FROM tracks")
        .map_err(|e| e.to_string())?;
    let track_iter = stmt
        .query_map([], |row| {
            Ok(TrackData {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    for track in track_iter {
        if let Ok(t) = track {
            tracks.push(t);
        }
    }
    Ok(tracks)
}

#[tauri::command]
fn read_audio_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn log_play(
    track_id: i64,
    duration: f64,
    state: tauri::State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO play_history (track_id, duration_listened) VALUES (?1, ?2)",
        rusqlite::params![track_id, duration],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_top_tracks(
    limit: u32,
    state: tauri::State<'_, Mutex<Connection>>,
) -> Result<Vec<TrackData>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.path, t.title, t.artist, t.album, COUNT(p.id) as play_count 
         FROM tracks t 
         JOIN play_history p ON t.id = p.track_id 
         GROUP BY t.id 
         ORDER BY play_count DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let track_iter = stmt
        .query_map([limit], |row| {
            Ok(TrackData {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    for track in track_iter {
        if let Ok(t) = track {
            tracks.push(t);
        }
    }
    Ok(tracks)
}

#[tauri::command]
fn get_recent_tracks(
    limit: u32,
    state: tauri::State<'_, Mutex<Connection>>,
) -> Result<Vec<TrackData>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.path, t.title, t.artist, t.album 
         FROM tracks t 
         JOIN play_history p ON t.id = p.track_id 
         ORDER BY p.played_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let track_iter = stmt
        .query_map([limit], |row| {
            Ok(TrackData {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    for track in track_iter {
        if let Ok(t) = track {
            tracks.push(t);
        }
    }
    Ok(tracks)
}

#[tauri::command]
fn delete_track(
    id: i64,
    move_to_trash: bool,
    state: tauri::State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    
    if move_to_trash {
        let path_res = conn.query_row("SELECT path FROM tracks WHERE id = ?1", [id], |row| row.get::<_, String>(0));
        if let Ok(path) = path_res {
            if let Err(e) = trash::delete(&path) {
                println!("Failed to move to trash: {}", e);
            }
        }
    }
    
    conn.execute("DELETE FROM tracks WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub cover_url: Option<String>,
}

#[derive(Serialize)]
pub struct PlaylistTrack {
    pub id: i64,
    pub track_name: String,
    pub artist_name: Option<String>,
    pub source_url: Option<String>,
    pub cover_url: Option<String>,
}

#[tauri::command]
fn get_playlists(state: tauri::State<'_, Mutex<Connection>>) -> Result<Vec<Playlist>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, cover_url FROM playlists ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let iter = stmt.query_map([], |row| {
        Ok(Playlist {
            id: row.get(0)?,
            name: row.get(1)?,
            cover_url: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut playlists = Vec::new();
    for p in iter {
        if let Ok(pl) = p { playlists.push(pl); }
    }
    Ok(playlists)
}

#[tauri::command]
fn get_playlist_tracks(playlist_id: i64, state: tauri::State<'_, Mutex<Connection>>) -> Result<Vec<PlaylistTrack>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, track_name, artist_name, source_url, cover_url FROM playlist_tracks WHERE playlist_id = ?1 ORDER BY order_index ASC, id ASC").map_err(|e| e.to_string())?;
    let iter = stmt.query_map([playlist_id], |row| {
        Ok(PlaylistTrack {
            id: row.get(0)?,
            track_name: row.get(1)?,
            artist_name: row.get(2)?,
            source_url: row.get(3)?,
            cover_url: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut tracks = Vec::new();
    for t in iter {
        if let Ok(trk) = t { tracks.push(trk); }
    }
    Ok(tracks)
}

#[tauri::command]
fn remove_playlist_track(id: i64, state: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM playlist_tracks WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_playlist(id: i64, state: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    // This will also delete playlist_tracks if ON DELETE CASCADE is set.
    // We already added ON DELETE CASCADE in db.rs!
    conn.execute("DELETE FROM playlists WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_playlist_cover(id: i64, source_path: String, app_handle: tauri::AppHandle, state: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
    // If it's an online URL or already local, just save it. But wait, if it's a local file, we copy it!
    let mut final_path = source_path.clone();
    
    if !source_path.starts_with("http") {
        // Strip the leading / if we added it in JS for some reason, or leave it. Actually the dialog returns absolute path.
        let path = std::path::Path::new(&source_path);
        if path.exists() && path.is_file() {
            if let Some(app_data_dir) = app_handle.path().app_data_dir().ok() {
                let covers_dir = app_data_dir.join("covers");
                let _ = std::fs::create_dir_all(&covers_dir);
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("jpg");
                let new_filename = format!("playlist_{}_{}.{}", id, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(), ext);
                let new_path = covers_dir.join(new_filename);
                
                if std::fs::copy(path, &new_path).is_ok() {
                    final_path = new_path.to_string_lossy().to_string();
                }
            }
        }
    }

    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE playlists SET cover_url = ?1 WHERE id = ?2", rusqlite::params![final_path, id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_track_cover(id: i64, source_path: String, app_handle: tauri::AppHandle, state: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
    let mut final_path = source_path.clone();
    
    if !source_path.starts_with("http") {
        let path = std::path::Path::new(&source_path);
        if path.exists() && path.is_file() {
            if let Some(app_data_dir) = app_handle.path().app_data_dir().ok() {
                let covers_dir = app_data_dir.join("covers");
                let _ = std::fs::create_dir_all(&covers_dir);
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("jpg");
                let new_filename = format!("track_{}_{}.{}", id, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(), ext);
                let new_path = covers_dir.join(new_filename);
                
                if std::fs::copy(path, &new_path).is_ok() {
                    final_path = new_path.to_string_lossy().to_string();
                }
            }
        }
    }

    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE playlist_tracks SET cover_url = ?1 WHERE id = ?2", rusqlite::params![final_path, id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn import_external_playlist(url: String, state: tauri::State<'_, Mutex<Connection>>) -> Result<Playlist, String> {
    let imported = importer::import_from_url(&url).await?;
    
    let conn = state.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO playlists (name, cover_url) VALUES (?1, ?2)",
        rusqlite::params![imported.name, imported.cover_url],
    ).map_err(|e| e.to_string())?;
    
    let playlist_id = conn.last_insert_rowid();
    
    for (idx, track) in imported.tracks.iter().enumerate() {
        conn.execute(
            "INSERT INTO playlist_tracks (playlist_id, track_name, artist_name, order_index) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![playlist_id, track.title, track.artist, idx],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(Playlist {
        id: playlist_id,
        name: imported.name,
        cover_url: imported.cover_url,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            use tauri::Manager;

            // Start local streaming server
            let port = tauri::async_runtime::block_on(async { server::start_server().await });
            app.manage(Arc::new(AsyncMutex::new(server::ServerState { port })));

            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
            let db_path = app_data_dir.join("aethel.db");
            let conn = db::init_db(&db_path).expect("Failed to initialize database");
            app.manage(Mutex::new(conn));

            let mpris_state = mpris::MprisState::new();
            mpris_state.init(app.handle().clone());
            app.manage(mpris_state);

            app.manage(dashboard::DashboardCache::new());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_directory,
            get_tracks,
            read_audio_file,
            log_play,
            get_top_tracks,
            get_recent_tracks,
            delete_track,
            get_playlists,
            get_playlist_tracks,
            remove_playlist_track,
            delete_playlist,
            update_playlist_cover,
            update_track_cover,
            import_external_playlist,
            server::get_server_port,
            providers::fetch_lyrics,
            providers::fetch_cover_art,
            providers::fetch_track_info,
            providers::resolve_audio_stream,
            providers::search_youtube,
            mpris::update_mpris_metadata,
            mpris::update_mpris_playback,
            notifications::notify_track,
            // Dashboard
            dashboard::get_global_mixer,
            dashboard::get_youtube_trends,
            auth::get_auth_statuses,
            auth::authenticate_provider,
            auth::disconnect_provider,
            auth::save_lastfm_username,
            api_providers::get_spotify_top_tracks,
            api_providers::get_spotify_playlists,
            api_providers::get_lastfm_global_charts,
            api_providers::get_lastfm_user_top_tracks,
            api_providers::get_youtube_liked_music,
            api_providers::get_lyrics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
