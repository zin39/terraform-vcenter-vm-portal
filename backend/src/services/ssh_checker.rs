use chrono::Utc;
use sqlx::PgPool;
use std::net::{IpAddr, SocketAddr};
use std::str::FromStr;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;
use uuid::Uuid;

use crate::models::{SshVerificationUpdate, VmConfig};
use crate::services::progress_broadcaster::ProgressBroadcaster;

const SSH_PORT: u16 = 22;
const CONNECTION_TIMEOUT: Duration = Duration::from_secs(5);
const RETRY_DELAY: Duration = Duration::from_secs(10);
const MAX_RETRIES: i32 = 12; // 12 retries * 10 seconds = 2 minutes total

pub struct SshChecker {
    pool: PgPool,
    progress_broadcaster: ProgressBroadcaster,
}

impl SshChecker {
    pub fn new(pool: PgPool, progress_broadcaster: ProgressBroadcaster) -> Self {
        Self {
            pool,
            progress_broadcaster,
        }
    }

    /// Check SSH connectivity for all VMs in a request
    pub async fn check_all_vms(&self, request_id: Uuid, vms: &[VmConfig]) -> bool {
        let mut all_reachable = true;

        for vm in vms {
            // Create or update SSH verification record
            if let Err(e) = self.create_ssh_verification(request_id, vm).await {
                tracing::error!("Failed to create SSH verification record: {}", e);
            }

            let reachable = self.check_vm_ssh(request_id, vm).await;
            if !reachable {
                all_reachable = false;
            }
        }

        all_reachable
    }

    async fn create_ssh_verification(&self, request_id: Uuid, vm: &VmConfig) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO ssh_verification (vm_request_id, vm_config_id, ip_address)
            VALUES ($1, $2, $3)
            ON CONFLICT (vm_config_id) DO UPDATE SET
                last_checked_at = NOW(),
                updated_at = NOW()
            "#
        )
        .bind(request_id)
        .bind(vm.id)
        .bind(&vm.ip_address)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Check SSH connectivity for a single VM with retries
    async fn check_vm_ssh(&self, request_id: Uuid, vm: &VmConfig) -> bool {
        let ip = match IpAddr::from_str(&vm.ip_address) {
            Ok(ip) => ip,
            Err(e) => {
                tracing::error!("Invalid IP address {}: {}", vm.ip_address, e);
                self.broadcast_update(request_id, vm, false, 0, None, Some(format!("Invalid IP: {}", e))).await;
                return false;
            }
        };

        let socket_addr = SocketAddr::new(ip, SSH_PORT);

        for attempt in 1..=MAX_RETRIES {
            tracing::info!(
                "SSH check attempt {}/{} for {} ({})",
                attempt,
                MAX_RETRIES,
                vm.vm_name,
                vm.ip_address
            );

            let start = Instant::now();
            let result = timeout(CONNECTION_TIMEOUT, TcpStream::connect(&socket_addr)).await;

            match result {
                Ok(Ok(_stream)) => {
                    let latency_ms = start.elapsed().as_millis() as i32;
                    tracing::info!(
                        "SSH reachable for {} ({}) - latency: {}ms",
                        vm.vm_name,
                        vm.ip_address,
                        latency_ms
                    );

                    // Update database
                    if let Err(e) = self.update_ssh_verification(vm.id, true, Some(latency_ms), attempt, None).await {
                        tracing::error!("Failed to update SSH verification: {}", e);
                    }

                    // Broadcast success
                    self.broadcast_update(request_id, vm, true, attempt, Some(latency_ms), None).await;
                    return true;
                }
                Ok(Err(e)) => {
                    tracing::debug!(
                        "SSH connection failed for {} ({}): {} (attempt {}/{})",
                        vm.vm_name,
                        vm.ip_address,
                        e,
                        attempt,
                        MAX_RETRIES
                    );

                    // Broadcast attempt
                    self.broadcast_update(
                        request_id,
                        vm,
                        false,
                        attempt,
                        None,
                        Some(e.to_string()),
                    ).await;
                }
                Err(_) => {
                    tracing::debug!(
                        "SSH connection timeout for {} ({}) (attempt {}/{})",
                        vm.vm_name,
                        vm.ip_address,
                        attempt,
                        MAX_RETRIES
                    );

                    // Broadcast attempt
                    self.broadcast_update(
                        request_id,
                        vm,
                        false,
                        attempt,
                        None,
                        Some("Connection timeout".to_string()),
                    ).await;
                }
            }

            // Update database with failure
            if let Err(e) = self.update_ssh_verification(vm.id, false, None, attempt, Some("Connection failed")).await {
                tracing::error!("Failed to update SSH verification: {}", e);
            }

            // Wait before next retry (unless this is the last attempt)
            if attempt < MAX_RETRIES {
                tokio::time::sleep(RETRY_DELAY).await;
            }
        }

        tracing::warn!(
            "SSH verification failed for {} ({}) after {} attempts",
            vm.vm_name,
            vm.ip_address,
            MAX_RETRIES
        );

        false
    }

    async fn update_ssh_verification(
        &self,
        vm_config_id: Uuid,
        is_reachable: bool,
        latency_ms: Option<i32>,
        check_count: i32,
        error_message: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE ssh_verification
            SET is_reachable = $1, latency_ms = $2, check_count = $3, error_message = $4,
                last_checked_at = NOW(), updated_at = NOW()
            WHERE vm_config_id = $5
            "#
        )
        .bind(is_reachable)
        .bind(latency_ms)
        .bind(check_count)
        .bind(error_message)
        .bind(vm_config_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn broadcast_update(
        &self,
        request_id: Uuid,
        vm: &VmConfig,
        is_reachable: bool,
        attempt: i32,
        latency_ms: Option<i32>,
        error_message: Option<String>,
    ) {
        let update = SshVerificationUpdate {
            request_id: request_id.to_string(),
            vm_config_id: vm.id.to_string(),
            vm_name: vm.vm_name.clone(),
            ip_address: vm.ip_address.clone(),
            is_reachable,
            attempt,
            max_attempts: MAX_RETRIES,
            latency_ms,
            error_message,
            timestamp: Utc::now(),
        };

        self.progress_broadcaster.broadcast_ssh_verification(update).await;
    }
}
