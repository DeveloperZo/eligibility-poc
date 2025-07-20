import { v4 as uuid } from 'uuid';
import { 
  IRuleDefinition, 
  ICamundaDeployment,
  RuleValidationError 
} from '../models/interfaces';
import { 
  IDmnTemplate, 
  getTemplateByRuleType, 
  DMN_CONSTANTS 
} from '../templates/dmn-templates';
import { 
  validateDmnXml, 
  generateDmnId, 
  formatDmnXml, 
  generateDmnFileName,
  createDeploymentMetadata,
  escapeXmlAttribute,
  validateFeelExpression,
  convertToFeelExpression
} from '../utils/dmn-utils';
import { camundaService } from './camunda.service';
import { logger } from '../utils/logger';

export interface IDmnGenerationRequest {
  ruleId: string;
  ruleName: string;
  ruleType: 'age' | 'healthPlan' | 'groupNumber' | 'complex';
  configuration: {
    ageThreshold?: number;
    operator?: '>=' | '>' | '<=' | '<' | '=';
    validHealthPlans?: string[];
    validGroupNumbers?: string[];
  };
  metadata?: {
    description?: string;
    createdBy?: string;
    version?: string;
  };
}

export interface IDmnGenerationResult {
  dmnXml: string;
  decisionKey: string;
  fileName: string;
  validation: {
    valid: boolean;
    errors: string[];
  };
  deployment?: ICamundaDeployment;
}

export class DmnGeneratorService {
  
  /**
   * Generate DMN XML from rule definition
   */
  async generateDmnXml(request: IDmnGenerationRequest): Promise<IDmnGenerationResult> {
    try {
      logger.info(`Generating DMN XML for rule: ${request.ruleId}`, {
        ruleType: request.ruleType,
        ruleName: request.ruleName
      });

      // Validate input
      this.validateGenerationRequest(request);

      // Create DMN template
      const template = getTemplateByRuleType(
        request.ruleType,
        request.ruleId,
        request.ruleName,
        request.configuration
      );

      // Generate XML from template
      const dmnXml = this.generateXmlFromTemplate(template, request.metadata);

      // Validate generated XML
      const validation = validateDmnXml(dmnXml);

      // Format XML for readability
      const formattedXml = formatDmnXml(dmnXml);

      const result: IDmnGenerationResult = {
        dmnXml: formattedXml,
        decisionKey: template.decisionId,
        fileName: generateDmnFileName(request.ruleId, request.ruleName),
        validation
      };

      if (!validation.valid) {
        logger.warn(`Generated DMN XML has validation errors:`, validation.errors);
        throw new RuleValidationError(`DMN XML validation failed: ${validation.errors.join(', ')}`);
      }

      logger.info(`DMN XML generated successfully for rule: ${request.ruleId}`, {
        decisionKey: result.decisionKey,
        xmlLength: result.dmnXml.length
      });

      return result;

    } catch (error) {
      logger.error(`Failed to generate DMN XML for rule: ${request.ruleId}`, error);
      throw error;
    }
  }

  /**
   * Generate and deploy DMN to Camunda
   */
  async generateAndDeploy(request: IDmnGenerationRequest): Promise<IDmnGenerationResult> {
    try {
      // Generate DMN XML
      const result = await this.generateDmnXml(request);

      // Deploy to Camunda
      const deployment = await camundaService.deployDmn(
        result.fileName,
        result.dmnXml,
        createDeploymentMetadata(request.ruleId, request.ruleName).deploymentName
      );

      result.deployment = deployment;

      logger.info(`DMN deployed successfully to Camunda:`, {
        ruleId: request.ruleId,
        deploymentId: deployment.id,
        decisionKey: result.decisionKey
      });

      return result;

    } catch (error) {
      logger.error(`Failed to generate and deploy DMN for rule: ${request.ruleId}`, error);
      throw error;
    }
  }

  /**
   * Generate age validation rule
   */
  async generateAgeRule(
    ruleId: string,
    ruleName: string,
    ageThreshold: number,
    operator: '>=' | '>' | '<=' | '<' | '=' = '>='
  ): Promise<IDmnGenerationResult> {
    return this.generateDmnXml({
      ruleId,
      ruleName,
      ruleType: 'age',
      configuration: {
        ageThreshold,
        operator
      }
    });
  }

  /**
   * Generate health plan validation rule
   */
  async generateHealthPlanRule(
    ruleId: string,
    ruleName: string,
    validHealthPlans: string[]
  ): Promise<IDmnGenerationResult> {
    return this.generateDmnXml({
      ruleId,
      ruleName,
      ruleType: 'healthPlan',
      configuration: {
        validHealthPlans
      }
    });
  }

  /**
   * Generate group number validation rule
   */
  async generateGroupNumberRule(
    ruleId: string,
    ruleName: string,
    validGroupNumbers: string[]
  ): Promise<IDmnGenerationResult> {
    return this.generateDmnXml({
      ruleId,
      ruleName,
      ruleType: 'groupNumber',
      configuration: {
        validGroupNumbers
      }
    });
  }

  /**
   * Validate generation request
   */
  private validateGenerationRequest(request: IDmnGenerationRequest): void {
    if (!request.ruleId || request.ruleId.trim().length === 0) {
      throw new RuleValidationError('Rule ID is required');
    }

    if (!request.ruleName || request.ruleName.trim().length === 0) {
      throw new RuleValidationError('Rule name is required');
    }

    if (!['age', 'healthPlan', 'groupNumber', 'complex'].includes(request.ruleType)) {
      throw new RuleValidationError(`Invalid rule type: ${request.ruleType}`);
    }

    // Validate rule-specific configuration
    switch (request.ruleType) {
      case 'age':
        if (request.configuration.ageThreshold === undefined || request.configuration.ageThreshold < 0) {
          throw new RuleValidationError('Valid age threshold is required for age rules');
        }
        break;

      case 'healthPlan':
        if (!request.configuration.validHealthPlans || request.configuration.validHealthPlans.length === 0) {
          throw new RuleValidationError('Valid health plans list is required for health plan rules');
        }
        break;

      case 'groupNumber':
        if (!request.configuration.validGroupNumbers || request.configuration.validGroupNumbers.length === 0) {
          throw new RuleValidationError('Valid group numbers list is required for group number rules');
        }
        break;

      case 'complex':
        if (!request.configuration.ageThreshold || 
            !request.configuration.validHealthPlans || 
            !request.configuration.validGroupNumbers) {
          throw new RuleValidationError('Complete configuration is required for complex rules');
        }
        break;
    }
  }

  /**
   * Generate XML from DMN template
   */
  private generateXmlFromTemplate(template: IDmnTemplate, metadata?: any): string {
    const definitionsId = generateDmnId('definitions');
    const namespace = DMN_CONSTANTS.TARGET_NAMESPACE;
    
    // Build XML structure
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<definitions xmlns="${DMN_CONSTANTS.DMN_NAMESPACE}" `;
    xml += `xmlns:camunda="${DMN_CONSTANTS.CAMUNDA_NAMESPACE}" `;
    xml += `id="${definitionsId}" `;
    xml += `name="Eligibility Rules" `;
    xml += `namespace="${namespace}" `;
    xml += `exporter="eligibility-middleware" `;
    xml += `exporterVersion="1.0.0">\n`;

    // Decision element
    xml += `  <decision id="${escapeXmlAttribute(template.decisionId)}" `;
    xml += `name="${escapeXmlAttribute(template.decisionName)}">\n`;

    // Decision table
    xml += `    <decisionTable id="${escapeXmlAttribute(template.decisionTableId)}" `;
    xml += `hitPolicy="${template.hitPolicy}">\n`;

    // Input
    xml += `      <input id="${escapeXmlAttribute(template.inputId)}" `;
    xml += `label="${escapeXmlAttribute(template.inputLabel)}">\n`;
    xml += `        <inputExpression id="${generateDmnId('inputExpression')}" `;
    xml += `typeRef="string">\n`;
    xml += `          <text>${escapeXmlAttribute(template.inputExpression)}</text>\n`;
    xml += `        </inputExpression>\n`;
    xml += `      </input>\n`;

    // Output
    xml += `      <output id="${escapeXmlAttribute(template.outputId)}" `;
    xml += `label="${escapeXmlAttribute(template.outputLabel)}" `;
    xml += `name="eligible" `;
    xml += `typeRef="${template.outputType}" />\n`;

    // Rules
    template.rules.forEach((rule, index) => {
      const ruleId = generateDmnId('rule');
      xml += `      <rule id="${ruleId}">\n`;
      
      if (rule.description) {
        xml += `        <description>${escapeXmlAttribute(rule.description)}</description>\n`;
      }

      // Input entry
      xml += `        <inputEntry id="${generateDmnId('inputEntry')}">\n`;
      if (rule.inputCondition) {
        // Validate FEEL expression
        const validation = validateFeelExpression(rule.inputCondition);
        if (!validation.valid) {
          throw new RuleValidationError(`Invalid FEEL expression in rule ${index + 1}: ${validation.error}`);
        }
        xml += `          <text>${escapeXmlAttribute(rule.inputCondition)}</text>\n`;
      } else {
        xml += `          <text></text>\n`; // Default/catch-all rule
      }
      xml += `        </inputEntry>\n`;

      // Output entry
      xml += `        <outputEntry id="${generateDmnId('outputEntry')}">\n`;
      xml += `          <text>${escapeXmlAttribute(rule.outputValue)}</text>\n`;
      xml += `        </outputEntry>\n`;

      xml += `      </rule>\n`;
    });

    xml += `    </decisionTable>\n`;
    xml += `  </decision>\n`;
    xml += `</definitions>`;

    return xml;
  }

  /**
   * Convert IRuleDefinition to DMN generation request
   */
  convertRuleDefinitionToRequest(ruleDefinition: IRuleDefinition): IDmnGenerationRequest {
    const request: IDmnGenerationRequest = {
      ruleId: ruleDefinition.id,
      ruleName: ruleDefinition.name,
      ruleType: ruleDefinition.type,
      configuration: {},
      metadata: {
        description: ruleDefinition.description,
        createdBy: ruleDefinition.createdBy,
        version: '1.0.0'
      }
    };

    // Convert conditions to configuration
    switch (ruleDefinition.type) {
      case 'age':
        const ageCondition = ruleDefinition.conditions.find(c => c.field === 'age');
        if (ageCondition) {
          request.configuration.ageThreshold = Number(ageCondition.value);
          request.configuration.operator = ageCondition.operator as any;
        }
        break;

      case 'healthPlan':
        const healthPlanCondition = ruleDefinition.conditions.find(c => c.field === 'healthPlan');
        if (healthPlanCondition && healthPlanCondition.operator === 'in') {
          request.configuration.validHealthPlans = Array.isArray(healthPlanCondition.value) 
            ? healthPlanCondition.value 
            : [healthPlanCondition.value];
        }
        break;

      case 'groupNumber':
        const groupCondition = ruleDefinition.conditions.find(c => c.field === 'groupNumber');
        if (groupCondition && groupCondition.operator === 'in') {
          request.configuration.validGroupNumbers = Array.isArray(groupCondition.value) 
            ? groupCondition.value 
            : [groupCondition.value];
        }
        break;
    }

    return request;
  }

  /**
   * Test DMN XML by deploying to a test namespace
   */
  async testDmnXml(dmnXml: string, testVariables: any = {}): Promise<any> {
    try {
      // Extract decision key
      const decisionKeyMatch = dmnXml.match(/<(?:dmn:)?decision[^>]+id="([^"]+)"/);
      if (!decisionKeyMatch) {
        throw new Error('Could not extract decision key from DMN XML');
      }
      
      const decisionKey = decisionKeyMatch[1];
      const testFileName = `test_${decisionKey}_${Date.now()}.dmn`;
      
      // Deploy temporarily
      const deployment = await camundaService.deployDmn(
        testFileName,
        dmnXml,
        `TEST_${Date.now()}`
      );
      
      try {
        // Test evaluation with provided variables or default test data
        const defaultTestVars = {
          age: 25,
          healthPlan: 'PLAN-A',
          groupNumber: 'GRP-100'
        };
        
        const testVars = { ...defaultTestVars, ...testVariables };
        
        const result = await camundaService.evaluateDmn(decisionKey, testVars);
        
        return {
          success: true,
          result,
          deploymentId: deployment.id,
          testVariables: testVars
        };
        
      } finally {
        // Clean up test deployment
        try {
          await camundaService.deleteDeployment(deployment.id, true);
        } catch (cleanupError) {
          logger.warn('Failed to clean up test deployment:', cleanupError);
        }
      }
      
    } catch (error) {
      logger.error('DMN XML test failed:', error);
      throw error;
    }
  }

  /**
   * Generate DMN with custom FEEL expressions
   */
  async generateCustomDmn(
    ruleId: string,
    ruleName: string,
    inputExpression: string,
    inputLabel: string,
    rules: Array<{
      condition: string;
      output: string;
      description?: string;
    }>
  ): Promise<IDmnGenerationResult> {
    try {
      // Validate input expressions
      const inputValidation = validateFeelExpression(inputExpression);
      if (!inputValidation.valid) {
        throw new RuleValidationError(`Invalid input expression: ${inputValidation.error}`);
      }

      // Validate rule conditions
      for (const rule of rules) {
        const conditionValidation = validateFeelExpression(rule.condition);
        if (!conditionValidation.valid) {
          throw new RuleValidationError(`Invalid rule condition "${rule.condition}": ${conditionValidation.error}`);
        }
        
        const outputValidation = validateFeelExpression(rule.output);
        if (!outputValidation.valid) {
          throw new RuleValidationError(`Invalid rule output "${rule.output}": ${outputValidation.error}`);
        }
      }

      // Create custom template
      const template: IDmnTemplate = {
        decisionId: `decision_${ruleId}`,
        decisionName: ruleName,
        decisionTableId: `decisionTable_${ruleId}`,
        inputId: `input_${ruleId}`,
        inputLabel: inputLabel,
        inputExpression: inputExpression,
        outputId: `output_${ruleId}`,
        outputLabel: 'Result',
        outputType: 'boolean',
        hitPolicy: 'FIRST',
        rules: rules.map(rule => ({
          inputCondition: rule.condition,
          outputValue: rule.output,
          description: rule.description
        }))
      };

      // Generate XML
      const dmnXml = this.generateXmlFromTemplate(template);
      const validation = validateDmnXml(dmnXml);
      const formattedXml = formatDmnXml(dmnXml);

      return {
        dmnXml: formattedXml,
        decisionKey: template.decisionId,
        fileName: generateDmnFileName(ruleId, ruleName),
        validation
      };

    } catch (error) {
      logger.error(`Failed to generate custom DMN for rule: ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * Batch generate multiple DMN rules
   */
  async batchGenerateDmn(requests: IDmnGenerationRequest[]): Promise<IDmnGenerationResult[]> {
    const results: IDmnGenerationResult[] = [];
    const errors: Array<{ ruleId: string; error: Error }> = [];

    for (const request of requests) {
      try {
        const result = await this.generateDmnXml(request);
        results.push(result);
        
        logger.info(`Successfully generated DMN for rule: ${request.ruleId}`);
      } catch (error) {
        logger.error(`Failed to generate DMN for rule: ${request.ruleId}`, error);
        errors.push({
          ruleId: request.ruleId,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }

    if (errors.length > 0) {
      logger.warn(`Batch DMN generation completed with ${errors.length} errors:`, 
        errors.map(e => ({ ruleId: e.ruleId, message: e.error.message }))
      );
    }

    return results;
  }
}

export const dmnGeneratorService = new DmnGeneratorService();
