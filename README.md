# DQ Studio

A desktop application for managing and monitoring data quality rules across multiple data sources.

Built with [Tauri 2](https://tauri.app/) (Rust backend) and React + TypeScript (frontend).

## Features

- **Connections** — connect to SQL Server, Oracle, Snowflake, IBM DB2, CSV files, and Excel files
- **Rules** — define data quality rules (not null, unique, min/max value, regex, row count, referential integrity, custom SQL) and organize them into groups
- **Results** — run rules individually or in bulk, view pass/fail outcomes, failure rates, and historical trends
- **Scheduler** — schedule rules to run automatically on a recurring basis (hourly, daily, weekly)
- **Profiling** — profile any table to get column-level statistics (row count, nulls, distinct values, min/max)
- **Settings** — configure a custom data directory (supports OneDrive and network locations for team sharing), toggle dark/light theme

## Live Sync

All data is stored as JSON files in a configurable directory. When the data directory is set to a shared location (OneDrive, network share), changes made by any team member are automatically detected and reflected in the running app without restarting.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 |
| Backend | Rust |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| DB drivers | tiberius (SQL Server), oracle, rusqlite, calamine, csv |

## Development

```bash
# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

Requires [Rust](https://rustup.rs/) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform.
