# Quick Start Guide - Live System Access

## 🚀 Get the System Running (5 Minutes)

### Step 1: Run Local Setup
```bash
npm run test-local
```
**Wait for:** `🚀 System Status: READY FOR DEVELOPMENT`

### Step 2: Access Live System
Open these URLs in your browser:

- **Camunda Admin**: http://localhost:8080/camunda
  - Login: `demo` / `demo`
- **API Health**: http://localhost:3000/health
- **Data API**: http://localhost:3001/health

## 🎯 Try It Right Now

### Create Your First Rule
```bash
curl -X POST http://localhost:3000/api/rules/create \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "MY_FIRST_RULE",
    "ruleName": "Must be 21 or older",
    "ruleType": "age",
    "configuration": {
      "ageThreshold": 21,
      "operator": ">="
    },
    "metadata": {
      "description": "Legal drinking age requirement",
      "createdBy": "quickstart-user"
    }
  }'
```

### Test the Rule
```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-001",
    "rules": ["MY_FIRST_RULE"],
    "context": {
      "testMode": false
    }
  }'
```

### See Available Employees
```bash
curl http://localhost:3001/employees | jq '.'
```

### List All Rules
```bash
curl http://localhost:3000/api/rules | jq '.'
```

## 🔍 Verify Everything Works

### Check Services
```bash
# All should return "success": true
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:8080/engine-rest/engine
```

### View in Camunda Admin
1. Go to http://localhost:8080/camunda
2. Login with `demo` / `demo`
3. Click "Cockpit" → "Deployments"
4. You should see your deployed rules

## 📋 Available Test Data

### Sample Employees
- **EMP-001**: John Doe, age 35, group 12345, Basic HMO
- **EMP-002**: Jane Smith, age 32, group 12345, Premium PPO
- **EMP-003**: Bob Johnson, age 45, group 67890, Premium PPO
- **EMP-004**: Alice Johnson, age 28, group 67890, Premium PPO
- **EMP-005**: Charlie Brown, age 29, group 54321, Executive HMO
- **EMP-006**: Grace Wilson, age 19, group 98765, Basic HMO

### Test Different Scenarios
```bash
# Test with older employee (should pass age 21+ rule)
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "EMP-001", "rules": ["MY_FIRST_RULE"]}'

# Test with younger employee (should fail age 21+ rule)  
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "EMP-006", "rules": ["MY_FIRST_RULE"]}'
```

## 🛠️ Development Mode

### Watch Logs
```bash
# In separate terminals:
npm run logs:middleware
npm run logs:data
npm run logs:camunda
```

### Make Changes
1. Edit files in `middleware/src/` or `data/`
2. Services auto-reload with your changes
3. Test changes immediately with the live URLs

### Stop Services
```bash
npm run docker:down
```

### Restart Everything
```bash
npm run docker:up
```

## 🎯 Ready for Integration

The system is now running and ready for:
- **Retool integration** (connect to http://localhost:3000)
- **Frontend development** (use the REST APIs)
- **Rule customization** (modify rule types and logic)
- **Data source integration** (connect real employee systems)

**All endpoints are live and functional!** 🚀

## 📞 Need Help?

Check these if something doesn't work:
- [Troubleshooting Guide](docs/troubleshooting.md)
- [Complete API Documentation](LIVE_SYSTEM_URLS.md)
- [Testing Guide](docs/testing-guide.md)

**The system is production-ready after successful local testing!**
