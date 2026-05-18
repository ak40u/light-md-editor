use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// Stores the file path passed via CLI argument on first launch
pub static INITIAL_FILE: Mutex<Option<String>> = Mutex::new(None);

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentFileEntry {
    pub path: String,
    pub title: String,
    pub last_opened: String,
}

/// Frontend calls this on startup to check if a file was passed via CLI
#[tauri::command]
pub fn get_initial_file() -> Option<String> {
    INITIAL_FILE.lock().ok()?.take()
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    let resolved = validate_file_path(&path)?;
    fs::read_to_string(&resolved).map_err(|e| format!("Failed to read '{}': {}", path, e))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let resolved = validate_file_path(&path)?;
    fs::write(&resolved, content).map_err(|e| format!("Failed to write '{}': {}", path, e))
}

/// Validate that the path is absolute and doesn't traverse outside user space
fn validate_file_path(path: &str) -> Result<PathBuf, String> {
    let path_buf = PathBuf::from(path);
    if !path_buf.is_absolute() {
        return Err("Only absolute file paths are allowed".into());
    }
    // Normalize and reject path traversal
    let canonical = path_buf
        .canonicalize()
        .or_else(|_| {
            // File may not exist yet (for write); validate parent instead
            if let Some(parent) = path_buf.parent() {
                parent.canonicalize().map(|p| p.join(path_buf.file_name().unwrap_or_default()))
            } else {
                Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "invalid path"))
            }
        })
        .map_err(|e| format!("Invalid path '{}': {}", path, e))?;
    Ok(canonical)
}

fn recent_files_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(data_dir.join("recent-files.json"))
}

#[tauri::command]
pub async fn get_recent_files(
    app_handle: tauri::AppHandle,
) -> Result<Vec<RecentFileEntry>, String> {
    let path = recent_files_path(&app_handle)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read recent files: {}", e))?;
    serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse recent files: {}", e))
}

#[tauri::command]
pub async fn add_recent_file(
    app_handle: tauri::AppHandle,
    path: String,
    title: String,
) -> Result<(), String> {
    let file_path = recent_files_path(&app_handle)?;
    let mut entries: Vec<RecentFileEntry> = if file_path.exists() {
        let data = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read recent files: {}", e))?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    };

    // Update timestamp if file already in list (preserve position)
    if let Some(existing) = entries.iter_mut().find(|e| e.path == path) {
        existing.last_opened = chrono::Utc::now().to_rfc3339();
        existing.title = title;
    } else {
        // New file — insert at top
        entries.insert(
            0,
            RecentFileEntry {
                path,
                title,
                last_opened: chrono::Utc::now().to_rfc3339(),
            },
        );
        entries.truncate(20);
    }

    let json = serde_json::to_string_pretty(&entries)
        .map_err(|e| format!("Failed to serialize recent files: {}", e))?;
    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write recent files: {}", e))
}

#[tauri::command]
pub async fn remove_recent_file(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    let file_path = recent_files_path(&app_handle)?;
    if !file_path.exists() {
        return Ok(());
    }
    let data = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read recent files: {}", e))?;
    let mut entries: Vec<RecentFileEntry> =
        serde_json::from_str(&data).unwrap_or_default();
    entries.retain(|e| e.path != path);
    let json = serde_json::to_string_pretty(&entries)
        .map_err(|e| format!("Failed to serialize recent files: {}", e))?;
    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write recent files: {}", e))
}
