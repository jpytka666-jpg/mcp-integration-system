/**
 * Error handling utilities
 */

export { 
  KiroErrorHandler, 
  GracefulDegradation, 
  HealthMonitor,
  ValidationErrorFormatter,
  ErrorAggregator,
  ConfigErrorHandler,
  UserErrorReporter
} from './error-handler.js';

export type {
  AggregatedErrorReport,
  ConfigValidationContext
} from './error-handler.js';

export type {
  KiroError,
  KiroErrorCode,
  ErrorSeverity,
  ErrorContext,
  RecoveryAction,
  RecoverySuggestion,
  ErrorReport,
  DegradationResult,
  ComponentHealth,
  SystemHealthReport
} from './types.js';
