import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { getSwaggerSpec } from './config/swagger.config';
import { IApiResponse, IHealthCheckResponse } from './models/interfaces';
import { logger } from './utils/logger';
import { camundaService } from './services/camunda.service';
import { dataApiService } from './services/data-api.service';

export class App {
  public app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.MIDDLEWARE_PORT || '3000');
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disabled for Retool integration
    }));

    // CORS configuration for Retool integration and ngrok
    this.app.use(cors({
      origin: [
        process.env.RETOOL_BASE_URL || 'https://gatekeeperzo34.retool.com',
        'https://20f445bf2d03.ngrok-free.app',
        /\.ngrok-free\.app$/,  // Allow any ngrok-free.app subdomain
        'http://localhost:3000',
        'https://localhost:3000'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning'],
      optionsSuccessStatus: 200 // Some legacy browsers choke on 204
    }));

    // Handle preflight requests
    this.app.options('*', cors());

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info(`${req.method} ${req.path}`, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      next();
    });
  }

  private initializeRoutes(): void {
    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      const response: IApiResponse = {
        success: true,
        data: {
          message: 'Eligibility Rule Management Middleware',
          version: '1.0.0',
          service: 'eligibility-middleware',
          endpoints: {
            health: '/health',
            api: {
              rules: '/api/rules',
              evaluate: '/api/evaluate',
              camunda: '/api/camunda',
              data: '/api/data',
              dmn: '/api/dmn'
            },
            rules: {
              'GET /api/rules': 'List all deployed rules',
              'POST /api/rules/create': 'Create and deploy new rule',
              'GET /api/rules/:id': 'Get rule by ID',
              'PUT /api/rules/:id': 'Update existing rule',
              'DELETE /api/rules/:id': 'Delete rule from Camunda',
              'POST /api/rules/:id/test': 'Test rule with sample data'
            },
            evaluation: {
              'POST /api/evaluate': 'Evaluate employee eligibility',
              'POST /api/evaluate/batch': 'Batch evaluate multiple employees',
              'GET /api/evaluate/history/:employeeId': 'Get evaluation history for employee'
            }
          }
        },
        timestamp: new Date()
      };
      
      res.json(response);
    });

    // Health check endpoint with dependency checks
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        // Check all dependencies
        const [camundaHealth, dataApiHealth] = await Promise.allSettled([
          camundaService.checkHealth(),
          dataApiService.checkHealth()
        ]);

        const healthResponse: IHealthCheckResponse = {
          status: 'OK',
          timestamp: new Date().toISOString(),
          service: 'eligibility-middleware',
          version: '1.0.0',
          dependencies: {
            camunda: camundaHealth.status === 'fulfilled' ? camundaHealth.value.status : 'error',
            database: 'connected', // Will be implemented later
            dataApi: dataApiHealth.status === 'fulfilled' ? dataApiHealth.value.status : 'error'
          }
        };

        // Determine overall health status
        const hasErrors = Object.values(healthResponse.dependencies).some(status => 
          status === 'error' || status === 'disconnected'
        );

        if (hasErrors) {
          healthResponse.status = 'ERROR';
          res.status(503);
        }

        const response: IApiResponse<IHealthCheckResponse> = {
          success: true,
          data: healthResponse,
          timestamp: new Date()
        };

        res.json(response);
      } catch (error) {
        logger.error('Health check failed:', error);
        
        const response: IApiResponse = {
          success: false,
          error: {
            code: 'HEALTH_CHECK_FAILED',
            message: 'Health check failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          timestamp: new Date()
        };
        
        res.status(500).json(response);
      }
    });

    /**
     * @swagger
     * /api-docs:
     *   get:
     *     summary: API Documentation
     *     description: Swagger UI for interactive API documentation
     *     tags: [System]
     *     responses:
     *       200:
     *         description: Swagger UI page
     */
    this.app.use('/api-docs', swaggerUi.serve);
    this.app.get('/api-docs', (req: Request, res: Response) => {
      // Generate dynamic spec for each request
      const spec = getSwaggerSpec(req);
      const html = swaggerUi.generateHTML(spec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Eligibility Rule Management API Documentation',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true
        }
      });
      res.send(html);
    });

    /**
     * @swagger
     * /openapi.json:
     *   get:
     *     summary: OpenAPI Specification
     *     description: Raw OpenAPI 3.0 specification in JSON format for API clients
     *     tags: [System]
     *     produces:
     *       - application/json
     *     responses:
     *       200:
     *         description: OpenAPI specification
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     */
    this.app.get('/openapi.json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.json(getSwaggerSpec(req)); // Pass the request for dynamic URL
    });

    // API routes placeholder
    this.app.use('/api', this.createApiRouter());

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      const response: IApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.originalUrl} not found`
        },
        timestamp: new Date()
      };
      
      res.status(404).json(response);
    });
  }

  private createApiRouter(): express.Router {
    const router = express.Router();

    // Camunda endpoints
    router.get('/camunda/health', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const health = await camundaService.checkHealth();
        
        const response: IApiResponse = {
          success: true,
          data: health,
          timestamp: new Date()
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    router.get('/camunda/engines', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const engines = await camundaService.getEngineInfo();
        
        const response: IApiResponse = {
          success: true,
          data: engines,
          timestamp: new Date()
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    router.get('/camunda/decision-definitions', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const definitions = await camundaService.getDecisionDefinitions();
        
        const response: IApiResponse = {
          success: true,
          data: definitions,
          timestamp: new Date()
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    // Data API endpoints
    router.get('/data/health', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const health = await dataApiService.checkHealth();
        
        const response: IApiResponse = {
          success: true,
          data: health,
          timestamp: new Date()
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    router.get('/data/employees', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const employees = await dataApiService.getAllEmployees();
        
        const response: IApiResponse = {
          success: true,
          data: employees,
          timestamp: new Date()
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    router.get('/data/employees/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const employee = await dataApiService.getEmployee(id);
        
        const response: IApiResponse = {
          success: true,
          data: employee,
          timestamp: new Date()
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    router.get('/data/employees/:id/context', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const context = await dataApiService.getEmployeeEligibilityContext(id);
        
        const response: IApiResponse = {
          success: true,
          data: context,
          timestamp: new Date()
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    router.get('/data/health-plans', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const healthPlans = await dataApiService.getAllHealthPlans();
        
        const response: IApiResponse = {
          success: true,
          data: healthPlans,
          timestamp: new Date()
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    router.get('/data/groups', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const groups = await dataApiService.getAllGroups();
        
        const response: IApiResponse = {
          success: true,
          data: groups,
          timestamp: new Date()
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    // Rules management endpoints
    router.get('/rules', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { rulesController } = await import('./controllers/rules.controller');
        return rulesController.listRules(req, res, next);
      } catch (error) {
        next(error);
      }
    });

    router.post('/rules/create', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { ValidationMiddleware } = await import('./middleware/validation.middleware');
        const { rulesController } = await import('./controllers/rules.controller');
        
        // Apply validation middleware
        ValidationMiddleware.ruleCreationValidation()(req, res, (err) => {
          if (err) return next(err);
          return rulesController.createRule(req, res, next);
        });
      } catch (error) {
        next(error);
      }
    });

    router.get('/rules/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { rulesController } = await import('./controllers/rules.controller');
        return rulesController.getRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });

    router.put('/rules/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { ValidationMiddleware } = await import('./middleware/validation.middleware');
        const { rulesController } = await import('./controllers/rules.controller');
        
        ValidationMiddleware.ruleUpdateValidation()(req, res, (err) => {
          if (err) return next(err);
          return rulesController.updateRule(req, res, next);
        });
      } catch (error) {
        next(error);
      }
    });

    router.delete('/rules/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { rulesController } = await import('./controllers/rules.controller');
        return rulesController.deleteRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });

    router.post('/rules/:id/test', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { ValidationMiddleware } = await import('./middleware/validation.middleware');
        const { rulesController } = await import('./controllers/rules.controller');
        
        ValidationMiddleware.ruleTestValidation()(req, res, (err) => {
          if (err) return next(err);
          return rulesController.testRule(req, res, next);
        });
      } catch (error) {
        next(error);
      }
    });

    // Evaluation endpoints
    router.post('/evaluate', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { ValidationMiddleware } = await import('./middleware/validation.middleware');
        const { evaluationController } = await import('./controllers/evaluation.controller');
        
        ValidationMiddleware.evaluationValidation()(req, res, (err) => {
          if (err) return next(err);
          return evaluationController.evaluateEligibility(req, res, next);
        });
      } catch (error) {
        next(error);
      }
    });

    router.post('/evaluate/batch', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { ValidationMiddleware } = await import('./middleware/validation.middleware');
        const { evaluationController } = await import('./controllers/evaluation.controller');
        
        ValidationMiddleware.batchEvaluationValidation()(req, res, (err) => {
          if (err) return next(err);
          return evaluationController.batchEvaluateEligibility(req, res, next);
        });
      } catch (error) {
        next(error);
      }
    });

    router.get('/evaluate/history/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { evaluationController } = await import('./controllers/evaluation.controller');
        return evaluationController.getEvaluationHistory(req, res, next);
      } catch (error) {
        next(error);
      }
    });

    // DMN generation endpoints
    router.get('/dmn/templates', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.getTemplates(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/dmn/generate', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateDmn(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/dmn/generate-and-deploy', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateAndDeploy(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/dmn/generate/age', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateAgeRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/dmn/generate/health-plan', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateHealthPlanRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/dmn/generate/group-number', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateGroupNumberRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/dmn/test', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.testDmn(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/dmn/validate', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.validateDmn(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/dmn/custom', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateCustomDmn(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/dmn/batch', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.batchGenerate(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    router.get('/dmn/sample', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateSample(req, res, next);
      } catch (error) {
        next(error);
      }
    });

    return router;
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error:', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
        body: req.body,
        params: req.params,
        query: req.query
      });

      const response: IApiResponse = {
        success: false,
        error: {
          code: error.name || 'INTERNAL_ERROR',
          message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        timestamp: new Date()
      };

      // Determine status code based on error type
      let statusCode = 500;
      if (error.name === 'DataApiError' || error.name === 'CamundaConnectionError') {
        statusCode = 503; // Service Unavailable
      } else if (error.name === 'ValidationError' || error.name === 'RuleValidationError') {
        statusCode = 400; // Bad Request
      } else if (error.message.includes('not found')) {
        statusCode = 404; // Not Found
      }

      res.status(statusCode).json(response);
    });
  }

  public listen(): void {
    this.app.listen(this.port, () => {
      logger.info(`Eligibility Middleware server started`, {
        port: this.port,
        environment: process.env.NODE_ENV || 'development',
        camundaUrl: process.env.CAMUNDA_BASE_URL,
        dataApiUrl: process.env.DATA_API_URL
      });
      
      console.log(`🚀 Eligibility Middleware running on port ${this.port}`);
      console.log(`📋 Health check: http://localhost:${this.port}/health`);
      console.log(`📖 API documentation: http://localhost:${this.port}/`);
    });
  }

  public getApp(): Application {
    return this.app;
  }
}
