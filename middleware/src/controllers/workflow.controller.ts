import { Request, Response, NextFunction } from 'express';
import { camundaService } from '../services/camunda.service';
import { logger } from '../utils/logger';

class WorkflowController {
  /**
   * Start a benefit plan approval workflow
   */
  async startBenefitPlanProcess(req: Request, res: Response, next: NextFunction) {
    try {
      const { planName, planType, submittedBy } = req.body;
      
      // Start process with variables
      const result = await camundaService.startProcess('benefit-plan-approval', {
        planName: { value: planName, type: 'String' },
        planType: { value: planType || 'medical', type: 'String' },
        submittedBy: { value: submittedBy || 'system', type: 'String' },
        status: { value: 'pending_approval', type: 'String' },
        version: { value: 1, type: 'Integer' }
      });
      
      logger.info('Started benefit plan process', { processId: result.id });
      
      res.json({
        success: true,
        data: {
          processInstanceId: result.id,
          businessKey: result.businessKey,
          status: 'started'
        }
      });
    } catch (error) {
      logger.error('Failed to start process', error);
      next(error);
    }
  }

  /**
   * Get pending approval tasks
   */
  async getPendingTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const tasks = await camundaService.getTasks({
        processDefinitionKey: 'benefit-plan-approval'
      });
      
      res.json({
        success: true,
        data: {
          tasks: tasks.map(task => ({
            id: task.id,
            name: task.name,
            assignee: task.assignee,
            created: task.created,
            processInstanceId: task.processInstanceId,
            variables: task.variables
          })),
          count: tasks.length
        }
      });
    } catch (error) {
      logger.error('Failed to get tasks', error);
      next(error);
    }
  }

  /**
   * Complete an approval task
   */
  async completeApprovalTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const { approved, comments } = req.body;
      
      // Get current process variables to increment version if approved
      const task = await camundaService.getTask(taskId);
      const processVars = await camundaService.getProcessVariables(task.processInstanceId);
      
      const newVersion = approved ? (processVars.version?.value || 1) + 1 : processVars.version?.value || 1;
      
      // Complete the task
      await camundaService.completeTask(taskId, {
        approved: { value: approved, type: 'Boolean' },
        comments: { value: comments || '', type: 'String' },
        version: { value: newVersion, type: 'Integer' },
        status: { value: approved ? 'approved' : 'rejected', type: 'String' }
      });
      
      logger.info('Completed approval task', { 
        taskId, 
        approved, 
        newVersion 
      });
      
      res.json({
        success: true,
        data: {
          taskId,
          action: approved ? 'approved' : 'rejected',
          newVersion: approved ? newVersion : processVars.version?.value
        }
      });
    } catch (error) {
      logger.error('Failed to complete task', error);
      next(error);
    }
  }

  /**
   * Get process instance status
   */
  async getProcessStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { processId } = req.params;
      
      const processInstance = await camundaService.getProcessInstance(processId);
      const variables = await camundaService.getProcessVariables(processId);
      const history = await camundaService.getProcessHistory(processId);
      
      res.json({
        success: true,
        data: {
          processId,
          active: processInstance.suspended === false,
          status: variables.status?.value || 'unknown',
          version: variables.version?.value || 1,
          planName: variables.planName?.value,
          history: history.map(h => ({
            activityName: h.activityName,
            startTime: h.startTime,
            endTime: h.endTime,
            duration: h.duration
          }))
        }
      });
    } catch (error) {
      logger.error('Failed to get process status', error);
      next(error);
    }
  }
}

export const workflowController = new WorkflowController();
