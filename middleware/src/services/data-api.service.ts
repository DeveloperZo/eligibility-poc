import axios, { AxiosInstance } from 'axios';
import { 
  IEligibilityContext, 
  IEmployeeContext, 
  IHealthPlan, 
  IGroup,
  DataApiError 
} from '../models/interfaces';
import { logger } from '../utils/logger';

export class DataApiService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.DATA_API_URL || 'http://localhost:3001';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Data API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Data API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Data API Response: ${response.status}`, {
          url: response.config.url
        });
        return response;
      },
      (error) => {
        const message = error.response?.data?.message || error.message;
        const statusCode = error.response?.status;
        logger.error(`Data API Error: ${message}`, {
          statusCode,
          url: error.config?.url
        });
        throw new DataApiError(message, statusCode);
      }
    );
  }

  /**
   * Check Data API health and connectivity
   */
  async checkHealth(): Promise<{ status: 'connected' | 'disconnected' | 'error'; stats?: any }> {
    try {
      const response = await this.client.get('/health');
      
      if (response.status === 200 && response.data.status === 'OK') {
        return {
          status: 'connected',
          stats: response.data.dataStats
        };
      }
      
      return { status: 'disconnected' };
    } catch (error) {
      logger.error('Data API health check failed:', error);
      return { status: 'error' };
    }
  }

  /**
   * Get employee by ID
   */
  async getEmployee(employeeId: string): Promise<IEmployeeContext> {
    try {
      const response = await this.client.get(`/api/employees/${employeeId}`);
      
      if (!response.data.success) {
        throw new DataApiError(`Employee not found: ${employeeId}`, 404);
      }
      
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to get employee: ${employeeId}`, error);
      throw error;
    }
  }

  /**
   * Get all employees
   */
  async getAllEmployees(): Promise<IEmployeeContext[]> {
    try {
      const response = await this.client.get('/api/employees');
      
      if (!response.data.success) {
        throw new DataApiError('Failed to get employees');
      }
      
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get all employees:', error);
      throw error;
    }
  }

  /**
   * Get health plan by ID
   */
  async getHealthPlan(planId: string): Promise<IHealthPlan> {
    try {
      const response = await this.client.get(`/api/health-plans/${planId}`);
      
      if (!response.data.success) {
        throw new DataApiError(`Health plan not found: ${planId}`, 404);
      }
      
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to get health plan: ${planId}`, error);
      throw error;
    }
  }

  /**
   * Get all health plans
   */
  async getAllHealthPlans(): Promise<IHealthPlan[]> {
    try {
      const response = await this.client.get('/api/health-plans');
      
      if (!response.data.success) {
        throw new DataApiError('Failed to get health plans');
      }
      
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get all health plans:', error);
      throw error;
    }
  }

  /**
   * Get group by number
   */
  async getGroup(groupNumber: string): Promise<IGroup> {
    try {
      const response = await this.client.get(`/api/groups/${groupNumber}`);
      
      if (!response.data.success) {
        throw new DataApiError(`Group not found: ${groupNumber}`, 404);
      }
      
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to get group: ${groupNumber}`, error);
      throw error;
    }
  }

  /**
   * Get all groups
   */
  async getAllGroups(): Promise<IGroup[]> {
    try {
      const response = await this.client.get('/api/groups');
      
      if (!response.data.success) {
        throw new DataApiError('Failed to get groups');
      }
      
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get all groups:', error);
      throw error;
    }
  }

  /**
   * Get employee eligibility context (combined data)
   */
  async getEmployeeEligibilityContext(employeeId: string): Promise<IEligibilityContext> {
    try {
      const response = await this.client.get(`/api/employees/${employeeId}/eligibility-context`);
      
      if (!response.data.success) {
        throw new DataApiError(`Employee eligibility context not found: ${employeeId}`, 404);
      }
      
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to get employee eligibility context: ${employeeId}`, error);
      throw error;
    }
  }

  /**
   * Evaluate eligibility using the data API's simple evaluation
   */
  async evaluateEligibility(employeeId: string, rules?: any): Promise<any> {
    try {
      const response = await this.client.post('/api/evaluate-eligibility', {
        employeeId,
        rules
      });
      
      if (!response.data.success) {
        throw new DataApiError(`Failed to evaluate eligibility for employee: ${employeeId}`);
      }
      
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to evaluate eligibility: ${employeeId}`, error);
      throw error;
    }
  }
}

export const dataApiService = new DataApiService();
