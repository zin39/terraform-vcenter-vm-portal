-- Update OS templates with correct vSphere template names
-- Adjust the vsphere_template_name values to match your actual vCenter templates

-- Update Ubuntu template
UPDATE os_templates
SET vsphere_template_name = 'ubuntu-22.04-template'  -- Change this to your actual template name
WHERE name = 'ubuntu-22.04';

-- Update Rocky Linux template
UPDATE os_templates
SET vsphere_template_name = 'rocky-9-template'  -- Change this to your actual template name
WHERE name = 'rocky-9';

-- Verify templates
SELECT name, display_name, min_storage_gb, vsphere_template_name, is_active
FROM os_templates
ORDER BY name;

-- If you need to add additional templates:
-- INSERT INTO os_templates (name, display_name, min_storage_gb, vsphere_template_name, is_active) VALUES
-- ('debian-12', 'Debian 12', 20, 'debian-12-template', true);
