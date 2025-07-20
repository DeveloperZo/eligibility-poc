import { Request, Response, NextFunction } from 'express';
import { IApiResponse, RuleValidationError } from '../models/interfaces';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validation middleware for request parameters
 */
export class ValidationUtils {
  /**
   * Direct validation of required fields (returns validation result)
   */
  static validateRequiredFieldsSync(data: any, requiredFields: string[]): ValidationResult {
    const missingFields = requiredFields.filter(field => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });

    return {
      valid: missingFields.length === 0,
      errors: missingFields.length > 0 
        ? [`Missing required fields: ${missingFields.join(', ')}`]
        : []
    };
  }

  /**
   * Validate required fields in request body (middleware)
   */
  static validateRequiredFields(requiredFields: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const missingFields = requiredFields.filter(field => {
        const value = req.body[field];
        return value === undefined || value === null || value === '';
      });

      if (missingFields.length > 0) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Missing required fields: ${missingFields.join(', ')}`,
            details: { missingFields, providedFields: Object.keys(req.body) }
          },
          timestamp: new Date()
        };
        
        return res.status(400).json(response);
      }

      next();
      return;
    };
  }

  /**
   * Validate employee ID format
   */
  static validateEmployeeId(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    
    if (!id || !/^EMP\d{3}$/.test(id)) {
      const response: IApiResponse = {
        success: false,
        error: {
          code: 'INVALID_EMPLOYEE_ID',
          message: 'Employee ID must be in format EMP###',
          details: { provided: id, expected: 'EMP###' }
        },
        timestamp: new Date()
      };
      
      return res.status(400).json(response);
    }

    next();
    return;
  }

  /**
   * Validate UUID format for rule IDs
   */
  static validateUUID(paramName: string = 'id') {
    return (req: Request, res: Response, next: NextFunction) => {
      const id = req.params[paramName];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!id || !uuidRegex.test(id)) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'INVALID_UUID',
            message: `Invalid UUID format for parameter: ${paramName}`,
            details: { provided: id, parameter: paramName }
          },
          timestamp: new Date()
        };
        
        return res.status(400).json(response);
      }

      next();
      return;
    };
  }

  /**
   * Validate rule definition structure
   */
  static validateRuleDefinition(req: Request, res: Response, next: NextFunction) {
    const { name, type, conditions, outputValue } = req.body;

    try {
      // Validate rule type
      const validTypes = ['age', 'healthPlan', 'groupNumber'];
      if (!validTypes.includes(type)) {
        throw new RuleValidationError(`Invalid rule type. Must be one of: ${validTypes.join(', ')}`);
      }

      // Validate conditions
      if (!Array.isArray(conditions) || conditions.length === 0) {
        throw new RuleValidationError('Conditions must be a non-empty array');
      }

      // Validate each condition
      const validOperators = ['>', '>=', '<', '<=', '=', '!=', 'exists', 'in'];
      for (const condition of conditions) {
        if (!condition.field || typeof condition.field !== 'string') {
          throw new RuleValidationError('Each condition must have a valid field name');
        }
        
        if (!validOperators.includes(condition.operator)) {
          throw new RuleValidationError(`Invalid operator. Must be one of: ${validOperators.join(', ')}`);
        }
        
        if (condition.operator !== 'exists' && condition.value === undefined) {
          throw new RuleValidationError('Condition value is required for this operator');
        }
      }

      // Validate output value
      if (outputValue === undefined || outputValue === null) {
        throw new RuleValidationError('Output value is required');
      }

      next();
      return;
    } catch (error) {
      const response: IApiResponse = {
        success: false,
        error: {
          code: 'RULE_VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Invalid rule definition',
          details: { ruleData: req.body }
        },
        timestamp: new Date()
      };
      
      res.status(400).json(response);
    }
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(req: Request, res: Response, next: NextFunction) {
    const { page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    if (isNaN(pageNum) || pageNum < 1) {
      const response: IApiResponse = {
        success: false,
        error: {
          code: 'INVALID_PAGINATION',
          message: 'Page must be a positive integer',
          details: { provided: page }
        },
        timestamp: new Date()
      };
      
      res.status(400).json(response);
      return;
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      const response: IApiResponse = {
        success: false,
        error: {
          code: 'INVALID_PAGINATION',
          message: 'Limit must be between 1 and 100',
          details: { provided: limit }
        },
        timestamp: new Date()
      };
      
      res.status(400).json(response);
      return;
    }

    // Add validated values to request object
    req.query.page = pageNum.toString();
    req.query.limit = limitNum.toString();

    next();
    return;
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  static sanitizeInput(req: Request, res: Response, next: NextFunction) {
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        return value.replace(/[<>\"'%;&\(\)]/g, '');
      }
      
      if (typeof value === 'object' && value !== null) {
        const sanitized: any = Array.isArray(value) ? [] : {};
        for (const key in value) {
          sanitized[key] = sanitizeValue(value[key]);
        }
        return sanitized;
      }
      
      return value;
    };

    // Sanitize body, params, and query
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }
    
    if (req.params) {
      req.params = sanitizeValue(req.params);
    }
    
    if (req.query) {
      req.query = sanitizeValue(req.query);
    }

    next();
    return;
  }
}

export const validateRequiredFields = ValidationUtils.validateRequiredFieldsSync;
export const validateEmployeeId = ValidationUtils.validateEmployeeId;
export const validateUUID = ValidationUtils.validateUUID;
export const validateRuleDefinition = ValidationUtils.validateRuleDefinition;
export const validatePagination = ValidationUtils.validatePagination;
export const sanitizeInput = ValidationUtils.sanitizeInput;
