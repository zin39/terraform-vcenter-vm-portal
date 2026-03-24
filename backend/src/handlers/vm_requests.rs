use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Json, Router,
};
use chrono::Utc;
use uuid::Uuid;
use validator::Validate;

use crate::error::AppError;
use crate::middleware::AuthUser;
use crate::models::{
    CreateVmRequestPayload, ListVmRequestsQuery, Network, OsTemplate, PaginatedVmRequests, RequestStatus,
    ReviewVmRequest, UserRole, VmConfig, VmConfigResponse, VmRequest, VmRequestResponse,
};
use crate::services::provisioning::ProvisioningService;
use crate::utils::encrypt;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_requests).post(create_request))
        .route("/:id", get(get_request).delete(cancel_request))
        .route("/:id/review", put(review_request))
        .route("/:id/retry", post(retry_provisioning))
}

async fn create_request(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<CreateVmRequestPayload>,
) -> Result<Json<VmRequestResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Ensure at least one VM is provided
    if payload.vms.is_empty() {
        return Err(AppError::Validation("At least one VM configuration is required".to_string()));
    }

    // Validate each VM config
    for vm in &payload.vms {
        vm.validate()
            .map_err(|e| AppError::Validation(format!("VM '{}': {}", vm.vm_name, e)))?;
    }

    // Check for duplicate VM names (case-insensitive)
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    for vm in &payload.vms {
        let name_lower = vm.vm_name.to_lowercase();
        if !seen_names.insert(name_lower) {
            return Err(AppError::Validation(format!(
                "Duplicate VM name: '{}'. Each VM must have a unique name.",
                vm.vm_name
            )));
        }
    }

    // Check for duplicate IP addresses
    let mut seen_ips: std::collections::HashSet<&str> = std::collections::HashSet::new();
    for vm in &payload.vms {
        if !seen_ips.insert(&vm.ip_address) {
            return Err(AppError::Validation(format!(
                "Duplicate IP address: '{}'. Each VM must have a unique IP address.",
                vm.ip_address
            )));
        }
    }

    // Fetch OS templates for validation
    let os_templates = sqlx::query_as::<_, OsTemplate>(
        "SELECT * FROM os_templates WHERE is_active = true"
    )
    .fetch_all(&state.db)
    .await?;

    let templates_map: std::collections::HashMap<String, OsTemplate> = os_templates
        .into_iter()
        .map(|t| (t.name.clone(), t))
        .collect();

    // Validate OS type and minimum storage for each VM
    for vm in &payload.vms {
        let template = templates_map.get(&vm.os_type).ok_or_else(|| {
            AppError::Validation(format!(
                "VM '{}': Invalid OS type '{}'. Available options: {}",
                vm.vm_name,
                vm.os_type,
                templates_map.keys().cloned().collect::<Vec<_>>().join(", ")
            ))
        })?;

        if vm.storage_gb < template.min_storage_gb {
            return Err(AppError::Validation(format!(
                "VM '{}': Storage ({} GB) is below minimum required for {} ({} GB)",
                vm.vm_name, vm.storage_gb, template.display_name, template.min_storage_gb
            )));
        }
    }

    // Start a transaction
    let mut tx = state.db.begin().await?;

    // Create the request
    let request = sqlx::query_as::<_, VmRequest>(
        r#"
        INSERT INTO vm_requests (requester_id, title, description, purpose)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(auth_user.id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.purpose)
    .fetch_one(&mut *tx)
    .await?;

    // Create each VM config
    let mut vm_configs = Vec::new();
    for vm in &payload.vms {
        // Encrypt password if provided
        let encrypted_password = vm.password.as_ref().map(|p| {
            encrypt(p, &state.config.encryption_key)
                .unwrap_or_else(|_| p.clone()) // Fallback to plain if encryption fails
        });

        let config = sqlx::query_as::<_, VmConfig>(
            r#"
            INSERT INTO vm_configs (request_id, vm_name, cpu_cores, ram_gb, storage_gb, os_type, ip_address, gateway, dns_primary, dns_secondary, username, password, network_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
            "#,
        )
        .bind(request.id)
        .bind(&vm.vm_name)
        .bind(vm.cpu_cores)
        .bind(vm.ram_gb)
        .bind(vm.storage_gb)
        .bind(&vm.os_type)
        .bind(&vm.ip_address)
        .bind(&vm.gateway)
        .bind(&vm.dns_primary)
        .bind(&vm.dns_secondary)
        .bind(&vm.username)
        .bind(&encrypted_password)
        .bind(vm.network_id)
        .fetch_one(&mut *tx)
        .await?;

        vm_configs.push(config);
    }

    // Commit transaction
    tx.commit().await?;

    let requester_name = sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
        .bind(auth_user.id)
        .fetch_optional(&state.db)
        .await?;

    let networks = fetch_networks_map(&state.db).await?;

    Ok(Json(to_response(request, requester_name, None, vm_configs, &networks)))
}

async fn list_requests(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ListVmRequestsQuery>,
) -> Result<Json<PaginatedVmRequests>, AppError> {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // Admins and approvers see all requests, requesters see only their own
    let (requests, total): (Vec<VmRequest>, i64) = match auth_user.role {
        UserRole::Admin | UserRole::Approver => {
            let requests = if let Some(status) = query.status {
                sqlx::query_as::<_, VmRequest>(
                    "SELECT * FROM vm_requests WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                )
                .bind(status)
                .bind(per_page)
                .bind(offset)
                .fetch_all(&state.db)
                .await?
            } else {
                sqlx::query_as::<_, VmRequest>(
                    "SELECT * FROM vm_requests ORDER BY created_at DESC LIMIT $1 OFFSET $2",
                )
                .bind(per_page)
                .bind(offset)
                .fetch_all(&state.db)
                .await?
            };

            let total = if let Some(status) = query.status {
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM vm_requests WHERE status = $1")
                    .bind(status)
                    .fetch_one(&state.db)
                    .await?
            } else {
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM vm_requests")
                    .fetch_one(&state.db)
                    .await?
            };

            (requests, total)
        }
        UserRole::Requester => {
            let requests = if let Some(status) = query.status {
                sqlx::query_as::<_, VmRequest>(
                    "SELECT * FROM vm_requests WHERE requester_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
                )
                .bind(auth_user.id)
                .bind(status)
                .bind(per_page)
                .bind(offset)
                .fetch_all(&state.db)
                .await?
            } else {
                sqlx::query_as::<_, VmRequest>(
                    "SELECT * FROM vm_requests WHERE requester_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                )
                .bind(auth_user.id)
                .bind(per_page)
                .bind(offset)
                .fetch_all(&state.db)
                .await?
            };

            let total = if let Some(status) = query.status {
                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM vm_requests WHERE requester_id = $1 AND status = $2",
                )
                .bind(auth_user.id)
                .bind(status)
                .fetch_one(&state.db)
                .await?
            } else {
                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM vm_requests WHERE requester_id = $1",
                )
                .bind(auth_user.id)
                .fetch_one(&state.db)
                .await?
            };

            (requests, total)
        }
    };

    // Fetch user names and VM configs for all requests
    let responses = fetch_request_responses(&state, requests).await?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(Json(PaginatedVmRequests {
        data: responses,
        total,
        page,
        per_page,
        total_pages,
    }))
}

async fn get_request(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<VmRequestResponse>, AppError> {
    let request = sqlx::query_as::<_, VmRequest>("SELECT * FROM vm_requests WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("VM request not found".to_string()))?;

    // Check access: admins/approvers can see all, requesters only their own
    if auth_user.role == UserRole::Requester && request.requester_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    // Fetch VM configs
    let vm_configs = sqlx::query_as::<_, VmConfig>(
        "SELECT * FROM vm_configs WHERE request_id = $1 ORDER BY created_at",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let requester_name =
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(request.requester_id)
            .fetch_optional(&state.db)
            .await?;

    let reviewer_name = if let Some(reviewer_id) = request.reviewed_by {
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(reviewer_id)
            .fetch_optional(&state.db)
            .await?
    } else {
        None
    };

    let networks = fetch_networks_map(&state.db).await?;

    Ok(Json(to_response(request, requester_name, reviewer_name, vm_configs, &networks)))
}

async fn review_request(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReviewVmRequest>,
) -> Result<Json<VmRequestResponse>, AppError> {
    // Only admins and approvers can review
    if auth_user.role == UserRole::Requester {
        return Err(AppError::Forbidden);
    }

    // Can only approve or reject
    if payload.status != RequestStatus::Approved && payload.status != RequestStatus::Rejected {
        return Err(AppError::Validation(
            "Can only approve or reject a request".to_string(),
        ));
    }

    payload
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Check request exists and is pending
    let existing = sqlx::query_as::<_, VmRequest>("SELECT * FROM vm_requests WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("VM request not found".to_string()))?;

    if existing.status != RequestStatus::Pending {
        return Err(AppError::Validation(
            "Can only review pending requests".to_string(),
        ));
    }

    // Determine the initial status - if approved, set to provisioning
    let initial_status = if payload.status == RequestStatus::Approved {
        RequestStatus::Provisioning
    } else {
        payload.status
    };

    let request = sqlx::query_as::<_, VmRequest>(
        r#"
        UPDATE vm_requests
        SET status = $1, reviewed_by = $2, reviewed_at = $3, review_notes = $4
        WHERE id = $5
        RETURNING *
        "#,
    )
    .bind(initial_status)
    .bind(auth_user.id)
    .bind(Utc::now())
    .bind(&payload.review_notes)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    // Fetch VM configs
    let vm_configs = sqlx::query_as::<_, VmConfig>(
        "SELECT * FROM vm_configs WHERE request_id = $1 ORDER BY created_at",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    // If approved, trigger provisioning asynchronously
    if payload.status == RequestStatus::Approved {
        let provisioning_service = ProvisioningService::new(
            state.config.terraform_workspace_dir.clone(),
            state.config.vsphere.clone(),
            state.db.clone(),
            state.config.encryption_key,
            state.progress_broadcaster.clone(),
        );

        let request_clone = request.clone();
        let vm_configs_clone = vm_configs.clone();

        // Spawn async task for provisioning
        tokio::spawn(async move {
            tracing::info!("Starting provisioning for request {}", request_clone.id);
            let result = provisioning_service
                .provision_request(&request_clone, &vm_configs_clone)
                .await;

            if result.success {
                tracing::info!(
                    "Provisioning completed successfully for request {}",
                    request_clone.id
                );
            } else {
                tracing::error!(
                    "Provisioning failed for request {}: {}",
                    request_clone.id,
                    result.message
                );
            }
        });
    }

    let requester_name =
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(request.requester_id)
            .fetch_optional(&state.db)
            .await?;

    let reviewer_name =
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(auth_user.id)
            .fetch_optional(&state.db)
            .await?;

    let networks = fetch_networks_map(&state.db).await?;

    Ok(Json(to_response(request, requester_name, reviewer_name, vm_configs, &networks)))
}

async fn cancel_request(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Fetch the request
    let request = sqlx::query_as::<_, VmRequest>("SELECT * FROM vm_requests WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("VM request not found".to_string()))?;

    // Only the requester can cancel their own request
    if request.requester_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    // Can only cancel pending requests
    if request.status != RequestStatus::Pending {
        return Err(AppError::Validation(
            "Can only cancel pending requests".to_string(),
        ));
    }

    // Start a transaction
    let mut tx = state.db.begin().await?;

    // Delete VM configs first (foreign key constraint)
    sqlx::query("DELETE FROM vm_configs WHERE request_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    // Delete the request
    sqlx::query("DELETE FROM vm_requests WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    // Commit transaction
    tx.commit().await?;

    Ok(Json(serde_json::json!({ "message": "Request cancelled successfully" })))
}

async fn fetch_networks_map(
    pool: &sqlx::PgPool,
) -> Result<std::collections::HashMap<Uuid, String>, AppError> {
    let networks = sqlx::query_as::<_, Network>("SELECT * FROM networks")
        .fetch_all(pool)
        .await?;

    Ok(networks.into_iter().map(|n| (n.id, n.name)).collect())
}

fn to_response(
    request: VmRequest,
    requester_name: Option<String>,
    reviewer_name: Option<String>,
    vm_configs: Vec<VmConfig>,
    networks: &std::collections::HashMap<Uuid, String>,
) -> VmRequestResponse {
    VmRequestResponse {
        id: request.id,
        requester_id: request.requester_id,
        requester_name,
        title: request.title,
        description: request.description,
        purpose: request.purpose,
        status: request.status,
        reviewed_by: request.reviewed_by,
        reviewer_name,
        reviewed_at: request.reviewed_at,
        review_notes: request.review_notes,
        retry_count: request.retry_count,
        last_error: request.last_error,
        created_at: request.created_at,
        updated_at: request.updated_at,
        vms: vm_configs
            .into_iter()
            .map(|config| {
                let network_name = config
                    .network_id
                    .and_then(|id| networks.get(&id).cloned());
                let mut response = VmConfigResponse::from(config);
                response.network_name = network_name;
                response
            })
            .collect(),
    }
}

async fn fetch_request_responses(
    state: &AppState,
    requests: Vec<VmRequest>,
) -> Result<Vec<VmRequestResponse>, AppError> {
    let mut responses = Vec::with_capacity(requests.len());

    // Fetch all networks once for efficiency
    let networks = fetch_networks_map(&state.db).await?;

    for request in requests {
        // Fetch VM configs for this request
        let vm_configs = sqlx::query_as::<_, VmConfig>(
            "SELECT * FROM vm_configs WHERE request_id = $1 ORDER BY created_at",
        )
        .bind(request.id)
        .fetch_all(&state.db)
        .await?;

        let requester_name =
            sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
                .bind(request.requester_id)
                .fetch_optional(&state.db)
                .await?;

        let reviewer_name = if let Some(reviewer_id) = request.reviewed_by {
            sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
                .bind(reviewer_id)
                .fetch_optional(&state.db)
                .await?
        } else {
            None
        };

        responses.push(to_response(request, requester_name, reviewer_name, vm_configs, &networks));
    }

    Ok(responses)
}

async fn retry_provisioning(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<VmRequestResponse>, AppError> {
    // Only admins and approvers can retry provisioning
    if auth_user.role == UserRole::Requester {
        return Err(AppError::Forbidden);
    }

    // Fetch the request
    let request = sqlx::query_as::<_, VmRequest>("SELECT * FROM vm_requests WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("VM request not found".to_string()))?;

    // Can only retry failed requests
    if request.status != RequestStatus::Failed {
        return Err(AppError::Validation(
            "Can only retry failed requests".to_string(),
        ));
    }

    // Update status to provisioning and increment retry count
    let request = sqlx::query_as::<_, VmRequest>(
        r#"
        UPDATE vm_requests
        SET status = $1, retry_count = retry_count + 1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
        "#,
    )
    .bind(RequestStatus::Provisioning)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    // Fetch VM configs
    let vm_configs = sqlx::query_as::<_, VmConfig>(
        "SELECT * FROM vm_configs WHERE request_id = $1 ORDER BY created_at",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    // Start provisioning
    let provisioning_service = ProvisioningService::new(
        state.config.terraform_workspace_dir.clone(),
        state.config.vsphere.clone(),
        state.db.clone(),
        state.config.encryption_key,
        state.progress_broadcaster.clone(),
    );

    let request_clone = request.clone();
    let vm_configs_clone = vm_configs.clone();

    // Spawn async task for provisioning
    tokio::spawn(async move {
        tracing::info!("Retrying provisioning for request {}", request_clone.id);
        let result = provisioning_service
            .provision_request(&request_clone, &vm_configs_clone)
            .await;

        if result.success {
            tracing::info!(
                "Provisioning retry completed successfully for request {}",
                request_clone.id
            );
        } else {
            tracing::error!(
                "Provisioning retry failed for request {}: {}",
                request_clone.id,
                result.message
            );
        }
    });

    let requester_name =
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(request.requester_id)
            .fetch_optional(&state.db)
            .await?;

    let reviewer_name = if let Some(reviewer_id) = request.reviewed_by {
        sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
            .bind(reviewer_id)
            .fetch_optional(&state.db)
            .await?
    } else {
        None
    };

    let networks = fetch_networks_map(&state.db).await?;

    Ok(Json(to_response(request, requester_name, reviewer_name, vm_configs, &networks)))
}
