# QuickStart Guide - benefit plan Management System

---
**Document Metadata**
- **Version:** 2.0.0
- **Last Modified:** 2025-01-08
- **Last Author:** Assistant (AI) - Weekend Sprint Setup
- **Owner:** DevOps Team
- **Status:** Active
- **Review Cycle:** Per Major Release
- **Next Review:** Next Release
- **Target Audience:** New Developers, DevOps, QA
- **Time to Complete:** 30 minutes
- **Tested On:** Windows 11, macOS 14, Ubuntu 22.04
- **Change Log:**
  - v2.0.0 (2025-01-08): Added workflow deployment and template setup instructions
  - v1.5.0 (2024-12-15): Updated for Docker Compose v2
  - v1.2.0 (2024-12-01): Added troubleshooting section
  - v1.0.0 (2024-11-01): Initial quickstart guide
---

Get the complete system running in under 30 minutes with this comprehensive setup guide.

## Prerequisites

Before starting, ensure you have:

- **Docker Desktop 4.0+** installed and running
- **Node.js 16+** and **npm 7+** installed
- **8GB RAM** minimum (16GB recommended)
- **10GB free disk space**
- **Git** for cloning the repository
- **Port availability**: 3000, 3001, 3333, 5432, 8080

### Verify Prerequisites
```bash
# Check Docker
docker --version
docker-compose --version

# Check Node.js and npm
node --version
npm --version

# Check available memory
docker system info | grep Memory

# Check ports (should show no output if ports are free)
netstat -an | grep -E ":(3000|3001|3333|5432|8080)"
```

## 🚀 Installation

### Step 1: Clone and Setup
```bash
# Clone the repository
git clone <repository-url> eligibility-poc
cd eligibility-poc

# Install all dependencies
npm run install-all

# Validate system configuration
npm run validate
```

**Expected output:** ` System validation complete - Ready for development`

### Step 2: Start Services

#### Option A: With Retool UI (Recommended)
```bash
# Start complete stack including Retool
npm run retool:up

# Wait 60 seconds for all services to initialize
sleep 60

# Verify all services are running
node check-services.js
```

#### Option B: Without Retool (API Only)
```bash
# Start base services only
npm run docker:up

# Verify services
docker-compose ps
```

### Step 3: Verify Installation
```bash
# Check all health endpoints
curl http://localhost:3000/health      # Middleware API
curl http://localhost:3001/health      # Data API
curl http://localhost:8080/engine-rest/engine  # Camunda

# All should return success responses
```

## First Steps

### Access the Services

| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| **Retool UI** | http://localhost:3333 | Create on first visit | User interface |
| **Camunda Cockpit** | http://localhost:8080/camunda | demo / demo | Process monitoring |
| **Middleware API** | http://localhost:3000 | - | Core API |
| **Data API** | http://localhost:3001 | - | Employee data |

### Create Your First Rule

1. **Using API (Quick Test)**:
```bash
curl -X POST http://localhost:3000/api/rules/create \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "age_rule_001",
    "ruleName": "Minimum Age 21",
    "ruleType": "age",
    "configuration": {
      "ageThreshold": 21,
      "operator": ">="
    }
  }'
```

2. **Using Retool UI**:
   - Open http://localhost:3333
   - Create admin account on first visit
   - Create new app called "Eligibility Manager"
   - Follow the UI setup in Configuration section below

### Test the Rule
```bash
# Test with sample employee
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-001",
    "rules": ["age_rule_001"]
  }'
```

## Configuration

### Retool Setup (If Using UI)

1. **Create Retool Application**:
   - Navigate to http://localhost:3333
   - Create admin account
   - Click "Create new" → "App"
   - Name it "benefit plan Manager"

2. **Configure API Resource**:
   - Go to Resources → Add Resource
   - Select "REST API"
   - Name: `middleware_api`
   - Base URL: `http://host.docker.internal:3000/api`
   - Headers: `Content-Type: application/json`

3. **Import Components**:
   - Copy configurations from `retool/components/`
   - Import queries from `retool/queries/`
   - Add helper functions from `retool/functions/helpers.js`

### Environment Variables

Create `.env` file in project root:
```bash
# Camunda Configuration
CAMUNDA_URL=http://localhost:8080/engine-rest
CAMUNDA_USER=demo
CAMUNDA_PASSWORD=demo

# Database Configuration  
DB_HOST=localhost
DB_PORT=5432
DB_NAME=camunda
DB_USER=camunda
DB_PASSWORD=camunda

# API Configuration
MIDDLEWARE_PORT=3000
DATA_API_PORT=3001

# Retool Configuration (if using)
RETOOL_LICENSE_KEY=your_license_key_here
```

## Verification

### Run System Tests
```bash
# Quick validation
npm run validate

# Full test suite
npm run test-local

# Check deployment readiness
npm run check-deployment
```

### Manual Verification Checklist

- [ ] All Docker containers are running: `docker-compose ps`
- [ ] Middleware API responds: `curl http://localhost:3000/health`
- [ ] Data API responds: `curl http://localhost:3001/health`
- [ ] Camunda is accessible: Open http://localhost:8080/camunda
- [ ] Can create a rule via API
- [ ] Can evaluate a rule via API
- [ ] Retool connects to middleware (if using)

## Sample Data

### Available Test Employees
| ID | Name | Age | Group | Health Plan |
|----|------|-----|-------|-------------|
| EMP-001 | John Doe | 35 | 12345 | Basic HMO |
| EMP-002 | Jane Smith | 32 | 12345 | Premium PPO |
| EMP-003 | Bob Johnson | 45 | 67890 | Premium PPO |
| EMP-004 | Alice Johnson | 28 | 67890 | Premium PPO |
| EMP-005 | Charlie Brown | 29 | 54321 | Executive HMO |
| EMP-006 | Grace Wilson | 19 | 98765 | Basic HMO |

### Test Different Rule Types

```bash
# Age Rule
curl -X POST http://localhost:3000/api/rules/create \
  -H "Content-Type: application/json" \
  -d '{"ruleId": "age_test", "ruleType": "age", "configuration": {"ageThreshold": 25, "operator": ">="}}'

# Health Plan Rule  
curl -X POST http://localhost:3000/api/rules/create \
  -H "Content-Type: application/json" \
  -d '{"ruleId": "plan_test", "ruleType": "health_plan", "configuration": {"allowedPlans": ["HMO", "PPO"]}}'

# Group Number Rule
curl -X POST http://localhost:3000/api/rules/create \
  -H "Content-Type: application/json" \
  -d '{"ruleId": "group_test", "ruleType": "group_number", "configuration": {"allowedGroups": ["12345", "67890"]}}'
```

## Development Mode

### Watch Logs
```bash
# View all logs
npm run retool:logs

# Service-specific logs
npm run logs:middleware
npm run logs:data
npm run logs:camunda
npm run logs:postgres
```

### Make Changes
1. Edit source files in `middleware/src/` or `data/`
2. Services auto-reload on save (using nodemon/ts-node-dev)
3. Test changes immediately via API

### Useful Development Commands
```bash
# Restart specific service
docker-compose restart middleware

# Rebuild after major changes
docker-compose build middleware
docker-compose up -d middleware

# Clean slate (removes all data)
npm run docker:clean
npm run docker:up
```

## Troubleshooting

### Common Issues and Solutions

#### Port Already in Use
```bash
# Find and kill process using port
lsof -i :3000 | grep LISTEN
kill -9 <PID>

# Or change port in docker-compose.yml
```

#### Docker Memory Issues
```bash
# Increase Docker memory allocation
# Docker Desktop → Settings → Resources → Memory: 8GB minimum

# Clean up Docker resources
docker system prune -a
docker volume prune
```

#### Service Won't Start
```bash
# Check logs for specific service
docker-compose logs middleware
docker-compose logs camunda

# Rebuild the service
docker-compose build --no-cache middleware
docker-compose up -d middleware
```

#### CORS Errors with Retool
```bash
# Ensure middleware CORS configuration includes Retool domain
# Edit middleware/src/index.ts CORS settings
cors({
  origin: ['http://localhost:3333', 'http://localhost:3000'],
  credentials: true
})
```

#### Database Connection Issues
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check database logs
docker-compose logs postgres

# Verify connection
docker-compose exec postgres psql -U camunda -c "SELECT 1;"
```

### Getting More Help

1. **Check detailed logs**: `docker-compose logs -f <service-name>`
2. **Review documentation**: See [Implementation Guide](IMPLEMENTATION_GUIDE.md)
3. **System validation**: Run `npm run validate` for diagnostics
4. **Health checks**: Use `/health` endpoints to verify service status

## Next Steps

After successful setup:

1. **For Developers**:
   - Review [Architecture Guide](ARCHITECTURE.md) for system design
   - Check [Implementation Guide](IMPLEMENTATION_GUIDE.md) for coding patterns
   - Set up your IDE with TypeScript support

2. **For Business Users**:
   - Access Retool UI at http://localhost:3333
   - Follow [User Guide](../retool/USER_GUIDE.md) for rule creation
   - Test rules with sample employee data

3. **For DevOps**:
   - Review deployment configurations
   - Set up monitoring and alerting
   - Plan production deployment strategy

## Support

- **Documentation**: All guides in `/docs` folder
- **API Reference**: http://localhost:3000/api-docs (when running)
- **Logs**: Check service logs for debugging
- **Health Monitoring**: Use health endpoints for status

---

** Congratulations!** Your benefit plan Management System is now running. You can create rules, evaluate eligibility, and integrate with external systems.