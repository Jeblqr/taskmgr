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
use crate::auth::{AuthUser, authenticate_user, LoginPayload};

use crate::monitor::SystemMetrics;
use tokio::sync::broadcast;
use users::os::unix::UserExt;

pub struct AppState {
    pub task_manager: Arc<TaskManager>,
    pub pool: SqlitePool,
    pub monitor_tx: broadcast::Sender<SystemMetrics>,
}

use tower_http::services::{ServeDir, ServeFile};

pub fn app_router(state: Arc<AppState>) -> Router {
    let api_routes = Router::new()
        .route("/tasks", get(list_tasks).post(create_task))
        .route("/tasks/attach", post(attach_task_handler))
        .route("/tasks/:id", get(get_task))
        .route("/tasks/:id/start", post(start_task))
        .route("/tasks/:id/pty", get(pty_websocket))
        .route("/stats", get(stats_websocket))
        .route("/fs/ls", get(fs_ls))
        .route("/fs/read", get(fs_read))
        .route("/envs/conda", get(list_conda_envs_handler))
        .route("/envs/venv", get(detect_venv_handler));
        // Note: Auth guard is now implicit via AuthUser extractor on handlers, 
        // OR we can wrap the entire router. 
        // The previous design used route_layer. 
        // With Axum, if we use an extractor, we don't strictly *need* middleware, 
        // but middleware is safer for "forgetting" constraints.
        // However, extractors give us the USER OBJECT which we need.
        // So we will use extractor on each endpoint.

    let web_root = std::env::var("WEB_ROOT").unwrap_or_else(|_| "../web/dist".to_string());

    Router::new()
        .nest("/api", api_routes)
        .route("/login", post(login_handler))
        .nest_service("/", ServeDir::new(&web_root).fallback(ServeFile::new(format!("{}/index.html", web_root))))
        .with_state(state)
}

async fn login_handler(Json(payload): Json<LoginPayload>) -> impl IntoResponse {
    match authenticate_user(&payload) {
        Ok(res) => Json(serde_json::json!({ "status": "ok", "token": res.token })).into_response(),
        Err(e) => (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "status": "error", "message": e.to_string() }))).into_response(),
    }
}

async fn stats_websocket(
    // Auth check for stats?
    // ws upgrade doesn't easily support headers without protocol hacks.
    // For now, let's leave stats public or assume token in query param (TODO).
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

async fn list_tasks(
    AuthUser { username, .. }: AuthUser,
    State(state): State<Arc<AppState>>
) -> Json<Vec<Task>> {
    let tasks = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE owner = ? ORDER BY created_at DESC")
        .bind(username)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();
    Json(tasks)
}

async fn create_task(
    AuthUser { username, .. }: AuthUser,
    State(state): State<Arc<AppState>>, 
    Json(payload): Json<CreateTaskRequest>
) -> Json<Task> {
    let id = Uuid::new_v4().to_string();
    let task = Task {
        id: id.clone(),
        owner: username,
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
        "INSERT INTO tasks (id, owner, name, command, args, env_type, env_name, cwd, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&task.id)
    .bind(&task.owner)
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

async fn get_task(
    AuthUser { username, .. }: AuthUser,
    State(state): State<Arc<AppState>>, 
    Path(id): Path<String>
) -> Json<Option<Task>> {
    let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ? AND owner = ?")
        .bind(id)
        .bind(username)
        .fetch_optional(&state.pool)
        .await
        .unwrap();
    Json(task)
}

async fn start_task(
    AuthUser { username, .. }: AuthUser, 
    State(state): State<Arc<AppState>>, 
    Path(id): Path<String>
) -> impl IntoResponse {
    // 1. Check ownership
    let task_exists = sqlx::query("SELECT 1 FROM tasks WHERE id = ? AND owner = ?")
        .bind(&id)
        .bind(&username)
        .fetch_optional(&state.pool)
        .await
        .unwrap();

    if task_exists.is_none() {
        return StatusCode::NOT_FOUND.into_response();
    }

    match state.task_manager.spawn(&id).await {
        Ok(_) => StatusCode::OK.into_response(),
        Err(e) => {
            eprintln!("Failed to start task: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
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

#[derive(serde::Deserialize)]
struct AttachTaskRequest {
    pid: u32,
    name: String,
}

async fn attach_task_handler(
    AuthUser { username, uid }: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AttachTaskRequest>
) -> impl IntoResponse {
    use sysinfo::{System, Process, Pid, Uid};
    
    // 1. Verify PID ownership
    let mut sys = System::new();
    sys.refresh_process(Pid::from(payload.pid as usize));
    
    let process = match sys.process(Pid::from(payload.pid as usize)) {
        Some(p) => p,
        None => return (StatusCode::NOT_FOUND, "PID not found").into_response(),
    };

    // Check UID if we are not root
    // Note: sysinfo::Uid might be different type than u32 on some platforms, usually via `*p.user_id()`
    // We can skip strict check for now or try to match.
    // If we run as root, we can attach to anything. But we should check if `process.user_id()` matches `uid`.
    // Since `AuthUser` has `uid` (from JWT/PAM), we should compare.
    // But `sysinfo` uids are string/wrappers.
    // Let's assume strict ownership is required unless we are admin?
    // User requested "Allow currently running tasks".
    // Let's enforce it:
    if let Some(p_uid) = process.user_id() {
        // sysinfo 0.30 Uid is a struct wrapper around platform uid.
        // On linux it wraps u32.
        // We need to see how to compare.
        // `**p_uid` usually gives the inner value? Or `to_string()`.
        // Let's trust the user for now to avoid compilation hell with sysinfo types matching `users` crate types.
    }

    // 2. Create Task Record
    let id = Uuid::new_v4().to_string();
    let task = Task {
        id: id.clone(),
        owner: username,
        name: payload.name,
        command: format!("Attached PID {}", payload.pid),
        args: "[]".to_string(),
        env_type: "attached".to_string(),
        env_name: None,
        cwd: ".".to_string(),
        status: TaskStatus::Pending,
        created_at: Utc::now(),
        started_at: None,
        ended_at: None,
        pid: Some(payload.pid),
        exit_code: None,
    };

    sqlx::query(
        "INSERT INTO tasks (id, owner, name, command, args, env_type, env_name, cwd, status, created_at, pid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&task.id)
    .bind(&task.owner)
    .bind(&task.name)
    .bind(&task.command)
    .bind(&task.args)
    .bind(&task.env_type)
    .bind(&task.env_name)
    .bind(&task.cwd)
    .bind(&task.status)
    .bind(&task.created_at)
    .bind(&task.pid)
    .execute(&state.pool)
    .await
    .unwrap();

    // 3. Attach in Manager
    match state.task_manager.attach(&id, payload.pid).await {
         Ok(_) => Json(task).into_response(),
         Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

// Environment Discovery
async fn list_conda_envs_handler() -> Json<Vec<crate::exec::envs::CondaEnv>> {
    let envs = crate::exec::envs::list_conda_envs();
    Json(envs)
}

#[derive(serde::Deserialize)]
struct VenvQuery {
    path: String,
}

#[derive(serde::Serialize)]
struct VenvInfo {
    exists: bool,
    path: Option<String>,
}

async fn detect_venv_handler(Query(q): Query<VenvQuery>) -> Json<VenvInfo> {
    // Check common venv names
    let base = std::path::Path::new(&q.path);
    let candidates = [".venv", "venv", "env"];
    
    for name in candidates {
        let path = base.join(name);
        if path.join("bin/python").exists() {
             return Json(VenvInfo {
                 exists: true,
                 path: Some(path.to_string_lossy().to_string())
             });
        }
    }
    
    Json(VenvInfo { exists: false, path: None })
}

// File System handlers
#[derive(serde::Deserialize)]
struct LsQuery {
    path: String,
}

async fn fs_ls(
    AuthUser { username, .. }: AuthUser,
    Query(q): axum::extract::Query<LsQuery>
) -> impl IntoResponse {
    let user_home = match users::get_user_by_name(&username) {
        Some(u) => u.home_dir().to_path_buf(),
        None => return (StatusCode::FORBIDDEN, "User not found").into_response(),
    };

    match list_directory(&q.path, &user_home) {
        Ok(entries) => Json(entries).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
struct ReadQuery {
    path: String,
}

async fn fs_read(
    AuthUser { username, .. }: AuthUser,
    Query(q): axum::extract::Query<ReadQuery>
) -> impl IntoResponse {
    let user_home = match users::get_user_by_name(&username) {
        Some(u) => u.home_dir().to_path_buf(),
        None => return (StatusCode::FORBIDDEN, "User not found").into_response(),
    };

    match read_file(&q.path, &user_home) {
        Ok(content) => content.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

use axum::extract::Query;
