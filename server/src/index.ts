/**
 * MCP Integration System - Configuration
 * Main entry point for configuration management
 */

// Core configuration
export { ConfigurationManager } from './config/manager.js';
export { ConfigValidator } from './config/validator.js';
export * from './config/types.js';

// Unified MCP Configuration
export {
  UnifiedMCPConfig,
  UnifiedMCPConfigValidator,
  UnifiedMCPConfigLoader,
  DEFAULT_UNIFIED_CONFIG,
  AWSConfig,
  MCPServersConfig,
  MCPServerDefinition,
  CircuitBreakerConfig,
  RetryConfig,
  BatchConfig,
  IntegrationConfig,
  MonitoringConfig
} from './config/unified-mcp-config.js';

// Code generation utilities
export * from './codegen/index.js';

// Error handling
export * from './errors/index.js';

// Utility classes
export * from './utils/index.js';

// Environment loader
export {
  loadEnvConfig,
  loadEnvFile,
  validateEnvConfig,
  getEnvConfig,
  resetEnvConfig,
  env,
  EnvConfig,
  Environment
} from './config/env-loader.js';

// Default export for easy usage
export { ConfigurationManager as default } from './config/manager.js';