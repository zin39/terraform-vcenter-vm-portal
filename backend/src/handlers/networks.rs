use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::error::AppError;
use crate::middleware::{require_admin, AuthUser};
use crate::models::{CreateNetworkRequest, Network, NetworkResponse, UpdateNetworkRequest};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct ListNetworksQuery {
    pub include_inactive: Option<bool>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedNetworks {
    pub data: Vec<NetworkResponse>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_networks).post(create_network))
        .route("/:id", get(get_network).put(update_network).delete(delete_network))
}

async fn list_networks(
    State(state): State<AppState>,
    _auth_user: AuthUser,
    Query(query): Query<ListNetworksQuery>,
) -> Result<Json<PaginatedNetworks>, AppError> {
    let include_inactive = query.include_inactive.unwrap_or(false);
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(50).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let (networks, total) = if include_inactive {
        let networks = sqlx::query_as::<_, Network>(
            "SELECT * FROM networks ORDER BY name LIMIT $1 OFFSET $2",
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM networks")
            .fetch_one(&state.db)
            .await?;

        (networks, total)
    } else {
        let networks = sqlx::query_as::<_, Network>(
            "SELECT * FROM networks WHERE is_active = true ORDER BY name LIMIT $1 OFFSET $2",
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

        let total = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM networks WHERE is_active = true",
        )
        .fetch_one(&state.db)
        .await?;

        (networks, total)
    };

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(Json(PaginatedNetworks {
        data: networks.into_iter().map(NetworkResponse::from).collect(),
        total,
        page,
        per_page,
        total_pages,
    }))
}

async fn get_network(
    State(state): State<AppState>,
    _auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<NetworkResponse>, AppError> {
    let network = sqlx::query_as::<_, Network>("SELECT * FROM networks WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("Network not found".to_string()))?;

    Ok(Json(network.into()))
}

async fn create_network(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<CreateNetworkRequest>,
) -> Result<Json<NetworkResponse>, AppError> {
    require_admin(&auth_user)?;

    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Check for duplicate vsphere_network_name
    let existing = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM networks WHERE vsphere_network_name = $1",
    )
    .bind(&payload.vsphere_network_name)
    .fetch_one(&state.db)
    .await?;

    if existing > 0 {
        return Err(AppError::Validation(
            "A network with this vSphere name already exists".to_string(),
        ));
    }

    let network = sqlx::query_as::<_, Network>(
        r#"
        INSERT INTO networks (name, vlan_id, vsphere_network_name, subnet, gateway, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(&payload.name)
    .bind(payload.vlan_id)
    .bind(&payload.vsphere_network_name)
    .bind(&payload.subnet)
    .bind(&payload.gateway)
    .bind(&payload.description)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(network.into()))
}

async fn update_network(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateNetworkRequest>,
) -> Result<Json<NetworkResponse>, AppError> {
    require_admin(&auth_user)?;

    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Check network exists
    let existing = sqlx::query_as::<_, Network>("SELECT * FROM networks WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("Network not found".to_string()))?;

    // Check for duplicate vsphere_network_name if being changed
    if let Some(ref new_name) = payload.vsphere_network_name {
        if new_name != &existing.vsphere_network_name {
            let duplicate = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM networks WHERE vsphere_network_name = $1 AND id != $2",
            )
            .bind(new_name)
            .bind(id)
            .fetch_one(&state.db)
            .await?;

            if duplicate > 0 {
                return Err(AppError::Validation(
                    "A network with this vSphere name already exists".to_string(),
                ));
            }
        }
    }

    let network = sqlx::query_as::<_, Network>(
        r#"
        UPDATE networks
        SET name = COALESCE($1, name),
            vlan_id = COALESCE($2, vlan_id),
            vsphere_network_name = COALESCE($3, vsphere_network_name),
            subnet = COALESCE($4, subnet),
            gateway = COALESCE($5, gateway),
            description = COALESCE($6, description),
            is_active = COALESCE($7, is_active),
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
        "#,
    )
    .bind(&payload.name)
    .bind(payload.vlan_id)
    .bind(&payload.vsphere_network_name)
    .bind(&payload.subnet)
    .bind(&payload.gateway)
    .bind(&payload.description)
    .bind(payload.is_active)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(network.into()))
}

async fn delete_network(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_admin(&auth_user)?;

    // Check network exists
    let _ = sqlx::query_as::<_, Network>("SELECT * FROM networks WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("Network not found".to_string()))?;

    // Check if network is in use
    let in_use = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM vm_configs WHERE network_id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    if in_use > 0 {
        // Soft delete - just deactivate
        sqlx::query("UPDATE networks SET is_active = false, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&state.db)
            .await?;

        return Ok(Json(serde_json::json!({
            "message": "Network deactivated (in use by existing VMs)"
        })));
    }

    // Hard delete if not in use
    sqlx::query("DELETE FROM networks WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Network deleted successfully" })))
}
