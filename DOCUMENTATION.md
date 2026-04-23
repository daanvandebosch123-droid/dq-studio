# DQ Studio — Application Documentation

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Application Architecture](#4-application-architecture)
   - 4.1 [Tauri App Setup (lib.rs)](#41-tauri-app-setup-librs)
   - 4.2 [Application State](#42-application-state)
   - 4.3 [Persistence Layer](#43-persistence-layer)
   - 4.4 [Command Handlers](#44-command-handlers)
   - 4.5 [Database Driver Layer](#45-database-driver-layer)
5. [Data Models](#5-data-models)
6. [Key Data Flows](#6-key-data-flows)
   - 6.1 [Add / Test a Connection](#61-add--test-a-connection)
   - 6.2 [Run a Data Quality Rule](#62-run-a-data-quality-rule)
   - 6.3 [Profile a Table](#63-profile-a-table)
   - 6.4 [Scheduler Execution](#64-scheduler-execution)
7. [Rule Types & SQL Generation](#7-rule-types--sql-generation)
8. [Supported Databases](#8-supported-databases)
9. [Persistence & File Layout](#9-persistence--file-layout)
10. [Configuration Files](#10-configuration-files)
11. [Security Considerations](#11-security-considerations)

---

## 1. Overview

**DQ Studio** is a desktop application for **data quality validation and table profiling** across multiple database platforms. It is built as a local-first desktop app using Tauri + Rust — there is no remote server. All data (connections, rules, results, schedules) is stored in JSON files on the user's machine.

**Core capabilities:**

| Capability | Description |
|---|---|
| Connection management | Add, test, and remove connections to SQL Server, Oracle, Snowflake, DB2, CSV, or Excel |
| Data quality rules | Define and run 8 types of rules (null check, uniqueness, range, regex, custom SQL, etc.) |
| Results & history | View pass/fail per rule run; drill into failing rows |
| Table profiling | Analyze columns for row counts, null %, distinct values, min/max |
| Scheduling | Run rule sets on a recurring schedule (daily, weekly, etc.) |

---

## 2. Technology Stack

| Component | Technology | Version |
|---|---|---|
| Desktop framework | Tauri | 2.0 |
| Backend language | Rust | Edition 2021 |
| Async runtime | Tokio | 1 |
| SQL Server driver | tiberius | — |
| Oracle driver | oracle | — |
| Snowflake driver | reqwest (HTTP REST) | — |
| DB2 driver | odbc-api | — |
| CSV parsing | csv | — |
| Excel parsing | calamine | — |
| In-memory SQL (files) | rusqlite | — |
| Serialization | serde / serde_json | 1 |
| Date/time | chrono | 0.4 |
| ID generation | uuid (v4) | — |

---

## 3. Project Structure

```
src-tauri/
├── Cargo.toml              # Rust dependencies and crate targets
├── tauri.conf.json         # Tauri app configuration
└── src/
    ├── main.rs             # Binary entry point (delegates to lib.rs)
    ├── lib.rs              # Tauri app builder + command registration
    ├── state.rs            # Shared mutable state definitions
    ├── persistence.rs      # JSON load/save helpers
    ├── commands/
    │   ├── connections.rs  # Add/remove/test connections
    │   ├── schema.rs       # List databases, tables, columns
    │   ├── rules.rs        # Save/delete/run rules, trace failures
    │   ├── profiling.rs    # Profile tables, history
    │   └── scheduler.rs    # Create/run/delete schedules
    └── db/
        ├── mod.rs          # Shared types + error definitions
        ├── sqlserver.rs    # SQL Server driver
        ├── oracle.rs       # Oracle driver
        ├── snowflake.rs    # Snowflake REST API driver
        ├── db2.rs          # DB2 ODBC driver
        └── files.rs        # CSV / Excel → in-memory SQLite
```

---

## 4. Application Architecture

### 4.1 Tauri App Setup (`lib.rs`)

`lib.rs` is the Rust library crate entry point. It:

1. Initializes all state structs (wrapped in `Mutex` inside Tauri's managed state).
2. Loads persisted data from JSON files on startup via `persistence::load_*` helpers.
3. Registers every command handler with `.invoke_handler(tauri::generate_handler![...])`.
4. Builds and runs the Tauri app.

### 4.2 Application State

State is held in `src-tauri/src/state.rs`. Each domain area has its own state struct, all wrapped in `Mutex<T>` and registered with Tauri's state manager:

```rust
pub struct AppState {
    pub connections: Mutex<HashMap<String, ConnectionInfo>>,
}

pub struct RulesState {
    pub rules: Mutex<HashMap<String, Rule>>,
}

pub struct ResultsState {
    pub results: Mutex<Vec<RuleResult>>,    // latest batch
}

pub struct ResultsHistoryState {
    pub history: Mutex<Vec<RuleRunRecord>>, // all batches
}

pub struct ProfilingState {
    pub runs: Mutex<Vec<ProfilingRun>>,
}

pub struct SchedulerState {
    pub schedules: Mutex<Vec<Schedule>>,
}
```

Command handlers receive state via Tauri's dependency injection: `State<'_, AppState>`.

### 4.3 Persistence Layer

`src-tauri/src/persistence.rs` provides generic load/save helpers:

```rust
pub fn load_json<T: DeserializeOwned>(path: &Path) -> T
pub fn save_json<T: Serialize>(path: &Path, data: &T)
```

JSON files are stored in the platform app data directory:
- **Windows:** `%APPDATA%\dq-studio\`
- **macOS:** `~/Library/Application Support/dq-studio/`
- **Linux:** `~/.config/dq-studio/`

Files written: `connections.json`, `rules.json`, `results.json`, `results_history.json`, `profiling_runs.json`, `schedules.json`.

Every mutating command locks the relevant state `Mutex`, applies the change in memory, then immediately writes the updated state to disk.

### 4.4 Command Handlers

Commands are Tauri IPC endpoints — callable from the UI layer via `invoke()`. They are organized into five modules under `src-tauri/src/commands/`.

#### `commands/connections.rs`

| Command | Signature | Description |
|---|---|---|
| `test_connection` | `(config: ConnectionConfig) → Result<()>` | Opens and closes a connection to validate credentials |
| `add_connection` | `(name: String, config: ConnectionConfig) → Result<String>` | Generates UUID, inserts into state, persists |
| `remove_connection` | `(id: String) → Result<()>` | Removes from state, persists |
| `list_connections` | `() → Result<Vec<ConnectionInfo>>` | Returns all stored connections |

#### `commands/schema.rs`

| Command | Description |
|---|---|
| `list_databases` | Calls driver-specific function to list databases or schemas |
| `get_tables` | Lists tables in a given schema for a connection |
| `get_columns` | Lists column names and data types for a table |

Each command looks up the connection by ID from `AppState`, then delegates to the matching driver module.

#### `commands/rules.rs`

| Command | Description |
|---|---|
| `save_rule` | Upserts a rule (creates UUID if new, updates if ID present) |
| `delete_rule` | Removes rule by ID |
| `list_rules` | Returns all rules |
| `run_rule` | Executes a single rule; stores result |
| `run_all_rules` | Runs all rules as a single batch; creates a `RuleRunRecord` |
| `trace_failing_rows` | Re-runs the failing condition SQL and returns actual rows |

`run_rule` internal flow:
1. Load `Rule` from `RulesState`.
2. Load `ConnectionInfo` from `AppState`.
3. Detect database dialect from `ConnectionConfig` variant.
4. Call `build_rule_sql(rule.definition, dialect)` to generate dialect-specific SQL.
5. Execute via the matching driver.
6. Parse `failing_count` and `total_count` from the result.
7. Store `RuleResult` in `ResultsState` and append to `ResultsHistoryState`.

#### `commands/profiling.rs`

| Command | Description |
|---|---|
| `profile_table` | Runs per-column analytics queries against a table |
| `list_profiling_runs` | Returns all stored `ProfilingRun` records |

For each column in the target table, the profiling command executes:
- `COUNT(*)` for total rows
- `COUNT(*) - COUNT(col)` for null count
- `COUNT(DISTINCT col)` for distinct count
- `MIN(col)` and `MAX(col)` for range

Results are aggregated into a `ProfilingRun` struct and persisted.

#### `commands/scheduler.rs`

| Command | Description |
|---|---|
| `save_schedule` | Upserts a schedule; computes `next_run_at` |
| `delete_schedule` | Removes a schedule by ID |
| `list_schedules` | Returns all schedules |
| `get_due_schedules` | Returns schedules whose `next_run_at` ≤ now |
| `mark_schedule_ran` | Updates `last_ran_at` and recomputes `next_run_at` |

`compute_next_run(recurrence, from: DateTime)` calculates the next execution time:
- `Once` — fixed datetime (no recurrence)
- `Daily` — `from + 1 day`
- `Weekly` — `from + 7 days`
- `Monthly` — `from + 1 month` (using chrono's month arithmetic)

### 4.5 Database Driver Layer

All drivers live in `src-tauri/src/db/` and implement the same conceptual interface:

```rust
async fn connect(config: &ConnectionConfig) -> Result<DriverHandle>
async fn get_tables(conn: &DriverHandle, schema: &str) -> Result<Vec<String>>
async fn get_columns(conn: &DriverHandle, schema: &str, table: &str) -> Result<Vec<ColumnInfo>>
async fn run_query(conn: &DriverHandle, sql: &str) -> Result<QueryResult>
```

#### SQL Server (`sqlserver.rs`)

- Uses the `tiberius` async crate over TCP.
- Connection string built from host, port, username, password, database.
- `trust_cert` flag controls TLS certificate validation (useful for local dev environments).
- Dialect: uses `SELECT TOP N` for row limiting.

#### Oracle (`oracle.rs`)

- Uses the `oracle` crate (synchronous; wrapped in `tokio::task::spawn_blocking`).
- Connects via Easy Connect string: `//host:port/service_name`.
- Dialect: uses `ROWNUM <= N` for row limiting.

#### Snowflake (`snowflake.rs`)

- No native Rust driver available; uses the Snowflake SQL REST API via `reqwest`.
- Authentication: username/password posted to the `/api/v2/statements` endpoint.
- Warehouse and schema are set as session parameters in each request.
- Dialect: uses `LIMIT N` for row limiting.

#### DB2 (`db2.rs`)

- Uses `odbc-api` which requires an ODBC driver manager and a configured DSN on the host OS.
- Connection via DSN string with username/password.
- Dialect: uses `FETCH FIRST N ROWS ONLY` for row limiting.

#### Files — CSV / Excel (`files.rs`)

- CSV files: parsed with the `csv` crate into rows.
- Excel files: parsed with `calamine`; user specifies which sheet to read.
- Data is loaded into an **in-memory SQLite database** (via `rusqlite`).
- Subsequent queries are executed against this in-memory SQLite instance.
- This approach allows all rule types (including `CustomSql`) to work against flat files using standard SQL.

---

## 5. Data Models

### ConnectionInfo

```rust
pub struct ConnectionInfo {
    pub id: String,          // UUID v4
    pub name: String,        // User-defined label
    pub config: ConnectionConfig,
}
```

### ConnectionConfig (enum)

```rust
pub enum ConnectionConfig {
    SqlServer { host, port, username, password, database, trust_cert },
    Oracle    { host, port, username, password, service_name },
    Snowflake { account, username, password, warehouse, database, schema },
    Db2       { dsn, username, password },
    Csv       { path },
    Excel     { path, sheet },
}
```

### Rule

```rust
pub struct Rule {
    pub id: String,
    pub name: String,
    pub connection_id: String,
    pub schema: String,
    pub table: String,
    pub group: Option<String>,
    pub definition: RuleDefinition,
}
```

### RuleDefinition (8 variants)

| Variant | Parameters | What it checks |
|---|---|---|
| `NotNull` | `column` | No NULL values in the column |
| `Unique` | `column` | No duplicate values in the column |
| `MinValue` | `column`, `min` | All values ≥ min |
| `MaxValue` | `column`, `max` | All values ≤ max |
| `Regex` | `column`, `pattern` | All values match the regex pattern |
| `CustomSql` | `sql` | Custom SQL returns 0 rows (0 = pass) |
| `RowCount` | `min_rows`, `max_rows?` | Table row count is within range |
| `ReferentialIntegrity` | `column`, `ref_connection_id`, `ref_table`, `ref_column` | All values exist in reference table |

### RuleResult

```rust
pub struct RuleResult {
    pub rule_id: String,
    pub rule_name: String,
    pub passed: bool,
    pub failing_count: i64,
    pub total_count: i64,
    pub ran_at: DateTime<Utc>,
    pub batch_id: String,
}
```

### ProfilingRun

```rust
pub struct ProfilingRun {
    pub id: String,
    pub connection_id: String,
    pub schema: String,
    pub table: String,
    pub ran_at: DateTime<Utc>,
    pub columns: Vec<ColumnProfile>,
}

pub struct ColumnProfile {
    pub column_name: String,
    pub data_type: String,
    pub row_count: i64,
    pub null_count: i64,
    pub distinct_count: i64,
    pub min_value: Option<String>,
    pub max_value: Option<String>,
}
```

### Schedule

```rust
pub struct Schedule {
    pub id: String,
    pub name: String,
    pub target: ScheduleTarget,   // AllRules | Group(String) | Rules(Vec<String>)
    pub recurrence: Recurrence,   // Once | Daily | Weekly | Monthly
    pub enabled: bool,
    pub last_ran_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
}
```

---

## 6. Key Data Flows

### 6.1 Add / Test a Connection

```
invoke("test_connection", { config })
      │
      ▼
commands::connections::test_connection(config)
      │
      ├─ SqlServer → tiberius::Client::connect(...)
      ├─ Oracle    → oracle::Connection::connect(...)
      ├─ Snowflake → reqwest POST /api/v2/statements
      ├─ Db2       → odbc_api::Environment::connect(...)
      └─ Csv/Excel → parse file + load into SQLite
      │
      ▼
Ok(()) or Err(message)

      │ (on success)
      ▼

invoke("add_connection", { name, config })
      │
      ▼
commands::connections::add_connection
      ├─ Generate UUID
      ├─ Lock AppState.connections Mutex
      ├─ Insert ConnectionInfo into HashMap
      └─ persistence::save_json("connections.json", ...)
      │
      ▼
Returns connection ID (String)
```

### 6.2 Run a Data Quality Rule

```
invoke("run_rule", { rule_id })
      │
      ▼
commands::rules::run_rule(rule_id, rules_state, app_state)
      │
      ├─ Lock RulesState → load Rule by rule_id
      ├─ Lock AppState   → load ConnectionInfo by rule.connection_id
      ├─ Detect dialect from ConnectionConfig variant
      │
      ├─ build_rule_sql(rule.definition, dialect)
      │     ├─ NotNull             → SELECT COUNT(*) ... WHERE col IS NULL
      │     ├─ Unique              → SELECT COUNT(*) ... WHERE col IN (GROUP BY HAVING COUNT > 1)
      │     ├─ MinValue            → SELECT COUNT(*) ... WHERE col < min
      │     ├─ MaxValue            → SELECT COUNT(*) ... WHERE col > max
      │     ├─ Regex               → dialect-specific REGEXP / REGEXP_LIKE
      │     ├─ CustomSql           → as-is (user-supplied SQL)
      │     ├─ RowCount            → SELECT COUNT(*) FROM table
      │     └─ ReferentialIntegrity → SELECT COUNT(*) ... WHERE col NOT IN (ref table)
      │
      ├─ Execute SQL via matching driver
      ├─ Parse failing_count, total_count from result set
      ├─ Build RuleResult { passed: failing_count == 0, ... }
      ├─ Lock ResultsState → update latest results
      └─ Lock ResultsHistoryState → append to batch history
      │
      ▼
Returns RuleResult
```

### 6.3 Profile a Table

```
invoke("profile_table", { connection_id, schema, table })
      │
      ▼
commands::profiling::profile_table(connection_id, schema, table, ...)
      │
      ├─ Lock AppState → load ConnectionInfo
      ├─ get_columns(conn, schema, table) → Vec<ColumnInfo>
      │
      └─ For each column:
            ├─ SELECT COUNT(*) AS total        FROM schema.table
            ├─ SELECT COUNT(*) - COUNT(col)    FROM schema.table  (null count)
            ├─ SELECT COUNT(DISTINCT col)      FROM schema.table
            └─ SELECT MIN(col), MAX(col)       FROM schema.table
      │
      ├─ Aggregate into Vec<ColumnProfile>
      ├─ Build ProfilingRun { id, connection_id, schema, table, ran_at, columns }
      ├─ Lock ProfilingState → append run
      └─ persistence::save_json("profiling_runs.json", ...)
      │
      ▼
Returns ProfilingRun
```

### 6.4 Scheduler Execution

The scheduler has no persistent background thread. The caller is responsible for polling and triggering execution:

```
invoke("get_due_schedules")
      │
      ▼
commands::scheduler::get_due_schedules(scheduler_state)
      │
      └─ Filter: schedule.enabled == true
                 && schedule.next_run_at <= Utc::now()
      │
      ▼
Returns Vec<Schedule>

      │ For each due schedule:
      ▼

invoke("run_all_rules", { rule_ids })
      │
      ▼
commands::rules::run_all_rules(...)
      ├─ Iterates over target rule IDs
      ├─ Calls run_rule logic for each
      └─ Groups results into a single RuleRunRecord batch

      │
      ▼

invoke("mark_schedule_ran", { schedule_id })
      │
      ▼
commands::scheduler::mark_schedule_ran(id, scheduler_state)
      ├─ Set last_ran_at = Utc::now()
      ├─ Recompute next_run_at via compute_next_run(recurrence, now)
      └─ persistence::save_json("schedules.json", ...)
```

---

## 7. Rule Types & SQL Generation

Rules generate different SQL depending on both the rule type and the target database dialect. Below are representative examples using SQL Server syntax.

### NotNull

```sql
SELECT COUNT(*) FROM [schema].[table] WHERE [column] IS NULL
```

### Unique

```sql
SELECT COUNT(*) FROM [schema].[table]
WHERE [column] IN (
  SELECT [column] FROM [schema].[table]
  GROUP BY [column]
  HAVING COUNT(*) > 1
)
```

### MinValue / MaxValue

```sql
-- MinValue
SELECT COUNT(*) FROM [schema].[table] WHERE [column] < {min}

-- MaxValue
SELECT COUNT(*) FROM [schema].[table] WHERE [column] > {max}
```

### Regex

SQL Server does not natively support regex; syntax varies per dialect:

| Dialect | Syntax |
|---|---|
| SQL Server | `WHERE [col] NOT LIKE {approximation}` (limited) |
| Oracle | `WHERE NOT REGEXP_LIKE([col], '{pattern}')` |
| Snowflake | `WHERE NOT REGEXP_LIKE([col], '{pattern}')` |
| DB2 | `WHERE REGEXP_LIKE([col], '{pattern}') = 0` |
| SQLite (files) | `WHERE [col] NOT REGEXP '{pattern}'` |

### CustomSql

The SQL is executed as-is. Convention: the query must return a single integer representing the count of failing rows (0 = pass).

### RowCount

```sql
SELECT COUNT(*) FROM [schema].[table]
-- passes if result is between min_rows and max_rows
```

### ReferentialIntegrity

```sql
SELECT COUNT(*) FROM [schema].[table] t
WHERE t.[column] NOT IN (
  SELECT r.[ref_column] FROM [ref_schema].[ref_table] r
)
```

When the reference table is on a different connection, the Rust command fetches distinct reference values first, then builds an `IN (...)` list in memory.

---

## 8. Supported Databases

| Database | Connection params | Notes |
|---|---|---|
| **SQL Server** | host, port, username, password, database, trust_cert | `tiberius` async driver; pure-Rust TLS via `rustls` |
| **Oracle** | host, port, username, password, service_name | Synchronous `oracle` crate; runs in `spawn_blocking` thread pool |
| **Snowflake** | account, username, password, warehouse, database, schema | Uses Snowflake REST API; no binary driver required |
| **DB2** | DSN, username, password | Requires OS ODBC driver manager + pre-configured DSN |
| **CSV** | file path | Entire file loaded into in-memory SQLite at query time |
| **Excel** | file path, sheet name | Specific sheet read via `calamine`; loaded into in-memory SQLite |

---

## 9. Persistence & File Layout

All application data is persisted as plain JSON. The app data directory is resolved via Tauri's `app_data_dir()` API.

| File | Type | Content |
|---|---|---|
| `connections.json` | `HashMap<id, ConnectionInfo>` | All saved connections including credentials |
| `rules.json` | `HashMap<id, Rule>` | All rule definitions |
| `results.json` | `Vec<RuleResult>` | Most recent run batch results |
| `results_history.json` | `Vec<RuleRunRecord>` | All historical run batches |
| `profiling_runs.json` | `Vec<ProfilingRun>` | All profiling results |
| `schedules.json` | `Vec<Schedule>` | All schedules |

Data is loaded into memory once at startup. Every mutation writes the full file back to disk immediately — there is no write-ahead log and no transactions.

**Platform paths:**
- **Windows:** `%APPDATA%\dq-studio\`
- **macOS:** `~/Library/Application Support/dq-studio/`
- **Linux:** `~/.config/dq-studio/`

---

## 10. Configuration Files

### `tauri.conf.json`

```json
{
  "identifier": "com.daanv.dq-studio",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420"
  },
  "app": {
    "windows": [{ "width": 800, "height": 600 }]
  },
  "bundle": {
    "targets": "all"
  }
}
```

- `identifier` — reverse-domain app ID, used by the OS for app data directory naming.
- `bundle.targets: "all"` — produces `.msi` (Windows), `.dmg` (macOS), `.AppImage` (Linux).
- `devUrl` — Tauri dev mode loads the UI from this address; must match the Vite dev server port.

### `src-tauri/Cargo.toml`

Two crate targets:
- `[lib]` — the main library crate, imported by Tauri's build system.
- `[[bin]] name = "dq-studio"` — thin binary entry point that calls `lib::run()`.

Key dependency feature flags:
- `tiberius`: `rustls` feature — pure-Rust TLS, no OpenSSL system dependency.
- `tauri`: `shell-open` feature — allows opening URLs in the system browser.

---

## 11. Security Considerations

| Area | Current State | Risk |
|---|---|---|
| Credential storage | Plain JSON on disk, unencrypted | Anyone with filesystem access can read database passwords |
| SQL execution | Rules run driver-validated SQL; `CustomSql` accepts arbitrary SQL | A malicious rule could run destructive SQL against connected databases |
| Referential integrity (cross-connection) | Reference values fetched into memory, sent as `IN (...)` | Very large reference tables can exceed SQL `IN` clause limits or exhaust RAM |
| CSV / Excel file loading | Entire file loaded into in-memory SQLite | Large files exhaust RAM |
| Snowflake authentication | Username/password sent over HTTPS to Snowflake REST API | Standard HTTPS; credentials not cached beyond the request |
| DB2 DSN | Credentials stored in OS ODBC data source, outside the app's JSON | Access depends on OS-level ODBC DSN security |
| No app-level authentication | Single-user desktop app; no login screen | Not suitable for shared machines without OS access control |
