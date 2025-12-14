/**
 * Tests for error handling system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  KiroErrorHandler, 
  GracefulDegradation, 
  HealthMonitor,
  ValidationErrorFormatter,
  ErrorAggregator,
  ConfigErrorHandler,
  UserErrorReporter
} from './error-handler.js';

describe('KiroErrorHandler', () => {
  describe('createError', () => {
    it('creates error with correct code and message', () => {
      const error = KiroErrorHandler.createError('CONFIG_NOT_FOUND');
      expect(error.code).toBe('CONFIG_NOT_FOUND');
      expect(error.message).toBe('Configuration file not found');
      expect(error.suggestion).toBeDefined();
    });

    it('includes path when provided', () => {
      const error = KiroErrorHandler.createError('FILE_NOT_FOUND', { path: '/test/file.json' });
      expect(error.path).toBe('/test/file.json');
    });

    it('includes details when provided', () => {
      const error = KiroErrorHandler.createError('CONFIG_INVALID_JSON', { details: 'Unexpected token' });
      expect(error.details).toBe('Unexpected token');
    });

    it('sets recoverable flag correctly', () => {
      const recoverableError = KiroErrorHandler.createError('CONFIG_NOT_FOUND');
      expect(recoverableError.recoverable).toBe(true);

      const nonRecoverableError = KiroErrorHandler.createError('CONFIG_PERMISSION_DENIED');
      expect(nonRecoverableError.recoverable).toBe(false);
    });
  });

  describe('fromError', () => {
    it('infers FILE_NOT_FOUND from ENOENT', () => {
      const error = KiroErrorHandler.fromError(new Error('ENOENT: no such file'));
      expect(error.code).toBe('FILE_NOT_FOUND');
    });

    it('infers CONFIG_PERMISSION_DENIED from EACCES', () => {
      const error = KiroErrorHandler.fromError(new Error('EACCES: permission denied'));
      expect(error.code).toBe('CONFIG_PERMISSION_DENIED');
    });

    it('infers CONFIG_INVALID_JSON from JSON errors', () => {
      const error = KiroErrorHandler.fromError(new Error('Unexpected token in JSON'));
      expect(error.code).toBe('CONFIG_INVALID_JSON');
    });

    it('returns UNKNOWN_ERROR for unrecognized errors', () => {
      const error = KiroErrorHandler.fromError(new Error('Something went wrong'));
      expect(error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('formatUserMessage', () => {
    it('formats basic error message', () => {
      const error = KiroErrorHandler.createError('CONFIG_NOT_FOUND');
      const message = KiroErrorHandler.formatUserMessage(error);
      expect(message).toContain('Configuration file not found');
    });

    it('includes path in message', () => {
      const error = KiroErrorHandler.createError('FILE_NOT_FOUND', { path: '/test/file.json' });
      const message = KiroErrorHandler.formatUserMessage(error);
      expect(message).toContain('/test/file.json');
    });

    it('includes suggestion in message', () => {
      const error = KiroErrorHandler.createError('CONFIG_NOT_FOUND');
      const message = KiroErrorHandler.formatUserMessage(error);
      expect(message).toContain('Suggestion:');
    });
  });

  describe('createReport', () => {
    it('creates complete error report', () => {
      const error = KiroErrorHandler.createError('MCP_CONNECTION_FAILED');
      const context = {
        operation: 'connect',
        component: 'mcp' as const,
        timestamp: new Date(),
        attempts: 1
      };
      
      const report = KiroErrorHandler.createReport(error, context);
      
      expect(report.error).toBe(error);
      expect(report.context).toBe(context);
      expect(report.suggestions.length).toBeGreaterThan(0);
      expect(report.userMessage).toBeDefined();
    });
  });
});


describe('GracefulDegradation', () => {
  describe('withFallback', () => {
    it('returns value on success', async () => {
      const result = await GracefulDegradation.withFallback(
        () => 'success',
        'fallback',
        'test fallback'
      );
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.degraded).toBe(false);
    });

    it('returns fallback on failure', async () => {
      const result = await GracefulDegradation.withFallback(
        () => { throw new Error('fail'); },
        'fallback',
        'test fallback'
      );
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('fallback');
      expect(result.degraded).toBe(true);
      expect(result.fallbackUsed).toBe('test fallback');
    });
  });

  describe('withDefault', () => {
    it('returns value on success', () => {
      const result = GracefulDegradation.withDefault(() => 42, 0);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
      expect(result.degraded).toBe(false);
    });

    it('returns default on failure', () => {
      const result = GracefulDegradation.withDefault(
        () => { throw new Error('fail'); },
        0
      );
      
      expect(result.success).toBe(true);
      expect(result.value).toBe(0);
      expect(result.degraded).toBe(true);
    });
  });

  describe('skipOnFailure', () => {
    it('returns value on success', () => {
      const result = GracefulDegradation.skipOnFailure(() => 'value');
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('value');
      expect(result.degraded).toBe(false);
    });

    it('returns undefined on failure', () => {
      const result = GracefulDegradation.skipOnFailure(
        () => { throw new Error('fail'); }
      );
      
      expect(result.success).toBe(true);
      expect(result.value).toBeUndefined();
      expect(result.degraded).toBe(true);
    });
  });
});

describe('HealthMonitor', () => {
  beforeEach(() => {
    HealthMonitor.clearStatus();
  });

  describe('checkComponent', () => {
    it('reports healthy component', () => {
      const health = HealthMonitor.checkComponent('test', () => true);
      
      expect(health.healthy).toBe(true);
      expect(health.status).toBe('operational');
      expect(health.issues).toHaveLength(0);
    });

    it('reports unhealthy component', () => {
      const health = HealthMonitor.checkComponent('test', () => false);
      
      expect(health.healthy).toBe(false);
      expect(health.status).toBe('degraded');
    });

    it('captures errors as issues', () => {
      const health = HealthMonitor.checkComponent('test', () => {
        throw new Error('Component failed');
      });
      
      expect(health.healthy).toBe(false);
      expect(health.status).toBe('unavailable');
      expect(health.issues.length).toBeGreaterThan(0);
    });
  });

  describe('getSystemHealth', () => {
    it('reports healthy system when all components healthy', () => {
      HealthMonitor.checkComponent('comp1', () => true);
      HealthMonitor.checkComponent('comp2', () => true);
      
      const report = HealthMonitor.getSystemHealth();
      expect(report.overall).toBe('healthy');
    });

    it('reports degraded system when some components degraded', () => {
      HealthMonitor.checkComponent('comp1', () => true);
      HealthMonitor.checkComponent('comp2', () => false);
      
      const report = HealthMonitor.getSystemHealth();
      expect(report.overall).toBe('degraded');
    });

    it('reports unhealthy system when components unavailable', () => {
      HealthMonitor.checkComponent('comp1', () => { throw new Error('fail'); });
      
      const report = HealthMonitor.getSystemHealth();
      expect(report.overall).toBe('unhealthy');
    });
  });
});

describe('ValidationErrorFormatter', () => {
  describe('format', () => {
    it('formats empty errors', () => {
      const result = ValidationErrorFormatter.format([]);
      expect(result).toBe('No errors found');
    });

    it('formats multiple errors', () => {
      const errors = [
        { path: 'config.json', message: 'Invalid JSON', code: 'INVALID_JSON' },
        { path: 'settings.yaml', message: 'Missing field', code: 'MISSING_FIELD' }
      ];
      
      const result = ValidationErrorFormatter.format(errors);
      expect(result).toContain('config.json');
      expect(result).toContain('Invalid JSON');
      expect(result).toContain('settings.yaml');
    });
  });

  describe('summarize', () => {
    it('summarizes valid result', () => {
      const result = ValidationErrorFormatter.summarize({
        valid: true,
        errors: [],
        warnings: []
      });
      expect(result).toContain('valid');
    });

    it('summarizes invalid result with errors', () => {
      const result = ValidationErrorFormatter.summarize({
        valid: false,
        errors: [{ path: 'test', message: 'error', code: 'ERR' }],
        warnings: []
      });
      expect(result).toContain('error');
    });
  });
});

describe('ErrorAggregator', () => {
  let aggregator: ErrorAggregator;

  beforeEach(() => {
    aggregator = new ErrorAggregator();
  });

  describe('addError', () => {
    it('adds errors to the aggregator', () => {
      const error = KiroErrorHandler.createError('CONFIG_NOT_FOUND');
      aggregator.addError(error);
      
      expect(aggregator.hasErrors()).toBe(true);
      expect(aggregator.getReport().errors).toHaveLength(1);
    });

    it('separates warnings from errors', () => {
      const warning = KiroErrorHandler.createError('STEERING_REFERENCE_NOT_FOUND');
      aggregator.addError(warning);
      
      expect(aggregator.hasErrors()).toBe(false);
      expect(aggregator.hasWarnings()).toBe(true);
    });
  });

  describe('addErrorCode', () => {
    it('creates and adds error from code', () => {
      aggregator.addErrorCode('FILE_NOT_FOUND', { path: '/test/file.json' });
      
      const report = aggregator.getReport();
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].path).toBe('/test/file.json');
    });
  });

  describe('addNativeError', () => {
    it('converts native error and adds it', () => {
      aggregator.addNativeError(new Error('ENOENT: file not found'), '/missing/file');
      
      const report = aggregator.getReport();
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('getReport', () => {
    it('returns aggregated report with summary', () => {
      aggregator.addErrorCode('CONFIG_NOT_FOUND');
      aggregator.addErrorCode('FILE_READ_ERROR');
      
      const report = aggregator.getReport();
      
      expect(report.hasErrors).toBe(true);
      expect(report.errors).toHaveLength(2);
      expect(report.summary).toContain('2 error(s)');
    });

    it('reports recoverable status correctly', () => {
      aggregator.addErrorCode('CONFIG_NOT_FOUND'); // recoverable
      
      const report = aggregator.getReport();
      expect(report.recoverable).toBe(true);
    });

    it('reports non-recoverable when any error is non-recoverable', () => {
      aggregator.addErrorCode('CONFIG_PERMISSION_DENIED'); // non-recoverable
      
      const report = aggregator.getReport();
      expect(report.recoverable).toBe(false);
    });
  });

  describe('clear', () => {
    it('clears all errors and warnings', () => {
      aggregator.addErrorCode('CONFIG_NOT_FOUND');
      aggregator.clear();
      
      expect(aggregator.hasErrors()).toBe(false);
      expect(aggregator.hasWarnings()).toBe(false);
    });
  });
});

describe('ConfigErrorHandler', () => {
  describe('createConfigError', () => {
    it('creates error with context prefix', () => {
      const context = {
        configType: 'mcp' as const,
        operation: 'load' as const,
        filePath: '/test/mcp.json'
      };
      
      const error = ConfigErrorHandler.createConfigError('CONFIG_NOT_FOUND', context);
      
      expect(error.message).toContain('Loading MCP Configuration');
      expect(error.path).toBe('/test/mcp.json');
    });

    it('includes details when provided', () => {
      const context = {
        configType: 'steering' as const,
        operation: 'validate' as const
      };
      
      const error = ConfigErrorHandler.createConfigError(
        'STEERING_INVALID_FRONT_MATTER',
        context,
        'Missing required field'
      );
      
      expect(error.details).toBe('Missing required field');
    });
  });

  describe('handleMissingComponent', () => {
    it('returns degraded result with default value', () => {
      const context = {
        configType: 'mcp' as const,
        operation: 'load' as const
      };
      
      const result = ConfigErrorHandler.handleMissingComponent(
        'MCP Config',
        { servers: {} },
        context
      );
      
      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.value).toEqual({ servers: {} });
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('formatValidationResult', () => {
    it('formats valid result', () => {
      const context = {
        configType: 'hooks' as const,
        operation: 'validate' as const
      };
      
      const result = ConfigErrorHandler.formatValidationResult(
        { valid: true, errors: [], warnings: [] },
        context
      );
      
      expect(result).toContain('✓');
      expect(result).toContain('Hook Configuration');
      expect(result).toContain('valid');
    });

    it('formats invalid result with errors', () => {
      const context = {
        configType: 'spec' as const,
        operation: 'validate' as const
      };
      
      const result = ConfigErrorHandler.formatValidationResult(
        { 
          valid: false, 
          errors: [{ path: 'requirements.md', message: 'Missing section', code: 'ERR' }],
          warnings: []
        },
        context
      );
      
      expect(result).toContain('✗');
      expect(result).toContain('Spec Document');
      expect(result).toContain('Missing section');
    });
  });
});

describe('UserErrorReporter', () => {
  describe('formatForConsole', () => {
    it('formats error with all fields', () => {
      const error = KiroErrorHandler.createError('CONFIG_NOT_FOUND', {
        path: '/test/config.json',
        details: 'File does not exist'
      });
      
      const output = UserErrorReporter.formatForConsole(error);
      
      expect(output).toContain('✗');
      expect(output).toContain('Configuration file not found');
      expect(output).toContain('/test/config.json');
      expect(output).toContain('File does not exist');
      expect(output).toContain('Suggestion:');
    });

    it('uses warning icon for warnings', () => {
      const warning = KiroErrorHandler.createError('STEERING_REFERENCE_NOT_FOUND');
      
      const output = UserErrorReporter.formatForConsole(warning);
      
      expect(output).toContain('⚠');
    });
  });

  describe('formatMultiple', () => {
    it('formats multiple errors', () => {
      const errors = [
        KiroErrorHandler.createError('CONFIG_NOT_FOUND'),
        KiroErrorHandler.createError('FILE_READ_ERROR')
      ];
      
      const output = UserErrorReporter.formatMultiple(errors);
      
      expect(output).toContain('Configuration file not found');
      expect(output).toContain('Failed to read file');
    });

    it('returns success message for empty array', () => {
      const output = UserErrorReporter.formatMultiple([]);
      expect(output).toContain('No issues found');
    });
  });

  describe('briefSummary', () => {
    it('returns success for no issues', () => {
      const summary = UserErrorReporter.briefSummary([], []);
      expect(summary).toContain('All checks passed');
    });

    it('summarizes errors only', () => {
      const errors = [
        KiroErrorHandler.createError('CONFIG_NOT_FOUND'),
        KiroErrorHandler.createError('FILE_READ_ERROR')
      ];
      
      const summary = UserErrorReporter.briefSummary(errors);
      expect(summary).toBe('Found 2 errors');
    });

    it('summarizes errors and warnings', () => {
      const errors = [KiroErrorHandler.createError('CONFIG_NOT_FOUND')];
      const warnings = [KiroErrorHandler.createError('STEERING_REFERENCE_NOT_FOUND')];
      
      const summary = UserErrorReporter.briefSummary(errors, warnings);
      expect(summary).toBe('Found 1 error and 1 warning');
    });
  });
});
