use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use std::collections::HashMap;
use crate::db::{ConnectionConfig, QueryResult};
use crate::state::AppState;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RuleDefinition {
    NotNull { column: String },
    Unique { column: String },
    MinValue { column: String, min: f64 },
    MaxValue { column: String, max: f64 },
    Regex { column: String, pattern: String },
    CustomSql { sql: String },
    RowCount { min: Option<u64>, max: Option<u64> },
    ReferentialIntegrity {
        column: String,
        #[serde(skip_serializing_if = "Option::is_none", default)]
        ref_connection_id: Option<String>,
        ref_schema: String,
        ref_table: String,
        ref_column: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub connection_id: String,
    pub schema: String,
    pub table: String,
    pub definition: RuleDefinition,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleResult {
    pub rule_id: String,
    pub rule_name: String,
    pub passed: bool,
    pub failing_count: i64,
    pub total_count: i64,
    pub details: String,
    pub query_used: String,
}

pub struct RulesState {
    pub rules: std::sync::Mutex<HashMap<String, Rule>>,
    pub data_path: std::path::PathBuf,
}

impl RulesState {
    pub fn new(data_dir: &std::path::PathBuf) -> Self {
        let data_path = data_dir.join("rules.json");
        let rules = crate::persistence::load::<Vec<Rule>>(&data_path)
            .unwrap_or_default()
            .into_iter()
            .map(|r| (r.id.clone(), r))
            .collect();
        Self { rules: std::sync::Mutex::new(rules), data_path }
    }

    pub fn reload(&self) {
        let rules = crate::persistence::load::<Vec<Rule>>(&self.data_path)
            .unwrap_or_default()
            .into_iter()
            .map(|r| (r.id.clone(), r))
            .collect();
        *self.rules.lock().unwrap() = rules;
    }

    pub fn save(&self) -> Result<(), String> {
        let rules: Vec<Rule> = self.rules.lock().unwrap().values().cloned().collect();
        crate::persistence::save(&self.data_path, &rules)
    }
}

pub struct ResultsState {
    pub results: std::sync::Mutex<Vec<RuleResult>>,
    pub data_path: std::path::PathBuf,
}

impl ResultsState {
    pub fn new(data_dir: &std::path::PathBuf) -> Self {
        let data_path = data_dir.join("results.json");
        let results = crate::persistence::load::<Vec<RuleResult>>(&data_path).unwrap_or_default();
        Self { results: std::sync::Mutex::new(results), data_path }
    }

    pub fn reload(&self) {
        let results = crate::persistence::load::<Vec<RuleResult>>(&self.data_path)
            .unwrap_or_default();
        *self.results.lock().unwrap() = results;
    }

    pub fn save(&self) -> Result<(), String> {
        let results = self.results.lock().unwrap().clone();
        crate::persistence::save(&self.data_path, &results)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleRunRecord {
    pub id: String,
    pub batch_id: String,
    pub ran_at: String,
    pub rule_id: String,
    pub rule_name: String,
    pub passed: bool,
    pub failing_count: i64,
    pub total_count: i64,
    pub details: String,
}

pub struct ResultsHistoryState {
    pub records: std::sync::Mutex<Vec<RuleRunRecord>>,
    pub data_path: std::path::PathBuf,
}

impl ResultsHistoryState {
    pub fn new(data_dir: &std::path::PathBuf) -> Self {
        let data_path = data_dir.join("results_history.json");
        let records = crate::persistence::load::<Vec<RuleRunRecord>>(&data_path).unwrap_or_default();
        Self { records: std::sync::Mutex::new(records), data_path }
    }

    pub fn reload(&self) {
        let records = crate::persistence::load::<Vec<RuleRunRecord>>(&self.data_path)
            .unwrap_or_default();
        *self.records.lock().unwrap() = records;
    }

    pub fn save(&self) -> Result<(), String> {
        let records = self.records.lock().unwrap().clone();
        crate::persistence::save(&self.data_path, &records)
    }
}

enum DbKind { SqlServer, Oracle, Snowflake, Db2, File }

fn quote_ident(name: &str, kind: &DbKind) -> String {
    match kind {
        DbKind::SqlServer => format!("[{}]", name.replace(']', "]]")),
        DbKind::Oracle | DbKind::Snowflake | DbKind::Db2 | DbKind::File => {
            format!("\"{}\"", name.replace('"', "\"\""))
        }
    }
}

fn quote_qualified_name(schema: &str, table: &str, kind: &DbKind) -> String {
    format!("{}.{}", quote_ident(schema, kind), quote_ident(table, kind))
}

fn quote_string_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn limit_sql(inner: &str, n: usize, kind: &DbKind) -> String {
    match kind {
        DbKind::SqlServer => inner.replacen("SELECT ", &format!("SELECT TOP {} ", n), 1),
        DbKind::Oracle => format!("SELECT * FROM ({}) WHERE ROWNUM <= {}", inner, n),
        DbKind::Snowflake => format!("{} LIMIT {}", inner, n),
        DbKind::Db2 => format!("{} FETCH FIRST {} ROWS ONLY", inner, n),
        DbKind::File => format!("{} LIMIT {}", inner, n),
    }
}

fn db_kind(config: &ConnectionConfig) -> DbKind {
    match config {
        ConnectionConfig::SqlServer { .. } => DbKind::SqlServer,
        ConnectionConfig::Oracle { .. } => DbKind::Oracle,
        ConnectionConfig::Snowflake { .. } => DbKind::Snowflake,
        ConnectionConfig::Db2 { .. } => DbKind::Db2,
        ConnectionConfig::Csv { .. } | ConnectionConfig::Excel { .. } => DbKind::File,
    }
}

fn build_failing_rows_sql(schema: &str, table: &str, def: &RuleDefinition, kind: &DbKind) -> Option<String> {
    let q = quote_qualified_name(schema, table, kind);
    let sql = match def {
        RuleDefinition::NotNull { column } =>
            format!("SELECT * FROM {} WHERE {} IS NULL", q, quote_ident(column, kind)),
        RuleDefinition::Unique { column } =>
            format!(
                "SELECT * FROM {} WHERE {} IN (SELECT {} FROM {} GROUP BY {} HAVING COUNT(*) > 1)",
                q,
                quote_ident(column, kind),
                quote_ident(column, kind),
                q,
                quote_ident(column, kind)
            ),
        RuleDefinition::MinValue { column, min } =>
            format!("SELECT * FROM {} WHERE {} < {}", q, quote_ident(column, kind), min),
        RuleDefinition::MaxValue { column, max } =>
            format!("SELECT * FROM {} WHERE {} > {}", q, quote_ident(column, kind), max),
        RuleDefinition::Regex { column, pattern } =>
            format!(
                "SELECT * FROM {} WHERE {} NOT LIKE {}",
                q,
                quote_ident(column, kind),
                quote_string_literal(pattern)
            ),
        RuleDefinition::ReferentialIntegrity { column, ref_schema, ref_table, ref_column, .. } =>
            format!(
                "SELECT * FROM {} WHERE {} NOT IN (SELECT {} FROM {})",
                q,
                quote_ident(column, kind),
                quote_ident(ref_column, kind),
                quote_qualified_name(ref_schema, ref_table, kind)
            ),
        RuleDefinition::CustomSql { sql } => sql.clone(),
        RuleDefinition::RowCount { .. } => return None,
    };
    Some(limit_sql(&sql, 500, kind))
}

fn build_rule_sql(schema: &str, table: &str, def: &RuleDefinition, kind: &DbKind) -> String {
    let qualified = quote_qualified_name(schema, table, kind);
    match def {
        RuleDefinition::NotNull { column } => format!(
            "SELECT SUM(CASE WHEN {} IS NULL THEN 1 ELSE 0 END) as failing_count, COUNT(*) as total_count FROM {}",
            quote_ident(column, kind), qualified
        ),
        RuleDefinition::Unique { column } => format!(
            "SELECT COUNT(*) - COUNT(DISTINCT {}) as failing_count, COUNT(*) as total_count FROM {}",
            quote_ident(column, kind), qualified
        ),
        RuleDefinition::MinValue { column, min } => format!(
            "SELECT SUM(CASE WHEN {} < {} THEN 1 ELSE 0 END) as failing_count, COUNT(*) as total_count FROM {}",
            quote_ident(column, kind), min, qualified
        ),
        RuleDefinition::MaxValue { column, max } => format!(
            "SELECT SUM(CASE WHEN {} > {} THEN 1 ELSE 0 END) as failing_count, COUNT(*) as total_count FROM {}",
            quote_ident(column, kind), max, qualified
        ),
        RuleDefinition::Regex { column, pattern } => format!(
            "SELECT SUM(CASE WHEN {} NOT LIKE {} THEN 1 ELSE 0 END) as failing_count, COUNT(*) as total_count FROM {}",
            quote_ident(column, kind), quote_string_literal(pattern), qualified
        ),
        RuleDefinition::ReferentialIntegrity { column, ref_schema, ref_table, ref_column, .. } => format!(
            "SELECT SUM(CASE WHEN r.{} IS NULL THEN 1 ELSE 0 END) as failing_count, COUNT(*) as total_count FROM {} t LEFT JOIN {} r ON t.{} = r.{}",
            quote_ident(ref_column, kind),
            qualified,
            quote_qualified_name(ref_schema, ref_table, kind),
            quote_ident(column, kind),
            quote_ident(ref_column, kind)
        ),
        RuleDefinition::CustomSql { sql } => sql.clone(),
        RuleDefinition::RowCount { .. } => {
            format!("SELECT COUNT(*) as total_count FROM {}", qualified)
        }
    }
}

async fn execute_on_connection(
    config: &ConnectionConfig,
    sql: &str,
) -> Result<QueryResult, String> {
    match config {
        ConnectionConfig::SqlServer { host, port, database, username, password, trust_cert } => {
            let mut client =
                crate::db::sqlserver::connect(host, *port, database, username, password, *trust_cert)
                    .await
                    .map_err(|e| e.to_string())?;
            crate::db::sqlserver::run_query(&mut client, sql)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfig::Oracle { host, port, service_name, username, password } => {
            let conn = crate::db::oracle::connect(host, *port, service_name, username, password)
                .map_err(|e| e.to_string())?;
            crate::db::oracle::run_query(&conn, sql).map_err(|e| e.to_string())
        }
        ConnectionConfig::Snowflake { account, warehouse, database, schema, username, password } => {
            let client = crate::db::snowflake::SnowflakeClient::new(
                account, warehouse, database, schema, username, password,
            )
            .map_err(|e| e.to_string())?;
            client.run_query(sql).await.map_err(|e| e.to_string())
        }
        ConnectionConfig::Db2 { host, port, database, username, password } => {
            let (h, p, db, u, pw, s) = (host.clone(), *port, database.clone(), username.clone(), password.clone(), sql.to_string());
            tokio::task::spawn_blocking(move || {
                crate::db::db2::run_query(&h, p, &db, &u, &pw, &s)
                    .map_err(|e| e.to_string())
            }).await.map_err(|e| e.to_string())?
        }
        ConnectionConfig::Csv { .. } | ConnectionConfig::Excel { .. } => {
            Err("File connections are handled separately".to_string())
        }
    }
}

/// Unified query executor for both database and file connections.
async fn execute_query(
    config: &ConnectionConfig,
    sql: &str,
    schema: &str,
    table: &str,
) -> Result<QueryResult, String> {
    match config {
        ConnectionConfig::Csv { .. } | ConnectionConfig::Excel { .. } => {
            let (c, sc, tb, s) = (config.clone(), schema.to_string(), table.to_string(), sql.to_string());
            tokio::task::spawn_blocking(move || crate::db::files::run_file_query(&c, &sc, &tb, &s))
                .await.map_err(|e| e.to_string())?
        }
        _ => execute_on_connection(config, sql).await,
    }
}

/// Fetch all distinct values of a column from a reference connection.
async fn fetch_ref_values(
    ref_config: &ConnectionConfig,
    ref_schema: &str,
    ref_table: &str,
    ref_column: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let ref_kind = db_kind(ref_config);
    let sql = format!(
        "SELECT DISTINCT {} FROM {}",
        quote_ident(ref_column, &ref_kind),
        quote_qualified_name(ref_schema, ref_table, &ref_kind)
    );
    let qr = execute_query(ref_config, &sql, ref_schema, ref_table).await?;
    Ok(qr.rows.into_iter().filter_map(|row| row.into_iter().next()).collect())
}

/// Format a set of values as a SQL IN-list literal (e.g. `'a', 'b', 42`).
fn values_to_in_list(values: &[serde_json::Value]) -> String {
    values.iter()
        .filter(|v| !v.is_null())
        .map(|v| match v {
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => if *b { "1" } else { "0" }.to_string(),
            serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
            _ => format!("'{}'", v.to_string().replace('\'', "''")),
        })
        .collect::<Vec<_>>()
        .join(", ")
}

#[tauri::command]
pub async fn save_rule(
    rule: Rule,
    rules_state: State<'_, RulesState>,
) -> Result<String, String> {
    let id = if rule.id.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        rule.id.clone()
    };
    let mut r = rule.clone();
    r.id = id.clone();
    rules_state.rules.lock().unwrap().insert(id.clone(), r);
    rules_state.save()?;
    Ok(id)
}

#[tauri::command]
pub async fn delete_rule(
    id: String,
    rules_state: State<'_, RulesState>,
) -> Result<(), String> {
    rules_state.rules.lock().unwrap().remove(&id);
    rules_state.save()
}

#[tauri::command]
pub async fn list_rules(
    rules_state: State<'_, RulesState>,
) -> Result<Vec<Rule>, String> {
    rules_state.reload();
    Ok(rules_state.rules.lock().unwrap().values().cloned().collect())
}

#[tauri::command]
pub async fn get_last_results(
    results_state: State<'_, ResultsState>,
) -> Result<Vec<RuleResult>, String> {
    results_state.reload();
    Ok(results_state.results.lock().unwrap().clone())
}

async fn run_rule_inner(
    rule_id: &str,
    batch_id: &str,
    app_state: &AppState,
    rules_state: &RulesState,
    results_state: &ResultsState,
    history_state: &ResultsHistoryState,
) -> Result<RuleResult, String> {
    let rule = {
        rules_state
            .rules
            .lock()
            .unwrap()
            .get(rule_id)
            .cloned()
            .ok_or_else(|| format!("Rule not found: {}", rule_id))?
    };
    let config = {
        app_state
            .connections
            .lock()
            .unwrap()
            .get(&rule.connection_id)
            .map(|c| c.config.clone())
            .ok_or_else(|| format!("Connection not found: {}", rule.connection_id))?
    };

    let is_cross_conn_ri = matches!(
        &rule.definition,
        RuleDefinition::ReferentialIntegrity { ref_connection_id: Some(rid), .. }
            if rid != &rule.connection_id
    );

    let (sql, qr) = if is_cross_conn_ri {
        let RuleDefinition::ReferentialIntegrity { column, ref_connection_id: Some(ref_id), ref_schema, ref_table, ref_column } = &rule.definition else { unreachable!() };
        let ref_config = app_state.connections.lock().unwrap()
            .get(ref_id.as_str()).map(|c| c.config.clone())
            .ok_or_else(|| format!("Reference connection not found: {}", ref_id))?;
        let ref_values = fetch_ref_values(&ref_config, ref_schema, ref_table, ref_column).await?;
        let in_list = values_to_in_list(&ref_values);
        let kind = db_kind(&config);
        let qualified = quote_qualified_name(&rule.schema, &rule.table, &kind);
        let column_ident = quote_ident(column, &kind);
        let sql = if in_list.is_empty() {
            format!(
                "SELECT COUNT(*) as failing_count, COUNT(*) as total_count FROM {} WHERE {} IS NOT NULL",
                qualified, column_ident
            )
        } else {
            format!(
                "SELECT SUM(CASE WHEN {} IS NOT NULL AND {} NOT IN ({}) THEN 1 ELSE 0 END) as failing_count, COUNT(*) as total_count FROM {}",
                column_ident, column_ident, in_list, qualified
            )
        };
        let qr = execute_query(&config, &sql, &rule.schema, &rule.table).await?;
        (sql, qr)
    } else {
        let sql = build_rule_sql(&rule.schema, &rule.table, &rule.definition, &db_kind(&config));
        let qr = execute_query(&config, &sql, &rule.schema, &rule.table).await?;
        (sql, qr)
    };

    let parse_count = |v: &serde_json::Value| -> i64 {
        v.as_i64()
            .or_else(|| v.as_f64().map(|f| f as i64))
            .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            .unwrap_or(0)
    };
    let (failing_count, total_count) = if let Some(row) = qr.rows.first() {
        match &rule.definition {
            RuleDefinition::RowCount { .. } => {
                let count = row.get(0).map(parse_count).unwrap_or(0);
                (0_i64, count)
            }
            _ => {
                let failing = row.get(0).map(parse_count).unwrap_or(0);
                let total = row.get(1).map(parse_count).unwrap_or(0);
                (failing, total)
            }
        }
    } else {
        (0, 0)
    };

    let passed = match &rule.definition {
        RuleDefinition::RowCount { min, max } => {
            let count = total_count as u64;
            min.map_or(true, |m| count >= m) && max.map_or(true, |m| count <= m)
        }
        _ => failing_count == 0,
    };

    let details = match &rule.definition {
        RuleDefinition::RowCount { min, max } => {
            let mut bounds = vec![];
            if let Some(m) = min { bounds.push(format!("≥ {}", m)); }
            if let Some(m) = max { bounds.push(format!("≤ {}", m)); }
            let bounds_str = if bounds.is_empty() { String::new() } else { format!(" (expected {})", bounds.join(", ")) };
            if passed {
                format!("Row count: {}{}", total_count, bounds_str)
            } else {
                format!("Row count: {} — out of bounds{}", total_count, bounds_str)
            }
        }
        _ => {
            if passed {
                format!("Rule passed. Checked {} rows.", total_count)
            } else {
                format!("{} of {} rows failed the rule.", failing_count, total_count)
            }
        }
    };

    let result = RuleResult {
        rule_id: rule.id.clone(),
        rule_name: rule.name.clone(),
        passed,
        failing_count,
        total_count,
        details: details.clone(),
        query_used: sql,
    };

    // Update last-results (replace existing entry or append).
    {
        let mut results = results_state.results.lock().unwrap();
        if let Some(pos) = results.iter().position(|r| r.rule_id == result.rule_id) {
            results[pos] = result.clone();
        } else {
            results.push(result.clone());
        }
    }
    let _ = results_state.save();

    // Append to history.
    let record = RuleRunRecord {
        id: Uuid::new_v4().to_string(),
        batch_id: batch_id.to_string(),
        ran_at: Utc::now().to_rfc3339(),
        rule_id: rule.id,
        rule_name: rule.name,
        passed,
        failing_count,
        total_count,
        details,
    };
    {
        history_state.records.lock().unwrap().push(record);
    }
    let _ = history_state.save();

    Ok(result)
}

#[tauri::command]
pub async fn run_rule(
    rule_id: String,
    batch_id: Option<String>,
    app_state: State<'_, AppState>,
    rules_state: State<'_, RulesState>,
    results_state: State<'_, ResultsState>,
    history_state: State<'_, ResultsHistoryState>,
) -> Result<RuleResult, String> {
    let batch_id = batch_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    run_rule_inner(&rule_id, &batch_id, &app_state, &rules_state, &results_state, &history_state).await
}

#[tauri::command]
pub async fn run_all_rules(
    app_state: State<'_, AppState>,
    rules_state: State<'_, RulesState>,
    results_state: State<'_, ResultsState>,
    history_state: State<'_, ResultsHistoryState>,
) -> Result<Vec<RuleResult>, String> {
    let rule_ids: Vec<String> = rules_state
        .rules
        .lock()
        .unwrap()
        .keys()
        .cloned()
        .collect();

    let batch_id = Uuid::new_v4().to_string();
    let mut results = Vec::new();
    for id in rule_ids {
        match run_rule_inner(&id, &batch_id, &app_state, &rules_state, &results_state, &history_state).await {
            Ok(r) => results.push(r),
            Err(e) => results.push(RuleResult {
                rule_id: String::new(),
                rule_name: String::new(),
                passed: false,
                failing_count: -1,
                total_count: 0,
                details: e,
                query_used: String::new(),
            }),
        }
    }
    Ok(results)
}

#[tauri::command]
pub async fn get_results_history(
    history_state: State<'_, ResultsHistoryState>,
) -> Result<Vec<RuleRunRecord>, String> {
    history_state.reload();
    Ok(history_state.records.lock().unwrap().clone())
}

#[tauri::command]
pub async fn clear_results_history(
    history_state: State<'_, ResultsHistoryState>,
) -> Result<(), String> {
    history_state.records.lock().unwrap().clear();
    history_state.save()
}

#[tauri::command]
pub async fn get_failing_rows(
    rule_id: String,
    app_state: State<'_, AppState>,
    rules_state: State<'_, RulesState>,
) -> Result<QueryResult, String> {
    let rule = {
        rules_state.rules.lock().unwrap()
            .get(&rule_id).cloned()
            .ok_or_else(|| format!("Rule not found: {}", rule_id))?
    };
    let config = {
        app_state.connections.lock().unwrap()
            .get(&rule.connection_id).map(|c| c.config.clone())
            .ok_or_else(|| format!("Connection not found: {}", rule.connection_id))?
    };
    let kind = db_kind(&config);

    // Cross-connection RI: build NOT IN using fetched ref values
    if let RuleDefinition::ReferentialIntegrity { column, ref_connection_id: Some(ref_id), ref_schema, ref_table, ref_column } = &rule.definition {
        if ref_id != &rule.connection_id {
            let ref_config = app_state.connections.lock().unwrap()
                .get(ref_id.as_str()).map(|c| c.config.clone())
                .ok_or_else(|| format!("Reference connection not found: {}", ref_id))?;
            let ref_values = fetch_ref_values(&ref_config, ref_schema, ref_table, ref_column).await?;
            let in_list = values_to_in_list(&ref_values);
            let qualified = quote_qualified_name(&rule.schema, &rule.table, &kind);
            let column_ident = quote_ident(column, &kind);
            let inner = if in_list.is_empty() {
                format!("SELECT * FROM {} WHERE {} IS NOT NULL", qualified, column_ident)
            } else {
                format!(
                    "SELECT * FROM {} WHERE {} IS NOT NULL AND {} NOT IN ({})",
                    qualified, column_ident, column_ident, in_list
                )
            };
            let sql = limit_sql(&inner, 500, &kind);
            return execute_query(&config, &sql, &rule.schema, &rule.table).await;
        }
    }

    let sql = build_failing_rows_sql(&rule.schema, &rule.table, &rule.definition, &kind)
        .ok_or_else(|| "Failing rows not available for this rule type".to_string())?;
    execute_query(&config, &sql, &rule.schema, &rule.table).await
}

#[tauri::command]
pub async fn run_query_preview(
    connection_id: String,
    sql: String,
    app_state: State<'_, AppState>,
) -> Result<QueryResult, String> {
    let config = {
        app_state
            .connections
            .lock()
            .unwrap()
            .get(&connection_id)
            .map(|c| c.config.clone())
            .ok_or_else(|| format!("Connection not found: {}", connection_id))?
    };
    execute_on_connection(&config, &sql).await
}
