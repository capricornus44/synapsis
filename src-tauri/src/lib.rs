mod commands;
mod core;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let size = monitor.size();
                    let width = (size.width as f64 * 0.8) as u32;
                    let height = (size.height as f64 * 0.8) as u32;
                    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                        width,
                        height,
                    }));
                    let _ = window.center();
                }
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::open_vault,
            commands::read_note,
            commands::write_note,
            commands::create_folder,
            commands::rename_path,
            commands::delete_note,
            commands::get_backlinks
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
