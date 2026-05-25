use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::{State, AppHandle};
use tauri_plugin_opener::OpenerExt;
use warp::Filter;
use tokio::sync::oneshot;
use rand::Rng;
use sha2::{Sha256, Digest};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

use crate::secrets::{SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET};
const SPOTIFY_REDIRECT_URI: &str = "http://127.0.0.1:8989/callback";

const YOUTUBE_REDIRECT_URI: &str = "http://127.0.0.1:8989/callback";

#[derive(Serialize)]
pub struct AuthStatus {
    provider: String,
    connected: bool,
    #[serde(rename = "accountName")]
    account_name: Option<String>,
    #[serde(rename = "accountPicture")]
    account_picture: Option<String>,
}

#[derive(Deserialize)]
struct CallbackQuery {
    code: Option<String>,
    error: Option<String>,
}

fn generate_pkce() -> (String, String) {
    let mut rng = rand::rng();
    let mut bytes = [0u8; 32];
    rng.fill_bytes(&mut bytes);
    let verifier = URL_SAFE_NO_PAD.encode(bytes);

    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    (verifier, challenge)
}

#[tauri::command]
pub async fn get_auth_statuses(state: State<'_, Mutex<Connection>>) -> Result<Vec<AuthStatus>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT provider, account_name, account_picture FROM oauth_tokens")
        .map_err(|e| e.to_string())?;
        
    let rows = stmt.query_map([], |row| {
        Ok(AuthStatus {
            provider: row.get(0)?,
            connected: true,
            account_name: row.get(1)?,
            account_picture: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut statuses = std::collections::HashMap::new();
    statuses.insert("spotify".to_string(), AuthStatus { provider: "spotify".to_string(), connected: false, account_name: None, account_picture: None });
    statuses.insert("youtube".to_string(), AuthStatus { provider: "youtube".to_string(), connected: false, account_name: None, account_picture: None });
    statuses.insert("lastfm".to_string(), AuthStatus { provider: "lastfm".to_string(), connected: false, account_name: None, account_picture: None });

    for status in rows {
        if let Ok(s) = status {
            statuses.insert(s.provider.clone(), s);
        }
    }

    Ok(statuses.into_values().collect())
}

#[tauri::command]
pub async fn disconnect_provider(provider: String, state: State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    
    if provider == "lastfm" {
        conn.execute(
            "UPDATE oauth_tokens SET access_token = NULL, refresh_token = NULL WHERE provider = ?",
            [&provider],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "DELETE FROM oauth_tokens WHERE provider = ?",
            [&provider],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn authenticate_provider(provider: String, app: AppHandle, state: State<'_, Mutex<Connection>>) -> Result<(), String> {
    if provider != "spotify" && provider != "youtube" {
        return Err("Proveedor no implementado.".to_string());
    }

    let (code_verifier, code_challenge) = generate_pkce();
    
    // 1. Preparar la URL de autorización
    let auth_url = if provider == "spotify" {
        format!(
            "https://accounts.spotify.com/authorize?client_id={}&response_type=code&redirect_uri={}&code_challenge_method=S256&code_challenge={}&scope=user-read-private%20user-read-email%20user-top-read%20playlist-read-private%20user-library-read",
            SPOTIFY_CLIENT_ID,
            urlencoding::encode(SPOTIFY_REDIRECT_URI),
            code_challenge
        )
    } else {
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email&access_type=offline&prompt=consent",
            YOUTUBE_CLIENT_ID,
            urlencoding::encode(YOUTUBE_REDIRECT_URI)
        )
    };

    // 2. Levantar servidor Warp (Loopback)
    let (tx, rx) = oneshot::channel::<String>();
    let tx = std::sync::Arc::new(tokio::sync::Mutex::new(Some(tx)));
    let tx_filter = warp::any().map(move || tx.clone());

    let callback = warp::path("callback")
        .and(warp::query::<CallbackQuery>())
        .and(tx_filter)
        .and_then(|query: CallbackQuery, tx: std::sync::Arc<tokio::sync::Mutex<Option<oneshot::Sender<String>>>>| async move {
            if let Some(code) = query.code {
                if let Some(sender) = tx.lock().await.take() {
                    let _ = sender.send(code);
                }
                Ok::<_, warp::Rejection>(warp::reply::html("<h1>¡Autenticación exitosa!</h1><p>Ya puedes volver a la aplicación Aethel y cerrar esta ventana.</p>"))
            } else {
                Ok::<_, warp::Rejection>(warp::reply::html("<h1>Error en la autenticación</h1>"))
            }
        });

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    let (_, server) = warp::serve(callback)
        .bind_with_graceful_shutdown(([127, 0, 0, 1], 8989), async {
            shutdown_rx.await.ok();
        });

    // Arrancar el servidor en background
    tokio::task::spawn(server);

    // 3. Abrir el navegador
    app.opener().open_url(&auth_url, None::<&str>).map_err(|e| e.to_string())?;

    // 4. Esperar el código del navegador
    let code = rx.await.map_err(|_| "Autenticación cancelada o servidor cerrado".to_string())?;
    
    // 5. Apagar el servidor loopback
    let _ = shutdown_tx.send(());

    // 6. Intercambiar el código por tokens
    let client = reqwest::Client::new();
    
    let res = if provider == "spotify" {
        let params = [
            ("client_id", SPOTIFY_CLIENT_ID),
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", SPOTIFY_REDIRECT_URI),
            ("code_verifier", &code_verifier),
        ];
        client.post("https://accounts.spotify.com/api/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?
    } else {
        let params = [
            ("client_id", YOUTUBE_CLIENT_ID),
            ("client_secret", YOUTUBE_CLIENT_SECRET),
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", YOUTUBE_REDIRECT_URI),
        ];
        client.post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?
    };

    if !res.status().is_success() {
        return Err(format!("Error al obtener token: {:?}", res.text().await));
    }

    let token_data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let access_token = token_data["access_token"].as_str().ok_or("No access token")?;
    let refresh_token = token_data["refresh_token"].as_str().unwrap_or("");
    let expires_in = token_data["expires_in"].as_i64().unwrap_or(3600);
    let expires_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64 + expires_in;

    // 7. Obtener el perfil del usuario para account_name y account_picture
    let mut account_name = None;
    let mut account_picture = None;

    if provider == "spotify" {
        let profile_res = client.get("https://api.spotify.com/v1/me")
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if profile_res.status().is_success() {
            if let Ok(profile_data) = profile_res.json::<serde_json::Value>().await {
                account_name = profile_data["display_name"].as_str().map(|s| s.to_string());
                if let Some(images) = profile_data["images"].as_array() {
                    if !images.is_empty() {
                        account_picture = images[0]["url"].as_str().map(|s| s.to_string());
                    }
                }
            }
        }
    } else if provider == "youtube" {
        let profile_res = client.get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if profile_res.status().is_success() {
            if let Ok(profile_data) = profile_res.json::<serde_json::Value>().await {
                account_name = profile_data["name"].as_str().map(|s| s.to_string());
                account_picture = profile_data["picture"].as_str().map(|s| s.to_string());
            }
        }
    }

    // 8. Guardar en SQLite
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO oauth_tokens (provider, access_token, refresh_token, expires_at, account_name, account_picture)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![provider, access_token, refresh_token, expires_at, account_name, account_picture],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn save_lastfm_username(username: String, state: State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO oauth_tokens (provider, access_token, refresh_token, expires_at, account_name, account_picture)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        ("lastfm", "none", "none", 0, &username, "https://www.last.fm/static/images/lastfm_avatar_twitter.66cd2c48ce03.png"),
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_valid_token(provider: &str, state: &State<'_, Mutex<Connection>>) -> Result<String, String> {
    let (access_token, refresh_token, expires_at) = {
        let conn = state.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE provider = ?1")
            .map_err(|e| e.to_string())?;
        
        let mut rows = stmt.query(rusqlite::params![provider]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let access_token: String = row.get(0).map_err(|e| e.to_string())?;
            let refresh_token: String = row.get(1).map_err(|e| e.to_string())?;
            let expires_at: i64 = row.get(2).map_err(|e| e.to_string())?;
            (access_token, refresh_token, expires_at)
        } else {
            return Err(format!("No token found for provider {}", provider));
        }
    };

    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;
    
    // Si todavía es válido (con un margen de 5 minutos), lo devolvemos
    if expires_at > now + 300 {
        return Ok(access_token);
    }

    // Token expirado. Hacemos refresh.
    if refresh_token.is_empty() {
        return Err("Token expired and no refresh token available".to_string());
    }

    if provider != "spotify" && provider != "youtube" {
        return Err("Refresh not implemented for this provider yet".to_string());
    }

    let client = reqwest::Client::new();
    let res = if provider == "spotify" {
        let params = [
            ("client_id", SPOTIFY_CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", &refresh_token),
        ];
        client.post("https://accounts.spotify.com/api/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?
    } else {
        let params = [
            ("client_id", YOUTUBE_CLIENT_ID),
            ("client_secret", YOUTUBE_CLIENT_SECRET),
            ("grant_type", "refresh_token"),
            ("refresh_token", &refresh_token),
        ];
        client.post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?
    };

    if !res.status().is_success() {
        return Err("Failed to refresh token".to_string());
    }

    let token_data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let new_access_token = token_data["access_token"].as_str().ok_or("No access token in refresh response")?.to_string();
    let new_refresh_token = token_data["refresh_token"].as_str().unwrap_or(&refresh_token).to_string();
    let expires_in = token_data["expires_in"].as_i64().unwrap_or(3600);
    let new_expires_at = now + expires_in;

    // Actualizar en SQLite
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE oauth_tokens SET access_token = ?1, refresh_token = ?2, expires_at = ?3, updated_at = ?4 WHERE provider = ?5",
        rusqlite::params![new_access_token, new_refresh_token, new_expires_at, now, provider],
    ).map_err(|e| e.to_string())?;

    Ok(new_access_token)
}
