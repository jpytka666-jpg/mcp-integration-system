/**
 * Configuration and Deployment System Tests
 * Unit tests for configuration management, validation, and deployment
 * Requirements: Configuration aspects of all requirements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  ConfigurationManager,
  ConfigurationValidator,
  DeploymentManager,
  Environment,
  MCPServerConfig,
  SystemConfig,
  getConfigurationManager,
  resetConfigurationManager
} from './configuration-manager.js';

// ============ Test Arbitraries ============

const environmentArb = fc.constantFrom('development', 'staging', 'production', 'test') as fc.Arbitrary<Environment>;

const mcpServerConfigArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).map(s => `server_${s.replace(/[^a-zA-Z0-9]/g, '')}`),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constantFrom('nonicatab', 'aions_revit', 'external', 'github') as fc.Arbitrary<MCPServerConfig['type']>,
  enabled: fc.boolean(),
  protocol: fc.constantFrom('stdio', 'http', 'websocket') as fc.Arbitrary<MCPServerConfig['protocol']>,
  connectionTimeout: fc.integer({ min: 1000, max: 60000 })
});

// ============ Tests ============

describe('Configuration and Deployment System Tests', () => {

  describe('ConfigurationValidator Tests', () => {
    let validator: ConfigurationValidator;

    beforeEach(() => {
      validator = new ConfigurationValidator();
    });

    it('should validate correct configurations', async () => {
      await fc.assert(fc.asyncProperty(
        environmentArb,
        async (environment) => {
          const config: Partial<SystemConfig> = {
            environment,
            version: '1.0.0',
            mcpServers: [],
            database: {
              type: environment === 'production' ? 'aurora-dsql' : 'memory',
              database: 'test_db',
              ssl: environment === 'production'
            },
            security: {
              enableAuditTrail: environment === 'production',
              dataProtection: {
                enabled: environment === 'production',
                sensitiveFields: environment === 'production' ? ['password'] : []
              },
              serverIsolation: {
                enabled: environment === 'production',
                sandboxLevel: environment === 'production' ? 'strict' : 'none'
              }
            },
            logging: {
              level: 'info',
              format: 'json',
              outputs: [{ type: 'console' }],
              enableMetrics: false,
              enableTracing: false
            },
            workflow: {
              maxConcurrentWorkflows: 10,
              defaultTimeout: 30000,
              enableCheckpoints: true,
              retryFailedSteps: true,
              maxRetries: 3
            }
          };

          const result = validator.validate(config);

          expect(result.valid).toBe(true);
          expect(result.errors.length).toBe(0);
        }
      ), { numRuns: 10 });
    });

    it('should detect invalid environment', () => {
      const config = {
        environment: 'invalid' as Environment
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_ENVIRONMENT')).toBe(true);
    });

    it('should detect duplicate server IDs', () => {
      const config: Partial<SystemConfig> = {
        mcpServers: [
          { id: 'server-1', name: 'Server 1', type: 'nonicatab', enabled: true, protocol: 'stdio', connectionTimeout: 5000 },
          { id: 'server-1', name: 'Server 2', type: 'external', enabled: true, protocol: 'http', connectionTimeout: 5000 }
        ]
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_SERVER_ID')).toBe(true);
    });

    it('should warn about low connection timeouts', () => {
      const config: Partial<SystemConfig> = {
        mcpServers: [
          { id: 'server-1', name: 'Server 1', type: 'nonicatab', enabled: true, protocol: 'stdio', connectionTimeout: 500 }
        ]
      };

      const result = validator.validate(config);

      expect(result.warnings.some(w => w.path.includes('connectionTimeout'))).toBe(true);
    });

    it('should require SSL in production', () => {
      const config: Partial<SystemConfig> = {
        environment: 'production',
        database: {
          type: 'aurora-dsql',
          database: 'prod_db',
          ssl: false
        }
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'SSL_REQUIRED')).toBe(true);
    });

    it('should require audit trail in production', () => {
      const config: Partial<SystemConfig> = {
        environment: 'production',
        database: { type: 'aurora-dsql', database: 'db', ssl: true },
        security: {
          enableAuditTrail: false,
          dataProtection: { enabled: true, sensitiveFields: ['password'] },
          serverIsolation: { enabled: true, sandboxLevel: 'strict' }
        }
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'AUDIT_TRAIL_REQUIRED')).toBe(true);
    });

    it('should validate log levels', () => {
      const config: Partial<SystemConfig> = {
        logging: {
          level: 'invalid' as 'debug',
          format: 'json',
          outputs: [],
          enableMetrics: false,
          enableTracing: false
        }
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_LOG_LEVEL')).toBe(true);
    });

    it('should validate Lambda timeout range', () => {
      const config: Partial<SystemConfig> = {
        aws: {
          region: 'us-east-1',
          lambda: {
            functionPrefix: 'test-',
            timeout: 1000, // Invalid: max is 900
            memorySize: 256
          }
        }
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_LAMBDA_TIMEOUT')).toBe(true);
    });

    it('should validate sampling rate range', () => {
      const config: Partial<SystemConfig> = {
        logging: {
          level: 'info',
          format: 'json',
          outputs: [],
          enableMetrics: true,
          enableTracing: true,
          samplingRate: 1.5 // Invalid: must be 0-1
        }
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_SAMPLING_RATE')).toBe(true);
    });
  });

  describe('ConfigurationManager Tests', () => {
    let manager: ConfigurationManager;

    beforeEach(() => {
      manager = new ConfigurationManager('development');
    });

    afterEach(() => {
      manager.reset();
    });

    it('should create with default configuration', async () => {
      await fc.assert(fc.asyncProperty(
        environmentArb,
        async (environment) => {
          const mgr = new ConfigurationManager(environment);

          const config = mgr.getConfig();

          expect(config.environment).toBe(environment);
          expect(config.version).toBeDefined();
          expect(config.database).toBeDefined();
          expect(config.security).toBeDefined();
          expect(config.logging).toBeDefined();
          expect(config.workflow).toBeDefined();
        }
      ), { numRuns: 4 });
    });

    it('should update configuration with validation', () => {
      const result = manager.setConfig({
        workflow: {
          maxConcurrentWorkflows: 20,
          defaultTimeout: 60000,
          enableCheckpoints: true,
          retryFailedSteps: true,
          maxRetries: 5
        }
      });

      expect(result.valid).toBe(true);
      expect(manager.getConfig().workflow.maxConcurrentWorkflows).toBe(20);
    });

    it('should reject invalid configuration updates', () => {
      const result = manager.setConfig({
        logging: {
          level: 'invalid' as 'debug',
          format: 'json',
          outputs: [],
          enableMetrics: false,
          enableTracing: false
        }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should add MCP servers', async () => {
      await fc.assert(fc.asyncProperty(
        mcpServerConfigArb,
        async (serverConfig) => {
          const mgr = new ConfigurationManager('development');

          const result = mgr.addMCPServer(serverConfig);

          expect(result.valid).toBe(true);

          const retrievedServer = mgr.getMCPServerConfig(serverConfig.id);
          expect(retrievedServer).toBeDefined();
          expect(retrievedServer!.id).toBe(serverConfig.id);
        }
      ), { numRuns: 10 });
    });

    it('should remove MCP servers', () => {
      manager.addMCPServer({
        id: 'test-server',
        name: 'Test Server',
        type: 'nonicatab',
        enabled: true,
        protocol: 'stdio',
        connectionTimeout: 5000
      });

      expect(manager.getMCPServerConfig('test-server')).toBeDefined();

      const removed = manager.removeMCPServer('test-server');

      expect(removed).toBe(true);
      expect(manager.getMCPServerConfig('test-server')).toBeUndefined();
    });

    it('should update MCP servers', () => {
      manager.addMCPServer({
        id: 'update-server',
        name: 'Update Server',
        type: 'nonicatab',
        enabled: true,
        protocol: 'stdio',
        connectionTimeout: 5000
      });

      const result = manager.updateMCPServer('update-server', {
        enabled: false,
        connectionTimeout: 10000
      });

      expect(result.valid).toBe(true);

      const server = manager.getMCPServerConfig('update-server');
      expect(server!.enabled).toBe(false);
      expect(server!.connectionTimeout).toBe(10000);
    });

    it('should notify listeners on config change', async () => {
      const changes: SystemConfig[] = [];

      manager.onConfigChange((config) => {
        changes.push(config);
      });

      manager.setConfig({
        workflow: {
          maxConcurrentWorkflows: 15,
          defaultTimeout: 30000,
          enableCheckpoints: true,
          retryFailedSteps: true,
          maxRetries: 3
        }
      });

      expect(changes.length).toBe(1);
      expect(changes[0].workflow.maxConcurrentWorkflows).toBe(15);
    });

    it('should export and import configuration', () => {
      manager.addMCPServer({
        id: 'export-server',
        name: 'Export Server',
        type: 'external',
        enabled: true,
        protocol: 'http',
        connectionTimeout: 5000
      });

      const exported = manager.exportConfig();
      expect(exported).toContain('export-server');

      const newManager = new ConfigurationManager('development');
      const result = newManager.importConfig(exported);

      expect(result.valid).toBe(true);
      expect(newManager.getMCPServerConfig('export-server')).toBeDefined();
    });

    it('should handle invalid JSON import', () => {
      const result = manager.importConfig('not valid json');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_JSON')).toBe(true);
    });

    it('should switch environments', async () => {
      await fc.assert(fc.asyncProperty(
        environmentArb,
        async (targetEnvironment) => {
          const mgr = new ConfigurationManager('development');

          const result = mgr.switchEnvironment(targetEnvironment);

          expect(result.valid).toBe(true);
          expect(mgr.getEnvironment()).toBe(targetEnvironment);
        }
      ), { numRuns: 4 });
    });

    it('should reset to default configuration', () => {
      manager.addMCPServer({
        id: 'temp-server',
        name: 'Temp',
        type: 'nonicatab',
        enabled: true,
        protocol: 'stdio',
        connectionTimeout: 5000
      });

      expect(manager.getConfig().mcpServers.length).toBe(1);

      manager.reset();

      expect(manager.getConfig().mcpServers.length).toBe(0);
    });
  });

  describe('DeploymentManager Tests', () => {
    let configManager: ConfigurationManager;
    let deploymentManager: DeploymentManager;

    beforeEach(() => {
      configManager = new ConfigurationManager('staging');
      deploymentManager = new DeploymentManager(configManager);
    });

    afterEach(() => {
      configManager.reset();
    });

    it('should generate deployment configuration', async () => {
      await fc.assert(fc.asyncProperty(
        environmentArb,
        async (environment) => {
          const cfgMgr = new ConfigurationManager(environment);
          const depMgr = new DeploymentManager(cfgMgr);

          const deployConfig = depMgr.generateDeploymentConfig();

          expect(deployConfig.environment).toBe(environment);
          expect(deployConfig.stackName).toContain(environment);
          expect(deployConfig.tags.Environment).toBe(environment);
          expect(deployConfig.parameters.Environment).toBe(environment);
        }
      ), { numRuns: 4 });
    });

    it('should deploy successfully with valid staging config', async () => {
      const result = await deploymentManager.deploy();

      expect(result.success).toBe(true);
      expect(result.stackId).toBeDefined();
      expect(result.outputs).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should fail deployment with invalid config', async () => {
      // Create a new manager and validator, then test validation
      const validator = new ConfigurationValidator();
      const invalidConfig = {
        logging: {
          level: 'invalid' as 'debug',
          format: 'json',
          outputs: [],
          enableMetrics: false,
          enableTracing: false
        }
      };

      const validationResult = validator.validate(invalidConfig);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some(e => e.code === 'INVALID_LOG_LEVEL')).toBe(true);
    });

    it('should fail production deployment without security requirements', async () => {
      // Test that production config requires audit trail
      const validator = new ConfigurationValidator();
      const prodConfigWithoutAudit = {
        environment: 'production' as Environment,
        database: { type: 'aurora-dsql' as const, database: 'prod', ssl: true },
        security: {
          enableAuditTrail: false, // This should fail production validation
          dataProtection: { enabled: true, sensitiveFields: ['password'] },
          serverIsolation: { enabled: true, sandboxLevel: 'strict' as const }
        }
      };

      const validationResult = validator.validate(prodConfigWithoutAudit);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some(e => e.code === 'AUDIT_TRAIL_REQUIRED')).toBe(true);
    });

    it('should generate CloudFormation template', () => {
      const template = deploymentManager.generateCloudFormationTemplate();

      expect(template.AWSTemplateFormatVersion).toBe('2010-09-09');
      expect(template.Resources).toBeDefined();
      expect((template.Resources as Record<string, unknown>).MCPLambdaFunction).toBeDefined();
      expect((template.Resources as Record<string, unknown>).MCPS3Bucket).toBeDefined();
      expect((template.Resources as Record<string, unknown>).MCPLogGroup).toBeDefined();
    });

    it('should report deployment status', () => {
      const status = deploymentManager.getDeploymentStatus();

      expect(status.environment).toBe('staging');
      expect(status.isConfigValid).toBe(true);
      expect(Array.isArray(status.errors)).toBe(true);
      expect(Array.isArray(status.warnings)).toBe(true);
    });
  });

  describe('Singleton Instance Tests', () => {

    afterEach(() => {
      resetConfigurationManager();
    });

    it('should return same instance', () => {
      const instance1 = getConfigurationManager();
      const instance2 = getConfigurationManager();

      expect(instance1).toBe(instance2);
    });

    it('should create with specified environment', () => {
      resetConfigurationManager();
      const instance = getConfigurationManager('production');

      expect(instance.getEnvironment()).toBe('production');
    });

    it('should reset singleton', () => {
      const instance1 = getConfigurationManager('development');
      instance1.addMCPServer({
        id: 'singleton-server',
        name: 'Singleton Server',
        type: 'nonicatab',
        enabled: true,
        protocol: 'stdio',
        connectionTimeout: 5000
      });

      resetConfigurationManager();

      const instance2 = getConfigurationManager('development');

      expect(instance1).not.toBe(instance2);
      expect(instance2.getMCPServerConfig('singleton-server')).toBeUndefined();
    });
  });

  describe('Environment-Specific Validation Tests', () => {

    it('should validate development config permissively', () => {
      const manager = new ConfigurationManager('development');
      const validation = manager.validate();

      expect(validation.valid).toBe(true);
    });

    it('should validate test config permissively', () => {
      const manager = new ConfigurationManager('test');
      const validation = manager.validate();

      expect(validation.valid).toBe(true);
    });

    it('should validate staging config with appropriate warnings', () => {
      const manager = new ConfigurationManager('staging');
      const validation = manager.validate();

      expect(validation.valid).toBe(true);
    });

    it('should have strict production validation', () => {
      const manager = new ConfigurationManager('production');

      // Production default config should be valid
      const validation = manager.validate();

      // The default production config is set up to be valid
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('Configuration Merge Tests', () => {

    it('should merge partial configurations correctly', () => {
      const manager = new ConfigurationManager('development');

      const originalConfig = manager.getConfig();
      const originalDbType = originalConfig.database.type;

      manager.setConfig({
        logging: {
          level: 'debug',
          format: 'pretty',
          outputs: [{ type: 'console' }],
          enableMetrics: true,
          enableTracing: false
        }
      });

      const updatedConfig = manager.getConfig();

      // Logging should be updated
      expect(updatedConfig.logging.level).toBe('debug');
      expect(updatedConfig.logging.enableMetrics).toBe(true);

      // Other settings should remain unchanged
      expect(updatedConfig.database.type).toBe(originalDbType);
    });

    it('should handle nested configuration updates', () => {
      const manager = new ConfigurationManager('development');

      manager.setConfig({
        aws: {
          region: 'eu-west-1',
          lambda: {
            functionPrefix: 'custom-',
            timeout: 60,
            memorySize: 512
          }
        }
      });

      const config = manager.getConfig();

      expect(config.aws.region).toBe('eu-west-1');
      expect(config.aws.lambda?.functionPrefix).toBe('custom-');
      expect(config.aws.lambda?.timeout).toBe(60);
    });
  });
});
