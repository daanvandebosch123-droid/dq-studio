use calamine::Reader;
use rusqlite::Connection;
use serde_json::Value;
use crate::db::{ColumnInfo, ConnectionConfig, QueryResult, SchemaTable};

/// Replace chars that aren't valid in an unquoted SQL identifier with underscores.
/// The result is used as both the SQLite table name and the `table` field in SchemaTable.
pub fn sanitize_identifier(s: &str) -> String {
    let mut out: String = s
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '_' })
        .collect();
    // Identifiers must not start with a digit
    if out.starts_with(|c: char| c.is_ascii_digit()) {
        out.insert(0, '_');
    }
    if out.is_empty() {
        out.push_str("table");
    }
    out
}

/// Given a sanitized table name, find the original sheet name in the workbook.
fn find_sheet<'a>(names: &'a [String], sanitized: &str) -> Option<&'a str> {
    names.iter().find(|n| sanitize_identifier(n) == sanitized).map(|s| s.as_str())
}

// ── CSV ────────────────────────────────────────────────────────────────────

pub fn get_csv_schema(path: &str) -> Result<Vec<SchemaTable>, String> {
    let stem = std::path::Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("data");
    Ok(vec![SchemaTable {
        schema: "file".to_string(),
        table: sanitize_identifier(stem),
    }])
}

pub fn get_csv_columns(path: &str) -> Result<Vec<ColumnInfo>, String> {
    let mut rdr = csv::Reader::from_path(path)
        .map_err(|e| format!("Cannot read CSV: {}", e))?;
    let headers = rdr.headers().map_err(|e| format!("Cannot read CSV headers: {}", e))?;
    Ok(headers
        .iter()
        .map(|h| ColumnInfo {
            name: h.to_string(),
            data_type: "TEXT".to_string(),
            nullable: true,
        })
        .collect())
}

fn load_csv_to_sqlite(path: &str, table_name: &str) -> Result<Connection, String> {
    let mut rdr = csv::Reader::from_path(path)
        .map_err(|e| format!("Cannot read CSV: {}", e))?;

    let headers: Vec<String> = rdr
        .headers()
        .map_err(|e| format!("Cannot read CSV headers: {}", e))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;

    let col_defs = headers
        .iter()
        .map(|h| format!("\"{}\" NUMERIC", h.replace('"', "")))
        .collect::<Vec<_>>()
        .join(", ");
    conn.execute_batch(&format!(
        "CREATE TABLE \"{}\" ({})",
        table_name, col_defs
    ))
    .map_err(|e| e.to_string())?;

    let placeholders = headers.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let insert_sql = format!("INSERT INTO \"{}\" VALUES ({})", table_name, placeholders);

    for result in rdr.records() {
        let record = result.map_err(|e| format!("CSV read error: {}", e))?;
        let values: Vec<&str> = record.iter().collect();
        conn.execute(
            &insert_sql,
            rusqlite::params_from_iter(values.iter()),
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(conn)
}

// ── Excel ──────────────────────────────────────────────────────────────────

pub fn get_excel_sheets(path: &str) -> Result<Vec<SchemaTable>, String> {
    let workbook = calamine::open_workbook_auto(path)
        .map_err(|e| format!("Cannot open Excel file: {}", e))?;
    Ok(workbook
        .sheet_names()
        .iter()
        .map(|name| SchemaTable {
            schema: "file".to_string(),
            table: sanitize_identifier(name),
        })
        .collect())
}

pub fn get_excel_columns(path: &str, table: &str) -> Result<Vec<ColumnInfo>, String> {
    let mut workbook = calamine::open_workbook_auto(path)
        .map_err(|e| format!("Cannot open Excel file: {}", e))?;
    let names = workbook.sheet_names().to_vec();
    let sheet_name = find_sheet(&names, table)
        .ok_or_else(|| format!("Sheet not found for table '{}'", table))?
        .to_string();
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("Cannot read sheet '{}': {}", sheet_name, e))?;
    let first_row = range.rows().next().unwrap_or(&[]);
    Ok(first_row
        .iter()
        .map(|cell| ColumnInfo {
            name: cell.to_string(),
            data_type: "TEXT".to_string(),
            nullable: true,
        })
        .collect())
}

fn load_excel_to_sqlite(path: &str, table: &str) -> Result<Connection, String> {
    let mut workbook = calamine::open_workbook_auto(path)
        .map_err(|e| format!("Cannot open Excel file: {}", e))?;
    let names = workbook.sheet_names().to_vec();
    let sheet_name = find_sheet(&names, table)
        .ok_or_else(|| format!("Sheet not found for table '{}'", table))?
        .to_string();
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("Cannot read sheet '{}': {}", sheet_name, e))?;

    let mut rows = range.rows();
    let headers: Vec<String> = rows
        .next()
        .ok_or("Sheet is empty")?
        .iter()
        .map(|c| c.to_string())
        .collect();

    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
    let col_defs = headers
        .iter()
        .map(|h| format!("\"{}\" NUMERIC", h.replace('"', "")))
        .collect::<Vec<_>>()
        .join(", ");
    conn.execute_batch(&format!(
        "CREATE TABLE \"{}\" ({})",
        table, col_defs
    ))
    .map_err(|e| e.to_string())?;

    let placeholders = headers.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let insert_sql = format!("INSERT INTO \"{}\" VALUES ({})", table, placeholders);
    let mut stmt = conn.prepare(&insert_sql).map_err(|e| e.to_string())?;

    for row in rows {
        let values: Vec<rusqlite::types::Value> = row
            .iter()
            .map(|cell| match cell {
                calamine::Data::Int(n) => rusqlite::types::Value::Integer(*n),
                calamine::Data::Float(f) => rusqlite::types::Value::Real(*f),
                calamine::Data::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
                calamine::Data::Empty => rusqlite::types::Value::Null,
                _ => rusqlite::types::Value::Text(cell.to_string()),
            })
            .collect();
        stmt.execute(rusqlite::params_from_iter(values.iter()))
            .map_err(|e| e.to_string())?;
    }
    drop(stmt);

    Ok(conn)
}

// ── Query execution ────────────────────────────────────────────────────────

fn run_query_on_sqlite(conn: &Connection, sql: &str, schema: &str, table: &str) -> Result<QueryResult, String> {
    // Rules generate quoted identifiers ("file"."table") while profiling generates
    // unquoted ones (file.table). Replace both so SQLite receives just "table".
    let replacement = format!("\"{}\"", table);
    let quoted_qualified = format!("\"{}\".\"{}\"", schema, table);
    let unquoted_qualified = format!("{}.{}", schema, table);
    let adapted = sql
        .replace(&quoted_qualified, &replacement)
        .replace(&unquoted_qualified, &replacement);

    let mut stmt = conn.prepare(&adapted).map_err(|e| format!("SQLite prepare error: {}", e))?;
    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let col_count = col_names.len();

    let rows: Vec<Vec<Value>> = stmt
        .query_map([], |row| {
            let vals: Vec<Value> = (0..col_count)
                .map(|i| {
                    let v: rusqlite::types::Value = row.get(i).unwrap_or(rusqlite::types::Value::Null);
                    match v {
                        rusqlite::types::Value::Null => Value::Null,
                        rusqlite::types::Value::Integer(n) => Value::Number(n.into()),
                        rusqlite::types::Value::Real(f) => {
                            Value::Number(serde_json::Number::from_f64(f).unwrap_or(0.into()))
                        }
                        rusqlite::types::Value::Text(s) => Value::String(s),
                        rusqlite::types::Value::Blob(b) => {
                            Value::String(format!("<blob {} bytes>", b.len()))
                        }
                    }
                })
                .collect();
            Ok(vals)
        })
        .map_err(|e| format!("SQLite query error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let row_count = rows.len();
    Ok(QueryResult { columns: col_names, rows, row_count })
}

/// Entry point called from the rules commands for file-based connections.
pub fn run_file_query(
    config: &ConnectionConfig,
    schema: &str,
    table: &str,
    sql: &str,
) -> Result<QueryResult, String> {
    let conn = match config {
        ConnectionConfig::Csv { path } => load_csv_to_sqlite(path, table)?,
        ConnectionConfig::Excel { path } => load_excel_to_sqlite(path, table)?,
        _ => return Err("Not a file connection".to_string()),
    };
    run_query_on_sqlite(&conn, sql, schema, table)
}
