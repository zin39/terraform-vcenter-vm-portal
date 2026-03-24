use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct IpAddress {
    pub id: Uuid,
    pub ip_address: String,
    pub network_id: Uuid,
    pub status: String,
    pub hostname: Option<String>,
    pub description: Option<String>,
    pub assigned_vm_config_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct IpAddressResponse {
    pub id: Uuid,
    pub ip_address: String,
    pub network_id: Uuid,
    pub status: String,
    pub hostname: Option<String>,
    pub description: Option<String>,
    pub assigned_vm_config_id: Option<Uuid>,
}

impl From<IpAddress> for IpAddressResponse {
    fn from(ip: IpAddress) -> Self {
        Self {
            id: ip.id,
            ip_address: ip.ip_address,
            network_id: ip.network_id,
            status: ip.status,
            hostname: ip.hostname,
            description: ip.description,
            assigned_vm_config_id: ip.assigned_vm_config_id,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateIpAddressRequest {
    pub ip_address: String,
    pub network_id: Uuid,
    pub status: Option<String>,
    pub hostname: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkCreateIpAddressRequest {
    pub network_id: Uuid,
    pub ip_addresses: Vec<IpAddressEntry>,
}

#[derive(Debug, Deserialize)]
pub struct IpAddressEntry {
    pub ip_address: String,
    pub status: Option<String>,
    pub hostname: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIpAddressRequest {
    pub status: Option<String>,
    pub hostname: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListAvailableIpsQuery {
    pub network_id: Uuid,
}
