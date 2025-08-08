import { Pool } from 'pg';
import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { aidboxService } from './mock-aidbox.service';

/**
 * Orchestration Service V2 - Simplified Version
 * 
 * Clean implementation following the principle:
 * - Aidbox is the single source of truth
 * - Only store proposed changes during approval
 * - Void approval if version mismatch detected
 * 
 * Data Flow:
 * 0. PULL from Aidbox → Display in UI
 * 1. EDIT in UI → Changes stay in memory only
 * 2. SUBMIT for approval → Store changes + version
 * 3. APPROVAL process → Check version before applying
 * 4. APPLY or VOID → Push to Aidbox or require resubmission
 */

export interface IOrchestrationState {
  id?: string;
  resource_id: string;
  resource_type: string;
  base_version: string;        // Aidbox version we're editing from
  proposed_changes: any;        // The complete edited data
  workflow_state: 'pending_approval' | 'approved' | 'rejected' | 'voided';
  workflow_instance_id?: string;
  submitted_by: string;
  submitted_at?: Date;
  void_reason?: string;
  completed_at?: Date;
}

export class OrchestrationService {
  private db: Pool;
  private camundaBaseUrl: string;

  constructor() {
    this.db = new Pool({
      host: config.dbHost || 'localhost',
      port: config.dbPort || 5432,
      user: config.dbUser || 'postgres',
      password: config.dbPassword || 'postgres',
      database: config.dbName || 'postgres'
    });

    this.camundaBaseUrl = config.camundaUrl || 'http://localhost:8080/engine-rest';
  }

  /**
   * Get a plan directly from Aidbox (no storage)
   */
  async getPlan(planId: string): Promise<any> {
    try {
      const plan = await aidboxService.getResource('InsurancePlan', planId);
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
   * Submit edited plan for approval
   * This is when we first store anything
   */
  async submitForApproval(
    planId: string, 
    editedPlanData: any, 
    userId: string
  ): Promise<any> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get current version from Aidbox
      const currentPlan = await aidboxService.getResource('InsurancePlan', planId);
      const baseVersion = currentPlan.meta.versionId;

      // Check if already in approval
      const existing = await client.query(
        `SELECT id FROM orchestration_state 
         WHERE resource_id = $1 
         AND workflow_state = 'pending_approval'`,
        [planId]
      );

      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Plan is already in approval process'
        };
      }

      // Store proposed changes and version
      const stateResult = await client.query(
        `INSERT INTO orchestration_state 
         (resource_id, resource_type, base_version, proposed_changes, 
          workflow_state, submitted_by, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id`,
        [planId, 'InsurancePlan', baseVersion, JSON.stringify(editedPlanData), 
         'pending_approval', userId]
      );

      const stateId = stateResult.rows[0].id;

      // Start Camunda workflow
      const workflowResponse = await axios.post(
        `${this.camundaBaseUrl}/process-definition/key/benefit-plan-approval/start`,
        {
          variables: {
            orchestrationStateId: { value: stateId, type: 'String' },
            resourceId: { value: planId, type: 'String' },
            resourceType: { value: 'InsurancePlan', type: 'String' },
            baseVersion: { value: baseVersion, type: 'String' },
            submittedBy: { value: userId, type: 'String' }
          }
        }
      );

      // Update with workflow instance ID
      await client.query(
        `UPDATE orchestration_state 
         SET workflow_instance_id = $1 
         WHERE id = $2`,
        [workflowResponse.data.id, stateId]
      );

      await client.query('COMMIT');

      logger.info(`Plan ${planId} submitted for approval`, {
        stateId,
        baseVersion,
        workflowId: workflowResponse.data.id
      });

      return {
        success: true,
        data: {
          orchestrationStateId: stateId,
          workflowInstanceId: workflowResponse.data.id,
          baseVersion,
          status: 'submitted_for_approval'
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to submit for approval', error);
      return {
        success: false,
        error: 'Failed to submit for approval'
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get pending approval tasks for a user
   */
  async getPendingTasks(userId: string): Promise<any> {
    try {
      // Query Camunda for tasks assigned to user
      const response = await axios.get(
        `${this.camundaBaseUrl}/task`,
        {
          params: {
            assignee: userId,
            processDefinitionKey: 'benefit-plan-approval'
          }
        }
      );

      // Enrich with orchestration state data
      const tasks = await Promise.all(response.data.map(async (task: any) => {
        const stateId = task.variables?.orchestrationStateId?.value;
        if (!stateId) return task;

        const stateResult = await this.db.query(
          `SELECT resource_id, resource_type, base_version, submitted_by, submitted_at
           FROM orchestration_state WHERE id = $1`,
          [stateId]
        );

        if (stateResult.rows.length > 0) {
          const state = stateResult.rows[0];
          return {
            ...task,
            resourceId: state.resource_id,
            resourceType: state.resource_type,
            baseVersion: state.base_version,
            submittedBy: state.submitted_by,
            submittedAt: state.submitted_at
          };
        }

        return task;
      }));

      return {
        success: true,
        data: tasks
      };

    } catch (error) {
      logger.error('Failed to get pending tasks', error);
      return {
        success: false,
        error: 'Failed to retrieve pending tasks'
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
    const client = await this.db.connect();

    try {
      // Get task details from Camunda
      const taskResponse = await axios.get(`${this.camundaBaseUrl}/task/${taskId}`);
      const task = taskResponse.data;
      
      const stateId = task.variables?.orchestrationStateId?.value;
      if (!stateId) {
        throw new Error('No orchestration state ID found in task');
      }

      // Get orchestration state
      const stateResult = await client.query(
        `SELECT * FROM orchestration_state WHERE id = $1`,
        [stateId]
      );

      if (stateResult.rows.length === 0) {
        throw new Error('Orchestration state not found');
      }

      const state = stateResult.rows[0];

      if (approved) {
        // Check if Aidbox version is still current
        const currentPlan = await aidboxService.getResource('InsurancePlan', state.resource_id);
        
        if (currentPlan.meta.versionId !== state.base_version) {
          // Version mismatch - void the approval
          await client.query('BEGIN');
          
          await client.query(
            `UPDATE orchestration_state 
             SET workflow_state = 'voided',
                 void_reason = 'Plan was modified during approval process',
                 completed_at = NOW()
             WHERE id = $1`,
            [stateId]
          );

          // Cancel the Camunda process
          await axios.delete(
            `${this.camundaBaseUrl}/process-instance/${state.workflow_instance_id}`
          );

          await client.query('COMMIT');

          logger.warn(`Approval voided due to version mismatch`, {
            planId: state.resource_id,
            baseVersion: state.base_version,
            currentVersion: currentPlan.meta.versionId
          });

          return {
            success: false,
            error: 'voided',
            message: 'Plan was modified during approval. Please pull the latest version and resubmit.',
            data: {
              baseVersion: state.base_version,
              currentVersion: currentPlan.meta.versionId
            }
          };
        }

        // Version matches - complete the task in Camunda
        await axios.post(
          `${this.camundaBaseUrl}/task/${taskId}/complete`,
          {
            variables: {
              approved: { value: true, type: 'Boolean' },
              approverComments: { value: comments, type: 'String' },
              approvedBy: { value: userId, type: 'String' }
            }
          }
        );

        // Check if this was the final approval
        const processResponse = await axios.get(
          `${this.camundaBaseUrl}/process-instance/${state.workflow_instance_id}`
        );

        if (!processResponse.data || processResponse.data.ended) {
          // Process completed - apply changes to Aidbox
          await client.query('BEGIN');

          const proposedChanges = JSON.parse(state.proposed_changes);
          await aidboxService.updateResource('InsurancePlan', state.resource_id, proposedChanges);

          await client.query(
            `UPDATE orchestration_state 
             SET workflow_state = 'approved',
                 completed_at = NOW()
             WHERE id = $1`,
            [stateId]
          );

          await client.query('COMMIT');

          logger.info(`Plan ${state.resource_id} approved and updated in Aidbox`);

          return {
            success: true,
            data: {
              status: 'approved_and_applied',
              planId: state.resource_id,
              message: 'Changes successfully applied to Aidbox'
            }
          };
        } else {
          // More approvals needed
          return {
            success: true,
            data: {
              status: 'task_completed',
              message: 'Your approval has been recorded. Waiting for additional approvals.'
            }
          };
        }

      } else {
        // Rejection - complete task and update state
        await client.query('BEGIN');

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

        await client.query(
          `UPDATE orchestration_state 
           SET workflow_state = 'rejected',
               completed_at = NOW()
           WHERE id = $1`,
          [stateId]
        );

        await client.query('COMMIT');

        return {
          success: true,
          data: {
            status: 'rejected',
            message: 'Plan has been rejected'
          }
        };
      }

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to complete approval task', error);
      return {
        success: false,
        error: 'Failed to complete approval task'
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get approval status for a plan
   */
  async getPlanApprovalStatus(planId: string): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT * FROM orchestration_state 
         WHERE resource_id = $1 
         ORDER BY submitted_at DESC 
         LIMIT 1`,
        [planId]
      );

      if (result.rows.length === 0) {
        return {
          success: true,
          data: {
            status: 'no_approval_process',
            planId
          }
        };
      }

      const state = result.rows[0];
      
      // Get current Aidbox version for comparison
      const currentPlan = await aidboxService.getResource('InsurancePlan', planId);
      
      return {
        success: true,
        data: {
          planId,
          workflowState: state.workflow_state,
          baseVersion: state.base_version,
          currentVersion: currentPlan.meta.versionId,
          versionMismatch: currentPlan.meta.versionId !== state.base_version,
          submittedBy: state.submitted_by,
          submittedAt: state.submitted_at,
          completedAt: state.completed_at,
          voidReason: state.void_reason
        }
      };

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
      
      // Get approval states
      const statesResult = await this.db.query(
        `SELECT DISTINCT ON (resource_id) 
         resource_id, workflow_state, base_version, submitted_at
         FROM orchestration_state 
         WHERE resource_type = 'InsurancePlan'
         ORDER BY resource_id, submitted_at DESC`
      );

      const stateMap = new Map(
        statesResult.rows.map(row => [row.resource_id, row])
      );

      // Combine data
      const plansWithStatus = plans.map((plan: any) => {
        const state = stateMap.get(plan.id);
        return {
          id: plan.id,
          name: plan.name,
          status: plan.status,
          currentVersion: plan.meta?.versionId,
          approvalState: state ? {
            workflowState: state.workflow_state,
            baseVersion: state.base_version,
            submittedAt: state.submitted_at,
            versionMismatch: plan.meta?.versionId !== state.base_version
          } : null
        };
      });

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
   * Clean up completed orchestration states (housekeeping)
   */
  async cleanupCompletedStates(daysToKeep: number = 30): Promise<any> {
    try {
      const result = await this.db.query(
        `DELETE FROM orchestration_state 
         WHERE workflow_state IN ('approved', 'rejected', 'voided')
         AND completed_at < NOW() - INTERVAL '${daysToKeep} days'
         RETURNING id`,
        []
      );

      logger.info(`Cleaned up ${result.rowCount} completed orchestration states`);

      return {
        success: true,
        data: {
          deletedCount: result.rowCount
        }
      };

    } catch (error) {
      logger.error('Failed to cleanup states', error);
      return {
        success: false,
        error: 'Failed to cleanup'
      };
    }
  }
}

// Export singleton instance
export const orchestrationService = new OrchestrationService();
