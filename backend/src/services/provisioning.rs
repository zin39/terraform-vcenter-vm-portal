use chrono::Utc;
use sqlx::PgPool;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use uuid::Uuid;
use sha_crypt::{sha512_simple, Sha512Params};

use crate::config::VsphereConfig;
use crate::models::{Network, ProvisioningStep, ProvisioningUpdate, RequestStatus, VmConfig, VmRequest};
use crate::services::progress_broadcaster::ProgressBroadcaster;
use crate::services::ssh_checker::SshChecker;
use crate::utils::decrypt;

/// Hash a password using SHA-512 crypt format for cloud-init compatibility
fn hash_password_for_cloudinit(password: &str) -> String {
    let params = Sha512Params::new(5000).expect("Invalid params");
    sha512_simple(password, &params).expect("Failed to hash password")
}

pub struct ProvisioningService {
    workspace_dir: String,
    vsphere_config: VsphereConfig,
    pool: PgPool,
    encryption_key: [u8; 32],
    progress_broadcaster: ProgressBroadcaster,
}

#[derive(Debug)]
pub struct ProvisioningResult {
    pub success: bool,
    pub message: String,
    pub output: Option<String>,
}

impl ProvisioningService {
    pub fn new(
        workspace_dir: String,
        vsphere_config: VsphereConfig,
        pool: PgPool,
        encryption_key: [u8; 32],
        progress_broadcaster: ProgressBroadcaster,
    ) -> Self {
        Self {
            workspace_dir,
            vsphere_config,
            pool,
            encryption_key,
            progress_broadcaster,
        }
    }

    /// Provision VMs for an approved request
    pub async fn provision_request(
        &self,
        request: &VmRequest,
        vms: &[VmConfig],
    ) -> ProvisioningResult {
        let workspace_path = self.get_workspace_path(request.id);

        // Create provisioning progress record
        if let Err(e) = self.create_provisioning_progress(request.id).await {
            tracing::error!("Failed to create provisioning progress record: {}", e);
        }

        // Step 1: Initializing - Create workspace and generate Terraform config
        self.update_progress(request.id, ProvisioningStep::Initializing, "Creating workspace").await;

        if let Err(e) = fs::create_dir_all(&workspace_path) {
            return self
                .fail_request(request.id, &format!("Failed to create workspace: {}", e))
                .await;
        }

        self.update_progress(request.id, ProvisioningStep::Initializing, "Fetching network configuration").await;

        // Fetch networks for VM network mapping
        let networks = match self.fetch_networks_map().await {
            Ok(n) => n,
            Err(e) => {
                return self
                    .fail_request(request.id, &format!("Failed to fetch networks: {}", e))
                    .await;
            }
        };

        // Decrypt passwords for Terraform config
        let vms_with_decrypted_passwords: Vec<VmConfig> = vms
            .iter()
            .map(|vm| {
                let mut vm_clone = vm.clone();
                if let Some(ref encrypted_password) = vm_clone.password {
                    if let Ok(decrypted) = decrypt(encrypted_password, &self.encryption_key) {
                        vm_clone.password = Some(decrypted);
                    }
                }
                vm_clone
            })
            .collect();

        self.update_progress(request.id, ProvisioningStep::Initializing, "Generating Terraform configuration").await;

        // Generate Terraform configuration
        let tf_config = self.generate_terraform_config(request, &vms_with_decrypted_passwords, &networks);
        let tf_file_path = workspace_path.join("main.tf");
        if let Err(e) = fs::write(&tf_file_path, &tf_config) {
            return self
                .fail_request(request.id, &format!("Failed to write Terraform config: {}", e))
                .await;
        }

        // Generate terraform.tfvars with credentials
        let tfvars = self.generate_tfvars();
        let tfvars_path = workspace_path.join("terraform.tfvars");
        if let Err(e) = fs::write(&tfvars_path, &tfvars) {
            return self
                .fail_request(request.id, &format!("Failed to write tfvars: {}", e))
                .await;
        }

        // Step 2: Creating VM - Run terraform init and apply
        self.update_progress(request.id, ProvisioningStep::CreatingVm, "Running Terraform init").await;

        tracing::info!("Running terraform init for request {}", request.id);
        match self.run_terraform_command(&workspace_path, &["init", "-no-color"]) {
            Ok(output) => {
                tracing::info!("Terraform init succeeded for request {}", request.id);
                tracing::debug!("Init output: {}", output);
            }
            Err(e) => {
                return self
                    .fail_request(request.id, &format!("Terraform init failed: {}", e))
                    .await;
            }
        }

        self.update_progress(request.id, ProvisioningStep::CreatingVm, "Running Terraform apply (this may take several minutes)").await;

        tracing::info!("Running terraform apply for request {}", request.id);
        match self.run_terraform_command(&workspace_path, &["apply", "-auto-approve", "-no-color"]) {
            Ok(output) => {
                tracing::info!("Terraform apply succeeded for request {}", request.id);

                // Step 3: Configuring Network
                self.update_progress(request.id, ProvisioningStep::ConfiguringNetwork, "Cloud-init configuring network settings").await;
                // Note: Network configuration happens via cloud-init during VM boot
                // This step is mostly informational

                // Step 4: Setting up User
                self.update_progress(request.id, ProvisioningStep::SettingUpUser, "Cloud-init creating user account").await;
                // Note: User setup happens via cloud-init during VM boot
                // This step is mostly informational

                // Record provisioned VMs and mark IPs as in_use
                if let Err(e) = self.record_provisioned_vms(request, vms, &workspace_path).await {
                    tracing::error!("Failed to record provisioned VMs: {}", e);
                }

                // Step 5: Verifying SSH
                self.update_progress(request.id, ProvisioningStep::VerifyingSsh, "Checking SSH connectivity").await;

                let ssh_checker = SshChecker::new(self.pool.clone(), self.progress_broadcaster.clone());
                let ssh_success = ssh_checker.check_all_vms(request.id, vms).await;

                if ssh_success {
                    self.update_progress(request.id, ProvisioningStep::VerifyingSsh, "All VMs are SSH reachable").await;
                } else {
                    self.update_progress(request.id, ProvisioningStep::VerifyingSsh, "Some VMs may not be SSH reachable yet").await;
                }

                // Step 6: Completed
                self.update_progress(request.id, ProvisioningStep::Completed, "VMs provisioned successfully").await;

                // Update status to completed
                if let Err(e) = self.update_request_status(request.id, RequestStatus::Completed, None).await {
                    tracing::error!("Failed to update request status: {}", e);
                }

                // Mark provisioning progress as completed
                if let Err(e) = self.complete_provisioning_progress(request.id).await {
                    tracing::error!("Failed to complete provisioning progress: {}", e);
                }

                // Cleanup the broadcast channel after a short delay
                let broadcaster = self.progress_broadcaster.clone();
                let req_id = request.id;
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                    broadcaster.cleanup_provisioning(req_id).await;
                });

                ProvisioningResult {
                    success: true,
                    message: "VMs provisioned successfully".to_string(),
                    output: Some(output),
                }
            }
            Err(e) => {
                self.fail_request(request.id, &format!("Terraform apply failed: {}", e))
                    .await
            }
        }
    }

    async fn create_provisioning_progress(&self, request_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO provisioning_progress (vm_request_id, current_step, step_index, total_steps)
            VALUES ($1, 'initializing', 0, 6)
            "#
        )
        .bind(request_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_progress(&self, request_id: Uuid, step: ProvisioningStep, message: &str) {
        // Update database
        if let Err(e) = sqlx::query(
            r#"
            UPDATE provisioning_progress
            SET current_step = $1, step_index = $2, step_message = $3, updated_at = NOW()
            WHERE vm_request_id = $4
            "#
        )
        .bind(step.as_str())
        .bind(step.index())
        .bind(message)
        .bind(request_id)
        .execute(&self.pool)
        .await {
            tracing::error!("Failed to update provisioning progress: {}", e);
        }

        // Broadcast update
        let is_complete = matches!(step, ProvisioningStep::Completed);
        let update = ProvisioningUpdate {
            request_id: request_id.to_string(),
            step: step.as_str().to_string(),
            step_index: step.index(),
            total_steps: ProvisioningStep::total_steps(),
            message: message.to_string(),
            is_complete,
            is_error: false,
            timestamp: Utc::now(),
        };

        self.progress_broadcaster.broadcast_provisioning(update).await;
    }

    async fn complete_provisioning_progress(&self, request_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE provisioning_progress
            SET completed_at = NOW(), updated_at = NOW()
            WHERE vm_request_id = $1
            "#
        )
        .bind(request_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn record_provisioned_vms(
        &self,
        request: &VmRequest,
        vms: &[VmConfig],
        workspace_path: &PathBuf,
    ) -> Result<(), sqlx::Error> {
        let terraform_state_path = workspace_path.join("terraform.tfstate").to_string_lossy().to_string();
        let reviewer_id = request.reviewed_by.unwrap_or(request.requester_id);

        for vm in vms {
            // Get OS template ID
            let os_template_id: Option<(Uuid,)> = sqlx::query_as(
                "SELECT id FROM os_templates WHERE name = $1"
            )
            .bind(&vm.os_type)
            .fetch_optional(&self.pool)
            .await?;

            // Insert provisioned VM record
            sqlx::query(
                r#"
                INSERT INTO provisioned_vms (
                    vm_config_id, vm_request_id, vm_name, ip_address, os_template_id,
                    cpu_cores, ram_gb, storage_gb, provisioned_by, terraform_state_path
                ) VALUES ($1, $2, $3, $4::inet, $5, $6, $7, $8, $9, $10)
                "#
            )
            .bind(vm.id)
            .bind(request.id)
            .bind(&vm.vm_name)
            .bind(&vm.ip_address)
            .bind(os_template_id.map(|t| t.0))
            .bind(vm.cpu_cores)
            .bind(vm.ram_gb)
            .bind(vm.storage_gb)
            .bind(reviewer_id)
            .bind(&terraform_state_path)
            .execute(&self.pool)
            .await?;

            // Mark IP address as in_use if it exists in the pool
            sqlx::query(
                r#"
                UPDATE ip_addresses
                SET status = 'in_use', assigned_vm_config_id = $1, updated_at = NOW()
                WHERE ip_address = $2                "#
            )
            .bind(vm.id)
            .bind(&vm.ip_address)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    fn get_workspace_path(&self, request_id: Uuid) -> PathBuf {
        PathBuf::from(&self.workspace_dir).join(request_id.to_string())
    }

    async fn fetch_networks_map(&self) -> Result<HashMap<Uuid, Network>, sqlx::Error> {
        let networks = sqlx::query_as::<_, Network>("SELECT * FROM networks")
            .fetch_all(&self.pool)
            .await?;

        Ok(networks.into_iter().map(|n| (n.id, n)).collect())
    }

    fn run_terraform_command(&self, workspace: &PathBuf, args: &[&str]) -> Result<String, String> {
        let output = Command::new("terraform")
            .current_dir(workspace)
            .args(args)
            .output()
            .map_err(|e| format!("Failed to execute terraform: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
            Ok(format!("{}\n{}", stdout, stderr))
        } else {
            Err(format!("Exit code: {:?}\nStdout: {}\nStderr: {}", output.status.code(), stdout, stderr))
        }
    }

    async fn fail_request(&self, request_id: Uuid, error_message: &str) -> ProvisioningResult {
        tracing::error!("Provisioning failed for request {}: {}", request_id, error_message);

        // Update progress to failed
        self.update_progress_error(request_id, ProvisioningStep::Failed, error_message).await;

        if let Err(e) = self
            .update_request_status(request_id, RequestStatus::Failed, Some(error_message))
            .await
        {
            tracing::error!("Failed to update request status: {}", e);
        }

        // Cleanup the broadcast channel after a short delay
        let broadcaster = self.progress_broadcaster.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
            broadcaster.cleanup_provisioning(request_id).await;
        });

        ProvisioningResult {
            success: false,
            message: error_message.to_string(),
            output: None,
        }
    }

    async fn update_progress_error(&self, request_id: Uuid, step: ProvisioningStep, error: &str) {
        // Update database with error
        if let Err(e) = sqlx::query(
            r#"
            UPDATE provisioning_progress
            SET current_step = $1, step_index = $2, error_message = $3, updated_at = NOW()
            WHERE vm_request_id = $4
            "#
        )
        .bind(step.as_str())
        .bind(step.index())
        .bind(error)
        .bind(request_id)
        .execute(&self.pool)
        .await {
            tracing::error!("Failed to update provisioning progress with error: {}", e);
        }

        // Broadcast error
        let update = ProvisioningUpdate {
            request_id: request_id.to_string(),
            step: step.as_str().to_string(),
            step_index: step.index(),
            total_steps: ProvisioningStep::total_steps(),
            message: error.to_string(),
            is_complete: true,
            is_error: true,
            timestamp: Utc::now(),
        };

        self.progress_broadcaster.broadcast_provisioning(update).await;
    }

    async fn update_request_status(
        &self,
        request_id: Uuid,
        status: RequestStatus,
        error_message: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        let notes = error_message.map(|e| {
            if e.len() > 1000 {
                format!("{}...", &e[..997])
            } else {
                e.to_string()
            }
        });

        sqlx::query(
            r#"
            UPDATE vm_requests
            SET status = $1, review_notes = COALESCE($2, review_notes), updated_at = NOW()
            WHERE id = $3
            "#,
        )
        .bind(status)
        .bind(notes)
        .bind(request_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    fn generate_tfvars(&self) -> String {
        format!(
            r#"vsphere_server   = "{}"
vsphere_user     = "{}"
vsphere_password = "{}"
datacenter       = "{}"
cluster          = "{}"
datastore        = "{}"
network          = "{}"
template_folder  = "{}"
"#,
            self.vsphere_config.server,
            self.vsphere_config.user,
            self.vsphere_config.password,
            self.vsphere_config.datacenter,
            self.vsphere_config.cluster,
            self.vsphere_config.datastore,
            self.vsphere_config.network,
            self.vsphere_config.template_folder,
        )
    }

    fn generate_terraform_config(&self, request: &VmRequest, vms: &[VmConfig], networks: &HashMap<Uuid, Network>) -> String {
        let mut config = String::new();

        // Header
        config.push_str(&format!(
            r#"# Terraform Configuration for VM Request: {}
# Request ID: {}
# Auto-generated by VM Provisioning Portal

"#,
            request.title, request.id
        ));

        // Terraform and provider configuration
        config.push_str(&format!(
            r#"terraform {{
  required_version = ">= 1.0.0"
  required_providers {{
    vsphere = {{
      source  = "hashicorp/vsphere"
      version = ">= 2.0.0"
    }}
  }}
}}

variable "vsphere_server" {{
  type = string
}}

variable "vsphere_user" {{
  type = string
}}

variable "vsphere_password" {{
  type      = string
  sensitive = true
}}

variable "datacenter" {{
  type = string
}}

variable "cluster" {{
  type = string
}}

variable "datastore" {{
  type = string
}}

variable "network" {{
  type = string
}}

variable "template_folder" {{
  type = string
}}

provider "vsphere" {{
  vsphere_server       = var.vsphere_server
  user                 = var.vsphere_user
  password             = var.vsphere_password
  allow_unverified_ssl = {}
}}

data "vsphere_datacenter" "dc" {{
  name = var.datacenter
}}

data "vsphere_compute_cluster" "cluster" {{
  name          = var.cluster
  datacenter_id = data.vsphere_datacenter.dc.id
}}

data "vsphere_datastore" "datastore" {{
  name          = var.datastore
  datacenter_id = data.vsphere_datacenter.dc.id
}}

data "vsphere_network" "default_network" {{
  name          = var.network
  datacenter_id = data.vsphere_datacenter.dc.id
}}

"#,
            self.vsphere_config.allow_unverified_ssl
        ));

        // Network data sources for each unique network used by VMs
        let mut network_ids: Vec<Uuid> = vms
            .iter()
            .filter_map(|vm| vm.network_id)
            .collect();
        network_ids.sort();
        network_ids.dedup();

        for network_id in &network_ids {
            if let Some(network) = networks.get(network_id) {
                let resource_name = network.vsphere_network_name.replace('-', "_").replace('.', "_").replace(' ', "_");
                config.push_str(&format!(
                    r#"data "vsphere_network" "network_{}" {{
  name          = "{}"
  datacenter_id = data.vsphere_datacenter.dc.id
}}

"#,
                    resource_name, network.vsphere_network_name
                ));
            }
        }

        // Template data sources for each unique OS
        let mut os_types: Vec<&str> = vms.iter().map(|vm| vm.os_type.as_str()).collect();
        os_types.sort();
        os_types.dedup();

        for os_type in &os_types {
            let template_name = self
                .vsphere_config
                .templates
                .get(*os_type)
                .map(|s| s.as_str())
                .unwrap_or("generic-linux-template");
            let resource_name = os_type.replace('-', "_").replace('.', "_");

            // Handle empty template folder (templates at root level)
            let template_path = if self.vsphere_config.template_folder.is_empty() {
                template_name.to_string()
            } else {
                format!("{}/{}", self.vsphere_config.template_folder, template_name)
            };

            config.push_str(&format!(
                r#"data "vsphere_virtual_machine" "template_{}" {{
  name          = "{}"
  datacenter_id = data.vsphere_datacenter.dc.id
}}

"#,
                resource_name, template_path
            ));
        }

        // VM resources
        for vm in vms {
            let resource_name = vm.vm_name.replace('-', "_").replace('.', "_");
            let template_resource = vm.os_type.replace('-', "_").replace('.', "_");
            let is_windows = vm.os_type.contains("windows");

            // Get the password (use provided or a default)
            let admin_password = vm.password.clone().unwrap_or_else(|| "TempP@ssw0rd!".to_string());

            // Sanitize hostname - replace underscores with hyphens (underscores not allowed in hostnames)
            let sanitized_hostname = vm.vm_name.replace('_', "-");

            // Check if this is Rocky Linux (needs cloud-init for networking)
            let is_rocky = vm.os_type.contains("rocky");

            let customize_block = if is_windows {
                format!(
                    r#"    customize {{
      windows_options {{
        computer_name  = "{}"
        admin_password = "{}"
      }}

      network_interface {{
        ipv4_address = "{}"
        ipv4_netmask = 24
      }}

      ipv4_gateway    = "{}"
      dns_server_list = ["{}", "{}"]
    }}"#,
                    sanitized_hostname, admin_password, vm.ip_address, vm.gateway, vm.dns_primary, vm.dns_secondary
                )
            } else if is_rocky {
                // Rocky Linux: No customize block - cloud-init handles everything
                // This prevents vSphere from waiting for customization to complete
                String::new()
            } else {
                // Ubuntu and other Linux: Use vSphere customization for networking
                format!(
                    r#"    customize {{
      linux_options {{
        host_name = "{}"
        domain    = "local"
      }}

      network_interface {{
        ipv4_address = "{}"
        ipv4_netmask = 24
      }}

      ipv4_gateway    = "{}"
      dns_server_list = ["{}", "{}"]
    }}"#,
                    sanitized_hostname, vm.ip_address, vm.gateway, vm.dns_primary, vm.dns_secondary
                )
            };

            // Determine which network data source to use
            let network_reference = if let Some(network_id) = vm.network_id {
                if let Some(network) = networks.get(&network_id) {
                    let net_resource_name = network.vsphere_network_name.replace('-', "_").replace('.', "_").replace(' ', "_");
                    format!("data.vsphere_network.network_{}.id", net_resource_name)
                } else {
                    "data.vsphere_network.default_network.id".to_string()
                }
            } else {
                "data.vsphere_network.default_network.id".to_string()
            };

            // Extra userdata for Linux to set up user credentials and network (for Rocky)
            let extra_config = if !is_windows && vm.username.is_some() {
                let username = vm.username.as_ref().unwrap();
                let hashed_password = hash_password_for_cloudinit(&admin_password);

                if is_rocky {
                    // Rocky Linux: Use cloud-init for both user and network configuration
                    format!(
                        r#"
  extra_config = {{
    "guestinfo.userdata" = base64encode(<<-EOF
#cloud-config
ssh_pwauth: true
chpasswd:
  expire: false

users:
  - name: {username}
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: false
    passwd: {hashed_password}

write_files:
  - path: /etc/NetworkManager/system-connections/static.nmconnection
    permissions: '0600'
    content: |
      [connection]
      id=static
      type=ethernet
      autoconnect=true

      [ipv4]
      method=manual
      addresses={ip_address}/24
      gateway={gateway}
      dns={dns_primary};{dns_secondary}

      [ipv6]
      method=disabled

runcmd:
  - nmcli connection reload
  - nmcli connection up static || true
  - hostnamectl set-hostname {hostname}
EOF
    )
    "guestinfo.userdata.encoding" = "base64"
  }}
"#,
                        username = username,
                        hashed_password = hashed_password,
                        ip_address = vm.ip_address,
                        gateway = vm.gateway,
                        dns_primary = vm.dns_primary,
                        dns_secondary = vm.dns_secondary,
                        hostname = sanitized_hostname
                    )
                } else {
                    // Other Linux (Ubuntu, etc.): Just user creation, vSphere handles network
                    format!(
                        r#"
  extra_config = {{
    "guestinfo.userdata" = base64encode(<<-EOF
#cloud-config
ssh_pwauth: true
chpasswd:
  expire: false

users:
  - name: {username}
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: false
    passwd: {hashed_password}
EOF
    )
    "guestinfo.userdata.encoding" = "base64"
  }}
"#,
                        username = username,
                        hashed_password = hashed_password
                    )
                }
            } else {
                String::new()
            };

            // Handle empty VM folder (VMs created at root level)
            let folder_line = if self.vsphere_config.vm_folder.is_empty() {
                String::new()
            } else {
                format!("  folder           = \"{}\"\n", self.vsphere_config.vm_folder)
            };

            // For Rocky Linux, don't wait for guest network (cloud-init handles it)
            let wait_timeout_line = if is_rocky {
                "  wait_for_guest_net_timeout = 0\n".to_string()
            } else {
                String::new()
            };

            config.push_str(&format!(
                r#"resource "vsphere_virtual_machine" "{resource_name}" {{
  name             = "{vm_name}"
  resource_pool_id = data.vsphere_compute_cluster.cluster.resource_pool_id
  datastore_id     = data.vsphere_datastore.datastore.id
{folder_line}{wait_timeout_line}
  num_cpus = {cpu_cores}
  memory   = {ram_mb}
  guest_id = data.vsphere_virtual_machine.template_{template_resource}.guest_id
  firmware = data.vsphere_virtual_machine.template_{template_resource}.firmware
  efi_secure_boot_enabled = data.vsphere_virtual_machine.template_{template_resource}.efi_secure_boot_enabled

  scsi_type = data.vsphere_virtual_machine.template_{template_resource}.scsi_type

  network_interface {{
    network_id   = {network_reference}
    adapter_type = data.vsphere_virtual_machine.template_{template_resource}.network_interface_types[0]
  }}

  disk {{
    label            = "disk0"
    size             = {storage_gb}
    thin_provisioned = data.vsphere_virtual_machine.template_{template_resource}.disks[0].thin_provisioned
  }}
{extra_config}
  clone {{
    template_uuid = data.vsphere_virtual_machine.template_{template_resource}.id

{customize_block}
  }}
}}

"#,
                resource_name = resource_name,
                vm_name = vm.vm_name,
                folder_line = folder_line,
                wait_timeout_line = wait_timeout_line,
                cpu_cores = vm.cpu_cores,
                ram_mb = vm.ram_gb * 1024,
                storage_gb = vm.storage_gb,
                template_resource = template_resource,
                network_reference = network_reference,
                extra_config = extra_config,
                customize_block = customize_block,
            ));
        }

        // Outputs
        config.push_str("# Outputs\n");
        for vm in vms {
            let resource_name = vm.vm_name.replace('-', "_").replace('.', "_");
            config.push_str(&format!(
                r#"output "{}_ip" {{
  value = "{}"
}}

"#,
                resource_name, vm.ip_address
            ));
        }

        config
    }
}
