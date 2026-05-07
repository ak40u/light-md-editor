mod commands;

use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Store CLI file arg for frontend to query on startup
    if let Some(path) = std::env::args().nth(1).filter(|p| is_markdown_file(p)) {
        if let Ok(mut initial) = commands::INITIAL_FILE.lock() {
            *initial = Some(path);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = argv.get(1) {
                if is_markdown_file(path) {
                    let _ = app.emit("open-file", path.clone());
                }
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::write_file,
            commands::get_recent_files,
            commands::add_recent_file,
            commands::get_initial_file,
            commands::remove_recent_file,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop {
                        paths,
                        ..
                    }) = event
                    {
                        for path in paths {
                            if let Some(s) = path.to_str() {
                                if is_markdown_file(s) {
                                    let _ = handle.emit("open-file", s.to_string());
                                    break;
                                }
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn is_markdown_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".txt")
}
