import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionConfig,
  ConnectionInfo,
  SchemaTable,
  ColumnInfo,
  QueryResult,
  Rule,
  RuleResult,
  RuleRunRecord,
  Schedule,
  ProfilingRun,
} from "./types";

export const api = {
  listDatabases: (credentials: unknown) =>
    invoke<string[]>("list_databases", { credentials }),

  pickFile: (title: string, extensions: string[]) =>
    invoke<string | null>("pick_file", { title, extensions }),

  addConnection: (name: string, config: ConnectionConfig) =>
    invoke<string>("add_connection", { name, config }),

  updateConnection: (id: string, name: string, config: ConnectionConfig) =>
    invoke<void>("update_connection", { id, name, config }),

  removeConnection: (id: string) =>
    invoke<void>("remove_connection", { id }),

  listConnections: () =>
    invoke<ConnectionInfo[]>("list_connections"),

  testConnection: (config: ConnectionConfig) =>
    invoke<string>("test_connection", { config }),

  getTables: (connectionId: string) =>
    invoke<SchemaTable[]>("get_tables", { connectionId }),

  getColumns: (connectionId: string, schema: string, table: string) =>
    invoke<ColumnInfo[]>("get_columns", { connectionId, schema, table }),

  saveRule: (rule: Rule) =>
    invoke<string>("save_rule", { rule }),

  deleteRule: (id: string) =>
    invoke<void>("delete_rule", { id }),

  listRules: () =>
    invoke<Rule[]>("list_rules"),

  runRule: (ruleId: string, batchId?: string) =>
    invoke<RuleResult>("run_rule", { ruleId, batchId }),

  runAllRules: () =>
    invoke<RuleResult[]>("run_all_rules"),

  getFailingRows: (ruleId: string) =>
    invoke<QueryResult>("get_failing_rows", { ruleId }),

  getLastResults: () =>
    invoke<RuleResult[]>("get_last_results"),

  getResultsHistory: () =>
    invoke<RuleRunRecord[]>("get_results_history"),

  clearResultsHistory: () =>
    invoke<void>("clear_results_history"),

  listSchedules: () =>
    invoke<Schedule[]>("list_schedules"),

  saveSchedule: (schedule: Schedule) =>
    invoke<string>("save_schedule", { schedule }),

  deleteSchedule: (id: string) =>
    invoke<void>("delete_schedule", { id }),

  getDueSchedules: () =>
    invoke<Schedule[]>("get_due_schedules"),

  markScheduleRan: (id: string) =>
    invoke<Schedule>("mark_schedule_ran", { id }),

  runQueryPreview: (connectionId: string, sql: string) =>
    invoke<QueryResult>("run_query_preview", { connectionId, sql }),

  profileTable: (connectionId: string, schema: string, table: string) =>
    invoke<ProfilingRun>("profile_table", { connectionId, schema, table }),

  sampleTable: (connectionId: string, schema: string, table: string, limit: number) =>
    invoke<QueryResult>("sample_table", { connectionId, schema, table, limit }),

  listProfilingRuns: () =>
    invoke<ProfilingRun[]>("list_profiling_runs"),

  saveProfilingRun: (run: ProfilingRun) =>
    invoke<void>("save_profiling_run", { run }),

  deleteProfilingRun: (id: string) =>
    invoke<void>("delete_profiling_run", { id }),

  clearProfilingRuns: () =>
    invoke<void>("clear_profiling_runs"),

  getSettings: () =>
    invoke<{ data_dir: string; default_data_dir: string; is_custom: boolean }>("get_settings"),

  setDataDir: (path: string) =>
    invoke<void>("set_data_dir", { path }),

  pickDirectory: () =>
    invoke<string | null>("pick_directory"),
};
