import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

/**
 * Retool Draft Service
 * 
 * Manages benefit plan drafts in Retool's PostgreSQL database.
 * This is where working copies live before approval.
 * 
 * Data Flow:
 * 1. User edits in Retool UI → Saved here
 * 2. Submit for approval → Referenced by orchestration
 * 3. Approved → Pushed to Aidbox
 * 4. Rejected → Remains here for revision
 */

export interface IBenefitPlanDraft {
  id?: string;
  aidbox_plan_id?: string;        // Link to Aidbox if editing existing
  plan_data: any;                  // Full FHIR InsurancePlan structure
  created_by: string;
  updated_by: string;
  created_at?: Date;
  updated_at?: Date;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submission_id?: string;          // Link to orchestration if submitted
  ui_state?: any;                  // Optional UI form state
}

export class RetoolDraftService {
  private db: Pool;

  constructor() {
    // Connect to Retool's PostgreSQL (not orchestration DB)
    this.db = new Pool({
      host: config.retoolDbHost || config.dbHost || 'localhost',
      port: config.retoolDbPort || 5433,  // Different port for Retool DB
      user: config.retoolDbUser || 'retool',
      password: config.retoolDbPassword || 'retool',
      database: config.retoolDbName || 'retool'
    });
  }

  /**
   * Create a new draft
   */
  async createDraft(draft: IBenefitPlanDraft): Promise<string> {
    const client = await this.db.connect();
    
    try {
      const result = await client.query(
        `INSERT INTO benefit_plan_drafts 
         (aidbox_plan_id, plan_data, created_by, updated_by, status, ui_state)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          draft.aidbox_plan_id || null,
          JSON.stringify(draft.plan_data),
          draft.created_by,
          draft.updated_by,
          draft.status || 'draft',
          draft.ui_state ? JSON.stringify(draft.ui_state) : null
        ]
      );
      
      logger.info(`Draft created: ${result.rows[0].id}`);
      return result.rows[0].id;
      
    } catch (error) {
      logger.error('Failed to create draft', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a draft by ID
   */
  async getDraft(draftId: string): Promise<IBenefitPlanDraft | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM benefit_plan_drafts WHERE id = $1`,
        [draftId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        aidbox_plan_id: row.aidbox_plan_id,
        plan_data: row.plan_data,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        status: row.status,
        submission_id: row.submission_id,
        ui_state: row.ui_state
      };
      
    } catch (error) {
      logger.error('Failed to get draft', error);
      throw error;
    }
  }

  /**
   * Update a draft
   */
  async updateDraft(draftId: string, updates: Partial<IBenefitPlanDraft>): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (updates.plan_data !== undefined) {
        setClauses.push(`plan_data = $${paramIndex++}`);
        values.push(JSON.stringify(updates.plan_data));
      }
      
      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      
      if (updates.submission_id !== undefined) {
        setClauses.push(`submission_id = $${paramIndex++}`);
        values.push(updates.submission_id);
      }
      
      if (updates.ui_state !== undefined) {
        setClauses.push(`ui_state = $${paramIndex++}`);
        values.push(JSON.stringify(updates.ui_state));
      }
      
      if (updates.updated_by !== undefined) {
        setClauses.push(`updated_by = $${paramIndex++}`);
        values.push(updates.updated_by);
      }
      
      // Always update timestamp
      setClauses.push(`updated_at = NOW()`);
      
      // Add draft ID as last parameter
      values.push(draftId);
      
      await client.query(
        `UPDATE benefit_plan_drafts 
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}`,
        values
      );
      
      logger.info(`Draft updated: ${draftId}`);
      
    } catch (error) {
      logger.error('Failed to update draft', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a draft
   */
  async deleteDraft(draftId: string): Promise<void> {
    try {
      await this.db.query(
        `DELETE FROM benefit_plan_drafts WHERE id = $1`,
        [draftId]
      );
      
      logger.info(`Draft deleted: ${draftId}`);
      
    } catch (error) {
      logger.error('Failed to delete draft', error);
      throw error;
    }
  }

  /**
   * List drafts for a user
   */
  async listDrafts(userId: string, status?: string): Promise<IBenefitPlanDraft[]> {
    try {
      let query = `SELECT * FROM benefit_plan_drafts WHERE created_by = $1`;
      const params: any[] = [userId];
      
      if (status) {
        query += ` AND status = $2`;
        params.push(status);
      }
      
      query += ` ORDER BY updated_at DESC`;
      
      const result = await this.db.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        aidbox_plan_id: row.aidbox_plan_id,
        plan_data: row.plan_data,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        status: row.status,
        submission_id: row.submission_id,
        ui_state: row.ui_state
      }));
      
    } catch (error) {
      logger.error('Failed to list drafts', error);
      throw error;
    }
  }

  /**
   * Submit a draft for approval
   * Links the draft to orchestration
   */
  async markDraftAsSubmitted(draftId: string, submissionId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE benefit_plan_drafts 
         SET status = 'submitted', 
             submission_id = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [draftId, submissionId]
      );
      
      logger.info(`Draft marked as submitted: ${draftId}`);
      
    } catch (error) {
      logger.error('Failed to mark draft as submitted', error);
      throw error;
    }
  }

  /**
   * Mark draft as approved after workflow completion
   */
  async markDraftAsApproved(draftId: string, aidboxPlanId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE benefit_plan_drafts 
         SET status = 'approved',
             aidbox_plan_id = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [draftId, aidboxPlanId]
      );
      
      logger.info(`Draft marked as approved: ${draftId}`);
      
    } catch (error) {
      logger.error('Failed to mark draft as approved', error);
      throw error;
    }
  }

  /**
   * Mark draft as rejected
   */
  async markDraftAsRejected(draftId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE benefit_plan_drafts 
         SET status = 'rejected',
             submission_id = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [draftId]
      );
      
      logger.info(`Draft marked as rejected: ${draftId}`);
      
    } catch (error) {
      logger.error('Failed to mark draft as rejected', error);
      throw error;
    }
  }

  /**
   * Get draft by submission ID
   * Used by orchestration to find the associated draft
   */
  async getDraftBySubmissionId(submissionId: string): Promise<IBenefitPlanDraft | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM benefit_plan_drafts WHERE submission_id = $1`,
        [submissionId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        aidbox_plan_id: row.aidbox_plan_id,
        plan_data: row.plan_data,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        status: row.status,
        submission_id: row.submission_id,
        ui_state: row.ui_state
      };
      
    } catch (error) {
      logger.error('Failed to get draft by submission ID', error);
      throw error;
    }
  }

  /**
   * Clean up old approved/rejected drafts
   */
  async cleanupOldDrafts(daysToKeep: number = 30): Promise<number> {
    try {
      const result = await this.db.query(
        `DELETE FROM benefit_plan_drafts 
         WHERE status IN ('approved', 'rejected')
         AND updated_at < NOW() - INTERVAL '${daysToKeep} days'
         RETURNING id`
      );
      
      logger.info(`Cleaned up ${result.rowCount} old drafts`);
      return result.rowCount || 0;
      
    } catch (error) {
      logger.error('Failed to cleanup old drafts', error);
      throw error;
    }
  }
}

// Export singleton instance
export const retoolDraftService = new RetoolDraftService();
