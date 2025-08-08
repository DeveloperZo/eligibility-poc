import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

/**
 * Mock Aidbox Service for POC
 * Simulates Aidbox FHIR API without requiring actual connection
 * Stores data in JSON files to mimic Aidbox persistence
 */

export interface IFHIRResource {
  resourceType: string;
  id: string;
  meta?: {
    versionId: string;
    lastUpdated: string;
    profile?: string[];
  };
  status?: string;
  [key: string]: any;
}

export interface IInsurancePlan extends IFHIRResource {
  resourceType: 'InsurancePlan';
  status: 'draft' | 'active' | 'retired' | 'unknown';
  name: string;
  type?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  period?: {
    start: string;
    end?: string;
  };
  coverageArea?: Array<{
    reference: string;
    display?: string;
  }>;
  plan?: Array<{
    type?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    coverageBenefit?: Array<{
      type: {
        coding: Array<{
          system: string;
          code: string;
          display: string;
        }>;
      };
      requirement?: string;
      limit?: Array<{
        value?: {
          value: number;
          unit: string;
          system: string;
          code: string;
        };
      }>;
    }>;
  }>;
}

export class MockAidboxService {
  private dataPath: string;
  private resources: Map<string, Map<string, IFHIRResource[]>>; // resourceType -> id -> versions[]

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'mock-aidbox');
    this.resources = new Map();
    this.initialize();
  }

  /**
   * Initialize mock storage
   */
  private async initialize(): Promise<void> {
    try {
      // Create mock-aidbox directory if it doesn't exist
      await fs.mkdir(this.dataPath, { recursive: true });
      
      // Load existing data if available
      const dataFile = path.join(this.dataPath, 'resources.json');
      try {
        const data = await fs.readFile(dataFile, 'utf8');
        const parsed = JSON.parse(data);
        
        // Reconstruct the Map structure
        Object.entries(parsed).forEach(([resourceType, resources]) => {
          const typeMap = new Map<string, IFHIRResource[]>();
          Object.entries(resources as any).forEach(([id, versions]) => {
            typeMap.set(id, versions as IFHIRResource[]);
          });
          this.resources.set(resourceType, typeMap);
        });
        
        logger.info('Loaded mock Aidbox data');
      } catch {
        logger.info('No existing mock data, starting fresh');
        this.seedInitialData();
      }
    } catch (error) {
      logger.error('Error initializing mock Aidbox:', error);
    }
  }

  /**
   * Seed some initial test data
   */
  private async seedInitialData(): Promise<void> {
    // Create sample InsurancePlan
    const samplePlan: IInsurancePlan = {
      resourceType: 'InsurancePlan',
      id: 'sample-plan-001',
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString()
      },
      status: 'draft',
      name: 'Sample Health Plan',
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/insurance-plan-type',
          code: 'medical',
          display: 'Medical'
        }]
      }],
      period: {
        start: '2024-01-01'
      },
      plan: [{
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/insurance-plan-type',
            code: 'medical',
            display: 'Medical Benefits'
          }]
        },
        coverageBenefit: [{
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/insurance-plan-benefit-type',
              code: 'primary-care',
              display: 'Primary Care'
            }]
          },
          requirement: 'Referral required',
          limit: [{
            value: {
              value: 20,
              unit: 'visits/year',
              system: 'http://unitsofmeasure.org',
              code: '{visits}/a'
            }
          }]
        }]
      }]
    };

    const typeMap = new Map<string, IFHIRResource[]>();
    typeMap.set(samplePlan.id, [samplePlan]);
    this.resources.set('InsurancePlan', typeMap);
    
    await this.persist();
  }

  /**
   * Persist data to file
   */
  private async persist(): Promise<void> {
    try {
      const dataFile = path.join(this.dataPath, 'resources.json');
      
      // Convert Map to plain object for JSON serialization
      const data: any = {};
      this.resources.forEach((typeMap, resourceType) => {
        data[resourceType] = {};
        typeMap.forEach((versions, id) => {
          data[resourceType][id] = versions;
        });
      });
      
      await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error persisting mock data:', error);
    }
  }

  /**
   * Create a new resource (FHIR POST)
   */
  async create(resourceType: string, data: any): Promise<IFHIRResource> {
    const id = data.id || `${resourceType.toLowerCase()}-${uuidv4().substring(0, 8)}`;
    const resource: IFHIRResource = {
      ...data,
      resourceType,
      id,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        ...data.meta
      }
    };

    // Get or create type map
    if (!this.resources.has(resourceType)) {
      this.resources.set(resourceType, new Map());
    }
    const typeMap = this.resources.get(resourceType)!;
    
    // Store first version
    typeMap.set(id, [resource]);
    
    await this.persist();
    logger.info(`Created ${resourceType}/${id}`);
    
    return resource;
  }

  /**
   * Update a resource (FHIR PUT)
   */
  async update(resourceType: string, id: string, data: any): Promise<IFHIRResource> {
    const typeMap = this.resources.get(resourceType);
    if (!typeMap || !typeMap.has(id)) {
      throw new Error(`Resource ${resourceType}/${id} not found`);
    }

    const versions = typeMap.get(id)!;
    const currentVersion = versions[versions.length - 1];
    const newVersionNumber = parseInt(currentVersion.meta?.versionId || '1') + 1;

    const updatedResource: IFHIRResource = {
      ...data,
      resourceType,
      id,
      meta: {
        versionId: newVersionNumber.toString(),
        lastUpdated: new Date().toISOString(),
        ...data.meta
      }
    };

    // Add new version to history
    versions.push(updatedResource);
    
    await this.persist();
    logger.info(`Updated ${resourceType}/${id} to version ${newVersionNumber}`);
    
    return updatedResource;
  }

  /**
   * Get a resource (FHIR GET)
   */
  async get(resourceType: string, id: string): Promise<IFHIRResource | null> {
    const typeMap = this.resources.get(resourceType);
    if (!typeMap || !typeMap.has(id)) {
      return null;
    }

    const versions = typeMap.get(id)!;
    // Return latest version
    return versions[versions.length - 1];
  }

  /**
   * Get resource history (FHIR _history)
   */
  async getHistory(resourceType: string, id: string): Promise<IFHIRResource[]> {
    const typeMap = this.resources.get(resourceType);
    if (!typeMap || !typeMap.has(id)) {
      return [];
    }

    // Return all versions, newest first
    return typeMap.get(id)!.slice().reverse();
  }

  /**
   * Search resources (FHIR search)
   */
  async search(resourceType: string, params?: any): Promise<IFHIRResource[]> {
    const typeMap = this.resources.get(resourceType);
    if (!typeMap) {
      return [];
    }

    const results: IFHIRResource[] = [];
    
    typeMap.forEach((versions) => {
      const latest = versions[versions.length - 1];
      
      // Apply basic filters if provided
      if (params) {
        if (params.status && latest.status !== params.status) {
          return;
        }
        if (params.name && !latest.name?.includes(params.name)) {
          return;
        }
      }
      
      results.push(latest);
    });

    return results;
  }

  /**
   * Delete a resource (FHIR DELETE)
   */
  async delete(resourceType: string, id: string): Promise<void> {
    const typeMap = this.resources.get(resourceType);
    if (!typeMap || !typeMap.has(id)) {
      throw new Error(`Resource ${resourceType}/${id} not found`);
    }

    typeMap.delete(id);
    await this.persist();
    logger.info(`Deleted ${resourceType}/${id}`);
  }

  /**
   * Get a specific version of a resource
   */
  async getVersion(resourceType: string, id: string, versionId: string): Promise<IFHIRResource | null> {
    const typeMap = this.resources.get(resourceType);
    if (!typeMap || !typeMap.has(id)) {
      return null;
    }

    const versions = typeMap.get(id)!;
    return versions.find(v => v.meta?.versionId === versionId) || null;
  }

  /**
   * Create sample InsurancePlan for testing
   */
  async createSampleInsurancePlan(name: string, status: 'draft' | 'active' = 'draft'): Promise<IInsurancePlan> {
    const plan: Partial<IInsurancePlan> = {
      status,
      name,
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/insurance-plan-type',
          code: 'medical',
          display: 'Medical'
        }]
      }],
      period: {
        start: new Date().toISOString().split('T')[0]
      },
      plan: [{
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/insurance-plan-type',
            code: 'medical',
            display: 'Medical Benefits'
          }]
        }
      }]
    };

    return this.create('InsurancePlan', plan) as Promise<IInsurancePlan>;
  }
}

// Export singleton instance
export const mockAidboxService = new MockAidboxService();

// Also export as 'aidboxService' so code can work with both mock and real
export const aidboxService = mockAidboxService;
