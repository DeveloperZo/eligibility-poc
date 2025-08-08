#!/bin/bash
# Quick script to deploy BPMN and test the workflow

echo "🚀 Deploying Benefit Plan Approval Process..."

# Deploy the BPMN file
curl -X POST http://localhost:8080/engine-rest/deployment/create \
  -H "Content-Type: multipart/form-data" \
  -F "deployment-name=Benefit Plan Approval Process" \
  -F "deployment-source=REST API" \
  -F "data=@processes/benefit-plan-approval.bpmn"

echo ""
echo "✅ Process deployed!"
echo ""
echo "📝 Starting a test process instance..."

# Start a process instance
curl -X POST http://localhost:8080/engine-rest/process-definition/key/benefit-plan-approval/start \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "planName": {"value": "Premium Health Plan 2024", "type": "String"},
      "planType": {"value": "medical", "type": "String"},
      "submittedBy": {"value": "admin@company.com", "type": "String"},
      "version": {"value": 1, "type": "Integer"}
    }
  }'

echo ""
echo "✅ Process started!"
echo ""
echo "🔍 Checking for tasks..."

# Get tasks
curl -X GET http://localhost:8080/engine-rest/task

echo ""
echo ""
echo "✨ Done! Check Camunda Tasklist at http://localhost:8080/camunda"
echo "   Login with admin/admin or demo/demo"
