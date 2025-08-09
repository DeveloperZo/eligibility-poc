import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { aidboxService } from './mock-aidbox.service';
import { retoolDraftService } from './retool-draft.service';

/**
 * Stateless Orchestration Service
 * 
 * Pure coordination layer - NO database!
 * All state lives in:
 * - Retool: Drafts
 * - Camunda: Workflow state
 * - Aidbox: Approved plans
 */

export class StatelessOrchestrationService {
  private camundaBaseUrl: string;

  constructor() {
    this.camundaBaseUrl = config.camundaUrl || 'http://localhost:8080/engine-rest';
  }

  /**
   * Submit draft for approval - starts Camunda process
   */
  async submitForApproval(draftId: string, userId: string): Promise<any> {
    try {
      // 1. Get draft from Retool
      const draft = await retoolDraftService.getDraft(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }

      if (draft.status === 'submitted') {
        return { success: false, error: 'Draft already submitted' };
      }

      // 2. Get base version if editing existing plan
      let baseVersion = null;
      if (draft.aidbox_plan_id) {
        try {
          const existingPlan = await aidboxService.getResource('InsurancePlan', draft.aidbox_plan_id);
          if (existingPlan) {
            baseVersion = existingPlan.meta?.versionId;
          }
        } catch (error: any) {
          logger.warn(`Could not get base version for plan ${draft.aidbox_plan_id}`);
        }
      }

      // 3. Start Camunda process with all data as variables
      const processResponse = await axios.post(
        `${this.camundaBaseUrl}/process-definition/key/benefit-plan-approval/start`,
        {
          variables: {
            draftId: { value: draftId, type: 'String' },
            draftSource: { value: 'retool', type: 'String' },
            baseVersion: { value: baseVersion || 'new', type: 'String' },
            aidboxPlanId: { value: draft.aidbox_plan_id || 'new', type: 'String' },
            submittedBy: { value: userId, type: 'String' },
            planName: { value: draft.plan_data.name, type: 'String' },
            submittedAt: { value: new Date().toISOString(), type: 'String' }
          }
        }
      );

      // 4. Update draft with process instance ID
      await retoolDraftService.updateDraft(draftId, {
        status: 'submitted',
        submission_id: processResponse.data.id
      });

      logger.info(`Draft ${draftId} submitted for approval, process: ${processResponse.data.id}`);

      return {
        success: true,
        data: {
          draftId,
          processInstanceId: processResponse.data.id,
          status: 'submitted'
        }
      };

    } catch (error) {
      logger.error('Failed to submit for approval', error);
      return {
        success: false,
        error: 'Failed to submit for approval'
      };
    }
  }

  /**
   * Get pending tasks from Camunda
   */
  async getPendingTasks(userId: string): Promise<any> {
    try {
      // Query Camunda directly
      const response = await axios.get(
        `${this.camundaBaseUrl}/task`,
        {
          params: {
            assignee: userId,
            processDefinitionKey: 'benefit-plan-approval'
          }
        }
      );

      // Enrich tasks with draft info (but don't store)
      const tasks = await Promise.all(response.data.map(async (task: any) => {
        try {
          // Get process variables
          const varsResponse = await axios.get(
            `${this.camundaBaseUrl}/task/${task.id}/variables`
          );
          
          const variables = varsResponse.data;
          const draftId = variables.draftId?.value;
          
          // Get draft details
          if (draftId) {
            const draft = await retoolDraftService.getDraft(draftId);
            return {
              taskId: task.id,
              taskName: task.name,
              created: task.created,
              draftId,
              planName: draft?.plan_data?.name || 'Unknown',
              submittedBy: variables.submittedBy?.value,
              submittedAt: variables.submittedAt?.value
            };
          }
          
          return task;
        } catch (error: any) {
          logger.warn(`Could not enrich task ${task.id}`, error);
          return task;
        }
      }));

      return {
        success: true,
        data: tasks
      };

    } catch (error) {
      logger.error('Failed to get pending tasks', error);
      return {
        success: false,
        error: 'Failed to retrieve tasks'
      };
    }
  }

  /**
   * Complete an approval task
   */
  async completeApprovalTask(
    taskId: string,
    approved: boolean,
    comments: string,
    userId: string
  ): Promise<any> {
    try {
      // 1. Get task details from Camunda
      const taskResponse = await axios.get(
        `${this.camundaBaseUrl}/task/${taskId}`
      );
      const task = taskResponse.data;
      const processInstanceId = task.processInstanceId;
      
      // 2. Get task variables from Camunda
      const varsResponse = await axios.get(
        `${this.camundaBaseUrl}/task/${taskId}/variables`
      );
      const variables = varsResponse.data;
      
      const draftId = variables.draftId?.value;
      const baseVersion = variables.baseVersion?.value;
      const aidboxPlanId = variables.aidboxPlanId?.value;

      if (!draftId) {
        return { success: false, error: 'No draft ID in task' };
      }

      // 3. Get draft from Retool
      const draft = await retoolDraftService.getDraft(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }

      if (approved) {
        // 4. Check for version conflict
        if (aidboxPlanId && aidboxPlanId !== 'new') {
          try {
            const currentPlan = await aidboxService.getResource('InsurancePlan', aidboxPlanId);
            if (currentPlan && currentPlan.meta?.versionId !== baseVersion) {
              // Version conflict - reject with reason
              await axios.post(
                `${this.camundaBaseUrl}/task/${taskId}/complete`,
                {
                  variables: {
                    approved: { value: false, type: 'Boolean' },
                    rejectionReason: { value: 'Version conflict detected', type: 'String' },
                    conflictDetected: { value: true, type: 'Boolean' }
                  }
                }
              );

              // Update draft status
              await retoolDraftService.updateDraft(draftId, {
                status: 'rejected'
              });

              return {
                success: false,
                error: 'version_conflict',
                message: 'Plan was modified during approval process',
                data: {
                  baseVersion,
                  currentVersion: currentPlan.meta?.versionId
                }
              };
            }
          } catch (error: any) {
            logger.warn('Could not check version', error);
          }
        }

        // 5. Complete task with approval
        await axios.post(
          `${this.camundaBaseUrl}/task/${taskId}/complete`,
          {
            variables: {
              approved: { value: true, type: 'Boolean' },
              approverComments: { value: comments, type: 'String' },
              approvedBy: { value: userId, type: 'String' },
              approvedAt: { value: new Date().toISOString(), type: 'String' }
            }
          }
        );

        // 6. Check if process is complete
        // Wait a moment for Camunda to process the task completion
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          const processResponse = await axios.get(
            `${this.camundaBaseUrl}/process-instance/${processInstanceId}`
          );
          
          // Process is still running
          return {
            success: true,
            data: {
              status: 'task_completed',
              message: 'Approval recorded, waiting for other approvers'
            }
          };
        } catch (error: any) {
          // 404 means process ended (which is what we want)
          if (error.response?.status === 404) {
            // Process complete - push to Aidbox
            const result = await this.pushToAidbox(draft);
            
            // Update draft status
            await retoolDraftService.markDraftAsApproved(draftId, result.id);
            
            return {
              success: true,
              data: {
                status: 'approved_and_published',
                aidboxId: result.id
              }
            };
          }
          // Re-throw other errors
          throw error;
        }



      } else {
        // Rejection
        await axios.post(
          `${this.camundaBaseUrl}/task/${taskId}/complete`,
          {
            variables: {
              approved: { value: false, type: 'Boolean' },
              rejectionReason: { value: comments, type: 'String' },
              rejectedBy: { value: userId, type: 'String' }
            }
          }
        );

        // Update draft status
        await retoolDraftService.markDraftAsRejected(draftId);

        return {
          success: true,
          data: {
            status: 'rejected',
            message: 'Plan has been rejected'
          }
        };
      }

    } catch (error) {
      logger.error('Failed to complete task', error);
      return {
        success: false,
        error: 'Failed to complete task'
      };
    }
  }

  /**
   * Get approval status for a draft
   */
  async getApprovalStatus(draftId: string): Promise<any> {
    try {
      // Get draft from Retool
      const draft = await retoolDraftService.getDraft(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }

      // If submitted, check Camunda process
      if (draft.submission_id) {
        try {
          const processResponse = await axios.get(
            `${this.camundaBaseUrl}/process-instance/${draft.submission_id}`
          );

          // Get current activities
          const activitiesResponse = await axios.get(
            `${this.camundaBaseUrl}/process-instance/${draft.submission_id}/activity-instances`
          );

          return {
            success: true,
            data: {
              draftStatus: draft.status,
              processActive: true,
              currentActivities: activitiesResponse.data.childActivityInstances?.map(
                (a: any) => a.activityName
              ) || []
            }
          };

        } catch (error: any) {
          if (error.response?.status === 404) {
            // Process ended
            return {
              success: true,
              data: {
                draftStatus: draft.status,
                processActive: false,
                message: 'Approval process completed'
              }
            };
          }
          throw error;
        }
      }

      // Not submitted
      return {
        success: true,
        data: {
          draftStatus: draft.status,
          processActive: false
        }
      };

    } catch (error) {
      logger.error('Failed to get approval status', error);
      return {
        success: false,
        error: 'Failed to get status'
      };
    }
  }

  /**
   * Helper: Push approved plan to Aidbox
   */
  private async pushToAidbox(draft: any): Promise<any> {
    const planData = {
      ...draft.plan_data,
      status: 'active',
      meta: {
        ...draft.plan_data.meta,
        lastUpdated: new Date().toISOString()
      }
    };

    if (draft.aidbox_plan_id && draft.aidbox_plan_id !== 'new') {
      // Update existing
      return await aidboxService.updateResource(
        'InsurancePlan',
        draft.aidbox_plan_id,
        planData
      );
    } else {
      // Create new
      return await aidboxService.createResource('InsurancePlan', planData);
    }
  }

  /**
   * Get a plan directly from Aidbox (no storage)
   */
  async getPlan(planId: string): Promise<any> {
    try {
      const plan = await aidboxService.getResource('InsurancePlan', planId);
      if (!plan) {
        return {
          success: false,
          error: 'Plan not found'
        };
      }
      return {
        success: true,
        data: plan
      };
    } catch (error) {
      logger.error('Failed to get plan from Aidbox', error);
      return {
        success: false,
        error: 'Failed to retrieve plan'
      };
    }
  }

  /**
   * Get approval status for a plan (alias for getApprovalStatus)
   */
  async getPlanApprovalStatus(planId: string): Promise<any> {
    // In stateless mode, we need the draft ID, not the plan ID
    // Try to find a draft for this plan
    try {
      const drafts = await retoolDraftService.listDrafts('');
      const draft = drafts.find((d: any) => d.aidbox_plan_id === planId);
      
      if (!draft) {
        return {
          success: true,
          data: {
            status: 'no_approval_process',
            planId
          }
        };
      }
      
      return this.getApprovalStatus(draft.id!);
    } catch (error) {
      logger.error('Failed to get plan approval status', error);
      return {
        success: false,
        error: 'Failed to retrieve approval status'
      };
    }
  }

  /**
   * List all plans with their approval status
   */
  async listPlansWithStatus(): Promise<any> {
    try {
      // Get all plans from Aidbox
      const plans = await aidboxService.searchResources('InsurancePlan', {});
      
      // Get all drafts
      const drafts = await retoolDraftService.listDrafts('');
      
      // Create a map of plan ID to draft
      const draftMap = new Map();
      drafts.forEach((draft: any) => {
        if (draft.aidbox_plan_id) {
          draftMap.set(draft.aidbox_plan_id, draft);
        }
      });
      
      // Combine data
      const plansWithStatus = await Promise.all(plans.map(async (plan: any) => {
        const draft = draftMap.get(plan.id);
        let approvalState = null;
        
        if (draft && draft.submission_id) {
          try {
            const processResponse = await axios.get(
              `${this.camundaBaseUrl}/process-instance/${draft.submission_id}`
            );
            approvalState = {
              workflowState: 'pending_approval',
              submittedAt: draft.updated_at
            };
          } catch (error: any) {
            if (error.response?.status === 404) {
              approvalState = {
                workflowState: draft.status === 'approved' ? 'approved' : 'rejected',
                submittedAt: draft.updated_at
              };
            }
          }
        }
        
        return {
          id: plan.id,
          name: plan.name,
          status: plan.status,
          currentVersion: plan.meta?.versionId,
          approvalState
        };
      }));
      
      return {
        success: true,
        data: plansWithStatus
      };
      
    } catch (error) {
      logger.error('Failed to list plans with status', error);
      return {
        success: false,
        error: 'Failed to retrieve plans'
      };
    }
  }

  /**
   * List all drafts with their workflow status
   */
  async listDraftsWithStatus(userId?: string): Promise<any> {
    try {
      // Get drafts from Retool
      const drafts = userId 
        ? await retoolDraftService.listDrafts(userId)
        : await retoolDraftService.listDrafts(''); // Get all

      // Enrich with Camunda status
      const enrichedDrafts = await Promise.all(drafts.map(async (draft) => {
        let workflowStatus = null;
        
        if (draft.submission_id) {
          try {
            const processResponse = await axios.get(
              `${this.camundaBaseUrl}/process-instance/${draft.submission_id}`
            );
            workflowStatus = 'active';
          } catch (error: any) {
            if (error.response?.status === 404) {
              workflowStatus = 'completed';
            }
          }
        }

        return {
          id: draft.id,
          name: draft.plan_data?.name,
          status: draft.status,
          workflowStatus,
          createdBy: draft.created_by,
          updatedAt: draft.updated_at
        };
      }));

      return {
        success: true,
        data: enrichedDrafts
      };

    } catch (error) {
      logger.error('Failed to list drafts with status', error);
      return {
        success: false,
        error: 'Failed to list drafts'
      };
    }
  }
}

// Export singleton
export const orchestrationService = new StatelessOrchestrationService();
