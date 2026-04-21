use oracle::{Connection, Row};
use super::{ColumnInfo, DbError, QueryResult, SchemaTable};

fn make_conn_str(host: &str, port: u16, service: &str) -> String {
    format!("//{}:{}/{}", host, port, service)
}

pub fn connect(
    host: &str,
    port: u16,
    service_name: &str,
    username: &str,
    password: &str,
) -> Result<Connection, DbError> {
    let conn_str = make_conn_str(host, port, service_name);
    Connection::connect(username, password, conn_str)
        .map_err(|e| DbError::Oracle(e.to_string()))
}

pub fn get_tables(conn: &Connection) -> Result<Vec<SchemaTable>, DbError> {
    let sql = "SELECT OWNER, TABLE_NAME FROM ALL_TABLES WHERE OWNER NOT IN \
               ('SYS','SYSTEM','DBSNMP','OUTLN','MDSYS','ORDSYS','EXFSYS','DMSYS',\
               'WMSYS','CTXSYS','ANONYMOUS','XDB','ORDPLUGINS','OLAPSYS','PUBLIC') \
               ORDER BY OWNER, TABLE_NAME";
    let rows = conn
        .query(sql, &[])
        .map_err(|e| DbError::Oracle(e.to_string()))?;

    let mut tables = Vec::new();
    for row_result in rows {
        let row: Row = row_result.map_err(|e| DbError::Oracle(e.to_string()))?;
        let schema: String = row.get(0).map_err(|e| DbError::Oracle(e.to_string()))?;
        let table: String = row.get(1).map_err(|e| DbError::Oracle(e.to_string()))?;
        tables.push(SchemaTable { schema, table });
    }
    Ok(tables)
}

pub fn get_columns(
    conn: &Connection,
    schema: &str,
    table: &str,
) -> Result<Vec<ColumnInfo>, DbError> {
    let sql = "SELECT COLUMN_NAME, DATA_TYPE, NULLABLE FROM ALL_TAB_COLUMNS \
               WHERE OWNER = :1 AND TABLE_NAME = :2 ORDER BY COLUMN_ID";
    let rows = conn
        .query(sql, &[&schema, &table])
        .map_err(|e| DbError::Oracle(e.to_string()))?;

    let mut columns = Vec::new();
    for row_result in rows {
        let row: Row = row_result.map_err(|e| DbError::Oracle(e.to_string()))?;
        let name: String = row.get(0).map_err(|e| DbError::Oracle(e.to_string()))?;
        let data_type: String = row.get(1).map_err(|e| DbError::Oracle(e.to_string()))?;
        let nullable_str: String = row.get(2).map_err(|e| DbError::Oracle(e.to_string()))?;
        columns.push(ColumnInfo {
            name,
            data_type,
            nullable: nullable_str == "Y",
        });
    }
    Ok(columns)
}

pub fn run_query(conn: &Connection, sql: &str) -> Result<QueryResult, DbError> {
    let rows = conn
        .query(sql, &[])
        .map_err(|e| DbError::Oracle(e.to_string()))?;

    let column_info = rows.column_info().to_vec();
    let columns: Vec<String> = column_info.iter().map(|c| c.name().to_string()).collect();

    let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();
    for row_result in rows {
        let row: Row = row_result.map_err(|e| DbError::Oracle(e.to_string()))?;
        let mut values = Vec::new();
        for i in 0..columns.len() {
            let val: serde_json::Value = match row.get::<usize, String>(i) {
                Ok(s) => serde_json::Value::String(s),
                Err(_) => match row.get::<usize, f64>(i) {
                    Ok(f) => serde_json::json!(f),
                    Err(_) => serde_json::Value::Null,
                },
            };
            values.push(val);
        }
        result_rows.push(values);
    }

    let row_count = result_rows.len();
    Ok(QueryResult { columns, rows: result_rows, row_count })
}
