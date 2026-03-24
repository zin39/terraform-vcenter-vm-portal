use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProvisionedVm {
    pub id: Uuid,
    pub vm_config_id: Uuid,
    pub vm_request_id: Uuid,
    pub vm_name: String,
    pub ip_address: String,
    pub os_template_id: Option<Uuid>,
    pub cpu_cores: i32,
    pub ram_gb: i32,
    pub storage_gb: i32,
    pub provisioned_by: Uuid,
    pub provisioned_at: DateTime<Utc>,
    pub terraform_state_path: Option<String>,
    pub status: String,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ProvisionedVmResponse {
    pub id: Uuid,
    pub vm_config_id: Uuid,
    pub vm_request_id: Uuid,
    pub vm_name: String,
    pub ip_address: String,
    pub os_template_id: Option<Uuid>,
    pub os_template_name: Option<String>,
    pub cpu_cores: i32,
    pub ram_gb: i32,
    pub storage_gb: i32,
    pub provisioned_by: Uuid,
    pub provisioned_by_name: Option<String>,
    pub requester_name: Option<String>,
    pub provisioned_at: DateTime<Utc>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct ProvisionedVmListResponse {
    pub vms: Vec<ProvisionedVmResponse>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct ListProvisionedVmsQuery {
    pub status: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}
