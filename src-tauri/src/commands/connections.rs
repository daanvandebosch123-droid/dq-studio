use serde::Deserialize;
use tauri::State;
use uuid::Uuid;
use crate::db::{ConnectionConfig, ConnectionInfo};
use crate::state::AppState;

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DbCredentials {
    SqlServer { host: String, port: u16, username: String, password: String, trust_cert: bool },
    Snowflake { account: String, warehouse: String, username: String, password: String },
    Db2 { host: String, port: u16, database: String, username: String, password: String },
}

#[tauri::command]
pub async fn add_connection(
    name: String,
    config: ConnectionConfig,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let info = ConnectionInfo { id: id.clone(), name, config };
    state.connections.lock().unwrap().insert(id.clone(), info);
    state.save()?;
    Ok(id)
}

#[tauri::command]
pub async fn update_connection(
    id: String,
    name: String,
    config: ConnectionConfig,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let info = ConnectionInfo { id: id.clone(), name, config };
    state.connections.lock().unwrap().insert(id, info);
    state.save()
}

#[tauri::command]
pub async fn remove_connection(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.connections.lock().unwrap().remove(&id);
    state.save()
}

#[tauri::command]
pub async fn list_connections(
    state: State<'_, AppState>,
) -> Result<Vec<ConnectionInfo>, String> {
<<<<<<< HEAD
    state.reload();
    Ok(state.connections.lock().unwrap().values().cloned().collect())
=======
    let conns = state.connections.lock().unwrap();
    Ok(conns.values().cloned().collect())
>>>>>>> origin/main
}

#[tauri::command]
pub async fn list_databases(credentials: DbCredentials) -> Result<Vec<String>, String> {
    match credentials {
        DbCredentials::SqlServer { host, port, username, password, trust_cert } => {
            let mut client = crate::db::sqlserver::connect(&host, port, "master", &username, &password, trust_cert)
                .await.map_err(|e| e.to_string())?;
            let qr = crate::db::sqlserver::run_query(
                &mut client,
                "SELECT name FROM sys.databases WHERE state_desc = 'ONLINE' ORDER BY name",
            ).await.map_err(|e| e.to_string())?;
            Ok(qr.rows.iter()
                .filter_map(|r| r.first().and_then(|v| v.as_str()).map(|s| s.to_string()))
                .collect())
        }
        DbCredentials::Snowflake { account, warehouse, username, password } => {
            let client = crate::db::snowflake::SnowflakeClient::new(
                &account, &warehouse, "", "PUBLIC", &username, &password,
            ).map_err(|e| e.to_string())?;
            let qr = client.run_query("SHOW DATABASES").await.map_err(|e| e.to_string())?;
            let name_idx = qr.columns.iter().position(|c| c.to_lowercase() == "name").unwrap_or(1);
            Ok(qr.rows.iter()
                .filter_map(|r| r.get(name_idx).and_then(|v| v.as_str()).map(|s| s.to_string()))
                .collect())
        }
        DbCredentials::Db2 { host, port, database, username, password } => {
            // DB2 connects per-database; just validate and return the single database name.
            tokio::task::spawn_blocking(move || {
                crate::db::db2::test_connection(&host, port, &database, &username, &password)
                    .map(|_| vec![database])
                    .map_err(|e| e.to_string())
            }).await.map_err(|e| e.to_string())?
        }
    }
}

#[tauri::command]
pub async fn test_connection(config: ConnectionConfig) -> Result<String, String> {
    match &config {
        ConnectionConfig::SqlServer { host, port, database, username, password, trust_cert } => {
            crate::db::sqlserver::connect(host, *port, database, username, password, *trust_cert)
                .await
                .map_err(|e| e.to_string())?;
            Ok("Connected successfully".to_string())
        }
        ConnectionConfig::Oracle { host, port, service_name, username, password } => {
            crate::db::oracle::connect(host, *port, service_name, username, password)
                .map_err(|e| e.to_string())?;
            Ok("Connected successfully".to_string())
        }
        ConnectionConfig::Snowflake { account, warehouse, database, schema, username, password } => {
            let client = crate::db::snowflake::SnowflakeClient::new(
                account, warehouse, database, schema, username, password,
            )
            .map_err(|e| e.to_string())?;
            client.test_connection().await.map_err(|e| e.to_string())?;
            Ok("Connected successfully".to_string())
        }
        ConnectionConfig::Db2 { host, port, database, username, password } => {
            let (h, p, db, u, pw) = (host.clone(), *port, database.clone(), username.clone(), password.clone());
            tokio::task::spawn_blocking(move || {
                crate::db::db2::test_connection(&h, p, &db, &u, &pw)
                    .map(|_| "Connected successfully".to_string())
                    .map_err(|e| e.to_string())
            }).await.map_err(|e| e.to_string())?
        }
        ConnectionConfig::Csv { path } => {
            if !std::path::Path::new(path).exists() {
                return Err(format!("File not found: {}", path));
            }
            // Try reading headers to validate it's a readable CSV
            csv::Reader::from_path(path)
                .map_err(|e| format!("Cannot open CSV: {}", e))?
                .headers()
                .map_err(|e| format!("Cannot read CSV headers: {}", e))?;
            Ok("CSV file is readable".to_string())
        }
        ConnectionConfig::Excel { path } => {
            if !std::path::Path::new(path).exists() {
                return Err(format!("File not found: {}", path));
            }
            calamine::open_workbook_auto(path)
                .map_err(|e| format!("Cannot open Excel file: {}", e))?;
            Ok("Excel file is readable".to_string())
        }
    }
}

#[tauri::command]
pub async fn pick_file(title: String, extensions: Vec<String>) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
        Ok(rfd::FileDialog::new()
            .set_title(&title)
            .add_filter("Files", &ext_refs)
            .pick_file()
            .map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}
