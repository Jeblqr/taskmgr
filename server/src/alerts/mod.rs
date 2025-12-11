use anyhow::{Result, Context};
use lettre::{Message, SmtpTransport, Transport, message::header::ContentType, AsyncTransport};
use lettre::transport::smtp::authentication::Credentials;
use crate::core::models::Task;
use std::env;

pub async fn send_task_email(task: &Task, logs: String) -> Result<()> {
    // 1. Check config
    let smtp_host = env::var("SMTP_HOST").ok();
    if smtp_host.is_none() {
        return Ok(()); // Email disabled
    }
    let smtp_host = smtp_host.unwrap();
    let smtp_user = env::var("SMTP_USER").unwrap_or_default();
    let smtp_pass = env::var("SMTP_PASS").unwrap_or_default();
    let smtp_from = env::var("SMTP_FROM").unwrap_or("taskmgr@localhost".to_string());
    let smtp_to = env::var("SMTP_TO").unwrap_or("user@localhost".to_string());

    // 2. Build email
    let subject = format!("Task {:?} - {}", task.status, task.name);
    
    let duration = if let (Some(start), Some(end)) = (task.started_at, task.ended_at) {
        let dur = end - start;
        format!("Duration: {}s", dur.num_seconds())
    } else {
        "Duration: Unknown".to_string()
    };

    let body = format!(
        "Task ID: {}\nStatus: {:?}\nCommand: {}\n{}\nExit Code: {:?}\n\n--- Last Output ---\n{}",
        task.id, task.status, task.command, duration, task.exit_code, logs
    );

    let email = Message::builder()
        .from(smtp_from.parse()?)
        .to(smtp_to.parse()?)
        .subject(subject)
        .header(ContentType::TEXT_PLAIN)
        .body(body)?;

    // 3. Send
    // Changing to AsyncSmtpTransport for Tokio
    use lettre::AsyncSmtpTransport;
    use lettre::Tokio1Executor;

    let mailer: AsyncSmtpTransport<Tokio1Executor> = if !smtp_user.is_empty() {
        let creds = Credentials::new(smtp_user, smtp_pass);
        AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host)?
            .credentials(creds)
            .build()
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host)?
            .build()
    };

    mailer.send(email).await.context("Failed to send email")?;

    Ok(())
}
