use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::fs;
use std::path::Path;

pub async fn init_db(db_url: &str) -> Result<SqlitePool, sqlx::Error> {
    if !db_url.starts_with("sqlite:") {
        panic!("Database URL must start with sqlite:");
    }
    
    let path_str = db_url.strip_prefix("sqlite://").unwrap();
    let path = Path::new(path_str);
    
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap_or_default();
    }
    
    if !std::path::Path::new("data/tasks.db").exists() {
        std::fs::File::create("data/tasks.db").ok();
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(db_url).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            owner TEXT NOT NULL DEFAULT 'admin', -- Added owner column
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            args TEXT NOT NULL,
            env_type TEXT NOT NULL,
            env_name TEXT,
            cwd TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            started_at DATETIME,
            ended_at DATETIME,
            pid INTEGER,
            exit_code INTEGER
        );
        "#
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}
