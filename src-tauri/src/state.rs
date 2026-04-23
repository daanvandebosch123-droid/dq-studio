use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use crate::db::ConnectionInfo;

pub struct AppState {
    pub connections: Mutex<HashMap<String, ConnectionInfo>>,
    pub data_path: PathBuf,
}

impl AppState {
    pub fn new(data_dir: &PathBuf) -> Self {
        let data_path = data_dir.join("connections.json");
        let connections = crate::persistence::load::<Vec<ConnectionInfo>>(&data_path)
            .unwrap_or_default()
            .into_iter()
            .map(|c| (c.id.clone(), c))
            .collect();
        Self { connections: Mutex::new(connections), data_path }
    }

<<<<<<< HEAD
    pub fn reload(&self) {
        let connections = crate::persistence::load::<Vec<ConnectionInfo>>(&self.data_path)
            .unwrap_or_default()
            .into_iter()
            .map(|c| (c.id.clone(), c))
            .collect();
        *self.connections.lock().unwrap() = connections;
    }

=======
>>>>>>> origin/main
    pub fn save(&self) -> Result<(), String> {
        let conns: Vec<ConnectionInfo> = self.connections.lock().unwrap().values().cloned().collect();
        crate::persistence::save(&self.data_path, &conns)
    }
}
