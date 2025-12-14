/**
 * Error handling types for Kiro configuration system
 * Provides structured error types and user-friendly error reporting
 */

/**
 * Base error codes for the Kiro system
 */
export type KiroErrorCode =
  // Configuration errors
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID_JSON'
  | 'CONFIG_INVALID_SCHEMA'
  | 'CONFIG_PERMISSION_DENIED'
  | 'CONFIG_WRITE_FAILED'
  // Directory errors
  | 'DIR_NOT_FOUND'
  | 'DIR_NOT_ACCESSIBLE'
  | 'DIR_CREATE_FAILED'
  | 'DIR_NOT_DIRECTORY'
  // File errors
  | 'FILE_NOT_FOUND'
  | 'FILE_READ_ERROR'
  | 'FILE_WRITE_ERROR'
  | 'FILE_INVALID_FORMAT'
  // MCP errors
  | 'MCP_SERVER_NOT_FOUND'
  | 'MCP_CONNECTION_FAILED'
  | 'MCP_COMMAND_NOT_FOUND'
  | 'MCP_DEPENDENCY_MISSING'
  // Steering errors
  | 'STEERING_INVALID_FRONT_MATTER'
  | 'STEERING_MISSING_PATTERN'
  | 'STEERING_REFERENCE_NOT_FOUND'
  // Hook errors
  | 'HOOK_INVALID_TRIGGER'
  | 'HOOK_EXECUTION_FAILED'
  | 'HOOK_CONFIG_INVALID'
  // Spec errors
  | 'SPEC_INVALID_FORMAT'
  | 'SPEC_MISSING_SECTION'
  | 'SPEC_VALIDATION_FAILED'
  // General errors
  | 'UNKNOWN_ERROR'
  | 'OPERATION_TIMEOUT'
  | 'INITIALIZATION_FAILED';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Structured error information
 */
export interface KiroError {
  code: KiroErrorCode;
  message: string;
  severity: ErrorSeverity;
  path?: string;
  details?: string;
  suggestion?: string;
  recoverable: boolean;
}

/**
 * Error context for recovery suggestions
 */
export interface ErrorContext {
  operation: string;
  component: 'config' | 'mcp' | 'steering' | 'hooks' | 'spec' | 'codegen';
  timestamp: Date;
  attempts?: number;
  lastError?: Error;
}

/**
 * Recovery action types
 */
export type RecoveryAction =
  | 'retry'
  | 'use_default'
  | 'skip'
  | 'create_missing'
  | 'manual_fix'
  | 'reinstall';

/**
 * Recovery suggestion with actionable steps
 */
export interface RecoverySuggestion {
  action: RecoveryAction;
  description: string;
  steps: string[];
  confidence: 'high' | 'medium' | 'low';
  automated: boolean;
}

/**
 * Error report with full context and suggestions
 */
export interface ErrorReport {
  error: KiroError;
  context: ErrorContext;
  suggestions: RecoverySuggestion[];
  userMessage: string;
}

/**
 * Graceful degradation result
 */
export interface DegradationResult<T> {
  success: boolean;
  value?: T;
  degraded: boolean;
  fallbackUsed?: string;
  warnings: string[];
}

/**
 * Component health status
 */
export interface ComponentHealth {
  component: string;
  healthy: boolean;
  status: 'operational' | 'degraded' | 'unavailable';
  lastCheck: Date;
  issues: KiroError[];
}

/**
 * System health report
 */
export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealth[];
  timestamp: Date;
}
