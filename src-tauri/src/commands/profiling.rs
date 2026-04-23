use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use crate::db::{ColumnInfo, ConnectionConfig, QueryResult};
use crate::state::AppState;

// ── Data types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnProfile {
    pub column_name: String,
    pub data_type: String,
    pub row_count: i64,
    pub null_count: i64,
    pub distinct_count: i64,
    pub min_value: Option<String>,
    pub max_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilingRun {
    pub id: String,
    pub connection_id: String,
    pub connection_name: String,
    pub schema: String,
    pub table: String,
    pub ran_at: String,
    pub profiles: Vec<ColumnProfile>,
}

// ── State ──────────────────────────────────────────────────────────────────

pub struct ProfilingState {
    pub runs: std::sync::Mutex<Vec<ProfilingRun>>,
    pub data_path: std::path::PathBuf,
}

impl ProfilingState {
    pub fn new(data_dir: &std::path::PathBuf) -> Self {
        let data_path = data_dir.join("profiling_runs.json");
        let runs = crate::persistence::load::<Vec<ProfilingRun>>(&data_path).unwrap_or_default();
        Self { runs: std::sync::Mutex::new(runs), data_path }
    }

    pub fn reload(&self) {
        let runs = crate::persistence::load::<Vec<ProfilingRun>>(&self.data_path)
            .unwrap_or_default();
        *self.runs.lock().unwrap() = runs;
    }

    pub fn save(&self) -> Result<(), String> {
        let runs = self.runs.lock().unwrap().clone();
        crate::persistence::save(&self.data_path, &runs)
    }
}

// ── Dialect-aware SQL building ─────────────────────────────────────────────

enum Dialect { SqlServer, Other }

fn sqlserver_no_minmax(dt: &str) -> bool {
    matches!(dt.to_lowercase().as_str(),
        "text" | "ntext" | "image" | "xml" | "geography" | "geometry" | "hierarchyid")
}

fn sqlserver_no_distinct(dt: &str) -> bool {
    matches!(dt.to_lowercase().as_str(), "text" | "ntext" | "image" | "xml")
}

fn minmax_expr(col: &str, data_type: &str, agg: &str, dialect: &Dialect) -> String {
    match dialect {
        Dialect::Other => format!("{}({})", agg, col),
        Dialect::SqlServer => {
            if sqlserver_no_minmax(data_type) {
                "NULL".to_string()
            } else if data_type.to_lowercase() == "bit" {
                format!("{}(CAST({} AS TINYINT))", agg, col)
            } else {
                format!("{}({})", agg, col)
            }
        }
    }
}

fn distinct_expr(col: &str, data_type: &str, dialect: &Dialect) -> String {
    match dialect {
        Dialect::Other => format!("COUNT(DISTINCT {})", col),
        Dialect::SqlServer => {
            if sqlserver_no_distinct(data_type) {
                "0".to_string()
            } else {
                format!("COUNT(DISTINCT {})", col)
            }
        }
    }
}

/// Single combined query: COUNT(*) + per-column null/distinct/min/max.
/// Result columns: [row_count, null_i, distinct_i, min_i, max_i, ...] for each column i.
fn build_profile_sql(schema: &str, table: &str, columns: &[ColumnInfo], dialect: &Dialect) -> String {
    let qualified = format!("{}.{}", schema, table);
    let mut parts = vec!["COUNT(*) as __row_count".to_string()];
    for col in columns {
        let c = &col.name;
        let dt = &col.data_type;
        parts.push(format!("SUM(CASE WHEN {} IS NULL THEN 1 ELSE 0 END)", c));
        parts.push(distinct_expr(c, dt, dialect));
        parts.push(minmax_expr(c, dt, "MIN", dialect));
        parts.push(minmax_expr(c, dt, "MAX", dialect));
    }
    format!("SELECT {} FROM {}", parts.join(", "), qualified)
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn parse_i64(v: &serde_json::Value) -> i64 {
    v.as_i64()
        .or_else(|| v.as_f64().map(|f| f as i64))
        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        .unwrap_or(0)
}

fn value_to_string(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::Null => None,
        serde_json::Value::String(s) if s.is_empty() => None,
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

// ── DB helpers ─────────────────────────────────────────────────────────────

async fn get_columns_for(config: &ConnectionConfig, schema: &str, table: &str) -> Result<Vec<ColumnInfo>, String> {
    match config {
        ConnectionConfig::Csv { path } => {
            let p = path.clone();
            tokio::task::spawn_blocking(move || crate::db::files::get_csv_columns(&p))
                .await.map_err(|e| e.to_string())?
        }
        ConnectionConfig::Excel { path } => {
            let p = path.clone();
            let t = table.to_string();
            tokio::task::spawn_blocking(move || crate::db::files::get_excel_columns(&p, &t))
                .await.map_err(|e| e.to_string())?
        }
        ConnectionConfig::SqlServer { host, port, database, username, password, trust_cert } => {
            let mut client = crate::db::sqlserver::connect(host, *port, database, username, password, *trust_cert)
                .await.map_err(|e| e.to_string())?;
            crate::db::sqlserver::get_columns(&mut client, schema, table)
                .await.map_err(|e| e.to_string())
        }
        ConnectionConfig::Oracle { host, port, service_name, username, password } => {
            let conn = crate::db::oracle::connect(host, *port, service_name, username, password)
                .map_err(|e| e.to_string())?;
            crate::db::oracle::get_columns(&conn, schema, table).map_err(|e| e.to_string())
        }
        ConnectionConfig::Snowflake { account, warehouse, database, schema: sf_schema, username, password } => {
            let client = crate::db::snowflake::SnowflakeClient::new(account, warehouse, database, sf_schema, username, password)
                .map_err(|e| e.to_string())?;
            client.get_columns(schema, table).await.map_err(|e| e.to_string())
        }
        ConnectionConfig::Db2 { host, port, database, username, password } => {
            let (h, p, db, u, pw, sc, tb) = (
                host.clone(), *port, database.clone(), username.clone(),
                password.clone(), schema.to_string(), table.to_string(),
            );
            tokio::task::spawn_blocking(move || {
                crate::db::db2::get_columns(&h, p, &db, &u, &pw, &sc, &tb)
                    .map_err(|e| e.to_string())
            }).await.map_err(|e| e.to_string())?
        }
    }
}

async fn run_profile_query(config: &ConnectionConfig, sql: &str, schema: &str, table: &str) -> Result<QueryResult, String> {
    match config {
        ConnectionConfig::Csv { .. } | ConnectionConfig::Excel { .. } => {
            let (c, sc, tb, s) = (config.clone(), schema.to_string(), table.to_string(), sql.to_string());
            tokio::task::spawn_blocking(move || crate::db::files::run_file_query(&c, &sc, &tb, &s))
                .await.map_err(|e| e.to_string())?
        }
        ConnectionConfig::SqlServer { host, port, database, username, password, trust_cert } => {
            let mut client = crate::db::sqlserver::connect(host, *port, database, username, password, *trust_cert)
                .await.map_err(|e| e.to_string())?;
            crate::db::sqlserver::run_query(&mut client, sql).await.map_err(|e| e.to_string())
        }
        ConnectionConfig::Oracle { host, port, service_name, username, password } => {
            let conn = crate::db::oracle::connect(host, *port, service_name, username, password)
                .map_err(|e| e.to_string())?;
            crate::db::oracle::run_query(&conn, sql).map_err(|e| e.to_string())
        }
        ConnectionConfig::Snowflake { account, warehouse, database, schema: sf_schema, username, password } => {
            let client = crate::db::snowflake::SnowflakeClient::new(account, warehouse, database, sf_schema, username, password)
                .map_err(|e| e.to_string())?;
            client.run_query(sql).await.map_err(|e| e.to_string())
        }
        ConnectionConfig::Db2 { host, port, database, username, password } => {
            let (h, p, db, u, pw, s) = (
                host.clone(), *port, database.clone(), username.clone(), password.clone(), sql.to_string(),
            );
            tokio::task::spawn_blocking(move || {
                crate::db::db2::run_query(&h, p, &db, &u, &pw, &s).map_err(|e| e.to_string())
            }).await.map_err(|e| e.to_string())?
        }
    }
}

// ── Commands ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn profile_table(
    connection_id: String,
    schema: String,
    table: String,
    app_state: State<'_, AppState>,
    profiling_state: State<'_, ProfilingState>,
) -> Result<ProfilingRun, String> {
    let (config, connection_name) = {
        let conns = app_state.connections.lock().unwrap();
        let conn = conns.get(&connection_id)
            .ok_or_else(|| format!("Connection not found: {}", connection_id))?;
        (conn.config.clone(), conn.name.clone())
    };

    let dialect = match &config {
        ConnectionConfig::SqlServer { .. } => Dialect::SqlServer,
        _ => Dialect::Other,
    };

    let columns = get_columns_for(&config, &schema, &table).await?;

    let profiles = if columns.is_empty() {
        vec![]
    } else {
        let sql = build_profile_sql(&schema, &table, &columns, &dialect);
        let qr = run_profile_query(&config, &sql, &schema, &table).await?;
        let row = qr.rows.into_iter().next().unwrap_or_default();
        let row_count = row.first().map(parse_i64).unwrap_or(0);
        columns.iter().enumerate().map(|(i, col)| {
            let base = 1 + i * 4;
            ColumnProfile {
                column_name: col.name.clone(),
                data_type: col.data_type.clone(),
                row_count,
                null_count:     row.get(base).map(parse_i64).unwrap_or(0),
                distinct_count: row.get(base + 1).map(parse_i64).unwrap_or(0),
                min_value:      row.get(base + 2).and_then(value_to_string),
                max_value:      row.get(base + 3).and_then(value_to_string),
            }
        }).collect()
    };

    let run = ProfilingRun {
        id: Uuid::new_v4().to_string(),
        connection_id,
        connection_name,
        schema,
        table,
        ran_at: chrono::Utc::now().to_rfc3339(),
        profiles,
    };

    profiling_state.runs.lock().unwrap().push(run.clone());
    profiling_state.save()?;

    Ok(run)
}

#[tauri::command]
pub async fn list_profiling_runs(
    profiling_state: State<'_, ProfilingState>,
) -> Result<Vec<ProfilingRun>, String> {
    profiling_state.reload();
    let mut runs = profiling_state.runs.lock().unwrap().clone();
    runs.reverse();
    Ok(runs)
}

#[tauri::command]
pub async fn delete_profiling_run(
    id: String,
    profiling_state: State<'_, ProfilingState>,
) -> Result<(), String> {
    profiling_state.runs.lock().unwrap().retain(|r| r.id != id);
    profiling_state.save()
}

#[tauri::command]
pub async fn sample_table(
    connection_id: String,
    schema: String,
    table: String,
    limit: usize,
    app_state: State<'_, AppState>,
) -> Result<QueryResult, String> {
    let config = {
        app_state.connections.lock().unwrap()
            .get(&connection_id)
            .map(|c| c.config.clone())
            .ok_or_else(|| format!("Connection not found: {}", connection_id))?
    };

    let qualified = format!("{}.{}", schema, table);
    let sql = match &config {
        ConnectionConfig::SqlServer { .. } =>
            format!("SELECT TOP {} * FROM {}", limit, qualified),
        ConnectionConfig::Oracle { .. } =>
            format!("SELECT * FROM {} WHERE ROWNUM <= {}", qualified, limit),
        ConnectionConfig::Db2 { .. } =>
            format!("SELECT * FROM {} FETCH FIRST {} ROWS ONLY", qualified, limit),
        // Snowflake, CSV, Excel → LIMIT syntax (SQLite also uses LIMIT)
        _ => format!("SELECT * FROM {} LIMIT {}", qualified, limit),
    };

    run_profile_query(&config, &sql, &schema, &table).await
}

#[tauri::command]
pub async fn save_profiling_run(
    run: ProfilingRun,
    profiling_state: State<'_, ProfilingState>,
) -> Result<(), String> {
    profiling_state.runs.lock().unwrap().push(run);
    profiling_state.save()
}

#[tauri::command]
pub async fn clear_profiling_runs(
    profiling_state: State<'_, ProfilingState>,
) -> Result<(), String> {
    profiling_state.runs.lock().unwrap().clear();
    profiling_state.save()
}
