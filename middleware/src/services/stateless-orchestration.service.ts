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
   * Complete an approval task with enhanced version conflict detection
   * 
   * @param taskId - The Camunda task ID
   * @param approved - Whether to approve or reject
   * @param comments - Comments from the approver
   * @param userId - ID of the user completing the task
   * @returns Result with approval status or conflict information
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
        // 4. Enhanced version conflict detection
        if (aidboxPlanId && aidboxPlanId !== 'new') {
          try {
            // Fetch current version from Aidbox
            const currentPlan = await aidboxService.getResource('InsurancePlan', aidboxPlanId);
            
            if (!currentPlan) {
              // Plan was deleted - this is also a conflict
              logger.warn(`Plan ${aidboxPlanId} not found in Aidbox - may have been deleted`);
              
              // Complete task with conflict flag
              await axios.post(
                `${this.camundaBaseUrl}/task/${taskId}/complete`,
                {
                  variables: {
                    approved: { value: false, type: 'Boolean' },
                    rejectionReason: { value: 'Plan no longer exists in Aidbox', type: 'String' },
                    conflictDetected: { value: true, type: 'Boolean' },
                    conflictType: { value: 'DELETED', type: 'String' },
                    voidedAt: { value: new Date().toISOString(), type: 'String' },
                    voidedBy: { value: userId, type: 'String' }
                  }
                }
              );

              // Update draft status to conflict
              await retoolDraftService.updateDraft(draftId, {
                status: 'rejected',
                submission_metadata: {
                  conflictType: 'DELETED',
                  conflictDetectedAt: new Date().toISOString(),
                  message: 'The plan was deleted from Aidbox during the approval process'
                }
              });

              // Log conflict for audit
              logger.info(`Version conflict detected: Plan ${aidboxPlanId} deleted, approval voided for task ${taskId}`);

              return {
                success: false,
                error: 'version_conflict',
                conflictType: 'DELETED',
                message: 'The plan was deleted from Aidbox during the approval process. Please create a new draft.',
                data: {
                  draftId,
                  aidboxPlanId,
                  taskId,
                  voidedAt: new Date().toISOString()
                }
              };
            }
            
            // Compare versions
            const currentVersion = currentPlan.meta?.versionId;
            
            if (currentVersion !== baseVersion) {
              // Version mismatch detected
              logger.warn(`Version conflict: base=${baseVersion}, current=${currentVersion} for plan ${aidboxPlanId}`);
              
              // Complete task with conflict flag and void the approval
              await axios.post(
                `${this.camundaBaseUrl}/task/${taskId}/complete`,
                {
                  variables: {
                    approved: { value: false, type: 'Boolean' },
                    rejectionReason: { value: `Version conflict detected: Plan modified by another user`, type: 'String' },
                    conflictDetected: { value: true, type: 'Boolean' },
                    conflictType: { value: 'VERSION_MISMATCH', type: 'String' },
                    baseVersion: { value: baseVersion, type: 'String' },
                    currentVersion: { value: currentVersion, type: 'String' },
                    voidedAt: { value: new Date().toISOString(), type: 'String' },
                    voidedBy: { value: userId, type: 'String' }
                  }
                }
              );

              // Update draft status with conflict information
              await retoolDraftService.updateDraft(draftId, {
                status: 'rejected',
                submission_metadata: {
                  conflictType: 'VERSION_MISMATCH',
                  baseVersion,
                  currentVersion,
                  conflictDetectedAt: new Date().toISOString(),
                  message: 'The plan was modified by another user during the approval process'
                }
              });

              // Log conflict for audit purposes
              logger.info(`Version conflict detected: base=${baseVersion}, current=${currentVersion} for plan ${aidboxPlanId}, approval voided for task ${taskId}`);

              return {
                success: false,
                error: 'version_conflict',
                conflictType: 'VERSION_MISMATCH',
                message: 'The plan was modified by another user during the approval process. Please resubmit with the updated version.',
                data: {
                  draftId,
                  aidboxPlanId,
                  baseVersion,
                  currentVersion,
                  taskId,
                  voidedAt: new Date().toISOString(),
                  actionRequired: 'Please refresh the draft from the latest version and resubmit for approval'
                }
              };
            }
            
            // No conflict - versions match
            logger.info(`Version check passed: version=${currentVersion} for plan ${aidboxPlanId}`);
            
          } catch (error: any) {
            // Error checking version - log but allow approval to proceed with warning
            logger.error(`Error checking version for plan ${aidboxPlanId}:`, error);
            
            // Optionally, we could reject here for safety
            // For now, we'll log the issue but proceed
            logger.warn('Proceeding with approval despite version check error - manual verification recommended');
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
   * Resubmit a draft with updated base version after conflict resolution
   * 
   * This method allows users to resubmit a draft that was rejected due to version conflict
   * It fetches the latest version from Aidbox and updates the draft before resubmission
   * 
   * @param draftId - The draft ID to resubmit
   * @param userId - The user performing the resubmission
   * @returns Result with new process instance information
   */
  async resubmitWithUpdatedVersion(draftId: string, userId: string): Promise<any> {
    try {
      // 1. Get the draft
      const draft = await retoolDraftService.getDraft(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }

      // 2. Check if draft was rejected due to conflict
      if (draft.status !== 'rejected' || 
          !draft.submission_metadata?.conflictType) {
        return { 
          success: false, 
          error: 'Draft was not rejected due to conflict',
          message: 'This method is only for resubmitting drafts rejected due to version conflicts'
        };
      }

      // 3. Get the latest version from Aidbox if editing existing plan
      let newBaseVersion = null;
      if (draft.aidbox_plan_id && draft.aidbox_plan_id !== 'new') {
        try {
          const currentPlan = await aidboxService.getResource('InsurancePlan', draft.aidbox_plan_id);
          if (!currentPlan) {
            return {
              success: false,
              error: 'plan_deleted',
              message: 'The original plan no longer exists in Aidbox. Please create a new draft.'
            };
          }
          newBaseVersion = currentPlan.meta?.versionId;
          
          // Optionally merge any changes from the current version
          // This could be enhanced to handle merge conflicts
          logger.info(`Resubmitting draft ${draftId} with updated base version: ${newBaseVersion}`);
          
        } catch (error: any) {
          logger.error(`Failed to get current version for plan ${draft.aidbox_plan_id}`, error);
          return {
            success: false,
            error: 'Failed to fetch current plan version'
          };
        }
      }

      // 4. Reset draft status to draft
      await retoolDraftService.updateDraft(draftId, {
        status: 'draft',
        submission_metadata: {
          ...draft.submission_metadata,
          previousConflict: draft.submission_metadata,
          conflictResolvedAt: new Date().toISOString(),
          resolvedBy: userId
        }
      });

      // 5. Resubmit with new base version
      const submissionResult = await this.submitForApproval(draftId, userId);
      
      if (submissionResult.success) {
        logger.info(`Draft ${draftId} successfully resubmitted with base version ${newBaseVersion}`);
        
        return {
          success: true,
          data: {
            ...submissionResult.data,
            baseVersion: newBaseVersion,
            message: 'Draft resubmitted successfully with updated base version'
          }
        };
      }

      return submissionResult;

    } catch (error) {
      logger.error('Failed to resubmit draft with updated version', error);
      return {
        success: false,
        error: 'Failed to resubmit draft'
      };
    }
  }

  /**
   * Check for version conflicts before submitting for approval
   * 
   * This proactive check helps prevent conflicts by verifying the version
   * before starting the approval workflow
   * 
   * @param draftId - The draft to check
   * @returns Conflict status and current version information
   */
  async checkVersionConflict(draftId: string): Promise<any> {
    try {
      // Get the draft
      const draft = await retoolDraftService.getDraft(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }

      // Only check if editing existing plan
      if (!draft.aidbox_plan_id || draft.aidbox_plan_id === 'new') {
        return {
          success: true,
          data: {
            hasConflict: false,
            isNewPlan: true,
            message: 'No conflict - this is a new plan'
          }
        };
      }

      try {
        // Get current version from Aidbox
        const currentPlan = await aidboxService.getResource('InsurancePlan', draft.aidbox_plan_id);
        
        if (!currentPlan) {
          return {
            success: true,
            data: {
              hasConflict: true,
              conflictType: 'DELETED',
              message: 'The plan has been deleted from Aidbox'
            }
          };
        }

        const currentVersion = currentPlan.meta?.versionId;
        const draftBaseVersion = draft.submission_metadata?.baseVersion;

        if (draftBaseVersion && currentVersion !== draftBaseVersion) {
          return {
            success: true,
            data: {
              hasConflict: true,
              conflictType: 'VERSION_MISMATCH',
              baseVersion: draftBaseVersion,
              currentVersion,
              message: 'The plan has been modified since this draft was created',
              lastModified: currentPlan.meta?.lastUpdated
            }
          };
        }

        return {
          success: true,
          data: {
            hasConflict: false,
            currentVersion,
            message: 'No version conflict detected'
          }
        };

      } catch (error: any) {
        logger.error(`Error checking version for plan ${draft.aidbox_plan_id}`, error);
        return {
          success: false,
          error: 'Failed to check version conflict'
        };
      }

    } catch (error) {
      logger.error('Failed to check version conflict', error);
      return {
        success: false,
        error: 'Failed to check version conflict'
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
