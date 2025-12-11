use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::time::SystemTime;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

pub fn list_directory(path: &str) -> Result<Vec<FileEntry>, std::io::Error> {
    let mut entries = Vec::new();
    let dir = fs::read_dir(path)?;

    for entry in dir {
        let entry = entry?;
        let metadata = entry.metadata()?;
        let path_buf = entry.path();
        
        let modified = metadata.modified()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path_buf.to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified,
        });
    }

    entries.sort_by(|a, b| {
        if a.is_dir && !b.is_dir {
            std::cmp::Ordering::Less
        } else if !a.is_dir && b.is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(entries)
}

pub fn read_file(path: &str) -> Result<String, std::io::Error> {
    // Basic security check: prevent going generally outside allowed areas if needed, 
    // but for this tool we assume user has access to system
    fs::read_to_string(path)
}
