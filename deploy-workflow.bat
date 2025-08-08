@echo off
REM Deploy BPMN process with configured process variables

echo Deploying Benefit Plan Approval Process with Process Variables...
echo.

REM Deploy the BPMN file
curl -X POST http://localhost:8080/engine-rest/deployment/create ^
  -H "Content-Type: multipart/form-data" ^
  -F "deployment-name=Benefit Plan Approval Process" ^
  -F "deployment-source=REST API" ^
  -F "enable-duplicate-filtering=true" ^
  -F "data=@processes/benefit-plan-approval.bpmn"

echo.
echo Process deployed with variable definitions!
echo.
echo Starting a test process instance with all required variables...

REM Get current timestamp in ISO format
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%T%datetime:~8,2%:%datetime:~10,2%:%datetime:~12,2%Z

REM Start a process instance with all required process variables
curl -X POST http://localhost:8080/engine-rest/process-definition/key/benefit-plan-approval/start ^
  -H "Content-Type: application/json" ^
  -d "{\"variables\": {\"draftId\": {\"value\": \"draft-123456\", \"type\": \"String\"}, \"draftSource\": {\"value\": \"retool\", \"type\": \"String\"}, \"baseVersion\": {\"value\": \"new\", \"type\": \"String\"}, \"aidboxPlanId\": {\"value\": \"new\", \"type\": \"String\"}, \"submittedBy\": {\"value\": \"admin@company.com\", \"type\": \"String\"}, \"planName\": {\"value\": \"Premium Health Plan 2024\", \"type\": \"String\"}, \"submittedAt\": {\"value\": \"%TIMESTAMP%\", \"type\": \"String\"}}}"

echo.
echo Process started with all variables!
echo.
echo Checking for active tasks...

REM Get tasks
curl -X GET http://localhost:8080/engine-rest/task?processDefinitionKey=benefit-plan-approval

echo.
echo.
echo Done! Process configured with stateless variables.
echo    - Variables accessible in Camunda Cockpit
echo    - No external database queries needed
echo    - Workflow state stored in process variables
echo.
echo Check Camunda at http://localhost:8080/camunda
echo    Login with admin/admin or demo/demo
echo    View variables in Cockpit - Process Instance - Variables tab
echo.
pause
