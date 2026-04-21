use tauri::State;
use crate::db::{ColumnInfo, ConnectionConfig, SchemaTable};
use crate::state::AppState;

#[tauri::command]
pub async fn get_tables(
    connection_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<SchemaTable>, String> {
    let config = {
        let conns = state.connections.lock().unwrap();
        conns.get(&connection_id).map(|c| c.config.clone())
            .ok_or_else(|| format!("Connection not found: {}", connection_id))?
    };

    match config {
        ConnectionConfig::SqlServer { host, port, database, username, password, trust_cert } => {
            let mut client = crate::db::sqlserver::connect(&host, port, &database, &username, &password, trust_cert)
                .await.map_err(|e| e.to_string())?;
            crate::db::sqlserver::get_tables(&mut client).await.map_err(|e| e.to_string())
        }
        ConnectionConfig::Oracle { host, port, service_name, username, password } => {
            let conn = crate::db::oracle::connect(&host, port, &service_name, &username, &password)
                .map_err(|e| e.to_string())?;
            crate::db::oracle::get_tables(&conn).map_err(|e| e.to_string())
        }
        ConnectionConfig::Snowflake { account, warehouse, database, schema, username, password } => {
            let client = crate::db::snowflake::SnowflakeClient::new(&account, &warehouse, &database, &schema, &username, &password)
                .map_err(|e| e.to_string())?;
            client.get_tables().await.map_err(|e| e.to_string())
        }
        ConnectionConfig::Db2 { host, port, database, username, password } => {
            tokio::task::spawn_blocking(move || {
                crate::db::db2::get_tables(&host, port, &database, &username, &password)
                    .map_err(|e| e.to_string())
            }).await.map_err(|e| e.to_string())?
        }
        ConnectionConfig::Csv { path } => {
            let path = path.clone();
            tokio::task::spawn_blocking(move || crate::db::files::get_csv_schema(&path))
                .await.map_err(|e| e.to_string())?
        }
        ConnectionConfig::Excel { path } => {
            let path = path.clone();
            tokio::task::spawn_blocking(move || crate::db::files::get_excel_sheets(&path))
                .await.map_err(|e| e.to_string())?
        }
    }
}

#[tauri::command]
pub async fn get_columns(
    connection_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<Vec<ColumnInfo>, String> {
    let config = {
        let conns = state.connections.lock().unwrap();
        conns.get(&connection_id).map(|c| c.config.clone())
            .ok_or_else(|| format!("Connection not found: {}", connection_id))?
    };

    match config {
        ConnectionConfig::SqlServer { host, port, database, username, password, trust_cert } => {
            let mut client = crate::db::sqlserver::connect(&host, port, &database, &username, &password, trust_cert)
                .await.map_err(|e| e.to_string())?;
            crate::db::sqlserver::get_columns(&mut client, &schema, &table).await.map_err(|e| e.to_string())
        }
        ConnectionConfig::Oracle { host, port, service_name, username, password } => {
            let conn = crate::db::oracle::connect(&host, port, &service_name, &username, &password)
                .map_err(|e| e.to_string())?;
            crate::db::oracle::get_columns(&conn, &schema, &table).map_err(|e| e.to_string())
        }
        ConnectionConfig::Snowflake { account, warehouse, database, schema: sf_schema, username, password } => {
            let client = crate::db::snowflake::SnowflakeClient::new(&account, &warehouse, &database, &sf_schema, &username, &password)
                .map_err(|e| e.to_string())?;
            client.get_columns(&schema, &table).await.map_err(|e| e.to_string())
        }
        ConnectionConfig::Db2 { host, port, database, username, password } => {
            tokio::task::spawn_blocking(move || {
                crate::db::db2::get_columns(&host, port, &database, &username, &password, &schema, &table)
                    .map_err(|e| e.to_string())
            }).await.map_err(|e| e.to_string())?
        }
        ConnectionConfig::Csv { path } => {
            let path = path.clone();
            tokio::task::spawn_blocking(move || crate::db::files::get_csv_columns(&path))
                .await.map_err(|e| e.to_string())?
        }
        ConnectionConfig::Excel { path } => {
            let path = path.clone();
            tokio::task::spawn_blocking(move || crate::db::files::get_excel_columns(&path, &table))
                .await.map_err(|e| e.to_string())?
        }
    }
}
