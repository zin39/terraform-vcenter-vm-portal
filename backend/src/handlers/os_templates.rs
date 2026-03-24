use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::AuthUser,
    models::{OsTemplate, CreateOsTemplateRequest, UpdateOsTemplateRequest, UserRole},
    AppState,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_templates).post(create_template))
        .route("/:id", get(get_template).put(update_template).delete(delete_template))
}

async fn list_templates(
    State(state): State<AppState>,
    _auth_user: AuthUser,
) -> Result<Json<Vec<OsTemplate>>, AppError> {
    let templates = sqlx::query_as::<_, OsTemplate>(
        "SELECT * FROM os_templates WHERE is_active = true ORDER BY display_name"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(templates))
}

async fn get_template(
    State(state): State<AppState>,
    _auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<OsTemplate>, AppError> {
    let template = sqlx::query_as::<_, OsTemplate>(
        "SELECT * FROM os_templates WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("OS template not found".to_string()))?;

    Ok(Json(template))
}

async fn create_template(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<CreateOsTemplateRequest>,
) -> Result<Json<OsTemplate>, AppError> {
    // Only admins can create templates
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden);
    }

    let template = sqlx::query_as::<_, OsTemplate>(
        r#"
        INSERT INTO os_templates (name, display_name, min_storage_gb, vsphere_template_name)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#
    )
    .bind(&payload.name)
    .bind(&payload.display_name)
    .bind(payload.min_storage_gb)
    .bind(&payload.vsphere_template_name)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(template))
}

async fn update_template(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateOsTemplateRequest>,
) -> Result<Json<OsTemplate>, AppError> {
    // Only admins can update templates
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden);
    }

    let template = sqlx::query_as::<_, OsTemplate>(
        r#"
        UPDATE os_templates
        SET display_name = COALESCE($1, display_name),
            min_storage_gb = COALESCE($2, min_storage_gb),
            vsphere_template_name = COALESCE($3, vsphere_template_name),
            is_active = COALESCE($4, is_active),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
        "#
    )
    .bind(&payload.display_name)
    .bind(payload.min_storage_gb)
    .bind(&payload.vsphere_template_name)
    .bind(payload.is_active)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("OS template not found".to_string()))?;

    Ok(Json(template))
}

async fn delete_template(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Only admins can delete templates
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden);
    }

    // Soft delete by setting is_active to false
    sqlx::query(
        "UPDATE os_templates SET is_active = false, updated_at = NOW() WHERE id = $1"
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({"message": "Template deactivated"})))
}
