use chrono::Utc;
use sqlx::PgPool;
use std::path::Path;
use std::process::Command;
use uuid::Uuid;

use crate::models::{DeletionStep, DeletionUpdate, ProvisionedVm};
use crate::services::progress_broadcaster::ProgressBroadcaster;

pub struct DeletionService {
    pool: PgPool,
    progress_broadcaster: ProgressBroadcaster,
}

#[derive(Debug)]
pub struct DeletionResult {
    pub success: bool,
    pub message: String,
}

impl DeletionService {
    pub fn new(pool: PgPool, progress_broadcaster: ProgressBroadcaster) -> Self {
        Self {
            pool,
            progress_broadcaster,
        }
    }

    /// Delete a VM with progress tracking
    pub async fn delete_vm(&self, vm: &ProvisionedVm) -> DeletionResult {
        let vm_id = vm.id;

        // Create deletion progress record
        if let Err(e) = self.create_deletion_progress(vm_id).await {
            tracing::error!("Failed to create deletion progress record: {}", e);
        }

        // Step 1: Initializing
        self.update_progress(vm_id, DeletionStep::Initializing, "Preparing to delete VM").await;

        // Step 2: Destroying Infrastructure
        self.update_progress(vm_id, DeletionStep::DestroyingInfrastructure, "Running Terraform destroy").await;

        if let Some(state_path) = &vm.terraform_state_path {
            let workspace_dir = Path::new(state_path).parent();

            if let Some(workspace) = workspace_dir {
                if workspace.exists() {
                    let output = Command::new("terraform")
                        .args(["destroy", "-auto-approve", "-no-color"])
                        .current_dir(workspace)
                        .output();

                    match output {
                        Ok(output) => {
                            if !output.status.success() {
                                let stderr = String::from_utf8_lossy(&output.stderr);
                                tracing::error!("Terraform destroy failed: {}", stderr);
                                // Continue anyway to mark as deleted
                                self.update_progress(vm_id, DeletionStep::DestroyingInfrastructure,
                                    &format!("Terraform destroy completed with warnings: {}",
                                        stderr.chars().take(200).collect::<String>())).await;
                            } else {
                                self.update_progress(vm_id, DeletionStep::DestroyingInfrastructure,
                                    "Terraform destroy completed successfully").await;
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to run terraform destroy: {}", e);
                            self.update_progress(vm_id, DeletionStep::DestroyingInfrastructure,
                                &format!("Warning: Could not run terraform destroy: {}", e)).await;
                        }
                    }
                } else {
                    self.update_progress(vm_id, DeletionStep::DestroyingInfrastructure,
                        "Workspace not found, skipping terraform destroy").await;
                }
            }
        } else {
            self.update_progress(vm_id, DeletionStep::DestroyingInfrastructure,
                "No terraform state path, skipping terraform destroy").await;
        }

        // Step 3: Releasing Resources
        self.update_progress(vm_id, DeletionStep::ReleasingResources, "Releasing IP address and cleaning up").await;

        // Mark VM as deleted
        if let Err(e) = sqlx::query(
            "UPDATE provisioned_vms SET status = 'deleted', deleted_at = NOW() WHERE id = $1"
        )
        .bind(vm_id)
        .execute(&self.pool)
        .await {
            tracing::error!("Failed to mark VM as deleted: {}", e);
            self.update_progress_error(vm_id, DeletionStep::Failed, &format!("Failed to update VM status: {}", e)).await;
            return DeletionResult {
                success: false,
                message: format!("Failed to update VM status: {}", e),
            };
        }

        // Release the IP address
        if let Err(e) = sqlx::query(
            "UPDATE ip_addresses SET status = 'available', assigned_vm_config_id = NULL, updated_at = NOW() WHERE assigned_vm_config_id = $1"
        )
        .bind(vm.vm_config_id)
        .execute(&self.pool)
        .await {
            tracing::warn!("Failed to release IP address: {}", e);
        }

        self.update_progress(vm_id, DeletionStep::ReleasingResources, "Resources released").await;

        // Step 4: Completed
        self.update_progress(vm_id, DeletionStep::Completed, "VM deleted successfully").await;

        // Mark deletion progress as completed
        if let Err(e) = self.complete_deletion_progress(vm_id).await {
            tracing::error!("Failed to complete deletion progress: {}", e);
        }

        // Cleanup the broadcast channel after a short delay
        let broadcaster = self.progress_broadcaster.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            broadcaster.cleanup_deletion(vm_id).await;
        });

        DeletionResult {
            success: true,
            message: "VM deleted successfully".to_string(),
        }
    }

    async fn create_deletion_progress(&self, vm_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO deletion_progress (provisioned_vm_id, current_step, step_index, total_steps)
            VALUES ($1, 'initializing', 0, 4)
            "#
        )
        .bind(vm_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_progress(&self, vm_id: Uuid, step: DeletionStep, message: &str) {
        // Update database
        if let Err(e) = sqlx::query(
            r#"
            UPDATE deletion_progress
            SET current_step = $1, step_index = $2, step_message = $3, updated_at = NOW()
            WHERE provisioned_vm_id = $4
            "#
        )
        .bind(step.as_str())
        .bind(step.index())
        .bind(message)
        .bind(vm_id)
        .execute(&self.pool)
        .await {
            tracing::error!("Failed to update deletion progress: {}", e);
        }

        // Broadcast update
        let is_complete = matches!(step, DeletionStep::Completed);
        let update = DeletionUpdate {
            vm_id: vm_id.to_string(),
            step: step.as_str().to_string(),
            step_index: step.index(),
            total_steps: DeletionStep::total_steps(),
            message: message.to_string(),
            is_complete,
            is_error: false,
            timestamp: Utc::now(),
        };

        self.progress_broadcaster.broadcast_deletion(update).await;
    }

    async fn update_progress_error(&self, vm_id: Uuid, step: DeletionStep, error: &str) {
        // Update database with error
        if let Err(e) = sqlx::query(
            r#"
            UPDATE deletion_progress
            SET current_step = $1, step_index = $2, error_message = $3, updated_at = NOW()
            WHERE provisioned_vm_id = $4
            "#
        )
        .bind(step.as_str())
        .bind(step.index())
        .bind(error)
        .bind(vm_id)
        .execute(&self.pool)
        .await {
            tracing::error!("Failed to update deletion progress with error: {}", e);
        }

        // Broadcast error
        let update = DeletionUpdate {
            vm_id: vm_id.to_string(),
            step: step.as_str().to_string(),
            step_index: step.index(),
            total_steps: DeletionStep::total_steps(),
            message: error.to_string(),
            is_complete: true,
            is_error: true,
            timestamp: Utc::now(),
        };

        self.progress_broadcaster.broadcast_deletion(update).await;
    }

    async fn complete_deletion_progress(&self, vm_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE deletion_progress
            SET completed_at = NOW(), updated_at = NOW()
            WHERE provisioned_vm_id = $1
            "#
        )
        .bind(vm_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
