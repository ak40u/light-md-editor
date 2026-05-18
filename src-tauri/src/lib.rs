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
            commands::save_draft,
            commands::load_draft,
            commands::discard_draft,
            commands::list_drafts,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop {
                        paths, ..
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            // macOS uses Apple Events (Finder double-click, `open`, file association).
            // Windows / Linux use argv[1] (cold start) + single-instance plugin (hot start) above.
            #[cfg(target_os = "macos")]
            handle_macos_open_event(_app_handle, _event);
        });
}

/// Bridge `RunEvent::Opened` (macOS-only Apple Events) into the same frontend
/// channels the rest of the app uses: stash for cold-start query, emit for hot.
#[cfg(target_os = "macos")]
fn handle_macos_open_event(app_handle: &tauri::AppHandle, event: tauri::RunEvent) {
    if let tauri::RunEvent::Opened { urls } = event {
        for url in urls {
            if let Ok(path) = url.to_file_path() {
                if let Some(s) = path.to_str() {
                    if is_markdown_file(s) {
                        if let Ok(mut initial) = commands::INITIAL_FILE.lock() {
                            if initial.is_none() {
                                *initial = Some(s.to_string());
                            }
                        }
                        let _ = app_handle.emit("open-file", s.to_string());
                    }
                }
            }
        }
    }
}

fn is_markdown_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".txt")
}
