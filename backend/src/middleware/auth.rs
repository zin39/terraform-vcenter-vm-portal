use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;
use crate::models::UserRole;
use crate::utils::jwt::verify_token;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub role: UserRole,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    Config: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let config = Config::from_ref(state);

        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|value| value.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthorized)?;

        let claims = verify_token(token, &config.jwt_secret)?;

        Ok(AuthUser {
            id: claims.sub,
            email: claims.email,
            role: claims.role,
        })
    }
}

pub fn require_admin(user: &AuthUser) -> Result<(), AppError> {
    if user.role != UserRole::Admin {
        return Err(AppError::Forbidden);
    }
    Ok(())
}
