const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.DATA_API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Load data files
let employees, healthPlans, groups;

try {
  employees = JSON.parse(fs.readFileSync(path.join(__dirname, 'employees.json'), 'utf8'));
  healthPlans = JSON.parse(fs.readFileSync(path.join(__dirname, 'healthPlans.json'), 'utf8'));
  groups = JSON.parse(fs.readFileSync(path.join(__dirname, 'groups.json'), 'utf8'));
  console.log('Data files loaded successfully');
} catch (error) {
  console.error('Error loading data files:', error);
  process.exit(1);
}

// Utility function to handle errors
const handleError = (res, message, statusCode = 404) => {
  res.status(statusCode).json({
    error: true,
    message,
    timestamp: new Date().toISOString()
  });
};

// OpenAPI specification endpoint - DYNAMIC
app.get('/openapi.json', (req, res) => {
  // Get the current request's protocol and host
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  const openApiSpec = {
    "openapi": "3.0.0",
    "info": {
      "title": "Eligibility Rule Management API",
      "version": "1.0.0",
      "description": "Complete API for managing eligibility rules and benefit plans",
      "contact": {
        "name": "API Support",
        "email": "support@example.com"
      }
    },
    "servers": [
      {
        "url": baseUrl,
        "description": "Current server (dynamic)"
      }
    ],
    "components": {
      "schemas": {
        "HealthPlan": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "example": "PLAN-A"
            },
            "name": {
              "type": "string",
              "example": "Premium Health Plan"
            },
            "type": {
              "type": "string",
              "enum": [
                "comprehensive",
                "standard",
                "executive",
                "basic"
              ]
            },
            "description": {
              "type": "string",
              "example": "Full coverage health plan"
            },
            "monthlyPremium": {
              "type": "number",
              "example": 450
            },
            "deductible": {
              "type": "number",
              "example": 1000
            },
            "status": {
              "type": "string",
              "enum": [
                "active",
                "inactive",
                "expired"
              ]
            },
            "effectiveDate": {
              "type": "string",
              "format": "date",
              "example": "2024-01-01"
            },
            "expirationDate": {
              "type": "string",
              "format": "date",
              "example": "2024-12-31"
            },
            "benefits": {
              "type": "object",
              "properties": {
                "medical": {
                  "type": "boolean"
                },
                "dental": {
                  "type": "boolean"
                },
                "vision": {
                  "type": "boolean"
                },
                "prescription": {
                  "type": "boolean"
                },
                "mentalHealth": {
                  "type": "boolean"
                }
              }
            }
          }
        },
        "Employee": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "example": "EMP-001"
            },
            "name": {
              "type": "string",
              "example": "John Doe"
            },
            "age": {
              "type": "number",
              "example": 35
            },
            "dateOfBirth": {
              "type": "string",
              "format": "date"
            },
            "groupNumber": {
              "type": "string",
              "example": "GRP-100"
            },
            "healthPlan": {
              "type": "string",
              "example": "PLAN-A"
            },
            "status": {
              "type": "string",
              "enum": [
                "active",
                "inactive"
              ]
            }
          }
        },
        "ApiResponse": {
          "type": "object",
          "properties": {
            "success": {
              "type": "boolean"
            },
            "data": {
              "type": "object"
            },
            "error": {
              "type": "object",
              "properties": {
                "code": {
                  "type": "string"
                },
                "message": {
                  "type": "string"
                },
                "details": {
                  "type": "string"
                }
              }
            },
            "timestamp": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      }
    },
    "paths": {
      "/openapi.json": {
        "get": {
          "summary": "OpenAPI Specification",
          "description": "Raw OpenAPI 3.0 specification in JSON format for API clients",
          "tags": [
            "System"
          ],
          "responses": {
            "200": {
              "description": "OpenAPI specification",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object"
                  }
                }
              }
            }
          }
        }
      },
      "/api/employees": {
        "get": {
          "summary": "Get all employees",
          "tags": ["Employees"],
          "responses": {
            "200": {
              "description": "List of employees",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiResponse"
                  }
                }
              }
            }
          }
        }
      },
      "/api/employees/{id}": {
        "get": {
          "summary": "Get employee by ID",
          "tags": ["Employees"],
          "parameters": [
            {
              "name": "id",
              "in": "path",
              "required": true,
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Employee details",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiResponse"
                  }
                }
              }
            }
          }
        }
      },
      "/api/health-plans": {
        "get": {
          "summary": "Get all health plans",
          "tags": ["Health Plans"],
          "responses": {
            "200": {
              "description": "List of health plans",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiResponse"
                  }
                }
              }
            }
          }
        }
      }
    },
    "tags": [
      {
        "name": "System",
        "description": "System endpoints"
      },
      {
        "name": "Employees",
        "description": "Employee management"
      },
      {
        "name": "Health Plans",
        "description": "Health plan management"
      }
    ]
  };

  res.json(openApiSpec);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'External Data Simulation API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dataStats: {
      employees: employees.length,
      healthPlans: healthPlans.length,
      groups: groups.length
    }
  });
});

// Get all employees
app.get('/api/employees', (req, res) => {
  res.json({
    success: true,
    count: employees.length,
    data: employees
  });
});

// Get employee by ID
app.get('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const employee = employees.find(emp => emp.id === id);
  
  if (!employee) {
    return handleError(res, `Employee with ID ${id} not found`);
  }
  
  res.json({
    success: true,
    data: employee
  });
});

// Get all health plans
app.get('/api/health-plans', (req, res) => {
  res.json({
    success: true,
    count: healthPlans.length,
    data: healthPlans
  });
});

// Get health plan by ID
app.get('/api/health-plans/:planId', (req, res) => {
  const { planId } = req.params;
  const plan = healthPlans.find(p => p.id === planId);
  
  if (!plan) {
    return handleError(res, `Health plan with ID ${planId} not found`);
  }
  
  res.json({
    success: true,
    data: plan
  });
});

// Get all groups
app.get('/api/groups', (req, res) => {
  res.json({
    success: true,
    count: groups.length,
    data: groups
  });
});

// Get group by number
app.get('/api/groups/:groupNumber', (req, res) => {
  const { groupNumber } = req.params;
  const group = groups.find(g => g.groupNumber === groupNumber);
  
  if (!group) {
    return handleError(res, `Group with number ${groupNumber} not found`);
  }
  
  res.json({
    success: true,
    data: group
  });
});

// Get employee eligibility context (combined data for rule evaluation)
app.get('/api/employees/:id/eligibility-context', (req, res) => {
  const { id } = req.params;
  const employee = employees.find(emp => emp.id === id);
  
  if (!employee) {
    return handleError(res, `Employee with ID ${id} not found`);
  }
  
  // Get associated health plan
  let healthPlan = null;
  if (employee.healthPlan) {
    healthPlan = healthPlans.find(p => p.id === employee.healthPlan);
  }
  
  // Get associated group
  let group = null;
  if (employee.groupNumber) {
    group = groups.find(g => g.groupNumber === employee.groupNumber);
  }
  
  // Calculate age from date of birth (more accurate)
  const today = new Date();
  const birthDate = new Date(employee.dateOfBirth);
  let calculatedAge = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    calculatedAge--;
  }
  
  // Build eligibility context
  const context = {
    employee: {
      ...employee,
      calculatedAge: calculatedAge
    },
    healthPlan: healthPlan ? {
      ...healthPlan,
      isValid: healthPlan.status === 'active' && 
               new Date() >= new Date(healthPlan.effectiveDate) && 
               new Date() <= new Date(healthPlan.expirationDate)
    } : null,
    group: group ? {
      ...group,
      isValid: group.status === 'active'
    } : null,
    eligibilityChecks: {
      ageEligible: calculatedAge >= 18,
      hasValidHealthPlan: healthPlan && healthPlan.status === 'active',
      hasValidGroup: group && group.status === 'active',
      healthPlanGroupMatch: healthPlan && group ? 
        healthPlan.eligibleGroups.includes(group.groupNumber) : false
    },
    timestamp: new Date().toISOString()
  };
  
  res.json({
    success: true,
    data: context
  });
});

// Validate eligibility (simplified evaluation endpoint)
app.post('/api/evaluate-eligibility', (req, res) => {
  const { employeeId, rules } = req.body;
  
  if (!employeeId) {
    return handleError(res, 'Employee ID is required', 400);
  }
  
  const employee = employees.find(emp => emp.id === employeeId);
  if (!employee) {
    return handleError(res, `Employee with ID ${employeeId} not found`);
  }
  
  // Get eligibility context
  const healthPlan = employee.healthPlan ? 
    healthPlans.find(p => p.id === employee.healthPlan) : null;
  const group = employee.groupNumber ? 
    groups.find(g => g.groupNumber === employee.groupNumber) : null;
  
  // Simple rule evaluation (this would be replaced by Camunda DMN)
  const results = {
    employeeId,
    eligible: true,
    reasons: [],
    ruleResults: {}
  };
  
  // Age check
  if (employee.age < 18) {
    results.eligible = false;
    results.reasons.push('Employee is under 18 years old');
    results.ruleResults.ageCheck = false;
  } else {
    results.ruleResults.ageCheck = true;
  }
  
  // Health plan check
  if (!healthPlan || healthPlan.status !== 'active') {
    results.eligible = false;
    results.reasons.push('Employee does not have a valid health plan');
    results.ruleResults.healthPlanCheck = false;
  } else {
    results.ruleResults.healthPlanCheck = true;
  }
  
  // Group check
  if (!group || group.status !== 'active') {
    results.eligible = false;
    results.reasons.push('Employee does not belong to a valid group');
    results.ruleResults.groupCheck = false;
  } else {
    results.ruleResults.groupCheck = true;
  }
  
  res.json({
    success: true,
    data: results
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: true,
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  handleError(res, `Route ${req.originalUrl} not found`, 404);
});

// Start server
app.listen(PORT, () => {
  console.log(`External Data Simulation API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('Available endpoints:');
  console.log('  GET /api/employees');
  console.log('  GET /api/employees/:id');
  console.log('  GET /api/health-plans');
  console.log('  GET /api/health-plans/:planId');
  console.log('  GET /api/groups');
  console.log('  GET /api/groups/:groupNumber');
  console.log('  GET /api/employees/:id/eligibility-context');
  console.log('  POST /api/evaluate-eligibility');
});

module.exports = app;
