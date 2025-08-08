-- Migration: Add Camunda process tracking fields to benefit_plan_drafts
-- Date: 2025-08-08
-- Purpose: Support stateless orchestration by storing Camunda process references in Retool
-- TODO: Production to prod this should be handled by ORM tool

-- Add camunda_process_id column to track Camunda workflow instances
ALTER TABLE benefit_plan_drafts
ADD COLUMN IF NOT EXISTS camunda_process_id VARCHAR(255);

-- Add submission_metadata column to store additional workflow data
ALTER TABLE benefit_plan_drafts
ADD COLUMN IF NOT EXISTS submission_metadata JSONB;

-- Create index on camunda_process_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_draft_camunda_process 
ON benefit_plan_drafts(camunda_process_id) 
WHERE camunda_process_id IS NOT NULL;

-- Create index on submission_metadata for JSONB queries
CREATE INDEX IF NOT EXISTS idx_draft_submission_metadata 
ON benefit_plan_drafts USING gin(submission_metadata) 
WHERE submission_metadata IS NOT NULL;

-- Update the submit_draft_for_approval function to include Camunda process ID
CREATE OR REPLACE FUNCTION submit_draft_for_approval(
    p_draft_id UUID,
    p_submission_id UUID,
    p_camunda_process_id VARCHAR(255) DEFAULT NULL,
    p_submission_metadata JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE benefit_plan_drafts
    SET 
        status = 'submitted',
        submission_id = p_submission_id,
        camunda_process_id = p_camunda_process_id,
        submission_metadata = p_submission_metadata,
        updated_at = NOW()
    WHERE id = p_draft_id
    AND status = 'draft';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update Camunda process information
CREATE OR REPLACE FUNCTION update_camunda_process_info(
    p_draft_id UUID,
    p_camunda_process_id VARCHAR(255),
    p_metadata JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE benefit_plan_drafts
    SET 
        camunda_process_id = p_camunda_process_id,
        submission_metadata = COALESCE(submission_metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
        updated_at = NOW()
    WHERE id = p_draft_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get draft by Camunda process ID
CREATE OR REPLACE FUNCTION get_draft_by_camunda_process(
    p_camunda_process_id VARCHAR(255)
) RETURNS TABLE (
    id UUID,
    plan_data JSONB,
    status VARCHAR(50),
    submission_id UUID,
    submission_metadata JSONB,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.plan_data,
        d.status,
        d.submission_id,
        d.submission_metadata,
        d.created_by,
        d.updated_by,
        d.created_at,
        d.updated_at
    FROM benefit_plan_drafts d
    WHERE d.camunda_process_id = p_camunda_process_id;
END;
$$ LANGUAGE plpgsql;

-- Update the draft_summary view to include Camunda process information
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
    d.camunda_process_id,
    d.submission_metadata,
    CASE 
        WHEN d.status = 'submitted' THEN 'Pending Approval'
        WHEN d.status = 'approved' THEN 'Approved'
        WHEN d.status = 'rejected' THEN 'Needs Revision'
        ELSE 'Draft'
    END as display_status,
    CASE 
        WHEN d.camunda_process_id IS NOT NULL THEN TRUE
        ELSE FALSE
    END as has_workflow,
    (SELECT COUNT(*) FROM draft_comments WHERE draft_id = d.id) as comment_count,
    (SELECT COUNT(*) FROM draft_attachments WHERE draft_id = d.id) as attachment_count
FROM benefit_plan_drafts d
ORDER BY d.updated_at DESC;

-- Add comments for documentation
COMMENT ON COLUMN benefit_plan_drafts.camunda_process_id IS 'Camunda process instance ID for workflow tracking';
COMMENT ON COLUMN benefit_plan_drafts.submission_metadata IS 'Additional metadata related to the submission workflow (e.g., approval details, task states)';

-- Verification query to check the migration
DO $$
DECLARE
    v_column_exists BOOLEAN;
BEGIN
    -- Check if camunda_process_id column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'benefit_plan_drafts' 
        AND column_name = 'camunda_process_id'
    ) INTO v_column_exists;
    
    IF v_column_exists THEN
        RAISE NOTICE '✅ Migration successful: camunda_process_id column added';
    ELSE
        RAISE EXCEPTION '❌ Migration failed: camunda_process_id column not found';
    END IF;
    
    -- Check if submission_metadata column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'benefit_plan_drafts' 
        AND column_name = 'submission_metadata'
    ) INTO v_column_exists;
    
    IF v_column_exists THEN
        RAISE NOTICE '✅ Migration successful: submission_metadata column added';
    ELSE
        RAISE EXCEPTION '❌ Migration failed: submission_metadata column not found';
    END IF;
    
    RAISE NOTICE '📋 Retool database schema updated for stateless orchestration';
    RAISE NOTICE '🔄 Camunda process tracking fields added successfully';
    RAISE NOTICE '✓ Existing drafts remain unaffected (backwards compatible)';
END $$;
