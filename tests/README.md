# End-to-End Integration Testing Suite

This directory contains comprehensive testing infrastructure for the benefit plan management system, covering the complete workflow from rule creation in Retool through DMN deployment to Camunda and final eligibility evaluation.

## 🧪 Test Suite Overview

The testing suite validates:

- **System Health & Connectivity** - All services are running and accessible
- **External Data Integration** - Employee, health plan, and group data sources
- **Rule Management Workflow** - Creation, validation, deployment, and lifecycle
- **Eligibility Evaluation Process** - Single and multi-rule scenarios
- **Performance Benchmarks** - Response times and resource utilization
- **Error Handling** - Graceful failure and recovery scenarios

## 📁 Test Files Structure

```
tests/
├── integration-tests.ts           # Main TypeScript integration test suite
├── api-tests.postman_collection.json # Postman API test collection
├── run-tests.js                   # Comprehensive test runner with reporting
├── package.json                   # Dependencies and scripts
├── README.md                      # This documentation
└── reports/                       # Generated test reports (created at runtime)
    ├── test-report.html          # Visual HTML report
    ├── test-report.json          # Machine-readable JSON results
    └── postman-results.json      # Postman detailed results
```

## 🚀 Quick Start

### Prerequisites

1. **System Requirements:**
   - Node.js 16+ installed
   - Docker and Docker Compose running
   - All services started (middleware, data API, Camunda)

2. **Service Health Check:**
   ```bash
   # Verify all services are running
   curl http://localhost:3000/health  # Middleware
   curl http://localhost:3001/health  # Data API
   curl http://localhost:8080/engine-rest/engine  # Camunda
   ```

### Installation

```bash
# Navigate to tests directory
cd tests

# Install test dependencies
npm install

# Or install specific tools
npm run install-deps
```

### Running Tests

#### Run Complete Test Suite
```bash
# Run all tests with comprehensive reporting
npm test

# Run with verbose output
npm run test:verbose
```

#### Run Specific Test Categories
```bash
# TypeScript integration tests only
npm run test:integration

# Postman API tests only (requires newman)
npm run test:postman

# Performance benchmarks only
npm run test:performance

# System health check only
npm run test:health
```

## 📊 Test Categories

### 1. System Health Tests
**Purpose:** Validate all system components are operational
**Coverage:**
- Middleware service availability and response times
- Data API connectivity and health status
- Camunda engine accessibility and version check
- Database connectivity through services

### 2. Integration Tests (TypeScript)
**Purpose:** End-to-end workflow validation
**Coverage:**
- Rule creation and DMN generation
- Camunda deployment verification
- Employee data retrieval and validation
- Eligibility evaluation with various scenarios
- Multi-rule evaluation logic
- Error handling and edge cases

### 3. Performance Benchmarks
**Purpose:** Validate system performance under normal conditions
**Metrics:**
- Response time benchmarks (< 1-2 seconds)
- Throughput measurements
- Resource utilization monitoring

## 🐛 Troubleshooting

### Common Issues

#### 1. Tests Fail with Connection Errors
```bash
# Check if all services are running
docker-compose ps

# Restart services if needed
docker-compose restart

# Verify health endpoints
curl http://localhost:3000/health
curl http://localhost:3001/health
```

#### 2. TypeScript Compilation Errors
```bash
# Install TypeScript dependencies
npm install tsx @types/node

# Check TypeScript configuration
npx tsc --noEmit
```

### Test Data Reset
```bash
# Clean up test artifacts
npm run cleanup

# Reset test database (if needed)
docker-compose exec postgres psql -U camunda -c "TRUNCATE TABLE act_re_deployment CASCADE;"

# Restart services
docker-compose restart
```

## 🎯 Test Scenarios

### Age Rule Testing

**Scenario:** Employee must be 18 or older

| Employee | Age | Expected Result | Reasoning |
|----------|-----|-----------------|-----------|
| EMP-001  | 35  | ELIGIBLE        | Age 35 >= 18 |
| EMP-004  | 28  | ELIGIBLE        | Age 28 >= 18 |
| EMP-006  | 19  | ELIGIBLE        | Age 19 >= 18 |
| Grace W. | 17  | NOT ELIGIBLE    | Age 17 < 18 |

### Health Plan Rule Testing

**Scenario:** Employee must have Premium health plan

| Employee | Health Plan  | Status | Expected Result |
|----------|-------------|--------|-----------------|
| EMP-002  | Premium PPO | Active | ELIGIBLE |
| EMP-004  | Premium PPO | Active | ELIGIBLE |
| EMP-001  | Basic HMO   | Active | NOT ELIGIBLE |
| EMP-003  | Premium PPO | Inactive | NOT ELIGIBLE |

### Multi-Rule Complex Scenarios

**Scenario:** Employee must meet ALL criteria:
- Age >= 25 years
- Premium health plan (Premium PPO or Executive HMO)
- Executive group (12345 or 54321)

| Employee | Age | Health Plan | Group | Result | Reason |
|----------|-----|-------------|-------|--------|---------|
| Alice J. | 28  | Premium PPO | 67890 | ❌ NOT ELIGIBLE | Wrong group |
| Bob J.   | 32  | Premium PPO | 12345 | ✅ ELIGIBLE | All criteria met |
| John D.  | 35  | Basic HMO   | 12345 | ❌ NOT ELIGIBLE | Wrong health plan |
| Grace W. | 19  | Basic HMO   | 67890 | ❌ NOT ELIGIBLE | Multiple failures |

## 📈 Test Reporting

### HTML Report
Visual, comprehensive report with:
- Executive summary with pass/fail metrics
- Detailed test results with timestamps
- Performance benchmarks and trends
- System resource utilization

**Access:** Open `test-report.html` in browser after test run

### JSON Report
Machine-readable results for CI/CD integration:
```json
{
  "timestamp": "2025-07-19T20:00:00.000Z",
  "summary": {
    "total": 10,
    "passed": 9,
    "failed": 1,
    "successRate": 90
  },
  "tests": [...],
  "performance": {...}
}
```

## 📚 Additional Resources

### Documentation
- [Main Testing Guide](../docs/testing-guide.md) - Comprehensive testing documentation
- [Troubleshooting Guide](../docs/troubleshooting.md) - Common issues and solutions
- [Architecture Guide](../docs/ARCHITECTURE.md) - System design and components

### Tools and Libraries
- [Newman](https://github.com/postmanlabs/newman) - Postman collection runner
- [TSX](https://github.com/esbuild-kit/tsx) - TypeScript execution engine
- [Axios](https://axios-http.com/) - HTTP client for API calls
- [Docker Compose](https://docs.docker.com/compose/) - Service orchestration

---

## 📞 Support

**Development Team:** dev-team@company.com  
**Documentation:** Internal Wiki  
**Emergency Contact:** On-call Engineer (Slack: #engineering-oncall)

---

**Last Updated:** July 19, 2025  
**Version:** 1.0.0  
**Status:** Production Ready ✅
