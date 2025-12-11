use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Stopped,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Task {
    pub id: String,
    pub owner: String, // New field
    pub name: String,
    pub command: String,
    pub args: String, // JSON array of strings
    pub env_type: String, // "shell", "conda", "uv", "jupyter"
    pub env_name: Option<String>, // e.g. "my-env" or path
    pub cwd: String,
    pub status: TaskStatus,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub pid: Option<u32>,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env_type: String,
    pub env_name: Option<String>,
    pub cwd: Option<String>,
}
