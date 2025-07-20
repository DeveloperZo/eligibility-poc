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

    /**
     * @swagger
     * /health:
     *   get:
     *     summary: Health Check
     *     description: Check the health status of the middleware and all dependencies
     *     tags: [System]
     *     responses:
     *       200:
     *         description: Service is healthy
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       503:
     *         description: Service unhealthy - dependency issues
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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

    /**
     * @swagger
     * /api/camunda/health:
     *   get:
     *     summary: Camunda Health Check
     *     description: Check the health status of the Camunda engine
     *     tags: [Camunda]
     *     responses:
     *       200:
     *         description: Camunda is healthy
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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

    /**
     * @swagger
     * /api/camunda/engines:
     *   get:
     *     summary: Get Camunda Engine Information
     *     description: Retrieve information about available Camunda engines
     *     tags: [Camunda]
     *     responses:
     *       200:
     *         description: Engine information retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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

    /**
     * @swagger
     * /api/camunda/decision-definitions:
     *   get:
     *     summary: Get Decision Definitions
     *     description: Retrieve all deployed decision definitions from Camunda
     *     tags: [Camunda]
     *     responses:
     *       200:
     *         description: Decision definitions retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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

    /**
     * @swagger
     * /api/data/health:
     *   get:
     *     summary: Data API Health Check
     *     description: Check the health status of the Data API service
     *     tags: [Data API]
     *     responses:
     *       200:
     *         description: Data API is healthy
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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

    /**
     * @swagger
     * /api/data/employees:
     *   get:
     *     summary: Get All Employees
     *     description: Retrieve all employees from the system
     *     tags: [Data API]
     *     responses:
     *       200:
     *         description: Employees retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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

    /**
     * @swagger
     * /api/data/employees/{id}:
     *   get:
     *     summary: Get Employee by ID
     *     description: Retrieve a specific employee by their ID
     *     tags: [Data API]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         description: Employee ID
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Employee retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       404:
     *         description: Employee not found
     */
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

    /**
     * @swagger
     * /api/data/employees/{id}/context:
     *   get:
     *     summary: Get Employee Eligibility Context
     *     description: Retrieve full eligibility context for an employee including health plans and group memberships
     *     tags: [Data API]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         description: Employee ID
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Employee context retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       404:
     *         description: Employee not found
     */
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

    /**
     * @swagger
     * /api/data/health-plans:
     *   get:
     *     summary: Get All Health Plans
     *     description: Retrieve all available health plans in the system
     *     tags: [Data API]
     *     responses:
     *       200:
     *         description: Health plans retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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

    /**
     * @swagger
     * /api/data/groups:
     *   get:
     *     summary: Get All Groups
     *     description: Retrieve all employee groups in the system
     *     tags: [Data API]
     *     responses:
     *       200:
     *         description: Groups retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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

    /**
     * @swagger
     * /api/rules:
     *   get:
     *     summary: List All Rules
     *     description: Retrieve all deployed eligibility rules from Camunda
     *     tags: [Rules Management]
     *     responses:
     *       200:
     *         description: Rules retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    // Rules management endpoints
    router.get('/rules', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { rulesController } = await import('./controllers/rules.controller');
        return rulesController.listRules(req, res, next);
      } catch (error) {
        next(error);
      }
    });

    /**
     * @swagger
     * /api/rules/create:
     *   post:
     *     summary: Create New Rule
     *     description: Create and deploy a new eligibility rule to Camunda
     *     tags: [Rules Management]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 description: Rule name
     *               description:
     *                 type: string
     *                 description: Rule description
     *               ruleDmn:
     *                 type: string
     *                 description: DMN XML content
     *             required:
     *               - name
     *               - ruleDmn
     *     responses:
     *       201:
     *         description: Rule created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       400:
     *         description: Invalid rule data
     */
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

    /**
     * @swagger
     * /api/rules/{id}:
     *   get:
     *     summary: Get Rule by ID
     *     description: Retrieve a specific rule by its ID
     *     tags: [Rules Management]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         description: Rule ID
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Rule retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       404:
     *         description: Rule not found
     */
    router.get('/rules/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { rulesController } = await import('./controllers/rules.controller');
        return rulesController.getRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });

    /**
     * @swagger
     * /api/rules/{id}:
     *   put:
     *     summary: Update Rule
     *     description: Update an existing eligibility rule
     *     tags: [Rules Management]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         description: Rule ID
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 description: Rule name
     *               description:
     *                 type: string
     *                 description: Rule description
     *               ruleDmn:
     *                 type: string
     *                 description: DMN XML content
     *     responses:
     *       200:
     *         description: Rule updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       404:
     *         description: Rule not found
     */
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

    /**
     * @swagger
     * /api/rules/{id}:
     *   delete:
     *     summary: Delete Rule
     *     description: Delete a rule from Camunda
     *     tags: [Rules Management]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         description: Rule ID
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Rule deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       404:
     *         description: Rule not found
     */
    router.delete('/rules/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { rulesController } = await import('./controllers/rules.controller');
        return rulesController.deleteRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });

    /**
     * @swagger
     * /api/rules/{id}/test:
     *   post:
     *     summary: Test Rule
     *     description: Test a specific rule with sample employee data
     *     tags: [Rules Management]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         description: Rule ID
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               employeeId:
     *                 type: string
     *                 description: Employee ID to test
     *               testData:
     *                 type: object
     *                 description: Optional test data override
     *             required:
     *               - employeeId
     *     responses:
     *       200:
     *         description: Rule test completed
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       404:
     *         description: Rule or employee not found
     */
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

    /**
     * @swagger
     * /api/evaluate:
     *   post:
     *     summary: Evaluate Employee Eligibility
     *     description: Evaluate an employee's eligibility for benefits using deployed rules
     *     tags: [Eligibility Evaluation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               employeeId:
     *                 type: string
     *                 description: Employee ID to evaluate
     *               ruleId:
     *                 type: string
     *                 description: Specific rule ID to use (optional)
     *               context:
     *                 type: object
     *                 description: Additional context data (optional)
     *             required:
     *               - employeeId
     *     responses:
     *       200:
     *         description: Evaluation completed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       404:
     *         description: Employee not found
     */
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

    /**
     * @swagger
     * /api/evaluate/batch:
     *   post:
     *     summary: Batch Evaluate Multiple Employees
     *     description: Evaluate multiple employees' eligibility in a single request
     *     tags: [Eligibility Evaluation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               employeeIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of employee IDs to evaluate
     *               ruleId:
     *                 type: string
     *                 description: Specific rule ID to use (optional)
     *             required:
     *               - employeeIds
     *     responses:
     *       200:
     *         description: Batch evaluation completed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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

    /**
     * @swagger
     * /api/evaluate/history/{employeeId}:
     *   get:
     *     summary: Get Evaluation History
     *     description: Retrieve evaluation history for a specific employee
     *     tags: [Eligibility Evaluation]
     *     parameters:
     *       - in: path
     *         name: employeeId
     *         required: true
     *         description: Employee ID
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Evaluation history retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     *       404:
     *         description: Employee not found
     */
    router.get('/evaluate/history/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { evaluationController } = await import('./controllers/evaluation.controller');
        return evaluationController.getEvaluationHistory(req, res, next);
      } catch (error) {
        next(error);
      }
    });

    /**
     * @swagger
     * /api/dmn/templates:
     *   get:
     *     summary: Get DMN Templates
     *     description: Retrieve available DMN rule templates
     *     tags: [DMN Generation]
     *     responses:
     *       200:
     *         description: Templates retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    // DMN generation endpoints
    router.get('/dmn/templates', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.getTemplates(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/generate:
     *   post:
     *     summary: Generate DMN Rule
     *     description: Generate a DMN rule from business logic specification
     *     tags: [DMN Generation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               ruleType:
     *                 type: string
     *                 enum: [age, health-plan, group-number, custom]
     *                 description: Type of rule to generate
     *               parameters:
     *                 type: object
     *                 description: Rule parameters specific to the rule type
     *             required:
     *               - ruleType
     *               - parameters
     *     responses:
     *       200:
     *         description: DMN rule generated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    router.post('/dmn/generate', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateDmn(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/generate-and-deploy:
     *   post:
     *     summary: Generate and Deploy DMN Rule
     *     description: Generate a DMN rule and immediately deploy it to Camunda
     *     tags: [DMN Generation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               ruleType:
     *                 type: string
     *                 enum: [age, health-plan, group-number, custom]
     *                 description: Type of rule to generate
     *               parameters:
     *                 type: object
     *                 description: Rule parameters specific to the rule type
     *               deploymentName:
     *                 type: string
     *                 description: Name for the deployment
     *             required:
     *               - ruleType
     *               - parameters
     *     responses:
     *       201:
     *         description: DMN rule generated and deployed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    router.post('/dmn/generate-and-deploy', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateAndDeploy(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/generate/age:
     *   post:
     *     summary: Generate Age-Based Rule
     *     description: Generate a DMN rule based on employee age criteria
     *     tags: [DMN Generation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               minAge:
     *                 type: number
     *                 description: Minimum age requirement
     *               maxAge:
     *                 type: number
     *                 description: Maximum age requirement
     *               eligibilityResult:
     *                 type: string
     *                 description: Result when conditions are met
     *             required:
     *               - minAge
     *               - eligibilityResult
     *     responses:
     *       200:
     *         description: Age-based rule generated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    router.post('/dmn/generate/age', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateAgeRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/generate/health-plan:
     *   post:
     *     summary: Generate Health Plan Rule
     *     description: Generate a DMN rule based on health plan eligibility
     *     tags: [DMN Generation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               healthPlanIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: List of eligible health plan IDs
     *               eligibilityResult:
     *                 type: string
     *                 description: Result when conditions are met
     *             required:
     *               - healthPlanIds
     *               - eligibilityResult
     *     responses:
     *       200:
     *         description: Health plan rule generated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    router.post('/dmn/generate/health-plan', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateHealthPlanRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/generate/group-number:
     *   post:
     *     summary: Generate Group Number Rule
     *     description: Generate a DMN rule based on employee group membership
     *     tags: [DMN Generation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               groupNumbers:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: List of eligible group numbers
     *               eligibilityResult:
     *                 type: string
     *                 description: Result when conditions are met
     *             required:
     *               - groupNumbers
     *               - eligibilityResult
     *     responses:
     *       200:
     *         description: Group number rule generated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    router.post('/dmn/generate/group-number', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateGroupNumberRule(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/test:
     *   post:
     *     summary: Test DMN Rule
     *     description: Test a DMN rule with sample data without deploying
     *     tags: [DMN Generation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               dmnXml:
     *                 type: string
     *                 description: DMN XML content to test
     *               testData:
     *                 type: object
     *                 description: Test input data
     *             required:
     *               - dmnXml
     *               - testData
     *     responses:
     *       200:
     *         description: DMN test completed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    router.post('/dmn/test', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.testDmn(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/validate:
     *   post:
     *     summary: Validate DMN Rule
     *     description: Validate DMN XML structure and syntax
     *     tags: [DMN Generation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               dmnXml:
     *                 type: string
     *                 description: DMN XML content to validate
     *             required:
     *               - dmnXml
     *     responses:
     *       200:
     *         description: DMN validation completed
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    router.post('/dmn/validate', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.validateDmn(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/custom:
     *   post:
     *     summary: Generate Custom DMN Rule
     *     description: Generate a custom DMN rule with flexible conditions
     *     tags: [DMN Generation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               ruleName:
     *                 type: string
     *                 description: Name for the custom rule
     *               conditions:
     *                 type: array
     *                 items:
     *                   type: object
     *                 description: Array of custom conditions
     *               outputResult:
     *                 type: string
     *                 description: Result when conditions are met
     *             required:
     *               - ruleName
     *               - conditions
     *               - outputResult
     *     responses:
     *       200:
     *         description: Custom DMN rule generated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    router.post('/dmn/custom', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.generateCustomDmn(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/batch:
     *   post:
     *     summary: Batch Generate DMN Rules
     *     description: Generate multiple DMN rules in a single request
     *     tags: [DMN Generation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               rules:
     *                 type: array
     *                 items:
     *                   type: object
     *                 description: Array of rule specifications
     *             required:
     *               - rules
     *     responses:
     *       200:
     *         description: Batch generation completed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
    router.post('/dmn/batch', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { dmnController } = await import('./controllers/dmn.controller');
        return dmnController.batchGenerate(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    
    /**
     * @swagger
     * /api/dmn/sample:
     *   get:
     *     summary: Get Sample DMN Rule
     *     description: Generate a sample DMN rule for demonstration purposes
     *     tags: [DMN Generation]
     *     responses:
     *       200:
     *         description: Sample DMN rule generated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse'
     */
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
