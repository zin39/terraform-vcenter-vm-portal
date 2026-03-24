-- OS Templates table (configurable OS options)
CREATE TABLE os_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,  -- internal name: ubuntu-22.04, rocky-9
    display_name VARCHAR(100) NOT NULL,  -- shown to users: Ubuntu 22.04 LTS
    min_storage_gb INTEGER NOT NULL DEFAULT 20,
    vsphere_template_name VARCHAR(255) NOT NULL,  -- actual template name in vCenter
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IP Addresses pool table
CREATE TABLE ip_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'in_use')),
    hostname VARCHAR(255),
    description TEXT,
    assigned_vm_config_id UUID REFERENCES vm_configs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ip_address, network_id)
);

-- Provisioned VMs table (track successfully created VMs)
CREATE TABLE provisioned_vms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vm_config_id UUID NOT NULL REFERENCES vm_configs(id) ON DELETE CASCADE,
    vm_request_id UUID NOT NULL REFERENCES vm_requests(id) ON DELETE CASCADE,
    vm_name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    os_template_id UUID REFERENCES os_templates(id),
    cpu_cores INTEGER NOT NULL,
    ram_gb INTEGER NOT NULL,
    storage_gb INTEGER NOT NULL,
    provisioned_by UUID NOT NULL REFERENCES users(id),
    provisioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    terraform_state_path VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'deleted')),
    deleted_at TIMESTAMPTZ
);

-- Add retry count to vm_requests
ALTER TABLE vm_requests ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vm_requests ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Indexes
CREATE INDEX idx_ip_addresses_network ON ip_addresses(network_id);
CREATE INDEX idx_ip_addresses_status ON ip_addresses(status);
CREATE INDEX idx_provisioned_vms_status ON provisioned_vms(status);
CREATE INDEX idx_provisioned_vms_request ON provisioned_vms(vm_request_id);

-- Insert default OS templates
INSERT INTO os_templates (name, display_name, min_storage_gb, vsphere_template_name, is_active) VALUES
('ubuntu-22.04', 'Ubuntu 22.04 LTS', 50, 'ubuntu-22.04-template', true),
('rocky-9', 'Rocky Linux 9', 30, 'rocky-9-template', true);

-- Note: Update vsphere_template_name values to match your actual vCenter template names
