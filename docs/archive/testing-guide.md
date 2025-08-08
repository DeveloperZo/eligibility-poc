# Complete Testing Guide for benefit plan Management System

This guide provides comprehensive instructions for testing the complete benefit plan management system, from rule creation in Retool through DMN deployment to Camunda and final eligibility evaluation.

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Prerequisites](#prerequisites)
3. [Test Environment Setup](#test-environment-setup)
4. [Automated Testing](#automated-testing)
5. [Manual Testing Scenarios](#manual-testing-scenarios)
6. [Performance Testing](#performance-testing)
7. [Integration Testing](#integration-testing)
8. [Troubleshooting](#troubleshooting)

## Testing Overview

The testing strategy covers multiple layers of the system:

- **Unit Testing**: Individual component validation
- **Integration Testing**: End-to-end workflow validation
- **API Testing**: REST endpoint validation
- **Performance Testing**: Load and response time validation
- **User Acceptance Testing**: Business workflow validation

### Test Coverage Areas

✅ **System Health and Connectivity**
- Middleware service availability
- Data API connectivity
- Camunda engine accessibility
- Database connectivity

✅ **External Data Integration**
- Employee data retrieval
- Health plan data access
- Group information validation
- Mock data service functionality

✅ **Rule Management Workflow**
- Rule creation and validation
- DMN XML generation
- Camunda deployment process
- Rule lifecycle management

✅ **Eligibility Evaluation Process**
- Single rule evaluation
- Multi-rule evaluation
- Complex scenario testing
- Error handling validation

✅ **User Interface Testing**
- Retool application functionality
- Form validation and submission
- Data display and management
- User experience workflows

## Prerequisites

### Required Software

- **Node.js** (v16+) - Runtime environment
- **Docker** - Container orchestration
- **Postman** - API testing (optional)
- **TypeScript** - Development and testing
- **NPM/Yarn** - Package management

### System Requirements

- **Memory**: 4GB+ available RAM
- **Storage**: 2GB+ free disk space
- **Network**: Internet connectivity for container downloads
- **Ports**: 3000, 3001, 8080, 5432 available

### Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd CamundaRetool

# Install dependencies
cd middleware && npm install
cd ../data && npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration
```

## Test Environment Setup

### 1. Start Docker Services

```bash
# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs if needed
docker-compose logs camunda
docker-compose logs postgres
```

### 2. Start Application Services

```bash
# Terminal 1: Start Data API
cd data
npm start

# Terminal 2: Start Middleware
cd middleware
npm run dev

# Terminal 3: Run tests
cd tests
npm run test
```

### 3. Verify System Health

```bash
# Check all health endpoints
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:8080/engine-rest/engine

# Run system validation
node scripts/validation/validate-system.js
```

## Automated Testing

### Integration Test Suite

The comprehensive integration test suite validates the complete workflow:

```bash
# Run complete integration tests
cd tests
npx tsx integration-tests.ts

# Run with verbose output
DEBUG=true npx tsx integration-tests.ts

# Run specific test categories
npm run test:health
npm run test:rules
npm run test:evaluation
```

### Test Categories

#### 1. System Health Tests

```typescript
// Validates system connectivity
await testSystemHealth()
```

**Validates:**
- Middleware service availability
- Data API connectivity
- Camunda engine accessibility
- Database connection status

#### 2. External Data Tests

```typescript
// Validates external data sources
await testExternalDataSources()
```

**Validates:**
- Employee data structure and availability
- Health plan data completeness
- Group information accuracy
- Mock data service functionality

#### 3. Rule Workflow Tests

```typescript
// Tests complete rule lifecycle
await testAgeRuleWorkflow()
await testHealthPlanRuleWorkflow()
await testGroupNumberRuleWorkflow()
```

**Validates:**
- Rule creation and validation
- DMN XML generation accuracy
- Camunda deployment success
- Rule activation status

#### 4. Evaluation Tests

```typescript
// Tests eligibility evaluation process
await testMultiRuleEvaluation()
```

**Validates:**
- Single rule evaluation accuracy
- Multi-rule evaluation logic
- Complex scenario handling
- Performance benchmarks

### API Testing with Postman

Import the Postman collection for comprehensive API testing:

```bash
# Import collection
postman import tests/api-tests.postman_collection.json

# Run collection via CLI
newman run tests/api-tests.postman_collection.json \
  --environment tests/test-environment.json \
  --reporters cli,html \
  --reporter-html-export test-results.html
```

**Collection Features:**
- Pre-request scripts for test data setup
- Comprehensive assertions for each endpoint
- Environment variable management
- Cleanup procedures for test isolation

## Manual Testing Scenarios

### Scenario 1: Age Rule Creation and Testing

**Objective**: Validate complete age rule workflow

**Steps:**
1. **Create Age Rule**
   ```json
   {
     "ruleId": "MANUAL_AGE_TEST_001",
     "ruleName": "Manual Test - Age 18 Minimum",
     "ruleType": "age",
     "configuration": {
       "ageThreshold": 18,
       "operator": ">="
     },
     "metadata": {
       "description": "Manual testing scenario",
       "createdBy": "test-user"
     }
   }
   ```

2. **Verify Rule Creation**
   - Check rule appears in management interface
   - Verify DMN deployment in Camunda
   - Confirm rule status is "active"

3. **Test Eligible Employee**
   ```bash
   curl -X POST http://localhost:3000/api/evaluate \
     -H "Content-Type: application/json" \
     -d '{
       "employeeId": "EMP-004",
       "rules": ["MANUAL_AGE_TEST_001"],
       "context": {"testMode": true}
     }'
   ```

4. **Test Ineligible Employee**
   ```bash
   curl -X POST http://localhost:3000/api/evaluate \
     -H "Content-Type: application/json" \
     -d '{
       "employeeId": "EMP-006",
       "rules": ["MANUAL_AGE_TEST_001"],
       "context": {"testMode": true}
     }'
   ```

**Expected Results:**
- Employee age 28 (EMP-004): ELIGIBLE
- Employee age 19 (EMP-006): NOT ELIGIBLE

### Scenario 2: Health Plan Rule Validation

**Objective**: Test health plan eligibility logic

**Test Cases:**
| Employee | Health Plan | Status | Expected Result |
|----------|-------------|--------|-----------------|
| EMP-002  | Premium PPO | Active | ELIGIBLE |
| EMP-001  | Basic HMO   | Active | NOT ELIGIBLE |
| EMP-005  | Premium PPO | Inactive | NOT ELIGIBLE |

### Scenario 3: Multi-Rule Complex Scenario

**Objective**: Validate complex business logic with multiple rules

**Configuration:**
- Age Rule: >= 25 years
- Health Plan Rule: Premium plans only
- Group Rule: Executive groups (12345, 54321)

**Test Matrix:**
| Employee | Age | Health Plan | Group | Expected |
|----------|-----|-------------|-------|----------|
| EMP-004  | 28  | Premium PPO | 67890 | NOT ELIGIBLE (wrong group) |
| EMP-002  | 32  | Premium PPO | 12345 | ELIGIBLE (all criteria met) |
| EMP-001  | 35  | Basic HMO   | 12345 | NOT ELIGIBLE (wrong plan) |
| EMP-006  | 19  | Basic HMO   | 67890 | NOT ELIGIBLE (multiple failures) |

## Performance Testing

### Load Testing

Validate system performance under various load conditions:

```bash
# Install load testing tools
npm install -g artillery

# Run load tests
artillery run tests/load-test-config.yml
```

#### Performance Benchmarks

**Rule Creation Performance:**
- Target: < 2 seconds per rule
- Maximum: < 5 seconds per rule
- Concurrent: 10 rules simultaneously

**Evaluation Performance:**
- Target: < 500ms per evaluation
- Maximum: < 2 seconds per evaluation
- Throughput: 100+ evaluations/minute

**System Resources:**
- Memory: < 512MB per service
- CPU: < 50% utilization under normal load
- Database: < 100 active connections

## Integration Testing

### End-to-End Workflow Testing

Test the complete business workflow from rule creation through evaluation.

#### Test Flow 1: Business User Workflow

**Validation Points:**
1. Retool form validation works correctly
2. Rule creation API processes request
3. DMN XML is generated accurately
4. Camunda deployment succeeds
5. Rule appears in management interface
6. Evaluation returns correct results
7. Results display clearly in UI

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Middleware Service Won't Start

**Symptoms:**
- Error: "Cannot connect to database"
- Status: Service unavailable

**Solutions:**
1. Restart Docker services: `docker-compose restart`
2. Check environment configuration: `cat .env`
3. Verify database connectivity
4. Clear Docker volumes: `docker-compose down -v && docker-compose up -d`

#### Issue 2: Rule Creation Fails

**Symptoms:**
- DMN generation errors
- Camunda deployment failures

**Solutions:**
1. Validate rule configuration schema
2. Check DMN template integrity
3. Verify Camunda connectivity
4. Review deployment permissions

#### Issue 3: Evaluation Returns Incorrect Results

**Solutions:**
1. Verify employee data accuracy
2. Check rule logic configuration
3. Validate DMN decision table
4. Review evaluation context parameters

### Debug Mode Activation

```bash
# Enable debug logging
export DEBUG=true
export LOG_LEVEL=debug

# Start services with verbose logging
DEBUG=* npm run dev
```

### Test Data Management

#### Reset Test Environment

```bash
# Clear test data
npm run test:cleanup

# Reset database
docker-compose exec postgres psql -U camunda -c "TRUNCATE TABLE act_re_deployment CASCADE;"

# Restart services
docker-compose restart
```

## Test Reporting

### Automated Test Reports

```bash
# Generate comprehensive test report
npm run test:report

# Export results to different formats
npm run test:report -- --format=html
npm run test:report -- --format=junit
npm run test:report -- --format=json
```

### Test Metrics and KPIs

**Test Coverage Metrics:**
- Unit Test Coverage: > 80%
- Integration Test Coverage: > 90%
- API Endpoint Coverage: 100%
- User Workflow Coverage: 100%

**Quality Metrics:**
- Test Pass Rate: > 95%
- Test Execution Time: < 10 minutes
- False Positive Rate: < 5%
- Test Maintenance Effort: < 20% of development time

**Performance Metrics:**
- Average Response Time: < 1 second
- 95th Percentile Response Time: < 3 seconds
- System Availability: > 99.9%
- Error Rate: < 0.1%

---

**Document Version:** 1.0  
**Last Updated:** July 19, 2025  
**Author:** Integration Test Suite  
**Review Status:** Approved for Production Testing
