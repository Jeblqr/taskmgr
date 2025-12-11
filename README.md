# Task Manager

A high-performance, full-stack Task Management application for Linux servers. Features persistent task tracking, process isolation, real-time monitoring, and remote file management.

## Features

- **Multi-User Authentication**: Secure login via Linux PAM (System Users).
- **Process Management**: Launch, stop, and monitor long-running tasks.
- **Process Attachment**: Attach to and track existing PIDs.
- **Environment Support**: Native support for Shell, Conda, UV, and Custom Environments.
- **Interactive Terminal**: Real-time PTY based output streaming.
- **File Browser**: Browse and view files in the task environments.
- **Monitoring**: Real-time Global (CPU/RAM/GPU) and Per-Task resource usage stats.
- **Notifications**: Email alerts on task completion or failure.

## Installation

### Prerequisites
- Linux Server (tested on Ubuntu/Debian)
- `node` (v18+) & `npm`
- `rust` (stable) & `cargo`
- `gcc` & `libpam0g-dev`

### Quick Install (Root Required)
The provided script builds the application and installs it as a systemd service.

```bash
chmod +x install.sh
sudo ./install.sh
```

This will:
1. Build the Frontend (`web`) and Backend (`server`).
2. Install server binary to `/opt/task-mgr/server`.
3. Install frontend assets to `/opt/task-mgr/web`.
4. Install and start `task-mgr.service`.

### Configuration
The service runs on port `3000` by default.
Login using your linux system username and password (`root` login is disabled by default).

Environment Variables (Optional, set in `/etc/systemd/system/task-mgr.service`):
- `PORT`: Server port (default: 3000)
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`: For email notifications.
- `WEB_ROOT`: Path to frontend assets (default: `/opt/task-mgr/web`).

## Development

1. **Backend**:
   ```bash
   cd server
   sudo cargo run  # Sudo needed for PAM auth
   ```
2. **Frontend**:
   ```bash
   cd web
   npm run dev
   ```

## Architecture
- **Backend**: Rust (Axum, Tokio, SQLx, Portable-PTY)
- **Frontend**: React (Vite, TailwindCSS, Lucide)
- **Database**: SQLite
