use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
<<<<<<< HEAD
use chrono::{DateTime, Datelike, Duration, Local, NaiveDateTime, TimeZone, Timelike, Utc};
=======
use chrono::{Utc, DateTime, Timelike, Datelike, Duration};
>>>>>>> origin/main

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ScheduleTarget {
    All,
    Group { group: String },
    Rules { rule_ids: Vec<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Recurrence {
    Once { at: String },
    Hourly,
    Daily { time: String },
    Weekly { day: u8, time: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    pub id: String,
    pub name: String,
    pub target: ScheduleTarget,
    pub recurrence: Recurrence,
    pub enabled: bool,
    pub last_ran_at: Option<String>,
    pub next_run_at: String,
}

pub struct SchedulerState {
    pub schedules: std::sync::Mutex<Vec<Schedule>>,
    pub data_path: std::path::PathBuf,
}

impl SchedulerState {
    pub fn new(data_dir: &std::path::PathBuf) -> Self {
        let data_path = data_dir.join("schedules.json");
        let schedules = crate::persistence::load::<Vec<Schedule>>(&data_path).unwrap_or_default();
        Self { schedules: std::sync::Mutex::new(schedules), data_path }
    }

<<<<<<< HEAD
    pub fn reload(&self) {
        let schedules = crate::persistence::load::<Vec<Schedule>>(&self.data_path)
            .unwrap_or_default();
        *self.schedules.lock().unwrap() = schedules;
    }

=======
>>>>>>> origin/main
    pub fn save(&self) -> Result<(), String> {
        let schedules = self.schedules.lock().unwrap().clone();
        crate::persistence::save(&self.data_path, &schedules)
    }
}

fn parse_hhmm(time: &str) -> (u32, u32) {
    let mut parts = time.splitn(2, ':');
    let h = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let m = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    (h.min(23), m.min(59))
}

<<<<<<< HEAD
fn parse_schedule_datetime(value: &str) -> Option<DateTime<Local>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|dt| dt.with_timezone(&Local))
        .or_else(|| {
            NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M")
                .ok()
                .and_then(|naive| Local.from_local_datetime(&naive).single())
        })
}

fn format_local_datetime(dt: DateTime<Local>) -> String {
    dt.to_rfc3339()
}

pub fn compute_next_run(recurrence: &Recurrence, after: &DateTime<Local>) -> String {
    match recurrence {
        Recurrence::Once { at } => parse_schedule_datetime(at)
            .unwrap_or_else(|| after.to_owned())
            .to_rfc3339(),
=======
pub fn compute_next_run(recurrence: &Recurrence, after: &DateTime<Utc>) -> String {
    match recurrence {
        Recurrence::Once { at } => at.clone(),
>>>>>>> origin/main

        Recurrence::Hourly => {
            let next = after
                .with_minute(0).unwrap()
                .with_second(0).unwrap()
                .with_nanosecond(0).unwrap()
                + Duration::hours(1);
<<<<<<< HEAD
            format_local_datetime(next)
=======
            next.to_rfc3339()
>>>>>>> origin/main
        }

        Recurrence::Daily { time } => {
            let (h, m) = parse_hhmm(time);
            let today = after.date_naive()
                .and_hms_opt(h, m, 0).unwrap()
<<<<<<< HEAD
                .and_local_timezone(Local)
                .single()
                .unwrap();
            if today > *after { format_local_datetime(today) }
            else { format_local_datetime(today + Duration::days(1)) }
=======
                .and_utc();
            if today > *after { today.to_rfc3339() }
            else { (today + Duration::days(1)).to_rfc3339() }
>>>>>>> origin/main
        }

        Recurrence::Weekly { day, time } => {
            let (h, m) = parse_hhmm(time);
            let target_day = (*day as i64).min(6);
            let current_day = after.weekday().num_days_from_monday() as i64;
            let mut days_ahead = (target_day - current_day).rem_euclid(7);
            let candidate = (after.date_naive() + Duration::days(days_ahead))
                .and_hms_opt(h, m, 0).unwrap()
<<<<<<< HEAD
                .and_local_timezone(Local)
                .single()
                .unwrap();
=======
                .and_utc();
>>>>>>> origin/main
            if candidate <= *after {
                days_ahead += 7;
                let next = (after.date_naive() + Duration::days(days_ahead))
                    .and_hms_opt(h, m, 0).unwrap()
<<<<<<< HEAD
                    .and_local_timezone(Local)
                    .single()
                    .unwrap();
                format_local_datetime(next)
            } else {
                format_local_datetime(candidate)
=======
                    .and_utc();
                next.to_rfc3339()
            } else {
                candidate.to_rfc3339()
>>>>>>> origin/main
            }
        }
    }
}

#[tauri::command]
pub async fn list_schedules(
    state: State<'_, SchedulerState>,
) -> Result<Vec<Schedule>, String> {
<<<<<<< HEAD
    state.reload();
=======
>>>>>>> origin/main
    Ok(state.schedules.lock().unwrap().clone())
}

#[tauri::command]
pub async fn save_schedule(
    mut schedule: Schedule,
    state: State<'_, SchedulerState>,
) -> Result<String, String> {
    if schedule.id.is_empty() {
        schedule.id = Uuid::new_v4().to_string();
    }
<<<<<<< HEAD
    schedule.next_run_at = compute_next_run(&schedule.recurrence, &Local::now());
=======
    schedule.next_run_at = compute_next_run(&schedule.recurrence, &Utc::now());
>>>>>>> origin/main
    let id = schedule.id.clone();
    let mut schedules = state.schedules.lock().unwrap();
    if let Some(pos) = schedules.iter().position(|s| s.id == id) {
        schedules[pos] = schedule;
    } else {
        schedules.push(schedule);
    }
    drop(schedules);
    state.save()?;
    Ok(id)
}

#[tauri::command]
pub async fn delete_schedule(
    id: String,
    state: State<'_, SchedulerState>,
) -> Result<(), String> {
    state.schedules.lock().unwrap().retain(|s| s.id != id);
    state.save()
}

#[tauri::command]
pub async fn get_due_schedules(
    state: State<'_, SchedulerState>,
) -> Result<Vec<Schedule>, String> {
<<<<<<< HEAD
    let now = Utc::now();
    let due = state.schedules.lock().unwrap()
        .iter()
        .filter(|s| {
            s.enabled
                && parse_schedule_datetime(&s.next_run_at)
                    .map(|dt| dt.with_timezone(&Utc) <= now)
                    .unwrap_or(false)
        })
=======
    let now = Utc::now().to_rfc3339();
    let due = state.schedules.lock().unwrap()
        .iter()
        .filter(|s| s.enabled && s.next_run_at <= now)
>>>>>>> origin/main
        .cloned()
        .collect();
    Ok(due)
}

#[tauri::command]
pub async fn mark_schedule_ran(
    id: String,
    state: State<'_, SchedulerState>,
) -> Result<Schedule, String> {
<<<<<<< HEAD
    let now = Local::now();
=======
    let now = Utc::now();
>>>>>>> origin/main
    let mut schedules = state.schedules.lock().unwrap();
    let s = schedules.iter_mut().find(|s| s.id == id)
        .ok_or_else(|| format!("Schedule not found: {}", id))?;
    s.last_ran_at = Some(now.to_rfc3339());
    // For once-off schedules, disable after running
    if matches!(s.recurrence, Recurrence::Once { .. }) {
        s.enabled = false;
    } else {
        s.next_run_at = compute_next_run(&s.recurrence, &now);
    }
    let updated = s.clone();
    drop(schedules);
    state.save()?;
    Ok(updated)
}
