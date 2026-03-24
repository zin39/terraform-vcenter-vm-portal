-- Create request status enum
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'provisioning', 'completed', 'failed');

-- Create VM requests table
CREATE TABLE vm_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id),

    -- VM details
    vm_name VARCHAR(255) NOT NULL,
    description TEXT,
    purpose TEXT NOT NULL,

    -- Specifications
    cpu_cores INTEGER NOT NULL CHECK (cpu_cores > 0 AND cpu_cores <= 64),
    ram_gb INTEGER NOT NULL CHECK (ram_gb > 0 AND ram_gb <= 512),
    storage_gb INTEGER NOT NULL CHECK (storage_gb > 0 AND storage_gb <= 10000),
    os_type VARCHAR(100) NOT NULL,

    -- Request workflow
    status request_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_vm_requests_requester ON vm_requests(requester_id);
CREATE INDEX idx_vm_requests_status ON vm_requests(status);
CREATE INDEX idx_vm_requests_created_at ON vm_requests(created_at);

-- Add updated_at trigger
CREATE TRIGGER update_vm_requests_updated_at
    BEFORE UPDATE ON vm_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
