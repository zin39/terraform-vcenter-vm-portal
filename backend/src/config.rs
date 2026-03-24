use crate::utils::derive_key;
use std::collections::HashMap;
use std::env;

#[derive(Clone)]
pub struct VsphereConfig {
    pub server: String,
    pub user: String,
    pub password: String,
    pub allow_unverified_ssl: bool,
    pub datacenter: String,
    pub cluster: String,
    pub datastore: String,
    pub network: String,
    pub template_folder: String,
    pub vm_folder: String,
    pub templates: HashMap<String, String>,
}

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub encryption_key: [u8; 32],
    pub port: u16,
    pub vsphere: VsphereConfig,
    pub terraform_workspace_dir: String,
    pub cors_allowed_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        // Build template mappings
        let mut templates = HashMap::new();
        templates.insert(
            "ubuntu-22.04".to_string(),
            env::var("VSPHERE_TEMPLATE_UBUNTU_22_04").unwrap_or_else(|_| "ubuntu-22.04-template".to_string()),
        );
        templates.insert(
            "ubuntu-20.04".to_string(),
            env::var("VSPHERE_TEMPLATE_UBUNTU_20_04").unwrap_or_else(|_| "ubuntu-20.04-template".to_string()),
        );
        templates.insert(
            "debian-12".to_string(),
            env::var("VSPHERE_TEMPLATE_DEBIAN_12").unwrap_or_else(|_| "debian-12-template".to_string()),
        );
        templates.insert(
            "centos-9".to_string(),
            env::var("VSPHERE_TEMPLATE_CENTOS_9").unwrap_or_else(|_| "centos-stream-9-template".to_string()),
        );
        templates.insert(
            "rhel-9".to_string(),
            env::var("VSPHERE_TEMPLATE_RHEL_9").unwrap_or_else(|_| "rhel-9-template".to_string()),
        );
        templates.insert(
            "rocky-9".to_string(),
            env::var("VSPHERE_TEMPLATE_ROCKY_9").unwrap_or_else(|_| "rocky-9-template".to_string()),
        );
        templates.insert(
            "windows-server-2022".to_string(),
            env::var("VSPHERE_TEMPLATE_WINDOWS_2022").unwrap_or_else(|_| "windows-server-2022-template".to_string()),
        );
        templates.insert(
            "windows-server-2019".to_string(),
            env::var("VSPHERE_TEMPLATE_WINDOWS_2019").unwrap_or_else(|_| "windows-server-2019-template".to_string()),
        );

        // Derive encryption key from secret
        let encryption_secret = env::var("ENCRYPTION_SECRET")
            .unwrap_or_else(|_| env::var("JWT_SECRET").expect("JWT_SECRET must be set"));
        let encryption_key = derive_key(&encryption_secret);

        // Parse CORS allowed origins
        let cors_allowed_origins: Vec<String> = env::var("CORS_ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:5173,http://localhost:3000".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            encryption_key,
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .expect("PORT must be a valid number"),
            cors_allowed_origins,
            vsphere: VsphereConfig {
                server: env::var("VSPHERE_SERVER").unwrap_or_else(|_| "vcenter.example.com".to_string()),
                user: env::var("VSPHERE_USER").unwrap_or_else(|_| "administrator@vsphere.local".to_string()),
                password: env::var("VSPHERE_PASSWORD").unwrap_or_else(|_| "".to_string()),
                allow_unverified_ssl: env::var("VSPHERE_ALLOW_UNVERIFIED_SSL")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .unwrap_or(true),
                datacenter: env::var("VSPHERE_DATACENTER").unwrap_or_else(|_| "Datacenter".to_string()),
                cluster: env::var("VSPHERE_CLUSTER").unwrap_or_else(|_| "Cluster".to_string()),
                datastore: env::var("VSPHERE_DATASTORE").unwrap_or_else(|_| "datastore1".to_string()),
                network: env::var("VSPHERE_NETWORK").unwrap_or_else(|_| "VM Network".to_string()),
                template_folder: env::var("VSPHERE_TEMPLATE_FOLDER").unwrap_or_else(|_| "Templates".to_string()),
                vm_folder: env::var("VSPHERE_VM_FOLDER").unwrap_or_else(|_| "VMs".to_string()),
                templates,
            },
            terraform_workspace_dir: env::var("TERRAFORM_WORKSPACE_DIR")
                .unwrap_or_else(|_| "./terraform-workspaces".to_string()),
        }
    }
}
