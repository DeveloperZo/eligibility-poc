# External Data Simulation API

This directory contains mock external data sources that simulate real-world systems providing employee information, health plan data, and group numbers. These data sources are used during eligibility rule evaluation to provide context for DMN decision tables.

## Overview

The External Data Simulation API provides REST endpoints to access:
- **Employee Data**: Personal information, age, group membership, health plan enrollment
- **Health Plan Data**: Available plans, benefits, eligibility requirements
- **Group Data**: Employee groups, benefits, and access levels

## Data Files

### employees.json
Contains sample employee records with both positive and negative test cases:
- **EMP001**: Adult (25) with valid health plan and group
- **EMP002**: Minor (17) with valid health plan and group  
- **EMP005**: Adult (45) with no health plan
- **EMP007**: Adult (55) with invalid group
- **EMP008**: Adult (29) with expired health plan

### healthPlans.json
Available health plans with different coverage levels:
- **PLAN-A**: Premium plan for groups GRP-100, GRP-200, GRP-300
- **PLAN-B**: Standard plan for groups GRP-100, GRP-400
- **PLAN-C**: Executive plan for group GRP-300 only
- **EXPIRED-PLAN**: Discontinued plan for testing

### groups.json
Employee group definitions with benefits and requirements:
- **GRP-100**: Standard employees (min age 18)
- **GRP-200**: Marketing team (min age 21)
- **GRP-300**: Executive group (min age 25)
- **GRP-400**: Temporary workers (min age 16)

## API Endpoints

### Employee Endpoints
```
GET /api/employees
GET /api/employees/:id
GET /api/employees/:id/eligibility-context
```

### Health Plan Endpoints
```
GET /api/health-plans
GET /api/health-plans/:planId
```

### Group Endpoints
```
GET /api/groups
GET /api/groups/:groupNumber
```

### Utility Endpoints
```
GET /health
POST /api/evaluate-eligibility
```

## Example Responses

### Employee with Eligibility Context
```json
{
  "success": true,
  "data": {
    "employee": {
      "id": "EMP001",
      "name": "John Smith",
      "age": 25,
      "calculatedAge": 25,
      "groupNumber": "GRP-100",
      "healthPlan": "PLAN-A"
    },
    "healthPlan": {
      "id": "PLAN-A",
      "name": "Premium Health Plan",
      "isValid": true
    },
    "group": {
      "groupNumber": "GRP-100",
      "name": "Standard Employees",
      "isValid": true
    },
    "eligibilityChecks": {
      "ageEligible": true,
      "hasValidHealthPlan": true,
      "hasValidGroup": true,
      "healthPlanGroupMatch": true
    }
  }
}
```

## Testing Scenarios

### Age Validation Tests
- **EMP001** (25 years): Should pass age >= 18 rule
- **EMP002** (17 years): Should fail age >= 18 rule
- **EMP006** (18 years): Should pass age >= 18 rule (boundary case)

### Health Plan Validation Tests
- **EMP001** (PLAN-A): Valid active plan
- **EMP005** (null): No health plan assigned
- **EMP008** (EXPIRED-PLAN): Expired/invalid plan

### Group Validation Tests
- **EMP001** (GRP-100): Valid active group
- **EMP007** (INVALID-GRP): Invalid group number

## Running the API

### Local Development
```bash
cd data
npm install
npm start
```

### Docker Container
```bash
# Build and run with docker-compose
docker-compose up data-api

# Or build standalone
cd data
docker build -t external-data-api .
docker run -p 3001:3001 external-data-api
```

### Testing
```bash
# Run endpoint tests
npm test

# Manual testing
curl http://localhost:3001/health
curl http://localhost:3001/api/employees/EMP001
curl http://localhost:3001/api/employees/EMP001/eligibility-context
```

## Error Handling

The API provides consistent error responses:
```json
{
  "error": true,
  "message": "Employee with ID INVALID not found",
  "timestamp": "2024-07-19T01:30:00.000Z"
}
```

## Configuration

Environment variables:
- `DATA_API_PORT`: Port for the API server (default: 3001)
- `NODE_ENV`: Environment (development/production)

## Integration with Middleware

The middleware service connects to this API to:
1. Fetch employee data for rule evaluation
2. Validate health plan eligibility
3. Check group membership requirements
4. Build context for DMN decision tables

The combined data is used by Camunda DMN engine to evaluate eligibility rules created through the Retool interface.
