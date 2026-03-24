use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::{Validate, ValidationError};

// Validate IP address format: each octet must be 0-255
fn validate_ip_address(ip: &str) -> Result<(), ValidationError> {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return Err(ValidationError::new("invalid_ip"));
    }
    for part in parts {
        match part.parse::<u8>() {
            Ok(_) => {}
            Err(_) => return Err(ValidationError::new("invalid_ip")),
        }
        // Check for leading zeros (e.g., "01" should be invalid)
        if part.len() > 1 && part.starts_with('0') {
            return Err(ValidationError::new("invalid_ip"));
        }
    }
    Ok(())
}

// Validate VM name: starts with letter, alphanumeric/hyphen/underscore, doesn't end with hyphen/underscore
fn validate_vm_name(name: &str) -> Result<(), ValidationError> {
    if name.is_empty() {
        return Err(ValidationError::new("empty_name"));
    }
    if name.len() < 3 || name.len() > 63 {
        return Err(ValidationError::new("invalid_length"));
    }
    let first_char = name.chars().next().unwrap();
    if !first_char.is_ascii_alphabetic() {
        return Err(ValidationError::new("must_start_with_letter"));
    }
    for c in name.chars() {
        if !c.is_ascii_alphanumeric() && c != '-' && c != '_' {
            return Err(ValidationError::new("invalid_characters"));
        }
    }
    let last_char = name.chars().last().unwrap();
    if last_char == '-' || last_char == '_' {
        return Err(ValidationError::new("invalid_ending"));
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "request_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum RequestStatus {
    Pending,
    Approved,
    Rejected,
    Provisioning,
    Completed,
    Failed,
}

// Database model for vm_requests table
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct VmRequest {
    pub id: Uuid,
    pub requester_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub purpose: String,
    pub status: RequestStatus,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_notes: Option<String>,
    pub retry_count: i32,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Database model for vm_configs table
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct VmConfig {
    pub id: Uuid,
    pub request_id: Uuid,
    pub vm_name: String,
    pub cpu_cores: i32,
    pub ram_gb: i32,
    pub storage_gb: i32,
    pub os_type: String,
    pub ip_address: String,
    pub gateway: String,
    pub dns_primary: String,
    pub dns_secondary: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub network_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Response type that includes VM configs
#[derive(Debug, Serialize)]
pub struct VmRequestResponse {
    pub id: Uuid,
    pub requester_id: Uuid,
    pub requester_name: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub purpose: String,
    pub status: RequestStatus,
    pub reviewed_by: Option<Uuid>,
    pub reviewer_name: Option<String>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_notes: Option<String>,
    pub retry_count: i32,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub vms: Vec<VmConfigResponse>,
}

#[derive(Debug, Serialize)]
pub struct VmConfigResponse {
    pub id: Uuid,
    pub vm_name: String,
    pub cpu_cores: i32,
    pub ram_gb: i32,
    pub storage_gb: i32,
    pub os_type: String,
    pub ip_address: String,
    pub gateway: String,
    pub dns_primary: String,
    pub dns_secondary: String,
    pub username: Option<String>,
    pub network_id: Option<Uuid>,
    pub network_name: Option<String>,
}

impl From<VmConfig> for VmConfigResponse {
    fn from(config: VmConfig) -> Self {
        Self {
            id: config.id,
            vm_name: config.vm_name,
            cpu_cores: config.cpu_cores,
            ram_gb: config.ram_gb,
            storage_gb: config.storage_gb,
            os_type: config.os_type,
            ip_address: config.ip_address,
            gateway: config.gateway,
            dns_primary: config.dns_primary,
            dns_secondary: config.dns_secondary,
            username: config.username,
            network_id: config.network_id,
            network_name: None, // Will be set when joining with networks table
        }
    }
}

// Request types for creating
#[derive(Debug, Deserialize, Validate)]
pub struct CreateVmRequestPayload {
    #[validate(length(min = 1, max = 255, message = "Title must be 1-255 characters"))]
    pub title: String,

    #[validate(length(max = 1000, message = "Description must be under 1000 characters"))]
    pub description: Option<String>,

    #[validate(length(min = 1, max = 500, message = "Purpose is required and must be under 500 characters"))]
    pub purpose: String,

    pub vms: Vec<CreateVmConfig>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateVmConfig {
    #[validate(custom(function = "validate_vm_name", message = "VM name must be 3-63 characters, start with a letter, contain only letters/numbers/hyphens/underscores, and not end with hyphen/underscore"))]
    pub vm_name: String,

    #[validate(range(min = 1, max = 64, message = "CPU cores must be between 1 and 64"))]
    pub cpu_cores: i32,

    #[validate(range(min = 1, max = 512, message = "RAM must be between 1 and 512 GB"))]
    pub ram_gb: i32,

    #[validate(range(min = 10, max = 10000, message = "Storage must be between 10 and 10000 GB"))]
    pub storage_gb: i32,

    #[validate(length(min = 1, max = 100, message = "OS type is required"))]
    pub os_type: String,

    #[validate(custom(function = "validate_ip_address", message = "Invalid IP address format (each octet must be 0-255)"))]
    pub ip_address: String,

    #[validate(custom(function = "validate_ip_address", message = "Invalid gateway IP address format"))]
    #[serde(default = "default_gateway")]
    pub gateway: String,

    #[validate(custom(function = "validate_ip_address", message = "Invalid primary DNS IP address format"))]
    #[serde(default = "default_dns_primary")]
    pub dns_primary: String,

    #[validate(custom(function = "validate_ip_address", message = "Invalid secondary DNS IP address format"))]
    #[serde(default = "default_dns_secondary")]
    pub dns_secondary: String,

    #[validate(length(min = 1, max = 255, message = "Username must be 1-255 characters"))]
    pub username: Option<String>,

    #[validate(length(min = 8, max = 255, message = "Password must be 8-255 characters"))]
    pub password: Option<String>,

    pub network_id: Option<Uuid>,
}

fn default_gateway() -> String {
    "10.0.1.1".to_string()
}

fn default_dns_primary() -> String {
    "10.0.0.2".to_string()
}

fn default_dns_secondary() -> String {
    "8.8.8.8".to_string()
}

#[derive(Debug, Deserialize, Validate)]
pub struct ReviewVmRequest {
    pub status: RequestStatus,

    #[validate(length(max = 1000, message = "Review notes must be under 1000 characters"))]
    pub review_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListVmRequestsQuery {
    pub status: Option<RequestStatus>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedVmRequests {
    pub data: Vec<VmRequestResponse>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}
