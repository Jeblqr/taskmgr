use axum::Router;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use std::path::PathBuf;
use tokio::sync::broadcast;

mod auth;
mod api;
mod core;
mod db;
mod exec;
mod fs;
mod monitor;
mod alerts;

use crate::db::init::init_db;
use crate::exec::TaskManager;
use crate::api::{AppState, app_router};
use crate::monitor::{Monitor};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://data/tasks.db".to_string());
    let pool = init_db(&db_url).await?;
    
    let log_dir = PathBuf::from("data/logs");
    std::fs::create_dir_all(&log_dir)?;

    let task_manager = Arc::new(TaskManager::new(pool.clone(), log_dir));
    
    // Start Monitor
    let (monitor, rx) = Monitor::new();
    let tx = monitor.tx.clone(); // If we want to access it, but actually Monitor holds it.
    // We just run monitor
    tokio::spawn(async move {
        monitor.run().await;
    });

    let state = Arc::new(AppState {
        task_manager,
        pool,
        monitor_tx: tx,
    });

    let app = app_router(state)
        .layer(CorsLayer::permissive());

    let addr = "0.0.0.0:3000";
    let listener = TcpListener::bind(addr).await?;
    tracing::info!("listening on {}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
