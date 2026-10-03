use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use regex::Regex;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub path: Option<String>,
    pub folder: String,
    pub is_existing: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

pub struct VaultIndex {
    // Map: File name -> List of files linking to it
    pub backlinks: HashMap<String, Vec<PathBuf>>,
}

pub fn build_index(vault_path: &Path) -> VaultIndex {
    let mut backlinks: HashMap<String, Vec<PathBuf>> = HashMap::new();
    let re = Regex::new(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]").unwrap();

    for entry in WalkDir::new(vault_path).into_iter().filter_map(|e| e.ok()) {
        if entry.path().extension().is_some_and(|ext| ext == "md") {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                for cap in re.captures_iter(&content) {
                    let target_note = cap[1].trim().trim_end_matches(".md").to_string();
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

pub fn build_graph(vault_path: &Path) -> GraphData {
    let re = Regex::new(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]").unwrap();

    struct NoteFile {
        id: String,
        title: String,
        path: PathBuf,
        folder: String,
        content: String,
    }

    let mut existing_notes = Vec::new();
    let mut title_to_id: HashMap<String, String> = HashMap::new();

    for entry in WalkDir::new(vault_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() && path.extension().is_some_and(|ext| ext == "md") {
            let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            if file_stem.is_empty() {
                continue;
            }

            let folder = if let Ok(rel) = path.strip_prefix(vault_path) {
                if let Some(parent) = rel.parent() {
                    parent.to_string_lossy().to_string().replace('\\', "/")
                } else {
                    String::new()
                }
            } else {
                String::new()
            };

            let id = file_stem.clone();
            let content = fs::read_to_string(path).unwrap_or_default();

            title_to_id.insert(file_stem.to_lowercase(), id.clone());
            if !folder.is_empty() {
                let rel_path_no_ext = format!("{}/{}", folder, file_stem);
                title_to_id.insert(rel_path_no_ext.to_lowercase(), id.clone());
            }

            existing_notes.push(NoteFile {
                id,
                title: file_stem,
                path: path.to_path_buf(),
                folder,
                content,
            });
        }
    }

    let mut nodes_map: HashMap<String, GraphNode> = HashMap::new();
    let mut raw_edges: Vec<(String, String)> = Vec::new();
    let mut seen_edges: HashSet<(String, String)> = HashSet::new();

    for note in &existing_notes {
        nodes_map.insert(
            note.id.clone(),
            GraphNode {
                id: note.id.clone(),
                title: note.title.clone(),
                path: Some(note.path.to_string_lossy().to_string()),
                folder: note.folder.clone(),
                is_existing: true,
            },
        );
    }

    for note in &existing_notes {
        for cap in re.captures_iter(&note.content) {
            let raw_target = cap[1].trim().trim_end_matches(".md").trim();
            if raw_target.is_empty() {
                continue;
            }

            let lower_target = raw_target.to_lowercase();
            let target_id = if let Some(matched_id) = title_to_id.get(&lower_target) {
                matched_id.clone()
            } else {
                let basename = raw_target.split(&['/', '\\'][..]).last().unwrap_or(raw_target);
                if let Some(matched_id) = title_to_id.get(&basename.to_lowercase()) {
                    matched_id.clone()
                } else {
                    let unresolved_id = raw_target.to_string();
                    if !nodes_map.contains_key(&unresolved_id) {
                        nodes_map.insert(
                            unresolved_id.clone(),
                            GraphNode {
                                id: unresolved_id.clone(),
                                title: basename.to_string(),
                                path: None,
                                folder: String::new(),
                                is_existing: false,
                            },
                        );
                    }
                    unresolved_id
                }
            };

            if note.id != target_id {
                let edge_key = (note.id.clone(), target_id.clone());
                if !seen_edges.contains(&edge_key) {
                    seen_edges.insert(edge_key.clone());
                    raw_edges.push(edge_key);
                }
            }
        }
    }

    let edges = raw_edges
        .into_iter()
        .map(|(source, target)| GraphEdge { source, target })
        .collect();

    let mut nodes: Vec<GraphNode> = nodes_map.into_values().collect();
    nodes.sort_by(|a, b| a.title.cmp(&b.title));

    GraphData { nodes, edges }
}
