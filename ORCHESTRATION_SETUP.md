# Orchestration Setup Guide

## 🚀 Quick Start (All Operating Systems)

### Prerequisites
- Docker Desktop installed and running
- Node.js 14+ and npm installed
- Git (for cloning the repository)

### One-Command Setup

```bash
# Run from project root (works on Windows, Mac, and Linux)
node scripts/setup-orchestration.js
```

This will:
1. ✅ Check prerequisites
2. ✅ Start Docker services (PostgreSQL, Camunda)
3. ✅ Apply database schema
4. ✅ Build the middleware
5. ✅ Start all services
6. ✅ Run health checks
7. ✅ Display access URLs and next steps

## 📦 Manual Setup Steps

If you prefer to run steps individually:

### 1. Apply Database Schema

```bash
# OS-agnostic approach using Node.js
node scripts/apply-schema.js
```

### 2. Start Docker Services

```bash
# Start core services
docker-compose up -d postgres camunda data-api

# Check service status
docker-compose ps
```

### 3. Build Middleware

```bash
cd middleware
npm install
npm run build
cd ..
```

### 4. Start Middleware

```bash
cd middleware
npm start
```

### 5. Test the System

```bash
# Run API tests
node scripts/testing/test-orchestration-api.js

# Check health endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/health
```

## 🌐 Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Camunda Admin | http://localhost:8080 | admin/admin |
| Middleware API | http://localhost:3000 | - |
| Data API | http://localhost:3001 | - |
| API Documentation | http://localhost:3000/api-docs | - |
| PostgreSQL | localhost:5432 | postgres/postgres |

## 🔧 Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f camunda
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

### Database Access
```bash
# Connect to PostgreSQL (works on all OS)
docker exec -it eligibility-poc-postgres-1 psql -U postgres -d postgres

# Run SQL query
docker exec eligibility-poc-postgres-1 psql -U postgres -d postgres -c "SELECT * FROM orchestration_state;"
```

## 🧪 Testing

### API Testing
```bash
# Test orchestration endpoints
node scripts/testing/test-orchestration-api.js

# Manual API test with curl
curl -X GET http://localhost:3000/api/health
curl -X GET http://localhost:3000/api/plans
```

### Database Verification
```bash
# Check tables
docker exec eligibility-poc-postgres-1 psql -U postgres -d postgres -c "\dt"

# Check orchestration state
docker exec eligibility-poc-postgres-1 psql -U postgres -d postgres -c "SELECT * FROM orchestration_state;"
```

## 🐛 Troubleshooting

### Docker Issues
```bash
# Check if Docker is running
docker version

# Restart Docker services
docker-compose restart

# View service logs
docker-compose logs [service-name]
```

### Port Conflicts
If you get port already in use errors:
- PostgreSQL (5432): Change in docker-compose.yml
- Camunda (8080): Change in docker-compose.yml
- Middleware (3000): Set MIDDLEWARE_PORT env variable
- Data API (3001): Change in docker-compose.yml

### Database Connection Issues
```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres
node scripts/apply-schema.js
```

### TypeScript Build Errors
```bash
cd middleware
npm clean-install
npm run build
```

## 📚 Documentation

- [Implementation Plan](docs/CRAWL_IMPLEMENTATION_PLAN.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [API Documentation](http://localhost:3000/api-docs)
- [Testing Guide](docs/testing-guide.md)

## 🎯 Next Steps

1. **Start the middleware**: 
   ```bash
   cd middleware && npm start
   ```

2. **Test the approval workflow**:
   ```bash
   node scripts/testing/test-orchestration-api.js
   ```

3. **Build Retool UI components**:
   - Connect to http://localhost:3000/api
   - Use the orchestration endpoints

4. **Deploy BPMN process** (if needed):
   - Access Camunda at http://localhost:8080
   - Deploy benefit-plan-approval.bpmn

## 💡 Development Tips

- Use `nodemon` for auto-restart during development
- Check `/health` endpoints for service status
- View API docs at `/api-docs` for interactive testing
- PostgreSQL data persists in Docker volumes
- Logs are your friend - use `docker-compose logs -f`

---

**Need help?** Check the logs first, then refer to the troubleshooting section above.
