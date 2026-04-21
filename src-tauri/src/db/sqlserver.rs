use tiberius::{AuthMethod, Client, Config, Query};
use tokio::net::TcpStream;
use tokio_util::compat::{TokioAsyncWriteCompatExt, Compat};
use futures::TryStreamExt;
use super::{ColumnInfo, DbError, QueryResult, SchemaTable};

type SqlClient = Client<Compat<TcpStream>>;

pub async fn connect(
    host: &str,
    port: u16,
    database: &str,
    username: &str,
    password: &str,
    trust_cert: bool,
) -> Result<SqlClient, DbError> {
    let mut config = Config::new();
    config.host(host);
    config.port(port);
    config.database(database);
    config.authentication(AuthMethod::sql_server(username, password));
    if trust_cert {
        config.trust_cert();
    }
    let tcp = TcpStream::connect(config.get_addr()).await?;
    tcp.set_nodelay(true)?;
    let client = Client::connect(config, tcp.compat_write()).await?;
    Ok(client)
}

pub async fn get_tables(client: &mut SqlClient) -> Result<Vec<SchemaTable>, DbError> {
    let rows = client
        .query(
            "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES \
             WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME",
            &[],
        )
        .await?
        .into_first_result()
        .await?;

    Ok(rows
        .iter()
        .map(|r| SchemaTable {
            schema: r.get::<&str, _>(0).unwrap_or("").to_string(),
            table: r.get::<&str, _>(1).unwrap_or("").to_string(),
        })
        .collect())
}

pub async fn get_columns(
    client: &mut SqlClient,
    schema: &str,
    table: &str,
) -> Result<Vec<ColumnInfo>, DbError> {
    let mut q = Query::new(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS \
         WHERE TABLE_SCHEMA = @P1 AND TABLE_NAME = @P2 ORDER BY ORDINAL_POSITION",
    );
    q.bind(schema);
    q.bind(table);
    let rows = q.query(client).await?.into_first_result().await?;

    Ok(rows
        .iter()
        .map(|r| ColumnInfo {
            name: r.get::<&str, _>(0).unwrap_or("").to_string(),
            data_type: r.get::<&str, _>(1).unwrap_or("").to_string(),
            nullable: r.get::<&str, _>(2).unwrap_or("YES") == "YES",
        })
        .collect())
}

pub async fn run_query(
    client: &mut SqlClient,
    sql: &str,
) -> Result<QueryResult, DbError> {
    let mut stream = client.query(sql, &[]).await?;
    let mut columns: Vec<String> = Vec::new();
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();

    while let Some(item) = stream.try_next().await? {
        match item {
            tiberius::QueryItem::Metadata(meta) => {
                columns = meta.columns().iter().map(|c| c.name().to_string()).collect();
            }
            tiberius::QueryItem::Row(row) => {
                let mut values = Vec::new();
                for i in 0..columns.len() {
                    let val: serde_json::Value = match row.try_get::<i32, _>(i) {
                        Ok(Some(n)) => serde_json::json!(n),
                        _ => match row.try_get::<i64, _>(i) {
                            Ok(Some(n)) => serde_json::json!(n),
                            _ => match row.try_get::<f64, _>(i) {
                                Ok(Some(f)) => serde_json::json!(f),
                                _ => match row.try_get::<&str, _>(i) {
                                    Ok(Some(s)) => serde_json::Value::String(s.to_string()),
                                    _ => serde_json::Value::Null,
                                },
                            },
                        },
                    };
                    values.push(val);
                }
                rows.push(values);
            }
        }
    }

    let row_count = rows.len();
    Ok(QueryResult { columns, rows, row_count })
}

