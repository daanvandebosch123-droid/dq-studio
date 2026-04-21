mod db;
mod persistence;
mod state;
mod commands;

use commands::rules::{RulesState, ResultsState};
use commands::profiling::ProfilingState;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir)?;
            app.manage(AppState::new(&data_dir));
            app.manage(RulesState::new(&data_dir));
            app.manage(ResultsState::new(&data_dir));
            app.manage(ProfilingState::new(&data_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connections::list_databases,
            commands::connections::pick_file,
            commands::connections::add_connection,
            commands::connections::update_connection,
            commands::connections::remove_connection,
            commands::connections::list_connections,
            commands::connections::test_connection,
            commands::schema::get_tables,
            commands::schema::get_columns,
            commands::rules::save_rule,
            commands::rules::delete_rule,
            commands::rules::list_rules,
            commands::rules::run_rule,
            commands::rules::run_all_rules,
            commands::rules::get_failing_rows,
            commands::rules::get_last_results,
            commands::rules::run_query_preview,
            commands::profiling::profile_table,
            commands::profiling::sample_table,
            commands::profiling::list_profiling_runs,
            commands::profiling::save_profiling_run,
            commands::profiling::delete_profiling_run,
            commands::profiling::clear_profiling_runs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
