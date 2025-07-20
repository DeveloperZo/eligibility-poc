import { Request, Response, NextFunction } from 'express';
import { IApiResponse } from '../models/interfaces';
import { 
  dmnGeneratorService, 
  IDmnGenerationRequest,
  IDmnGenerationResult 
} from '../services/dmn-generator.service';
import { logger } from '../utils/logger';
import { validateRequiredFields, validateUUID } from '../utils/validation';

export class DmnController {
  
  /**
   * Generate DMN XML from rule definition
   */
  async generateDmn(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const request: IDmnGenerationRequest = req.body;
      
      const result = await dmnGeneratorService.generateDmnXml(request);
      
      const response: IApiResponse<IDmnGenerationResult> = {
        success: true,
        data: result,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate and deploy DMN to Camunda
   */
  async generateAndDeploy(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const request: IDmnGenerationRequest = req.body;
      
      const result = await dmnGeneratorService.generateAndDeploy(request);
      
      const response: IApiResponse<IDmnGenerationResult> = {
        success: true,
        data: result,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate age validation rule
   */
  async generateAgeRule(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { ruleId, ruleName, ageThreshold, operator = '>=' } = req.body;
      
      const result = await dmnGeneratorService.generateAgeRule(
        ruleId,
        ruleName,
        ageThreshold,
        operator
      );
      
      const response: IApiResponse<IDmnGenerationResult> = {
        success: true,
        data: result,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate health plan validation rule
   */
  async generateHealthPlanRule(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { ruleId, ruleName, validHealthPlans } = req.body;
      
      const result = await dmnGeneratorService.generateHealthPlanRule(
        ruleId,
        ruleName,
        validHealthPlans
      );
      
      const response: IApiResponse<IDmnGenerationResult> = {
        success: true,
        data: result,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate group number validation rule
   */
  async generateGroupNumberRule(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { ruleId, ruleName, validGroupNumbers } = req.body;
      
      const result = await dmnGeneratorService.generateGroupNumberRule(
        ruleId,
        ruleName,
        validGroupNumbers
      );
      
      const response: IApiResponse<IDmnGenerationResult> = {
        success: true,
        data: result,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test DMN XML
   */
  async testDmn(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { dmnXml, testVariables = {} } = req.body;
      
      const result = await dmnGeneratorService.testDmnXml(dmnXml, testVariables);
      
      const response: IApiResponse = {
        success: true,
        data: result,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate custom DMN with FEEL expressions
   */
  async generateCustomDmn(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { ruleId, ruleName, inputExpression, inputLabel, rules } = req.body;
      
      const result = await dmnGeneratorService.generateCustomDmn(
        ruleId,
        ruleName,
        inputExpression,
        inputLabel,
        rules
      );
      
      const response: IApiResponse<IDmnGenerationResult> = {
        success: true,
        data: result,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Batch generate multiple DMN rules
   */
  async batchGenerate(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { requests } = req.body;
      
      if (!Array.isArray(requests)) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Requests must be an array'
          },
          timestamp: new Date()
        };
        return res.status(400).json(response);
      }
      
      const results = await dmnGeneratorService.batchGenerateDmn(requests);
      
      const response: IApiResponse<IDmnGenerationResult[]> = {
        success: true,
        data: results,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get DMN generation templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const templates = {
        age: {
          ruleType: 'age',
          description: 'Validates employee age against a threshold',
          requiredFields: ['ruleId', 'ruleName', 'ageThreshold'],
          optionalFields: ['operator'],
          example: {
            ruleId: 'AGE_001',
            ruleName: 'Minimum Age 18',
            ruleType: 'age',
            configuration: {
              ageThreshold: 18,
              operator: '>='
            }
          }
        },
        healthPlan: {
          ruleType: 'healthPlan',
          description: 'Validates employee health plan membership',
          requiredFields: ['ruleId', 'ruleName', 'validHealthPlans'],
          example: {
            ruleId: 'HP_001',
            ruleName: 'Valid Health Plans',
            ruleType: 'healthPlan',
            configuration: {
              validHealthPlans: ['PLAN-A', 'PLAN-B', 'PLAN-C']
            }
          }
        },
        groupNumber: {
          ruleType: 'groupNumber',
          description: 'Validates employee group number',
          requiredFields: ['ruleId', 'ruleName', 'validGroupNumbers'],
          example: {
            ruleId: 'GRP_001',
            ruleName: 'Valid Groups',
            ruleType: 'groupNumber',
            configuration: {
              validGroupNumbers: ['GRP-100', 'GRP-200', 'GRP-300']
            }
          }
        },
        complex: {
          ruleType: 'complex',
          description: 'Combines age, health plan, and group validation',
          requiredFields: ['ruleId', 'ruleName', 'ageThreshold', 'validHealthPlans', 'validGroupNumbers'],
          example: {
            ruleId: 'COMP_001',
            ruleName: 'Complete Eligibility Check',
            ruleType: 'complex',
            configuration: {
              ageThreshold: 18,
              validHealthPlans: ['PLAN-A', 'PLAN-B'],
              validGroupNumbers: ['GRP-100', 'GRP-200']
            }
          }
        }
      };
      
      const response: IApiResponse = {
        success: true,
        data: {
          templates,
          supportedOperators: ['>=', '>', '<=', '<', '=', '!=', 'in', 'exists'],
          hitPolicies: ['FIRST', 'UNIQUE', 'PRIORITY', 'ANY', 'COLLECT', 'RULE_ORDER', 'OUTPUT_ORDER'],
          outputTypes: ['boolean', 'string', 'number']
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate DMN XML
   */
  async validateDmn(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { dmnXml } = req.body;
      
      if (!dmnXml) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'MISSING_DMN_XML',
            message: 'DMN XML is required'
          },
          timestamp: new Date()
        };
        return res.status(400).json(response);
      }
      
      // Import validation function
      const { validateDmnXml, extractDecisionKey, extractDecisionName } = await import('../utils/dmn-utils');
      
      const validation = validateDmnXml(dmnXml);
      const decisionKey = extractDecisionKey(dmnXml);
      const decisionName = extractDecisionName(dmnXml);
      
      const response: IApiResponse = {
        success: validation.valid,
        data: {
          valid: validation.valid,
          errors: validation.errors,
          decisionKey,
          decisionName,
          xmlLength: dmnXml.length
        },
        timestamp: new Date()
      };
      
      if (!validation.valid) {
        res.status(400);
      }
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate sample DMN for testing
   */
  async generateSample(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { ruleType = 'age' } = req.query;
      
      let sampleRequest: IDmnGenerationRequest;
      
      switch (ruleType) {
        case 'age':
          sampleRequest = {
            ruleId: 'SAMPLE_AGE_001',
            ruleName: 'Sample Age Rule (18+)',
            ruleType: 'age',
            configuration: {
              ageThreshold: 18,
              operator: '>='
            },
            metadata: {
              description: 'Sample age validation rule for testing',
              createdBy: 'system',
              version: '1.0.0'
            }
          };
          break;
          
        case 'healthPlan':
          sampleRequest = {
            ruleId: 'SAMPLE_HP_001',
            ruleName: 'Sample Health Plan Rule',
            ruleType: 'healthPlan',
            configuration: {
              validHealthPlans: ['PLAN-A', 'PLAN-B']
            },
            metadata: {
              description: 'Sample health plan validation rule for testing',
              createdBy: 'system',
              version: '1.0.0'
            }
          };
          break;
          
        case 'groupNumber':
          sampleRequest = {
            ruleId: 'SAMPLE_GRP_001',
            ruleName: 'Sample Group Rule',
            ruleType: 'groupNumber',
            configuration: {
              validGroupNumbers: ['GRP-100', 'GRP-200']
            },
            metadata: {
              description: 'Sample group number validation rule for testing',
              createdBy: 'system',
              version: '1.0.0'
            }
          };
          break;
          
        default:
          const response: IApiResponse = {
            success: false,
            error: {
              code: 'INVALID_RULE_TYPE',
              message: 'Supported rule types: age, healthPlan, groupNumber'
            },
            timestamp: new Date()
          };
          return res.status(400).json(response);
      }
      
      const result = await dmnGeneratorService.generateDmnXml(sampleRequest);
      
      const response: IApiResponse<IDmnGenerationResult> = {
        success: true,
        data: result,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const dmnController = new DmnController();
