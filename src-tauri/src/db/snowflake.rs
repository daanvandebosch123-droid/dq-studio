use reqwest::Client;
use serde_json::Value;
use super::{ColumnInfo, DbError, QueryResult, SchemaTable};

pub struct SnowflakeClient {
    pub account: String,
    pub warehouse: String,
    pub database: String,
    pub schema: String,
    pub username: String,
    pub password: String,
    http: Client,
}

impl SnowflakeClient {
    pub fn new(
        account: &str,
        warehouse: &str,
        database: &str,
        schema: &str,
        username: &str,
        password: &str,
    ) -> Result<Self, DbError> {
        let http = Client::builder()
            .use_rustls_tls()
            .build()
            .map_err(|e| DbError::Snowflake(e.to_string()))?;
        Ok(Self {
            account: account.to_string(),
            warehouse: warehouse.to_string(),
            database: database.to_string(),
            schema: schema.to_string(),
            username: username.to_string(),
            password: password.to_string(),
            http,
        })
    }

    fn base_url(&self) -> String {
        format!("https://{}.snowflakecomputing.com", self.account)
    }

    async fn execute_sql(&self, sql: &str) -> Result<Value, DbError> {
        let url = format!("{}/api/v2/statements", self.base_url());
        let body = serde_json::json!({
            "statement": sql,
            "warehouse": self.warehouse,
            "database": self.database,
            "schema": self.schema,
            "timeout": 60
        });

        let resp = self
            .http
            .post(&url)
            .basic_auth(&self.username, Some(&self.password))
            .header("X-Snowflake-Authorization-Token-Type", "BASIC")
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| DbError::Snowflake(e.to_string()))?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(DbError::Snowflake(format!("HTTP error: {}", text)));
        }

        resp.json::<Value>()
            .await
            .map_err(|e| DbError::Snowflake(e.to_string()))
    }

    fn parse_result(&self, json: Value) -> Result<QueryResult, DbError> {
        let columns: Vec<String> = json["resultSetMetaData"]["rowType"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|c| c["name"].as_str().unwrap_or("").to_string())
            .collect();

        let rows: Vec<Vec<serde_json::Value>> = json["data"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|row| {
                row.as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .map(|v| v.clone())
                    .collect()
            })
            .collect();

        let row_count = rows.len();
        Ok(QueryResult { columns, rows, row_count })
    }

    pub async fn test_connection(&self) -> Result<(), DbError> {
        self.execute_sql("SELECT 1").await?;
        Ok(())
    }

    pub async fn get_tables(&self) -> Result<Vec<SchemaTable>, DbError> {
        let sql = format!(
            "SELECT TABLE_SCHEMA, TABLE_NAME FROM {}.INFORMATION_SCHEMA.TABLES \
             WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME",
            self.database
        );
        let result = self.execute_sql(&sql).await?;
        let qr = self.parse_result(result)?;
        Ok(qr
            .rows
            .iter()
            .map(|r| SchemaTable {
                schema: r.get(0).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                table: r.get(1).and_then(|v| v.as_str()).unwrap_or("").to_string(),
            })
            .collect())
    }

    pub async fn get_columns(
        &self,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnInfo>, DbError> {
        let sql = format!(
            "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM {}.INFORMATION_SCHEMA.COLUMNS \
             WHERE TABLE_SCHEMA = '{}' AND TABLE_NAME = '{}' ORDER BY ORDINAL_POSITION",
            self.database, schema, table
        );
        let result = self.execute_sql(&sql).await?;
        let qr = self.parse_result(result)?;
        Ok(qr
            .rows
            .iter()
            .map(|r| ColumnInfo {
                name: r.get(0).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                data_type: r.get(1).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                nullable: r.get(2).and_then(|v| v.as_str()).unwrap_or("YES") == "YES",
            })
            .collect())
    }

    pub async fn run_query(&self, sql: &str) -> Result<QueryResult, DbError> {
        let result = self.execute_sql(sql).await?;
        self.parse_result(result)
    }
}
