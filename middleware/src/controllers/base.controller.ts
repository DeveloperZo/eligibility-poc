import { Request, Response, NextFunction } from 'express';
import { IApiResponse } from '../models/interfaces';
import { camundaService } from '../services/camunda.service';
import { dataApiService } from '../services/data-api.service';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

export class BaseController {
  /**
   * Get system information
   */
  public async getSystemInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response: IApiResponse = {
        success: true,
        data: {
          service: 'eligibility-middleware',
          version: '1.0.0',
          environment: config.nodeEnv,
          timestamp: new Date().toISOString(),
          endpoints: {
            health: '/health',
            systemInfo: '/api/system/info',
            camunda: {
              health: '/api/camunda/health',
              engines: '/api/camunda/engines',
              decisionDefinitions: '/api/camunda/decision-definitions'
            },
            data: {
              health: '/api/data/health',
              employees: '/api/data/employees',
              healthPlans: '/api/data/health-plans',
              groups: '/api/data/groups'
            },
            rules: {
              list: '/api/rules',
              create: 'POST /api/rules',
              get: '/api/rules/:id',
              update: 'PUT /api/rules/:id',
              delete: 'DELETE /api/rules/:id'
            },
            evaluation: {
              evaluate: 'POST /api/evaluate',
              batch: 'POST /api/evaluate/batch'
            }
          }
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get configuration information (safe for client)
   */
  public async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response: IApiResponse = {
        success: true,
        data: {
          environment: config.nodeEnv,
          logLevel: config.logLevel,
          services: {
            camunda: {
              baseUrl: config.camundaBaseUrl,
              engineName: config.camundaEngineName
            },
            dataApi: {
              baseUrl: config.dataApiUrl
            }
          },
          features: {
            rulesManagement: true,
            dmnGeneration: true,
            eligibilityEvaluation: true,
            retoolIntegration: true
          }
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test connectivity to all external services
   */
  public async testConnectivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('Testing connectivity to external services');
      
      const [camundaResult, dataApiResult] = await Promise.allSettled([
        camundaService.checkHealth(),
        dataApiService.checkHealth()
      ]);

      const connectivityResults = {
        camunda: {
          status: camundaResult.status === 'fulfilled' ? camundaResult.value.status : 'error',
          info: camundaResult.status === 'fulfilled' ? camundaResult.value.info : undefined,
          error: camundaResult.status === 'rejected' ? camundaResult.reason.message : undefined
        },
        dataApi: {
          status: dataApiResult.status === 'fulfilled' ? dataApiResult.value.status : 'error',
          stats: dataApiResult.status === 'fulfilled' ? dataApiResult.value.stats : undefined,
          error: dataApiResult.status === 'rejected' ? dataApiResult.reason.message : undefined
        }
      };

      const allHealthy = Object.values(connectivityResults).every(
        service => service.status === 'connected'
      );

      const response: IApiResponse = {
        success: allHealthy,
        data: {
          overall: allHealthy ? 'healthy' : 'degraded',
          services: connectivityResults,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date()
      };

      // Set appropriate HTTP status code
      if (!allHealthy) {
        res.status(503); // Service Unavailable
      }
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get detailed system metrics
   */
  public async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      const response: IApiResponse = {
        success: true,
        data: {
          system: {
            uptime: Math.round(uptime),
            uptimeFormatted: this.formatUptime(uptime),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
          },
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            external: Math.round(memoryUsage.external / 1024 / 1024) // MB
          },
          environment: {
            nodeEnv: config.nodeEnv,
            logLevel: config.logLevel,
            port: config.port
          }
        },
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}

export const baseController = new BaseController();
