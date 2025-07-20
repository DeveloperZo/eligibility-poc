/**
 * DMN templates for different rule types
 * These templates define the structure for generating DMN XML
 */

export interface IDmnTemplate {
  decisionId: string;
  decisionName: string;
  decisionTableId: string;
  inputId: string;
  inputLabel: string;
  inputExpression: string;
  outputId: string;
  outputLabel: string;
  outputType: string;
  hitPolicy: 'FIRST' | 'UNIQUE' | 'PRIORITY' | 'ANY' | 'COLLECT' | 'RULE_ORDER' | 'OUTPUT_ORDER';
  rules: Array<{
    inputCondition: string;
    outputValue: string;
    description?: string;
  }>;
}

/**
 * Age validation DMN template
 */
export const createAgeRuleTemplate = (
  ruleId: string, 
  ruleName: string, 
  ageThreshold: number,
  operator: '>=' | '>' | '<=' | '<' | '=' = '>='
): IDmnTemplate => {
  return {
    decisionId: `decision_${ruleId}`,
    decisionName: ruleName || `Age Validation (${operator} ${ageThreshold})`,
    decisionTableId: `decisionTable_${ruleId}`,
    inputId: `input_age_${ruleId}`,
    inputLabel: 'Age',
    inputExpression: 'age',
    outputId: `output_eligible_${ruleId}`,
    outputLabel: 'Eligible',
    outputType: 'boolean',
    hitPolicy: 'FIRST',
    rules: [
      {
        inputCondition: `${operator} ${ageThreshold}`,
        outputValue: 'true',
        description: `Age is ${operator} ${ageThreshold} - eligible`
      },
      {
        inputCondition: '', // Default case
        outputValue: 'false',
        description: `Age requirement not met - not eligible`
      }
    ]
  };
};

/**
 * Health plan validation DMN template
 */
export const createHealthPlanRuleTemplate = (
  ruleId: string,
  ruleName: string,
  validHealthPlans: string[]
): IDmnTemplate => {
  const plansList = validHealthPlans.map(plan => `"${plan}"`).join(', ');
  
  return {
    decisionId: `decision_${ruleId}`,
    decisionName: ruleName || `Health Plan Validation`,
    decisionTableId: `decisionTable_${ruleId}`,
    inputId: `input_healthPlan_${ruleId}`,
    inputLabel: 'Health Plan',
    inputExpression: 'healthPlan',
    outputId: `output_eligible_${ruleId}`,
    outputLabel: 'Eligible',
    outputType: 'boolean',
    hitPolicy: 'FIRST',
    rules: [
      {
        inputCondition: `in(${plansList})`,
        outputValue: 'true',
        description: `Valid health plan - eligible`
      },
      {
        inputCondition: 'not(null)',
        outputValue: 'false',
        description: `Invalid or unrecognized health plan - not eligible`
      },
      {
        inputCondition: '', // Default case for null values
        outputValue: 'false',
        description: `No health plan assigned - not eligible`
      }
    ]
  };
};

/**
 * Group number validation DMN template
 */
export const createGroupNumberRuleTemplate = (
  ruleId: string,
  ruleName: string,
  validGroupNumbers: string[]
): IDmnTemplate => {
  const groupsList = validGroupNumbers.map(group => `"${group}"`).join(', ');
  
  return {
    decisionId: `decision_${ruleId}`,
    decisionName: ruleName || `Group Number Validation`,
    decisionTableId: `decisionTable_${ruleId}`,
    inputId: `input_groupNumber_${ruleId}`,
    inputLabel: 'Group Number',
    inputExpression: 'groupNumber',
    outputId: `output_eligible_${ruleId}`,
    outputLabel: 'Eligible',
    outputType: 'boolean',
    hitPolicy: 'FIRST',
    rules: [
      {
        inputCondition: `in(${groupsList})`,
        outputValue: 'true',
        description: `Valid group number - eligible`
      },
      {
        inputCondition: '', // Default case
        outputValue: 'false',
        description: `Invalid or unrecognized group number - not eligible`
      }
    ]
  };
};

/**
 * Complex eligibility rule template (combines multiple conditions)
 */
export const createComplexEligibilityTemplate = (
  ruleId: string,
  ruleName: string,
  ageThreshold: number,
  validHealthPlans: string[],
  validGroupNumbers: string[]
): IDmnTemplate => {
  const plansList = validHealthPlans.map(plan => `"${plan}"`).join(', ');
  const groupsList = validGroupNumbers.map(group => `"${group}"`).join(', ');
  
  return {
    decisionId: `decision_${ruleId}`,
    decisionName: ruleName || `Complete Eligibility Check`,
    decisionTableId: `decisionTable_${ruleId}`,
    inputId: `input_context_${ruleId}`,
    inputLabel: 'Employee Context',
    inputExpression: 'employeeContext',
    outputId: `output_eligible_${ruleId}`,
    outputLabel: 'Eligible',
    outputType: 'boolean',
    hitPolicy: 'FIRST',
    rules: [
      {
        inputCondition: `age >= ${ageThreshold} and healthPlan in (${plansList}) and groupNumber in (${groupsList})`,
        outputValue: 'true',
        description: `All eligibility criteria met - eligible`
      },
      {
        inputCondition: '', // Default case
        outputValue: 'false',
        description: `One or more eligibility criteria not met - not eligible`
      }
    ]
  };
};

/**
 * Get template by rule type
 */
export const getTemplateByRuleType = (
  ruleType: 'age' | 'healthPlan' | 'groupNumber' | 'complex',
  ruleId: string,
  ruleName: string,
  config: any
): IDmnTemplate => {
  switch (ruleType) {
    case 'age':
      return createAgeRuleTemplate(
        ruleId,
        ruleName,
        config.ageThreshold,
        config.operator
      );
    
    case 'healthPlan':
      return createHealthPlanRuleTemplate(
        ruleId,
        ruleName,
        config.validHealthPlans
      );
    
    case 'groupNumber':
      return createGroupNumberRuleTemplate(
        ruleId,
        ruleName,
        config.validGroupNumbers
      );
    
    case 'complex':
      return createComplexEligibilityTemplate(
        ruleId,
        ruleName,
        config.ageThreshold,
        config.validHealthPlans,
        config.validGroupNumbers
      );
    
    default:
      throw new Error(`Unsupported rule type: ${ruleType}`);
  }
};

/**
 * DMN namespace and schema constants
 */
export const DMN_CONSTANTS = {
  DMN_NAMESPACE: 'https://www.omg.org/dmn',
  DMN_VERSION: '1.3',
  CAMUNDA_NAMESPACE: 'http://camunda.org/schema/1.0/dmn',
  SCHEMA_LOCATION: 'https://www.omg.org/dmn https://www.omg.org/spec/DMN/20191111/dmn.xsd',
  TARGET_NAMESPACE: 'http://camunda.org/schema/1.0/dmn'
};
