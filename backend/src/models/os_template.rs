use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OsTemplate {
    pub id: Uuid,
    pub name: String,
    pub display_name: String,
    pub min_storage_gb: i32,
    pub vsphere_template_name: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOsTemplateRequest {
    pub name: String,
    pub display_name: String,
    pub min_storage_gb: i32,
    pub vsphere_template_name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOsTemplateRequest {
    pub display_name: Option<String>,
    pub min_storage_gb: Option<i32>,
    pub vsphere_template_name: Option<String>,
    pub is_active: Option<bool>,
}
