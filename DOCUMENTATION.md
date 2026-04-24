# DQ Studio — Application Documentation

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Application Architecture](#4-application-architecture)
   - 4.1 [Tauri App Setup (lib.rs)](#41-tauri-app-setup-librs)
   - 4.2 [Application State](#42-application-state)
   - 4.3 [Persistence Layer](#43-persistence-layer)
   - 4.4 [Live File Sync](#44-live-file-sync)
   - 4.5 [Command Handlers](#45-command-handlers)
   - 4.6 [Database Driver Layer](#46-database-driver-layer)
5. [Data Models](#5-data-models)
6. [Key Data Flows](#6-key-data-flows)
   - 6.1 [Add / Test a Connection](#61-add--test-a-connection)
   - 6.2 [Run a Data Quality Rule](#62-run-a-data-quality-rule)
   - 6.3 [Profile a Table](#63-profile-a-table)
   - 6.4 [Scheduler Execution](#64-scheduler-execution)
7. [Rule Types & SQL Generation](#7-rule-types--sql-generation)
8. [Supported Databases](#8-supported-databases)
9. [Persistence & File Layout](#9-persistence--file-layout)
10. [Configuration](#10-configuration)
11. [Security Considerations](#11-security-considerations)

---

## 1. Overview

**DQ Studio** is a desktop application for **data quality validation and table profiling** across multiple database platforms. It is built as a local-first desktop app using Tauri 2 + Rust — there is no remote server. All data (connections, rules, results, schedules) is stored in JSON files in a configurable directory.

**Core capabilities:**

| Capability | Description |
|---|---|
| Connection management | Add, test, and remove connections to SQL Server, Oracle, Snowflake, DB2, CSV, or Excel |
| Data quality rules | Define and run 8 types of rules (null check, uniqueness, range, regex, custom SQL, etc.) organized into groups |
| Results & history | View pass/fail per rule run, failure rates, trends, and drill into failing rows |
| Table profiling | Analyze columns for row counts, null %, distinct values, min/max |
| Scheduling | Run rule sets on a recurring schedule (hourly, daily, weekly) |
| Live sync | Changes to JSON files on disk (including by other users via shared/network locations) are detected and reflected automatically |
| Settings | Configurable data directory, dark/light theme |

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
| File system watching | notify | 6 |
| Serialization | serde / serde_json | 1 |
| Date/time | chrono | 0.4 |
| ID generation | uuid (v4) | — |
| Native file dialogs | rfd | — |

---

## 3. Project Structure

```
src-tauri/
├── Cargo.toml              # Rust dependencies and crate targets
├── tauri.conf.json         # Tauri app configuration
└── src/
    ├── main.rs             # Binary entry point (delegates to lib.rs)
    ├── lib.rs              # Tauri app builder, command registration, file watcher
    ├── state.rs            # AppState (connections)
    ├── persistence.rs      # Generic JSON load/save helpers
    ├── commands/
    │   ├── config.rs       # App settings: data directory, theme, file picker
    │   ├── connections.rs  # Add/remove/test connections
    │   ├── schema.rs       # List tables and columns
    │   ├── rules.rs        # Save/delete/run rules, results, history
    │   ├── profiling.rs    # Profile tables, history
    │   └── scheduler.rs    # Create/run/delete schedules
    └── db/
        ├── mod.rs          # Shared types (ConnectionConfig, QueryResult, etc.)
        ├── sqlserver.rs    # SQL Server driver (tiberius)
        ├── oracle.rs       # Oracle driver
        ├── snowflake.rs    # Snowflake REST API driver
        ├── db2.rs          # DB2 ODBC driver
        └── files.rs        # CSV / Excel → in-memory SQLite
```

---

## 4. Application Architecture

### 4.1 Tauri App Setup (`lib.rs`)

`lib.rs` is the Rust library crate entry point. The setup function:

1. Resolves the default data directory via Tauri's `app.path().app_data_dir()`.
2. Creates a `ConfigState` (from `commands/config.rs`) which loads `app_config.json` from the default directory. This config may point to a custom data directory.
3. Calls `config_state.effective_data_dir()` to get the active data path (custom if set and valid, otherwise default).
4. Initialises all other state structs with the effective data path.
5. Spawns a background thread running a `notify` file watcher on the data directory (see §4.4).
6. Registers all command handlers.

### 4.2 Application State

Each domain area has its own state struct, held in a `Mutex` and registered with Tauri's state manager. All state structs store `data_path` and implement `reload()` and `save()`:

```rust
// state.rs
pub struct AppState {
    pub connections: Mutex<HashMap<String, ConnectionInfo>>,
    pub data_path: PathBuf,
}

// commands/rules.rs
pub struct RulesState {
    pub rules: Mutex<HashMap<String, Rule>>,
    pub data_path: PathBuf,
}

pub struct ResultsState {
    pub results: Mutex<Vec<RuleResult>>,
    pub data_path: PathBuf,
}

pub struct ResultsHistoryState {
    pub records: Mutex<Vec<RuleRunRecord>>,
    pub data_path: PathBuf,
}

// commands/profiling.rs
pub struct ProfilingState {
    pub runs: Mutex<Vec<ProfilingRun>>,
    pub data_path: PathBuf,
}

// commands/scheduler.rs
pub struct SchedulerState {
    pub schedules: Mutex<Vec<Schedule>>,
    pub data_path: PathBuf,
}

// commands/config.rs
pub struct ConfigState {
    pub config: Mutex<AppConfig>,
    pub config_path: PathBuf,
    pub default_data_dir: PathBuf,
}
```

Every state struct has two key methods:
- `reload(&self)` — re-reads the JSON file from disk and replaces the in-memory cache. Called at the start of every `list_*` command so external edits are always reflected.
- `save(&self)` — serialises the current in-memory state and writes the JSON file to disk. Called after every mutating command.

Command handlers receive state via Tauri's dependency injection: `State<'_, RulesState>`.

### 4.3 Persistence Layer

`src-tauri/src/persistence.rs` provides generic helpers:

```rust
pub fn load<T: DeserializeOwned>(path: &PathBuf) -> Option<T>
pub fn save<T: Serialize>(path: &PathBuf, data: &T) -> Result<(), String>
```

`load` returns `None` if the file does not exist or fails to parse — callers fall back to `unwrap_or_default()`. `save` creates parent directories if missing before writing.

### 4.4 Live File Sync

A background thread spawned in `lib.rs` watches the data directory for file changes using the `notify` crate:

```
File change on disk
      │
      ▼
notify::RecommendedWatcher (background thread)
      │  debounce: 300ms per event name
      ▼
match filename:
  "connections.json"                → emit "connections://changed"
  "rules.json"                      → emit "rules://changed"
  "results.json" / "results_history.json" → emit "results://changed"
  "schedules.json"                  → emit "schedules://changed"
  "profiling_runs.json"             → emit "profiling://changed"
      │
      ▼
Tauri event sent to frontend webview
      │
      ▼
Page listener (listen("rules://changed", ...)) calls load()
      │
      ▼
list_rules() → rules_state.reload() → reads rules.json from disk
      │
      ▼
UI updates with fresh data
```

This enables real-time collaboration: when the data directory is a shared location (OneDrive, network share), changes committed by any user are picked up automatically by all running instances without restarting.

The 300ms debounce prevents duplicate reloads from cloud sync clients that write files in multiple steps.

### 4.5 Command Handlers

Commands are Tauri IPC endpoints callable from the UI via `invoke()`. They are organised into six modules.

#### `commands/config.rs`

| Command | Description |
|---|---|
| `get_settings` | Returns `{ data_dir, default_data_dir, is_custom }` |
| `set_data_dir(path)` | Saves a custom data directory path to `app_config.json`; takes effect on next restart |
| `pick_directory()` | Opens a native OS folder picker dialog (via `rfd`); returns selected path or null |

`AppConfig` is stored in the **default** app data directory (not the custom one), so its location is always known regardless of what the user configures.

`effective_data_dir()` returns the custom path if it is set and the directory exists, otherwise the default.

#### `commands/connections.rs`

| Command | Description |
|---|---|
| `test_connection(config)` | Opens and closes a connection to validate credentials |
| `add_connection(name, config)` | Generates UUID, inserts into state, persists |
| `update_connection(id, name, config)` | Replaces connection in state, persists |
| `remove_connection(id)` | Removes from state, persists |
| `list_connections()` | Calls `reload()`, returns all connections |
| `pick_file(title, extensions)` | Opens a native file picker; returns selected path |

#### `commands/schema.rs`

| Command | Description |
|---|---|
| `get_tables(connection_id)` | Lists tables/sheets for a connection |
| `get_columns(connection_id, schema, table)` | Lists column names and data types |

Each command looks up the connection by ID from `AppState`, then delegates to the matching driver module.

#### `commands/rules.rs`

| Command | Description |
|---|---|
| `save_rule(rule)` | Upserts a rule (creates UUID if new) |
| `delete_rule(id)` | Removes rule by ID |
| `list_rules()` | Calls `reload()`, returns all rules |
| `run_rule(rule_id, batch_id?)` | Executes a single rule; stores result in `ResultsState` and `ResultsHistoryState` |
| `run_all_rules()` | Runs all enabled rules as a batch |
| `get_failing_rows(rule_id)` | Re-runs the failing-rows SQL, returns up to 500 rows |
| `get_last_results()` | Calls `reload()`, returns latest result per rule |
| `get_results_history()` | Calls `reload()`, returns all historical run records |
| `clear_results_history()` | Clears history state and persists |
| `run_query_preview(connection_id, sql)` | Executes arbitrary SQL and returns results (used in rule builder) |

`run_rule` internal flow:
1. Load `Rule` from `RulesState`.
2. Load `ConnectionInfo` from `AppState`.
3. Detect database dialect from `ConnectionConfig` variant.
4. Call `build_rule_sql(rule.definition, dialect)` to generate dialect-specific SQL.
5. Execute via the matching driver.
6. Parse `failing_count` and `total_count` from the result set.
7. Store `RuleResult` in `ResultsState` and append `RuleRunRecord` to `ResultsHistoryState`.

#### `commands/profiling.rs`

| Command | Description |
|---|---|
| `profile_table(connection_id, schema, table)` | Runs column analytics; persists `ProfilingRun` |
| `sample_table(connection_id, schema, table, limit)` | Returns up to `limit` rows as a preview |
| `list_profiling_runs()` | Calls `reload()`, returns all runs (newest first) |
| `save_profiling_run(run)` | Persists a run record |
| `delete_profiling_run(id)` | Removes a run by ID |
| `clear_profiling_runs()` | Clears all profiling history |

Profiling runs a single combined SQL query per table that computes `COUNT(*)`, per-column null counts, distinct counts, and min/max in one pass. SQL Server special cases handle unsupported types (`text`, `ntext`, `image`, `xml`, etc.).

#### `commands/scheduler.rs`

| Command | Description |
|---|---|
| `save_schedule(schedule)` | Upserts a schedule; recomputes `next_run_at` |
| `delete_schedule(id)` | Removes a schedule by ID |
| `list_schedules()` | Calls `reload()`, returns all schedules |
| `get_due_schedules()` | Returns schedules with `enabled == true` and `next_run_at <= now` |
| `mark_schedule_ran(id)` | Updates `last_ran_at`, recomputes `next_run_at`, persists |

`compute_next_run(recurrence, now)` calculates the next execution time:
- `Once` — fixed datetime stored at creation time
- `Hourly` — next full hour after `now`
- `Daily` — specified HH:MM on today if still future, otherwise tomorrow
- `Weekly` — specified weekday + HH:MM; advances 7 days if the candidate is in the past

### 4.6 Database Driver Layer

All drivers live in `src-tauri/src/db/` and are invoked by command handlers.

#### SQL Server (`sqlserver.rs`)
- Uses the `tiberius` async crate over TCP.
- `trust_cert` flag controls TLS certificate validation (useful for local/dev environments).
- Identifier quoting: `[schema].[table]`
- Row limiting: `SELECT TOP N`

#### Oracle (`oracle.rs`)
- Uses the synchronous `oracle` crate; all calls wrapped in `tokio::task::spawn_blocking`.
- Connects via Easy Connect string: `//host:port/service_name`.
- Identifier quoting: `"schema"."table"`
- Row limiting: `WHERE ROWNUM <= N`

#### Snowflake (`snowflake.rs`)
- No native Rust driver; uses Snowflake SQL REST API via `reqwest`.
- Authentication: username/password posted to `/api/v2/statements`.
- Warehouse and schema set as session parameters per request.
- Identifier quoting: `"schema"."table"`
- Row limiting: `LIMIT N`

#### DB2 (`db2.rs`)
- Uses `odbc-api`; requires an ODBC driver manager and configured DSN on the host OS.
- All calls wrapped in `tokio::task::spawn_blocking`.
- Identifier quoting: `"schema"."table"`
- Row limiting: `FETCH FIRST N ROWS ONLY`

#### Files — CSV / Excel (`files.rs`)
- CSV: parsed with the `csv` crate into rows.
- Excel: parsed with `calamine`; the target sheet is selected by name.
- Data is loaded into an **in-memory SQLite database** (via `rusqlite`).
- Rule SQL is adapted for SQLite: quoted `"schema"."table"` references are rewritten to just `"table"` since SQLite has no schema concept.
- This approach allows all rule types (including `CustomSql`) to work against flat files using standard SQL.

---

## 5. Data Models

### ConnectionInfo

```rust
pub struct ConnectionInfo {
    pub id: String,           // UUID v4
    pub name: String,         // User-defined label
    pub config: ConnectionConfig,
}
```

### ConnectionConfig (enum)

```rust
pub enum ConnectionConfig {
    SqlServer { host, port, username, password, database, trust_cert },
    Oracle    { host, port, username, password, service_name },
    Snowflake { account, username, password, warehouse, database, schema },
    Db2       { host, port, database, username, password },
    Csv       { path },
    Excel     { path },
}
```

### Rule

```rust
pub struct Rule {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub connection_id: String,
    pub schema: String,
    pub table: String,
    pub group: Option<String>,
    pub definition: RuleDefinition,
    pub enabled: bool,
}
```

### RuleDefinition (8 variants)

| Variant | Parameters | What it checks |
|---|---|---|
| `NotNull` | `column` | No NULL values in the column |
| `Unique` | `column` | No duplicate values in the column |
| `MinValue` | `column`, `min: f64` | All values ≥ min |
| `MaxValue` | `column`, `max: f64` | All values ≤ max |
| `Regex` | `column`, `pattern` | All values match the pattern (SQL LIKE syntax) |
| `CustomSql` | `sql` | Custom SQL must return `failing_count` and `total_count` columns |
| `RowCount` | `min?: u64`, `max?: u64` | Table row count is within the specified range |
| `ReferentialIntegrity` | `column`, `ref_connection_id?`, `ref_schema`, `ref_table`, `ref_column` | All values exist in the reference column |

### RuleResult

```rust
pub struct RuleResult {
    pub rule_id: String,
    pub rule_name: String,
    pub passed: bool,
    pub failing_count: i64,
    pub total_count: i64,
    pub details: String,
    pub query_used: String,
}
```

### RuleRunRecord

```rust
pub struct RuleRunRecord {
    pub id: String,
    pub batch_id: String,
    pub ran_at: String,       // RFC 3339
    pub rule_id: String,
    pub rule_name: String,
    pub passed: bool,
    pub failing_count: i64,
    pub total_count: i64,
    pub details: String,
}
```

### ProfilingRun

```rust
pub struct ProfilingRun {
    pub id: String,
    pub connection_id: String,
    pub connection_name: String,
    pub schema: String,
    pub table: String,
    pub ran_at: String,
    pub profiles: Vec<ColumnProfile>,
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
    pub target: ScheduleTarget,  // All | Group(String) | Rules(Vec<String>)
    pub recurrence: Recurrence,  // Once | Hourly | Daily | Weekly
    pub enabled: bool,
    pub last_ran_at: Option<String>,
    pub next_run_at: String,
}
```

### AppConfig

```rust
pub struct AppConfig {
    pub data_dir: Option<String>,  // None = use default
}
```

Stored at the **default** app data path as `app_config.json`, independent of the configured data directory.

---

## 6. Key Data Flows

### 6.1 Add / Test a Connection

```
invoke("test_connection", { config })
      │
      ▼
commands::connections::test_connection(config)
      ├─ SqlServer → tiberius::Client::connect(...)
      ├─ Oracle    → oracle::Connection::connect(...)
      ├─ Snowflake → reqwest POST /api/v2/statements
      ├─ Db2       → odbc_api::Environment::connect(...)
      └─ Csv/Excel → file exists + parseable check
      │
      ▼
Ok("Connected successfully") or Err(message)

      │ (on success)
      ▼

invoke("add_connection", { name, config })
      │
      ▼
commands::connections::add_connection
      ├─ Generate UUID
      ├─ Lock AppState.connections Mutex
      ├─ Insert ConnectionInfo
      └─ state.save() → writes connections.json
      │
      ▼
Returns connection ID (String)
```

### 6.2 Run a Data Quality Rule

```
invoke("run_rule", { rule_id })
      │
      ▼
commands::rules::run_rule(rule_id, rules_state, app_state, ...)
      │
      ├─ rules_state.reload() → re-reads rules.json
      ├─ Load Rule by rule_id
      ├─ Load ConnectionInfo by rule.connection_id
      ├─ Detect DbKind from ConnectionConfig variant
      │
      ├─ build_rule_sql(rule.definition, db_kind)
      │     ├─ NotNull              → SELECT COUNT(*) ... WHERE col IS NULL
      │     ├─ Unique               → ... WHERE col IN (GROUP BY HAVING COUNT > 1)
      │     ├─ MinValue             → ... WHERE col < min
      │     ├─ MaxValue             → ... WHERE col > max
      │     ├─ Regex                → dialect-specific LIKE / REGEXP_LIKE
      │     ├─ CustomSql            → as-is
      │     ├─ RowCount             → SELECT COUNT(*) FROM table
      │     └─ ReferentialIntegrity → ... WHERE col NOT IN (ref table)
      │
      ├─ Execute SQL via matching driver
      ├─ Parse failing_count, total_count from QueryResult
      ├─ Build RuleResult { passed: failing_count == 0, ... }
      ├─ Lock ResultsState → upsert latest result
      └─ Lock ResultsHistoryState → append RuleRunRecord
      │
      ▼
Returns RuleResult
```

### 6.3 Profile a Table

```
invoke("profile_table", { connection_id, schema, table })
      │
      ▼
commands::profiling::profile_table(...)
      │
      ├─ Load ConnectionInfo from AppState
      ├─ get_columns_for(config, schema, table) → Vec<ColumnInfo>
      │
      ├─ build_profile_sql(schema, table, columns, dialect)
      │     Single query: COUNT(*) + per-column null/distinct/min/max
      │
      ├─ Execute via matching driver → QueryResult
      ├─ Parse result columns into Vec<ColumnProfile>
      ├─ Build ProfilingRun { id, connection_id, schema, table, ran_at, profiles }
      ├─ Lock ProfilingState → append run
      └─ profiling_state.save() → writes profiling_runs.json
      │
      ▼
Returns ProfilingRun
```

### 6.4 Scheduler Execution

The scheduler has no persistent background thread in Rust. The frontend polls and triggers execution:

```
Frontend interval (every 60s):
      │
      ▼
invoke("get_due_schedules")
      │
      ▼
commands::scheduler::get_due_schedules
      └─ Filter: enabled == true && next_run_at <= now
      │
      ▼
Returns Vec<Schedule>

      │ For each due schedule:
      ▼
invoke("run_rule" | "run_all_rules", ...)  ← depends on schedule.target
      │
      ▼
invoke("mark_schedule_ran", { id })
      │
      ▼
commands::scheduler::mark_schedule_ran
      ├─ last_ran_at = now
      ├─ next_run_at = compute_next_run(recurrence, now)
      └─ scheduler_state.save()
```

---

## 7. Rule Types & SQL Generation

Rules generate different SQL depending on both the rule type and the target database dialect. Identifiers are always quoted using `quote_ident()`:

| Dialect | Quote style |
|---|---|
| SQL Server | `[name]` |
| Oracle / Snowflake / DB2 / File | `"name"` |

### NotNull

```sql
SELECT COUNT(*) AS failing_count, COUNT(*) AS total_count
FROM "schema"."table"
WHERE "column" IS NULL
```

### Unique

```sql
SELECT COUNT(*) AS failing_count, COUNT(*) AS total_count
FROM "schema"."table"
WHERE "column" IN (
  SELECT "column" FROM "schema"."table"
  GROUP BY "column" HAVING COUNT(*) > 1
)
```

### MinValue / MaxValue

```sql
SELECT COUNT(*) AS failing_count, COUNT(*) AS total_count
FROM "schema"."table" WHERE "column" < {min}
```

### Regex

Uses SQL LIKE pattern syntax (not regex):

```sql
SELECT COUNT(*) AS failing_count, COUNT(*) AS total_count
FROM "schema"."table"
WHERE "column" NOT LIKE '{pattern}'
```

### CustomSql

Executed as-is. Must return exactly two columns: `failing_count` and `total_count`.

### RowCount

```sql
SELECT COUNT(*) AS total_count FROM "schema"."table"
-- passes if result is between min and max (inclusive)
```

### ReferentialIntegrity

```sql
SELECT COUNT(*) AS failing_count, COUNT(*) AS total_count
FROM "schema"."table"
WHERE "column" NOT IN (
  SELECT "ref_column" FROM "ref_schema"."ref_table"
)
```

When source and reference are on **different connections**, the reference values are fetched first into a Rust `Vec`, then inlined into an `IN (...)` clause.

---

## 8. Supported Databases

| Database | Connection params | Notes |
|---|---|---|
| **SQL Server** | host, port, username, password, database, trust_cert | `tiberius` async driver; pure-Rust TLS via `rustls` |
| **Oracle** | host, port, username, password, service_name | Synchronous `oracle` crate; runs in `spawn_blocking` |
| **Snowflake** | account, username, password, warehouse, database, schema | Snowflake REST API; no binary driver required |
| **DB2** | host, port, database, username, password | Requires OS ODBC driver manager |
| **CSV** | file path | Entire file loaded into in-memory SQLite at query time |
| **Excel** | file path | All sheets available; each sheet is a table in in-memory SQLite |

---

## 9. Persistence & File Layout

All application data is stored as plain JSON files. The data directory is configurable (see §10); it defaults to the platform app data directory.

| File | Content |
|---|---|
| `connections.json` | `Vec<ConnectionInfo>` — all saved connections including credentials |
| `rules.json` | `Vec<Rule>` — all rule definitions |
| `results.json` | `Vec<RuleResult>` — most recent result per rule |
| `results_history.json` | `Vec<RuleRunRecord>` — all historical run records across all batches |
| `profiling_runs.json` | `Vec<ProfilingRun>` — all profiling results |
| `schedules.json` | `Vec<Schedule>` — all schedules |

Every `list_*` command calls `reload()` before returning, so the in-memory cache is always fresh from disk. Every mutating command writes the full file back to disk immediately after the change.

**Default platform paths:**
- **Windows:** `%APPDATA%\dq-studio\`
- **macOS:** `~/Library/Application Support/dq-studio/`
- **Linux:** `~/.config/dq-studio/`

---

## 10. Configuration

### App Config (`app_config.json`)

Stored at the **default** app data path, always. Contains:

```json
{ "data_dir": "/path/to/custom/dir" }
```

If `data_dir` is absent or the path doesn't exist, the default platform path is used.

### Custom Data Directory

The data directory can be changed in the Settings page. The new path is saved to `app_config.json` and takes effect on the next app restart. Data files are **not** moved automatically.

Setting the data directory to a **shared location** (OneDrive folder, network share, etc.) enables team use: multiple users can point to the same directory and changes made by one user are automatically reflected in others' running instances via the file watcher.

### `tauri.conf.json`

- `identifier: "com.daanv.dq-studio"` — reverse-domain app ID; determines default app data directory name on all platforms.
- `bundle.targets: "all"` — produces `.msi` (Windows), `.dmg` (macOS), `.AppImage` (Linux).
- `devUrl` — Tauri dev mode loads the UI from this address; must match the Vite dev server port (default: 1420).

### `Cargo.toml` highlights

- `tiberius`: `rustls` feature — pure-Rust TLS, no OpenSSL system dependency.
- `rusqlite`: `bundled` feature — SQLite compiled into the binary; no system SQLite required.
- `notify`: version 6 — cross-platform file system watcher for live sync.

---

## 11. Security Considerations

| Area | Current State | Risk |
|---|---|---|
| Credential storage | Plain JSON on disk, unencrypted | Anyone with filesystem access can read database passwords |
| Shared data directory | All JSON files including credentials are readable by anyone with access to that directory | Shared OneDrive/network locations expose credentials to all users with folder access |
| SQL execution | Rules run driver-validated SQL; `CustomSql` accepts arbitrary SQL | A malicious rule could run destructive SQL against connected databases |
| Referential integrity (cross-connection) | Reference values fetched into memory and inlined into `IN (...)` | Very large reference tables can exhaust RAM or exceed SQL `IN` clause limits |
| CSV / Excel file loading | Entire file loaded into in-memory SQLite | Large files can exhaust RAM |
| Snowflake authentication | Username/password sent over HTTPS to Snowflake REST API | Standard HTTPS; credentials not cached beyond the request |
| No app-level authentication | Single-user desktop app; no login screen | Not suitable for shared machines without OS-level access control |
