-- Create networks table for VLAN/network management
CREATE TABLE networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    vlan_id INTEGER,
    vsphere_network_name VARCHAR(255) NOT NULL,
    subnet VARCHAR(45),
    gateway VARCHAR(45),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on vsphere_network_name
CREATE UNIQUE INDEX idx_networks_vsphere_name ON networks(vsphere_network_name);

-- Add trigger for updated_at
CREATE TRIGGER update_networks_updated_at
    BEFORE UPDATE ON networks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add credentials columns to vm_configs
ALTER TABLE vm_configs
    ADD COLUMN IF NOT EXISTS username VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password VARCHAR(255),
    ADD COLUMN IF NOT EXISTS network_id UUID REFERENCES networks(id);

-- Insert some default networks (you can modify these)
INSERT INTO networks (name, vlan_id, vsphere_network_name, subnet, gateway, description) VALUES
    ('Production VLAN', 100, 'VLAN100-Production', '192.168.100.0/24', '192.168.100.1', 'Production network'),
    ('Development VLAN', 200, 'VLAN200-Development', '192.168.200.0/24', '192.168.200.1', 'Development and testing network'),
    ('Management VLAN', 10, 'VLAN10-Management', '192.168.10.0/24', '192.168.10.1', 'Management network'),
    ('DMZ VLAN', 50, 'VLAN50-DMZ', '192.168.50.0/24', '192.168.50.1', 'DMZ for external-facing services');
