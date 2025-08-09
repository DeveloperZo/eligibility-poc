interface IConfig {
  // Server configuration
  port: number;
  nodeEnv: string;
  logLevel: string;

  // Camunda configuration
  camundaBaseUrl: string;
  camundaEngineName: string;
  camundaAdminUser?: string;
  camundaAdminPassword?: string;

  // Database configuration
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;

  // External services
   dataApiUrl: string;
  retoolBaseUrl?: string;
  retoolApiToken?: string;

  // Retool DB (self-hosted) - optional overrides
  retoolDbHost?: string;
  retoolDbPort?: number;
  retoolDbName?: string;
  retoolDbUser?: string;
  retoolDbPassword?: string;
}

class Config implements IConfig {
  public readonly port: number;
  public readonly nodeEnv: string;
  public readonly logLevel: string;

  public readonly camundaBaseUrl: string;
  public readonly camundaEngineName: string;
  public readonly camundaAdminUser?: string;
  public readonly camundaAdminPassword?: string;

  public readonly dbHost: string;
  public readonly dbPort: number;
  public readonly dbName: string;
  public readonly dbUser: string;
  public readonly dbPassword: string;

  public readonly dataApiUrl: string;
  public readonly retoolBaseUrl?: string;
  public readonly retoolApiToken?: string;

  public readonly retoolDbHost?: string;
  public readonly retoolDbPort?: number;
  public readonly retoolDbName?: string;
  public readonly retoolDbUser?: string;
  public readonly retoolDbPassword?: string;

  constructor() {
    // Server configuration
    this.port = parseInt(process.env.MIDDLEWARE_PORT || '3000');
    this.nodeEnv = process.env.NODE_ENV || 'development';
    this.logLevel = process.env.LOG_LEVEL || 'info';

    // Camunda configuration
    this.camundaBaseUrl = process.env.CAMUNDA_BASE_URL || 'http://localhost:8080';
    this.camundaEngineName = process.env.CAMUNDA_ENGINE_NAME || 'default';
    this.camundaAdminUser = process.env.CAMUNDA_ADMIN_USER;
    this.camundaAdminPassword = process.env.CAMUNDA_ADMIN_PASSWORD;

    // Database configuration
    this.dbHost = process.env.DB_HOST || 'localhost';
    this.dbPort = parseInt(process.env.DB_PORT || '5432');
    this.dbName = process.env.DB_NAME || 'camunda';
    this.dbUser = process.env.DB_USER || 'camunda';
    this.dbPassword = process.env.DB_PASSWORD || 'camunda';

    // External services
    this.dataApiUrl = process.env.DATA_API_URL || 'http://localhost:3001';
    this.retoolBaseUrl = process.env.RETOOL_BASE_URL;
    this.retoolApiToken = process.env.RETOOL_API_TOKEN;

    // Retool DB overrides
    this.retoolDbHost = process.env.RETOOL_DB_HOST;
    this.retoolDbPort = process.env.RETOOL_DB_PORT ? parseInt(process.env.RETOOL_DB_PORT) : undefined;
    this.retoolDbName = process.env.RETOOL_DB_NAME;
    this.retoolDbUser = process.env.RETOOL_DB_USER;
    this.retoolDbPassword = process.env.RETOOL_DB_PASSWORD;

    this.validate();
  }

  private validate(): void {
    const requiredVars = [
      'camundaBaseUrl',
      'dataApiUrl',
      'dbHost',
      'dbPort',
      'dbName',
      'dbUser',
      'dbPassword'
    ];

    const missing = requiredVars.filter(key => !(this as any)[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
   }
  }

  public isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  public isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  public toString(): string {
    return JSON.stringify({
      port: this.port,
      nodeEnv: this.nodeEnv,
      logLevel: this.logLevel,
      camundaBaseUrl: this.camundaBaseUrl,
      camundaEngineName: this.camundaEngineName,
      dbHost: this.dbHost,
      dbPort: this.dbPort,
      dbName: this.dbName,
      dataApiUrl: this.dataApiUrl,
      // Don't log sensitive information
      camundaAdminUser: this.camundaAdminUser ? '***' : undefined,
      retoolApiToken: this.retoolApiToken ? '***' : undefined
    }, null, 2);
  }
}

export const config = new Config();
