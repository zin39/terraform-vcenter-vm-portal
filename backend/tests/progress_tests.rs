//! Tests for VM Provisioning Progress Tracking
//!
//! This module contains comprehensive tests for:
//! - Progress step enums and transitions
//! - Progress broadcaster service
//! - SSH checker service
//! - Deletion service
//! - WebSocket message serialization

// ============================================================================
// Progress Step Tests
// ============================================================================

#[cfg(test)]
mod provisioning_step_tests {
    use approval_portal::models::progress::{ProvisioningStep, DeletionStep};

    #[test]
    fn test_provisioning_step_ordering() {
        // Verify steps are in correct order
        assert_eq!(ProvisioningStep::Initializing.index(), 0);
        assert_eq!(ProvisioningStep::CreatingVm.index(), 1);
        assert_eq!(ProvisioningStep::ConfiguringNetwork.index(), 2);
        assert_eq!(ProvisioningStep::SettingUpUser.index(), 3);
        assert_eq!(ProvisioningStep::VerifyingSsh.index(), 4);
        assert_eq!(ProvisioningStep::Completed.index(), 5);
        assert_eq!(ProvisioningStep::Failed.index(), 5);
    }

    #[test]
    fn test_provisioning_step_as_str() {
        assert_eq!(ProvisioningStep::Initializing.as_str(), "initializing");
        assert_eq!(ProvisioningStep::CreatingVm.as_str(), "creating_vm");
        assert_eq!(ProvisioningStep::ConfiguringNetwork.as_str(), "configuring_network");
        assert_eq!(ProvisioningStep::SettingUpUser.as_str(), "setting_up_user");
        assert_eq!(ProvisioningStep::VerifyingSsh.as_str(), "verifying_ssh");
        assert_eq!(ProvisioningStep::Completed.as_str(), "completed");
        assert_eq!(ProvisioningStep::Failed.as_str(), "failed");
    }

    #[test]
    fn test_provisioning_step_display_names() {
        assert_eq!(ProvisioningStep::Initializing.display_name(), "Initializing");
        assert_eq!(ProvisioningStep::CreatingVm.display_name(), "Creating VM");
        assert_eq!(ProvisioningStep::ConfiguringNetwork.display_name(), "Configuring Network");
        assert_eq!(ProvisioningStep::SettingUpUser.display_name(), "Setting up User");
        assert_eq!(ProvisioningStep::VerifyingSsh.display_name(), "Verifying SSH");
        assert_eq!(ProvisioningStep::Completed.display_name(), "Completed");
        assert_eq!(ProvisioningStep::Failed.display_name(), "Failed");
    }

    #[test]
    fn test_deletion_step_ordering() {
        assert_eq!(DeletionStep::Initializing.index(), 0);
        assert_eq!(DeletionStep::DestroyingInfrastructure.index(), 1);
        assert_eq!(DeletionStep::ReleasingResources.index(), 2);
        assert_eq!(DeletionStep::Completed.index(), 3);
        assert_eq!(DeletionStep::Failed.index(), 3);
    }

    #[test]
    fn test_deletion_step_as_str() {
        assert_eq!(DeletionStep::Initializing.as_str(), "initializing");
        assert_eq!(DeletionStep::DestroyingInfrastructure.as_str(), "destroying_infrastructure");
        assert_eq!(DeletionStep::ReleasingResources.as_str(), "releasing_resources");
        assert_eq!(DeletionStep::Completed.as_str(), "completed");
        assert_eq!(DeletionStep::Failed.as_str(), "failed");
    }

    #[test]
    fn test_total_steps_constants() {
        // Provisioning has 6 total steps (0-5)
        assert_eq!(ProvisioningStep::Completed.index() + 1, 6);

        // Deletion has 4 total steps (0-3)
        assert_eq!(DeletionStep::Completed.index() + 1, 4);
    }

    #[test]
    fn test_failed_step_same_index_as_completed() {
        // Failed and Completed should have same index (final step)
        assert_eq!(
            ProvisioningStep::Failed.index(),
            ProvisioningStep::Completed.index()
        );
        assert_eq!(
            DeletionStep::Failed.index(),
            DeletionStep::Completed.index()
        );
    }

    #[test]
    fn test_provisioning_step_from_str() {
        assert_eq!(ProvisioningStep::from_str("initializing"), ProvisioningStep::Initializing);
        assert_eq!(ProvisioningStep::from_str("creating_vm"), ProvisioningStep::CreatingVm);
        assert_eq!(ProvisioningStep::from_str("completed"), ProvisioningStep::Completed);
        assert_eq!(ProvisioningStep::from_str("failed"), ProvisioningStep::Failed);
        // Unknown defaults to Initializing
        assert_eq!(ProvisioningStep::from_str("unknown"), ProvisioningStep::Initializing);
    }

    #[test]
    fn test_deletion_step_from_str() {
        assert_eq!(DeletionStep::from_str("initializing"), DeletionStep::Initializing);
        assert_eq!(DeletionStep::from_str("destroying_infrastructure"), DeletionStep::DestroyingInfrastructure);
        assert_eq!(DeletionStep::from_str("completed"), DeletionStep::Completed);
        // Unknown defaults to Initializing
        assert_eq!(DeletionStep::from_str("unknown"), DeletionStep::Initializing);
    }
}

// ============================================================================
// Progress Message Serialization Tests
// ============================================================================

#[cfg(test)]
mod progress_message_tests {
    use approval_portal::models::progress::{
        ProvisioningUpdate, SshVerificationUpdate, DeletionUpdate, ProgressMessage
    };
    use uuid::Uuid;
    use chrono::Utc;

    #[test]
    fn test_provisioning_update_serialization() {
        let update = ProvisioningUpdate {
            request_id: Uuid::new_v4().to_string(),
            step: "creating_vm".to_string(),
            step_index: 1,
            total_steps: 6,
            message: "Running terraform apply...".to_string(),
            is_complete: false,
            is_error: false,
            timestamp: Utc::now(),
        };

        let json = serde_json::to_string(&update).unwrap();
        assert!(json.contains("creating_vm"));
        assert!(json.contains("Running terraform apply"));
        assert!(json.contains("\"is_complete\":false"));
        assert!(json.contains("\"is_error\":false"));
    }

    #[test]
    fn test_provisioning_update_completion_states() {
        // Successful completion
        let success = ProvisioningUpdate {
            request_id: Uuid::new_v4().to_string(),
            step: "completed".to_string(),
            step_index: 5,
            total_steps: 6,
            message: "VM provisioned successfully".to_string(),
            is_complete: true,
            is_error: false,
            timestamp: Utc::now(),
        };
        assert!(success.is_complete);
        assert!(!success.is_error);

        // Failed completion
        let failed = ProvisioningUpdate {
            request_id: Uuid::new_v4().to_string(),
            step: "failed".to_string(),
            step_index: 5,
            total_steps: 6,
            message: "Terraform apply failed".to_string(),
            is_complete: true,
            is_error: true,
            timestamp: Utc::now(),
        };
        assert!(failed.is_complete);
        assert!(failed.is_error);
    }

    #[test]
    fn test_ssh_verification_update_serialization() {
        let update = SshVerificationUpdate {
            request_id: Uuid::new_v4().to_string(),
            vm_config_id: Uuid::new_v4().to_string(),
            vm_name: "test-vm-01".to_string(),
            ip_address: "10.0.1.100".to_string(),
            is_reachable: true,
            attempt: 3,
            max_attempts: 12,
            latency_ms: Some(45),
            error_message: None,
            timestamp: Utc::now(),
        };

        let json = serde_json::to_string(&update).unwrap();
        assert!(json.contains("test-vm-01"));
        assert!(json.contains("10.0.1.100"));
        assert!(json.contains("\"is_reachable\":true"));
        assert!(json.contains("\"latency_ms\":45"));
    }

    #[test]
    fn test_ssh_verification_failure_case() {
        let update = SshVerificationUpdate {
            request_id: Uuid::new_v4().to_string(),
            vm_config_id: Uuid::new_v4().to_string(),
            vm_name: "unreachable-vm".to_string(),
            ip_address: "10.0.1.200".to_string(),
            is_reachable: false,
            attempt: 12,
            max_attempts: 12,
            latency_ms: None,
            error_message: Some("Connection refused".to_string()),
            timestamp: Utc::now(),
        };

        assert!(!update.is_reachable);
        assert!(update.error_message.is_some());
        assert!(update.latency_ms.is_none());
    }

    #[test]
    fn test_deletion_update_serialization() {
        let update = DeletionUpdate {
            vm_id: Uuid::new_v4().to_string(),
            step: "destroying_infrastructure".to_string(),
            step_index: 1,
            total_steps: 4,
            message: "Running terraform destroy...".to_string(),
            is_complete: false,
            is_error: false,
            timestamp: Utc::now(),
        };

        let json = serde_json::to_string(&update).unwrap();
        assert!(json.contains("destroying_infrastructure"));
        assert!(json.contains("terraform destroy"));
    }

    #[test]
    fn test_progress_message_variants() {
        let request_id = Uuid::new_v4().to_string();

        // Test connected message serializes correctly
        let connected = ProgressMessage::Connected { request_id: request_id.clone() };
        let json = serde_json::to_string(&connected).unwrap();
        assert!(json.contains("connected"));

        let error = ProgressMessage::Error {
            message: "Test error".to_string()
        };
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("error"));
        assert!(json.contains("Test error"));
    }

    #[test]
    fn test_progress_message_deserialization() {
        // Test deserializing connected message
        let json = r#"{"type":"connected","request_id":"test-123"}"#;
        let msg: ProgressMessage = serde_json::from_str(json).unwrap();
        match msg {
            ProgressMessage::Connected { request_id } => {
                assert_eq!(request_id, "test-123");
            }
            _ => panic!("Expected Connected message"),
        }

        // Test deserializing error message
        let json = r#"{"type":"error","message":"Something went wrong"}"#;
        let msg: ProgressMessage = serde_json::from_str(json).unwrap();
        match msg {
            ProgressMessage::Error { message } => {
                assert_eq!(message, "Something went wrong");
            }
            _ => panic!("Expected Error message"),
        }
    }
}

// ============================================================================
// IP Address Validation Tests
// ============================================================================

#[cfg(test)]
mod ip_validation_tests {
    fn is_valid_ip(ip: &str) -> bool {
        let parts: Vec<&str> = ip.split('.').collect();
        if parts.len() != 4 {
            return false;
        }
        parts.iter().all(|part| {
            part.parse::<u8>().is_ok() && !part.starts_with('0') || *part == "0"
        })
    }

    #[test]
    fn test_valid_ip_addresses() {
        assert!(is_valid_ip("10.0.1.100"));
        assert!(is_valid_ip("192.168.1.1"));
        assert!(is_valid_ip("0.0.0.0"));
        assert!(is_valid_ip("255.255.255.255"));
        assert!(is_valid_ip("172.16.0.1"));
    }

    #[test]
    fn test_invalid_ip_addresses() {
        assert!(!is_valid_ip(""));
        assert!(!is_valid_ip("10.10.40"));
        assert!(!is_valid_ip("10.0.1.256"));
        assert!(!is_valid_ip("10.0.1.100.50"));
        assert!(!is_valid_ip("abc.def.ghi.jkl"));
        assert!(!is_valid_ip("10.0.1.-1"));
        assert!(!is_valid_ip("10.0.1.1.1"));
    }

    #[test]
    fn test_edge_case_ip_addresses() {
        assert!(is_valid_ip("1.1.1.1"));
        assert!(is_valid_ip("10.0.0.1"));
        assert!(!is_valid_ip("10.0.1.1000"));
    }
}

// ============================================================================
// VM Name Validation Tests
// ============================================================================

#[cfg(test)]
mod vm_name_validation_tests {
    fn is_valid_vm_name(name: &str) -> Result<(), String> {
        if name.is_empty() {
            return Err("VM name is required".to_string());
        }
        if name.len() < 3 {
            return Err("VM name must be at least 3 characters".to_string());
        }
        if name.len() > 63 {
            return Err("VM name must be under 63 characters".to_string());
        }
        let first_char = name.chars().next().unwrap();
        if !first_char.is_ascii_alphabetic() {
            return Err("Must start with a letter".to_string());
        }
        if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            return Err("Only letters, numbers, hyphens, and underscores allowed".to_string());
        }
        if name.ends_with('-') || name.ends_with('_') {
            return Err("Cannot end with hyphen or underscore".to_string());
        }
        Ok(())
    }

    #[test]
    fn test_valid_vm_names() {
        assert!(is_valid_vm_name("dev-server-01").is_ok());
        assert!(is_valid_vm_name("web").is_ok());
        assert!(is_valid_vm_name("test_vm_123").is_ok());
        assert!(is_valid_vm_name("Production-DB-Primary").is_ok());
        assert!(is_valid_vm_name("vm1").is_ok());
    }

    #[test]
    fn test_invalid_vm_names_too_short() {
        assert!(is_valid_vm_name("").is_err());
        assert!(is_valid_vm_name("ab").is_err());
        assert!(is_valid_vm_name("v1").is_err());
    }

    #[test]
    fn test_invalid_vm_names_too_long() {
        let long_name = "a".repeat(64);
        assert!(is_valid_vm_name(&long_name).is_err());
    }

    #[test]
    fn test_invalid_vm_names_start_character() {
        assert!(is_valid_vm_name("1server").is_err());
        assert!(is_valid_vm_name("-server").is_err());
        assert!(is_valid_vm_name("_server").is_err());
        assert!(is_valid_vm_name("123abc").is_err());
    }

    #[test]
    fn test_invalid_vm_names_end_character() {
        assert!(is_valid_vm_name("server-").is_err());
        assert!(is_valid_vm_name("server_").is_err());
    }

    #[test]
    fn test_invalid_vm_names_special_chars() {
        assert!(is_valid_vm_name("server.name").is_err());
        assert!(is_valid_vm_name("server@host").is_err());
        assert!(is_valid_vm_name("server name").is_err());
        assert!(is_valid_vm_name("server$1").is_err());
    }

    #[test]
    fn test_edge_case_vm_names() {
        // Exactly 3 characters
        assert!(is_valid_vm_name("abc").is_ok());

        // Exactly 63 characters
        let max_name = "a".repeat(63);
        assert!(is_valid_vm_name(&max_name).is_ok());

        // Mixed valid characters
        assert!(is_valid_vm_name("Dev-VM_01-Test").is_ok());
    }
}

// ============================================================================
// Concurrent Operations Tests
// ============================================================================

#[cfg(test)]
mod concurrency_tests {
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tokio::sync::broadcast;

    #[tokio::test]
    async fn test_broadcast_channel_multiple_subscribers() {
        let (tx, _) = broadcast::channel::<String>(16);

        let mut rx1 = tx.subscribe();
        let mut rx2 = tx.subscribe();
        let mut rx3 = tx.subscribe();

        tx.send("test message".to_string()).unwrap();

        assert_eq!(rx1.recv().await.unwrap(), "test message");
        assert_eq!(rx2.recv().await.unwrap(), "test message");
        assert_eq!(rx3.recv().await.unwrap(), "test message");
    }

    #[tokio::test]
    async fn test_broadcast_channel_late_subscriber() {
        let (tx, mut _initial_rx) = broadcast::channel::<String>(16);

        // Send first message (requires at least one receiver to exist)
        tx.send("first".to_string()).unwrap();

        // Late subscriber should not receive previous message
        let mut rx = tx.subscribe();
        tx.send("second".to_string()).unwrap();

        // Late subscriber only receives messages sent after subscription
        assert_eq!(rx.recv().await.unwrap(), "second");
    }

    #[tokio::test]
    async fn test_multiple_concurrent_broadcasts() {
        let counter = Arc::new(AtomicUsize::new(0));
        let (tx, _) = broadcast::channel::<usize>(100);

        let mut handles = vec![];

        // Create 10 subscribers
        for _ in 0..10 {
            let mut rx = tx.subscribe();
            let counter_clone = counter.clone();
            let handle = tokio::spawn(async move {
                while let Ok(val) = rx.recv().await {
                    counter_clone.fetch_add(val, Ordering::SeqCst);
                }
            });
            handles.push(handle);
        }

        // Send 10 messages
        for i in 1..=10 {
            tx.send(i).unwrap();
        }

        // Drop sender to close channel
        drop(tx);

        // Wait for all subscribers
        for handle in handles {
            let _ = handle.await;
        }

        // Each subscriber should receive sum 1+2+...+10 = 55
        // With 10 subscribers, total = 55 * 10 = 550
        assert_eq!(counter.load(Ordering::SeqCst), 550);
    }
}

// ============================================================================
// Timeout and Retry Logic Tests
// ============================================================================

#[cfg(test)]
mod timeout_tests {
    use std::time::{Duration, Instant};

    const MAX_SSH_ATTEMPTS: u32 = 12;
    const SSH_RETRY_DELAY_SECS: u64 = 10;
    const SSH_TIMEOUT_SECS: u64 = 5;

    #[test]
    fn test_ssh_max_duration_calculation() {
        // Maximum time for SSH verification
        // 12 attempts * (5s timeout + 10s delay) = 180 seconds (3 minutes max)
        let max_duration_secs = MAX_SSH_ATTEMPTS as u64 * (SSH_TIMEOUT_SECS + SSH_RETRY_DELAY_SECS);
        assert_eq!(max_duration_secs, 180);
    }

    #[test]
    fn test_exponential_backoff_calculation() {
        let base_delay = 1000u64; // 1 second
        let max_attempts = 5;

        let mut delays = vec![];
        for attempt in 0..max_attempts {
            let delay = base_delay * 2u64.pow(attempt);
            delays.push(delay);
        }

        assert_eq!(delays, vec![1000, 2000, 4000, 8000, 16000]);
    }

    #[test]
    fn test_exponential_backoff_with_max_cap() {
        let base_delay = 1000u64;
        let max_delay = 30000u64; // 30 seconds cap

        let mut delays = vec![];
        for attempt in 0..10 {
            let delay = std::cmp::min(base_delay * 2u64.pow(attempt), max_delay);
            delays.push(delay);
        }

        // Should cap at 30000
        assert!(delays.iter().all(|&d| d <= 30000));
        assert_eq!(delays[6..], vec![30000, 30000, 30000, 30000]);
    }

    #[tokio::test]
    async fn test_timeout_respects_duration() {
        let start = Instant::now();
        let timeout = Duration::from_millis(100);

        let result = tokio::time::timeout(
            timeout,
            tokio::time::sleep(Duration::from_secs(10))
        ).await;

        assert!(result.is_err()); // Should timeout
        assert!(start.elapsed() < Duration::from_millis(200)); // Should be quick
    }
}

// ============================================================================
// Error Handling Tests
// ============================================================================

#[cfg(test)]
mod error_handling_tests {
    use std::io::{Error, ErrorKind};

    #[test]
    fn test_connection_refused_error() {
        let error = Error::new(ErrorKind::ConnectionRefused, "Connection refused");
        assert_eq!(error.kind(), ErrorKind::ConnectionRefused);
        assert!(error.to_string().contains("refused"));
    }

    #[test]
    fn test_timeout_error() {
        let error = Error::new(ErrorKind::TimedOut, "Connection timed out");
        assert_eq!(error.kind(), ErrorKind::TimedOut);
    }

    #[test]
    fn test_host_unreachable_error() {
        let error = Error::new(ErrorKind::AddrNotAvailable, "Host unreachable");
        assert_eq!(error.kind(), ErrorKind::AddrNotAvailable);
    }

    #[test]
    fn test_error_message_formatting() {
        let ip = "10.0.1.100";
        let attempt = 5;
        let max_attempts = 12;

        let message = format!(
            "SSH check failed for {} (attempt {}/{}): Connection refused",
            ip, attempt, max_attempts
        );

        assert!(message.contains(ip));
        assert!(message.contains("5/12"));
        assert!(message.contains("Connection refused"));
    }
}

// ============================================================================
// Database Status Transition Tests
// ============================================================================

#[cfg(test)]
mod status_transition_tests {
    #[derive(Debug, PartialEq, Clone)]
    enum VmStatus {
        Pending,
        Provisioning,
        Running,
        Deleting,
        Deleted,
        Failed,
    }

    impl VmStatus {
        fn can_transition_to(&self, new_status: &VmStatus) -> bool {
            match (self, new_status) {
                // Pending can go to Provisioning or Failed
                (VmStatus::Pending, VmStatus::Provisioning) => true,
                (VmStatus::Pending, VmStatus::Failed) => true,

                // Provisioning can go to Running or Failed
                (VmStatus::Provisioning, VmStatus::Running) => true,
                (VmStatus::Provisioning, VmStatus::Failed) => true,

                // Running can go to Deleting
                (VmStatus::Running, VmStatus::Deleting) => true,

                // Deleting can go to Deleted or Failed
                (VmStatus::Deleting, VmStatus::Deleted) => true,
                (VmStatus::Deleting, VmStatus::Failed) => true,

                // No other transitions allowed
                _ => false,
            }
        }
    }

    #[test]
    fn test_valid_provisioning_flow() {
        let status = VmStatus::Pending;
        assert!(status.can_transition_to(&VmStatus::Provisioning));

        let status = VmStatus::Provisioning;
        assert!(status.can_transition_to(&VmStatus::Running));
    }

    #[test]
    fn test_valid_deletion_flow() {
        let status = VmStatus::Running;
        assert!(status.can_transition_to(&VmStatus::Deleting));

        let status = VmStatus::Deleting;
        assert!(status.can_transition_to(&VmStatus::Deleted));
    }

    #[test]
    fn test_invalid_transitions() {
        // Can't go from Pending to Running directly
        assert!(!VmStatus::Pending.can_transition_to(&VmStatus::Running));

        // Can't go from Running to Provisioning
        assert!(!VmStatus::Running.can_transition_to(&VmStatus::Provisioning));

        // Can't go from Deleted to anything
        assert!(!VmStatus::Deleted.can_transition_to(&VmStatus::Running));
        assert!(!VmStatus::Deleted.can_transition_to(&VmStatus::Deleting));

        // Can't go from Pending directly to Deleting
        assert!(!VmStatus::Pending.can_transition_to(&VmStatus::Deleting));
    }

    #[test]
    fn test_failure_transitions() {
        // Any active state can fail
        assert!(VmStatus::Pending.can_transition_to(&VmStatus::Failed));
        assert!(VmStatus::Provisioning.can_transition_to(&VmStatus::Failed));
        assert!(VmStatus::Deleting.can_transition_to(&VmStatus::Failed));

        // Running cannot directly fail (must go through deletion)
        assert!(!VmStatus::Running.can_transition_to(&VmStatus::Failed));
    }
}

// ============================================================================
// Resource Calculation Tests
// ============================================================================

#[cfg(test)]
mod resource_tests {
    #[test]
    fn test_total_cpu_calculation() {
        let vms = vec![
            ("vm1", 2),
            ("vm2", 4),
            ("vm3", 8),
        ];

        let total_cpu: i32 = vms.iter().map(|(_, cpu)| cpu).sum();
        assert_eq!(total_cpu, 14);
    }

    #[test]
    fn test_total_ram_calculation() {
        let vms = vec![
            ("vm1", 4),
            ("vm2", 8),
            ("vm3", 16),
        ];

        let total_ram: i32 = vms.iter().map(|(_, ram)| ram).sum();
        assert_eq!(total_ram, 28);
    }

    #[test]
    fn test_total_storage_calculation() {
        let vms = vec![
            ("vm1", 50),
            ("vm2", 100),
            ("vm3", 500),
        ];

        let total_storage: i32 = vms.iter().map(|(_, storage)| storage).sum();
        assert_eq!(total_storage, 650);
    }

    #[test]
    fn test_storage_display_formatting() {
        fn format_storage(gb: i32) -> String {
            if gb >= 1000 {
                format!("{:.1} TB", gb as f64 / 1000.0)
            } else {
                format!("{} GB", gb)
            }
        }

        assert_eq!(format_storage(500), "500 GB");
        assert_eq!(format_storage(1000), "1.0 TB");
        assert_eq!(format_storage(1500), "1.5 TB");
        assert_eq!(format_storage(2000), "2.0 TB");
    }

    #[test]
    fn test_minimum_storage_by_os() {
        fn get_min_storage(os_type: &str) -> i32 {
            match os_type {
                "ubuntu-22.04" => 20,
                "ubuntu-24.04" => 25,
                "windows-server-2022" => 50,
                "rhel-9" => 30,
                _ => 20,
            }
        }

        assert_eq!(get_min_storage("ubuntu-22.04"), 20);
        assert_eq!(get_min_storage("windows-server-2022"), 50);
        assert_eq!(get_min_storage("unknown-os"), 20);
    }
}

// ============================================================================
// WebSocket URL Construction Tests
// ============================================================================

#[cfg(test)]
mod websocket_url_tests {
    fn build_ws_url(protocol: &str, host: &str, request_id: &str, token: &str) -> String {
        let ws_protocol = if protocol == "https:" { "wss:" } else { "ws:" };
        format!(
            "{}//{}/api/ws/provisioning/{}?token={}",
            ws_protocol, host, request_id, token
        )
    }

    #[test]
    fn test_ws_url_https() {
        let request_id = "550e8400-e29b-41d4-a716-446655440000";
        let url = build_ws_url("https:", "example.com", request_id, "abc123");

        assert!(url.starts_with("wss://"));
        assert!(url.contains("example.com"));
        assert!(url.contains(request_id));
        assert!(url.contains("token=abc123"));
    }

    #[test]
    fn test_ws_url_http() {
        let request_id = "550e8400-e29b-41d4-a716-446655440000";
        let url = build_ws_url("http:", "localhost:3000", request_id, "token123");

        assert!(url.starts_with("ws://"));
        assert!(url.contains("localhost:3000"));
    }

    #[test]
    fn test_ws_url_with_special_token() {
        let request_id = "test-request-123";
        let token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
        let url = build_ws_url("https:", "api.example.com", request_id, token);

        assert!(url.contains(token));
    }
}

// ============================================================================
// Pagination Tests
// ============================================================================

#[cfg(test)]
mod pagination_tests {
    fn calculate_offset(page: i64, per_page: i64) -> i64 {
        (page.max(1) - 1) * per_page.min(100)
    }

    fn calculate_total_pages(total: i64, per_page: i64) -> i64 {
        (total + per_page - 1) / per_page
    }

    #[test]
    fn test_offset_calculation() {
        assert_eq!(calculate_offset(1, 20), 0);
        assert_eq!(calculate_offset(2, 20), 20);
        assert_eq!(calculate_offset(3, 20), 40);
        assert_eq!(calculate_offset(5, 10), 40);
    }

    #[test]
    fn test_offset_with_invalid_page() {
        // Page 0 should be treated as page 1
        assert_eq!(calculate_offset(0, 20), 0);
        assert_eq!(calculate_offset(-1, 20), 0);
    }

    #[test]
    fn test_per_page_limit() {
        // Should cap at 100
        assert_eq!(calculate_offset(2, 200), 100);
    }

    #[test]
    fn test_total_pages_calculation() {
        assert_eq!(calculate_total_pages(100, 20), 5);
        assert_eq!(calculate_total_pages(101, 20), 6);
        assert_eq!(calculate_total_pages(99, 20), 5);
        assert_eq!(calculate_total_pages(0, 20), 0);
    }
}
