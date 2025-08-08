import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface IPlanVersion {
  versionId: string;
  planId: string;
  version: string; // semantic version e.g., "1.0.0"
  state: 'draft' | 'published';
  content: any; // The actual plan data
  metadata: {
    author: string;
    createdAt: Date;
    publishedAt?: Date;
    approvers?: Array<{
      role: string;
      userId: string;
      approvedAt: Date;
      comments?: string;
    }>;
    previousVersion?: string;
  };
  immutable: boolean;
}

/**
 * CRAWL Phase - Core Plan Versioning Service
 * Implements immutable version snapshots with draft/published states
 */
export class PlanVersionService {
  private versionsPath = path.join(process.cwd(), 'data', 'plan-versions.json');
  private versions: Map<string, IPlanVersion> = new Map();

  constructor() {
    this.loadVersions();
  }

  /**
   * Load versions from file storage
   */
  private async loadVersions(): Promise<void> {
    try {
      const data = await fs.readFile(this.versionsPath, 'utf8');
      const versionsArray = JSON.parse(data);
      versionsArray.forEach((version: IPlanVersion) => {
        this.versions.set(version.versionId, version);
      });
      logger.info(`Loaded ${this.versions.size} plan versions`);
    } catch (error) {
      logger.info('No existing versions file, starting fresh');
      this.versions = new Map();
    }
  }

  /**
   * Save versions to file storage
   */
  private async saveVersions(): Promise<void> {
    try {
      const versionsArray = Array.from(this.versions.values());
      await fs.writeFile(this.versionsPath, JSON.stringify(versionsArray, null, 2));
      logger.info(`Saved ${versionsArray.length} plan versions`);
    } catch (error) {
      logger.error('Error saving versions:', error);
      throw error;
    }
  }

  /**
   * Create a new version of a plan
   * Core requirement: Support draft vs published states with immutability
   */
  async createVersion(
    plan: any,
    state: 'draft' | 'published',
    metadata: {
      author: string;
      approvers?: Array<{
        role: string;
        userId: string;
        approvedAt: Date;
        comments?: string;
      }>;
      previousVersion?: string;
    }
  ): Promise<IPlanVersion> {
    const versionId = uuidv4();
    const now = new Date();
    
    // Determine version number
    const planHistory = await this.getHistory(plan.planId);
    const latestVersion = planHistory[0];
    let versionNumber = '1.0.0';
    
    if (latestVersion) {
      const [major, minor, patch] = latestVersion.version.split('.').map(Number);
      if (state === 'published') {
        versionNumber = `${major}.${minor + 1}.0`; // Increment minor for published
      } else {
        versionNumber = `${major}.${minor}.${patch + 1}`; // Increment patch for draft
      }
    }

    const newVersion: IPlanVersion = {
      versionId,
      planId: plan.planId,
      version: versionNumber,
      state,
      content: { ...plan }, // Deep clone the plan content
      metadata: {
        author: metadata.author,
        createdAt: now,
        publishedAt: state === 'published' ? now : undefined,
        approvers: metadata.approvers,
        previousVersion: metadata.previousVersion || latestVersion?.versionId
      },
      immutable: state === 'published' // Published versions are immutable
    };

    this.versions.set(versionId, newVersion);
    await this.saveVersions();
    
    logger.info(`Created ${state} version ${versionNumber} for plan ${plan.planId}`);
    return newVersion;
  }

  /**
   * Get version history for a plan
   * Core requirement: List prior versions with timestamps and metadata
   */
  async getHistory(planId: string): Promise<IPlanVersion[]> {
    const history = Array.from(this.versions.values())
      .filter(v => v.planId === planId)
      .sort((a, b) => {
        // Sort by creation date, newest first
        return new Date(b.metadata.createdAt).getTime() - 
               new Date(a.metadata.createdAt).getTime();
      });
    
    return history;
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: string): Promise<IPlanVersion | null> {
    return this.versions.get(versionId) || null;
  }

  /**
   * Check if a version can be modified
   * Core requirement: Prevent modification of published versions
   */
  canModify(versionId: string): boolean {
    const version = this.versions.get(versionId);
    if (!version) return false;
    return !version.immutable && version.state === 'draft';
  }

  /**
   * Update a draft version (only allowed for drafts)
   */
  async updateDraft(versionId: string, updates: any): Promise<IPlanVersion | null> {
    if (!this.canModify(versionId)) {
      logger.error(`Cannot modify version ${versionId} - either immutable or not found`);
      return null;
    }

    const version = this.versions.get(versionId)!;
    version.content = { ...version.content, ...updates };
    version.metadata.createdAt = new Date(); // Update timestamp
    
    await this.saveVersions();
    logger.info(`Updated draft version ${versionId}`);
    return version;
  }
}

// Export singleton instance
export const planVersionService = new PlanVersionService();