use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub data_dir: Option<String>,
}

pub struct ConfigState {
    pub config: std::sync::Mutex<AppConfig>,
    /// Fixed location — always the Tauri default app-data dir regardless of the active data dir.
    pub config_path: PathBuf,
    pub default_data_dir: PathBuf,
}

impl ConfigState {
    pub fn new(default_data_dir: PathBuf) -> Self {
        let config_path = default_data_dir.join("app_config.json");
        let config = crate::persistence::load::<AppConfig>(&config_path).unwrap_or_default();
        Self { config: std::sync::Mutex::new(config), config_path, default_data_dir }
    }

    /// Returns the active data directory: custom path if set and exists, otherwise the default.
    pub fn effective_data_dir(&self) -> PathBuf {
        let config = self.config.lock().unwrap();
        if let Some(ref custom) = config.data_dir {
            let p = PathBuf::from(custom);
            if p.exists() {
                return p;
            }
        }
        self.default_data_dir.clone()
    }
}

#[derive(Serialize)]
pub struct SettingsInfo {
    pub data_dir: String,
    pub default_data_dir: String,
    pub is_custom: bool,
}

#[tauri::command]
pub fn get_settings(state: State<'_, ConfigState>) -> SettingsInfo {
    let config = state.config.lock().unwrap();
    let default = state.default_data_dir.to_string_lossy().to_string();
    let custom = config.data_dir.clone();
    SettingsInfo {
        data_dir: custom.clone().unwrap_or_else(|| default.clone()),
        default_data_dir: default,
        is_custom: custom.is_some(),
    }
}

#[tauri::command]
pub async fn set_data_dir(path: String, state: State<'_, ConfigState>) -> Result<(), String> {
    let default = state.default_data_dir.to_string_lossy().to_string();
    let config_to_save = {
        let mut config = state.config.lock().unwrap();
        config.data_dir = if path == default { None } else { Some(path) };
        config.clone()
    };
    crate::persistence::save(&state.config_path, &config_to_save)
}

#[tauri::command]
pub async fn pick_directory() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        Ok(rfd::FileDialog::new()
            .set_title("Select Data Directory")
            .pick_folder()
            .map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}
