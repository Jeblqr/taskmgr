use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, SlavePty, MasterPty, Child};
use tokio::sync::{RwLock, broadcast};
use crate::core::models::{Task, TaskStatus};
use sqlx::SqlitePool;
use anyhow::{Result, Context};
use std::io::{Read, Write};
use sysinfo::{Pid, System, Process};

pub mod envs; 

pub struct RunningTask {
    pub master: Option<Arc<Mutex<Box<dyn MasterPty + Send>>>>, // None if Attached
    pub pid: Option<u32>,
    pub output_tx: Option<broadcast::Sender<Vec<u8>>>, // None if Attached
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

        // Apply UID/GID if needed (only if running as root)
        // For now, we rely on the server running as the user, OR we implement strict setuid
        // But users::get_user_by_name requires reading /etc/passwd.
        // If we are root, we can setuid. If not, we ignore (linux strict).
        // Since we are adding "Advanced Features", let's leave process UID switching for a "Nice to have" or simplified "run as current user".
        // The PAM auth ensures we are talking to the right person, but the server process owner determines the spawn owner unless we use setuid.
        
        for (k, v) in envs::get_env_vars(&task)? {
            cmd.env(k, v);
        }

        // PTY Setup
        let pair = self.pty_sys.openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
            .context("Failed to open PTY")?;

        let child = pair.slave.spawn_command(cmd).context("Failed to spawn child")?;
        let pid = child.process_id(); // Returns Option<u32> for portable-pty 0.8? Or u32?
        // Wait, if it failed before with mismatched types, likely it is Option.
        // IF it is u32, then "Some(pid)" is correct.
        // IF it is Option<u32>, then "pid" is Option<u32>.
        // Let's inspect source or assume Option<u32> based on error.
        // Error: "pid: Some(pid)" -> "expected u32 found Option<u32>".
        // This means "pid" (the variable) IS Option<u32>.
        // BUT "pid: Some(pid)" expects "u32" inside Some? NO.
        // RunningTask.pid is Option<u32>.
        // So "pid: Some(pid)" means we are trying to construct Option<u32> with Some(Option<u32>) -> Option<Option<u32>>.
        // So we should just pass "pid" directly if it is already Option<u32>.

        // Update DB
        sqlx::query("UPDATE tasks SET status = 'Running', started_at = datetime('now'), pid = ? WHERE id = ?")
            .bind(pid)
            .bind(id)
            .execute(&self.pool)
            .await?;

        // Log Streaming
        let mut reader = pair.master.try_clone_reader().context("Failed to clone PTY reader")?;
        let log_root = self.log_root.clone();
        let id_str = id.to_string();
        let (tx, _rx) = broadcast::channel(100);
        let tx_clone = tx.clone();
        
        // Log Writer/Broadcaster Thread
        std::thread::spawn(move || {
            let log_path = log_root.join(format!("{}.log", id_str));
            let mut f = std::fs::OpenOptions::new().create(true).append(true).open(log_path).unwrap(); 
            let mut buf = [0u8; 4096];
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 { break; }
                let data = &buf[..n];
                let _ = f.write_all(data);
                let _ = tx_clone.send(data.to_vec());
            }
        });

        // Monitor Thread (Waits for exit)
        let pool = self.pool.clone();
        let id_str_monitor = id.to_string();
        let mut child_monitor = child;
        let log_root_monitor = self.log_root.clone();

        std::thread::spawn(move || {
            // Wait for process to exit
            let status = child_monitor.wait().expect("Failed to wait on child");
            let exit_code = if status.success() { 0 } else { 1 }; // simplify, portable-pty exit status logic varies

            // Update DB
            let _ = tokio::runtime::Runtime::new().unwrap().block_on(async {
                 // 1. Mark as Finished
                 sqlx::query("UPDATE tasks SET status = ?, ended_at = datetime('now'), exit_code = ? WHERE id = ?")
                    .bind(if exit_code == 0 { "Finished" } else { "Failed" })
                    .bind(exit_code)
                    .bind(&id_str_monitor)
                    .execute(&pool)
                    .await.ok();
                
                 // 2. Send Email
                 if let Ok(task) = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
                    .bind(&id_str_monitor)
                    .fetch_one(&pool)
                    .await 
                 {
                     let log_path = log_root_monitor.join(format!("{}.log", id_str_monitor));
                     // Read last 50 lines (approx) - actually just read whole file for now, simple
                     let logs = std::fs::read_to_string(log_path).unwrap_or_default();
                     // truncate logs if too long
                     let logs_tail = if logs.len() > 2000 {
                         logs[logs.len().saturating_sub(2000)..].to_string()
                     } else {
                         logs
                     };
                     
                     let _ = crate::alerts::send_task_email(&task, logs_tail).await;
                 }
            });
        });

        self.tasks.write().await.insert(id.to_string(), RunningTask {
            master: Some(Arc::new(Mutex::new(pair.master))),
            pid, // Directly use pid (likely Option<u32>)
            output_tx: Some(tx),
        });

        Ok(())
    }

    pub async fn attach(&self, id: &str, pid: u32) -> Result<()> {
        // Just monitor existing PID
        let pool = self.pool.clone();
        let id_str = id.to_string();

        // Update DB
        sqlx::query("UPDATE tasks SET status = 'Running', started_at = datetime('now'), pid = ? WHERE id = ?")
            .bind(pid)
            .bind(id)
            .execute(&self.pool)
            .await?;

        // Monitor Loop (Polling)
        tokio::spawn(async move {
            let mut sys = System::new();
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                sys.refresh_process(Pid::from(pid as usize));
                if sys.process(Pid::from(pid as usize)).is_none() {
                    // Process gone
                     sqlx::query("UPDATE tasks SET status = 'Finished', ended_at = datetime('now') WHERE id = ?")
                        .bind(&id_str)
                        .execute(&pool)
                        .await.ok();
                    
                    // Email
                     if let Ok(task) = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
                        .bind(&id_str)
                        .fetch_one(&pool)
                        .await 
                     {
                         let _ = crate::alerts::send_task_email(&task, "Task attached via PID. Logs unavailable.".to_string()).await;
                     }
                    break;
                }
            }
        });

        self.tasks.write().await.insert(id.to_string(), RunningTask {
            master: None,
            pid: Some(pid),
            output_tx: None,
        });
        
        Ok(())
    }

    pub async fn write_stdin(&self, id: &str, data: &[u8]) -> Result<()> {
        let map = self.tasks.read().await;
        if let Some(t) = map.get(id) {
            if let Some(master) = &t.master {
                let mut m = master.lock().unwrap();
                let mut writer = m.take_writer().context("Failed to take writer from PTY")?;
                writer.write_all(data).context("Failed to write to PTY")?;
            }
        }
        Ok(())
    }
}
