use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Network {
    pub id: Uuid,
    pub name: String,
    pub vlan_id: Option<i32>,
    pub vsphere_network_name: String,
    pub subnet: Option<String>,
    pub gateway: Option<String>,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct NetworkResponse {
    pub id: Uuid,
    pub name: String,
    pub vlan_id: Option<i32>,
    pub vsphere_network_name: String,
    pub subnet: Option<String>,
    pub gateway: Option<String>,
    pub description: Option<String>,
    pub is_active: bool,
}

impl From<Network> for NetworkResponse {
    fn from(network: Network) -> Self {
        Self {
            id: network.id,
            name: network.name,
            vlan_id: network.vlan_id,
            vsphere_network_name: network.vsphere_network_name,
            subnet: network.subnet,
            gateway: network.gateway,
            description: network.description,
            is_active: network.is_active,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateNetworkRequest {
    #[validate(length(min = 1, max = 255, message = "Name must be 1-255 characters"))]
    pub name: String,

    pub vlan_id: Option<i32>,

    #[validate(length(min = 1, max = 255, message = "vSphere network name is required"))]
    pub vsphere_network_name: String,

    #[validate(length(max = 45))]
    pub subnet: Option<String>,

    #[validate(length(max = 45))]
    pub gateway: Option<String>,

    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateNetworkRequest {
    #[validate(length(min = 1, max = 255, message = "Name must be 1-255 characters"))]
    pub name: Option<String>,

    pub vlan_id: Option<i32>,

    #[validate(length(min = 1, max = 255, message = "vSphere network name is required"))]
    pub vsphere_network_name: Option<String>,

    #[validate(length(max = 45))]
    pub subnet: Option<String>,

    #[validate(length(max = 45))]
    pub gateway: Option<String>,

    pub description: Option<String>,

    pub is_active: Option<bool>,
}
