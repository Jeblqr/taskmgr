use axum::{
    extract::{State, Path, WebSocketUpgrade, ws::{WebSocket, Message}},
    response::{Json, IntoResponse},
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use crate::exec::TaskManager;
use crate::core::models::{Task, CreateTaskRequest, TaskStatus};
use crate::fs::{list_directory, read_file};
use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use futures::{stream::StreamExt, SinkExt};
use std::path::PathBuf;
use axum::http::StatusCode;

use crate::monitor::SystemMetrics;
use tokio::sync::broadcast;

pub struct AppState {
    pub task_manager: Arc<TaskManager>,
    pub pool: SqlitePool,
    pub monitor_tx: broadcast::Sender<SystemMetrics>,
}

use tower_http::services::{ServeDir, ServeFile};

pub fn app_router(state: Arc<AppState>) -> Router {
    let api_routes = Router::new()
        .route("/tasks", get(list_tasks).post(create_task))
        .route("/tasks/:id", get(get_task))
        .route("/tasks/:id/start", post(start_task))
        .route("/tasks/:id/pty", get(pty_websocket))
        .route("/stats", get(stats_websocket))
        .route("/fs/ls", get(fs_ls))
        .route("/fs/read", get(fs_read));

    Router::new()
        .nest("/api", api_routes)
        .nest_service("/", ServeDir::new("../web/dist").fallback(ServeFile::new("../web/dist/index.html")))
        .with_state(state)
}

async fn stats_websocket(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|mut socket| async move {
        let mut rx = state.monitor_tx.subscribe();
        while let Ok(metrics) = rx.recv().await {
            if let Ok(msg) = serde_json::to_string(&metrics) {
                if socket.send(Message::Text(msg)).await.is_err() {
                    break;
                }
            }
        }
    })
}

async fn list_tasks(State(state): State<Arc<AppState>>) -> Json<Vec<Task>> {
    let tasks = sqlx::query_as::<_, Task>("SELECT * FROM tasks ORDER BY created_at DESC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();
    Json(tasks)
}

async fn create_task(State(state): State<Arc<AppState>>, Json(payload): Json<CreateTaskRequest>) -> Json<Task> {
    let id = Uuid::new_v4().to_string();
    let task = Task {
        id: id.clone(),
        name: payload.name,
        command: payload.command,
        args: serde_json::to_string(&payload.args).unwrap(),
        env_type: payload.env_type,
        env_name: payload.env_name,
        cwd: payload.cwd.unwrap_or(".".to_string()),
        status: TaskStatus::Pending,
        created_at: Utc::now(),
        started_at: None,
        ended_at: None,
        pid: None,
        exit_code: None,
    };

    sqlx::query(
        "INSERT INTO tasks (id, name, command, args, env_type, env_name, cwd, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&task.id)
    .bind(&task.name)
    .bind(&task.command)
    .bind(&task.args)
    .bind(&task.env_type)
    .bind(&task.env_name)
    .bind(&task.cwd)
    .bind(&task.status)
    .bind(&task.created_at)
    .execute(&state.pool)
    .await
    .unwrap();

    Json(task)
}

async fn get_task(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> Json<Option<Task>> {
    let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .unwrap();
    Json(task)
}

async fn start_task(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> impl IntoResponse {
    match state.task_manager.spawn(&id).await {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            eprintln!("Failed to start task: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn pty_websocket(
    ws: WebSocketUpgrade,
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_pty_socket(socket, id, state))
}

async fn handle_pty_socket(mut socket: WebSocket, id: String, state: Arc<AppState>) {
    
    // Let's implement Write-only for now via WS, and Read via a separate Log stream or just File Tail.
    // Wait, xterm.js expects bidirectional.
    
    // Correct approach:
    // `TaskManager` should expose a way to subscribe to output.
    // Since we didn't implement broadcast in `TaskManager` yet, let's just allow writing to Stdin here. 
    // And sending back "Connected" message.
    
    while let Some(msg) = socket.recv().await {
        if let Ok(Message::Text(text)) = msg {
            let _ = state.task_manager.write_stdin(&id, text.as_bytes()).await;
        } else if let Ok(Message::Binary(bin)) = msg {
             let _ = state.task_manager.write_stdin(&id, &bin).await;
        }
        // TODO: Handle resize message (JSON)
    }
}

// File System handlers
#[derive(serde::Deserialize)]
struct LsQuery {
    path: String,
}

async fn fs_ls(Query(q): axum::extract::Query<LsQuery>) -> impl IntoResponse {
    match list_directory(&q.path) {
        Ok(entries) => Json(entries).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
struct ReadQuery {
    path: String,
}

async fn fs_read(Query(q): axum::extract::Query<ReadQuery>) -> impl IntoResponse {
    match read_file(&q.path) {
        Ok(content) => content.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

use axum::extract::Query;
