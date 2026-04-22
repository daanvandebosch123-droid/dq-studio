export type DbType = "sql_server" | "oracle" | "snowflake" | "db2" | "csv" | "excel";

export interface SqlServerConfig {
  type: "sql_server";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  trust_cert: boolean;
}

export interface OracleConfig {
  type: "oracle";
  host: string;
  port: number;
  service_name: string;
  username: string;
  password: string;
}

export interface SnowflakeConfig {
  type: "snowflake";
  account: string;
  warehouse: string;
  database: string;
  schema: string;
  username: string;
  password: string;
}

export interface Db2Config {
  type: "db2";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface CsvConfig {
  type: "csv";
  path: string;
}

export interface ExcelConfig {
  type: "excel";
  path: string;
}

export type ConnectionConfig = SqlServerConfig | OracleConfig | SnowflakeConfig | Db2Config | CsvConfig | ExcelConfig;

export interface ConnectionInfo {
  id: string;
  name: string;
  config: ConnectionConfig;
}

export interface SchemaTable {
  schema: string;
  table: string;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
}

export type RuleKind =
  | "not_null"
  | "unique"
  | "min_value"
  | "max_value"
  | "regex"
  | "custom_sql"
  | "row_count"
  | "referential_integrity";

export interface NotNullRule { kind: "not_null"; column: string }
export interface UniqueRule { kind: "unique"; column: string }
export interface MinValueRule { kind: "min_value"; column: string; min: number }
export interface MaxValueRule { kind: "max_value"; column: string; max: number }
export interface RegexRule { kind: "regex"; column: string; pattern: string }
export interface CustomSqlRule { kind: "custom_sql"; sql: string }
export interface RowCountRule { kind: "row_count"; min?: number; max?: number }
export interface ReferentialIntegrityRule { kind: "referential_integrity"; column: string; ref_connection_id?: string; ref_schema: string; ref_table: string; ref_column: string }

export type RuleDefinition =
  | NotNullRule
  | UniqueRule
  | MinValueRule
  | MaxValueRule
  | RegexRule
  | CustomSqlRule
  | RowCountRule
  | ReferentialIntegrityRule;

export interface Rule {
  id: string;
  name: string;
  connection_id: string;
  schema: string;
  table: string;
  definition: RuleDefinition;
  enabled: boolean;
  group?: string;
  description?: string;
}

export interface ColumnProfile {
  column_name: string;
  data_type: string;
  row_count: number;
  null_count: number;
  distinct_count: number;
  min_value: string | null;
  max_value: string | null;
}

export interface ProfilingRun {
  id: string;
  connection_id: string;
  connection_name: string;
  schema: string;
  table: string;
  ran_at: string;
  profiles: ColumnProfile[];
}

export interface RuleResult {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  failing_count: number;
  total_count: number;
  details: string;
  query_used: string;
}

export type ScheduleTarget =
  | { type: "all" }
  | { type: "group"; group: string }
  | { type: "rules"; rule_ids: string[] };

export type Recurrence =
  | { type: "once"; at: string }
  | { type: "hourly" }
  | { type: "daily"; time: string }
  | { type: "weekly"; day: number; time: string };

export interface Schedule {
  id: string;
  name: string;
  target: ScheduleTarget;
  recurrence: Recurrence;
  enabled: boolean;
  last_ran_at: string | null;
  next_run_at: string;
}

export interface RuleRunRecord {
  id: string;
  batch_id: string;
  ran_at: string;
  rule_id: string;
  rule_name: string;
  passed: boolean;
  failing_count: number;
  total_count: number;
  details: string;
}
