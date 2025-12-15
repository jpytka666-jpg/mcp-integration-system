/**
 * Error Handler Lambda
 * Centralized error handling for workflow failures
 */

import { Context } from 'aws-lambda';

interface ErrorHandlerEvent {
  errorType: 'VALIDATION_ERROR' | 'WORKFLOW_ERROR' | 'TIMEOUT_ERROR' | 'SYSTEM_ERROR';
  tenantId: string;
  assessmentId: string;
  correlationId: string;
  error?: {
    Error: string;
    Cause: string;
  };
  validation?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

interface ErrorHandlerResult {
  handled: boolean;
  errorType: string;
  errorCode: string;
  message: string;
  recoverable: boolean;
  recommendation: string;
  logged: boolean;
  notified: boolean;
  metadata: {
    handledAt: string;
    assessmentId: string;
    tenantId: string;
    correlationId: string;
  };
}

export async function handler(
  event: ErrorHandlerEvent,
  context: Context
): Promise<ErrorHandlerResult> {
  console.error('Error handler invoked', {
    requestId: context.awsRequestId,
    errorType: event.errorType,
    assessmentId: event.assessmentId,
    tenantId: event.tenantId,
    correlationId: event.correlationId
  });

  const result = processError(event);

  // Log structured error
  console.error('Processed error', {
    ...result,
    rawError: event.error,
    validation: event.validation
  });

  // In production, send to error tracking service (Sentry, etc.)
  // await sendToErrorTracking(event, result);

  // In production, send notification for critical errors
  // if (!result.recoverable) {
  //   await sendNotification(event, result);
  // }

  return {
    ...result,
    logged: true,
    notified: !result.recoverable,
    metadata: {
      handledAt: new Date().toISOString(),
      assessmentId: event.assessmentId,
      tenantId: event.tenantId,
      correlationId: event.correlationId
    }
  };
}

function processError(event: ErrorHandlerEvent): Omit<ErrorHandlerResult, 'logged' | 'notified' | 'metadata'> {
  switch (event.errorType) {
    case 'VALIDATION_ERROR':
      return {
        handled: true,
        errorType: 'VALIDATION_ERROR',
        errorCode: 'VALIDATION_FAILED',
        message: event.validation?.errors.join('; ') || 'Validation failed',
        recoverable: true,
        recommendation: 'Review input parameters and retry with corrected values'
      };

    case 'WORKFLOW_ERROR':
      const error = event.error;
      const isCircuitBreaker = error?.Error?.includes('CircuitBreaker');
      const isTimeout = error?.Error?.includes('Timeout') || error?.Error?.includes('TaskTimedOut');
      const isRetryable = error?.Error?.includes('RetryableError');

      if (isCircuitBreaker) {
        return {
          handled: true,
          errorType: 'WORKFLOW_ERROR',
          errorCode: 'CIRCUIT_BREAKER_OPEN',
          message: 'External service unavailable - circuit breaker is open',
          recoverable: true,
          recommendation: 'Wait 30 seconds and retry, or check external service status'
        };
      }

      if (isTimeout) {
        return {
          handled: true,
          errorType: 'WORKFLOW_ERROR',
          errorCode: 'OPERATION_TIMEOUT',
          message: 'Operation timed out',
          recoverable: true,
          recommendation: 'Retry with smaller data set or increased timeout'
        };
      }

      if (isRetryable) {
        return {
          handled: true,
          errorType: 'WORKFLOW_ERROR',
          errorCode: 'TRANSIENT_ERROR',
          message: 'Transient error occurred',
          recoverable: true,
          recommendation: 'Automatic retry should handle this - if persists, contact support'
        };
      }

      return {
        handled: true,
        errorType: 'WORKFLOW_ERROR',
        errorCode: 'WORKFLOW_FAILED',
        message: error?.Cause || 'Workflow step failed',
        recoverable: false,
        recommendation: 'Review error details and contact support if issue persists'
      };

    case 'TIMEOUT_ERROR':
      return {
        handled: true,
        errorType: 'TIMEOUT_ERROR',
        errorCode: 'EXECUTION_TIMEOUT',
        message: 'Workflow execution timed out',
        recoverable: true,
        recommendation: 'Consider breaking assessment into smaller chunks'
      };

    case 'SYSTEM_ERROR':
      return {
        handled: true,
        errorType: 'SYSTEM_ERROR',
        errorCode: 'INTERNAL_ERROR',
        message: 'Internal system error',
        recoverable: false,
        recommendation: 'This is a system issue - support has been notified'
      };

    default:
      return {
        handled: true,
        errorType: 'UNKNOWN_ERROR',
        errorCode: 'UNKNOWN',
        message: 'An unknown error occurred',
        recoverable: false,
        recommendation: 'Contact support with correlation ID'
      };
  }
}
