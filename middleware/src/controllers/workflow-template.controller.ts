import { Request, Response, NextFunction } from 'express';
import { workflowTemplateService } from '../services/workflow-template.service';
import { camundaService } from '../services/camunda.service';
import { logger } from '../utils/logger';

class WorkflowTemplateController {
  /**
   * Get all available workflow templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = workflowTemplateService.getTemplates();
      
      res.json({
        success: true,
        data: {
          templates,
          count: templates.length
        }
      });
    } catch (error) {
      logger.error('Failed to get templates', error);
      next(error);
    }
  }

  /**
   * Get a specific template with its parameters
   */
  async getTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId } = req.params;
      const template = workflowTemplateService.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: `Template ${templateId} not found`
          }
        });
      }
      
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Failed to get template', error);
      next(error);
    }
  }

  /**
   * Deploy a workflow from a template
   */
  async deployFromTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId, parameters } = req.body;
      
      // Validate parameters
      const validation = workflowTemplateService.validateParameters(templateId, parameters);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid template parameters',
            details: validation.errors
          }
        });
      }
      
      // Generate BPMN from template
      const bpmn = workflowTemplateService.generateBPMN(templateId, parameters);
      
      // Deploy to Camunda
      const deployment = await camundaService.deployProcess(
        parameters.processName || `Template ${templateId}`,
        bpmn
      );
      
      logger.info('Deployed workflow from template', { 
        templateId, 
        deploymentId: deployment.id 
      });
      
      res.json({
        success: true,
        data: {
          deploymentId: deployment.id,
          processId: parameters.processId,
          templateId,
          parameters,
          message: 'Workflow deployed successfully'
        }
      });
    } catch (error) {
      logger.error('Failed to deploy from template', error);
      next(error);
    }
  }

  /**
   * Preview BPMN that would be generated from template
   */
  async previewTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId, parameters } = req.body;
      
      // Validate parameters
      const validation = workflowTemplateService.validateParameters(templateId, parameters);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid template parameters',
            details: validation.errors
          }
        });
      }
      
      // Generate BPMN
      const bpmn = workflowTemplateService.generateBPMN(templateId, parameters);
      
      res.json({
        success: true,
        data: {
          templateId,
          parameters,
          bpmn,
          preview: true
        }
      });
    } catch (error) {
      logger.error('Failed to preview template', error);
      next(error);
    }
  }

  /**
   * Start a process from a deployed template
   */
  async startTemplateProcess(req: Request, res: Response, next: NextFunction) {
    try {
      const { processId, variables } = req.body;
      
      // Start the process with provided variables
      const processInstance = await camundaService.startProcess(processId, variables);
      
      logger.info('Started process from template', { 
        processId, 
        instanceId: processInstance.id 
      });
      
      res.json({
        success: true,
        data: {
          processInstanceId: processInstance.id,
          processId,
          variables,
          message: 'Process started successfully'
        }
      });
    } catch (error) {
      logger.error('Failed to start template process', error);
      next(error);
    }
  }
}

export const workflowTemplateController = new WorkflowTemplateController();
