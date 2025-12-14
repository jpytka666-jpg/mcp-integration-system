/**
 * Kiro Configuration System
 * Main entry point for configuration management
 */

// Core configuration
export { ConfigurationManager } from './config/manager.js';
export { ConfigValidator } from './config/validator.js';
export * from './config/types.js';

// Code generation utilities
export * from './codegen/index.js';

// Error handling
export * from './errors/index.js';

// Default export for easy usage
export { ConfigurationManager as default } from './config/manager.js';