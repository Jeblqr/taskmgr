use sysinfo::System;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::broadcast;
use serde::Serialize;
use tokio::process::Command;

#[derive(Clone, Serialize, Debug)]
pub struct SystemMetrics {
    pub cpu: f32,
    pub mem_used: u64,
    pub mem_total: u64,
    pub gpu: Option<GpuMetrics>,
}

#[derive(Clone, Serialize, Debug)]
pub struct GpuMetrics {
    pub name: String,
    pub util: u32,
    pub mem_used: u64,
    pub mem_total: u64,
}

pub struct Monitor {
    sys: Arc<Mutex<System>>,
    pub tx: broadcast::Sender<SystemMetrics>,
}

impl Monitor {
    pub fn new() -> (Self, broadcast::Receiver<SystemMetrics>) {
        let (tx, rx) = broadcast::channel(16); // Buffer size 16 is plenty for real-time stats
        let sys = Arc::new(Mutex::new(System::new_all()));
        (Self { sys, tx }, rx)
    }

    pub async fn run(self) {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        loop {
            interval.tick().await;

            let (cpu_global, mem_used, mem_total) = {
               let mut s = self.sys.lock().unwrap();
               s.refresh_cpu();
               s.refresh_memory();
               let cpu = s.global_cpu_info().cpu_usage();
               let used = s.used_memory();
               let total = s.total_memory();
               (cpu, used, total)
            };
            
            let metrics = SystemMetrics {
                cpu: cpu_global,
                mem_used: mem_used,
                mem_total: mem_total,
                gpu: Monitor::sample_gpu().await,
            };

            if let Err(_) = self.tx.send(metrics) {
                break; // No listeners, but we keep running? Or stop? 
                // Linus: "If nobody listens, does the tree make a sound? Who cares. Run loops are cheap, but why waste cycles?"
                // Ideally we'd pause. But for now, keep robust.
            }
        }
    }

    async fn sample_gpu() -> Option<GpuMetrics> {
        // nvidia-smi is slow and heavy. Don't block the executor.
        // Also it might not exist.
        // Don't panic.
        let output = Command::new("nvidia-smi")
            .args(&["--query-gpu=name,utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"])
            .output()
            .await
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let out_str = String::from_utf8_lossy(&output.stdout);
        let line = out_str.lines().next()?;
        let mut cols = line.split(',').map(|s| s.trim());

        Some(GpuMetrics {
            name: cols.next()?.to_string(),
            util: cols.next()?.parse().unwrap_or(0),
            mem_used: cols.next()?.parse().unwrap_or(0),
            mem_total: cols.next()?.parse().unwrap_or(0),
        })
    }
}
