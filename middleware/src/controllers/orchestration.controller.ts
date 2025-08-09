import { Request, Response, Router } from 'express';
import { orchestrationService } from '../services/stateless-orchestration.service';
import { logger } from '../utils/logger';
import { retoolDraftService } from '../services/retool-draft.service';

/**
 * Orchestration API Controller
 * 
 * Clean REST API for benefit plan approval workflow
 * Principle: Aidbox is source of truth, we only orchestrate approvals
 */
export class OrchestrationController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Plan management routes
    this.router.get('/plans/:id', this.getPlan.bind(this));
    this.router.post('/plans/:id/submit', this.submitForApproval.bind(this));
    this.router.get('/plans/:id/status', this.getPlanStatus.bind(this));
    this.router.get('/plans', this.listPlans.bind(this));

    // Draft management routes
    this.router.get('/drafts/:id/check-conflict', this.checkVersionConflict.bind(this));
    this.router.post('/drafts/:id/resubmit', this.resubmitWithUpdatedVersion.bind(this));
    this.router.get('/drafts', this.listDrafts.bind(this));

    // Task management routes
    this.router.get('/tasks', this.getPendingTasks.bind(this));
    this.router.post('/tasks/:id/complete', this.completeTask.bind(this));

    // Health check
    this.router.get('/health', this.healthCheck.bind(this));
  }

  /**
   * GET /api/plans/:id
   * Get plan directly from Aidbox (no storage)
   */
  private async getPlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Plan ID is required'
        });
        return;
      }

      const result = await orchestrationService.getPlan(id);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }
    } catch (error) {
      logger.error('Error getting plan', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * POST /api/plans/:id/submit
   * Submit edited plan for approval
   * Body: { planData?: {...}, userId: string }
   */
  private async submitForApproval(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { planData, userId } = req.body;

      // Validation
      if (!id || !userId) {
        res.status(400).json({
          success: false,
          error: 'Plan ID and user ID are required'
        });
        return;
      }

      // Optionally persist the latest plan data into the draft before submitting
      if (planData) {
        try {
          await retoolDraftService.updateDraft(id, { plan_data: planData, updated_by: userId });
        } catch (e) {
          logger.warn('Could not persist planData before submission', e);
        }
      }

      const result = await orchestrationService.submitForApproval(id, userId);
      
      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'Plan submitted for approval',
          data: result.data
        });
      } else {
        // Check for specific error types
        if (result.error === 'Plan is already in approval process') {
          res.status(409).json(result);
        } else {
          res.status(400).json(result);
        }
      }
    } catch (error) {
      logger.error('Error submitting plan for approval', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/plans/:id/status
   * Get approval status for a plan
   */
  private async getPlanStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Plan ID is required'
        });
        return;
      }

      const result = await orchestrationService.getPlanApprovalStatus(id);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error('Error getting plan status', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/plans
   * List all plans with their approval status
   */
  private async listPlans(req: Request, res: Response): Promise<void> {
    try {
      const result = await orchestrationService.listPlansWithStatus();
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error('Error listing plans', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/tasks
   * Get pending approval tasks for a user
   * Query params: { userId: string }
   */
  private async getPendingTasks(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const result = await orchestrationService.getPendingTasks(userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error('Error getting pending tasks', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * POST /api/tasks/:id/complete
   * Complete an approval task (approve or reject)
   * Body: { approved: boolean, comments: string, userId: string }
   */
  private async completeTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approved, comments, userId } = req.body;

      // Validation
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Task ID is required'
        });
        return;
      }

      if (typeof approved !== 'boolean' || !comments || !userId) {
        res.status(400).json({
          success: false,
          error: 'Approved (boolean), comments, and user ID are required'
        });
        return;
      }

      const result = await orchestrationService.completeApprovalTask(
        id,
        approved,
        comments,
        userId
      );
      
      if (result.success) {
        res.json({
          success: true,
          message: result.data.message,
          data: result.data
        });
      } else {
        // Check for version conflict
        if (result.error === 'version_conflict') {
          res.status(409).json({
            success: false,
            error: 'version_conflict',
            conflictType: result.conflictType,
            message: result.message,
            data: result.data
          });
        } else {
          res.status(400).json(result);
        }
      }
    } catch (error) {
      logger.error('Error completing task', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/drafts/:id/check-conflict
   * Check for version conflicts before submitting for approval
   */
  private async checkVersionConflict(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Draft ID is required'
        });
        return;
      }

      const result = await orchestrationService.checkVersionConflict(id);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error('Error checking version conflict', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * POST /api/drafts/:id/resubmit
   * Resubmit a draft with updated base version after conflict resolution
   * Body: { userId: string }
   */
  private async resubmitWithUpdatedVersion(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!id || !userId) {
        res.status(400).json({
          success: false,
          error: 'Draft ID and user ID are required'
        });
        return;
      }

      const result = await orchestrationService.resubmitWithUpdatedVersion(id, userId);
      
      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.data.message || 'Draft resubmitted successfully',
          data: result.data
        });
      } else {
        if (result.error === 'plan_deleted') {
          res.status(404).json(result);
        } else {
          res.status(400).json(result);
        }
      }
    } catch (error) {
      logger.error('Error resubmitting draft', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/drafts
   * List all drafts with their workflow status
   * Query params: { userId?: string }
   */
  private async listDrafts(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query;
      
      const result = await orchestrationService.listDraftsWithStatus(
        userId ? String(userId) : undefined
      );
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error('Error listing drafts', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/health
   * Health check endpoint
   */
  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Could add more detailed health checks here
      res.json({
        success: true,
        status: 'healthy',
        service: 'orchestration-api',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Health check failed', error);
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Service unavailable'
      });
    }
  }
}

// Export singleton instance
export const orchestrationController = new OrchestrationController();
