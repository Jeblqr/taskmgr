use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, SlavePty, MasterPty};
use tokio::sync::{RwLock, broadcast};
use crate::core::models::{Task, TaskStatus};
use sqlx::SqlitePool;
use anyhow::{Result, Context};
use std::io::{Read, Write};

pub mod envs; 

pub struct RunningTask {
    pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    pub pid: Option<u32>,
    pub output_tx: broadcast::Sender<Vec<u8>>,
}

pub struct TaskManager {
    pool: SqlitePool,
    log_root: PathBuf,
    pub tasks: Arc<RwLock<HashMap<String, RunningTask>>>,
    pty_sys: NativePtySystem,
}

impl TaskManager {
    pub fn new(pool: SqlitePool, log_root: PathBuf) -> Self {
        Self { 
            pool, 
            log_root,
            tasks: Arc::new(RwLock::new(HashMap::new())),
            pty_sys: NativePtySystem::default(),
        }
    }

    pub async fn spawn(&self, id: &str) -> Result<()> {
        let task: Task = sqlx::query_as("SELECT * FROM tasks WHERE id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .context("Task not found in DB")?;

        let (prog, args) = envs::build_command(&task)?;
        let mut cmd = CommandBuilder::new(prog);
        cmd.args(&args);
        
        if let Some(ref cwd) = task.cwd.as_str().into() {
             cmd.cwd(cwd.to_string());
        }

        for (k, v) in envs::get_env_vars(&task)? {
            cmd.env(k, v);
        }

        // PTY Setup
        let pair = self.pty_sys.openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
            .context("Failed to open PTY")?;

        let child = pair.slave.spawn_command(cmd).context("Failed to spawn child")?;

        let pid = child.process_id();

        // Update DB
        sqlx::query("UPDATE tasks SET status = 'Running', started_at = datetime('now'), pid = ? WHERE id = ?")
            .bind(pid)
            .bind(id)
            .execute(&self.pool)
            .await
            .context("Failed to update task status")?;

        // Log Streaming
        let mut reader = pair.master.try_clone_reader().context("Failed to clone PTY reader")?;
        let log_root = self.log_root.clone();
        let id_str = id.to_string();
        let (tx, _rx) = broadcast::channel(100);
        let tx_clone = tx.clone();
        
        std::thread::spawn(move || {
            let log_path = log_root.join(format!("{}.log", id_str));
            let mut f = std::fs::OpenOptions::new().create(true).append(true).open(log_path).unwrap(); 
            let mut buf = [0u8; 4096];
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 { break; }
                let data = &buf[..n];
                // Log to file
                let _ = f.write_all(data);
                // Broadcast to WS
                let _ = tx_clone.send(data.to_vec());
            }
        });

        self.tasks.write().await.insert(id.to_string(), RunningTask {
            master: Arc::new(Mutex::new(pair.master)),
            pid,
            output_tx: tx,
        });

        Ok(())
    }

    pub async fn write_stdin(&self, id: &str, data: &[u8]) -> Result<()> {
        let map = self.tasks.read().await;
        if let Some(t) = map.get(id) {
            let mut m = t.master.lock().unwrap();
            // Try take_writer which is common in portable-pty for writing to stdin
            let mut writer = m.take_writer().context("Failed to take writer from PTY")?;
            writer.write_all(data).context("Failed to write to PTY")?;
        }
        Ok(())
    }
}
