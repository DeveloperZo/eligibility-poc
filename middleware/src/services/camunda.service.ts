import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  ICamundaDeployment, 
  IDmnEvaluationRequest, 
  IDmnEvaluationResponse, 
  ICamundaEngineInfo,
  CamundaConnectionError 
} from '../models/interfaces';
import { logger } from '../utils/logger';

export class CamundaService {
  private client: AxiosInstance;
  private baseUrl: string;
  private engineName: string;

  constructor() {
    this.baseUrl = process.env.CAMUNDA_BASE_URL || 'http://localhost:8080';
    this.engineName = process.env.CAMUNDA_ENGINE_NAME || 'default';
    
    this.client = axios.create({
      baseURL: `${this.baseUrl}/engine-rest`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Camunda Request: ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Camunda Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Camunda Response: ${response.status}`, {
          url: response.config.url,
          data: response.data
        });
        return response;
      },
      (error) => {
        const message = error.response?.data?.message || error.message;
        const statusCode = error.response?.status;
        logger.error(`Camunda Error: ${message}`, {
          statusCode,
          url: error.config?.url,
          method: error.config?.method
        });
        throw new CamundaConnectionError(message, statusCode);
      }
    );

    // Add authentication if credentials are provided
    const username = process.env.CAMUNDA_ADMIN_USER;
    const password = process.env.CAMUNDA_ADMIN_PASSWORD;
    if (username && password) {
      this.client.defaults.auth = { username, password };
    }
  }

  /**
   * Check Camunda engine health and connectivity
   */
  async checkHealth(): Promise<{ status: 'connected' | 'disconnected' | 'error'; info?: ICamundaEngineInfo }> {
    try {
      const response: AxiosResponse<ICamundaEngineInfo[]> = await this.client.get('/engine');
      
      if (response.data && response.data.length > 0) {
        const engineInfo = response.data.find(engine => engine.name === this.engineName) || response.data[0];
        return {
          status: 'connected',
          info: engineInfo
        };
      }
      
      return { status: 'disconnected' };
    } catch (error) {
      logger.error('Camunda health check failed:', error);
      return { status: 'error' };
    }
  }

  /**
   * Deploy a DMN file to Camunda
   */
  async deployDmn(fileName: string, dmnXml: string, deploymentName?: string): Promise<ICamundaDeployment> {
    try {
      // For Node.js, we need to use a different approach than browser FormData
      const boundary = `----formdata-boundary-${Date.now()}`;
      
      let formDataBody = '';
      
      // Add deployment-name field
      formDataBody += `--${boundary}\r\n`;
      formDataBody += `Content-Disposition: form-data; name="deployment-name"\r\n\r\n`;
      formDataBody += `${deploymentName || `DMN-${Date.now()}`}\r\n`;
      
      // Add deployment-source field
      formDataBody += `--${boundary}\r\n`;
      formDataBody += `Content-Disposition: form-data; name="deployment-source"\r\n\r\n`;
      formDataBody += `eligibility-middleware\r\n`;
      
      // Add enable-duplicate-filtering field
      formDataBody += `--${boundary}\r\n`;
      formDataBody += `Content-Disposition: form-data; name="enable-duplicate-filtering"\r\n\r\n`;
      formDataBody += `false\r\n`;
      
      // Add DMN file
      formDataBody += `--${boundary}\r\n`;
      formDataBody += `Content-Disposition: form-data; name="${fileName}"; filename="${fileName}"\r\n`;
      formDataBody += `Content-Type: text/xml\r\n\r\n`;
      formDataBody += `${dmnXml}\r\n`;
      
      // Close boundary
      formDataBody += `--${boundary}--\r\n`;
      
      const response = await this.client.post('/deployment/create', formDataBody, {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      });

      logger.info(`DMN deployed successfully: ${response.data.id}`, {
        deploymentId: response.data.id,
        fileName
      });

      return {
        id: response.data.id,
        name: response.data.name,
        source: response.data.source,
        deploymentTime: new Date(response.data.deploymentTime),
        tenantId: response.data.tenantId
      };
    } catch (error) {
      logger.error(`Failed to deploy DMN: ${fileName}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a DMN decision table
   */
  async evaluateDmn(decisionDefinitionKey: string, variables: any): Promise<IDmnEvaluationResponse> {
    try {
      // Convert variables to Camunda format
      const camundaVariables: IDmnEvaluationRequest = {
        variables: {}
      };

      Object.keys(variables).forEach(key => {
        const value = variables[key];
        camundaVariables.variables[key] = {
          value: value,
          type: this.inferVariableType(value)
        };
      });

      const response = await this.client.post(
        `/decision-definition/key/${decisionDefinitionKey}/evaluate`,
        camundaVariables
      );

      logger.info(`DMN evaluation completed: ${decisionDefinitionKey}`, {
        decisionKey: decisionDefinitionKey,
        resultCount: response.data.length
      });

      return {
        result: response.data
      };
    } catch (error) {
      logger.error(`Failed to evaluate DMN: ${decisionDefinitionKey}`, error);
      throw error;
    }
  }

  /**
   * Get all deployed decision definitions
   */
  async getDecisionDefinitions(): Promise<any[]> {
    try {
      const response = await this.client.get('/decision-definition');
      return response.data;
    } catch (error) {
      logger.error('Failed to get decision definitions:', error);
      throw error;
    }
  }

  /**
   * Get specific decision definition by key or ID
   */
  async getDecisionDefinition(keyOrId: string): Promise<any> {
    try {
      // Try by key first
      let response;
      try {
        response = await this.client.get(`/decision-definition/key/${keyOrId}`);
      } catch (keyError) {
        // If key lookup fails, try by ID
        response = await this.client.get(`/decision-definition/${keyOrId}`);
      }
      return response.data;
    } catch (error) {
      logger.error(`Failed to get decision definition: ${keyOrId}`, error);
      return null; // Return null instead of throwing to allow caller to handle gracefully
    }
  }

  /**
   * Get all deployments
   */
  async getDeployments(): Promise<any[]> {
    try {
      const response = await this.client.get('/deployment');
      return response.data;
    } catch (error) {
      logger.error('Failed to get deployments:', error);
      throw error;
    }
  }

  /**
   * Evaluate a DMN decision using Camunda REST API with pre-formatted variables
   */
  async evaluateDecision(decisionDefinitionKey: string, variables: any): Promise<any[]> {
    try {
      logger.info(`Evaluating DMN decision: ${decisionDefinitionKey}`, {
        decisionKey: decisionDefinitionKey,
        variables: Object.keys(variables)
      });

      // Variables should already be in Camunda format when passed here
      const camundaVariables = {
        variables: variables
      };

      const response = await this.client.post(
        `/decision-definition/key/${decisionDefinitionKey}/evaluate`,
        camundaVariables
      );

      logger.info(`DMN evaluation completed: ${decisionDefinitionKey}`, {
        decisionKey: decisionDefinitionKey,
        resultCount: response.data.length
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to evaluate DMN: ${decisionDefinitionKey}`, error);
      throw error;
    }
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(deploymentId: string, cascade: boolean = true): Promise<void> {
    try {
      await this.client.delete(`/deployment/${deploymentId}`, {
        params: { cascade }
      });
      
      logger.info(`Deployment deleted: ${deploymentId}`, { cascade });
    } catch (error) {
      logger.error(`Failed to delete deployment: ${deploymentId}`, error);
      throw error;
    }
  }

  /**
   * Infer Camunda variable type from JavaScript value
   */
  private inferVariableType(value: any): string {
    if (typeof value === 'boolean') return 'Boolean';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Integer' : 'Double';
    }
    if (typeof value === 'string') return 'String';
    if (value instanceof Date) return 'Date';
    if (value === null || value === undefined) return 'Null';
    return 'Object';
  }

  /**
   * Get engine information
   */
  async getEngineInfo(): Promise<ICamundaEngineInfo[]> {
    try {
      const response = await this.client.get('/engine');
      return response.data;
    } catch (error) {
      logger.error('Failed to get engine info:', error);
      throw error;
    }
  }
}

export const camundaService = new CamundaService();
