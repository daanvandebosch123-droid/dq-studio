use odbc_api::{ConnectionOptions, Environment, Cursor};
use odbc_api::buffers::TextRowSet;
use once_cell::sync::OnceCell;
use super::{ColumnInfo, DbError, QueryResult, SchemaTable};

static ODBC_ENV: OnceCell<Environment> = OnceCell::new();

fn env() -> Result<&'static Environment, DbError> {
    ODBC_ENV.get_or_try_init(|| {
        Environment::new().map_err(|e| DbError::Db2(e.to_string()))
    })
}

fn conn_str(host: &str, port: u16, database: &str, username: &str, password: &str) -> String {
    format!(
        "DRIVER={{IBM DB2 ODBC DRIVER}};DATABASE={};HOSTNAME={};PORT={};PROTOCOL=TCPIP;UID={};PWD={};",
        database, host, port, username, password
    )
}

fn cursor_to_result(mut cursor: impl Cursor) -> Result<QueryResult, DbError> {
    let col_count = cursor.num_result_cols().map_err(|e| DbError::Db2(e.to_string()))? as usize;
    let columns: Vec<String> = (1..=col_count as u16)
        .map(|i| cursor.col_name(i).map_err(|e| DbError::Db2(e.to_string())))
        .collect::<Result<_, _>>()?;

    let row_set_buffer = TextRowSet::for_cursor(1000, &mut cursor, Some(4096))
        .map_err(|e| DbError::Db2(e.to_string()))?;
    let mut block_cursor = cursor.bind_buffer(row_set_buffer)
        .map_err(|e| DbError::Db2(e.to_string()))?;

    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    while let Some(batch) = block_cursor.fetch().map_err(|e| DbError::Db2(e.to_string()))? {
        for row_idx in 0..batch.num_rows() {
            let row: Vec<serde_json::Value> = (0..col_count)
                .map(|col_idx| match batch.at(col_idx, row_idx) {
                    Some(bytes) => serde_json::Value::String(
                        String::from_utf8_lossy(bytes).into_owned()
                    ),
                    None => serde_json::Value::Null,
                })
                .collect();
            rows.push(row);
        }
    }

    let row_count = rows.len();
    Ok(QueryResult { columns, rows, row_count })
}

pub fn test_connection(host: &str, port: u16, database: &str, username: &str, password: &str) -> Result<(), DbError> {
    let env = env()?;
    let cs = conn_str(host, port, database, username, password);
    let conn = env.connect_with_connection_string(&cs, ConnectionOptions::default())
        .map_err(|e| DbError::Db2(e.to_string()))?;
    conn.execute("SELECT 1 FROM SYSIBM.SYSDUMMY1", ())
        .map_err(|e| DbError::Db2(e.to_string()))?;
    Ok(())
}

pub fn get_tables(host: &str, port: u16, database: &str, username: &str, password: &str) -> Result<Vec<SchemaTable>, DbError> {
    let env = env()?;
    let cs = conn_str(host, port, database, username, password);
    let conn = env.connect_with_connection_string(&cs, ConnectionOptions::default())
        .map_err(|e| DbError::Db2(e.to_string()))?;

    let sql = "SELECT TABSCHEMA, TABNAME FROM SYSCAT.TABLES \
               WHERE TYPE = 'T' AND TABSCHEMA NOT LIKE 'SYS%' \
               ORDER BY TABSCHEMA, TABNAME";
    let cursor = conn.execute(sql, ()).map_err(|e| DbError::Db2(e.to_string()))?
        .ok_or_else(|| DbError::Db2("No result set".into()))?;
    let qr = cursor_to_result(cursor)?;

    Ok(qr.rows.iter().map(|r| SchemaTable {
        schema: r.get(0).and_then(|v| v.as_str()).unwrap_or("").trim().to_string(),
        table:  r.get(1).and_then(|v| v.as_str()).unwrap_or("").trim().to_string(),
    }).collect())
}

pub fn get_columns(host: &str, port: u16, database: &str, username: &str, password: &str, schema: &str, table: &str) -> Result<Vec<ColumnInfo>, DbError> {
    let env = env()?;
    let cs = conn_str(host, port, database, username, password);
    let conn = env.connect_with_connection_string(&cs, ConnectionOptions::default())
        .map_err(|e| DbError::Db2(e.to_string()))?;

    let sql = format!(
        "SELECT COLNAME, TYPENAME, NULLS FROM SYSCAT.COLUMNS \
         WHERE TABSCHEMA = '{}' AND TABNAME = '{}' ORDER BY COLNO",
        schema.to_uppercase(), table.to_uppercase()
    );
    let cursor = conn.execute(&sql, ()).map_err(|e| DbError::Db2(e.to_string()))?
        .ok_or_else(|| DbError::Db2("No result set".into()))?;
    let qr = cursor_to_result(cursor)?;

    Ok(qr.rows.iter().map(|r| ColumnInfo {
        name:      r.get(0).and_then(|v| v.as_str()).unwrap_or("").trim().to_string(),
        data_type: r.get(1).and_then(|v| v.as_str()).unwrap_or("").trim().to_string(),
        nullable:  r.get(2).and_then(|v| v.as_str()).unwrap_or("Y").trim() == "Y",
    }).collect())
}

pub fn run_query(host: &str, port: u16, database: &str, username: &str, password: &str, sql: &str) -> Result<QueryResult, DbError> {
    let env = env()?;
    let cs = conn_str(host, port, database, username, password);
    let conn = env.connect_with_connection_string(&cs, ConnectionOptions::default())
        .map_err(|e| DbError::Db2(e.to_string()))?;
    let cursor = conn.execute(sql, ()).map_err(|e| DbError::Db2(e.to_string()))?
        .ok_or_else(|| DbError::Db2("Query returned no result set".into()))?;
    cursor_to_result(cursor)
}
