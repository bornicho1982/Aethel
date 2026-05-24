use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;
use warp::Filter;

#[derive(Clone)]
pub struct ServerState {
    pub port: u16,
}

pub async fn start_server() -> u16 {
    let addr: SocketAddr = "127.0.0.1:0".parse().unwrap();

    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "HEAD", "OPTIONS"])
        .allow_headers(vec!["Range", "Origin", "Accept", "Content-Type"])
        .expose_headers(vec![
            "Content-Range",
            "Accept-Ranges",
            "Content-Length",
            "Content-Type",
        ])
        .build();

    #[cfg(target_os = "windows")]
    let route = warp::fs::dir("C:\\").with(cors);

    #[cfg(not(target_os = "windows"))]
    let route = warp::fs::dir("/").with(cors);

    let (bound_addr, server) = warp::serve(route).bind_ephemeral(addr);

    tokio::spawn(server);

    bound_addr.port()
}

#[tauri::command]
pub fn get_server_port(state: tauri::State<'_, Arc<Mutex<ServerState>>>) -> u16 {
    let guard = state.blocking_lock();
    guard.port
}
