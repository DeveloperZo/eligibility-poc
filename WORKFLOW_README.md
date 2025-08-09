# Governed Workflow Platform with Retool

A simple, working POC for a governed approval workflow using self-hosted Retool, Camunda, and middleware services.

## Quick Start

```bash
# Start everything
npm start

# Or directly with Docker
docker-compose up -d
```

## What's Included

- **Retool** (self-hosted) - UI for creating and approving plans - http://localhost:3333
- **Camunda** - BPMN workflow engine - http://localhost:8080/camunda (demo/demo)
- **Middleware API** - REST API for plan management - http://localhost:3000
- **PostgreSQL** - Databases for both Camunda and Retool
- **Data API** - External data service - http://localhost:3001

## First Time Setup

1. Start the platform:
   ```bash
   npm start
   ```

2. Wait for all services to start (about 30 seconds)

3. Set up Retool:
   - Visit http://localhost:3333
   - Create your admin account
   - Sign in

4. Configure Retool API connection:
   - Go to Resources → Create New → REST API
   - Name: `Workflow API`
   - Base URL: `http://host.docker.internal:3000`
   - Save the resource

5. Create a simple app in Retool:
   - Create New → App
   - Add components from the existing `/retool` directory

## Simple Workflow

The POC demonstrates:
1. Create a plan in Retool
2. Submit for approval (triggers Camunda workflow)
3. Sequential approval: Legal → Finance → Compliance
4. Version snapshots at each approval
5. Complete audit trail

## Database Schema

The workflow tables are automatically created in PostgreSQL:
- `workflow_plans` - Current plan state
- `workflow_audit` - Audit trail of all actions

## Useful Commands

```bash
# View logs
docker-compose logs -f

# Stop everything
docker-compose down

# Clean start (removes all data)
docker-compose down -v
docker-compose up -d

# Access PostgreSQL
docker exec -it workflow-postgres psql -U camunda -d camunda
```

## Troubleshooting

If services don't start:
1. Check Docker is running
2. Check ports aren't in use: 3000, 3001, 3333, 5432, 8080
3. Try: `docker-compose down -v` then `npm start`

## Next Steps

1. Deploy a BPMN process to Camunda
2. Build Retool forms for plan creation
3. Add approval interfaces in Retool
4. Test the complete workflow

---

This is a POC - keep it simple, make it work, then enhance as needed.
