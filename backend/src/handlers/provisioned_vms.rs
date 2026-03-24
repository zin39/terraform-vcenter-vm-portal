use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::AuthUser,
    models::{
        ProvisionedVm, ProvisionedVmResponse, ProvisionedVmListResponse,
        ListProvisionedVmsQuery, UserRole,
    },
    services::deletion::DeletionService,
    AppState,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_vms))
        .route("/:id", get(get_vm).delete(delete_vm))
}

async fn list_vms(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ListProvisionedVmsQuery>,
) -> Result<Json<ProvisionedVmListResponse>, AppError> {
    // Only admins and approvers can see provisioned VMs
    if auth_user.role == UserRole::Requester {
        return Err(AppError::Forbidden);
    }

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let status_filter = query.status.unwrap_or_else(|| "running".to_string());

    // Get total count
    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM provisioned_vms WHERE status = $1"
    )
    .bind(&status_filter)
    .fetch_one(&state.db)
    .await?;

    // Get VMs with related data
    let vms = sqlx::query_as::<_, ProvisionedVm>(
        r#"
        SELECT pv.* FROM provisioned_vms pv
        WHERE pv.status = $1
        ORDER BY pv.provisioned_at DESC
        LIMIT $2 OFFSET $3
        "#
    )
    .bind(&status_filter)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    // Build responses with related data
    let mut responses = Vec::new();
    for vm in vms {
        // Get provisioner name
        let provisioner: Option<(String,)> = sqlx::query_as(
            "SELECT full_name FROM users WHERE id = $1"
        )
        .bind(vm.provisioned_by)
        .fetch_optional(&state.db)
        .await?;

        // Get requester name from vm_request
        let requester: Option<(String,)> = sqlx::query_as(
            r#"
            SELECT u.full_name FROM vm_requests vr
            JOIN users u ON vr.requester_id = u.id
            WHERE vr.id = $1
            "#
        )
        .bind(vm.vm_request_id)
        .fetch_optional(&state.db)
        .await?;

        // Get OS template name
        let template_name: Option<(String,)> = if let Some(template_id) = vm.os_template_id {
            sqlx::query_as(
                "SELECT display_name FROM os_templates WHERE id = $1"
            )
            .bind(template_id)
            .fetch_optional(&state.db)
            .await?
        } else {
            None
        };

        responses.push(ProvisionedVmResponse {
            id: vm.id,
            vm_config_id: vm.vm_config_id,
            vm_request_id: vm.vm_request_id,
            vm_name: vm.vm_name,
            ip_address: vm.ip_address.clone(),
            os_template_id: vm.os_template_id,
            os_template_name: template_name.map(|t| t.0),
            cpu_cores: vm.cpu_cores,
            ram_gb: vm.ram_gb,
            storage_gb: vm.storage_gb,
            provisioned_by: vm.provisioned_by,
            provisioned_by_name: provisioner.map(|p| p.0),
            requester_name: requester.map(|r| r.0),
            provisioned_at: vm.provisioned_at,
            status: vm.status,
        });
    }

    Ok(Json(ProvisionedVmListResponse {
        vms: responses,
        total: total.0,
        page,
        per_page,
    }))
}

async fn get_vm(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ProvisionedVmResponse>, AppError> {
    // Only admins and approvers can see VM details
    if auth_user.role == UserRole::Requester {
        return Err(AppError::Forbidden);
    }

    let vm = sqlx::query_as::<_, ProvisionedVm>(
        "SELECT * FROM provisioned_vms WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("VM not found".to_string()))?;

    // Get related data
    let provisioner: Option<(String,)> = sqlx::query_as(
        "SELECT full_name FROM users WHERE id = $1"
    )
    .bind(vm.provisioned_by)
    .fetch_optional(&state.db)
    .await?;

    let requester: Option<(String,)> = sqlx::query_as(
        r#"
        SELECT u.full_name FROM vm_requests vr
        JOIN users u ON vr.requester_id = u.id
        WHERE vr.id = $1
        "#
    )
    .bind(vm.vm_request_id)
    .fetch_optional(&state.db)
    .await?;

    let template_name: Option<(String,)> = if let Some(template_id) = vm.os_template_id {
        sqlx::query_as(
            "SELECT display_name FROM os_templates WHERE id = $1"
        )
        .bind(template_id)
        .fetch_optional(&state.db)
        .await?
    } else {
        None
    };

    Ok(Json(ProvisionedVmResponse {
        id: vm.id,
        vm_config_id: vm.vm_config_id,
        vm_request_id: vm.vm_request_id,
        vm_name: vm.vm_name,
        ip_address: vm.ip_address.clone(),
        os_template_id: vm.os_template_id,
        os_template_name: template_name.map(|t| t.0),
        cpu_cores: vm.cpu_cores,
        ram_gb: vm.ram_gb,
        storage_gb: vm.storage_gb,
        provisioned_by: vm.provisioned_by,
        provisioned_by_name: provisioner.map(|p| p.0),
        requester_name: requester.map(|r| r.0),
        provisioned_at: vm.provisioned_at,
        status: vm.status,
    }))
}

async fn delete_vm(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Only admins and approvers can delete VMs
    if auth_user.role == UserRole::Requester {
        return Err(AppError::Forbidden);
    }

    let vm = sqlx::query_as::<_, ProvisionedVm>(
        "SELECT * FROM provisioned_vms WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("VM not found".to_string()))?;

    if vm.status == "deleted" {
        return Err(AppError::Validation("VM is already deleted".to_string()));
    }

    // Update VM status to "deleting" immediately
    sqlx::query(
        "UPDATE provisioned_vms SET status = 'deleting' WHERE id = $1"
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    let vm_name = vm.vm_name.clone();
    let vm_name_for_response = vm_name.clone();
    let vm_id = vm.id;

    // Use DeletionService for async deletion with progress tracking
    let deletion_service = DeletionService::new(
        state.db.clone(),
        state.progress_broadcaster.clone(),
    );

    // Spawn async task for deletion
    tokio::spawn(async move {
        tracing::info!("Starting deletion for VM {} ({})", vm_name, vm_id);
        let result = deletion_service.delete_vm(&vm).await;

        if result.success {
            tracing::info!("Deletion completed successfully for VM {} ({})", vm_name, vm_id);
        } else {
            tracing::error!("Deletion failed for VM {} ({}): {}", vm_name, vm_id, result.message);
        }
    });

    Ok(Json(serde_json::json!({
        "message": "VM deletion started",
        "vm_id": id,
        "vm_name": vm_name_for_response
    })))
}
