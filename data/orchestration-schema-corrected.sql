-- Corrected Orchestration Schema
-- Minimal state tracking for approval workflows
-- Does NOT store plan data (that's in Retool DB)

-- Drop existing tables if doing fresh install
-- DROP TABLE IF EXISTS orchestration_state CASCADE;
-- DROP TABLE IF EXISTS orchestration_audit CASCADE;

-- Main orchestration state table (corrected - no data storage)
CREATE TABLE IF NOT EXISTS orchestration_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Resource identification
    resource_id VARCHAR(255),                 -- Aidbox plan ID (null for new plans)
    resource_type VARCHAR(50) NOT NULL,       -- 'InsurancePlan'
    
    -- Draft reference (NOT the actual data)
    draft_id VARCHAR(255) NOT NULL,           -- ID in Retool's database
    draft_source VARCHAR(50) NOT NULL DEFAULT 'retool',  -- Where draft is stored
    
    -- Version control for conflict detection
    base_version VARCHAR(50),                 -- Aidbox version at submission time
    
    -- Workflow state
    workflow_state VARCHAR(50) NOT NULL CHECK (workflow_state IN (
        'pending_approval',
        'approved',
        'rejected', 
        'voided'
    )),
    workflow_instance_id VARCHAR(255),        -- Camunda process instance ID
    
    -- Metadata
    submitted_by VARCHAR(255) NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    void_reason TEXT,
    
    -- Optional: Store snapshot ONLY if needed for offline approval
    -- (e.g., if approvers can't access Retool DB)
    snapshot_data JSONB,                      -- Optional, avoid if possible
    
    -- Ensure only one pending approval per draft
    CONSTRAINT uk_pending_draft UNIQUE (draft_id, workflow_state) 
        WHERE workflow_state = 'pending_approval'
);

-- Indexes for performance
CREATE INDEX idx_orchestration_draft ON orchestration_state(draft_id);
CREATE INDEX idx_orchestration_resource ON orchestration_state(resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX idx_orchestration_workflow ON orchestration_state(workflow_state);
CREATE INDEX idx_orchestration_submitted ON orchestration_state(submitted_at DESC);
CREATE INDEX idx_orchestration_workflow_instance ON orchestration_state(workflow_instance_id);

-- Audit table for tracking state changes
CREATE TABLE IF NOT EXISTS orchestration_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orchestration_state_id UUID REFERENCES orchestration_state(id),
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    performed_at TIMESTAMP DEFAULT NOW(),
    details JSONB
);

CREATE INDEX idx_audit_state ON orchestration_audit(orchestration_state_id);
CREATE INDEX idx_audit_time ON orchestration_audit(performed_at DESC);

-- Function to audit state changes
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
            WHEN TG_OP = 'INSERT' THEN 'submitted'
            WHEN NEW.workflow_state != OLD.workflow_state THEN NEW.workflow_state
            ELSE 'updated'
        END,
        NEW.submitted_by,
        jsonb_build_object(
            'old_state', OLD.workflow_state,
            'new_state', NEW.workflow_state,
            'draft_id', NEW.draft_id,
            'resource_id', NEW.resource_id
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

-- View for active approvals with draft info
CREATE OR REPLACE VIEW active_approvals AS
SELECT 
    os.id,
    os.draft_id,
    os.draft_source,
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

-- Function to get draft reference details
CREATE OR REPLACE FUNCTION get_draft_reference(p_orchestration_id UUID)
RETURNS TABLE (
    draft_id VARCHAR(255),
    draft_source VARCHAR(50),
    resource_id VARCHAR(255),
    base_version VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        os.draft_id,
        os.draft_source,
        os.resource_id,
        os.base_version
    FROM orchestration_state os
    WHERE os.id = p_orchestration_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for completed workflows
CREATE OR REPLACE FUNCTION cleanup_completed_workflows(days_to_keep INTEGER DEFAULT 30)
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

-- Summary comment
COMMENT ON TABLE orchestration_state IS 'Minimal workflow state tracking. Does NOT store plan data - that lives in Retool DB. Only tracks approval progress and version info for conflict detection.';
COMMENT ON COLUMN orchestration_state.draft_id IS 'Reference to draft in Retool database - we do not store the actual data here';
COMMENT ON COLUMN orchestration_state.snapshot_data IS 'Optional snapshot for offline approval - avoid using if possible';

-- Initial setup confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Orchestration schema (corrected) created successfully';
    RAISE NOTICE '📝 Key principle: This DB only tracks workflow state';
    RAISE NOTICE '📦 Draft data lives in Retool DB, not here';
    RAISE NOTICE '🎯 Aidbox is the source of truth for approved plans';
END $$;
