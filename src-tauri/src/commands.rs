/// Placeholder command — will be replaced with file operations in Phase 3
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! LightMD is ready.", name)
}
