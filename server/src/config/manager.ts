/**
 * Base configuration manager for Kiro system
 */

import { KiroConfig, MCPConfig, ValidationResult } from './types.js';
import { ConfigValidator } from './validator.js';
import { KiroErrorHandler, GracefulDegradation, ValidationErrorFormatter } from '../errors/error-handler.js';
import * as fs from 'fs';
import * as path from 'path';

export class ConfigurationManager {
  private basePath: string;
  private config: Partial<KiroConfig> = {};

  constructor(basePath: string = '.kiro') {
    this.basePath = basePath;
  }

  /**
   * Initialize the configuration system and directory structure
   */
  async initialize(): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    try {
      // Ensure base directory exists
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
      }

      // Create required subdirectories
      const requiredDirs = ['specs', 'steering', 'settings'];
      for (const dir of requiredDirs) {
        const dirPath = path.join(this.basePath, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }

      // Validate directory structure
      const structureValidation = ConfigValidator.validateDirectoryStructure(this.basePath);
      errors.push(...structureValidation.errors);
      warnings.push(...structureValidation.warnings);

      // Load existing configurations
      await this.loadConfigurations();

    } catch (error) {
      errors.push({
        path: this.basePath,
        message: `Failed to initialize configuration: ${error}`,
        code: 'INIT_ERROR'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Load MCP configuration with workspace/user priority merging
   * Uses graceful degradation for missing or invalid configs
   */
  async loadMCPConfig(): Promise<MCPConfig | null> {
    const configs: MCPConfig[] = [];

    // Load user-level config with graceful degradation
    const userConfigPath = path.join(process.env.HOME || process.env.USERPROFILE || '~', '.kiro', 'settings', 'mcp.json');
    const userConfigResult = GracefulDegradation.withDefault(() => {
      if (!fs.existsSync(userConfigPath)) return null;
      const userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf-8'));
      const validation = ConfigValidator.validateMCPConfig(userConfig);
      return validation.valid ? userConfig : null;
    }, null);
    
    if (userConfigResult.value) {
      configs.push(userConfigResult.value);
    }

    // Load workspace-level config with graceful degradation
    const workspaceConfigPath = path.join(this.basePath, 'settings', 'mcp.json');
    const workspaceConfigResult = GracefulDegradation.withDefault(() => {
      if (!fs.existsSync(workspaceConfigPath)) return null;
      const workspaceConfig = JSON.parse(fs.readFileSync(workspaceConfigPath, 'utf-8'));
      const validation = ConfigValidator.validateMCPConfig(workspaceConfig);
      return validation.valid ? workspaceConfig : null;
    }, null);
    
    if (workspaceConfigResult.value) {
      configs.push(workspaceConfigResult.value);
    }

    // Merge configs with workspace priority
    if (configs.length === 0) {
      return null;
    }

    const mergedConfig: MCPConfig = {
      servers: {},
      mergeStrategy: 'workspace-priority'
    };

    // User config first (lower priority)
    if (configs[0]) {
      Object.assign(mergedConfig.servers, (configs[0] as any).mcpServers || {});
    }

    // Workspace config second (higher priority)
    if (configs[1]) {
      Object.assign(mergedConfig.servers, (configs[1] as any).mcpServers || {});
    }

    return mergedConfig;
  }

  /**
   * Load steering files from the steering directory
   */
  async loadSteeringFiles(): Promise<string[]> {
    const steeringDir = path.join(this.basePath, 'steering');
    const steeringFiles: string[] = [];

    if (!fs.existsSync(steeringDir)) {
      return steeringFiles;
    }

    try {
      const files = fs.readdirSync(steeringDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(steeringDir, file);
          const validation = ConfigValidator.validateSteeringFile(filePath);
          
          if (validation.valid) {
            steeringFiles.push(filePath);
          } else {
            console.warn(`Invalid steering file ${file}:`, validation.errors);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to load steering files: ${error}`);
    }

    return steeringFiles;
  }

  /**
   * Get the path to a specific configuration directory
   */
  getConfigPath(subPath: string = ''): string {
    return path.join(this.basePath, subPath);
  }

  /**
   * Validate the entire configuration system
   */
  async validateConfiguration(): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Validate directory structure
    const structureValidation = ConfigValidator.validateDirectoryStructure(this.basePath);
    errors.push(...structureValidation.errors);
    warnings.push(...structureValidation.warnings);

    // Validate MCP configuration with proper error handling
    const mcpConfigPath = path.join(this.basePath, 'settings', 'mcp.json');
    if (fs.existsSync(mcpConfigPath)) {
      const mcpResult = GracefulDegradation.withDefault(() => {
        const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
        return ConfigValidator.validateMCPConfig(mcpConfig);
      }, { valid: false, errors: [], warnings: [] });

      if (mcpResult.degraded) {
        const kiroError = KiroErrorHandler.createError('CONFIG_INVALID_JSON', { path: mcpConfigPath });
        errors.push({
          path: mcpConfigPath,
          message: kiroError.message,
          code: kiroError.code
        });
      } else if (mcpResult.value) {
        errors.push(...mcpResult.value.errors);
        warnings.push(...mcpResult.value.warnings);
      }
    }

    // Validate steering files
    const steeringFiles = await this.loadSteeringFiles();
    for (const filePath of steeringFiles) {
      const validation = ConfigValidator.validateSteeringFile(filePath);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get a formatted validation summary for user display
   */
  async getValidationSummary(): Promise<string> {
    const result = await this.validateConfiguration();
    return ValidationErrorFormatter.summarize(result);
  }

  /**
   * Create a new spec directory structure
   */
  createSpecDirectory(featureName: string): string {
    const specPath = path.join(this.basePath, 'specs', featureName);
    
    if (!fs.existsSync(specPath)) {
      fs.mkdirSync(specPath, { recursive: true });
    }

    return specPath;
  }

  /**
   * Load all configurations
   */
  private async loadConfigurations(): Promise<void> {
    // Load MCP config
    const mcpConfig = await this.loadMCPConfig();
    if (mcpConfig) {
      this.config.mcp = mcpConfig;
    }

    // Set default configurations
    this.config.identity = {
      name: 'Kiro',
      version: '1.0.0',
      capabilities: ['code-generation', 'spec-workflow', 'mcp-integration']
    };

    this.config.responseStyle = {
      tone: 'warm',
      verbosity: 'standard',
      platformAdaptation: true
    };

    this.config.specs = {
      defaultFormat: 'ears',
      requireApproval: true,
      taskIsolation: true
    };

    this.config.steering = {
      directory: path.join(this.basePath, 'steering'),
      inclusionModes: ['always', 'conditional', 'manual'],
      fileReferencePattern: '#\\[\\[file:([^\\]]+)\\]\\]'
    };

    this.config.hooks = {
      enabled: true,
      triggers: []
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): Partial<KiroConfig> {
    return { ...this.config };
  }
}