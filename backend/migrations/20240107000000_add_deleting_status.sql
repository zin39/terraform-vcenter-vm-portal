-- Add 'deleting' status to provisioned_vms status check constraint

-- Drop the old constraint
ALTER TABLE provisioned_vms DROP CONSTRAINT IF EXISTS provisioned_vms_status_check;

-- Add new constraint with 'deleting' status
ALTER TABLE provisioned_vms ADD CONSTRAINT provisioned_vms_status_check
    CHECK (status IN ('running', 'stopped', 'deleting', 'deleted'));
