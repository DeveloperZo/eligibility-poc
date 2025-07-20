# Benefit Plan and Eligibility Management - Tactical Overview

## Objective
Enable internal business users to independently manage client onboarding, benefit-plan configurations, and associated eligibility rules using Camunda (DMN) and Retool, supported by a TypeScript backend service.

## Responsibilities by Component

### Retool UI
- **Self-Service Interface**: Provides a self-service interface for defining benefit plans and eligibility rules
- **Intuitive Rule Definition**: Enables intuitive definition of eligibility criteria without technical intervention
- **Backend Communication**: Communicates with TypeScript backend via REST API
- **Business User Focus**: Designed for business users with no technical background

### TypeScript Backend Service
- **DMN Conversion**: Converts user-defined eligibility conditions into valid Camunda-compatible DMN XML
- **Automatic Deployment**: Automatically deploys DMN rules to Camunda via its REST API
- **External Data Retrieval**: Retrieves external data required for rule evaluation, ensuring completeness of inputs
- **API Gateway**: Exposes REST endpoints for:
  - DMN rule generation and deployment (`POST /deploy-dmn`)
  - Eligibility evaluation (`POST /evaluate-eligibility`)
  - Rule management and versioning
  - Health monitoring and system status

### Camunda DMN Engine
- **Single Source of Truth**: Acts as the single source of truth for storing and evaluating eligibility rules
- **Standardized Execution**: Provides standardized decision tables (DMN) and reliable rule execution
- **Rule Evaluation**: Evaluates provided variables to determine benefit eligibility outcomes
- **Version Management**: Maintains rule versions and deployment history

## Technical Workflow

1. **Rule Definition**: Business user defines benefit plan and eligibility rules through Retool UI
2. **Rule Submission**: Retool submits rule definitions to the backend service
3. **DMN Generation**: Backend service builds DMN XML, deploys it to Camunda
4. **Eligibility Evaluation**: For eligibility checks, backend fetches external data, compiles inputs, and invokes Camunda
5. **Result Processing**: Camunda evaluates rules and returns eligibility outcomes, displayed in Retool

## Constraints and Considerations

### DMN Management
- **Rule Complexity**: DMN rule complexity and file management (limit complexity within maintainable DMN tables)
- **Performance**: Ensure DMN evaluations complete within acceptable timeframes (<500ms)
- **Versioning**: Maintain clear versioning and rollback capabilities

### System Architecture
- **Separation of Concerns**: Clear separation of concerns between frontend, backend, and rule engine
- **Loose Coupling**: Minimize dependencies between components
- **Scalability**: Design for horizontal scaling and high availability

### Error Handling
- **External Data Failures**: Ensure backend service handles external data failures gracefully, with appropriate error handling and fallback strategies
- **DMN Validation**: Validate DMN XML before deployment to prevent runtime errors
- **User Experience**: Provide clear error messages to business users in Retool interface

## Security and Governance

### Communication Security
- **Standard Authentication**: Secure communication between components via standard authentication mechanisms
- **API Security**: Implement proper API authentication and authorization
- **Data Encryption**: Encrypt sensitive data in transit and at rest

### Audit and Compliance
- **Comprehensive Logging**: Ensure logging and version control for auditability of changes and evaluations
- **Change Tracking**: Track all rule modifications with user attribution
- **Compliance**: Meet regulatory requirements for audit trails and data retention

## 🔧 Technical Implementation Details

### Rule Type Implementation

#### Age Validation Rules
```typescript
interface IAgeRuleConfig {
  ageThreshold: number;
  operator: '>=' | '>' | '<=' | '<' | '=';
  fieldName: string; // Default: 'age'
}

// Generated DMN Structure
<decisionTable hitPolicy="FIRST">
  <input label="Age" expression="age" />
  <output label="Eligible" type="boolean" />
  <rule>
    <inputEntry><text>age >= 18</text></inputEntry>
    <outputEntry><text>true</text></outputEntry>
  </rule>
</decisionTable>
```

#### Health Plan Validation Rules
```typescript
interface IHealthPlanRuleConfig {
  validHealthPlans: string[];
  allowNull?: boolean;
  customValidation?: string; // FEEL expression
}

// FEEL Expression Generation
// in("PLAN-A", "PLAN-B", "PLAN-C")
```

#### Group Number Validation Rules
```typescript
interface IGroupRuleConfig {
  validGroupNumbers: string[];
  hierarchical?: boolean; // Support group hierarchies
  effectiveDate?: Date;   // Time-based validation
}
```

### DMN XML Generation Strategy

#### Template-Based Generation
```typescript
class DmnTemplateEngine {
  generateFromTemplate(
    ruleType: RuleType,
    config: RuleConfig,
    metadata: RuleMetadata
  ): string {
    const template = this.getTemplate(ruleType);
    const populated = this.populateTemplate(template, config);
    const validated = this.validateDmn(populated);
    return this.formatXml(validated);
  }
}
```

#### FEEL Expression Building
```typescript
class FeelExpressionBuilder {
  buildAgeExpression(operator: string, threshold: number): string {
    return `age ${operator} ${threshold}`;
  }
  
  buildInExpression(field: string, values: string[]): string {
    const quotedValues = values.map(v => `"${v}"`).join(', ');
    return `${field} in (${quotedValues})`;
  }
}
```

### Data Integration Patterns

#### Employee Context Aggregation
```typescript
class EmployeeContextService {
  async getEligibilityContext(employeeId: string): Promise<IEligibilityContext> {
    const [employee, healthPlan, group] = await Promise.all([
      this.dataApi.getEmployee(employeeId),
      this.dataApi.getEmployeeHealthPlan(employeeId),
      this.dataApi.getEmployeeGroup(employeeId)
    ]);
    
    return {
      employee: this.enrichEmployeeData(employee),
      healthPlan: this.validateHealthPlan(healthPlan),
      group: this.validateGroup(group),
      eligibilityChecks: this.performPreChecks(employee, healthPlan, group)
    };
  }
}
```

### Error Handling Strategy

#### Hierarchical Error Types
```typescript
// Base error for all rule-related issues
abstract class RuleError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific error types
class RuleValidationError extends RuleError {}
class DmnGenerationError extends RuleError {}
class CamundaDeploymentError extends RuleError {}
class RuleEvaluationError extends RuleError {}
```

#### Error Recovery Mechanisms
```typescript
class RuleExecutionService {
  async executeWithFallback(
    ruleId: string, 
    context: IEligibilityContext
  ): Promise<IEvaluationResult> {
    try {
      return await this.executeRule(ruleId, context);
    } catch (error) {
      if (error instanceof CamundaConnectionError) {
        return await this.executeLocally(ruleId, context);
      }
      throw error;
    }
  }
}
```

## 🔄 Development Workflow Patterns

### Rule Development Lifecycle
1. **Business Rule Definition** (Retool)
2. **DMN Generation** (Middleware)
3. **Validation & Testing** (Automated)
4. **Deployment** (Camunda)
5. **Monitoring & Maintenance** (Ongoing)

### Testing Strategy Implementation

#### Unit Testing Approach
```typescript
describe('DmnGeneratorService', () => {
  describe('generateAgeRule', () => {
    it('should generate valid DMN for age >= 18', async () => {
      // Arrange
      const request = createAgeRuleRequest(18, '>=');
      
      // Act
      const result = await service.generateAgeRule(request);
      
      // Assert
      expect(result.validation.valid).toBe(true);
      expect(result.dmnXml).toContain('age >= 18');
    });
  });
});
```

#### Integration Testing Approach
```typescript
describe('End-to-End Rule Management', () => {
  it('should create, deploy, and evaluate rule', async () => {
    // Create rule via API
    const rule = await request(app)
      .post('/api/rules')
      .send(createSampleRule())
      .expect(201);
    
    // Verify deployment to Camunda
    const deployment = await camundaService.getDeployment(rule.deploymentId);
    expect(deployment).toBeDefined();
    
    // Test rule evaluation
    const result = await request(app)
      .post('/api/evaluate')
      .send({ employeeId: 'EMP001', ruleId: rule.id })
      .expect(200);
    
    expect(result.body.data.eligible).toBe(true);
  });
});
```

## 🚀 Performance Optimization Strategies

### Caching Implementation
```typescript
class RuleCache {
  private cache = new Map<string, ICachedRule>();
  
  async getRule(ruleId: string): Promise<IRule> {
    const cached = this.cache.get(ruleId);
    if (cached && !this.isExpired(cached)) {
      return cached.rule;
    }
    
    const rule = await this.loadRule(ruleId);
    this.cache.set(ruleId, {
      rule,
      cachedAt: new Date(),
      ttl: 300000 // 5 minutes
    });
    
    return rule;
  }
}
```

### Database Optimization
```sql
-- Indexes for rule queries
CREATE INDEX idx_rules_type_active ON rules(type, is_active, created_at);
CREATE INDEX idx_rule_executions_employee_date ON rule_executions(employee_id, executed_at);

-- Partitioning for large datasets
PARTITION TABLE rule_executions BY RANGE (executed_at);
```

## 🔐 Security Implementation

### Input Validation Framework
```typescript
class RuleInputValidator {
  validateRuleDefinition(input: any): IRuleDefinition {
    const schema = Joi.object({
      name: Joi.string().min(3).max(100).required(),
      type: Joi.string().valid('age', 'healthPlan', 'groupNumber').required(),
      conditions: Joi.array().items(Joi.object({
        field: Joi.string().required(),
        operator: Joi.string().valid('>=', '>', '<=', '<', '=', '!=').required(),
        value: Joi.alternatives().try(Joi.string(), Joi.number()).required()
      })).min(1).required()
    });
    
    const { error, value } = schema.validate(input);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }
    
    return value as IRuleDefinition;
  }
}
```

### Authentication & Authorization
```typescript
class SecurityMiddleware {
  static requireApiKey(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || !this.validateApiKey(apiKey)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
  }
  
  static requireRuleAccess(action: 'read' | 'write' | 'deploy') {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;
      if (!this.hasPermission(user, action)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  }
}
```

## 📊 Monitoring & Observability

### Metrics Collection
```typescript
class MetricsCollector {
  private metrics = {
    rulesCreated: new Counter('rules_created_total'),
    ruleExecutions: new Counter('rule_executions_total'),
    executionDuration: new Histogram('rule_execution_duration_seconds'),
    deploymentFailures: new Counter('deployment_failures_total')
  };
  
  recordRuleExecution(ruleId: string, duration: number, success: boolean) {
    this.metrics.ruleExecutions.inc({ rule_id: ruleId, success: success.toString() });
    this.metrics.executionDuration.observe(duration);
  }
}
```

### Health Check Implementation
```typescript
class HealthChecker {
  async checkSystemHealth(): Promise<IHealthStatus> {
    const checks = await Promise.allSettled([
      this.checkCamunda(),
      this.checkDatabase(),
      this.checkDataApi(),
      this.checkMemoryUsage()
    ]);
    
    return {
      status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
      dependencies: this.formatHealthChecks(checks),
      timestamp: new Date().toISOString()
    };
  }
}
```

## 🔧 Deployment Strategies

### Environment Configuration
```typescript
// config/environments/production.ts
export const productionConfig = {
  camunda: {
    baseUrl: process.env.CAMUNDA_URL,
    timeout: 30000,
    retries: 3
  },
  database: {
    pool: {
      min: 5,
      max: 20,
      acquire: 30000,
      idle: 10000
    }
  },
  cache: {
    ttl: 300000,
    maxSize: 1000
  }
};
```

### Docker Optimization
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## 🎯 Implementation Priorities

### Phase 1: Core Rule Management
1. Rule CRUD operations
2. Basic DMN generation
3. Camunda integration
4. Simple evaluation engine

### Phase 2: Advanced Features
1. Rule versioning
2. A/B testing capabilities
3. Performance optimization
4. Advanced monitoring

### Phase 3: Enterprise Features
1. Multi-tenancy support
2. Advanced security
3. Audit logging
4. Compliance reporting
