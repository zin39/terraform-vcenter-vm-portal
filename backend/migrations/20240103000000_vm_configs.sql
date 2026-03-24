-- Drop old columns from vm_requests (move VM-specific data to vm_configs)
ALTER TABLE vm_requests
    DROP COLUMN IF EXISTS vm_name,
    DROP COLUMN IF EXISTS cpu_cores,
    DROP COLUMN IF EXISTS ram_gb,
    DROP COLUMN IF EXISTS storage_gb,
    DROP COLUMN IF EXISTS os_type;

-- Add a title field for the overall request
ALTER TABLE vm_requests
    ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'VM Request';

-- Create vm_configs table for individual VM configurations
CREATE TABLE vm_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES vm_requests(id) ON DELETE CASCADE,

    -- VM identification
    vm_name VARCHAR(255) NOT NULL,

    -- Specifications
    cpu_cores INTEGER NOT NULL CHECK (cpu_cores > 0 AND cpu_cores <= 64),
    ram_gb INTEGER NOT NULL CHECK (ram_gb > 0 AND ram_gb <= 512),
    storage_gb INTEGER NOT NULL CHECK (storage_gb > 0 AND storage_gb <= 10000),
    os_type VARCHAR(100) NOT NULL,

    -- Network configuration
    ip_address VARCHAR(45) NOT NULL,
    gateway VARCHAR(45) NOT NULL DEFAULT '10.0.1.1',
    dns_primary VARCHAR(45) NOT NULL DEFAULT '10.0.0.2',
    dns_secondary VARCHAR(45) NOT NULL DEFAULT '8.8.8.8',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_vm_configs_request_id ON vm_configs(request_id);

-- Add updated_at trigger
CREATE TRIGGER update_vm_configs_updated_at
    BEFORE UPDATE ON vm_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
