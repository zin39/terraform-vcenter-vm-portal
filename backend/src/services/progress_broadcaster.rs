use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use crate::models::{ProgressMessage, ProvisioningUpdate, SshVerificationUpdate, DeletionUpdate};

const CHANNEL_CAPACITY: usize = 100;

/// Central hub for broadcasting progress updates to WebSocket clients
#[derive(Clone)]
pub struct ProgressBroadcaster {
    /// Channels for provisioning progress (keyed by request_id)
    provisioning_channels: Arc<RwLock<HashMap<Uuid, broadcast::Sender<ProgressMessage>>>>,
    /// Channels for deletion progress (keyed by provisioned_vm_id)
    deletion_channels: Arc<RwLock<HashMap<Uuid, broadcast::Sender<ProgressMessage>>>>,
}

impl Default for ProgressBroadcaster {
    fn default() -> Self {
        Self::new()
    }
}

impl ProgressBroadcaster {
    pub fn new() -> Self {
        Self {
            provisioning_channels: Arc::new(RwLock::new(HashMap::new())),
            deletion_channels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Subscribe to provisioning progress updates for a specific request
    pub async fn subscribe_provisioning(&self, request_id: Uuid) -> broadcast::Receiver<ProgressMessage> {
        let mut channels = self.provisioning_channels.write().await;

        if let Some(sender) = channels.get(&request_id) {
            sender.subscribe()
        } else {
            let (sender, receiver) = broadcast::channel(CHANNEL_CAPACITY);
            channels.insert(request_id, sender);
            receiver
        }
    }

    /// Broadcast a provisioning update to all subscribers
    pub async fn broadcast_provisioning(&self, update: ProvisioningUpdate) {
        let request_id = match Uuid::parse_str(&update.request_id) {
            Ok(id) => id,
            Err(_) => {
                tracing::error!("Invalid request_id in provisioning update: {}", update.request_id);
                return;
            }
        };

        // Get or create channel to ensure broadcasts are not lost
        let mut channels = self.provisioning_channels.write().await;
        let sender = channels.entry(request_id).or_insert_with(|| {
            let (sender, _) = broadcast::channel(CHANNEL_CAPACITY);
            sender
        });

        let message = ProgressMessage::ProvisioningUpdate(update);
        if let Err(e) = sender.send(message) {
            tracing::debug!("No active subscribers for request {}: {}", request_id, e);
        }
    }

    /// Broadcast an SSH verification update to all subscribers
    pub async fn broadcast_ssh_verification(&self, update: SshVerificationUpdate) {
        let request_id = match Uuid::parse_str(&update.request_id) {
            Ok(id) => id,
            Err(_) => {
                tracing::error!("Invalid request_id in SSH verification update: {}", update.request_id);
                return;
            }
        };

        // Get or create channel to ensure broadcasts are not lost
        let mut channels = self.provisioning_channels.write().await;
        let sender = channels.entry(request_id).or_insert_with(|| {
            let (sender, _) = broadcast::channel(CHANNEL_CAPACITY);
            sender
        });

        let message = ProgressMessage::SshVerificationUpdate(update);
        if let Err(e) = sender.send(message) {
            tracing::debug!("No active subscribers for request {}: {}", request_id, e);
        }
    }

    /// Broadcast an error message for provisioning
    pub async fn broadcast_provisioning_error(&self, request_id: Uuid, error: String) {
        let channels = self.provisioning_channels.read().await;
        if let Some(sender) = channels.get(&request_id) {
            let message = ProgressMessage::Error { message: error };
            if let Err(e) = sender.send(message) {
                tracing::debug!("No active subscribers for request {}: {}", request_id, e);
            }
        }
    }

    /// Clean up a provisioning channel when done
    pub async fn cleanup_provisioning(&self, request_id: Uuid) {
        let mut channels = self.provisioning_channels.write().await;
        channels.remove(&request_id);
        tracing::debug!("Cleaned up provisioning channel for request {}", request_id);
    }

    /// Subscribe to deletion progress updates for a specific VM
    pub async fn subscribe_deletion(&self, vm_id: Uuid) -> broadcast::Receiver<ProgressMessage> {
        let mut channels = self.deletion_channels.write().await;

        if let Some(sender) = channels.get(&vm_id) {
            sender.subscribe()
        } else {
            let (sender, receiver) = broadcast::channel(CHANNEL_CAPACITY);
            channels.insert(vm_id, sender);
            receiver
        }
    }

    /// Broadcast a deletion update to all subscribers
    pub async fn broadcast_deletion(&self, update: DeletionUpdate) {
        let vm_id = match Uuid::parse_str(&update.vm_id) {
            Ok(id) => id,
            Err(_) => {
                tracing::error!("Invalid vm_id in deletion update: {}", update.vm_id);
                return;
            }
        };

        // Get or create channel to ensure broadcasts are not lost
        let mut channels = self.deletion_channels.write().await;
        let sender = channels.entry(vm_id).or_insert_with(|| {
            let (sender, _) = broadcast::channel(CHANNEL_CAPACITY);
            sender
        });

        let message = ProgressMessage::DeletionUpdate(update);
        if let Err(e) = sender.send(message) {
            tracing::debug!("No active subscribers for VM {}: {}", vm_id, e);
        }
    }

    /// Broadcast an error message for deletion
    pub async fn broadcast_deletion_error(&self, vm_id: Uuid, error: String) {
        let channels = self.deletion_channels.read().await;
        if let Some(sender) = channels.get(&vm_id) {
            let message = ProgressMessage::Error { message: error };
            if let Err(e) = sender.send(message) {
                tracing::debug!("No active subscribers for VM {}: {}", vm_id, e);
            }
        }
    }

    /// Clean up a deletion channel when done
    pub async fn cleanup_deletion(&self, vm_id: Uuid) {
        let mut channels = self.deletion_channels.write().await;
        channels.remove(&vm_id);
        tracing::debug!("Cleaned up deletion channel for VM {}", vm_id);
    }
}
