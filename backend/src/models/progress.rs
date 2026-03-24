use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Steps for VM provisioning
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProvisioningStep {
    Initializing,
    CreatingVm,
    ConfiguringNetwork,
    SettingUpUser,
    VerifyingSsh,
    Completed,
    Failed,
}

impl ProvisioningStep {
    pub fn index(&self) -> i32 {
        match self {
            Self::Initializing => 0,
            Self::CreatingVm => 1,
            Self::ConfiguringNetwork => 2,
            Self::SettingUpUser => 3,
            Self::VerifyingSsh => 4,
            Self::Completed | Self::Failed => 5,
        }
    }

    pub fn total_steps() -> i32 {
        6
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Initializing => "Initializing",
            Self::CreatingVm => "Creating VM",
            Self::ConfiguringNetwork => "Configuring Network",
            Self::SettingUpUser => "Setting up User",
            Self::VerifyingSsh => "Verifying SSH",
            Self::Completed => "Completed",
            Self::Failed => "Failed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "initializing" => Self::Initializing,
            "creating_vm" => Self::CreatingVm,
            "configuring_network" => Self::ConfiguringNetwork,
            "setting_up_user" => Self::SettingUpUser,
            "verifying_ssh" => Self::VerifyingSsh,
            "completed" => Self::Completed,
            "failed" => Self::Failed,
            _ => Self::Initializing,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Initializing => "initializing",
            Self::CreatingVm => "creating_vm",
            Self::ConfiguringNetwork => "configuring_network",
            Self::SettingUpUser => "setting_up_user",
            Self::VerifyingSsh => "verifying_ssh",
            Self::Completed => "completed",
            Self::Failed => "failed",
        }
    }
}

/// Steps for VM deletion
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeletionStep {
    Initializing,
    DestroyingInfrastructure,
    ReleasingResources,
    Completed,
    Failed,
}

impl DeletionStep {
    pub fn index(&self) -> i32 {
        match self {
            Self::Initializing => 0,
            Self::DestroyingInfrastructure => 1,
            Self::ReleasingResources => 2,
            Self::Completed | Self::Failed => 3,
        }
    }

    pub fn total_steps() -> i32 {
        4
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Initializing => "Initializing",
            Self::DestroyingInfrastructure => "Destroying Infrastructure",
            Self::ReleasingResources => "Releasing Resources",
            Self::Completed => "Completed",
            Self::Failed => "Failed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "initializing" => Self::Initializing,
            "destroying_infrastructure" => Self::DestroyingInfrastructure,
            "releasing_resources" => Self::ReleasingResources,
            "completed" => Self::Completed,
            "failed" => Self::Failed,
            _ => Self::Initializing,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Initializing => "initializing",
            Self::DestroyingInfrastructure => "destroying_infrastructure",
            Self::ReleasingResources => "releasing_resources",
            Self::Completed => "completed",
            Self::Failed => "failed",
        }
    }
}

/// Database model for provisioning progress
#[derive(Debug, Clone, FromRow)]
pub struct ProvisioningProgress {
    pub id: Uuid,
    pub vm_request_id: Uuid,
    pub current_step: String,
    pub step_index: i32,
    pub total_steps: i32,
    pub step_message: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Database model for deletion progress
#[derive(Debug, Clone, FromRow)]
pub struct DeletionProgress {
    pub id: Uuid,
    pub provisioned_vm_id: Uuid,
    pub current_step: String,
    pub step_index: i32,
    pub total_steps: i32,
    pub step_message: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Database model for SSH verification
#[derive(Debug, Clone, FromRow)]
pub struct SshVerification {
    pub id: Uuid,
    pub vm_request_id: Uuid,
    pub vm_config_id: Uuid,
    pub ip_address: String,
    pub is_reachable: bool,
    pub latency_ms: Option<i32>,
    pub last_checked_at: DateTime<Utc>,
    pub check_count: i32,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// WebSocket message for provisioning progress updates
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ProgressMessage {
    #[serde(rename = "provisioning_update")]
    ProvisioningUpdate(ProvisioningUpdate),
    #[serde(rename = "ssh_verification_update")]
    SshVerificationUpdate(SshVerificationUpdate),
    #[serde(rename = "deletion_update")]
    DeletionUpdate(DeletionUpdate),
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "connected")]
    Connected { request_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvisioningUpdate {
    pub request_id: String,
    pub step: String,
    pub step_index: i32,
    pub total_steps: i32,
    pub message: String,
    pub is_complete: bool,
    pub is_error: bool,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshVerificationUpdate {
    pub request_id: String,
    pub vm_config_id: String,
    pub vm_name: String,
    pub ip_address: String,
    pub is_reachable: bool,
    pub attempt: i32,
    pub max_attempts: i32,
    pub latency_ms: Option<i32>,
    pub error_message: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeletionUpdate {
    pub vm_id: String,
    pub step: String,
    pub step_index: i32,
    pub total_steps: i32,
    pub message: String,
    pub is_complete: bool,
    pub is_error: bool,
    pub timestamp: DateTime<Utc>,
}
