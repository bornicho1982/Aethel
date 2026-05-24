use notify_rust::Notification;

#[tauri::command]
pub fn notify_track(title: String, artist: String) {
    std::thread::spawn(move || {
        let _ = Notification::new()
            .appname("Aethel")
            .summary(&title)
            .body(&artist)
            .icon("audio-x-generic") // standard fallback icon
            .show();
    });
}
