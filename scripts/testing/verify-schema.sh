#!/bin/bash

# Quick schema verification script
# Run this to test the schema in your local PostgreSQL

echo "🔍 Testing Orchestration Schema..."

# Check if PostgreSQL is running
if ! docker ps | grep -q postgres; then
    echo "❌ PostgreSQL container not running. Starting it..."
    docker-compose up -d postgres
    sleep 5
fi

# Execute the schema
echo "📝 Creating schema..."
docker exec -i eligibility-poc-postgres-1 psql -U postgres -d postgres < data/orchestration-schema.sql

# Test basic operations
echo "✅ Testing basic operations..."
docker exec eligibility-poc-postgres-1 psql -U postgres -d postgres -c "
-- Insert test data
INSERT INTO orchestration_state (resource_id, resource_type, workflow_state, aidbox_version)
VALUES 
  ('test-plan-001', 'InsurancePlan', 'draft', '1'),
  ('test-plan-002', 'InsurancePlan', 'in_approval', '2');

-- Test the view
SELECT * FROM pending_approvals;

-- Test state transition
UPDATE orchestration_state 
SET workflow_state = 'approved', approved_at = NOW() 
WHERE resource_id = 'test-plan-002';

-- Check audit trigger worked
SELECT * FROM orchestration_state WHERE resource_id = 'test-plan-002';

-- Check metrics view
SELECT * FROM workflow_metrics;

-- Cleanup test data
DELETE FROM orchestration_state WHERE resource_id LIKE 'test-%';
"

echo "✅ Schema verification complete!"
