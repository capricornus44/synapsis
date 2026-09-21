use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use regex::Regex;

pub struct VaultIndex {
    // Map: File name -> List of files linking to it
    pub backlinks: HashMap<String, Vec<PathBuf>>,
}

pub fn build_index(vault_path: &Path) -> VaultIndex {
    let mut backlinks: HashMap<String, Vec<PathBuf>> = HashMap::new();
    let re = Regex::new(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]").unwrap();

    for entry in WalkDir::new(vault_path).into_iter().filter_map(|e| e.ok()) {
        if entry.path().extension().is_some_and(|ext| ext == "md") {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                for cap in re.captures_iter(&content) {
                    let target_note = cap[1].trim().to_string();
                    backlinks
                        .entry(target_note)
                        .or_default()
                        .push(entry.path().to_path_buf());
                }
            }
        }
    }
    VaultIndex { backlinks }
}
