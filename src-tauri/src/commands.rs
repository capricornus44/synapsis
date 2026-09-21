use std::path::Path;
use std::fs;
use serde::{Serialize, Deserialize};
use crate::core::indexer;

#[derive(Serialize, Deserialize)]
pub struct NoteInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<NoteInfo>>,
}

#[tauri::command]
pub async fn open_vault(path: String) -> Result<Vec<NoteInfo>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err("Path does not exist".into());
    }
    // Recursively build the file tree for FileExplorer
    read_dir_recursive(root).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_note(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_note(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_note(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("Path does not exist".into());
    }
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn get_backlinks(vault_path: String, note_name: String) -> Result<Vec<String>, String> {
    let index = indexer::build_index(Path::new(&vault_path));
    let paths = index.backlinks.get(&note_name).cloned().unwrap_or_default();
    let names = paths.into_iter()
        .filter_map(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned()))
        .collect();
    Ok(names)
}

fn read_dir_recursive(path: &Path) -> std::io::Result<Vec<NoteInfo>> {
    let mut result = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let path_str = entry.path().to_string_lossy().into_owned();

        if meta.is_dir() {
            let children = read_dir_recursive(&entry.path())?;
            result.push(NoteInfo { name, path: path_str, is_dir: true, children: Some(children) });
        } else if entry.path().extension().is_some_and(|ext| ext == "md") {
            result.push(NoteInfo { name, path: path_str, is_dir: false, children: None });
        }
    }
    // Sort: folders first, then files
    result.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    Ok(result)
}
