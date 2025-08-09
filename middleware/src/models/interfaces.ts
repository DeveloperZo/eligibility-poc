// Core interfaces for the benefit plan management system

export interface IRuleDefinition {
  id: string;
  name: string;
  type: 'age' | 'healthPlan' | 'groupNumber';
  description?: string;
  conditions: {
    field: string;
    operator: '>' | '>=' | '<' | '<=' | '=' | '!=' | 'exists' | 'in';
    value: any;
  }[];
  outputValue: boolean | string;
  priority?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface IEligibilityRequest {
  employeeId: string;
  ruleId?: string; // Optional - if not provided, evaluate all active rules
  context?: {
    [key: string]: any;
  };
}

export interface IEvaluationResult {
  employeeId: string;
  eligible: boolean;
  reasons: string[];
  executedRules: {
    ruleId: string;
    ruleName: string;
    result: boolean;
    executionTime: number;
  }[];
  totalExecutionTime: number;
  timestamp: Date;
}

export interface ICamundaDeployment {
  id: string;
  name: string;
  source: string;
  deploymentTime: Date;
  tenantId?: string;
}

export interface IDmnEvaluationRequest {
  variables: {
    [key: string]: {
      value: any;
      type: string;
    };
  };
}

export interface IDmnEvaluationResponse {
  result: Array<{
    [key: string]: {
      value: any;
      type: string;
    };
  }>;
}

export interface IEmployeeContext {
  id: string;
  name: string;
  age: number;
  calculatedAge: number;
  groupNumber: string;
  healthPlan: string | null;
  dateOfBirth: string;
  email: string;
  department: string;
  hireDate: string;
}

export interface IHealthPlan {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'expired' | 'inactive';
  eligibleGroups: string[];
  isValid: boolean;
}

export interface IGroup {
  groupNumber: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  minimumAge: number;
  eligibleHealthPlans: string[];
  isValid: boolean;
}

export interface IEligibilityContext {
  employee: IEmployeeContext;
  healthPlan: IHealthPlan | null;
  group: IGroup | null;
  eligibilityChecks: {
    ageEligible: boolean;
    hasValidHealthPlan: boolean;
    hasValidGroup: boolean;
    healthPlanGroupMatch: boolean;
  };
  timestamp: string;
}

export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

export interface IHealthCheckResponse {
  status: 'OK' | 'ERROR';
  timestamp: string;
  service: string;
  version: string;
  dependencies: {
    camunda: 'connected' | 'disconnected' | 'error';
    database?: 'connected' | 'disconnected' | 'error';  // Optional for stateless operation
    dataApi: 'connected' | 'disconnected' | 'error';
  };
}

export interface ICamundaEngineInfo {
  name: string;
  version: string;
}

export interface ILogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

// Error types
export class RuleValidationError extends Error {
  constructor(message: string, public ruleId?: string) {
    super(message);
    this.name = 'RuleValidationError';
  }
}

export class CamundaConnectionError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'CamundaConnectionError';
  }
}

export class DataApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'DataApiError';
  }
}

export class EvaluationError extends Error {
  constructor(message: string, public employeeId?: string, public ruleId?: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}
