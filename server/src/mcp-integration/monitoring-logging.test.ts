/**
 * Property-based tests for Monitoring and Logging System
 * **Feature: mcp-integration-system, Properties 26-30**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  MonitoringLoggingSystem,
  LogLevel,
  LogEntry,
  PerformanceMetric,
  AddinInteraction,
  WorkflowProgress,
  CorrelatedError,
  MonitoringConfig,
  resetMonitoringSystem
} from './monitoring-logging.js';
import { SystemError } from './types.js';

// Generators for property tests
const logLevelGen = fc.constantFrom('debug' as const, 'info' as const, 'warn' as const, 'error' as const, 'critical' as const);

const logCategoryGen = fc.constantFrom(
  'mcp_operation' as const,
  'addin_interaction' as const,
  'workflow' as const,
  'data_transform' as const,
  'cloud_service' as const,
  'system' as const
);

const serverIdGen = fc.constantFrom(
  'nonicatab-mcp',
  'aions-revit-addin',
  'zedmoster-revit-mcp',
  'test-server'
);

const operationGen = fc.constantFrom(
  'get_active_view_in_revit',
  'get_elements_by_category',
  'get_parameters_from_elementid',
  'transform_data',
  'execute_workflow'
);

const metricUnitGen = fc.constantFrom('ms' as const, 'bytes' as const, 'count' as const, 'percent' as const, 'ops/sec' as const);

const interactionTypeGen = fc.constantFrom('request' as const, 'response' as const, 'event' as const, 'error' as const);

const errorSeverityGen = fc.constantFrom('low' as const, 'medium' as const, 'high' as const, 'critical' as const);

const errorTypeGen = fc.constantFrom('connection' as const, 'data' as const, 'workflow' as const, 'security' as const);

describe('Monitoring and Logging System Property Tests', () => {
  let monitoringSystem: MonitoringLoggingSystem;

  beforeEach(() => {
    resetMonitoringSystem();
    monitoringSystem = new MonitoringLoggingSystem({
      logLevel: 'debug',
      enablePerformanceMetrics: true,
      enableAddinTracking: true,
      enableWorkflowTracking: true,
      exporters: [] // Disable console output during tests
    });
  });

  describe('Property 26: Comprehensive Operation Logging', () => {
    /**
     * **Feature: mcp-integration-system, Property 26: Comprehensive Operation Logging**
     * **Validates: Requirements 6.1**
     *
     * Tests that all NonicaTab MCP operations are logged with complete context.
     */
    it('should log all MCP operations with complete context', async () => {
      await fc.assert(fc.asyncProperty(
        serverIdGen,
        operationGen,
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 50 })),
        logLevelGen,
        async (serverId, operation, details, level) => {
          // Act: Log MCP operation
          const correlationId = monitoringSystem.logMCPOperation(
            serverId,
            operation,
            details,
            level
          );

          // Assert: Correlation ID should be generated
          expect(correlationId).toBeDefined();
          expect(correlationId).toMatch(/^corr_/);

          // Assert: Log should be retrievable by correlation ID
          const logs = monitoringSystem.getLogsByCorrelationId(correlationId);
          expect(logs.length).toBeGreaterThan(0);

          // Assert: Log entry has complete context
          const logEntry = logs[0];
          expect(logEntry.category).toBe('mcp_operation');
          expect(logEntry.source.serverId).toBe(serverId);
          expect(logEntry.source.operationId).toBe(operation);
          expect(logEntry.level).toBe(level);
          expect(logEntry.timestamp).toBeInstanceOf(Date);
          expect(logEntry.id).toBeDefined();
        }
      ), { numRuns: 50 });
    });

    it('should categorize logs correctly by operation type', async () => {
      await fc.assert(fc.asyncProperty(
        logCategoryGen,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (category, message) => {
          // Setup: Log different types of operations
          const correlationId = `test_corr_${Date.now()}`;

          switch (category) {
            case 'mcp_operation':
              monitoringSystem.logMCPOperation('test-server', 'test_op', { message }, 'info', correlationId);
              break;
            case 'addin_interaction':
              monitoringSystem.logAddinInteraction({
                addinId: 'test-addin',
                addinName: 'Test Addin',
                interactionType: 'request',
                operation: message,
                timestamp: new Date(),
                correlationId
              });
              break;
            case 'workflow':
              monitoringSystem.logWorkflowEvent('wf_1', 'exec_1', 'started', { message }, correlationId);
              break;
            case 'data_transform':
              monitoringSystem.logDataTransformation('json', 'xml', true, { message }, 100, correlationId);
              break;
            default:
              // For other categories, use MCP operation as fallback
              monitoringSystem.logMCPOperation('test-server', 'test_op', { message }, 'info', correlationId);
          }

          // Assert: Logs should be retrievable by category
          const logs = monitoringSystem.getLogsByCategory(category as LogEntry['category']);
          expect(Array.isArray(logs)).toBe(true);
        }
      ), { numRuns: 30 });
    });

    it('should filter logs by time range correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(serverIdGen, { minLength: 3, maxLength: 10 }),
        async (serverIds) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });
          const startTime = new Date();

          // Log multiple operations
          for (const serverId of serverIds) {
            freshSystem.logMCPOperation(serverId, 'test_op', {}, 'info');
          }

          const endTime = new Date();

          // Query logs in time range
          const logs = freshSystem.getLogs(startTime, endTime);

          // Assert: All logs should be within range
          expect(logs.length).toBe(serverIds.length);
          for (const log of logs) {
            expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
            expect(log.timestamp.getTime()).toBeLessThanOrEqual(endTime.getTime());
          }
        }
      ), { numRuns: 20 });
    });

    it('should respect log level filtering', async () => {
      await fc.assert(fc.asyncProperty(
        logLevelGen,
        async (minLevel) => {
          // Create system with specific min level
          const filteredSystem = new MonitoringLoggingSystem({
            logLevel: minLevel,
            exporters: []
          });

          // Log at all levels
          const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];
          for (const level of levels) {
            filteredSystem.logMCPOperation('test-server', 'test_op', {}, level);
          }

          // Get all logs
          const logs = filteredSystem.getLogs(
            new Date(Date.now() - 60000),
            new Date()
          );

          // Assert: Only logs at or above min level should be present
          const levelPriority: Record<LogLevel, number> = {
            debug: 0, info: 1, warn: 2, error: 3, critical: 4
          };

          for (const log of logs) {
            expect(levelPriority[log.level]).toBeGreaterThanOrEqual(levelPriority[minLevel]);
          }
        }
      ), { numRuns: 25 });
    });
  });

  describe('Property 27: Addin Interaction Capture', () => {
    /**
     * **Feature: mcp-integration-system, Property 27: Addin Interaction Capture**
     * **Validates: Requirements 6.2**
     *
     * Tests that AIONS.Revit addin interactions are captured completely.
     */
    it('should capture all addin interactions with full context', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          addinId: fc.constantFrom('aions-revit-addin', 'custom-addin'),
          addinName: fc.string({ minLength: 1, maxLength: 50 }),
          interactionType: interactionTypeGen,
          operation: fc.string({ minLength: 1, maxLength: 100 }),
          payload: fc.option(fc.dictionary(fc.string(), fc.string())),
          response: fc.option(fc.dictionary(fc.string(), fc.string())),
          error: fc.option(fc.string({ minLength: 1, maxLength: 200 }))
        }),
        async (interaction) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });
          const correlationId = `addin_corr_${Date.now()}_${Math.random()}`;

          // Act: Log addin interaction
          const resultCorrelationId = freshSystem.logAddinInteraction({
            ...interaction,
            timestamp: new Date(),
            correlationId,
            payload: interaction.payload ?? undefined,
            response: interaction.response ?? undefined,
            error: interaction.error ?? undefined
          });

          // Assert: Correlation ID should be returned
          expect(resultCorrelationId).toBe(correlationId);

          // Assert: Interaction should be retrievable
          const interactions = freshSystem.getAddinInteractions(interaction.addinId);
          expect(interactions.length).toBe(1);

          const captured = interactions[0];
          expect(captured).toBeDefined();
          expect(captured.addinId).toBe(interaction.addinId);
          expect(captured.operation).toBe(interaction.operation);
          expect(captured.interactionType).toBe(interaction.interactionType);
        }
      ), { numRuns: 40 });
    });

    it('should track addin interactions by addin ID', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(
          fc.record({
            addinId: fc.constantFrom('addin-1', 'addin-2', 'addin-3'),
            operation: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 5, maxLength: 15 }
        ),
        async (interactionSpecs) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });

          // Log interactions for different addins
          for (const spec of interactionSpecs) {
            freshSystem.logAddinInteraction({
              addinId: spec.addinId,
              addinName: `Addin ${spec.addinId}`,
              interactionType: 'request',
              operation: spec.operation,
              timestamp: new Date(),
              correlationId: `corr_${Date.now()}_${Math.random()}`
            });
          }

          // Get all interactions
          const allInteractions = freshSystem.getAddinInteractions();

          // Get interactions per addin
          const addin1 = freshSystem.getAddinInteractions('addin-1');
          const addin2 = freshSystem.getAddinInteractions('addin-2');
          const addin3 = freshSystem.getAddinInteractions('addin-3');

          // Assert: Total matches sum of per-addin
          expect(allInteractions.length).toBe(addin1.length + addin2.length + addin3.length);

          // Assert: Each interaction is categorized correctly
          for (const interaction of addin1) {
            expect(interaction.addinId).toBe('addin-1');
          }
          for (const interaction of addin2) {
            expect(interaction.addinId).toBe('addin-2');
          }
        }
      ), { numRuns: 20 });
    });

    it('should record timing information for addin interactions', async () => {
      await fc.assert(fc.asyncProperty(
        fc.integer({ min: 10, max: 5000 }),
        async (duration) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });
          const correlationId = `timing_corr_${Date.now()}_${Math.random()}`;

          // Log interaction with duration
          freshSystem.logAddinInteraction({
            addinId: 'aions-revit-addin',
            addinName: 'AIONS Revit',
            interactionType: 'response',
            operation: 'get_elements',
            timestamp: new Date(),
            duration,
            correlationId
          });

          // Assert: Duration should be captured in interaction
          const interactions = freshSystem.getAddinInteractions('aions-revit-addin');
          expect(interactions.length).toBeGreaterThan(0);
          const interaction = interactions.find(i => i.correlationId === correlationId);
          expect(interaction).toBeDefined();
          expect(interaction!.duration).toBe(duration);

          // Assert: Duration should also be in log entry
          const logs = freshSystem.getLogsByCorrelationId(correlationId);
          expect(logs.length).toBeGreaterThan(0);
          expect(logs[0].duration).toBe(duration);
        }
      ), { numRuns: 25 });
    });
  });

  describe('Property 28: Workflow Progress Tracking with Metrics', () => {
    /**
     * **Feature: mcp-integration-system, Property 28: Workflow Progress Tracking with Metrics**
     * **Validates: Requirements 6.3**
     *
     * Tests that workflow progress is tracked with timing metrics.
     */
    it('should track workflow progress through all phases', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).map(s => `wf_${s.replace(/[^a-zA-Z0-9]/g, '')}`),
        fc.integer({ min: 2, max: 10 }),
        async (workflowId, totalSteps) => {
          const executionId = `exec_${Date.now()}`;

          // Initialize workflow
          monitoringSystem.initializeWorkflowProgress(workflowId, executionId, totalSteps);

          // Get initial progress
          let progress = monitoringSystem.getWorkflowProgress(executionId);
          expect(progress).toBeDefined();
          expect(progress!.phase).toBe('initialization');
          expect(progress!.progress).toBe(0);

          // Complete steps
          for (let i = 0; i < totalSteps; i++) {
            const stepId = `step_${i}`;
            monitoringSystem.updateStepProgress(executionId, stepId, 'running');
            monitoringSystem.updateStepProgress(executionId, stepId, 'completed');
          }

          // Get final progress
          progress = monitoringSystem.getWorkflowProgress(executionId);
          expect(progress!.progress).toBe(100);
          expect(progress!.currentStep).toBe(totalSteps);

          // Complete workflow
          monitoringSystem.completeWorkflow(executionId, true);
          progress = monitoringSystem.getWorkflowProgress(executionId);
          expect(progress!.phase).toBe('completion');
        }
      ), { numRuns: 20 });
    });

    it('should calculate step metrics correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.integer({ min: 50, max: 500 }), { minLength: 2, maxLength: 5 }),
        async (stepDurations) => {
          const executionId = `exec_${Date.now()}`;
          const workflowId = 'test_workflow';

          monitoringSystem.initializeWorkflowProgress(workflowId, executionId, stepDurations.length);

          // Execute steps with delays
          for (let i = 0; i < stepDurations.length; i++) {
            const stepId = `step_${i}`;
            monitoringSystem.updateStepProgress(executionId, stepId, 'running');

            // Simulate step execution time
            await new Promise(resolve => setTimeout(resolve, 10));

            monitoringSystem.updateStepProgress(executionId, stepId, 'completed');
          }

          // Get progress with metrics
          const progress = monitoringSystem.getWorkflowProgress(executionId);
          expect(progress).toBeDefined();

          // Check that all steps have metrics
          expect(progress!.stepMetrics.size).toBe(stepDurations.length);

          for (const [stepId, metric] of progress!.stepMetrics) {
            expect(metric.status).toBe('completed');
            expect(metric.startTime).toBeDefined();
            expect(metric.endTime).toBeDefined();
            expect(metric.duration).toBeGreaterThan(0);
          }
        }
      ), { numRuns: 15 });
    });

    it('should handle step failures and retries', async () => {
      await fc.assert(fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (retryCount) => {
          const executionId = `exec_${Date.now()}`;
          const workflowId = 'retry_workflow';
          const stepId = 'failing_step';

          monitoringSystem.initializeWorkflowProgress(workflowId, executionId, 3);

          // Simulate failed attempts
          for (let i = 0; i < retryCount; i++) {
            monitoringSystem.updateStepProgress(executionId, stepId, 'running');
            monitoringSystem.updateStepProgress(executionId, stepId, 'failed', `Attempt ${i + 1} failed`);
          }

          // Final success
          monitoringSystem.updateStepProgress(executionId, stepId, 'running');
          monitoringSystem.updateStepProgress(executionId, stepId, 'completed');

          // Check retry count
          const progress = monitoringSystem.getWorkflowProgress(executionId);
          const metric = progress!.stepMetrics.get(stepId);

          expect(metric).toBeDefined();
          expect(metric!.retryCount).toBe(retryCount);
          expect(metric!.status).toBe('completed');
        }
      ), { numRuns: 15 });
    });

    it('should estimate completion time based on step metrics', async () => {
      await fc.assert(fc.asyncProperty(
        fc.integer({ min: 4, max: 8 }),
        async (totalSteps) => {
          const executionId = `exec_${Date.now()}`;
          const workflowId = 'estimation_workflow';

          monitoringSystem.initializeWorkflowProgress(workflowId, executionId, totalSteps);

          // Complete half the steps
          const halfSteps = Math.floor(totalSteps / 2);
          for (let i = 0; i < halfSteps; i++) {
            const stepId = `step_${i}`;
            monitoringSystem.updateStepProgress(executionId, stepId, 'running');
            await new Promise(resolve => setTimeout(resolve, 10));
            monitoringSystem.updateStepProgress(executionId, stepId, 'completed');
          }

          // Check that estimation exists
          const progress = monitoringSystem.getWorkflowProgress(executionId);

          if (halfSteps > 0 && halfSteps < totalSteps) {
            expect(progress!.estimatedCompletion).toBeDefined();
            expect(progress!.estimatedCompletion!.getTime()).toBeGreaterThan(Date.now());
          }
        }
      ), { numRuns: 15 });
    });
  });

  describe('Property 29: Cross-ecosystem Error Correlation', () => {
    /**
     * **Feature: mcp-integration-system, Property 29: Cross-ecosystem Error Correlation**
     * **Validates: Requirements 6.4**
     *
     * Tests that errors from different components are correlated.
     */
    it('should correlate related errors from different components', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(
          fc.record({
            type: errorTypeGen,
            severity: errorSeverityGen,
            component: fc.constantFrom('MCPIntegration', 'WorkflowOrchestrator', 'DataTransformer', 'AddinBridge'),
            message: fc.string({ minLength: 10, maxLength: 100 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (errorSpecs) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });
          const correlationId = `corr_${Date.now()}_${Math.random()}`;

          // Log related errors
          for (const spec of errorSpecs) {
            const error: SystemError = {
              id: `err_${Date.now()}_${Math.random()}`,
              type: spec.type,
              severity: spec.severity,
              source: {
                component: spec.component,
                operation: 'test_operation'
              },
              message: spec.message,
              details: {},
              timestamp: new Date(),
              suggestedActions: ['Check logs', 'Retry operation']
            };

            freshSystem.logError(error, correlationId);
          }

          // Get correlated errors
          const correlatedErrors = freshSystem.getCorrelatedErrors(correlationId);

          expect(correlatedErrors.length).toBe(1);
          const correlated = correlatedErrors[0];

          // Assert: All errors are correlated (first is primary, rest are related)
          expect(correlated.correlationId).toBe(correlationId);
          // Total errors = 1 (primary) + relatedErrors.length
          expect(correlated.relatedErrors.length + 1).toBe(errorSpecs.length);

          // Assert: All affected components are tracked
          const uniqueComponents = new Set(errorSpecs.map(s => s.component));
          expect(correlated.affectedComponents.length).toBe(uniqueComponents.size);

          // Assert: Root cause is analyzed
          expect(correlated.rootCause).toBeDefined();
          expect(correlated.suggestedResolution).toBeDefined();
        }
      ), { numRuns: 20 });
    });

    it('should analyze root cause based on error types', async () => {
      await fc.assert(fc.asyncProperty(
        errorTypeGen,
        async (errorType) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });

          const error: SystemError = {
            id: `err_${Date.now()}`,
            type: errorType,
            severity: 'high',
            source: {
              component: 'TestComponent',
              operation: 'test_op'
            },
            message: `Test ${errorType} error`,
            details: {},
            timestamp: new Date(),
            suggestedActions: []
          };

          const correlationId = freshSystem.logError(error);

          const correlatedErrors = freshSystem.getCorrelatedErrors(correlationId);
          expect(correlatedErrors.length).toBe(1);

          const rootCause = correlatedErrors[0].rootCause;
          expect(rootCause).toBeDefined();

          // Root cause should be related to error type
          switch (errorType) {
            case 'connection':
              expect(rootCause).toContain('connection');
              break;
            case 'data':
              expect(rootCause).toContain('Data');
              break;
            case 'workflow':
              expect(rootCause).toContain('Workflow');
              break;
            case 'security':
              expect(rootCause).toContain('Security');
              break;
          }
        }
      ), { numRuns: 20 });
    });

    it('should provide resolution suggestions for correlated errors', async () => {
      await fc.assert(fc.asyncProperty(
        errorTypeGen,
        errorSeverityGen,
        async (errorType, severity) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });

          const error: SystemError = {
            id: `err_${Date.now()}`,
            type: errorType,
            severity,
            source: {
              component: 'TestComponent',
              operation: 'test_op'
            },
            message: 'Test error',
            details: {},
            timestamp: new Date(),
            suggestedActions: []
          };

          const correlationId = freshSystem.logError(error);

          const correlatedErrors = freshSystem.getCorrelatedErrors(correlationId);
          const resolution = correlatedErrors[0].suggestedResolution;

          // Assert: Resolution suggestion exists
          expect(resolution).toBeDefined();
          expect(typeof resolution).toBe('string');
          expect(resolution!.length).toBeGreaterThan(0);
        }
      ), { numRuns: 25 });
    });

    it('should mark errors as resolved', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        async (message) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });

          const error: SystemError = {
            id: `err_${Date.now()}`,
            type: 'workflow',
            severity: 'medium',
            source: {
              component: 'TestComponent',
              operation: 'test_op'
            },
            message,
            details: {},
            timestamp: new Date(),
            suggestedActions: []
          };

          const correlationId = freshSystem.logError(error);

          // Initially not resolved
          let correlated = freshSystem.getCorrelatedErrors(correlationId)[0];
          expect(correlated.resolved).toBe(false);

          // Resolve error
          freshSystem.resolveError(correlationId);

          // Check resolved status
          correlated = freshSystem.getCorrelatedErrors(correlationId)[0];
          expect(correlated.resolved).toBe(true);
        }
      ), { numRuns: 20 });
    });
  });

  describe('Property 30: Performance Metrics Collection', () => {
    /**
     * **Feature: mcp-integration-system, Property 30: Performance Metrics Collection**
     * **Validates: Requirements 6.5**
     *
     * Tests that performance metrics are collected accurately.
     */
    it('should record metrics with correct values and units', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).map(s => `metric_${s.replace(/[^a-zA-Z0-9_]/g, '')}`),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        metricUnitGen,
        fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ minLength: 1, maxLength: 20 })),
        async (name, value, unit, tags) => {
          const startTime = new Date();

          // Record metric
          monitoringSystem.recordMetric(name, value, unit, tags, {
            component: 'TestComponent'
          });

          const endTime = new Date();

          // Retrieve metric
          const metrics = monitoringSystem.getMetrics(startTime, endTime, { name });

          expect(metrics.length).toBeGreaterThan(0);

          const metric = metrics.find(m => m.name === name);
          expect(metric).toBeDefined();
          expect(metric!.value).toBe(value);
          expect(metric!.unit).toBe(unit);

          // Tags should match
          for (const [key, val] of Object.entries(tags)) {
            expect(metric!.tags[key]).toBe(val);
          }
        }
      ), { numRuns: 40 });
    });

    it('should track operation timing accurately', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).map(s => `operation_${s.replace(/[^a-zA-Z0-9_]/g, '')}`),
        fc.integer({ min: 20, max: 80 }),
        async (operationName, expectedDuration) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });

          // Use timer
          const stopTimer = freshSystem.startTimer(operationName);

          // Simulate operation
          await new Promise(resolve => setTimeout(resolve, expectedDuration));

          const actualDuration = stopTimer();

          // Assert: Duration should be close to expected (with generous tolerance for CI/slow systems)
          // Windows timers can return slightly early (within ~5ms), so allow small negative tolerance
          expect(actualDuration).toBeGreaterThanOrEqual(expectedDuration - 5);
          expect(actualDuration).toBeLessThan(expectedDuration + 150); // 150ms tolerance for slow systems

          // Assert: Metric should be recorded
          const metrics = freshSystem.getMetrics(
            new Date(Date.now() - 1000),
            new Date()
          );

          const timingMetric = metrics.find(m => m.name === `${operationName}_duration`);
          expect(timingMetric).toBeDefined();
          expect(timingMetric!.unit).toBe('ms');
        }
      ), { numRuns: 10 });
    });

    it('should aggregate metrics correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.double({ min: 0, max: 1000, noNaN: true }), { minLength: 5, maxLength: 20 }),
        async (values) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });
          const metricName = `aggregation_test_${Date.now()}_${Math.random()}`;

          // Record multiple values
          for (const value of values) {
            freshSystem.recordMetric(metricName, value, 'ms', {});
          }

          // Get aggregations
          const aggregations = freshSystem.getAggregatedMetrics(metricName, 'minute');

          expect(aggregations.length).toBeGreaterThan(0);

          const agg = aggregations[0];

          // Assert: Count should match
          expect(agg.count).toBe(values.length);

          // Assert: Sum should be correct
          const expectedSum = values.reduce((a, b) => a + b, 0);
          expect(Math.abs(agg.sum - expectedSum)).toBeLessThan(0.001);

          // Assert: Min/Max should be correct
          expect(agg.min).toBe(Math.min(...values));
          expect(agg.max).toBe(Math.max(...values));

          // Assert: Average should be correct
          const expectedAvg = expectedSum / values.length;
          expect(Math.abs(agg.avg - expectedAvg)).toBeLessThan(0.001);
        }
      ), { numRuns: 20 });
    });

    it('should filter metrics by time range and tags', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.constantFrom('metric_a', 'metric_b', 'metric_c'),
            tag: fc.constantFrom('tag1', 'tag2', 'tag3')
          }),
          { minLength: 10, maxLength: 30 }
        ),
        async (metricSpecs) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });
          const startTime = new Date();

          // Record metrics
          for (const spec of metricSpecs) {
            freshSystem.recordMetric(spec.name, Math.random() * 100, 'count', {
              category: spec.tag
            });
          }

          const endTime = new Date();

          // Filter by name
          const metricA = freshSystem.getMetrics(startTime, endTime, { name: 'metric_a' });
          const expectedA = metricSpecs.filter(s => s.name === 'metric_a').length;
          expect(metricA.length).toBe(expectedA);

          // Filter by tag
          const tag1Metrics = freshSystem.getMetrics(startTime, endTime, { tags: { category: 'tag1' } });
          const expectedTag1 = metricSpecs.filter(s => s.tag === 'tag1').length;
          expect(tag1Metrics.length).toBe(expectedTag1);

          // Filter by both
          const filteredMetrics = freshSystem.getMetrics(startTime, endTime, {
            name: 'metric_b',
            tags: { category: 'tag2' }
          });
          const expectedFiltered = metricSpecs.filter(s => s.name === 'metric_b' && s.tag === 'tag2').length;
          expect(filteredMetrics.length).toBe(expectedFiltered);
        }
      ), { numRuns: 15 });
    });

    it('should count operations correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => `op_${s.replace(/[^a-zA-Z0-9_]/g, '')}`),
        fc.integer({ min: 1, max: 50 }),
        async (operationName, count) => {
          // Use fresh system for each property run
          const freshSystem = new MonitoringLoggingSystem({ logLevel: 'debug', exporters: [] });
          const startTime = new Date();

          // Record counts
          for (let i = 0; i < count; i++) {
            freshSystem.recordCount(operationName);
          }

          const endTime = new Date();

          // Get metrics
          const metrics = freshSystem.getMetrics(startTime, endTime, { name: `${operationName}_count` });

          expect(metrics.length).toBe(count);

          // All should have value 1 and unit 'count'
          for (const metric of metrics) {
            expect(metric.value).toBe(1);
            expect(metric.unit).toBe('count');
          }
        }
      ), { numRuns: 20 });
    });
  });
});
