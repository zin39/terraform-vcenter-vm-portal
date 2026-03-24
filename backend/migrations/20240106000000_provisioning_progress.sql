-- Progress tracking for VM provisioning
CREATE TABLE provisioning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vm_request_id UUID NOT NULL REFERENCES vm_requests(id) ON DELETE CASCADE,
    current_step VARCHAR(50) NOT NULL DEFAULT 'initializing',
    step_index INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 6,
    step_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Progress tracking for VM deletion
CREATE TABLE deletion_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provisioned_vm_id UUID NOT NULL REFERENCES provisioned_vms(id) ON DELETE CASCADE,
    current_step VARCHAR(50) NOT NULL DEFAULT 'initializing',
    step_index INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 4,
    step_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SSH verification results for provisioned VMs
CREATE TABLE ssh_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vm_request_id UUID NOT NULL REFERENCES vm_requests(id) ON DELETE CASCADE,
    vm_config_id UUID NOT NULL UNIQUE REFERENCES vm_configs(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    is_reachable BOOLEAN NOT NULL DEFAULT false,
    latency_ms INTEGER,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_provisioning_progress_request ON provisioning_progress(vm_request_id);
CREATE INDEX idx_deletion_progress_vm ON deletion_progress(provisioned_vm_id);
CREATE INDEX idx_ssh_verification_request ON ssh_verification(vm_request_id);
CREATE INDEX idx_ssh_verification_config ON ssh_verification(vm_config_id);
