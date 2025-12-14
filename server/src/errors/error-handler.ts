/**
 * Comprehensive error handling system for Kiro
 * Provides user-friendly error messages, graceful degradation, and recovery suggestions
 */

import {
  KiroError,
  KiroErrorCode,
  ErrorContext,
  ErrorReport,
  RecoverySuggestion,
  DegradationResult,
  ComponentHealth,
  SystemHealthReport,
  ErrorSeverity
} from './types.js';

/**
 * Aggregated error report for multiple errors
 */
export interface AggregatedErrorReport {
  errors: KiroError[];
  warnings: KiroError[];
  summary: string;
  hasErrors: boolean;
  hasWarnings: boolean;
  recoverable: boolean;
}

/**
 * Configuration validation context
 */
export interface ConfigValidationContext {
  configType: 'mcp' | 'steering' | 'hooks' | 'spec';
  filePath?: string;
  operation: 'load' | 'save' | 'validate' | 'merge';
}

/**
 * Error messages mapped to error codes for user-friendly reporting
 */
const ERROR_MESSAGES: Record<KiroErrorCode, { message: string; suggestion: string }> = {
  // Configuration errors
  CONFIG_NOT_FOUND: {
    message: 'Configuration file not found',
    suggestion: 'Create the configuration file or check the file path'
  },
  CONFIG_INVALID_JSON: {
    message: 'Configuration file contains invalid JSON',
    suggestion: 'Check for syntax errors like missing commas, quotes, or brackets'
  },
  CONFIG_INVALID_SCHEMA: {
    message: 'Configuration does not match expected schema',
    suggestion: 'Review the configuration structure and required fields'
  },
  CONFIG_PERMISSION_DENIED: {
    message: 'Cannot access configuration file due to permissions',
    suggestion: 'Check file permissions and ensure read/write access'
  },
  CONFIG_WRITE_FAILED: {
    message: 'Failed to write configuration file',
    suggestion: 'Check disk space and file permissions'
  },
  // Directory errors
  DIR_NOT_FOUND: {
    message: 'Required directory not found',
    suggestion: 'Create the directory or check the path'
  },
  DIR_NOT_ACCESSIBLE: {
    message: 'Cannot access directory',
    suggestion: 'Check directory permissions'
  },
  DIR_CREATE_FAILED: {
    message: 'Failed to create directory',
    suggestion: 'Check parent directory permissions and disk space'
  },
  DIR_NOT_DIRECTORY: {
    message: 'Path exists but is not a directory',
    suggestion: 'Remove the file or use a different path'
  },
  // File errors
  FILE_NOT_FOUND: {
    message: 'File not found',
    suggestion: 'Check the file path and ensure the file exists'
  },
  FILE_READ_ERROR: {
    message: 'Failed to read file',
    suggestion: 'Check file permissions and encoding'
  },
  FILE_WRITE_ERROR: {
    message: 'Failed to write file',
    suggestion: 'Check disk space and file permissions'
  },
  FILE_INVALID_FORMAT: {
    message: 'File format is invalid',
    suggestion: 'Check the file content and expected format'
  },
  // MCP errors
  MCP_SERVER_NOT_FOUND: {
    message: 'MCP server not found in configuration',
    suggestion: 'Add the server to mcp.json or check the server name'
  },
  MCP_CONNECTION_FAILED: {
    message: 'Failed to connect to MCP server',
    suggestion: 'Check if the server is running and the command is correct'
  },
  MCP_COMMAND_NOT_FOUND: {
    message: 'MCP server command not found',
    suggestion: 'Install the required package or check the command path'
  },
  MCP_DEPENDENCY_MISSING: {
    message: 'MCP server dependency is missing',
    suggestion: 'Install uv/uvx using: pip install uv or brew install uv'
  },
  // Steering errors
  STEERING_INVALID_FRONT_MATTER: {
    message: 'Steering file has invalid front-matter',
    suggestion: 'Check YAML syntax in the front-matter section'
  },
  STEERING_MISSING_PATTERN: {
    message: 'fileMatchPattern is required for conditional steering',
    suggestion: 'Add fileMatchPattern when using fileMatch inclusion mode'
  },
  STEERING_REFERENCE_NOT_FOUND: {
    message: 'Referenced file in steering not found',
    suggestion: 'Check the file path in the #[[file:...]] reference'
  },
  // Hook errors
  HOOK_INVALID_TRIGGER: {
    message: 'Invalid hook trigger event',
    suggestion: 'Use a valid trigger event like onSave, onMessage, or onComplete'
  },
  HOOK_EXECUTION_FAILED: {
    message: 'Hook execution failed',
    suggestion: 'Check the hook action and command syntax'
  },
  HOOK_CONFIG_INVALID: {
    message: 'Hook configuration is invalid',
    suggestion: 'Review the hook configuration structure'
  },
  // Spec errors
  SPEC_INVALID_FORMAT: {
    message: 'Spec document format is invalid',
    suggestion: 'Check the document structure and required sections'
  },
  SPEC_MISSING_SECTION: {
    message: 'Required section missing from spec document',
    suggestion: 'Add the missing section to the document'
  },
  SPEC_VALIDATION_FAILED: {
    message: 'Spec validation failed',
    suggestion: 'Review validation errors and fix the issues'
  },
  // General errors
  UNKNOWN_ERROR: {
    message: 'An unexpected error occurred',
    suggestion: 'Check the error details and try again'
  },
  OPERATION_TIMEOUT: {
    message: 'Operation timed out',
    suggestion: 'Try again or check network connectivity'
  },
  INITIALIZATION_FAILED: {
    message: 'System initialization failed',
    suggestion: 'Check configuration and required dependencies'
  }
};


/**
 * Main error handler class for Kiro system
 */
export class KiroErrorHandler {
  /**
   * Create a structured KiroError from an error code
   */
  static createError(code: KiroErrorCode, options: { path?: string; details?: string; recoverable?: boolean } = {}): KiroError {
    const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR;
    
    return {
      code,
      message: errorInfo.message,
      severity: this.getSeverity(code),
      path: options.path,
      details: options.details,
      suggestion: errorInfo.suggestion,
      recoverable: options.recoverable ?? this.isRecoverable(code)
    };
  }

  /**
   * Create error from native Error object
   */
  static fromError(error: Error, context: Partial<ErrorContext> = {}): KiroError {
    const code = this.inferErrorCode(error);
    return this.createError(code, {
      details: error.message,
      recoverable: this.isRecoverable(code)
    });
  }

  /**
   * Generate a complete error report with context and suggestions
   */
  static createReport(error: KiroError, context: ErrorContext): ErrorReport {
    const suggestions = this.generateSuggestions(error, context);
    const userMessage = this.formatUserMessage(error);

    return { error, context, suggestions, userMessage };
  }

  /**
   * Format error for user display
   */
  static formatUserMessage(error: KiroError): string {
    let message = error.message;
    
    if (error.path) {
      message += ` (${error.path})`;
    }
    
    if (error.details) {
      message += `\n  Details: ${error.details}`;
    }
    
    if (error.suggestion) {
      message += `\n  Suggestion: ${error.suggestion}`;
    }
    
    return message;
  }

  /**
   * Determine error severity based on code
   */
  private static getSeverity(code: KiroErrorCode): ErrorSeverity {
    const warningCodes: KiroErrorCode[] = [
      'STEERING_REFERENCE_NOT_FOUND',
      'MCP_DEPENDENCY_MISSING'
    ];
    
    const infoCodes: KiroErrorCode[] = [];
    
    if (warningCodes.includes(code)) return 'warning';
    if (infoCodes.includes(code)) return 'info';
    return 'error';
  }

  /**
   * Check if error is recoverable
   */
  private static isRecoverable(code: KiroErrorCode): boolean {
    const nonRecoverable: KiroErrorCode[] = [
      'CONFIG_PERMISSION_DENIED',
      'DIR_NOT_ACCESSIBLE',
      'INITIALIZATION_FAILED'
    ];
    return !nonRecoverable.includes(code);
  }

  /**
   * Infer error code from native Error
   */
  private static inferErrorCode(error: Error): KiroErrorCode {
    const message = error.message.toLowerCase();
    
    if (message.includes('enoent')) return 'FILE_NOT_FOUND';
    if (message.includes('eacces')) return 'CONFIG_PERMISSION_DENIED';
    if (message.includes('json')) return 'CONFIG_INVALID_JSON';
    if (message.includes('timeout')) return 'OPERATION_TIMEOUT';
    if (message.includes('schema')) return 'CONFIG_INVALID_SCHEMA';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Generate recovery suggestions based on error and context
   */
  private static generateSuggestions(error: KiroError, context: ErrorContext): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    // Add default suggestion from error info
    if (error.suggestion) {
      suggestions.push({
        action: 'manual_fix',
        description: error.suggestion,
        steps: [error.suggestion],
        confidence: 'high',
        automated: false
      });
    }

    // Add context-specific suggestions
    switch (error.code) {
      case 'CONFIG_NOT_FOUND':
        suggestions.push({
          action: 'create_missing',
          description: 'Create default configuration',
          steps: ['Create the .kiro directory', 'Add default configuration files'],
          confidence: 'high',
          automated: true
        });
        break;

      case 'MCP_DEPENDENCY_MISSING':
        suggestions.push({
          action: 'reinstall',
          description: 'Install uv package manager',
          steps: ['Run: pip install uv', 'Or: brew install uv (macOS)'],
          confidence: 'high',
          automated: false
        });
        break;

      case 'MCP_CONNECTION_FAILED':
        if (context.attempts && context.attempts < 3) {
          suggestions.push({
            action: 'retry',
            description: 'Retry connection',
            steps: ['Wait a moment', 'Attempt reconnection'],
            confidence: 'medium',
            automated: true
          });
        }
        break;

      case 'STEERING_REFERENCE_NOT_FOUND':
        suggestions.push({
          action: 'skip',
          description: 'Continue without referenced file',
          steps: ['Skip the missing reference', 'Continue processing'],
          confidence: 'medium',
          automated: true
        });
        break;
    }

    return suggestions;
  }
}


/**
 * Graceful degradation handler for missing or failing components
 */
export class GracefulDegradation {
  /**
   * Execute operation with fallback on failure
   */
  static async withFallback<T>(
    operation: () => Promise<T> | T,
    fallback: T,
    fallbackName: string
  ): Promise<DegradationResult<T>> {
    const warnings: string[] = [];
    
    try {
      const value = await operation();
      return { success: true, value, degraded: false, warnings };
    } catch (error) {
      warnings.push(`Using fallback: ${fallbackName} (${(error as Error).message})`);
      return { success: true, value: fallback, degraded: true, fallbackUsed: fallbackName, warnings };
    }
  }

  /**
   * Execute operation with default value on failure
   */
  static withDefault<T>(operation: () => T, defaultValue: T): DegradationResult<T> {
    const warnings: string[] = [];
    
    try {
      const value = operation();
      return { success: true, value, degraded: false, warnings };
    } catch (error) {
      warnings.push(`Using default value (${(error as Error).message})`);
      return { success: true, value: defaultValue, degraded: true, fallbackUsed: 'default', warnings };
    }
  }

  /**
   * Skip operation on failure
   */
  static skipOnFailure<T>(operation: () => T): DegradationResult<T | undefined> {
    const warnings: string[] = [];
    
    try {
      const value = operation();
      return { success: true, value, degraded: false, warnings };
    } catch (error) {
      warnings.push(`Skipped operation (${(error as Error).message})`);
      return { success: true, value: undefined, degraded: true, fallbackUsed: 'skip', warnings };
    }
  }
}

/**
 * System health monitoring
 */
export class HealthMonitor {
  private static componentStatus: Map<string, ComponentHealth> = new Map();

  /**
   * Check health of a specific component
   */
  static checkComponent(component: string, checker: () => boolean): ComponentHealth {
    const issues: KiroError[] = [];
    let healthy = false;
    
    try {
      healthy = checker();
    } catch (error) {
      issues.push(KiroErrorHandler.fromError(error as Error));
    }

    const health: ComponentHealth = {
      component,
      healthy,
      status: healthy ? 'operational' : issues.length > 0 ? 'unavailable' : 'degraded',
      lastCheck: new Date(),
      issues
    };

    this.componentStatus.set(component, health);
    return health;
  }

  /**
   * Get overall system health report
   */
  static getSystemHealth(): SystemHealthReport {
    const components = Array.from(this.componentStatus.values());
    
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    const hasUnavailable = components.some(c => c.status === 'unavailable');
    const hasDegraded = components.some(c => c.status === 'degraded');
    
    if (hasUnavailable) {
      overall = 'unhealthy';
    } else if (hasDegraded) {
      overall = 'degraded';
    }

    return { overall, components, timestamp: new Date() };
  }

  /**
   * Clear health status cache
   */
  static clearStatus(): void {
    this.componentStatus.clear();
  }
}

/**
 * Validation error formatter for configuration validation results
 */
export class ValidationErrorFormatter {
  /**
   * Format validation errors for user display
   */
  static format(errors: Array<{ path: string; message: string; code: string }>): string {
    if (errors.length === 0) return 'No errors found';
    
    const lines = ['Validation errors found:'];
    
    for (const error of errors) {
      lines.push(`  • ${error.path}: ${error.message}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format validation warnings for user display
   */
  static formatWarnings(warnings: Array<{ path: string; message: string; code: string }>): string {
    if (warnings.length === 0) return '';
    
    const lines = ['Warnings:'];
    
    for (const warning of warnings) {
      lines.push(`  ⚠ ${warning.path}: ${warning.message}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Create summary of validation result
   */
  static summarize(result: { valid: boolean; errors: any[]; warnings: any[] }): string {
    if (result.valid && result.warnings.length === 0) {
      return '✓ Configuration is valid';
    }
    
    const parts: string[] = [];
    
    if (!result.valid) {
      parts.push(this.format(result.errors));
    }
    
    if (result.warnings.length > 0) {
      parts.push(this.formatWarnings(result.warnings));
    }
    
    return parts.join('\n\n');
  }
}

/**
 * Error aggregator for collecting and reporting multiple errors
 */
export class ErrorAggregator {
  private errors: KiroError[] = [];
  private warnings: KiroError[] = [];

  /**
   * Add an error to the aggregator
   */
  addError(error: KiroError): void {
    if (error.severity === 'warning') {
      this.warnings.push(error);
    } else {
      this.errors.push(error);
    }
  }

  /**
   * Add error from error code
   */
  addErrorCode(code: KiroErrorCode, options: { path?: string; details?: string } = {}): void {
    const error = KiroErrorHandler.createError(code, options);
    this.addError(error);
  }

  /**
   * Add error from native Error
   */
  addNativeError(error: Error, path?: string): void {
    const kiroError = KiroErrorHandler.fromError(error);
    if (path) {
      kiroError.path = path;
    }
    this.addError(kiroError);
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if there are any warnings
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  /**
   * Get aggregated report
   */
  getReport(): AggregatedErrorReport {
    const allRecoverable = this.errors.every(e => e.recoverable);
    
    return {
      errors: [...this.errors],
      warnings: [...this.warnings],
      summary: this.formatSummary(),
      hasErrors: this.errors.length > 0,
      hasWarnings: this.warnings.length > 0,
      recoverable: allRecoverable
    };
  }

  /**
   * Format summary for user display
   */
  private formatSummary(): string {
    if (this.errors.length === 0 && this.warnings.length === 0) {
      return '✓ No issues found';
    }

    const parts: string[] = [];

    if (this.errors.length > 0) {
      parts.push(`${this.errors.length} error(s) found:`);
      for (const error of this.errors) {
        parts.push(`  ✗ ${KiroErrorHandler.formatUserMessage(error)}`);
      }
    }

    if (this.warnings.length > 0) {
      parts.push(`${this.warnings.length} warning(s):`);
      for (const warning of this.warnings) {
        parts.push(`  ⚠ ${KiroErrorHandler.formatUserMessage(warning)}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Clear all errors and warnings
   */
  clear(): void {
    this.errors = [];
    this.warnings = [];
  }
}

/**
 * Configuration-specific error handler with context-aware messages
 */
export class ConfigErrorHandler {
  /**
   * Create error for configuration validation context
   */
  static createConfigError(
    code: KiroErrorCode,
    context: ConfigValidationContext,
    details?: string
  ): KiroError {
    const error = KiroErrorHandler.createError(code, {
      path: context.filePath,
      details
    });

    // Enhance message with context
    const contextPrefix = this.getContextPrefix(context);
    error.message = `${contextPrefix}: ${error.message}`;

    return error;
  }

  /**
   * Get context-specific prefix for error messages
   */
  private static getContextPrefix(context: ConfigValidationContext): string {
    const typeNames: Record<string, string> = {
      mcp: 'MCP Configuration',
      steering: 'Steering File',
      hooks: 'Hook Configuration',
      spec: 'Spec Document'
    };

    const operationNames: Record<string, string> = {
      load: 'Loading',
      save: 'Saving',
      validate: 'Validating',
      merge: 'Merging'
    };

    return `${operationNames[context.operation]} ${typeNames[context.configType]}`;
  }

  /**
   * Handle missing component with graceful degradation
   */
  static handleMissingComponent<T>(
    componentName: string,
    defaultValue: T,
    context: ConfigValidationContext
  ): DegradationResult<T> {
    const warning = `${componentName} not found, using default configuration`;
    return {
      success: true,
      value: defaultValue,
      degraded: true,
      fallbackUsed: 'default',
      warnings: [warning]
    };
  }

  /**
   * Format configuration validation result for user display
   */
  static formatValidationResult(
    result: { valid: boolean; errors: any[]; warnings: any[] },
    context: ConfigValidationContext
  ): string {
    const contextPrefix = this.getContextPrefix(context);
    
    if (result.valid && result.warnings.length === 0) {
      return `✓ ${contextPrefix} is valid`;
    }

    const parts: string[] = [];
    
    if (!result.valid) {
      parts.push(`✗ ${contextPrefix} validation failed:`);
      for (const error of result.errors) {
        parts.push(`  • ${error.path}: ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      parts.push(`⚠ ${contextPrefix} warnings:`);
      for (const warning of result.warnings) {
        parts.push(`  • ${warning.path}: ${warning.message}`);
      }
    }

    return parts.join('\n');
  }
}

/**
 * User-friendly error reporter for displaying errors to end users
 */
export class UserErrorReporter {
  /**
   * Format error for console output
   */
  static formatForConsole(error: KiroError): string {
    const icon = error.severity === 'error' ? '✗' : error.severity === 'warning' ? '⚠' : 'ℹ';
    const lines: string[] = [];
    
    lines.push(`${icon} ${error.message}`);
    
    if (error.path) {
      lines.push(`  Location: ${error.path}`);
    }
    
    if (error.details) {
      lines.push(`  Details: ${error.details}`);
    }
    
    if (error.suggestion) {
      lines.push(`  Suggestion: ${error.suggestion}`);
    }
    
    if (error.recoverable) {
      lines.push(`  Status: Recoverable`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format multiple errors for console output
   */
  static formatMultiple(errors: KiroError[]): string {
    if (errors.length === 0) {
      return '✓ No issues found';
    }

    return errors.map(e => this.formatForConsole(e)).join('\n\n');
  }

  /**
   * Create a brief one-line summary
   */
  static briefSummary(errors: KiroError[], warnings: KiroError[] = []): string {
    const errorCount = errors.length;
    const warningCount = warnings.length;

    if (errorCount === 0 && warningCount === 0) {
      return '✓ All checks passed';
    }

    const parts: string[] = [];
    if (errorCount > 0) {
      parts.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
    }

    return `Found ${parts.join(' and ')}`;
  }
}
