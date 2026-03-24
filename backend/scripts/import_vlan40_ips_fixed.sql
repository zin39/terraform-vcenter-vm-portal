-- Example: Import IP addresses for a sample VLAN (10.0.1.0/24)

-- First, ensure the network exists (insert only if not exists)
INSERT INTO networks (name, vlan_id, subnet, gateway, vsphere_network_name, is_active)
SELECT 'VLAN 40', 40, '10.0.1.0/24', '10.0.1.1', 'VLAN40', true
WHERE NOT EXISTS (SELECT 1 FROM networks WHERE name = 'VLAN 40');

DO $$
DECLARE
    network_uuid UUID;
BEGIN
    SELECT id INTO network_uuid FROM networks WHERE name = 'VLAN 40';

    IF network_uuid IS NULL THEN
        RAISE EXCEPTION 'Network VLAN 40 not found';
    END IF;

    -- Gateway (reserved)
    INSERT INTO ip_addresses (ip_address, network_id, status, description) VALUES
    ('10.0.1.1', network_uuid, 'reserved', 'Gateway')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description;

    -- Free IPs: 10.0.1.2-9
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(2, 9) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.10-20
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'in_use' FROM generate_series(10, 20) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.21-45
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(21, 45) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.46
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.46', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.47-76
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(47, 76) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.77
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.77', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.78-94
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(78, 94) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.95
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.95', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.96-99
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(96, 99) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.100
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.100', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.101
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.101', network_uuid, 'available')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.102-103
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'in_use' FROM generate_series(102, 103) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.104-110
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(104, 110) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.111-127
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'in_use' FROM generate_series(111, 127) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.128-135
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(128, 135) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.136
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.136', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.137-139
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(137, 139) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.140-151
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'in_use' FROM generate_series(140, 151) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.152-159
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(152, 159) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.160-179
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'in_use' FROM generate_series(160, 179) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.180-189
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(180, 189) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.190-191
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'in_use' FROM generate_series(190, 191) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.192-194
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(192, 194) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.195
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.195', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.196-198
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(196, 198) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.199-203
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'in_use' FROM generate_series(199, 203) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.204-209
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(204, 209) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.210
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.210', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.211-212
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(211, 212) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.213
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.213', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.214-215
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(214, 215) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.216
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.216', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.217-219
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(217, 219) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.220
    INSERT INTO ip_addresses (ip_address, network_id, status) VALUES ('10.0.1.220', network_uuid, 'in_use')
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.221-229
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(221, 229) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.230-235
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'in_use' FROM generate_series(230, 235) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.236-239
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(236, 239) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    -- In use: 10.0.1.240-249
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'in_use' FROM generate_series(240, 249) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'in_use';

    -- Free: 10.0.1.250-254
    INSERT INTO ip_addresses (ip_address, network_id, status)
    SELECT '10.0.1.' || i, network_uuid, 'available' FROM generate_series(250, 254) AS i
    ON CONFLICT (ip_address, network_id) DO UPDATE SET status = 'available';

    RAISE NOTICE 'IP addresses imported successfully for VLAN 40';
END $$;

-- Verify import
SELECT status, COUNT(*) as count FROM ip_addresses
WHERE network_id = (SELECT id FROM networks WHERE name = 'VLAN 40')
GROUP BY status ORDER BY status;
