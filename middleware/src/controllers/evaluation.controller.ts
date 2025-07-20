import { Request, Response, NextFunction } from 'express';
import { IApiResponse, IEligibilityRequest, IEvaluationResult, EvaluationError } from '../models/interfaces';
import { camundaService } from '../services/camunda.service';
import { dataApiService } from '../services/data-api.service';
import { logger } from '../utils/logger';
import { validateRequiredFields } from '../utils/validation';

export class EvaluationController {
  
  /**
   * Evaluate eligibility for an employee
   * POST /api/evaluate
   */
  async evaluateEligibility(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { employeeId, ruleId, context = {} } = req.body;
      
      logger.info('Starting eligibility evaluation', { employeeId, ruleId });
      
      // Validate required fields
      const validation = validateRequiredFields(req.body, ['employeeId']);
      if (!validation.valid) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required field: employeeId',
            details: validation.errors
          },
          timestamp: new Date()
        };
        return res.status(400).json(response);
      }

      const startTime = Date.now();

      // Get employee context from external data sources
      const employeeContext = await dataApiService.getEmployeeEligibilityContext(employeeId);
      
      if (!employeeContext.employee) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'EMPLOYEE_NOT_FOUND',
            message: `Employee with ID ${employeeId} not found`
          },
          timestamp: new Date()
        };
        return res.status(404).json(response);
      }

      // Prepare evaluation variables
      const evaluationVariables = {
        // Employee data
        employeeId: employeeContext.employee.id,
        employeeName: employeeContext.employee.name,
        age: employeeContext.employee.calculatedAge,
        groupNumber: employeeContext.employee.groupNumber,
        healthPlan: employeeContext.employee.healthPlan,
        department: employeeContext.employee.department,
        hireDate: employeeContext.employee.hireDate,
        
        // Derived eligibility checks
        ageEligible: employeeContext.eligibilityChecks.ageEligible,
        hasValidHealthPlan: employeeContext.eligibilityChecks.hasValidHealthPlan,
        hasValidGroup: employeeContext.eligibilityChecks.hasValidGroup,
        healthPlanGroupMatch: employeeContext.eligibilityChecks.healthPlanGroupMatch,
        
        // Additional context
        ...context
      };

      // Convert to Camunda variable format
      const camundaVariables: any = {};
      Object.entries(evaluationVariables).forEach(([key, value]) => {
        camundaVariables[key] = {
          value: value,
          type: this.inferVariableType(value)
        };
      });

      let executedRules: any[] = [];
      let overallEligible = true;
      let reasons: string[] = [];

      if (ruleId) {
        // Evaluate specific rule
        const ruleResult = await this.evaluateSpecificRule(ruleId, camundaVariables);
        executedRules.push(ruleResult);
        
        overallEligible = ruleResult.result;
        if (!ruleResult.result) {
          reasons.push(`Failed rule: ${ruleResult.ruleName}`);
        }
      } else {
        // Evaluate all active rules
        const allRulesResult = await this.evaluateAllRules(camundaVariables);
        executedRules = allRulesResult.executedRules;
        overallEligible = allRulesResult.overallEligible;
        reasons = allRulesResult.reasons;
      }

      const totalExecutionTime = Date.now() - startTime;

      const evaluationResult: IEvaluationResult = {
        employeeId,
        eligible: overallEligible,
        reasons,
        executedRules,
        totalExecutionTime,
        timestamp: new Date()
      };

      logger.info('Eligibility evaluation completed', {
        employeeId,
        eligible: overallEligible,
        rulesExecuted: executedRules.length,
        totalExecutionTime
      });

      const response: IApiResponse<IEvaluationResult> = {
        success: true,
        data: evaluationResult,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error evaluating eligibility:', error);
      next(error);
    }
  }

  /**
   * Batch evaluate eligibility for multiple employees
   * POST /api/evaluate/batch
   */
  async batchEvaluateEligibility(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { requests, ruleId } = req.body;
      
      if (!Array.isArray(requests)) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Requests must be an array of eligibility requests'
          },
          timestamp: new Date()
        };
        return res.status(400).json(response);
      }

      logger.info('Starting batch eligibility evaluation', { 
        requestCount: requests.length, 
        ruleId 
      });

      const startTime = Date.now();
      const results: IEvaluationResult[] = [];
      const errors: any[] = [];

      // Process requests in parallel (with reasonable concurrency limit)
      const BATCH_SIZE = 10;
      for (let i = 0; i < requests.length; i += BATCH_SIZE) {
        const batch = requests.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (request: IEligibilityRequest) => {
          try {
            return await this.performSingleEvaluation(request, ruleId);
          } catch (error) {
            logger.error('Error in batch item evaluation:', error);
            errors.push({
              employeeId: request.employeeId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(result => result !== null));
      }

      const totalExecutionTime = Date.now() - startTime;

      logger.info('Batch eligibility evaluation completed', {
        totalRequests: requests.length,
        successfulEvaluations: results.length,
        errors: errors.length,
        totalExecutionTime
      });

      const response: IApiResponse = {
        success: true,
        data: {
          results,
          summary: {
            totalRequests: requests.length,
            successfulEvaluations: results.length,
            eligibleCount: results.filter(r => r.eligible).length,
            ineligibleCount: results.filter(r => !r.eligible).length,
            errors: errors.length,
            totalExecutionTime,
            averageExecutionTime: results.length > 0 ? 
              results.reduce((sum, r) => sum + r.totalExecutionTime, 0) / results.length : 0
          },
          errors: errors.length > 0 ? errors : undefined
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error in batch evaluation:', error);
      next(error);
    }
  }

  /**
   * Get evaluation history for an employee
   * GET /api/evaluate/history/:employeeId
   */
  async getEvaluationHistory(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { employeeId } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      
      logger.info('Getting evaluation history', { employeeId, limit, offset });
      
      // This would typically query a database for historical evaluations
      // For now, return a placeholder response indicating this feature needs database implementation
      
      const response: IApiResponse = {
        success: true,
        data: {
          employeeId,
          history: [],
          total: 0,
          message: 'Evaluation history feature requires database implementation. This will be added in a future task.',
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: 0
          }
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error getting evaluation history:', error);
      next(error);
    }
  }

  /**
   * Evaluate a specific rule
   */
  private async evaluateSpecificRule(ruleId: string, variables: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Get decision definition
      const decisionDefinition = await camundaService.getDecisionDefinition(ruleId);
      
      if (!decisionDefinition) {
        throw new EvaluationError(`Rule ${ruleId} not found`, undefined, ruleId);
      }

      // Evaluate the decision
      const result = await camundaService.evaluateDecision(decisionDefinition.key, variables);
      
      const executionTime = Date.now() - startTime;
      
      // Extract result (assuming boolean result in first output)
      const ruleResult = result.length > 0 && result[0].eligible ? 
        result[0].eligible.value : false;

      return {
        ruleId,
        ruleName: decisionDefinition.name,
        result: ruleResult,
        executionTime,
        details: result
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        ruleId,
        ruleName: 'Unknown',
        result: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Evaluate all active rules
   */
  private async evaluateAllRules(variables: any): Promise<any> {
    try {
      // Get all decision definitions
      const decisionDefinitions = await camundaService.getDecisionDefinitions();
      
      // Filter for eligibility rules
      const eligibilityRules = decisionDefinitions.filter(def => 
        def.key.includes('eligibility') || def.key.includes('rule') || def.key.includes('_R')
      );

      const executedRules: any[] = [];
      const reasons: string[] = [];
      let overallEligible = true;

      // Evaluate each rule
      for (const rule of eligibilityRules) {
        try {
          const ruleResult = await this.evaluateSpecificRule(rule.key, variables);
          executedRules.push(ruleResult);
          
          if (!ruleResult.result) {
            overallEligible = false;
            reasons.push(`Failed rule: ${ruleResult.ruleName}`);
          }
        } catch (error) {
          logger.warn('Error evaluating rule', { ruleId: rule.key, error });
          executedRules.push({
            ruleId: rule.key,
            ruleName: rule.name,
            result: false,
            executionTime: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          overallEligible = false;
          reasons.push(`Error in rule: ${rule.name}`);
        }
      }

      return {
        executedRules,
        overallEligible,
        reasons
      };
    } catch (error) {
      logger.error('Error evaluating all rules:', error);
      throw error;
    }
  }

  /**
   * Perform single evaluation (helper for batch processing)
   */
  private async performSingleEvaluation(request: IEligibilityRequest, globalRuleId?: string): Promise<IEvaluationResult> {
    const startTime = Date.now();
    
    // Get employee context
    const employeeContext = await dataApiService.getEmployeeEligibilityContext(request.employeeId);
    
    if (!employeeContext.employee) {
      throw new EvaluationError(`Employee ${request.employeeId} not found`, request.employeeId);
    }

    // Prepare variables
    const evaluationVariables = {
      employeeId: employeeContext.employee.id,
      age: employeeContext.employee.calculatedAge,
      groupNumber: employeeContext.employee.groupNumber,
      healthPlan: employeeContext.employee.healthPlan,
      ageEligible: employeeContext.eligibilityChecks.ageEligible,
      hasValidHealthPlan: employeeContext.eligibilityChecks.hasValidHealthPlan,
      hasValidGroup: employeeContext.eligibilityChecks.hasValidGroup,
      ...request.context
    };

    // Convert to Camunda format
    const camundaVariables: any = {};
    Object.entries(evaluationVariables).forEach(([key, value]) => {
      camundaVariables[key] = {
        value: value,
        type: this.inferVariableType(value)
      };
    });

    let executedRules: any[] = [];
    let overallEligible = true;
    let reasons: string[] = [];

    const ruleId = globalRuleId || request.ruleId;
    
    if (ruleId) {
      const ruleResult = await this.evaluateSpecificRule(ruleId, camundaVariables);
      executedRules.push(ruleResult);
      overallEligible = ruleResult.result;
      if (!ruleResult.result) {
        reasons.push(`Failed rule: ${ruleResult.ruleName}`);
      }
    } else {
      const allRulesResult = await this.evaluateAllRules(camundaVariables);
      executedRules = allRulesResult.executedRules;
      overallEligible = allRulesResult.overallEligible;
      reasons = allRulesResult.reasons;
    }

    const totalExecutionTime = Date.now() - startTime;

    return {
      employeeId: request.employeeId,
      eligible: overallEligible,
      reasons,
      executedRules,
      totalExecutionTime,
      timestamp: new Date()
    };
  }

  /**
   * Helper method to infer Camunda variable type from JavaScript value
   */
  private inferVariableType(value: any): string {
    if (typeof value === 'boolean') return 'Boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'Integer' : 'Double';
    if (typeof value === 'string') return 'String';
    if (value instanceof Date) return 'Date';
    if (Array.isArray(value)) return 'Json';
    if (typeof value === 'object') return 'Json';
    return 'String';
  }
}

export const evaluationController = new EvaluationController();
