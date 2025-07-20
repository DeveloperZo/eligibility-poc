# Eligibility Rule Management System

A complete prototype demonstrating eligibility rule management using Retool frontend, Camunda DMN engine, and TypeScript middleware. This system enables business users to create simple eligibility rules through an intuitive interface, automatically converts these to DMN XML format, deploys to Camunda, and provides end-to-end evaluation workflow.

## 🚨 IMPORTANT: Local Testing Required Before Deployment

**NO DEPLOYMENT should occur before running the complete local testing suite successfully!**

Run this command first to validate the entire system:
```bash
npm run test-local
```

This script will:
- ✅ Validate environment and dependencies
- ✅ Start all Docker services
- ✅ Run comprehensive integration tests
- ✅ Confirm system readiness
- ✅ Generate test reports

**Only proceed with deployment after seeing: "🚀 System Status: READY FOR DEVELOPMENT"**

## 🌐 Live System URLs (After Setup)

Once the local testing completes successfully, these are your live, working endpoints:

### 🔗 Core Services
- **Middleware API**: http://localhost:3000
- **Data API**: http://localhost:3001
- **Camunda Engine**: http://localhost:8080
- **Camunda Admin**: http://localhost:8080/camunda (demo/demo)

### 📎 Key Endpoints
```bash
# Health checks
GET http://localhost:3000/health
GET http://localhost:3001/health

# Rule management
POST http://localhost:3000/api/rules/create
GET  http://localhost:3000/api/rules

# Eligibility evaluation
POST http://localhost:3000/api/evaluate

# Employee data
GET  http://localhost:3001/employees
```

📄 **Complete endpoint documentation**: [LIVE_SYSTEM_URLS.md](LIVE_SYSTEM_URLS.md)

## System Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Retool    │───▶│   Middleware     │───▶│    Camunda      │
│  Frontend   │    │   (TypeScript)   │    │  DMN Engine     │
└─────────────┘    └──────────────────┘    └─────────────────┘
                            │                        │
                            ▼                        ▼
                   ┌─────────────────┐    ┌─────────────────┐
                   │  External Data  │    │   PostgreSQL    │
                   │   Sources       │    │   Database      │
                   └─────────────────┘    └─────────────────┘
```

## Features

- **Business-Friendly Rule Creation**: Simple interface for creating eligibility rules
- **Automated DMN Generation**: Convert business rules to standard DMN XML
- **Real-time Deployment**: Deploy rules to Camunda engine instantly
- **External Data Integration**: Connect with employee, health plan, and group data
- **End-to-End Testing**: Complete workflow validation

## Rule Types Supported

1. **Age Validation**: `age > 18`, `age >= 21`, etc.
2. **Health Plan Validation**: Valid health plan membership
3. **Group Number Verification**: Employee group number validation

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git

### 1. Clone and Setup

```bash
git clone <repository-url>
cd CamundaRetool
cp .env.example .env
```

### 2. Start the Environment

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Access Services

- **Camunda Cockpit**: http://localhost:8080/camunda/app/cockpit/default/#/login
  - Username: `demo`
  - Password: `demo`
  
- **Middleware API**: http://localhost:3000
  - Health check: http://localhost:3000/health
  
- **PostgreSQL**: localhost:5432
  - Database: `camunda`
  - Username: `camunda`
  - Password: `camunda`

### 4. Verify Installation

```bash
# Test Camunda connectivity
curl http://localhost:8080/engine-rest/engine

# Test middleware health
curl http://localhost:3000/health

# Test database connection
docker-compose exec postgres psql -U camunda -d camunda -c "SELECT version();"
```

## Development Workflow

### Local Development

```bash
# Navigate to middleware
cd middleware

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

```
CamundaRetool/
├── docker/                 # Docker configurations
├── middleware/             # TypeScript service
│   ├── src/               # Source code
│   ├── dist/              # Compiled JavaScript
│   ├── package.json       # Dependencies
│   ├── tsconfig.json      # TypeScript config
│   └── Dockerfile         # Container definition
├── data/                  # External data simulation
├── docs/                  # Documentation
├── docker-compose.yml     # Multi-service configuration
├── .env                   # Environment variables
└── README.md             # This file
```

## Environment Configuration

Key environment variables:

```bash
# Camunda
CAMUNDA_BASE_URL=http://localhost:8080
CAMUNDA_ADMIN_USER=demo
CAMUNDA_ADMIN_PASSWORD=demo

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=camunda
DB_USER=camunda
DB_PASSWORD=camunda

# Retool
RETOOL_API_TOKEN=your_retool_token_here
```

## API Endpoints

### Middleware Service

- `GET /health` - Health check
- `POST /api/rules` - Create new rule
- `GET /api/rules` - List all rules
- `PUT /api/rules/:id` - Update rule
- `DELETE /api/rules/:id` - Delete rule
- `POST /api/evaluate` - Evaluate eligibility

## Troubleshooting

### Common Issues

1. **Camunda won't start**
   ```bash
   # Check PostgreSQL is running
   docker-compose logs postgres
   
   # Restart Camunda
   docker-compose restart camunda
   ```

2. **Database connection issues**
   ```bash
   # Reset database
   docker-compose down -v
   docker-compose up -d postgres
   ```

3. **Port conflicts**
   ```bash
   # Check port usage
   netstat -an | findstr :8080
   netstat -an | findstr :5432
   ```

### Logs and Debugging

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs camunda
docker-compose logs postgres
docker-compose logs middleware

# Follow logs in real-time
docker-compose logs -f camunda
```

## Next Steps

After successful setup:

1. Configure Retool application
2. Implement DMN XML generation
3. Create external data simulation
4. Build rule management API
5. Develop end-to-end testing

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## Support

For questions and issues:
- Check troubleshooting guide above
- Review Docker logs
- Verify environment configuration
- Test individual components

## License

MIT License - see LICENSE file for details.
