import { logger } from '../utils/logger';

export interface IWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'approval' | 'review' | 'notification' | 'complex';
  parameters: ITemplateParameter[];
  bpmnTemplate: string;
}

export interface ITemplateParameter {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  default?: any;
  options?: Array<{ value: string; label: string }>; 
}

export class WorkflowTemplateService {
  private templates: Map<string, IWorkflowTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Simple Approval Template
    this.templates.set('simple-approval', {
      id: 'simple-approval',
      name: 'Simple Approval',
      description: 'Single-step approval process',
      category: 'approval',
      parameters: [
        { key: 'processName', label: 'Process Name', type: 'string', required: true, default: 'Simple Approval Process' },
        { key: 'approverRole', label: 'Approver Role', type: 'select', required: true, options: [
          { value: 'manager', label: 'Manager' },
          { value: 'director', label: 'Director' },
          { value: 'vp', label: 'Vice President' },
          { value: 'admin', label: 'Administrator' }
        ], default: 'manager' },
        { key: 'escalationHours', label: 'Escalation Time (hours)', type: 'number', required: false, default: 48 }
      ],
      bpmnTemplate: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <bpmn:process id="{{processId}}" name="{{processName}}" isExecutable="true">
    <bpmn:startEvent id="Start" name="Request Submitted">
      <bpmn:outgoing>Flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="Flow1" sourceRef="Start" targetRef="ApprovalTask" />
    <bpmn:userTask id="ApprovalTask" name="Approve Request" camunda:assignee="{{approverRole}}">
      <bpmn:incoming>Flow1</bpmn:incoming>
      <bpmn:outgoing>Flow2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow2" sourceRef="ApprovalTask" targetRef="End" />
    <bpmn:endEvent id="End" name="Request Processed">
      <bpmn:incoming>Flow2</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>`
    });

    // Benefit Plan Approval Template
    this.templates.set('benefit-plan-approval', {
      id: 'benefit-plan-approval',
      name: 'Benefit Plan Approval',
      description: 'Specialized workflow for benefit plan approvals',
      category: 'approval',
      parameters: [
        { key: 'processName', label: 'Process Name', type: 'string', required: true, default: 'Benefit Plan Approval' },
        { key: 'planType', label: 'Plan Type', type: 'select', required: true, options: [
          { value: 'medical', label: 'Medical' },
          { value: 'dental', label: 'Dental' },
          { value: 'vision', label: 'Vision' },
          { value: 'life', label: 'Life Insurance' }
        ], default: 'medical' },
        { key: 'requiresCompliance', label: 'Requires Compliance Review', type: 'boolean', required: false, default: true }
      ],
      bpmnTemplate: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <bpmn:process id="{{processId}}" name="{{processName}}" isExecutable="true">
    <bpmn:startEvent id="Start" name="Plan Submitted">
      <bpmn:outgoing>Flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="InitialReview" name="Initial Plan Review" camunda:assignee="benefits-team">
      <bpmn:documentation>Review {{planType}} plan submission</bpmn:documentation>
      <bpmn:incoming>Flow1</bpmn:incoming>
      <bpmn:outgoing>Flow2</bpmn:outgoing>
    </bpmn:userTask>
    {{#if requiresCompliance}}
    <bpmn:userTask id="ComplianceReview" name="Compliance Review" camunda:assignee="compliance-team">
      <bpmn:incoming>Flow2</bpmn:incoming>
      <bpmn:outgoing>Flow3</bpmn:outgoing>
    </bpmn:userTask>
    {{/if}}
    <bpmn:userTask id="FinalApproval" name="Final Approval" camunda:assignee="benefits-director">
      <bpmn:incoming>{{#if requiresCompliance}}Flow3{{else}}Flow2{{/if}}</bpmn:incoming>
      <bpmn:outgoing>Flow4</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:serviceTask id="ActivatePlan" name="Activate Plan" camunda:type="external" camunda:topic="activate-plan">
      <bpmn:incoming>Flow4</bpmn:incoming>
      <bpmn:outgoing>Flow5</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="End" name="Plan Activated">
      <bpmn:incoming>Flow5</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow1" sourceRef="Start" targetRef="InitialReview" />
    <bpmn:sequenceFlow id="Flow2" sourceRef="InitialReview" targetRef="{{#if requiresCompliance}}ComplianceReview{{else}}FinalApproval{{/if}}" />
    {{#if requiresCompliance}}
    <bpmn:sequenceFlow id="Flow3" sourceRef="ComplianceReview" targetRef="FinalApproval" />
    {{/if}}
    <bpmn:sequenceFlow id="Flow4" sourceRef="FinalApproval" targetRef="ActivatePlan" />
    <bpmn:sequenceFlow id="Flow5" sourceRef="ActivatePlan" targetRef="End" />
  </bpmn:process>
</bpmn:definitions>`
    });

    logger.info(`Initialized ${this.templates.size} workflow templates`);
  }

  getTemplates(): IWorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(templateId: string): IWorkflowTemplate | undefined {
    return this.templates.get(templateId);
  }

  generateBPMN(templateId: string, parameters: Record<string, any>): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    if (!parameters.processId) {
      parameters.processId = `${templateId}-${Date.now()}`;
    }

    let bpmn = template.bpmnTemplate;
    Object.keys(parameters).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      bpmn = bpmn.replace(regex, parameters[key]);
    });

    Object.keys(parameters).forEach(key => {
      if (typeof parameters[key] === 'boolean') {
        const ifRegex = new RegExp(`{{#if ${key}}}([\\s\\S]*?){{/if}}`, 'g');
        bpmn = bpmn.replace(ifRegex, parameters[key] ? '$1' : '');
      }
    });

    return bpmn;
  }

  validateParameters(templateId: string, parameters: Record<string, any>): { valid: boolean; errors: string[] } {
    const template = this.templates.get(templateId);
    if (!template) {
      return { valid: false, errors: [`Template ${templateId} not found`] };
    }

    const errors: string[] = [];

    template.parameters.forEach(param => {
      if (param.required && !parameters[param.key]) {
        errors.push(`Missing required parameter: ${param.label}`);
      }

      if (parameters[param.key] !== undefined) {
        const actualType = typeof parameters[param.key];
        if (param.type !== 'select' && actualType !== param.type) {
          errors.push(`Parameter ${param.label} must be of type ${param.type}`);
        }
        if (param.type === 'select' && param.options) {
          const validValues = param.options.map(o => o.value);
          if (!validValues.includes(parameters[param.key])) {
            errors.push(`Parameter ${param.label} must be one of: ${validValues.join(', ')}`);
          }
        }
      }
    });

    return { valid: errors.length === 0, errors };
  }
}

export const workflowTemplateService = new WorkflowTemplateService();