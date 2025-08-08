#!/bin/bash
# Deploy BPMN process with configured process variables

echo "🚀 Deploying Benefit Plan Approval Process with Process Variables..."

# Deploy the BPMN file
curl -X POST http://localhost:8080/engine-rest/deployment/create \
  -H "Content-Type: multipart/form-data" \
  -F "deployment-name=Benefit Plan Approval Process" \
  -F "deployment-source=REST API" \
  -F "enable-duplicate-filtering=true" \
  -F "data=@processes/benefit-plan-approval.bpmn"

echo ""
echo "✅ Process deployed with variable definitions!"
echo ""
echo "📝 Starting a test process instance with all required variables..."

# Start a process instance with all required process variables
curl -X POST http://localhost:8080/engine-rest/process-definition/key/benefit-plan-approval/start \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "draftId": {"value": "draft-123456", "type": "String"},
      "draftSource": {"value": "retool", "type": "String"},
      "baseVersion": {"value": "new", "type": "String"},
      "aidboxPlanId": {"value": "new", "type": "String"},
      "submittedBy": {"value": "admin@company.com", "type": "String"},
      "planName": {"value": "Premium Health Plan 2024", "type": "String"},
      "submittedAt": {"value": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'", "type": "String"}
    }
  }'

echo ""
echo "✅ Process started with all variables!"
echo ""
echo "🔍 Checking process variables in Camunda..."

# Get the latest process instance
PROCESS_ID=$(curl -s -X GET "http://localhost:8080/engine-rest/process-instance?processDefinitionKey=benefit-plan-approval&sortBy=startTime&sortOrder=desc&maxResults=1" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ ! -z "$PROCESS_ID" ]; then
  echo "Process Instance ID: $PROCESS_ID"
  echo ""
  echo "📊 Process Variables:"
  curl -X GET "http://localhost:8080/engine-rest/process-instance/$PROCESS_ID/variables"
  echo ""
fi

echo ""
echo "🔍 Checking for active tasks..."

# Get tasks
curl -X GET http://localhost:8080/engine-rest/task?processDefinitionKey=benefit-plan-approval

echo ""
echo ""
echo "✨ Done! Process configured with stateless variables."
echo "   ✅ Variables accessible in Camunda Cockpit"
echo "   ✅ No external database queries needed"
echo "   ✅ Workflow state stored in process variables"
echo ""
echo "📍 Check Camunda at http://localhost:8080/camunda"
echo "   Login with admin/admin or demo/demo"
echo "   View variables in Cockpit > Process Instance > Variables tab"
