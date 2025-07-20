# Live System URLs and Endpoints

## 🌐 Service URLs (After Running `npm run test-local`)

### Core Services
- **Middleware API**: http://localhost:3000
- **Data API**: http://localhost:3001  
- **Camunda Engine**: http://localhost:8080
- **PostgreSQL Database**: localhost:5432

### Web Interfaces
- **Camunda Admin**: http://localhost:8080/camunda
  - Username: `demo`
  - Password: `demo`
- **Camunda Cockpit**: http://localhost:8080/camunda/app/cockpit
- **Camunda Tasklist**: http://localhost:8080/camunda/app/tasklist

## 📡 API Endpoints

### Health Check Endpoints
```bash
# Middleware health
GET http://localhost:3000/health

# Data API health  
GET http://localhost:3001/health

# Camunda engine health
GET http://localhost:8080/engine-rest/engine
```

### Rule Management Endpoints
```bash
# Create a new rule
POST http://localhost:3000/api/rules/create
Content-Type: application/json
{
  "ruleId": "MY_AGE_RULE_001",
  "ruleName": "Minimum Age 18",
  "ruleType": "age",
  "configuration": {
    "ageThreshold": 18,
    "operator": ">="
  },
  "metadata": {
    "description": "Must be 18 or older",
    "createdBy": "user@company.com"
  }
}

# List all rules
GET http://localhost:3000/api/rules

# Get specific rule
GET http://localhost:3000/api/rules/MY_AGE_RULE_001

# Delete rule
DELETE http://localhost:3000/api/rules/MY_AGE_RULE_001
```

### Eligibility Evaluation Endpoints
```bash
# Evaluate employee eligibility
POST http://localhost:3000/api/evaluate
Content-Type: application/json
{
  "employeeId": "EMP-001",
  "rules": ["MY_AGE_RULE_001"],
  "context": {
    "testMode": false
  }
}

# Batch evaluation
POST http://localhost:3000/api/evaluate/batch
Content-Type: application/json
{
  "employeeIds": ["EMP-001", "EMP-002", "EMP-003"],
  "rules": ["MY_AGE_RULE_001", "HEALTH_PLAN_RULE"],
  "context": {
    "batchId": "BATCH_001",
    "testMode": false
  }
}
```

### External Data Endpoints
```bash
# Get all employees
GET http://localhost:3001/employees

# Get specific employee
GET http://localhost:3001/employees/EMP-001

# Get health plans
GET http://localhost:3001/health-plans

# Get groups
GET http://localhost:3001/groups

# Get employee context for evaluation
GET http://localhost:3001/employees/EMP-001/context
```

### DMN Management Endpoints
```bash
# Generate DMN XML for rule
POST http://localhost:3000/api/dmn/generate
Content-Type: application/json
{
  "ruleType": "age",
  "configuration": {
    "ageThreshold": 21,
    "operator": ">="
  }
}

# Get DMN templates
GET http://localhost:3000/api/dmn/templates

# Get sample DMN for rule type
GET http://localhost:3000/api/dmn/sample?ruleType=age
```

### Camunda Direct Endpoints
```bash
# Get all deployments
GET http://localhost:8080/engine-rest/deployment

# Get decision definitions
GET http://localhost:8080/engine-rest/decision-definition

# Evaluate decision directly
POST http://localhost:8080/engine-rest/decision-definition/key/age-eligibility/evaluate
Content-Type: application/json
{
  "variables": {
    "age": {"value": 25, "type": "Integer"},
    "ageThreshold": {"value": 18, "type": "Integer"}
  }
}
```

## 🚀 Quick Start Commands

### Start the Complete System
```bash
# Option 1: Run full setup (recommended first time)
npm run test-local

# Option 2: Just start services (if already tested)
npm run docker:up
cd data && npm start &
cd middleware && npm run dev &
```

### Test Live Endpoints
```bash
# Quick health check
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:8080/engine-rest/engine

# Test employee data
curl http://localhost:3001/employees

# Test rule creation
curl -X POST http://localhost:3000/api/rules/create \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "LIVE_TEST_001",
    "ruleName": "Live Test Rule",
    "ruleType": "age",
    "configuration": {"ageThreshold": 18, "operator": ">="},
    "metadata": {"description": "Live test", "createdBy": "api-user"}
  }'

# Test evaluation
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-001",
    "rules": ["LIVE_TEST_001"],
    "context": {"testMode": false}
  }'
```

## 📋 Real Usage Examples

### Creating Different Rule Types

**Age Rule:**
```bash
curl -X POST http://localhost:3000/api/rules/create \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "AGE_25_PLUS",
    "ruleName": "Age 25 or Older",
    "ruleType": "age",
    "configuration": {"ageThreshold": 25, "operator": ">="},
    "metadata": {"description": "Executive tier eligibility", "createdBy": "hr@company.com"}
  }'
```

**Health Plan Rule:**
```bash
curl -X POST http://localhost:3000/api/rules/create \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "PREMIUM_PLANS_ONLY",
    "ruleName": "Premium Health Plans",
    "ruleType": "healthPlan",
    "configuration": {
      "allowedPlans": ["Premium PPO", "Executive HMO"],
      "requireActiveStatus": true
    },
    "metadata": {"description": "Premium benefit eligibility", "createdBy": "benefits@company.com"}
  }'
```

**Group Rule:**
```bash
curl -X POST http://localhost:3000/api/rules/create \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "EXEC_GROUP_ONLY",
    "ruleName": "Executive Group Members",
    "ruleType": "groupNumber",
    "configuration": {
      "allowedGroups": ["12345", "54321"],
      "exactMatch": true
    },
    "metadata": {"description": "Executive benefits", "createdBy": "exec@company.com"}
  }'
```

### Multi-Rule Evaluation
```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-002",
    "rules": ["AGE_25_PLUS", "PREMIUM_PLANS_ONLY", "EXEC_GROUP_ONLY"],
    "context": {
      "evaluationType": "comprehensive",
      "requireAllRules": true
    }
  }'
```

## 🔍 Monitoring and Debugging

### Service Logs
```bash
# View all service logs
npm run docker:logs

# Individual service logs
npm run logs:middleware
npm run logs:camunda
npm run logs:postgres
npm run logs:data
```

### Service Status
```bash
# Check Docker containers
docker-compose ps

# Check individual service health
curl -s http://localhost:3000/health | jq .
curl -s http://localhost:3001/health | jq .
```

## 🎯 Production-Ready Endpoints

All these endpoints are production-ready after running `npm run test-local` successfully. The system provides:

- **Real-time rule creation and deployment**
- **Live employee eligibility evaluation**
- **DMN rule engine integration**
- **Comprehensive API for frontend integration**
- **Admin interfaces for monitoring**

**These are the actual working URLs and endpoints you can use immediately after the local setup completes successfully!** 🚀
