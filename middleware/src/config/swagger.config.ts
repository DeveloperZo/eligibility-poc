import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';
import { Request } from 'express';

export const getSwaggerSpec = (req?: Request) => {
  // Dynamically determine the server URL from the request
  let serverUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  
  if (req) {
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = req.get('host');
    serverUrl = `${protocol}://${host}`;
  }
  const options: Options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'benefit plan Management API',
        version: '1.0.0',
        description: 'Production API for managing benefit plans and benefit plans',
        contact: {
          name: 'API Support',
          email: 'support@company.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: serverUrl,
          description: 'Current server (dynamic)'
        }
      ],
    components: {
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Invalid input data' },
                details: { type: 'string' }
              }
            },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['success', 'timestamp']
        },
        HealthPlan: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'PLAN-A' },
            name: { type: 'string', example: 'Premium Health Plan' },
            type: { 
              type: 'string', 
              enum: ['comprehensive', 'standard', 'executive', 'basic'],
              example: 'comprehensive'
            },
            description: { type: 'string', example: 'Full coverage health plan with dental and vision' },
            monthlyPremium: { type: 'number', format: 'float', example: 450.00 },
            deductible: { type: 'number', format: 'float', example: 1000.00 },
            status: { 
              type: 'string', 
              enum: ['active', 'inactive', 'expired'],
              example: 'active'
            },
            effectiveDate: { type: 'string', format: 'date', example: '2024-01-01' },
            expirationDate: { type: 'string', format: 'date', example: '2024-12-31' },
            benefits: {
              type: 'object',
              properties: {
                medical: { type: 'boolean', example: true },
                dental: { type: 'boolean', example: true },
                vision: { type: 'boolean', example: true },
                prescription: { type: 'boolean', example: true },
                mentalHealth: { type: 'boolean', example: true }
              }
            },
            eligibleGroups: {
              type: 'array',
              items: { type: 'string' },
              example: ['GRP-100', 'GRP-200']
            }
          },
          required: ['id', 'name', 'type', 'status']
        },
        EligibilityRule: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'rule-123' },
            name: { type: 'string', example: 'Age Validation Rule' },
            type: { 
              type: 'string', 
              enum: ['age', 'health_plan', 'group_number'],
              example: 'age'
            },
            description: { type: 'string', example: 'Validates employee age requirements' },
            configuration: { 
              type: 'object',
              example: { minAge: 18, operator: '>=' }
            },
            status: { 
              type: 'string', 
              enum: ['active', 'inactive', 'draft'],
              example: 'active'
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            createdBy: { type: 'string', example: 'admin@company.com' }
          },
          required: ['id', 'name', 'type', 'status']
        },
        Employee: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'EMP-001' },
            name: { type: 'string', example: 'John Doe' },
            age: { type: 'number', example: 35 },
            dateOfBirth: { type: 'string', format: 'date', example: '1988-06-15' },
            groupNumber: { type: 'string', example: 'GRP-100' },
            healthPlan: { type: 'string', example: 'PLAN-A' },
            status: { 
              type: 'string', 
              enum: ['active', 'inactive'],
              example: 'active'
            },
            email: { type: 'string', format: 'email', example: 'john.doe@company.com' },
            department: { type: 'string', example: 'Engineering' }
          },
          required: ['id', 'name', 'age', 'status']
        }
      }
    }
  },
  apis: [
    './src/app.ts',
    './src/controllers/*.ts'
  ]
};

  return swaggerJsdoc(options);
};
