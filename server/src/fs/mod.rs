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

pub fn resolve_safe_path(input_path: &str) -> Result<PathBuf, std::io::Error> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let root = Path::new(&home).canonicalize()?;
    
    // Treat input as relative to root, even if it starts with /
    let relative_path = input_path.trim_start_matches('/');
    let target = if relative_path.is_empty() {
        root.clone()
    } else {
        root.join(relative_path)
    };

    // Canonicalize to resolve .. and symlinks
    let canonical = target.canonicalize().map_err(|e| {
        // If file doesn't exist, we can't canonicalize, but for ls/read it should exist.
        // For creation we might need parent check. For now assume read-only/existing ops.
        e
    })?;

    if canonical.starts_with(&root) {
        Ok(canonical)
    } else {
        Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "Path traversal denied: Access outside home directory is forbidden."))
    }
}

pub fn list_directory(path: &str) -> Result<Vec<FileEntry>, std::io::Error> {
    let msg_path = if path.starts_with('/') { path } else { "/" }; // Display path
    let safe_path = resolve_safe_path(path)?;
    
    let mut entries = Vec::new();
    let dir = fs::read_dir(safe_path)?;

    for entry in dir {
        let entry = entry?;
        let metadata = entry.metadata()?;
        let path_buf = entry.path();
        
        let modified = metadata.modified()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // For frontend, we want the "virtual" path (relative to root)
        // If we list /home/user/foo, and entry is /home/user/foo/bar,
        // we want result path to be /foo/bar.
        // Simple hack: Take the input path logic or just use name and let frontend build path.
        // Frontend uses `entry.path` for navigation. So we must reconstruct virtual path.
        
        let name = entry.file_name().to_string_lossy().to_string();
        let virtual_path = if msg_path == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", msg_path.trim_end_matches('/'), name)
        };

        entries.push(FileEntry {
            name,
            path: virtual_path, 
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
    let safe_path = resolve_safe_path(path)?;
    fs::read_to_string(safe_path)
}
