mod commands;
mod core;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::open_vault,
            commands::read_note,
            commands::write_note,
            commands::create_folder,
            commands::delete_note,
            commands::get_backlinks
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
