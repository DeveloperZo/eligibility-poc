import { v4 as uuid } from 'uuid';
import { logger } from './logger';

/**
 * DMN utility functions for validation and helper operations
 */

/**
 * Generate a unique ID for DMN elements
 */
export const generateDmnId = (prefix: string = 'dmn'): string => {
  return `${prefix}_${uuid().replace(/-/g, '_')}`;
};

/**
 * Sanitize string for DMN XML usage
 */
export const sanitizeForXml = (input: string): string => {
  if (!input) return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .trim();
};

/**
 * Validate DMN XML structure
 */
export const validateDmnXml = (xml: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  try {
    // Basic XML structure validation
    if (!xml || xml.trim().length === 0) {
      errors.push('DMN XML is empty');
      return { valid: false, errors };
    }

    // Check for required DMN elements
    const requiredElements = [
      'definitions',
      'decision',
      'decisionTable',
      'input',
      'output',
      'rule'
    ];

    for (const element of requiredElements) {
      if (!xml.includes(`<${element}`) && !xml.includes(`<dmn:${element}`)) {
        errors.push(`Missing required DMN element: ${element}`);
      }
    }

    // Check for required namespaces
    const requiredNamespaces = [
      'xmlns:dmn="https://www.omg.org/dmn"',
      'xmlns:camunda="http://camunda.org/schema/1.0/dmn"'
    ];

    for (const namespace of requiredNamespaces) {
      if (!xml.includes(namespace)) {
        errors.push(`Missing required namespace: ${namespace}`);
      }
    }

    // Check for valid hit policy
    const hitPolicyMatch = xml.match(/hitPolicy="([^"]+)"/);
    if (hitPolicyMatch) {
      const hitPolicy = hitPolicyMatch[1];
      const validHitPolicies = ['FIRST', 'UNIQUE', 'PRIORITY', 'ANY', 'COLLECT', 'RULE_ORDER', 'OUTPUT_ORDER'];
      if (!validHitPolicies.includes(hitPolicy)) {
        errors.push(`Invalid hit policy: ${hitPolicy}`);
      }
    } else {
      errors.push('Missing hit policy attribute');
    }

    // Check for proper XML structure
    const openTags = xml.match(/<[^/][^>]*>/g) || [];
    const closeTags = xml.match(/<\/[^>]+>/g) || [];
    
    if (openTags.length !== closeTags.length) {
      errors.push('Unbalanced XML tags detected');
    }

    logger.debug('DMN XML validation completed', {
      valid: errors.length === 0,
      errorCount: errors.length,
      xmlLength: xml.length
    });

    return {
      valid: errors.length === 0,
      errors
    };

  } catch (error) {
    logger.error('DMN XML validation failed:', error);
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { valid: false, errors };
  }
};

/**
 * Extract decision key from DMN XML
 */
export const extractDecisionKey = (xml: string): string | null => {
  try {
    const keyMatch = xml.match(/<(?:dmn:)?decision[^>]+id="([^"]+)"/);
    return keyMatch ? keyMatch[1] : null;
  } catch (error) {
    logger.error('Failed to extract decision key from DMN XML:', error);
    return null;
  }
};

/**
 * Extract decision name from DMN XML
 */
export const extractDecisionName = (xml: string): string | null => {
  try {
    const nameMatch = xml.match(/<(?:dmn:)?decision[^>]+name="([^"]+)"/);
    return nameMatch ? nameMatch[1] : null;
  } catch (error) {
    logger.error('Failed to extract decision name from DMN XML:', error);
    return null;
  }
};

/**
 * Generate DMN file name from rule information
 */
export const generateDmnFileName = (ruleId: string, ruleName?: string): string => {
  const sanitizedName = ruleName 
    ? sanitizeForXml(ruleName).replace(/[^a-zA-Z0-9]/g, '_')
    : 'rule';
  
  return `${sanitizedName}_${ruleId}.dmn`;
};

/**
 * Validate FEEL expression syntax (basic validation)
 */
export const validateFeelExpression = (expression: string): { valid: boolean; error?: string } => {
  if (!expression || expression.trim().length === 0) {
    return { valid: true }; // Empty expressions are allowed (default rules)
  }

  try {
    // Basic FEEL syntax validation
    const trimmed = expression.trim();
    
    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of trimmed) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        return { valid: false, error: 'Unbalanced parentheses in expression' };
      }
    }
    
    if (parenCount !== 0) {
      return { valid: false, error: 'Unbalanced parentheses in expression' };
    }

    // Check for valid operators
    const validOperators = ['>=', '<=', '>', '<', '=', '!=', 'and', 'or', 'not', 'in', 'between'];
    const hasValidOperator = validOperators.some(op => trimmed.includes(op));
    
    // Allow simple values without operators (for output values)
    const isSimpleValue = /^(true|false|"[^"]*"|\d+|\d+\.\d+)$/.test(trimmed);
    
    if (!hasValidOperator && !isSimpleValue && trimmed !== '') {
      // Check if it's a valid variable name
      const isValidVariable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed);
      if (!isValidVariable) {
        return { valid: false, error: 'Invalid FEEL expression syntax' };
      }
    }

    return { valid: true };

  } catch (error) {
    logger.error('FEEL expression validation failed:', error);
    return { 
      valid: false, 
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

/**
 * Convert rule conditions to FEEL expressions
 */
export const convertToFeelExpression = (
  field: string, 
  operator: string, 
  value: any
): string => {
  try {
    switch (operator) {
      case '>=':
      case '>':
      case '<=':
      case '<':
        return `${field} ${operator} ${value}`;
      
      case '=':
        return typeof value === 'string' ? `${field} = "${value}"` : `${field} = ${value}`;
      
      case '!=':
        return typeof value === 'string' ? `${field} != "${value}"` : `${field} != ${value}`;
      
      case 'in':
        if (Array.isArray(value)) {
          const valueList = value.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ');
          return `${field} in (${valueList})`;
        }
        return `${field} in (${value})`;
      
      case 'exists':
        return `not(${field} = null)`;
      
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return `${field} >= ${value[0]} and ${field} <= ${value[1]}`;
        }
        throw new Error('Between operator requires array with two values');
      
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  } catch (error) {
    logger.error('Failed to convert to FEEL expression:', error);
    throw error;
  }
};

/**
 * Format DMN XML with proper indentation
 */
export const formatDmnXml = (xml: string): string => {
  try {
    // Simple XML formatting
    let formatted = xml
      .replace(/></g, '>\n<')
      .replace(/\n\s*\n/g, '\n');
    
    const lines = formatted.split('\n');
    let indentLevel = 0;
    const indentSize = 2;
    
    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      const indentedLine = ' '.repeat(indentLevel * indentSize) + trimmed;
      
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
        indentLevel++;
      }
      
      return indentedLine;
    });
    
    return formattedLines.join('\n');
  } catch (error) {
    logger.warn('Failed to format DMN XML, returning original:', error);
    return xml;
  }
};

/**
 * Create DMN deployment metadata
 */
export const createDeploymentMetadata = (ruleId: string, ruleName: string) => {
  return {
    deploymentName: `Eligibility_Rule_${ruleId}`,
    deploymentSource: 'retool-middleware',
    enableDuplicateFiltering: false,
    deployChangedOnly: true,
    metadata: {
      ruleId,
      ruleName,
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      generatedBy: 'eligibility-middleware'
    }
  };
};

/**
 * Escape special characters for XML attributes
 */
export const escapeXmlAttribute = (value: string): string => {
  if (!value) return '';
  
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Extract all decision IDs from DMN XML
 */
export const extractAllDecisionIds = (xml: string): string[] => {
  try {
    const matches = xml.match(/<(?:dmn:)?decision[^>]+id="([^"]+)"/g) || [];
    return matches.map(match => {
      const idMatch = match.match(/id="([^"]+)"/);
      return idMatch ? idMatch[1] : '';
    }).filter(id => id.length > 0);
  } catch (error) {
    logger.error('Failed to extract decision IDs:', error);
    return [];
  }
};
