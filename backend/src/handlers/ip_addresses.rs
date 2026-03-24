use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::AuthUser,
    models::{
        IpAddress, IpAddressResponse, CreateIpAddressRequest, BulkCreateIpAddressRequest,
        UpdateIpAddressRequest, ListAvailableIpsQuery, UserRole,
    },
    AppState,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_ips).post(create_ip))
        .route("/available", get(list_available_ips))
        .route("/bulk", axum::routing::post(bulk_create_ips))
        .route("/:id", get(get_ip).put(update_ip).delete(delete_ip))
}

async fn list_ips(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ListAvailableIpsQuery>,
) -> Result<Json<Vec<IpAddressResponse>>, AppError> {
    // Only admins and approvers can see all IPs
    if auth_user.role == UserRole::Requester {
        return Err(AppError::Forbidden);
    }

    let ips = sqlx::query_as::<_, IpAddress>(
        "SELECT * FROM ip_addresses WHERE network_id = $1 ORDER BY ip_address"
    )
    .bind(query.network_id)
    .fetch_all(&state.db)
    .await?;

    let responses: Vec<IpAddressResponse> = ips.into_iter().map(|ip| ip.into()).collect();
    Ok(Json(responses))
}

async fn list_available_ips(
    State(state): State<AppState>,
    _auth_user: AuthUser,
    Query(query): Query<ListAvailableIpsQuery>,
) -> Result<Json<Vec<IpAddressResponse>>, AppError> {
    let ips = sqlx::query_as::<_, IpAddress>(
        "SELECT * FROM ip_addresses WHERE network_id = $1 AND status = 'available' ORDER BY ip_address"
    )
    .bind(query.network_id)
    .fetch_all(&state.db)
    .await?;

    let responses: Vec<IpAddressResponse> = ips.into_iter().map(|ip| ip.into()).collect();
    Ok(Json(responses))
}

async fn get_ip(
    State(state): State<AppState>,
    _auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<IpAddressResponse>, AppError> {
    let ip = sqlx::query_as::<_, IpAddress>(
        "SELECT * FROM ip_addresses WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("IP address not found".to_string()))?;

    Ok(Json(ip.into()))
}

async fn create_ip(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<CreateIpAddressRequest>,
) -> Result<Json<IpAddressResponse>, AppError> {
    // Only admins can create IPs
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden);
    }

    let status = payload.status.unwrap_or_else(|| "available".to_string());

    let ip = sqlx::query_as::<_, IpAddress>(
        r#"
        INSERT INTO ip_addresses (ip_address, network_id, status, hostname, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#
    )
    .bind(&payload.ip_address)
    .bind(payload.network_id)
    .bind(&status)
    .bind(&payload.hostname)
    .bind(&payload.description)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(ip.into()))
}

async fn bulk_create_ips(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<BulkCreateIpAddressRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Only admins can bulk create IPs
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden);
    }

    let mut created = 0;
    let mut skipped = 0;

    for entry in payload.ip_addresses {
        let status = entry.status.unwrap_or_else(|| "available".to_string());

        let result = sqlx::query(
            r#"
            INSERT INTO ip_addresses (ip_address, network_id, status, hostname, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (ip_address, network_id) DO NOTHING
            "#
        )
        .bind(&entry.ip_address)
        .bind(payload.network_id)
        .bind(&status)
        .bind(&entry.hostname)
        .bind(&entry.description)
        .execute(&state.db)
        .await?;

        if result.rows_affected() > 0 {
            created += 1;
        } else {
            skipped += 1;
        }
    }

    Ok(Json(serde_json::json!({
        "created": created,
        "skipped": skipped,
        "message": format!("Created {} IP addresses, skipped {} duplicates", created, skipped)
    })))
}

async fn update_ip(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateIpAddressRequest>,
) -> Result<Json<IpAddressResponse>, AppError> {
    // Only admins can update IPs
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden);
    }

    let ip = sqlx::query_as::<_, IpAddress>(
        r#"
        UPDATE ip_addresses
        SET status = COALESCE($1, status),
            hostname = COALESCE($2, hostname),
            description = COALESCE($3, description),
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
        "#
    )
    .bind(&payload.status)
    .bind(&payload.hostname)
    .bind(&payload.description)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("IP address not found".to_string()))?;

    Ok(Json(ip.into()))
}

async fn delete_ip(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Only admins can delete IPs
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden);
    }

    // Check if IP is in use
    let ip = sqlx::query_as::<_, IpAddress>(
        "SELECT * FROM ip_addresses WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("IP address not found".to_string()))?;

    if ip.status == "in_use" {
        return Err(AppError::Validation("Cannot delete IP that is in use".to_string()));
    }

    sqlx::query("DELETE FROM ip_addresses WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({"message": "IP address deleted"})))
}
