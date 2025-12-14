/**
 * Configuration and Deployment System
 * Configuration management for different environments with validation
 * Requirements: Configuration aspects of all requirements
 */

// ============ Types and Interfaces ============

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'nonicatab' | 'aions_revit' | 'external' | 'github';
  enabled: boolean;
  protocol: 'stdio' | 'http' | 'websocket';
  connectionTimeout: number;
  retryConfig?: {
    maxRetries: number;
    baseDelayMs: number;
    strategy: 'exponential' | 'linear' | 'fixed';
  };
  healthCheck?: {
    enabled: boolean;
    intervalMs: number;
    timeoutMs: number;
  };
  metadata?: Record<string, unknown>;
}

export interface DatabaseConfig {
  type: 'aurora-dsql' | 'postgres' | 'sqlite' | 'memory';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  poolSize?: number;
  connectionTimeout?: number;
  region?: string;
  clusterArn?: string;
}

export interface AWSConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  profile?: string;
  lambda?: {
    functionPrefix: string;
    timeout: number;
    memorySize: number;
  };
  s3?: {
    bucket: string;
    prefix?: string;
    encryption?: boolean;
  };
  bedrock?: {
    modelId: string;
    maxTokens: number;
    temperature?: number;
  };
  cloudwatch?: {
    logGroupPrefix: string;
    retentionDays: number;
    enableMetrics: boolean;
  };
}

export interface SecurityConfig {
  enableAuditTrail: boolean;
  dataProtection: {
    enabled: boolean;
    encryptionKey?: string;
    sensitiveFields: string[];
  };
  serverIsolation: {
    enabled: boolean;
    sandboxLevel: 'none' | 'basic' | 'strict';
  };
  authentication?: {
    type: 'none' | 'api-key' | 'oauth' | 'jwt';
    config?: Record<string, unknown>;
  };
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text' | 'pretty';
  outputs: LogOutput[];
  enableMetrics: boolean;
  enableTracing: boolean;
  samplingRate?: number;
}

export interface LogOutput {
  type: 'console' | 'file' | 'cloudwatch' | 'custom';
  config?: Record<string, unknown>;
}

export interface WorkflowConfig {
  maxConcurrentWorkflows: number;
  defaultTimeout: number;
  enableCheckpoints: boolean;
  checkpointStoragePath?: string;
  retryFailedSteps: boolean;
  maxRetries: number;
}

export interface DesktopAutomationConfig {
  enabled: boolean;
  powerPoint: {
    enabled: boolean;
    templatePath?: string;
    defaultOutputPath?: string;
  };
  fileSystem: {
    enabled: boolean;
    allowedPaths?: string[];
    maxFileSize?: number;
  };
  clipboard: {
    enabled: boolean;
  };
  uiAutomation: {
    enabled: boolean;
    timeout: number;
  };
}

export interface SystemConfig {
  environment: Environment;
  version: string;
  instanceId?: string;
  mcpServers: MCPServerConfig[];
  database: DatabaseConfig;
  aws: AWSConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
  workflow: WorkflowConfig;
  desktopAutomation: DesktopAutomationConfig;
  customSettings?: Record<string, unknown>;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ConfigValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

export interface DeploymentConfig {
  environment: Environment;
  region: string;
  stackName: string;
  tags: Record<string, string>;
  parameters: Record<string, string>;
  capabilities?: string[];
}

export interface DeploymentResult {
  success: boolean;
  stackId?: string;
  outputs?: Record<string, string>;
  error?: string;
  duration?: number;
}

// ============ Default Configurations ============

const DEFAULT_CONFIGS: Record<Environment, Partial<SystemConfig>> = {
  development: {
    logging: {
      level: 'debug',
      format: 'pretty',
      outputs: [{ type: 'console' }],
      enableMetrics: false,
      enableTracing: false
    },
    database: {
      type: 'memory',
      database: 'mcp_dev'
    },
    security: {
      enableAuditTrail: false,
      dataProtection: { enabled: false, sensitiveFields: [] },
      serverIsolation: { enabled: false, sandboxLevel: 'none' }
    },
    workflow: {
      maxConcurrentWorkflows: 5,
      defaultTimeout: 60000,
      enableCheckpoints: true,
      retryFailedSteps: true,
      maxRetries: 3
    }
  },
  staging: {
    logging: {
      level: 'info',
      format: 'json',
      outputs: [{ type: 'console' }, { type: 'cloudwatch' }],
      enableMetrics: true,
      enableTracing: true,
      samplingRate: 0.5
    },
    database: {
      type: 'aurora-dsql',
      database: 'mcp_staging',
      ssl: true,
      poolSize: 10
    },
    security: {
      enableAuditTrail: true,
      dataProtection: { enabled: true, sensitiveFields: ['password', 'apiKey', 'token'] },
      serverIsolation: { enabled: true, sandboxLevel: 'basic' }
    },
    workflow: {
      maxConcurrentWorkflows: 10,
      defaultTimeout: 120000,
      enableCheckpoints: true,
      retryFailedSteps: true,
      maxRetries: 5
    }
  },
  production: {
    logging: {
      level: 'warn',
      format: 'json',
      outputs: [{ type: 'cloudwatch' }],
      enableMetrics: true,
      enableTracing: true,
      samplingRate: 0.1
    },
    database: {
      type: 'aurora-dsql',
      database: 'mcp_production',
      ssl: true,
      poolSize: 50
    },
    security: {
      enableAuditTrail: true,
      dataProtection: { enabled: true, sensitiveFields: ['password', 'apiKey', 'token', 'secret', 'credential'] },
      serverIsolation: { enabled: true, sandboxLevel: 'strict' }
    },
    workflow: {
      maxConcurrentWorkflows: 50,
      defaultTimeout: 300000,
      enableCheckpoints: true,
      retryFailedSteps: true,
      maxRetries: 10
    }
  },
  test: {
    logging: {
      level: 'error',
      format: 'text',
      outputs: [],
      enableMetrics: false,
      enableTracing: false
    },
    database: {
      type: 'memory',
      database: 'mcp_test'
    },
    security: {
      enableAuditTrail: false,
      dataProtection: { enabled: false, sensitiveFields: [] },
      serverIsolation: { enabled: false, sandboxLevel: 'none' }
    },
    workflow: {
      maxConcurrentWorkflows: 2,
      defaultTimeout: 5000,
      enableCheckpoints: false,
      retryFailedSteps: false,
      maxRetries: 1
    }
  }
};

// ============ Configuration Validator ============

export class ConfigurationValidator {
  validate(config: Partial<SystemConfig>): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Validate environment
    if (config.environment && !['development', 'staging', 'production', 'test'].includes(config.environment)) {
      errors.push({
        path: 'environment',
        message: `Invalid environment: ${config.environment}`,
        code: 'INVALID_ENVIRONMENT'
      });
    }

    // Validate MCP servers
    if (config.mcpServers) {
      this.validateMCPServers(config.mcpServers, errors, warnings);
    }

    // Validate database config
    if (config.database) {
      this.validateDatabaseConfig(config.database, errors, warnings, config.environment);
    }

    // Validate AWS config
    if (config.aws) {
      this.validateAWSConfig(config.aws, errors, warnings, config.environment);
    }

    // Validate security config
    if (config.security) {
      this.validateSecurityConfig(config.security, errors, warnings, config.environment);
    }

    // Validate logging config
    if (config.logging) {
      this.validateLoggingConfig(config.logging, errors, warnings);
    }

    // Validate workflow config
    if (config.workflow) {
      this.validateWorkflowConfig(config.workflow, errors, warnings);
    }

    // Validate desktop automation config
    if (config.desktopAutomation) {
      this.validateDesktopAutomationConfig(config.desktopAutomation, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateMCPServers(
    servers: MCPServerConfig[],
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    const ids = new Set<string>();

    for (let i = 0; i < servers.length; i++) {
      const server = servers[i];
      const path = `mcpServers[${i}]`;

      // Check for duplicate IDs
      if (ids.has(server.id)) {
        errors.push({
          path: `${path}.id`,
          message: `Duplicate server ID: ${server.id}`,
          code: 'DUPLICATE_SERVER_ID'
        });
      }
      ids.add(server.id);

      // Validate connection timeout
      if (server.connectionTimeout < 1000) {
        warnings.push({
          path: `${path}.connectionTimeout`,
          message: 'Connection timeout is very low',
          suggestion: 'Consider setting timeout to at least 5000ms'
        });
      }

      if (server.connectionTimeout > 60000) {
        warnings.push({
          path: `${path}.connectionTimeout`,
          message: 'Connection timeout is very high',
          suggestion: 'Consider setting timeout to less than 30000ms'
        });
      }

      // Validate protocol
      if (!['stdio', 'http', 'websocket'].includes(server.protocol)) {
        errors.push({
          path: `${path}.protocol`,
          message: `Invalid protocol: ${server.protocol}`,
          code: 'INVALID_PROTOCOL'
        });
      }
    }
  }

  private validateDatabaseConfig(
    config: DatabaseConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[],
    environment?: Environment
  ): void {
    // Check database type
    if (!['aurora-dsql', 'postgres', 'sqlite', 'memory'].includes(config.type)) {
      errors.push({
        path: 'database.type',
        message: `Invalid database type: ${config.type}`,
        code: 'INVALID_DATABASE_TYPE'
      });
    }

    // Production should use Aurora DSQL
    if (environment === 'production' && config.type !== 'aurora-dsql') {
      warnings.push({
        path: 'database.type',
        message: 'Production environment should use aurora-dsql',
        suggestion: 'Change database type to aurora-dsql for production'
      });
    }

    // Check SSL for production
    if (environment === 'production' && !config.ssl) {
      errors.push({
        path: 'database.ssl',
        message: 'SSL must be enabled in production',
        code: 'SSL_REQUIRED'
      });
    }

    // Check pool size
    if (config.poolSize !== undefined) {
      if (config.poolSize < 1) {
        errors.push({
          path: 'database.poolSize',
          message: 'Pool size must be at least 1',
          code: 'INVALID_POOL_SIZE'
        });
      }
      if (config.poolSize > 100) {
        warnings.push({
          path: 'database.poolSize',
          message: 'Pool size is very high',
          suggestion: 'Consider reducing pool size to avoid resource exhaustion'
        });
      }
    }
  }

  private validateAWSConfig(
    config: AWSConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[],
    environment?: Environment
  ): void {
    // Validate region
    const validRegions = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-northeast-1', 'ap-southeast-1'];
    if (!validRegions.includes(config.region)) {
      warnings.push({
        path: 'aws.region',
        message: `Region ${config.region} may not support all services`,
        suggestion: 'Consider using a major region like us-east-1'
      });
    }

    // Check for hardcoded credentials
    if (config.accessKeyId && config.secretAccessKey) {
      if (environment === 'production') {
        errors.push({
          path: 'aws.accessKeyId',
          message: 'Hardcoded credentials not allowed in production',
          code: 'HARDCODED_CREDENTIALS'
        });
      } else {
        warnings.push({
          path: 'aws.accessKeyId',
          message: 'Hardcoded credentials detected',
          suggestion: 'Use IAM roles or environment variables instead'
        });
      }
    }

    // Validate Lambda config
    if (config.lambda) {
      if (config.lambda.timeout < 1 || config.lambda.timeout > 900) {
        errors.push({
          path: 'aws.lambda.timeout',
          message: 'Lambda timeout must be between 1 and 900 seconds',
          code: 'INVALID_LAMBDA_TIMEOUT'
        });
      }
      if (config.lambda.memorySize < 128 || config.lambda.memorySize > 10240) {
        errors.push({
          path: 'aws.lambda.memorySize',
          message: 'Lambda memory must be between 128 and 10240 MB',
          code: 'INVALID_LAMBDA_MEMORY'
        });
      }
    }

    // Validate S3 config
    if (config.s3) {
      if (!config.s3.bucket) {
        errors.push({
          path: 'aws.s3.bucket',
          message: 'S3 bucket name is required',
          code: 'MISSING_S3_BUCKET'
        });
      }
      if (environment === 'production' && !config.s3.encryption) {
        warnings.push({
          path: 'aws.s3.encryption',
          message: 'S3 encryption should be enabled in production',
          suggestion: 'Enable encryption for data at rest'
        });
      }
    }
  }

  private validateSecurityConfig(
    config: SecurityConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[],
    environment?: Environment
  ): void {
    // Production requires audit trail
    if (environment === 'production' && !config.enableAuditTrail) {
      errors.push({
        path: 'security.enableAuditTrail',
        message: 'Audit trail must be enabled in production',
        code: 'AUDIT_TRAIL_REQUIRED'
      });
    }

    // Production requires data protection
    if (environment === 'production' && !config.dataProtection.enabled) {
      errors.push({
        path: 'security.dataProtection.enabled',
        message: 'Data protection must be enabled in production',
        code: 'DATA_PROTECTION_REQUIRED'
      });
    }

    // Production requires server isolation
    if (environment === 'production') {
      if (!config.serverIsolation.enabled) {
        errors.push({
          path: 'security.serverIsolation.enabled',
          message: 'Server isolation must be enabled in production',
          code: 'SERVER_ISOLATION_REQUIRED'
        });
      }
      if (config.serverIsolation.sandboxLevel !== 'strict') {
        warnings.push({
          path: 'security.serverIsolation.sandboxLevel',
          message: 'Production should use strict sandbox level',
          suggestion: 'Set sandboxLevel to "strict" for maximum security'
        });
      }
    }

    // Check sensitive fields
    if (config.dataProtection.enabled && config.dataProtection.sensitiveFields.length === 0) {
      warnings.push({
        path: 'security.dataProtection.sensitiveFields',
        message: 'No sensitive fields configured',
        suggestion: 'Add fields like "password", "apiKey", "token" to sensitive fields list'
      });
    }
  }

  private validateLoggingConfig(
    config: LoggingConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    // Validate log level
    if (!['debug', 'info', 'warn', 'error'].includes(config.level)) {
      errors.push({
        path: 'logging.level',
        message: `Invalid log level: ${config.level}`,
        code: 'INVALID_LOG_LEVEL'
      });
    }

    // Validate format
    if (!['json', 'text', 'pretty'].includes(config.format)) {
      errors.push({
        path: 'logging.format',
        message: `Invalid log format: ${config.format}`,
        code: 'INVALID_LOG_FORMAT'
      });
    }

    // Validate sampling rate
    if (config.samplingRate !== undefined) {
      if (config.samplingRate < 0 || config.samplingRate > 1) {
        errors.push({
          path: 'logging.samplingRate',
          message: 'Sampling rate must be between 0 and 1',
          code: 'INVALID_SAMPLING_RATE'
        });
      }
    }

    // Check outputs
    if (config.outputs.length === 0) {
      warnings.push({
        path: 'logging.outputs',
        message: 'No log outputs configured',
        suggestion: 'Add at least one log output for debugging'
      });
    }
  }

  private validateWorkflowConfig(
    config: WorkflowConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    if (config.maxConcurrentWorkflows < 1) {
      errors.push({
        path: 'workflow.maxConcurrentWorkflows',
        message: 'Max concurrent workflows must be at least 1',
        code: 'INVALID_MAX_WORKFLOWS'
      });
    }

    if (config.defaultTimeout < 1000) {
      warnings.push({
        path: 'workflow.defaultTimeout',
        message: 'Default timeout is very low',
        suggestion: 'Consider setting timeout to at least 10000ms'
      });
    }

    if (config.maxRetries < 0) {
      errors.push({
        path: 'workflow.maxRetries',
        message: 'Max retries cannot be negative',
        code: 'INVALID_MAX_RETRIES'
      });
    }

    if (config.maxRetries > 20) {
      warnings.push({
        path: 'workflow.maxRetries',
        message: 'Max retries is very high',
        suggestion: 'Consider reducing max retries to avoid long delays'
      });
    }
  }

  private validateDesktopAutomationConfig(
    config: DesktopAutomationConfig,
    errors: ConfigValidationError[],
    warnings: ConfigValidationWarning[]
  ): void {
    if (config.uiAutomation?.enabled && config.uiAutomation.timeout < 100) {
      warnings.push({
        path: 'desktopAutomation.uiAutomation.timeout',
        message: 'UI automation timeout is very low',
        suggestion: 'Consider setting timeout to at least 1000ms'
      });
    }

    if (config.fileSystem?.enabled && config.fileSystem.maxFileSize !== undefined) {
      if (config.fileSystem.maxFileSize < 1024) {
        warnings.push({
          path: 'desktopAutomation.fileSystem.maxFileSize',
          message: 'Max file size is very small',
          suggestion: 'Consider increasing max file size'
        });
      }
    }
  }
}

// ============ Configuration Manager ============

export class ConfigurationManager {
  private config: SystemConfig;
  private validator: ConfigurationValidator;
  private configChangeListeners: ((config: SystemConfig) => void)[] = [];

  constructor(environment: Environment = 'development') {
    this.validator = new ConfigurationValidator();
    this.config = this.createDefaultConfig(environment);
  }

  private createDefaultConfig(environment: Environment): SystemConfig {
    const defaults = DEFAULT_CONFIGS[environment];

    return {
      environment,
      version: '1.0.0',
      mcpServers: [],
      database: defaults.database || {
        type: 'memory',
        database: 'mcp_default'
      },
      aws: {
        region: 'us-east-1',
        lambda: { functionPrefix: 'mcp-', timeout: 30, memorySize: 256 },
        s3: { bucket: `mcp-${environment}-bucket`, encryption: environment === 'production' },
        cloudwatch: { logGroupPrefix: '/mcp/', retentionDays: 30, enableMetrics: true }
      },
      security: defaults.security || {
        enableAuditTrail: false,
        dataProtection: { enabled: false, sensitiveFields: [] },
        serverIsolation: { enabled: false, sandboxLevel: 'none' }
      },
      logging: defaults.logging || {
        level: 'info',
        format: 'json',
        outputs: [{ type: 'console' }],
        enableMetrics: false,
        enableTracing: false
      },
      workflow: defaults.workflow || {
        maxConcurrentWorkflows: 10,
        defaultTimeout: 60000,
        enableCheckpoints: true,
        retryFailedSteps: true,
        maxRetries: 3
      },
      desktopAutomation: {
        enabled: true,
        powerPoint: { enabled: true },
        fileSystem: { enabled: true },
        clipboard: { enabled: true },
        uiAutomation: { enabled: true, timeout: 5000 }
      }
    };
  }

  getConfig(): SystemConfig {
    return { ...this.config };
  }

  getEnvironment(): Environment {
    return this.config.environment;
  }

  setConfig(config: Partial<SystemConfig>): ConfigValidationResult {
    const mergedConfig = this.mergeConfig(this.config, config);
    const validationResult = this.validator.validate(mergedConfig);

    if (validationResult.valid) {
      this.config = mergedConfig as SystemConfig;
      this.notifyListeners();
    }

    return validationResult;
  }

  private mergeConfig(base: SystemConfig, override: Partial<SystemConfig>): Partial<SystemConfig> {
    const merged = { ...base };

    for (const key of Object.keys(override) as (keyof SystemConfig)[]) {
      const value = override[key];
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          (merged as Record<string, unknown>)[key] = {
            ...(merged[key] as Record<string, unknown>),
            ...(value as Record<string, unknown>)
          };
        } else {
          (merged as Record<string, unknown>)[key] = value;
        }
      }
    }

    return merged;
  }

  validate(): ConfigValidationResult {
    return this.validator.validate(this.config);
  }

  getMCPServerConfig(serverId: string): MCPServerConfig | undefined {
    return this.config.mcpServers.find(s => s.id === serverId);
  }

  addMCPServer(server: MCPServerConfig): ConfigValidationResult {
    const newServers = [...this.config.mcpServers, server];
    return this.setConfig({ mcpServers: newServers });
  }

  removeMCPServer(serverId: string): boolean {
    const index = this.config.mcpServers.findIndex(s => s.id === serverId);
    if (index >= 0) {
      const newServers = [...this.config.mcpServers];
      newServers.splice(index, 1);
      this.config.mcpServers = newServers;
      this.notifyListeners();
      return true;
    }
    return false;
  }

  updateMCPServer(serverId: string, updates: Partial<MCPServerConfig>): ConfigValidationResult {
    const index = this.config.mcpServers.findIndex(s => s.id === serverId);
    if (index < 0) {
      return {
        valid: false,
        errors: [{ path: 'mcpServers', message: `Server not found: ${serverId}`, code: 'SERVER_NOT_FOUND' }],
        warnings: []
      };
    }

    const updatedServer = { ...this.config.mcpServers[index], ...updates };
    const newServers = [...this.config.mcpServers];
    newServers[index] = updatedServer;

    return this.setConfig({ mcpServers: newServers });
  }

  onConfigChange(listener: (config: SystemConfig) => void): () => void {
    this.configChangeListeners.push(listener);
    return () => {
      const index = this.configChangeListeners.indexOf(listener);
      if (index >= 0) {
        this.configChangeListeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    for (const listener of this.configChangeListeners) {
      listener(this.getConfig());
    }
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(json: string): ConfigValidationResult {
    try {
      const parsed = JSON.parse(json) as Partial<SystemConfig>;
      return this.setConfig(parsed);
    } catch (error) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
          code: 'INVALID_JSON'
        }],
        warnings: []
      };
    }
  }

  reset(): void {
    this.config = this.createDefaultConfig(this.config.environment);
    this.notifyListeners();
  }

  switchEnvironment(environment: Environment): ConfigValidationResult {
    this.config = this.createDefaultConfig(environment);
    this.notifyListeners();
    return this.validate();
  }
}

// ============ Deployment Manager ============

export class DeploymentManager {
  private configManager: ConfigurationManager;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  generateDeploymentConfig(): DeploymentConfig {
    const config = this.configManager.getConfig();

    return {
      environment: config.environment,
      region: config.aws.region,
      stackName: `mcp-integration-${config.environment}`,
      tags: {
        Environment: config.environment,
        Application: 'MCP-Integration',
        Version: config.version
      },
      parameters: {
        Environment: config.environment,
        DatabaseType: config.database.type,
        LogLevel: config.logging.level,
        MaxWorkflows: String(config.workflow.maxConcurrentWorkflows)
      },
      capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM']
    };
  }

  async deploy(): Promise<DeploymentResult> {
    const startTime = Date.now();
    const deploymentConfig = this.generateDeploymentConfig();

    // Validate configuration before deployment
    const validation = this.configManager.validate();
    if (!validation.valid) {
      return {
        success: false,
        error: `Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
        duration: Date.now() - startTime
      };
    }

    // Simulate deployment (in real implementation, this would call AWS CloudFormation)
    try {
      // This is a simulation - actual deployment would use AWS SDK
      await this.simulateDeployment(deploymentConfig);

      return {
        success: true,
        stackId: `arn:aws:cloudformation:${deploymentConfig.region}:123456789:stack/${deploymentConfig.stackName}`,
        outputs: {
          ApiEndpoint: `https://api.${deploymentConfig.environment}.mcp-integration.example.com`,
          S3Bucket: `mcp-${deploymentConfig.environment}-bucket`,
          LogGroup: `/mcp/${deploymentConfig.environment}`
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  private async simulateDeployment(config: DeploymentConfig): Promise<void> {
    // Simulate deployment delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check for critical issues that would fail deployment
    if (config.environment === 'production') {
      const sysConfig = this.configManager.getConfig();
      if (!sysConfig.security.enableAuditTrail) {
        throw new Error('Production deployment requires audit trail');
      }
      if (!sysConfig.security.dataProtection.enabled) {
        throw new Error('Production deployment requires data protection');
      }
    }
  }

  generateCloudFormationTemplate(): Record<string, unknown> {
    const config = this.configManager.getConfig();

    return {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: `MCP Integration System - ${config.environment}`,
      Parameters: {
        Environment: {
          Type: 'String',
          Default: config.environment,
          AllowedValues: ['development', 'staging', 'production']
        }
      },
      Resources: {
        MCPLambdaFunction: {
          Type: 'AWS::Lambda::Function',
          Properties: {
            FunctionName: `${config.aws.lambda?.functionPrefix}handler-${config.environment}`,
            Runtime: 'nodejs18.x',
            Timeout: config.aws.lambda?.timeout || 30,
            MemorySize: config.aws.lambda?.memorySize || 256
          }
        },
        MCPS3Bucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {
            BucketName: config.aws.s3?.bucket,
            BucketEncryption: config.aws.s3?.encryption ? {
              ServerSideEncryptionConfiguration: [{
                ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' }
              }]
            } : undefined
          }
        },
        MCPLogGroup: {
          Type: 'AWS::Logs::LogGroup',
          Properties: {
            LogGroupName: `${config.aws.cloudwatch?.logGroupPrefix}${config.environment}`,
            RetentionInDays: config.aws.cloudwatch?.retentionDays || 30
          }
        }
      },
      Outputs: {
        LambdaArn: {
          Value: { 'Fn::GetAtt': ['MCPLambdaFunction', 'Arn'] }
        },
        S3BucketName: {
          Value: { Ref: 'MCPS3Bucket' }
        }
      }
    };
  }

  getDeploymentStatus(): {
    environment: Environment;
    isConfigValid: boolean;
    errors: ConfigValidationError[];
    warnings: ConfigValidationWarning[];
  } {
    const validation = this.configManager.validate();

    return {
      environment: this.configManager.getEnvironment(),
      isConfigValid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    };
  }
}

// ============ Singleton Instances ============

let configurationManagerInstance: ConfigurationManager | null = null;

export function getConfigurationManager(environment?: Environment): ConfigurationManager {
  if (!configurationManagerInstance) {
    configurationManagerInstance = new ConfigurationManager(environment || 'development');
  }
  return configurationManagerInstance;
}

export function resetConfigurationManager(): void {
  if (configurationManagerInstance) {
    configurationManagerInstance.reset();
    configurationManagerInstance = null;
  }
}
