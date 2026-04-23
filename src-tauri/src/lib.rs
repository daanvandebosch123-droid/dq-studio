mod db;
mod persistence;
mod state;
mod commands;

<<<<<<< HEAD
use commands::config::ConfigState;
=======
>>>>>>> origin/main
use commands::rules::{RulesState, ResultsState, ResultsHistoryState};
use commands::profiling::ProfilingState;
use commands::scheduler::SchedulerState;
use state::AppState;
<<<<<<< HEAD
use tauri::{Manager, Emitter};
=======
use tauri::Manager;
>>>>>>> origin/main

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
<<<<<<< HEAD
            let default_data_dir = app.path().app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&default_data_dir)?;

            let config_state = ConfigState::new(default_data_dir);
            let data_dir = config_state.effective_data_dir();
            std::fs::create_dir_all(&data_dir)?;

            app.manage(config_state);
=======
            let data_dir = app.path().app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir)?;
>>>>>>> origin/main
            app.manage(AppState::new(&data_dir));
            app.manage(RulesState::new(&data_dir));
            app.manage(ResultsState::new(&data_dir));
            app.manage(ResultsHistoryState::new(&data_dir));
            app.manage(ProfilingState::new(&data_dir));
            app.manage(SchedulerState::new(&data_dir));
<<<<<<< HEAD

            // Watch the data directory and emit events when JSON files change.
            let app_handle = app.handle().clone();
            let watch_dir = data_dir.clone();
            std::thread::spawn(move || {
                use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
                let (tx, rx) = std::sync::mpsc::channel();
                let Ok(mut watcher) = RecommendedWatcher::new(tx, Config::default()) else { return; };
                if watcher.watch(&watch_dir, RecursiveMode::NonRecursive).is_err() { return; }
                let mut last: std::collections::HashMap<String, std::time::Instant> = Default::default();
                for res in rx {
                    let Ok(event) = res else { continue };
                    for path in &event.paths {
                        let Some(name) = path.file_name().and_then(|n| n.to_str()) else { continue };
                        let event_name = match name {
                            "connections.json"    => "connections://changed",
                            "rules.json"          => "rules://changed",
                            "results.json"
                            | "results_history.json" => "results://changed",
                            "schedules.json"      => "schedules://changed",
                            "profiling_runs.json" => "profiling://changed",
                            _ => continue,
                        };
                        let now = std::time::Instant::now();
                        let debounced = last.get(event_name)
                            .map(|t| now.duration_since(*t).as_millis() < 300)
                            .unwrap_or(false);
                        if !debounced {
                            last.insert(event_name.to_string(), now);
                            app_handle.emit(event_name, ()).ok();
                        }
                    }
                }
                drop(watcher);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::get_settings,
            commands::config::set_data_dir,
            commands::config::pick_directory,
=======
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
>>>>>>> origin/main
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
            commands::rules::get_results_history,
            commands::rules::clear_results_history,
            commands::rules::run_query_preview,
            commands::scheduler::list_schedules,
            commands::scheduler::save_schedule,
            commands::scheduler::delete_schedule,
            commands::scheduler::get_due_schedules,
            commands::scheduler::mark_schedule_ran,
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
