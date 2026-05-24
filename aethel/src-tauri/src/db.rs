use rusqlite::{Connection, Result};
use std::path::Path;

pub fn init_db<P: AsRef<Path>>(db_path: P) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY,
            path TEXT NOT NULL UNIQUE,
            title TEXT,
            artist TEXT,
            album TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS play_history (
            id INTEGER PRIMARY KEY,
            track_id INTEGER NOT NULL,
            played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            duration_listened REAL NOT NULL,
            FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            cover_url TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlist_tracks (
            id INTEGER PRIMARY KEY,
            playlist_id INTEGER NOT NULL,
            track_name TEXT NOT NULL,
            artist_name TEXT,
            source_url TEXT,
            cover_url TEXT,
            order_index INTEGER DEFAULT 0,
            FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        )",
        [],
    )?;

    Ok(conn)
}
