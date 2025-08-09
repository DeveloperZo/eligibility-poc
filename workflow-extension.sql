-- Add workflow tables to existing database
-- Run this against the existing camunda database

-- Simple plans table for workflow demo
CREATE TABLE IF NOT EXISTS workflow_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    data JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft',
    -- Status: draft, pending_legal, pending_finance, pending_compliance, approved, rejected
    current_approver VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Simple audit log
CREATE TABLE IF NOT EXISTS workflow_audit (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES workflow_plans(id),
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(100) NOT NULL,
    comments TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO workflow_plans (name, description, data, status) VALUES 
('Q1 Budget Plan', 'Budget allocation for Q1 2025', '{"total": 100000, "marketing": 30000, "operations": 70000}', 'draft'),
('New Benefit Policy', 'Updated employee benefits', '{"dental": true, "vision": true, "remote_work": true}', 'draft');
