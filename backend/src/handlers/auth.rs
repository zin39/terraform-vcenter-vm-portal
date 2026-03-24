use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put, delete},
    Json, Router,
};
use uuid::Uuid;
use validator::Validate;

use crate::error::AppError;
use crate::middleware::{require_admin, AuthUser};
use crate::models::{
    ChangePasswordRequest, CreateUserRequest, ListUsersQuery, LoginRequest, LoginResponse,
    PaginatedUsers, UpdateUserRequest, User, UserResponse,
};
use crate::utils::{create_token, hash_password, verify_password};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login))
        .route("/me", get(me))
        .route("/change-password", post(change_password))
}

pub fn users_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_users).post(create_user))
        .route("/:id", get(get_user).put(update_user).delete(delete_user))
}

async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1 AND is_active = true")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::InvalidCredentials)?;

    if !verify_password(&payload.password, &user.password_hash)? {
        return Err(AppError::InvalidCredentials);
    }

    let token = create_token(user.id, &user.email, user.role, &state.config.jwt_secret)?;

    Ok(Json(LoginResponse {
        token,
        user: user.into(),
    }))
}

async fn me(State(state): State<AppState>, auth_user: AuthUser) -> Result<Json<UserResponse>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(auth_user.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    Ok(Json(user.into()))
}

async fn change_password(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(auth_user.id)
        .fetch_one(&state.db)
        .await?;

    if !verify_password(&payload.current_password, &user.password_hash)? {
        return Err(AppError::Validation("Current password is incorrect".to_string()));
    }

    let new_hash = hash_password(&payload.new_password)?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&new_hash)
        .bind(auth_user.id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Password changed successfully" })))
}

async fn create_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<UserResponse>, AppError> {
    require_admin(&auth_user)?;

    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Check if email already exists
    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_one(&state.db)
        .await?;

    if existing > 0 {
        return Err(AppError::Validation("Email already exists".to_string()));
    }

    let password_hash = hash_password(&payload.password)?;

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (email, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.full_name)
    .bind(payload.role)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(user.into()))
}

async fn list_users(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ListUsersQuery>,
) -> Result<Json<PaginatedUsers>, AppError> {
    require_admin(&auth_user)?;

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let (users, total): (Vec<User>, i64) = if let Some(role) = query.role {
        let users = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        )
        .bind(role)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE role = $1")
            .bind(role)
            .fetch_one(&state.db)
            .await?;

        (users, total)
    } else {
        let users = sqlx::query_as::<_, User>(
            "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
            .fetch_one(&state.db)
            .await?;

        (users, total)
    };

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(Json(PaginatedUsers {
        data: users.into_iter().map(UserResponse::from).collect(),
        total,
        page,
        per_page,
        total_pages,
    }))
}

async fn get_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<UserResponse>, AppError> {
    require_admin(&auth_user)?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    Ok(Json(user.into()))
}

async fn update_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateUserRequest>,
) -> Result<Json<UserResponse>, AppError> {
    require_admin(&auth_user)?;

    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Check user exists
    let existing = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    // Prevent deactivating yourself
    if payload.is_active == Some(false) && id == auth_user.id {
        return Err(AppError::Validation("Cannot deactivate your own account".to_string()));
    }

    // Prevent demoting yourself from admin
    if let Some(new_role) = payload.role {
        if id == auth_user.id && new_role != existing.role {
            return Err(AppError::Validation("Cannot change your own role".to_string()));
        }
    }

    let full_name = payload.full_name.unwrap_or(existing.full_name);
    let role = payload.role.unwrap_or(existing.role);
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    let user = sqlx::query_as::<_, User>(
        r#"
        UPDATE users
        SET full_name = $1, role = $2, is_active = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
        "#,
    )
    .bind(&full_name)
    .bind(role)
    .bind(is_active)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(user.into()))
}

async fn delete_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_admin(&auth_user)?;

    // Prevent deleting yourself
    if id == auth_user.id {
        return Err(AppError::Validation("Cannot delete your own account".to_string()));
    }

    // Check user exists
    let _ = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    // Soft delete by deactivating
    sqlx::query("UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "User deactivated successfully" })))
}
