# Implementation Guide - Eligibility Rule Management System

---
**Document Metadata**
- **Version:** 2.1.0
- **Last Modified:** 2025-01-08
- **Last Author:** Assistant (AI) - Self-Serve Workflow Implementation
- **Owner:** Development Team
- **Status:** Active
- **Review Cycle:** Sprint-based (bi-weekly)
- **Next Review:** 2025-01-22
- **Dependencies:** ARCHITECTURE.md, ROADMAP.md
- **Audience:** Developers, Technical Leads, DevOps
- **Change Log:**
  - v2.1.0 (2025-01-08): Added self-serve workflow patterns and template system
  - v2.0.0 (2024-12-20): Major refactor for Camunda integration
  - v1.5.0 (2024-12-01): Added DMN generation patterns
  - v1.0.0 (2024-11-01): Initial implementation guide
---

This comprehensive guide provides technical implementation details, patterns, code examples, and best practices for developing and extending the Eligibility Rule Management System.

## Table of Contents

1. [System Overview](#system-overview)
2. [API Documentation](#api-documentation)
3. [Implementation Patterns](#implementation-patterns)
4. [Testing Strategy](#testing-strategy)
5. [Deployment Procedures](#deployment-procedures)
6. [Monitoring & Observability](#monitoring--observability)
7. [Performance Optimization](#performance-optimization)
8. [Security Implementation](#security-implementation)
9. [Integration Patterns](#integration-patterns)
10. [Code Examples](#code-examples)

## System Overview

### Problem Domain

The system addresses the complex challenge of managing employee benefit eligibility rules, transforming a traditionally code-dependent process into a business-user-friendly, self-service platform.

### Solution Architecture

```typescript
// Core Domain Model
interface EligibilitySystem {
  ruleManagement: RuleService;        // Create, update, delete rules
  dmnGeneration: DmnGeneratorService; // Convert rules to DMN XML
  evaluation: EvaluationService;      // Evaluate eligibility
  dataIntegration: DataService;       // External data access
  monitoring: MonitoringService;      // System observability
}
```

## 📡 API Documentation

### REST API Endpoints

#### Rule Management

```typescript
// POST /api/rules/create
interface CreateRuleRequest {
  ruleId: string;
  ruleName: string;
  ruleType: 'age' | 'health_plan' | 'group_number';
  configuration: RuleConfiguration;
  metadata?: RuleMetadata;
}

// GET /api/rules
interface ListRulesResponse {
  rules: Rule[];
  total: number;
  page: number;
  pageSize: number;
}

// PUT /api/rules/:id
interface UpdateRuleRequest {
  configuration?: Partial<RuleConfiguration>;
  metadata?: Partial<RuleMetadata>;
  version?: number;
}

// DELETE /api/rules/:id
interface DeleteRuleResponse {
  success: boolean;
  deletedAt: Date;
}
```

#### Evaluation Endpoints

```typescript
// POST /api/evaluate
interface EvaluateRequest {
  employeeId: string;
  rules: string[];
  context?: EvaluationContext;
}

interface EvaluateResponse {
  eligible: boolean;
  results: RuleResult[];
  executionTime: number;
  timestamp: Date;
}

// POST /api/evaluate/batch
interface BatchEvaluateRequest {
  employees: string[];
  rules: string[];
  parallel?: boolean;
}
```

#### DMN Management

```typescript
// POST /api/dmn/generate
interface GenerateDmnRequest {
  ruleId: string;
  ruleType: string;
  configuration: any;
}

// POST /api/dmn/deploy
interface DeployDmnRequest {
  xml: string;
  deploymentName: string;
  enableDuplicateFiltering?: boolean;
}

// GET /api/dmn/templates/:type
interface DmnTemplateResponse {
  template: string;
  variables: string[];
  example: any;
}
```

### API Authentication

```typescript
// Middleware for API authentication
export const authenticateAPI = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required'
    });
  }
  
  const isValid = await validateApiKey(apiKey);
  if (!isValid) {
    return res.status(403).json({
      error: 'Invalid API key'
    });
  }
  
  next();
};
```

## 🔨 Implementation Patterns

### Service Layer Pattern

```typescript
// Service implementation with dependency injection
export class EligibilityRuleService {
  constructor(
    private dmnGenerator: DmnGeneratorService,
    private camundaClient: CamundaService,
    private dataService: DataApiService,
    private repository: RuleRepository
  ) {}

  async createRule(definition: IRuleDefinition): Promise<IRule> {
    // Validate rule definition
    const validation = await this.validateRule(definition);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    // Generate DMN XML
    const dmnXml = await this.dmnGenerator.generate(definition);
    
    // Deploy to Camunda
    const deployment = await this.camundaClient.deploy(dmnXml);
    
    // Persist rule
    const rule = await this.repository.save({
      ...definition,
      deploymentId: deployment.id,
      status: 'active'
    });
    
    return rule;
  }
}
```

### Repository Pattern

```typescript
// Data access abstraction
export class RuleRepository implements IRuleRepository {
  constructor(private db: Database) {}

  async save(rule: IRule): Promise<IRule> {
    const query = `
      INSERT INTO rules (id, rule_id, configuration, version)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (rule_id) 
      DO UPDATE SET configuration = $3, version = version + 1
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      rule.id,
      rule.ruleId,
      JSON.stringify(rule.configuration),
      rule.version || 1
    ]);
    
    return this.mapToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<IRule | null> {
    const query = 'SELECT * FROM rules WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rows[0] 
      ? this.mapToEntity(result.rows[0]) 
      : null;
  }
}
```

### Factory Pattern for DMN Generation

```typescript
// DMN template factory
export class DmnTemplateFactory {
  private templates = new Map<RuleType, IDmnTemplate>();

  constructor() {
    this.registerTemplate('age', new AgeRuleTemplate());
    this.registerTemplate('health_plan', new HealthPlanTemplate());
    this.registerTemplate('group_number', new GroupNumberTemplate());
  }

  create(type: RuleType, config: any): string {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`Unknown rule type: ${type}`);
    }
    
    return template.generate(config);
  }
}

// Template implementation
class AgeRuleTemplate implements IDmnTemplate {
  generate(config: AgeRuleConfig): string {
    return `
      <decision id="${config.ruleId}" name="${config.ruleName}">
        <decisionTable>
          <input id="age" label="Employee Age">
            <inputExpression typeRef="number">
              <text>age</text>
            </inputExpression>
          </input>
          <output id="eligible" label="Eligible" typeRef="boolean"/>
          <rule>
            <inputEntry>
              <text>${config.operator} ${config.threshold}</text>
            </inputEntry>
            <outputEntry>
              <text>true</text>
            </outputEntry>
          </rule>
        </decisionTable>
      </decision>
    `;
  }
}
```

## 🧪 Testing Strategy

### Unit Testing

```typescript
// Jest unit test example
describe('EligibilityRuleService', () => {
  let service: EligibilityRuleService;
  let mockDmnGenerator: jest.Mocked<DmnGeneratorService>;
  let mockCamundaClient: jest.Mocked<CamundaService>;

  beforeEach(() => {
    mockDmnGenerator = createMock<DmnGeneratorService>();
    mockCamundaClient = createMock<CamundaService>();
    
    service = new EligibilityRuleService(
      mockDmnGenerator,
      mockCamundaClient,
      mockDataService,
      mockRepository
    );
  });

  describe('createRule', () => {
    it('should create and deploy a rule successfully', async () => {
      // Arrange
      const ruleDefinition = createTestRule();
      mockDmnGenerator.generate.mockResolvedValue('<dmn>...</dmn>');
      mockCamundaClient.deploy.mockResolvedValue({
        id: 'deployment-123',
        name: 'Test Deployment'
      });

      // Act
      const result = await service.createRule(ruleDefinition);

      // Assert
      expect(result).toBeDefined();
      expect(result.deploymentId).toBe('deployment-123');
      expect(mockDmnGenerator.generate).toHaveBeenCalledWith(ruleDefinition);
      expect(mockCamundaClient.deploy).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidRule = { ruleId: '' }; // Invalid rule

      // Act & Assert
      await expect(service.createRule(invalidRule))
        .rejects
        .toThrow(ValidationError);
    });
  });
});
```

### Integration Testing

```typescript
// Supertest integration test
describe('Rule API Integration', () => {
  let app: Application;
  
  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('POST /api/rules/create', () => {
    it('should create a rule end-to-end', async () => {
      const response = await request(app)
        .post('/api/rules/create')
        .set('X-API-Key', 'test-key')
        .send({
          ruleId: 'age_rule_test',
          ruleName: 'Age Test Rule',
          ruleType: 'age',
          configuration: {
            ageThreshold: 21,
            operator: '>='
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.rule.ruleId).toBe('age_rule_test');
      
      // Verify deployment in Camunda
      const deployment = await camundaClient.getDeployment(
        response.body.rule.deploymentId
      );
      expect(deployment).toBeDefined();
    });
  });
});
```

### Performance Testing

```javascript
// K6 performance test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  const payload = JSON.stringify({
    employeeId: 'EMP-001',
    rules: ['age_rule', 'health_plan_rule'],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'test-key',
    },
  };

  const response = http.post(
    'http://localhost:3000/api/evaluate',
    payload,
    params
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has eligible field': (r) => JSON.parse(r.body).hasOwnProperty('eligible'),
  });

  sleep(1);
}
```

## 🚀 Deployment Procedures

### Docker Deployment

```dockerfile
# Multi-stage Dockerfile for production
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS dev-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dev-deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment

```yaml
# Deployment manifest
apiVersion: apps/v1
kind: Deployment
metadata:
  name: middleware-service
  namespace: eligibility-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: middleware
  template:
    metadata:
      labels:
        app: middleware
    spec:
      containers:
      - name: middleware
        image: eligibility/middleware:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: CAMUNDA_URL
          valueFrom:
            configMapKeyRef:
              name: middleware-config
              key: camunda-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### CI/CD Pipeline

```yaml
# GitHub Actions workflow
name: Deploy to Production

on:
  push:
    branches: [main]
    
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:integration
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: |
          docker build -t eligibility/middleware:${{ github.sha }} .
          docker tag eligibility/middleware:${{ github.sha }} eligibility/middleware:latest
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push eligibility/middleware:${{ github.sha }}
          docker push eligibility/middleware:latest
          
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/middleware-service \
            middleware=eligibility/middleware:${{ github.sha }} \
            -n eligibility-system
          kubectl rollout status deployment/middleware-service -n eligibility-system
```

## 📊 Monitoring & Observability

### Metrics Collection

```typescript
// Prometheus metrics
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsCollector {
  private registry = new Registry();
  
  private counters = {
    rulesCreated: new Counter({
      name: 'rules_created_total',
      help: 'Total number of rules created',
      labelNames: ['rule_type'],
      registers: [this.registry]
    }),
    
    evaluations: new Counter({
      name: 'evaluations_total',
      help: 'Total number of evaluations',
      labelNames: ['rule_id', 'result'],
      registers: [this.registry]
    })
  };
  
  private histograms = {
    evaluationDuration: new Histogram({
      name: 'evaluation_duration_seconds',
      help: 'Evaluation duration in seconds',
      labelNames: ['rule_type'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    })
  };
  
  recordRuleCreation(ruleType: string) {
    this.counters.rulesCreated.labels(ruleType).inc();
  }
  
  recordEvaluation(ruleId: string, result: string, duration: number) {
    this.counters.evaluations.labels(ruleId, result).inc();
    this.histograms.evaluationDuration.labels(ruleId).observe(duration);
  }
  
  getMetrics(): string {
    return this.registry.metrics();
  }
}
```

### Logging Strategy

```typescript
// Structured logging with Winston
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'middleware' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'combined.log'
    })
  ]
});

// Correlation ID middleware
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] || uuid.v4();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  logger.child({ correlationId });
  next();
};
```

### Health Checks

```typescript
// Comprehensive health check implementation
export class HealthChecker {
  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCamunda(),
      this.checkDataApi(),
      this.checkRedis()
    ]);
    
    const status = this.aggregateStatus(checks);
    
    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION,
      checks: {
        database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        camunda: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        dataApi: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        redis: checks[3].status === 'fulfilled' ? 'healthy' : 'unhealthy'
      }
    };
  }
  
  private async checkDatabase(): Promise<void> {
    const query = 'SELECT 1';
    await db.query(query);
  }
  
  private async checkCamunda(): Promise<void> {
    const response = await axios.get(`${CAMUNDA_URL}/engine`);
    if (response.status !== 200) {
      throw new Error('Camunda unhealthy');
    }
  }
}
```

## ⚡ Performance Optimization

### Caching Strategy

```typescript
// Redis caching implementation
import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;
  private defaultTTL = 3600; // 1 hour
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.setex(key, this.defaultTTL, serialized);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Cache decorator
export function Cacheable(ttl: number = 3600) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      const result = await method.apply(this, args);
      await cacheService.set(cacheKey, result, ttl);
      
      return result;
    };
  };
}
```

### Database Optimization

```typescript
// Connection pooling
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,                    // Maximum pool size
  idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000 // Return error after 2 seconds if connection cannot be established
});

// Query optimization with prepared statements
export class OptimizedRepository {
  private preparedStatements = new Map<string, string>();
  
  constructor() {
    this.prepareSt// Batch processing
  async batchEvaluate(requests: EvaluationRequest[]): Promise<EvaluationResult[]> {
    const batchSize = 100;
    const results: EvaluationResult[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(req => this.evaluate(req))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
}
```

## 🔐 Security Implementation

### Input Validation

```typescript
// Joi validation schemas
import Joi from 'joi';

export const ruleSchema = Joi.object({
  ruleId: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .required(),
  
  ruleName: Joi.string()
    .min(3)
    .max(100)
    .required(),
  
  ruleType: Joi.string()
    .valid('age', 'health_plan', 'group_number')
    .required(),
  
  configuration: Joi.object().required()
});

// Validation middleware
export const validate = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    
    next();
  };
};
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

// Specific endpoint limiting
export const evaluationLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'eval-limit:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 evaluations per minute
  skipSuccessfulRequests: false
});
```

## 🔄 Integration Patterns

### External System Integration

```typescript
// Adapter pattern for external systems
export interface IExternalDataAdapter {
  fetchEmployeeData(id: string): Promise<Employee>;
  fetchHealthPlans(): Promise<HealthPlan[]>;
  validateEligibility(context: EligibilityContext): Promise<boolean>;
}

export class HRSystemAdapter implements IExternalDataAdapter {
  private apiClient: AxiosInstance;
  
  constructor(config: ExternalSystemConfig) {
    this.apiClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 5000,
      headers: {
        'X-API-Key': config.apiKey
      }
    });
    
    // Add retry logic
    axiosRetry(this.apiClient, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 429;
      }
    });
  }
  
  async fetchEmployeeData(id: string): Promise<Employee> {
    try {
      const response = await this.apiClient.get(`/employees/${id}`);
      return this.mapToEmployee(response.data);
    } catch (error) {
      logger.error('Failed to fetch employee data', { id, error });
      throw new IntegrationError('HR system unavailable');
    }
  }
}
```

### Event-Driven Communication

```typescript
// Event emitter for rule changes
import { EventEmitter } from 'events';

export class RuleEventEmitter extends EventEmitter {
  emitRuleCreated(rule: Rule) {
    this.emit('rule:created', {
      eventType: 'RULE_CREATED',
      timestamp: new Date(),
      data: rule
    });
  }
  
  emitRuleUpdated(rule: Rule, changes: any) {
    this.emit('rule:updated', {
      eventType: 'RULE_UPDATED',
      timestamp: new Date(),
      data: { rule, changes }
    });
  }
  
  emitEvaluationCompleted(result: EvaluationResult) {
    this.emit('evaluation:completed', {
      eventType: 'EVALUATION_COMPLETED',
      timestamp: new Date(),
      data: result
    });
  }
}

// Event handlers
ruleEvents.on('rule:created', async (event) => {
  // Send notification
  await notificationService.notify('RULE_CREATED', event.data);
  
  // Update cache
  await cacheService.invalidate('rules:*');
  
  // Log audit trail
  await auditService.log(event);
});
```

## 💻 Code Examples

### Complete Rule Creation Flow

```typescript
// Controller
export class RuleController {
  constructor(private ruleService: RuleService) {}
  
  async createRule(req: Request, res: Response) {
    try {
      const rule = await this.ruleService.createRule(req.body);
      
      res.status(201).json({
        success: true,
        rule,
        links: {
          self: `/api/rules/${rule.id}`,
          evaluate: `/api/evaluate?ruleId=${rule.ruleId}`
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details
        });
      }
      
      logger.error('Rule creation failed', { error });
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }
}

// Service
export class RuleService {
  async createRule(definition: RuleDefinition): Promise<Rule> {
    // Start transaction
    const trx = await db.transaction();
    
    try {
      // Validate
      await this.validator.validate(definition);
      
      // Generate DMN
      const dmn = await this.dmnGenerator.generate(definition);
      
      // Deploy to Camunda
      const deployment = await this.camunda.deploy(dmn);
      
      // Save to database
      const rule = await this.repository.save({
        ...definition,
        deploymentId: deployment.id,
        status: 'active'
      }, trx);
      
      // Commit transaction
      await trx.commit();
      
      // Emit event
      this.events.emitRuleCreated(rule);
      
      return rule;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}
```

### Complex Evaluation Example

```typescript
export class EvaluationService {
  async evaluateEligibility(
    employeeId: string,
    ruleIds: string[]
  ): Promise<EligibilityResult> {
    // Fetch employee data with caching
    const employee = await this.getCachedEmployeeData(employeeId);
    
    // Fetch rules in parallel
    const rules = await Promise.all(
      ruleIds.map(id => this.ruleRepository.findById(id))
    );
    
    // Build evaluation context
    const context = {
      age: employee.age,
      healthPlan: employee.healthPlan,
      groupNumber: employee.groupNumber,
      employmentStatus: employee.status,
      tenure: this.calculateTenure(employee.hireDate)
    };
    
    // Evaluate each rule
    const results = await Promise.all(
      rules.map(rule => this.evaluateRule(rule, context))
    );
    
    // Aggregate results
    const eligible = results.every(r => r.eligible);
    
    // Record metrics
    this.metrics.recordEvaluation(employeeId, eligible ? 'eligible' : 'ineligible');
    
    return {
      employeeId,
      eligible,
      results,
      evaluatedAt: new Date(),
      context
    };
  }
}
```

---

**This implementation guide is maintained by the development team and updated with each sprint.**