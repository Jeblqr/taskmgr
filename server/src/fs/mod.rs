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

pub fn resolve_safe_path(input_path: &str, user_home: &Path) -> Result<PathBuf, std::io::Error> {
    // Virtual Root Logic:
    // The frontend sees "/" as the root.
    // We map "/" -> user_home.
    // "/foo" -> user_home/foo.
    
    // 1. Strip leading "/" from input to make it relative
    let relative_path = input_path.trim_start_matches('/');
    
    // 2. Join with user_home
    let target = if relative_path.is_empty() {
        user_home.to_path_buf()
    } else {
        user_home.join(relative_path)
    };

    // 3. Canonicalize to resolve symlinks and ".."
    // Note: If target doesn't exist, canonicalize fails. 
    // This provides "Path not found" check implicitly.
    let canonical = target.canonicalize()?;

    // 4. Sandbox Check: Ensure it is still inside user_home
    // Use canonical user_home to compare
    let canonical_home = user_home.canonicalize().unwrap_or(user_home.to_path_buf());
    
    if canonical.starts_with(&canonical_home) {
        Ok(canonical)
    } else {
        Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "Access Denied: Path is outside your home directory."))
    }
}

pub fn list_directory(path: &str, user_home: &Path) -> Result<Vec<FileEntry>, std::io::Error> {
    // If path is empty, default to "/"
    let input_path = if path.is_empty() { "/" } else { path };
    let safe_path = resolve_safe_path(input_path, user_home)?;
    
    let mut entries = Vec::new();
    let dir = fs::read_dir(&safe_path)?;

    for entry in dir {
        // Handle read errors gracefully for individual files
        if let Ok(entry) = entry {
            if let Ok(metadata) = entry.metadata() {
                let modified = metadata.modified()
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                let name = entry.file_name().to_string_lossy().to_string();
                
                // Virtual Path Construction:
                // Input: /foo (virtual)
                // Name: bar
                // Result: /foo/bar
                let virtual_path = if input_path == "/" {
                    format!("/{}", name)
                } else {
                    format!("{}/{}", input_path.trim_end_matches('/'), name)
                };

                entries.push(FileEntry {
                    name,
                    path: virtual_path, 
                    is_dir: metadata.is_dir(),
                    size: metadata.len(),
                    modified,
                });
            }
        }
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

pub fn read_file(path: &str, user_home: &Path) -> Result<String, std::io::Error> {
    let safe_path = resolve_safe_path(path, user_home)?;
    fs::read_to_string(safe_path)
}
