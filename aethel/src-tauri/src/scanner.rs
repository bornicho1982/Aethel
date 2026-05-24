use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::{Accessor, TagExt};
use rusqlite::Connection;
use walkdir::WalkDir;

pub fn scan_directory(dir_path: &str, conn: &mut Connection) -> Result<usize, String> {
    let mut added = 0;

    for entry in WalkDir::new(dir_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext = ext.to_lowercase();
                if ext == "mp3" || ext == "flac" || ext == "wav" || ext == "m4a" || ext == "ogg" {
                    // Try to read metadata
                    let (title, artist, album) = match Probe::open(path).and_then(|p| p.read()) {
                        Ok(tagged_file) => {
                            let tag = tagged_file
                                .primary_tag()
                                .or_else(|| tagged_file.first_tag());
                            match tag {
                                Some(t) => (
                                    t.title().as_deref().map(|s| s.to_string()),
                                    t.artist().as_deref().map(|s| s.to_string()),
                                    t.album().as_deref().map(|s| s.to_string()),
                                ),
                                None => (None, None, None),
                            }
                        }
                        Err(_) => (None, None, None),
                    };

                    let path_str = path.to_string_lossy().to_string();
                    let title = title.unwrap_or_else(|| {
                        path.file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string()
                    });

                    // Insert into db
                    let res = conn.execute(
                        "INSERT OR IGNORE INTO tracks (path, title, artist, album) VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![path_str, title, artist, album],
                    );

                    if let Ok(changes) = res {
                        if changes > 0 {
                            added += 1;
                        }
                    }
                }
            }
        }
    }

    Ok(added)
}
