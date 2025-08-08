-- Retool Database Schema
-- This goes in Retool's PostgreSQL, NOT the orchestration database
-- Stores draft benefit plans and UI state

-- Table for benefit plan drafts
CREATE TABLE IF NOT EXISTS benefit_plan_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to Aidbox (if editing existing plan)
    aidbox_plan_id VARCHAR(255),              -- NULL for new plans
    
    -- The actual plan data (FHIR InsurancePlan structure)
    plan_data JSONB NOT NULL,                 -- Full plan details
    
    -- User tracking
    created_by VARCHAR(255) NOT NULL,         -- User who created draft
    updated_by VARCHAR(255) NOT NULL,         -- Last user to update
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft',                               -- Being edited
        'submitted',                           -- Sent for approval
        'approved',                            -- Approved, pushed to Aidbox
        'rejected'                             -- Rejected, needs revision
    )),
    
    -- Link to orchestration (when submitted)
    submission_id UUID,                       -- Orchestration state ID
    
    -- Optional UI state (form values, validation, etc.)
    ui_state JSONB,                          -- Retool form state
    
    -- Metadata
    plan_name VARCHAR(255) GENERATED ALWAYS AS (plan_data->>'name') STORED,
    plan_status VARCHAR(50) GENERATED ALWAYS AS (plan_data->>'status') STORED,
    
    -- Indexing for performance
    CONSTRAINT uk_active_submission UNIQUE (submission_id) WHERE status = 'submitted'
);

-- Indexes for common queries
CREATE INDEX idx_draft_user ON benefit_plan_drafts(created_by);
CREATE INDEX idx_draft_status ON benefit_plan_drafts(status);
CREATE INDEX idx_draft_aidbox ON benefit_plan_drafts(aidbox_plan_id) WHERE aidbox_plan_id IS NOT NULL;
CREATE INDEX idx_draft_updated ON benefit_plan_drafts(updated_at DESC);
CREATE INDEX idx_draft_plan_name ON benefit_plan_drafts(plan_name);

-- Table for draft comments/notes
CREATE TABLE IF NOT EXISTS draft_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES benefit_plan_drafts(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Index for retrieval
    INDEX idx_comment_draft (draft_id, created_at DESC)
);

-- Table for draft attachments (if needed)
CREATE TABLE IF NOT EXISTS draft_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES benefit_plan_drafts(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    file_data BYTEA,                         -- Or URL if stored externally
    uploaded_by VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    
    -- Index for retrieval
    INDEX idx_attachment_draft (draft_id)
);

-- View for draft summary
CREATE OR REPLACE VIEW draft_summary AS
SELECT 
    d.id,
    d.plan_name,
    d.plan_status,
    d.status as draft_status,
    d.created_by,
    d.updated_by,
    d.created_at,
    d.updated_at,
    d.aidbox_plan_id,
    d.submission_id,
    CASE 
        WHEN d.status = 'submitted' THEN 'Pending Approval'
        WHEN d.status = 'approved' THEN 'Approved'
        WHEN d.status = 'rejected' THEN 'Needs Revision'
        ELSE 'Draft'
    END as display_status,
    (SELECT COUNT(*) FROM draft_comments WHERE draft_id = d.id) as comment_count,
    (SELECT COUNT(*) FROM draft_attachments WHERE draft_id = d.id) as attachment_count
FROM benefit_plan_drafts d
ORDER BY d.updated_at DESC;

-- View for user's drafts
CREATE OR REPLACE VIEW my_drafts AS
SELECT 
    d.id,
    d.plan_name,
    d.status,
    d.created_at,
    d.updated_at,
    CASE 
        WHEN d.aidbox_plan_id IS NOT NULL THEN 'Edit'
        ELSE 'New'
    END as draft_type,
    EXTRACT(EPOCH FROM (NOW() - d.updated_at))/3600 as hours_since_update
FROM benefit_plan_drafts d
WHERE d.status = 'draft'
ORDER BY d.updated_at DESC;

-- Function to auto-save draft
CREATE OR REPLACE FUNCTION auto_save_draft(
    p_draft_id UUID,
    p_plan_data JSONB,
    p_ui_state JSONB,
    p_user_id VARCHAR(255)
) RETURNS UUID AS $$
DECLARE
    v_draft_id UUID;
BEGIN
    -- Update if exists, create if not
    IF p_draft_id IS NOT NULL AND EXISTS (SELECT 1 FROM benefit_plan_drafts WHERE id = p_draft_id) THEN
        UPDATE benefit_plan_drafts
        SET 
            plan_data = p_plan_data,
            ui_state = p_ui_state,
            updated_by = p_user_id,
            updated_at = NOW()
        WHERE id = p_draft_id
        RETURNING id INTO v_draft_id;
    ELSE
        INSERT INTO benefit_plan_drafts (plan_data, ui_state, created_by, updated_by)
        VALUES (p_plan_data, p_ui_state, p_user_id, p_user_id)
        RETURNING id INTO v_draft_id;
    END IF;
    
    RETURN v_draft_id;
END;
$$ LANGUAGE plpgsql;

-- Function to submit draft for approval
CREATE OR REPLACE FUNCTION submit_draft_for_approval(
    p_draft_id UUID,
    p_submission_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE benefit_plan_drafts
    SET 
        status = 'submitted',
        submission_id = p_submission_id,
        updated_at = NOW()
    WHERE id = p_draft_id
    AND status = 'draft';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_draft_timestamp
    BEFORE UPDATE ON benefit_plan_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Cleanup function for old drafts
CREATE OR REPLACE FUNCTION cleanup_old_drafts(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old approved/rejected drafts
    DELETE FROM benefit_plan_drafts
    WHERE status IN ('approved', 'rejected')
    AND updated_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also delete orphaned drafts (no updates for 180 days)
    DELETE FROM benefit_plan_drafts
    WHERE status = 'draft'
    AND updated_at < NOW() - INTERVAL '180 days';
    
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE benefit_plan_drafts IS 'Stores working drafts of benefit plans in Retool. These are edited in the UI and submitted for approval.';
COMMENT ON COLUMN benefit_plan_drafts.plan_data IS 'Full FHIR InsurancePlan resource as JSONB';
COMMENT ON COLUMN benefit_plan_drafts.ui_state IS 'Retool form state for resuming edits';
COMMENT ON COLUMN benefit_plan_drafts.submission_id IS 'Links to orchestration_state when submitted for approval';

-- Initial setup confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Retool draft schema created successfully';
    RAISE NOTICE '📝 This database stores working drafts';
    RAISE NOTICE '🔄 Drafts are submitted to orchestration for approval';
    RAISE NOTICE '✓ Approved drafts are pushed to Aidbox';
END $$;
