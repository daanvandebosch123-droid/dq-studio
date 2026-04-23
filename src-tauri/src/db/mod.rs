pub mod sqlserver;
pub mod oracle;
pub mod snowflake;
pub mod db2;
pub mod files;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("SQL Server error: {0}")]
    SqlServer(#[from] tiberius::error::Error),
    #[error("Oracle error: {0}")]
    Oracle(String),
    #[error("Snowflake error: {0}")]
    Snowflake(String),
    #[error("DB2 error: {0}")]
    Db2(String),
    #[error("Connection not found: {0}")]
    NotFound(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl From<DbError> for String {
    fn from(e: DbError) -> Self {
        e.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ConnectionConfig {
    SqlServer {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: String,
        trust_cert: bool,
    },
    Oracle {
        host: String,
        port: u16,
        service_name: String,
        username: String,
        password: String,
    },
    Snowflake {
        account: String,
        warehouse: String,
        database: String,
        schema: String,
        username: String,
        password: String,
    },
    Db2 {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: String,
    },
    Csv {
        path: String,
    },
    Excel {
        path: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub name: String,
    pub config: ConnectionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaTable {
    pub schema: String,
    pub table: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
}
