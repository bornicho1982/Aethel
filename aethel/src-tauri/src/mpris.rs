use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub struct MprisState {
    controls: Mutex<Option<MediaControls>>,
}

impl MprisState {
    pub fn new() -> Self {
        Self {
            controls: Mutex::new(None),
        }
    }

    pub fn init(&self, app: AppHandle) {
        #[cfg(target_os = "linux")]
        let config = PlatformConfig {
            dbus_name: "aethel",
            display_name: "Aethel Music Player",
            hwnd: None,
        };

        #[cfg(not(target_os = "linux"))]
        let config = PlatformConfig {
            dbus_name: "aethel",
            display_name: "Aethel Music Player",
            hwnd: None,
        };

        if let Ok(mut controls) = MediaControls::new(config) {
            controls
                .attach(move |event: MediaControlEvent| match event {
                    MediaControlEvent::Play => {
                        let _ = app.emit("mpris-play", ());
                    }
                    MediaControlEvent::Pause => {
                        let _ = app.emit("mpris-pause", ());
                    }
                    MediaControlEvent::Toggle => {
                        let _ = app.emit("mpris-toggle", ());
                    }
                    MediaControlEvent::Next => {
                        let _ = app.emit("mpris-next", ());
                    }
                    MediaControlEvent::Previous => {
                        let _ = app.emit("mpris-previous", ());
                    }
                    _ => (),
                })
                .unwrap();

            let mut guard = self.controls.lock().unwrap();
            *guard = Some(controls);
        }
    }
}

#[tauri::command]
pub fn update_mpris_metadata(
    title: String,
    artist: String,
    album: String,
    length: Option<f64>,
    state: State<'_, MprisState>,
) {
    if let Some(controls) = state.controls.lock().unwrap().as_mut() {
        let duration = length.map(|l| std::time::Duration::from_secs_f64(l));
        let _ = controls.set_metadata(MediaMetadata {
            title: Some(&title),
            artist: Some(&artist),
            album: Some(&album),
            duration,
            ..Default::default()
        });
    }
}

#[tauri::command]
pub fn update_mpris_playback(playing: bool, state: State<'_, MprisState>) {
    if let Some(controls) = state.controls.lock().unwrap().as_mut() {
        let playback = if playing {
            MediaPlayback::Playing { progress: None }
        } else {
            MediaPlayback::Paused { progress: None }
        };
        let _ = controls.set_playback(playback);
    }
}
