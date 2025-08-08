-- Simplified Orchestration Schema V3
-- Clean approach: Only store proposed changes during approval
-- Aidbox remains the single source of truth

-- Drop existing tables if doing fresh install
-- DROP TABLE IF EXISTS orchestration_state CASCADE;
-- DROP TABLE IF EXISTS orchestration_audit CASCADE;

-- Main orchestration state table (simplified)
CREATE TABLE IF NOT EXISTS orchestration_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Resource identification
    resource_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    
    -- Version control (simple)
    base_version VARCHAR(50) NOT NULL,        -- Aidbox version we started from
    proposed_changes JSONB NOT NULL,          -- Complete edited data to apply
    
    -- Workflow state
    workflow_state VARCHAR(50) NOT NULL CHECK (workflow_state IN (
        'pending_approval',
        'approved',
        'rejected', 
        'voided'
    )),
    workflow_instance_id VARCHAR(255),        -- Camunda process instance
    
    -- Metadata
    submitted_by VARCHAR(255) NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    void_reason TEXT,
    
    -- Indexes for performance
    CONSTRAINT uk_pending_approval UNIQUE (resource_id, workflow_state) 
        WHERE workflow_state = 'pending_approval'
);

-- Indexes for common queries
CREATE INDEX idx_orchestration_resource ON orchestration_state(resource_id, resource_type);
CREATE INDEX idx_orchestration_workflow ON orchestration_state(workflow_state);
CREATE INDEX idx_orchestration_submitted ON orchestration_state(submitted_at DESC);
CREATE INDEX idx_orchestration_workflow_instance ON orchestration_state(workflow_instance_id);

-- Audit table for tracking all state changes
CREATE TABLE IF NOT EXISTS orchestration_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orchestration_state_id UUID REFERENCES orchestration_state(id),
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    performed_at TIMESTAMP DEFAULT NOW(),
    details JSONB,
    
    -- Index for audit queries
    INDEX idx_audit_state (orchestration_state_id),
    INDEX idx_audit_time (performed_at DESC)
);

-- Function to automatically audit state changes
CREATE OR REPLACE FUNCTION audit_orchestration_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO orchestration_audit (
        orchestration_state_id,
        action,
        performed_by,
        details
    ) VALUES (
        NEW.id,
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'created'
            WHEN NEW.workflow_state != OLD.workflow_state THEN 'state_changed_to_' || NEW.workflow_state
            ELSE 'updated'
        END,
        COALESCE(NEW.submitted_by, 'system'),
        jsonb_build_object(
            'old_state', OLD.workflow_state,
            'new_state', NEW.workflow_state,
            'void_reason', NEW.void_reason
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS orchestration_audit_trigger ON orchestration_state;
CREATE TRIGGER orchestration_audit_trigger
    AFTER INSERT OR UPDATE ON orchestration_state
    FOR EACH ROW
    EXECUTE FUNCTION audit_orchestration_change();

-- View for active approvals
CREATE OR REPLACE VIEW active_approvals AS
SELECT 
    os.id,
    os.resource_id,
    os.resource_type,
    os.base_version,
    os.submitted_by,
    os.submitted_at,
    os.workflow_instance_id,
    (NOW() - os.submitted_at) AS time_in_approval
FROM orchestration_state os
WHERE os.workflow_state = 'pending_approval'
ORDER BY os.submitted_at DESC;

-- View for approval metrics
CREATE OR REPLACE VIEW approval_metrics AS
SELECT 
    DATE(submitted_at) as date,
    COUNT(*) FILTER (WHERE workflow_state = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE workflow_state = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE workflow_state = 'voided') as voided_count,
    COUNT(*) FILTER (WHERE workflow_state = 'pending_approval') as pending_count,
    AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at))/3600) 
        FILTER (WHERE completed_at IS NOT NULL) as avg_approval_hours
FROM orchestration_state
GROUP BY DATE(submitted_at)
ORDER BY date DESC;

-- Function to check for version conflicts
CREATE OR REPLACE FUNCTION check_version_conflict(
    p_resource_id VARCHAR(255),
    p_base_version VARCHAR(50),
    p_current_version VARCHAR(50)
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN p_base_version != p_current_version;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for old completed records
CREATE OR REPLACE FUNCTION cleanup_old_orchestration_states(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM orchestration_state
    WHERE workflow_state IN ('approved', 'rejected', 'voided')
    AND completed_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON orchestration_state TO your_app_user;
-- GRANT SELECT ON active_approvals TO your_app_user;
-- GRANT SELECT ON approval_metrics TO your_app_user;

-- Initial setup confirmation
DO $$
BEGIN
    RAISE NOTICE 'Orchestration schema v3 (simplified) created successfully';
    RAISE NOTICE 'Tables: orchestration_state, orchestration_audit';
    RAISE NOTICE 'Views: active_approvals, approval_metrics';
    RAISE NOTICE 'Key principle: Aidbox is source of truth, we only store proposed changes';
END $$;
