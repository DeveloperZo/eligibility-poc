import { Request, Response, NextFunction } from 'express';
import { IApiResponse } from '../models/interfaces';
import { logger } from '../utils/logger';

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowedValues?: any[];
  validator?: (value: any) => boolean | string;
}

export class ValidationMiddleware {
  
  /**
   * Create validation middleware for specific rules
   */
  static validate(rules: ValidationRule[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const errors: string[] = [];
        const data = req.body;

        for (const rule of rules) {
          const value = data[rule.field];
          const fieldErrors = ValidationMiddleware.validateField(rule.field, value, rule);
          errors.push(...fieldErrors);
        }

        if (errors.length > 0) {
          logger.warn('Validation failed', { errors, body: req.body });
          
          const response: IApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: errors
            },
            timestamp: new Date()
          };
          
          res.status(400).json(response);
          return;
        }

        next();
      } catch (error) {
        logger.error('Validation middleware error:', error);
        next(error);
      }
    };
  }

  /**
   * Validate a single field against a rule
   */
  private static validateField(fieldName: string, value: any, rule: ValidationRule): string[] {
    const errors: string[] = [];

    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field '${fieldName}' is required`);
      return errors; // If required field is missing, skip other validations
    }

    // Skip other validations if field is not provided and not required
    if (value === undefined || value === null) {
      return errors;
    }

    // Type validation
    if (rule.type && !ValidationMiddleware.validateType(value, rule.type)) {
      errors.push(`Field '${fieldName}' must be of type ${rule.type}`);
    }

    // String validations
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`Field '${fieldName}' must be at least ${rule.minLength} characters long`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`Field '${fieldName}' must be no more than ${rule.maxLength} characters long`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`Field '${fieldName}' does not match required pattern`);
      }
    }

    // Array validations
    if (rule.type === 'array' && Array.isArray(value)) {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`Field '${fieldName}' must contain at least ${rule.minLength} items`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`Field '${fieldName}' must contain no more than ${rule.maxLength} items`);
      }
    }

    // Allowed values validation
    if (rule.allowedValues && !rule.allowedValues.includes(value)) {
      errors.push(`Field '${fieldName}' must be one of: ${rule.allowedValues.join(', ')}`);
    }

    // Custom validator
    if (rule.validator) {
      const validationResult = rule.validator(value);
      if (validationResult !== true) {
        const errorMessage = typeof validationResult === 'string' 
          ? validationResult 
          : `Field '${fieldName}' failed custom validation`;
        errors.push(errorMessage);
      }
    }

    return errors;
  }

  /**
   * Validate value type
   */
  private static validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null;
      default:
        return true;
    }
  }

  /**
   * Validation rules for rule creation
   */
  static ruleCreationValidation() {
    return ValidationMiddleware.validate([
      {
        field: 'ruleId',
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: /^[A-Z][A-Z0-9_]*$/,
        validator: (value: string) => {
          return value.includes('_') || value.length > 3 
            ? true 
            : 'Rule ID should be descriptive (e.g., AGE_001, HP_BASIC)';
        }
      },
      {
        field: 'ruleName',
        required: true,
        type: 'string',
        minLength: 5,
        maxLength: 200
      },
      {
        field: 'ruleType',
        required: true,
        type: 'string',
        allowedValues: ['age', 'healthPlan', 'groupNumber', 'complex']
      },
      {
        field: 'configuration',
        required: true,
        type: 'object'
      }
    ]);
  }

  /**
   * Validation rules for eligibility evaluation
   */
  static evaluationValidation() {
    return ValidationMiddleware.validate([
      {
        field: 'employeeId',
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 50
      },
      {
        field: 'ruleId',
        required: false,
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      {
        field: 'context',
        required: false,
        type: 'object'
      }
    ]);
  }

  /**
   * Validation rules for batch evaluation
   */
  static batchEvaluationValidation() {
    return ValidationMiddleware.validate([
      {
        field: 'requests',
        required: true,
        type: 'array',
        minLength: 1,
        maxLength: 100,
        validator: (requests: any[]) => {
          // Validate each request in the array
          for (let i = 0; i < requests.length; i++) {
            const request = requests[i];
            if (!request.employeeId || typeof request.employeeId !== 'string') {
              return `Request ${i + 1}: employeeId is required and must be a string`;
            }
          }
          return true;
        }
      },
      {
        field: 'ruleId',
        required: false,
        type: 'string',
        minLength: 1,
        maxLength: 100
      }
    ]);
  }

  /**
   * Validation rules for rule updates
   */
  static ruleUpdateValidation() {
    return ValidationMiddleware.validate([
      {
        field: 'ruleName',
        required: false,
        type: 'string',
        minLength: 5,
        maxLength: 200
      },
      {
        field: 'configuration',
        required: false,
        type: 'object'
      },
      {
        field: 'metadata',
        required: false,
        type: 'object'
      }
    ]);
  }

  /**
   * Validation rules for rule testing
   */
  static ruleTestValidation() {
    return ValidationMiddleware.validate([
      {
        field: 'testData',
        required: false,
        type: 'object'
      },
      {
        field: 'variables',
        required: false,
        type: 'object'
      }
    ]);
  }

  /**
   * Rate limiting middleware (basic implementation)
   */
  static rateLimit(windowMs: number = 60000, maxRequests: number = 100) {
    const requests = new Map<string, { count: number; resetTime: number }>();
    
    return (req: Request, res: Response, next: NextFunction): void => {
      const identifier = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      for (const [key, data] of requests.entries()) {
        if (data.resetTime < windowStart) {
          requests.delete(key);
        }
      }

      const requestData = requests.get(identifier) || { count: 0, resetTime: now + windowMs };
      
      if (requestData.resetTime < now) {
        // Reset window
        requestData.count = 1;
        requestData.resetTime = now + windowMs;
      } else {
        requestData.count++;
      }

      requests.set(identifier, requestData);

      if (requestData.count > maxRequests) {
        logger.warn('Rate limit exceeded', { 
          ip: identifier, 
          requests: requestData.count,
          path: req.path 
        });
        
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Limit: ${maxRequests} requests per ${windowMs / 1000} seconds`
          },
          timestamp: new Date()
        };
        
        res.status(429).json(response);
        return;
      }

      next();
    };
  }
}

export const validationMiddleware = new ValidationMiddleware();
