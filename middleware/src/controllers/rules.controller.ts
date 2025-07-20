import { Request, Response, NextFunction } from 'express';
import { IApiResponse, IRuleDefinition, RuleValidationError } from '../models/interfaces';
import { dmnGeneratorService, IDmnGenerationRequest } from '../services/dmn-generator.service';
import { camundaService } from '../services/camunda.service';
import { logger } from '../utils/logger';
import { validateRequiredFields } from '../utils/validation';

export class RulesController {
  
  /**
   * Create a new rule and deploy to Camunda
   * POST /api/rules/create
   */
  async createRule(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      logger.info('Creating new rule', { body: req.body });
      
      const { ruleId, ruleName, ruleType, configuration, metadata } = req.body;
      
      // Validate required fields
      const validation = validateRequiredFields(req.body, ['ruleId', 'ruleName', 'ruleType', 'configuration']);
      if (!validation.valid) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
            details: validation.errors
          },
          timestamp: new Date()
        };
        return res.status(400).json(response);
      }

      // Validate rule type
      const validRuleTypes = ['age', 'healthPlan', 'groupNumber', 'complex'];
      if (!validRuleTypes.includes(ruleType)) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'INVALID_RULE_TYPE',
            message: `Rule type must be one of: ${validRuleTypes.join(', ')}`
          },
          timestamp: new Date()
        };
        return res.status(400).json(response);
      }

      // Create DMN generation request
      const dmnRequest: IDmnGenerationRequest = {
        ruleId,
        ruleName,
        ruleType,
        configuration,
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          createdBy: req.body.createdBy || 'api'
        }
      };

      // Generate and deploy DMN
      const result = await dmnGeneratorService.generateAndDeploy(dmnRequest);
      
      logger.info('Rule created and deployed successfully', { 
        ruleId, 
        deploymentId: result.deployment?.id 
      });

      const response: IApiResponse = {
        success: true,
        data: {
          ruleId,
          ruleName,
          ruleType,
          deploymentId: result.deployment?.id,
          dmnKey: result.decisionKey,
          status: 'deployed',
          createdAt: new Date(),
          ...result
        },
        timestamp: new Date()
      };
      
      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating rule:', error);
      next(error);
    }
  }

  /**
   * List all deployed rules
   * GET /api/rules
   */
  async listRules(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      logger.info('Listing all deployed rules');
      
      // Get decision definitions from Camunda
      const decisionDefinitions = await camundaService.getDecisionDefinitions();
      
      // Filter for our eligibility rules (by key pattern)
      const eligibilityRules = decisionDefinitions.filter(def => 
        def.key.includes('eligibility') || def.key.includes('rule') || def.key.includes('_R')
      );

      // Get deployments for additional metadata
      const deployments = await camundaService.getDeployments();
      
      // Enrich rules with deployment information
      const enrichedRules = eligibilityRules.map(rule => {
        const deployment = deployments.find(dep => dep.id === rule.deploymentId);
        return {
          id: rule.id,
          ruleId: rule.key,
          ruleName: rule.name,
          version: rule.version,
          deploymentId: rule.deploymentId,
          deploymentTime: deployment?.deploymentTime,
          deploymentName: deployment?.name,
          resource: rule.resource,
          category: rule.category,
          status: 'deployed',
          tenantId: rule.tenantId
        };
      });

      const response: IApiResponse = {
        success: true,
        data: {
          rules: enrichedRules,
          total: enrichedRules.length,
          summary: {
            totalRules: enrichedRules.length,
            byVersion: this.groupByVersion(enrichedRules),
            latestDeployment: enrichedRules.length > 0 ? 
              Math.max(...enrichedRules.map(r => new Date(r.deploymentTime || 0).getTime())) : null
          }
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error listing rules:', error);
      next(error);
    }
  }

  /**
   * Get specific rule by ID
   * GET /api/rules/:id
   */
  async getRule(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      logger.info('Getting rule by ID', { ruleId: id });
      
      // Get decision definition by ID or key
      const decisionDefinition = await camundaService.getDecisionDefinition(id);
      
      if (!decisionDefinition) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'RULE_NOT_FOUND',
            message: `Rule with ID ${id} not found`
          },
          timestamp: new Date()
        };
        return res.status(404).json(response);
      }

      // Get deployment information
      const deployments = await camundaService.getDeployments();
      const deployment = deployments.find(dep => dep.id === decisionDefinition.deploymentId);

      const response: IApiResponse = {
        success: true,
        data: {
          id: decisionDefinition.id,
          ruleId: decisionDefinition.key,
          ruleName: decisionDefinition.name,
          version: decisionDefinition.version,
          deploymentId: decisionDefinition.deploymentId,
          deploymentTime: deployment?.deploymentTime,
          deploymentName: deployment?.name,
          resource: decisionDefinition.resource,
          category: decisionDefinition.category,
          status: 'deployed',
          tenantId: decisionDefinition.tenantId
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error getting rule:', error);
      next(error);
    }
  }

  /**
   * Delete a rule (remove deployment from Camunda)
   * DELETE /api/rules/:id
   */
  async deleteRule(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const { cascade = true } = req.query;
      
      logger.info('Deleting rule', { ruleId: id, cascade });
      
      // First check if rule exists
      const decisionDefinition = await camundaService.getDecisionDefinition(id);
      
      if (!decisionDefinition) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'RULE_NOT_FOUND',
            message: `Rule with ID ${id} not found`
          },
          timestamp: new Date()
        };
        return res.status(404).json(response);
      }

      // Delete the deployment
      await camundaService.deleteDeployment(decisionDefinition.deploymentId, cascade === 'true');
      
      logger.info('Rule deleted successfully', { 
        ruleId: id, 
        deploymentId: decisionDefinition.deploymentId 
      });

      const response: IApiResponse = {
        success: true,
        data: {
          ruleId: id,
          deploymentId: decisionDefinition.deploymentId,
          status: 'deleted',
          deletedAt: new Date()
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error deleting rule:', error);
      next(error);
    }
  }

  /**
   * Test a rule with sample data
   * POST /api/rules/:id/test
   */
  async testRule(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const { testData = {}, variables = {} } = req.body;
      
      logger.info('Testing rule', { ruleId: id, testData });
      
      // Get decision definition
      const decisionDefinition = await camundaService.getDecisionDefinition(id);
      
      if (!decisionDefinition) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'RULE_NOT_FOUND',
            message: `Rule with ID ${id} not found`
          },
          timestamp: new Date()
        };
        return res.status(404).json(response);
      }

      // Prepare evaluation variables
      const evaluationVariables = {
        ...testData,
        ...variables
      };

      // Convert to Camunda variable format
      const camundaVariables: any = {};
      Object.entries(evaluationVariables).forEach(([key, value]) => {
        camundaVariables[key] = {
          value: value,
          type: this.inferVariableType(value)
        };
      });

      const startTime = Date.now();
      
      // Evaluate the decision
      const result = await camundaService.evaluateDecision(
        decisionDefinition.key,
        camundaVariables
      );
      
      const executionTime = Date.now() - startTime;
      
      logger.info('Rule test completed', { 
        ruleId: id, 
        executionTime, 
        result: result.length 
      });

      const response: IApiResponse = {
        success: true,
        data: {
          ruleId: id,
          ruleName: decisionDefinition.name,
          testData: evaluationVariables,
          result: result,
          executionTime,
          timestamp: new Date(),
          metadata: {
            decisionKey: decisionDefinition.key,
            version: decisionDefinition.version,
            deploymentId: decisionDefinition.deploymentId
          }
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error testing rule:', error);
      next(error);
    }
  }

  /**
   * Update an existing rule
   * PUT /api/rules/:id
   */
  async updateRule(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const { ruleName, configuration, metadata } = req.body;
      
      logger.info('Updating rule', { ruleId: id, updates: req.body });
      
      // Get existing rule
      const existingRule = await camundaService.getDecisionDefinition(id);
      
      if (!existingRule) {
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'RULE_NOT_FOUND',
            message: `Rule with ID ${id} not found`
          },
          timestamp: new Date()
        };
        return res.status(404).json(response);
      }

      // For updates, we need to create a new deployment with updated configuration
      // This is because Camunda doesn't support in-place updates of decision definitions
      
      // Create new DMN generation request with updated data
      const dmnRequest: IDmnGenerationRequest = {
        ruleId: id,
        ruleName: ruleName || existingRule.name,
        ruleType: 'age', // This should be extracted from existing rule metadata
        configuration: configuration || {},
        metadata: {
          ...metadata,
          updatedAt: new Date().toISOString(),
          updatedBy: req.body.updatedBy || 'api',
          previousVersion: existingRule.version
        }
      };

      // Generate and deploy new version
      const result = await dmnGeneratorService.generateAndDeploy(dmnRequest);
      
      logger.info('Rule updated successfully', { 
        ruleId: id, 
        newDeploymentId: result.deployment?.id,
        previousVersion: existingRule.version
      });

      const response: IApiResponse = {
        success: true,
        data: {
          ruleId: id,
          ruleName: ruleName || existingRule.name,
          deploymentId: result.deployment?.id,
          dmnKey: result.decisionKey,
          status: 'updated',
          version: existingRule.version + 1,
          updatedAt: new Date(),
          previousVersion: existingRule.version,
          ...result
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Error updating rule:', error);
      next(error);
    }
  }

  /**
   * Helper method to group rules by version
   */
  private groupByVersion(rules: any[]): { [version: string]: number } {
    return rules.reduce((acc, rule) => {
      const version = `v${rule.version}`;
      acc[version] = (acc[version] || 0) + 1;
      return acc;
    }, {});
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

export const rulesController = new RulesController();
