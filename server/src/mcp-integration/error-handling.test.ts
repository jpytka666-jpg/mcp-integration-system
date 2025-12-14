/**
 * Error Handling and Recovery System Tests
 * Unit tests for retry mechanisms, circuit breakers, and workflow recovery
 * Requirements: Error handling aspects of all requirements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  RetryMechanism,
  CircuitBreaker,
  WorkflowCheckpointManager,
  FallbackHandler,
  ErrorRecoveryService,
  RetryConfig,
  CircuitBreakerConfig,
  FallbackConfig,
  RetryStrategy
} from './error-handling.js';

// ============ Test Arbitraries ============

const retryStrategyArb = fc.constantFrom('exponential', 'linear', 'fixed', 'fibonacci') as fc.Arbitrary<RetryStrategy>;

const retryConfigArb = fc.record({
  maxRetries: fc.integer({ min: 1, max: 10 }),
  baseDelayMs: fc.integer({ min: 10, max: 500 }),
  maxDelayMs: fc.integer({ min: 500, max: 5000 }),
  strategy: retryStrategyArb,
  jitterMs: fc.integer({ min: 0, max: 50 })
});

const circuitBreakerConfigArb = fc.record({
  failureThreshold: fc.integer({ min: 1, max: 10 }),
  successThreshold: fc.integer({ min: 1, max: 5 }),
  timeout: fc.integer({ min: 100, max: 5000 }),
  resetTimeout: fc.integer({ min: 100, max: 5000 })
});

// ============ Tests ============

describe('Error Handling and Recovery Tests', () => {

  describe('RetryMechanism Tests', () => {
    let retryMechanism: RetryMechanism;

    beforeEach(() => {
      retryMechanism = new RetryMechanism({
        maxRetries: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        strategy: 'exponential',
        jitterMs: 0
      });
    });

    it('should succeed on first attempt when operation succeeds', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (value) => {
          const operation = async () => value;

          const result = await retryMechanism.execute(operation);

          expect(result.success).toBe(true);
          expect(result.result).toBe(value);
          expect(result.attempts).toBe(1);
        }
      ), { numRuns: 20 });
    });

    it('should retry on transient errors', async () => {
      let attemptCount = 0;
      const failCount = 2;

      const operation = async () => {
        attemptCount++;
        if (attemptCount <= failCount) {
          throw new Error('Connection timeout');
        }
        return 'success';
      };

      const result = await retryMechanism.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(failCount + 1);
    });

    it('should fail after max retries', async () => {
      const operation = async () => {
        throw new Error('Connection refused');
      };

      const result = await retryMechanism.execute(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toBe(4); // 1 initial + 3 retries
    });

    it('should not retry non-retryable errors', async () => {
      const mechanism = new RetryMechanism({
        maxRetries: 5,
        baseDelayMs: 10,
        maxDelayMs: 100,
        strategy: 'fixed',
        nonRetryableErrors: ['validation', 'authentication']
      });

      const operation = async () => {
        throw new Error('Validation failed');
      };

      const result = await mechanism.execute(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // No retries for validation errors
    });

    it('should calculate delays correctly for different strategies', async () => {
      await fc.assert(fc.asyncProperty(
        retryStrategyArb,
        fc.integer({ min: 1, max: 5 }),
        async (strategy, attempt) => {
          const mechanism = new RetryMechanism({
            maxRetries: 5,
            baseDelayMs: 100,
            maxDelayMs: 10000,
            strategy,
            jitterMs: 0
          });

          const delay = mechanism.calculateDelay(attempt);

          // Verify delay is within bounds
          expect(delay).toBeGreaterThanOrEqual(0);
          expect(delay).toBeLessThanOrEqual(10000);

          // Verify strategy-specific behavior
          switch (strategy) {
            case 'fixed':
              expect(delay).toBe(100);
              break;
            case 'linear':
              expect(delay).toBe(100 * attempt);
              break;
            case 'exponential':
              expect(delay).toBe(100 * Math.pow(2, attempt - 1));
              break;
            case 'fibonacci':
              // Just verify it's positive and bounded
              expect(delay).toBeGreaterThan(0);
              break;
          }
        }
      ), { numRuns: 20 });
    });

    it('should respect max delay limit', async () => {
      await fc.assert(fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (attempt) => {
          const maxDelay = 500;
          const mechanism = new RetryMechanism({
            maxRetries: 20,
            baseDelayMs: 100,
            maxDelayMs: maxDelay,
            strategy: 'exponential',
            jitterMs: 0
          });

          const delay = mechanism.calculateDelay(attempt);

          expect(delay).toBeLessThanOrEqual(maxDelay);
        }
      ), { numRuns: 15 });
    });

    it('should track total time and last attempt time', async () => {
      let attemptCount = 0;

      const operation = async () => {
        attemptCount++;
        await new Promise(resolve => setTimeout(resolve, 5));
        if (attemptCount < 2) {
          throw new Error('Network timeout');
        }
        return 'done';
      };

      const result = await retryMechanism.execute(operation);

      expect(result.success).toBe(true);
      expect(result.totalTimeMs).toBeGreaterThan(0);
      expect(result.lastAttemptTimeMs).toBeGreaterThanOrEqual(5);
    });
  });

  describe('CircuitBreaker Tests', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        resetTimeout: 100
      });
    });

    afterEach(() => {
      circuitBreaker.reset();
    });

    it('should start in closed state', () => {
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
      expect(status.successes).toBe(0);
    });

    it('should remain closed on successful operations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (count) => {
          const cb = new CircuitBreaker({ failureThreshold: 5, successThreshold: 2, timeout: 1000, resetTimeout: 100 });

          for (let i = 0; i < count; i++) {
            await cb.execute(async () => 'success');
          }

          expect(cb.getStatus().state).toBe('closed');
        }
      ), { numRuns: 10 });
    });

    it('should open after reaching failure threshold', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        resetTimeout: 100
      });

      // Cause failures
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(async () => { throw new Error('Failed'); });
        } catch {
          // Expected
        }
      }

      expect(cb.getStatus().state).toBe('open');
    });

    it('should reject calls when open', async () => {
      // Force open state
      circuitBreaker.forceOpen();

      await expect(
        circuitBreaker.execute(async () => 'should not run')
      ).rejects.toThrow('Circuit breaker is open');
    });

    it('should transition to half-open after reset timeout', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 1000,
        resetTimeout: 50
      });

      // Cause failures to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error('Failed'); });
        } catch {
          // Expected
        }
      }

      expect(cb.getStatus().state).toBe('open');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Next call should be allowed (half-open)
      try {
        await cb.execute(async () => 'success');
      } catch {
        // May still fail, but circuit should be half-open or closed
      }

      const status = cb.getStatus();
      expect(['half-open', 'closed']).toContain(status.state);
    });

    it('should notify listeners on state change', async () => {
      const stateChanges: Array<{ newState: string; prevState: string }> = [];

      circuitBreaker.onStateChange((state, prevState) => {
        stateChanges.push({ newState: state, prevState });
      });

      // Cause failures to trigger state change
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => { throw new Error('Failed'); });
        } catch {
          // Expected
        }
      }

      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges[stateChanges.length - 1].newState).toBe('open');
    });

    it('should handle operation timeouts', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 50,
        resetTimeout: 100
      });

      await expect(
        cb.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return 'too slow';
        })
      ).rejects.toThrow('Operation timed out');
    });
  });

  describe('WorkflowCheckpointManager Tests', () => {
    let checkpointManager: WorkflowCheckpointManager;

    beforeEach(() => {
      checkpointManager = new WorkflowCheckpointManager(5);
    });

    afterEach(() => {
      checkpointManager.clearAllCheckpoints();
    });

    it('should create and retrieve checkpoints', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => `workflow_${s.replace(/[^a-zA-Z0-9]/g, '')}`),
        fc.integer({ min: 0, max: 10 }),
        fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 50 })),
        async (workflowId, stepIndex, state) => {
          const manager = new WorkflowCheckpointManager(10);

          const checkpoint = manager.createCheckpoint(
            workflowId,
            stepIndex,
            `step_${stepIndex}`,
            state,
            { totalSteps: 10, completedSteps: stepIndex, failedSteps: 0 }
          );

          expect(checkpoint.workflowId).toBe(workflowId);
          expect(checkpoint.stepIndex).toBe(stepIndex);
          expect(checkpoint.state).toEqual(state);

          const retrieved = manager.getLatestCheckpoint(workflowId);
          expect(retrieved).toBeDefined();
          expect(retrieved!.id).toBe(checkpoint.id);
        }
      ), { numRuns: 15 });
    });

    it('should return latest checkpoint', () => {
      const workflowId = 'test-workflow';

      // Create multiple checkpoints
      for (let i = 0; i < 3; i++) {
        checkpointManager.createCheckpoint(
          workflowId,
          i,
          `step_${i}`,
          { value: i },
          { totalSteps: 5, completedSteps: i, failedSteps: 0 }
        );
      }

      const latest = checkpointManager.getLatestCheckpoint(workflowId);

      expect(latest).toBeDefined();
      expect(latest!.stepIndex).toBe(2);
      expect(latest!.state).toEqual({ value: 2 });
    });

    it('should limit checkpoints per workflow', async () => {
      const maxCheckpoints = 3;
      const manager = new WorkflowCheckpointManager(maxCheckpoints);
      const workflowId = 'limited-workflow';

      // Create more checkpoints than limit
      for (let i = 0; i < 5; i++) {
        manager.createCheckpoint(
          workflowId,
          i,
          `step_${i}`,
          { step: i },
          { totalSteps: 10, completedSteps: i, failedSteps: 0 }
        );
      }

      const checkpoints = manager.getCheckpointsForWorkflow(workflowId);

      expect(checkpoints.length).toBe(maxCheckpoints);
      // Should have latest checkpoints
      expect(checkpoints[checkpoints.length - 1].stepIndex).toBe(4);
    });

    it('should delete checkpoints correctly', () => {
      const workflowId = 'delete-test';

      const cp1 = checkpointManager.createCheckpoint(
        workflowId,
        0,
        'step_0',
        {},
        { totalSteps: 2, completedSteps: 0, failedSteps: 0 }
      );

      const cp2 = checkpointManager.createCheckpoint(
        workflowId,
        1,
        'step_1',
        {},
        { totalSteps: 2, completedSteps: 1, failedSteps: 0 }
      );

      expect(checkpointManager.getCheckpointsForWorkflow(workflowId).length).toBe(2);

      const deleted = checkpointManager.deleteCheckpoint(cp1.id);
      expect(deleted).toBe(true);

      const remaining = checkpointManager.getCheckpointsForWorkflow(workflowId);
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(cp2.id);
    });

    it('should clear all checkpoints for a workflow', () => {
      const workflowId1 = 'workflow-1';
      const workflowId2 = 'workflow-2';

      checkpointManager.createCheckpoint(workflowId1, 0, 'step', {}, { totalSteps: 1, completedSteps: 0, failedSteps: 0 });
      checkpointManager.createCheckpoint(workflowId2, 0, 'step', {}, { totalSteps: 1, completedSteps: 0, failedSteps: 0 });

      checkpointManager.clearWorkflowCheckpoints(workflowId1);

      expect(checkpointManager.getCheckpointsForWorkflow(workflowId1).length).toBe(0);
      expect(checkpointManager.getCheckpointsForWorkflow(workflowId2).length).toBe(1);
    });
  });

  describe('FallbackHandler Tests', () => {
    it('should use primary when available', async () => {
      const config: FallbackConfig = {
        primary: 'main',
        fallbacks: [
          {
            id: 'backup',
            name: 'Backup',
            priority: 1,
            handler: async () => 'backup-result'
          }
        ],
        timeout: 1000
      };

      const handler = new FallbackHandler(config);

      const result = await handler.execute(async () => 'primary-result');

      expect(result.success).toBe(true);
      expect(result.result).toBe('primary-result');
      expect(result.usedFallback).toBe(false);
    });

    it('should use fallback when primary fails', async () => {
      const config: FallbackConfig = {
        primary: 'main',
        fallbacks: [
          {
            id: 'backup',
            name: 'Backup',
            priority: 1,
            handler: async () => 'backup-result'
          }
        ],
        timeout: 1000
      };

      const handler = new FallbackHandler(config);

      const result = await handler.execute(async () => {
        throw new Error('Primary failed');
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('backup-result');
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackId).toBe('backup');
    });

    it('should try fallbacks in priority order', async () => {
      const callOrder: string[] = [];

      const config: FallbackConfig = {
        primary: 'main',
        fallbacks: [
          {
            id: 'fallback-3',
            name: 'Fallback 3',
            priority: 3,
            handler: async () => {
              callOrder.push('fallback-3');
              return 'result-3';
            }
          },
          {
            id: 'fallback-1',
            name: 'Fallback 1',
            priority: 1,
            handler: async () => {
              callOrder.push('fallback-1');
              throw new Error('Fallback 1 failed');
            }
          },
          {
            id: 'fallback-2',
            name: 'Fallback 2',
            priority: 2,
            handler: async () => {
              callOrder.push('fallback-2');
              return 'result-2';
            }
          }
        ],
        timeout: 1000
      };

      const handler = new FallbackHandler(config);

      const result = await handler.execute(async () => {
        callOrder.push('primary');
        throw new Error('Primary failed');
      });

      expect(result.success).toBe(true);
      expect(callOrder).toEqual(['primary', 'fallback-1', 'fallback-2']);
      expect(result.result).toBe('result-2');
    });

    it('should fail when all sources fail', async () => {
      const config: FallbackConfig = {
        primary: 'main',
        fallbacks: [
          {
            id: 'backup',
            name: 'Backup',
            priority: 1,
            handler: async () => { throw new Error('Backup failed'); }
          }
        ],
        timeout: 1000
      };

      const handler = new FallbackHandler(config);

      const result = await handler.execute(async () => {
        throw new Error('Primary failed');
      });

      expect(result.success).toBe(false);
      expect(result.attemptedSources).toContain('main');
      expect(result.attemptedSources).toContain('backup');
    });

    it('should handle timeouts', async () => {
      const config: FallbackConfig = {
        primary: 'main',
        fallbacks: [],
        timeout: 50
      };

      const handler = new FallbackHandler(config);

      const result = await handler.execute(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'too slow';
      });

      expect(result.success).toBe(false);
    });

    it('should respect source availability', async () => {
      const config: FallbackConfig = {
        primary: 'main',
        fallbacks: [
          {
            id: 'unavailable',
            name: 'Unavailable',
            priority: 1,
            handler: async () => 'should-not-be-called',
            isAvailable: false
          },
          {
            id: 'available',
            name: 'Available',
            priority: 2,
            handler: async () => 'available-result'
          }
        ],
        timeout: 1000
      };

      const handler = new FallbackHandler(config);

      const result = await handler.execute(async () => {
        throw new Error('Primary failed');
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('available-result');
      expect(result.attemptedSources).not.toContain('unavailable');
    });
  });

  describe('ErrorRecoveryService Tests', () => {
    let service: ErrorRecoveryService;

    beforeEach(() => {
      service = new ErrorRecoveryService({
        retry: {
          maxRetries: 3,
          baseDelayMs: 10,
          maxDelayMs: 100,
          strategy: 'fixed'
        },
        circuitBreaker: {
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 1000,
          resetTimeout: 100
        },
        enableCheckpoints: true,
        maxCheckpoints: 10
      });
    });

    afterEach(() => {
      service.reset();
    });

    it('should execute operations with retry', async () => {
      let attempts = 0;

      const result = await service.executeWithRetry(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Network timeout');
        }
        return 'success';
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
    });

    it('should execute operations with circuit breaker', async () => {
      const result = await service.executeWithCircuitBreaker('server-1', async () => 'result');

      expect(result).toBe('result');

      const status = service.getCircuitBreakerStatus('server-1');
      expect(status).toBeDefined();
      expect(status!.state).toBe('closed');
    });

    it('should combine retry and circuit breaker', async () => {
      let attempts = 0;

      const result = await service.executeWithResilience(
        'server-2',
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Connection timeout');
          }
          return 'resilient-result';
        }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('resilient-result');
    });

    it('should create and manage checkpoints', async () => {
      const workflowId = 'test-workflow';

      const checkpoint = service.createCheckpoint(
        workflowId,
        0,
        'initial_step',
        { data: 'test' },
        { totalSteps: 5, completedSteps: 0, failedSteps: 0 }
      );

      expect(checkpoint).toBeDefined();
      expect(checkpoint.workflowId).toBe(workflowId);

      const retrieved = service.getLatestCheckpoint(workflowId);
      expect(retrieved!.id).toBe(checkpoint.id);
    });

    it('should resume workflow from checkpoint', async () => {
      const workflowId = 'resume-workflow';
      let executedSteps: number[] = [];

      // Create initial checkpoint at step 2
      service.createCheckpoint(
        workflowId,
        2,
        'step_2',
        { value: 20 },
        { totalSteps: 5, completedSteps: 2, failedSteps: 0 }
      );

      // Resume from checkpoint
      const result = await service.resumeFromCheckpoint(workflowId, async (stepIndex, state) => {
        executedSteps.push(stepIndex);
        return { ...state, [`step_${stepIndex}`]: true };
      });

      expect(result.success).toBe(true);
      expect(result.resumedFromCheckpoint).toBe(true);
      expect(executedSteps).toEqual([3, 4]); // Should execute steps 3 and 4
    });

    it('should handle fallback configuration', async () => {
      service.configureFallback('operation-1', {
        primary: 'main',
        fallbacks: [
          {
            id: 'backup',
            name: 'Backup',
            priority: 1,
            handler: async () => 'backup-value'
          }
        ],
        timeout: 1000
      });

      const result = await service.executeWithFallback('operation-1', async () => {
        throw new Error('Primary failed');
      });

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
    });

    it('should record recovery events', async () => {
      // Execute operation with retry to generate events
      await service.executeWithRetry(async () => 'success');

      const events = service.getEvents();
      expect(events.length).toBeGreaterThan(0);

      const retryEvents = service.getEventsByType('retry');
      expect(retryEvents.length).toBeGreaterThan(0);
    });

    it('should report service status', () => {
      // Create some state
      service.createCheckpoint('wf-1', 0, 'step', {}, { totalSteps: 1, completedSteps: 0, failedSteps: 0 });

      const status = service.getStatus();

      expect(status.totalCheckpoints).toBe(1);
      expect(status.workflowsWithCheckpoints).toBe(1);
    });

    it('should reset all state', async () => {
      // Create some state
      await service.executeWithCircuitBreaker('server-1', async () => 'result');
      service.createCheckpoint('wf-1', 0, 'step', {}, { totalSteps: 1, completedSteps: 0, failedSteps: 0 });

      service.reset();

      const status = service.getStatus();
      expect(status.circuitBreakers).toBe(0);
      expect(status.totalCheckpoints).toBe(0);
      expect(status.totalEvents).toBe(0);
    });

    it('should get all circuit breaker statuses', async () => {
      await service.executeWithCircuitBreaker('server-1', async () => 'result-1');
      await service.executeWithCircuitBreaker('server-2', async () => 'result-2');

      const statuses = service.getAllCircuitBreakerStatuses();

      expect(statuses.size).toBe(2);
      expect(statuses.has('server-1')).toBe(true);
      expect(statuses.has('server-2')).toBe(true);
    });

    it('should reset individual circuit breaker', async () => {
      // Cause failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await service.executeWithCircuitBreaker('server-fail', async () => {
            throw new Error('Failed');
          });
        } catch {
          // Expected
        }
      }

      const statusBefore = service.getCircuitBreakerStatus('server-fail');
      expect(statusBefore!.state).toBe('open');

      const reset = service.resetCircuitBreaker('server-fail');
      expect(reset).toBe(true);

      const statusAfter = service.getCircuitBreakerStatus('server-fail');
      expect(statusAfter!.state).toBe('closed');
    });
  });

  describe('Integration Tests', () => {

    it('should handle complex recovery scenarios', async () => {
      const service = new ErrorRecoveryService({
        retry: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50, strategy: 'fixed' },
        circuitBreaker: { failureThreshold: 5, successThreshold: 2, timeout: 1000, resetTimeout: 100 },
        enableCheckpoints: true
      });

      const workflowId = 'complex-workflow';
      let stepResults: string[] = [];

      // Simulate workflow with checkpoints
      for (let i = 0; i < 3; i++) {
        const result = await service.executeWithResilience(
          'server',
          async () => {
            stepResults.push(`step_${i}`);
            return `result_${i}`;
          },
          { operationId: `step_${i}`, operationType: 'workflow_step', workflowId }
        );

        if (result.success) {
          service.createCheckpoint(
            workflowId,
            i,
            `step_${i}`,
            { results: [...stepResults] },
            { totalSteps: 3, completedSteps: i + 1, failedSteps: 0 }
          );
        }
      }

      expect(stepResults.length).toBe(3);

      const checkpoint = service.getLatestCheckpoint(workflowId);
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.metadata.completedSteps).toBe(3);

      service.reset();
    });

    it('should properly isolate circuit breakers per server', async () => {
      const service = new ErrorRecoveryService({
        retry: { maxRetries: 0, baseDelayMs: 10, maxDelayMs: 50, strategy: 'fixed' },
        circuitBreaker: { failureThreshold: 2, successThreshold: 1, timeout: 1000, resetTimeout: 100 },
        enableCheckpoints: false
      });

      // Fail server-1
      for (let i = 0; i < 2; i++) {
        try {
          await service.executeWithCircuitBreaker('server-1', async () => {
            throw new Error('Server 1 failed');
          });
        } catch {
          // Expected
        }
      }

      // Server-1 should be open
      expect(service.getCircuitBreakerStatus('server-1')!.state).toBe('open');

      // Server-2 should still work
      const result = await service.executeWithCircuitBreaker('server-2', async () => 'server-2-ok');
      expect(result).toBe('server-2-ok');
      expect(service.getCircuitBreakerStatus('server-2')!.state).toBe('closed');

      service.reset();
    });
  });
});
