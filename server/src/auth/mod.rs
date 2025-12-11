use anyhow::{Context, Result, anyhow};
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use std::{env, time::{SystemTime, UNIX_EPOCH}};
use pam::Authenticator;
use users::{get_user_by_name, uid_t};

// Constants
const JWT_SECRET_ENV: &str = "JWT_SECRET";
const JWT_EXPIRATION_HOURS: u64 = 24;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // username
    pub uid: u32,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
}

pub fn authenticate_user(payload: &LoginPayload) -> Result<AuthResponse> {
    // 1. Check for root login attempt
    if payload.username == "root" {
        return Err(anyhow!("Root login is strictly prohibited"));
    }

    // 2. Resolve Linux User
    let user = get_user_by_name(&payload.username)
        .ok_or_else(|| anyhow!("User not found"))?;
    
    if user.uid() == 0 {
         return Err(anyhow!("Root UID login is strictly prohibited"));
    }

    // 3. PAM Authentication
    // Note: This requires the server to verify passwords. 
    // Standard PAM modules (pam_unix) often require the process to be root to read /etc/shadow.
    // If the server is running as root (service), this works.
    let mut authenticator = Authenticator::with_password("login")
        .context("Failed to init PAM")?;
    
    authenticator
        .get_handler()
        .set_credentials(&payload.username, &payload.password);

    authenticator
        .authenticate()
        .context("Authentication failed")?;

    authenticator
        .open_session()
        .context("Failed to open PAM session")?;

    // 4. Generate JWT
    let expiration = SystemTime::now()
        .duration_since(UNIX_EPOCH)?
        .as_secs() + (JWT_EXPIRATION_HOURS * 3600);

    let claims = Claims {
        sub: payload.username.clone(),
        uid: user.uid(),
        exp: expiration as usize,
    };

    let secret = env::var(JWT_SECRET_ENV).unwrap_or_else(|_| "secret".to_string());
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
        .context("Failed to generate token")?;

    Ok(AuthResponse { token })
}

// Axum Extractor for Auth Guard
pub struct AuthUser {
    pub username: String,
    pub uid: u32,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts.headers.get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .and_then(|h| h.strip_prefix("Bearer "));

        let token = match auth_header {
            Some(t) => t,
            None => return Err((StatusCode::UNAUTHORIZED, "Missing token").into_response()),
        };

        let secret = env::var(JWT_SECRET_ENV).unwrap_or_else(|_| "secret".to_string());
        
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
            &Validation::new(Algorithm::HS256),
        ).map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token").into_response())?;

        Ok(AuthUser {
            username: token_data.claims.sub,
            uid: token_data.claims.uid,
        })
    }
}
