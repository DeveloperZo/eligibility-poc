-- Additional columns for version control during approval
ALTER TABLE orchestration_state ADD COLUMN IF NOT EXISTS approval_snapshot_version VARCHAR(50);
ALTER TABLE orchestration_state ADD COLUMN IF NOT EXISTS approval_snapshot_data JSONB;
ALTER TABLE orchestration_state ADD COLUMN IF NOT EXISTS has_changes_since_submission BOOLEAN DEFAULT FALSE;
ALTER TABLE orchestration_state ADD COLUMN IF NOT EXISTS latest_version VARCHAR(50);

-- Track version at each approval step
ALTER TABLE orchestration_audit ADD COLUMN IF NOT EXISTS version_approved VARCHAR(50);
ALTER TABLE orchestration_audit ADD COLUMN IF NOT EXISTS version_current VARCHAR(50);

-- View to show plans with pending changes during approval
CREATE OR REPLACE VIEW plans_with_pending_changes AS
SELECT 
  os.resource_id,
  os.resource_type,
  os.workflow_state,
  os.approval_snapshot_version,
  os.latest_version,
  os.has_changes_since_submission,
  os.current_approval_step,
  os.submitted_at
FROM orchestration_state os
WHERE os.workflow_state = 'in_approval' 
  AND os.has_changes_since_submission = true
ORDER BY os.submitted_at ASC;

-- Function to check for version conflicts
CREATE OR REPLACE FUNCTION check_version_conflict(
  p_resource_id VARCHAR,
  p_expected_version VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_version VARCHAR;
BEGIN
  SELECT latest_version INTO v_current_version
  FROM orchestration_state
  WHERE resource_id = p_resource_id;
  
  RETURN v_current_version != p_expected_version;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN orchestration_state.approval_snapshot_version IS 'Version that was submitted for approval (frozen)';
COMMENT ON COLUMN orchestration_state.approval_snapshot_data IS 'Complete snapshot of the resource at submission time';
COMMENT ON COLUMN orchestration_state.has_changes_since_submission IS 'Flag indicating if resource was edited after submission';
COMMENT ON COLUMN orchestration_state.latest_version IS 'Current version in Aidbox (may differ from snapshot)';
