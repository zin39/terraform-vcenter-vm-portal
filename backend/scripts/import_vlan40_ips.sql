-- Example: Import IP addresses for a sample VLAN (10.0.1.0/24)
-- Run this script after migrations to populate IP address pool

-- First, ensure the example network exists
INSERT INTO networks (name, vlan_id, cidr, gateway, dns_primary, dns_secondary, vsphere_network_name, is_active)
VALUES ('VLAN 40', 40, '10.0.1.0/24', '10.0.1.1', '10.0.0.2', '8.8.8.8', 'VLAN40', true)
ON CONFLICT (name) DO NOTHING;

-- Get the network ID and insert IP addresses
DO $$
DECLARE
    network_uuid UUID;
BEGIN
    SELECT id INTO network_uuid FROM networks WHERE name = 'VLAN 40';

    IF network_uuid IS NULL THEN
        RAISE EXCEPTION 'Network VLAN 40 not found';
    END IF;

    -- Insert all IP addresses for the network
    -- Status: 'in_use' for currently used IPs, 'reserved' for infrastructure, 'available' for pool

    -- Reserved/Infrastructure IPs (1-9)
    INSERT INTO ip_addresses (ip_address, network_id, status, description) VALUES
    ('10.0.1.1', network_uuid, 'reserved', 'Gateway'),
    ('10.0.1.2', network_uuid, 'in_use', 'vcenter.example.com'),
    ('10.0.1.3', network_uuid, 'in_use', 'esxi-1'),
    ('10.0.1.4', network_uuid, 'in_use', 'esxi-2'),
    ('10.0.1.5', network_uuid, 'in_use', 'vsan.example.local'),
    ('10.0.1.6', network_uuid, 'available', NULL),
    ('10.0.1.7', network_uuid, 'available', NULL),
    ('10.0.1.8', network_uuid, 'in_use', 'nas.example.local'),
    ('10.0.1.9', network_uuid, 'in_use', 'proxmox.example.local')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description;

    -- IPs 10-19
    INSERT INTO ip_addresses (ip_address, network_id, status, description) VALUES
    ('10.0.1.10', network_uuid, 'in_use', 'backup.example.local'),
    ('10.0.1.11', network_uuid, 'in_use', 'hypervisor-1.example.local'),
    ('10.0.1.12', network_uuid, 'in_use', 'hypervisor-2.example.local'),
    ('10.0.1.13', network_uuid, 'in_use', 'portal.example.local'),
    ('10.0.1.14', network_uuid, 'available', NULL),
    ('10.0.1.15', network_uuid, 'available', NULL),
    ('10.0.1.16', network_uuid, 'available', NULL),
    ('10.0.1.17', network_uuid, 'available', NULL),
    ('10.0.1.18', network_uuid, 'available', NULL),
    ('10.0.1.19', network_uuid, 'available', NULL)
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description;

    -- IPs 20-29
    INSERT INTO ip_addresses (ip_address, network_id, status, description) VALUES
    ('10.0.1.20', network_uuid, 'available', NULL),
    ('10.0.1.21', network_uuid, 'available', NULL),
    ('10.0.1.22', network_uuid, 'available', NULL),
    ('10.0.1.23', network_uuid, 'available', NULL),
    ('10.0.1.24', network_uuid, 'available', NULL),
    ('10.0.1.25', network_uuid, 'available', NULL),
    ('10.0.1.26', network_uuid, 'available', NULL),
    ('10.0.1.27', network_uuid, 'available', NULL),
    ('10.0.1.28', network_uuid, 'available', NULL),
    ('10.0.1.29', network_uuid, 'available', NULL)
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description;

    -- IPs 30-39
    INSERT INTO ip_addresses (ip_address, network_id, status, description) VALUES
    ('10.0.1.30', network_uuid, 'available', NULL),
    ('10.0.1.31', network_uuid, 'available', NULL),
    ('10.0.1.32', network_uuid, 'available', NULL),
    ('10.0.1.33', network_uuid, 'available', NULL),
    ('10.0.1.34', network_uuid, 'available', NULL),
    ('10.0.1.35', network_uuid, 'available', NULL),
    ('10.0.1.36', network_uuid, 'available', NULL),
    ('10.0.1.37', network_uuid, 'available', NULL),
    ('10.0.1.38', network_uuid, 'available', NULL),
    ('10.0.1.39', network_uuid, 'available', NULL)
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description;

    -- IPs 40-49
    INSERT INTO ip_addresses (ip_address, network_id, status, description) VALUES
    ('10.0.1.40', network_uuid, 'available', NULL),
    ('10.0.1.41', network_uuid, 'available', NULL),
    ('10.0.1.42', network_uuid, 'available', NULL),
    ('10.0.1.43', network_uuid, 'available', NULL),
    ('10.0.1.44', network_uuid, 'available', NULL),
    ('10.0.1.45', network_uuid, 'available', NULL),
    ('10.0.1.46', network_uuid, 'available', NULL),
    ('10.0.1.47', network_uuid, 'available', NULL),
    ('10.0.1.48', network_uuid, 'available', NULL),
    ('10.0.1.49', network_uuid, 'available', NULL)
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description;

    -- IPs 50-99
    INSERT INTO ip_addresses (ip_address, network_id, status, description)
    SELECT '10.0.1.' || i, network_uuid, 'available', NULL
    FROM generate_series(50, 99) AS i
    ON CONFLICT (ip_address, network_id) DO NOTHING;

    -- IPs 100-199
    INSERT INTO ip_addresses (ip_address, network_id, status, description)
    SELECT '10.0.1.' || i, network_uuid, 'available', NULL
    FROM generate_series(100, 199) AS i
    ON CONFLICT (ip_address, network_id) DO NOTHING;

    -- IPs 200-254 (excluding broadcast)
    INSERT INTO ip_addresses (ip_address, network_id, status, description)
    SELECT '10.0.1.' || i, network_uuid, 'available', NULL
    FROM generate_series(200, 254) AS i
    ON CONFLICT (ip_address, network_id) DO NOTHING;

    RAISE NOTICE 'IP addresses imported successfully for VLAN 40';
END $$;

-- Verify import
SELECT
    status,
    COUNT(*) as count
FROM ip_addresses
WHERE network_id = (SELECT id FROM networks WHERE name = 'VLAN 40')
GROUP BY status
ORDER BY status;
