/**
 * Error Handling and Recovery System
 * Comprehensive error handling with retry mechanisms, circuit breakers, and workflow recovery
 * Requirements: Error handling aspects of all requirements
 */

// ============ Types and Interfaces ============

export type RetryStrategy = 'exponential' | 'linear' | 'fixed' | 'fibonacci';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  strategy: RetryStrategy;
  jitterMs?: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
  lastAttemptTimeMs: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitorInterval?: number;
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextRetryTime?: Date;
}

export interface WorkflowCheckpoint {
  id: string;
  workflowId: string;
  stepIndex: number;
  stepName: string;
  state: Record<string, unknown>;
  timestamp: Date;
  metadata: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
  };
}

export interface WorkflowRecoveryResult {
  success: boolean;
  resumedFromCheckpoint: boolean;
  checkpointId?: string;
  completedSteps: number;
  totalSteps: number;
  error?: string;
}

export interface FallbackConfig {
  primary: string;
  fallbacks: FallbackOption[];
  timeout: number;
  healthCheckInterval?: number;
}

export interface FallbackOption {
  id: string;
  name: string;
  priority: number;
  handler: () => Promise<unknown>;
  healthCheck?: () => Promise<boolean>;
  isAvailable?: boolean;
}

export interface FallbackResult<T> {
  success: boolean;
  result?: T;
  usedFallback: boolean;
  fallbackId?: string;
  attemptedSources: string[];
  error?: string;
}

export interface ErrorRecoveryConfig {
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  enableCheckpoints: boolean;
  checkpointStoragePath?: string;
  maxCheckpoints?: number;
}

export interface OperationContext {
  operationId: string;
  operationType: string;
  serverId?: string;
  workflowId?: string;
  metadata?: Record<string, unknown>;
}

export interface RecoveryEvent {
  id: string;
  timestamp: Date;
  eventType: 'retry' | 'circuit_state_change' | 'checkpoint_created' | 'checkpoint_restored' | 'fallback_used';
  context: OperationContext;
  details: Record<string, unknown>;
}

// ============ Retry Mechanism ============

export class RetryMechanism {
  private config: RetryConfig;
  private fibonacciCache: number[] = [1, 1];

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelayMs: config.baseDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 30000,
      strategy: config.strategy ?? 'exponential',
      jitterMs: config.jitterMs ?? 100,
      retryableErrors: config.retryableErrors,
      nonRetryableErrors: config.nonRetryableErrors
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    context?: OperationContext
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempts = 0;
    let lastAttemptTime = 0;

    while (attempts <= this.config.maxRetries) {
      attempts++;
      const attemptStart = Date.now();

      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts,
          totalTimeMs: Date.now() - startTime,
          lastAttemptTimeMs: Date.now() - attemptStart
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        lastAttemptTime = Date.now() - attemptStart;

        // Check if error is retryable
        if (!this.isRetryable(lastError)) {
          return {
            success: false,
            error: lastError,
            attempts,
            totalTimeMs: Date.now() - startTime,
            lastAttemptTimeMs: lastAttemptTime
          };
        }

        // If we have more retries, wait before next attempt
        if (attempts <= this.config.maxRetries) {
          const delay = this.calculateDelay(attempts);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalTimeMs: Date.now() - startTime,
      lastAttemptTimeMs: lastAttemptTime
    };
  }

  private isRetryable(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Check non-retryable errors first
    if (this.config.nonRetryableErrors) {
      for (const pattern of this.config.nonRetryableErrors) {
        if (errorMessage.includes(pattern.toLowerCase()) || errorName.includes(pattern.toLowerCase())) {
          return false;
        }
      }
    }

    // Check retryable errors
    if (this.config.retryableErrors) {
      for (const pattern of this.config.retryableErrors) {
        if (errorMessage.includes(pattern.toLowerCase()) || errorName.includes(pattern.toLowerCase())) {
          return true;
        }
      }
      // If retryableErrors is specified but error doesn't match, don't retry
      return false;
    }

    // Default: retry transient errors
    const transientPatterns = ['timeout', 'connection', 'network', 'econnreset', 'econnrefused', 'unavailable', 'temporary'];
    return transientPatterns.some(pattern =>
      errorMessage.includes(pattern) || errorName.includes(pattern)
    );
  }

  calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.strategy) {
      case 'exponential':
        delay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = this.config.baseDelayMs * attempt;
        break;
      case 'fixed':
        delay = this.config.baseDelayMs;
        break;
      case 'fibonacci':
        delay = this.config.baseDelayMs * this.getFibonacci(attempt);
        break;
      default:
        delay = this.config.baseDelayMs;
    }

    // Add jitter
    if (this.config.jitterMs && this.config.jitterMs > 0) {
      const jitter = Math.random() * this.config.jitterMs * 2 - this.config.jitterMs;
      delay += jitter;
    }

    // Ensure delay is within bounds
    return Math.min(Math.max(delay, 0), this.config.maxDelayMs);
  }

  private getFibonacci(n: number): number {
    while (this.fibonacciCache.length < n) {
      const len = this.fibonacciCache.length;
      this.fibonacciCache.push(this.fibonacciCache[len - 1] + this.fibonacciCache[len - 2]);
    }
    return this.fibonacciCache[n - 1];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getConfig(): RetryConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============ Circuit Breaker ============

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextRetryTime?: Date;
  private stateChangeListeners: ((state: CircuitState, prevState: CircuitState) => void)[] = [];

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 30000,
      resetTimeout: config.resetTimeout ?? 60000,
      monitorInterval: config.monitorInterval
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (this.nextRetryTime && Date.now() >= this.nextRetryTime.getTime()) {
        this.transitionTo('half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Operation timed out'));
      }, this.config.timeout);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    this.successes++;

    if (this.state === 'half-open') {
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = new Date();
    this.failures++;

    if (this.state === 'half-open') {
      this.transitionTo('open');
      this.successes = 0;
    } else if (this.state === 'closed') {
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo('open');
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const prevState = this.state;
    this.state = newState;

    if (newState === 'open') {
      this.nextRetryTime = new Date(Date.now() + this.config.resetTimeout);
    } else {
      this.nextRetryTime = undefined;
    }

    // Notify listeners
    for (const listener of this.stateChangeListeners) {
      listener(newState, prevState);
    }
  }

  onStateChange(listener: (state: CircuitState, prevState: CircuitState) => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      const index = this.stateChangeListeners.indexOf(listener);
      if (index >= 0) {
        this.stateChangeListeners.splice(index, 1);
      }
    };
  }

  getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.nextRetryTime
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextRetryTime = undefined;
  }

  forceOpen(): void {
    this.transitionTo('open');
  }

  forceClose(): void {
    this.transitionTo('closed');
    this.failures = 0;
    this.successes = 0;
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }
}

// ============ Workflow Checkpoint Manager ============

export class WorkflowCheckpointManager {
  private checkpoints: Map<string, WorkflowCheckpoint[]> = new Map();
  private maxCheckpointsPerWorkflow: number;

  constructor(maxCheckpointsPerWorkflow: number = 10) {
    this.maxCheckpointsPerWorkflow = maxCheckpointsPerWorkflow;
  }

  createCheckpoint(
    workflowId: string,
    stepIndex: number,
    stepName: string,
    state: Record<string, unknown>,
    metadata: { totalSteps: number; completedSteps: number; failedSteps: number }
  ): WorkflowCheckpoint {
    const checkpoint: WorkflowCheckpoint = {
      id: `checkpoint_${workflowId}_${stepIndex}_${Date.now()}`,
      workflowId,
      stepIndex,
      stepName,
      state,
      timestamp: new Date(),
      metadata
    };

    // Store checkpoint
    let workflowCheckpoints = this.checkpoints.get(workflowId);
    if (!workflowCheckpoints) {
      workflowCheckpoints = [];
      this.checkpoints.set(workflowId, workflowCheckpoints);
    }

    workflowCheckpoints.push(checkpoint);

    // Trim old checkpoints
    if (workflowCheckpoints.length > this.maxCheckpointsPerWorkflow) {
      workflowCheckpoints.shift();
    }

    return checkpoint;
  }

  getLatestCheckpoint(workflowId: string): WorkflowCheckpoint | undefined {
    const checkpoints = this.checkpoints.get(workflowId);
    if (!checkpoints || checkpoints.length === 0) {
      return undefined;
    }
    return checkpoints[checkpoints.length - 1];
  }

  getCheckpoint(checkpointId: string): WorkflowCheckpoint | undefined {
    for (const checkpoints of this.checkpoints.values()) {
      const checkpoint = checkpoints.find(cp => cp.id === checkpointId);
      if (checkpoint) {
        return checkpoint;
      }
    }
    return undefined;
  }

  getCheckpointsForWorkflow(workflowId: string): WorkflowCheckpoint[] {
    return this.checkpoints.get(workflowId) || [];
  }

  deleteCheckpoint(checkpointId: string): boolean {
    for (const [workflowId, checkpoints] of this.checkpoints.entries()) {
      const index = checkpoints.findIndex(cp => cp.id === checkpointId);
      if (index >= 0) {
        checkpoints.splice(index, 1);
        if (checkpoints.length === 0) {
          this.checkpoints.delete(workflowId);
        }
        return true;
      }
    }
    return false;
  }

  clearWorkflowCheckpoints(workflowId: string): void {
    this.checkpoints.delete(workflowId);
  }

  clearAllCheckpoints(): void {
    this.checkpoints.clear();
  }

  getAllWorkflowIds(): string[] {
    return Array.from(this.checkpoints.keys());
  }

  getCheckpointCount(): number {
    let count = 0;
    for (const checkpoints of this.checkpoints.values()) {
      count += checkpoints.length;
    }
    return count;
  }
}

// ============ Fallback Handler ============

export class FallbackHandler {
  private sources: Map<string, FallbackOption> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor(private config: FallbackConfig) {
    // Register primary as first source
    this.sources.set(config.primary, {
      id: config.primary,
      name: config.primary,
      priority: 0,
      handler: async () => { throw new Error('Primary handler not configured'); },
      isAvailable: true
    });

    // Register fallbacks
    for (const fallback of config.fallbacks) {
      this.sources.set(fallback.id, { ...fallback, isAvailable: fallback.isAvailable ?? true });
      this.healthStatus.set(fallback.id, fallback.isAvailable ?? true);
    }

    // Start health checks if configured
    if (config.healthCheckInterval && config.healthCheckInterval > 0) {
      this.startHealthChecks();
    }
  }

  async execute<T>(primaryHandler: () => Promise<T>): Promise<FallbackResult<T>> {
    const attemptedSources: string[] = [];

    // Update primary handler
    const primarySource = this.sources.get(this.config.primary);
    if (primarySource) {
      primarySource.handler = primaryHandler as () => Promise<unknown>;
    }

    // Get sorted sources by priority
    const sortedSources = this.getSortedAvailableSources();

    for (const source of sortedSources) {
      attemptedSources.push(source.id);

      try {
        const result = await this.executeWithTimeout(source.handler);
        this.healthStatus.set(source.id, true);

        return {
          success: true,
          result: result as T,
          usedFallback: source.id !== this.config.primary,
          fallbackId: source.id !== this.config.primary ? source.id : undefined,
          attemptedSources
        };
      } catch (error) {
        this.healthStatus.set(source.id, false);
        // Continue to next fallback
      }
    }

    return {
      success: false,
      usedFallback: attemptedSources.length > 1,
      attemptedSources,
      error: 'All sources failed'
    };
  }

  private async executeWithTimeout<T>(handler: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Operation timed out'));
      }, this.config.timeout);

      handler()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private getSortedAvailableSources(): FallbackOption[] {
    const sources: FallbackOption[] = [];

    for (const source of this.sources.values()) {
      if (source.isAvailable !== false && this.healthStatus.get(source.id) !== false) {
        sources.push(source);
      }
    }

    return sources.sort((a, b) => a.priority - b.priority);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const source of this.sources.values()) {
        if (source.healthCheck) {
          try {
            const isHealthy = await source.healthCheck();
            this.healthStatus.set(source.id, isHealthy);
          } catch {
            this.healthStatus.set(source.id, false);
          }
        }
      }
    }, this.config.healthCheckInterval);
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  addFallback(fallback: FallbackOption): void {
    this.sources.set(fallback.id, fallback);
    this.healthStatus.set(fallback.id, fallback.isAvailable ?? true);
  }

  removeFallback(fallbackId: string): boolean {
    if (fallbackId === this.config.primary) {
      return false; // Cannot remove primary
    }
    this.healthStatus.delete(fallbackId);
    return this.sources.delete(fallbackId);
  }

  setSourceAvailability(sourceId: string, available: boolean): void {
    const source = this.sources.get(sourceId);
    if (source) {
      source.isAvailable = available;
      this.healthStatus.set(sourceId, available);
    }
  }

  getHealthStatus(): Map<string, boolean> {
    return new Map(this.healthStatus);
  }

  getAvailableSources(): string[] {
    return this.getSortedAvailableSources().map(s => s.id);
  }
}

// ============ Main Error Recovery Service ============

export class ErrorRecoveryService {
  private config: ErrorRecoveryConfig;
  private retryMechanism: RetryMechanism;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private checkpointManager: WorkflowCheckpointManager;
  private fallbackHandlers: Map<string, FallbackHandler> = new Map();
  private events: RecoveryEvent[] = [];
  private maxEvents: number = 1000;

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    this.config = {
      retry: {
        maxRetries: config.retry?.maxRetries ?? 3,
        baseDelayMs: config.retry?.baseDelayMs ?? 1000,
        maxDelayMs: config.retry?.maxDelayMs ?? 30000,
        strategy: config.retry?.strategy ?? 'exponential',
        jitterMs: config.retry?.jitterMs ?? 100,
        retryableErrors: config.retry?.retryableErrors,
        nonRetryableErrors: config.retry?.nonRetryableErrors
      },
      circuitBreaker: {
        failureThreshold: config.circuitBreaker?.failureThreshold ?? 5,
        successThreshold: config.circuitBreaker?.successThreshold ?? 2,
        timeout: config.circuitBreaker?.timeout ?? 30000,
        resetTimeout: config.circuitBreaker?.resetTimeout ?? 60000
      },
      enableCheckpoints: config.enableCheckpoints ?? true,
      checkpointStoragePath: config.checkpointStoragePath,
      maxCheckpoints: config.maxCheckpoints ?? 10
    };

    this.retryMechanism = new RetryMechanism(this.config.retry);
    this.checkpointManager = new WorkflowCheckpointManager(this.config.maxCheckpoints);
  }

  // Retry with exponential backoff
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: OperationContext
  ): Promise<RetryResult<T>> {
    const result = await this.retryMechanism.execute(operation, context);

    this.recordEvent({
      eventType: 'retry',
      context: context || { operationId: `op_${Date.now()}`, operationType: 'unknown' },
      details: {
        success: result.success,
        attempts: result.attempts,
        totalTimeMs: result.totalTimeMs,
        error: result.error?.message
      }
    });

    return result;
  }

  // Execute with circuit breaker
  async executeWithCircuitBreaker<T>(
    serverId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    let circuitBreaker = this.circuitBreakers.get(serverId);

    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
      circuitBreaker.onStateChange((state, prevState) => {
        this.recordEvent({
          eventType: 'circuit_state_change',
          context: { operationId: `circuit_${serverId}`, operationType: 'circuit_breaker', serverId },
          details: { state, prevState }
        });
      });
      this.circuitBreakers.set(serverId, circuitBreaker);
    }

    return circuitBreaker.execute(operation);
  }

  // Combined retry + circuit breaker
  async executeWithResilience<T>(
    serverId: string,
    operation: () => Promise<T>,
    context?: OperationContext
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(
      () => this.executeWithCircuitBreaker(serverId, operation),
      context
    );
  }

  // Workflow checkpoint operations
  createCheckpoint(
    workflowId: string,
    stepIndex: number,
    stepName: string,
    state: Record<string, unknown>,
    metadata: { totalSteps: number; completedSteps: number; failedSteps: number }
  ): WorkflowCheckpoint {
    if (!this.config.enableCheckpoints) {
      throw new Error('Checkpoints are disabled');
    }

    const checkpoint = this.checkpointManager.createCheckpoint(
      workflowId, stepIndex, stepName, state, metadata
    );

    this.recordEvent({
      eventType: 'checkpoint_created',
      context: { operationId: checkpoint.id, operationType: 'checkpoint', workflowId },
      details: { stepIndex, stepName, completedSteps: metadata.completedSteps }
    });

    return checkpoint;
  }

  async resumeFromCheckpoint(
    workflowId: string,
    executeStep: (stepIndex: number, state: Record<string, unknown>) => Promise<Record<string, unknown>>
  ): Promise<WorkflowRecoveryResult> {
    const checkpoint = this.checkpointManager.getLatestCheckpoint(workflowId);

    if (!checkpoint) {
      return {
        success: false,
        resumedFromCheckpoint: false,
        completedSteps: 0,
        totalSteps: 0,
        error: 'No checkpoint found for workflow'
      };
    }

    this.recordEvent({
      eventType: 'checkpoint_restored',
      context: { operationId: checkpoint.id, operationType: 'checkpoint_restore', workflowId },
      details: { stepIndex: checkpoint.stepIndex, stepName: checkpoint.stepName }
    });

    try {
      let currentState = checkpoint.state;
      let completedSteps = checkpoint.metadata.completedSteps;

      // Resume from next step after checkpoint
      for (let i = checkpoint.stepIndex + 1; i < checkpoint.metadata.totalSteps; i++) {
        currentState = await executeStep(i, currentState);
        completedSteps++;

        // Create checkpoint after each step
        this.createCheckpoint(
          workflowId,
          i,
          `step_${i}`,
          currentState,
          {
            totalSteps: checkpoint.metadata.totalSteps,
            completedSteps,
            failedSteps: checkpoint.metadata.failedSteps
          }
        );
      }

      return {
        success: true,
        resumedFromCheckpoint: true,
        checkpointId: checkpoint.id,
        completedSteps,
        totalSteps: checkpoint.metadata.totalSteps
      };
    } catch (error) {
      return {
        success: false,
        resumedFromCheckpoint: true,
        checkpointId: checkpoint.id,
        completedSteps: checkpoint.metadata.completedSteps,
        totalSteps: checkpoint.metadata.totalSteps,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Fallback operations
  configureFallback(operationId: string, config: FallbackConfig): void {
    const handler = new FallbackHandler(config);
    this.fallbackHandlers.set(operationId, handler);
  }

  async executeWithFallback<T>(
    operationId: string,
    primaryHandler: () => Promise<T>
  ): Promise<FallbackResult<T>> {
    const handler = this.fallbackHandlers.get(operationId);

    if (!handler) {
      // No fallback configured, try primary only
      try {
        const result = await primaryHandler();
        return {
          success: true,
          result,
          usedFallback: false,
          attemptedSources: ['primary']
        };
      } catch (error) {
        return {
          success: false,
          usedFallback: false,
          attemptedSources: ['primary'],
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    const result = await handler.execute(primaryHandler);

    if (result.usedFallback) {
      this.recordEvent({
        eventType: 'fallback_used',
        context: { operationId, operationType: 'fallback' },
        details: {
          fallbackId: result.fallbackId,
          attemptedSources: result.attemptedSources
        }
      });
    }

    return result;
  }

  // Circuit breaker management
  getCircuitBreakerStatus(serverId: string): CircuitBreakerStatus | undefined {
    return this.circuitBreakers.get(serverId)?.getStatus();
  }

  getAllCircuitBreakerStatuses(): Map<string, CircuitBreakerStatus> {
    const statuses = new Map<string, CircuitBreakerStatus>();
    for (const [id, cb] of this.circuitBreakers) {
      statuses.set(id, cb.getStatus());
    }
    return statuses;
  }

  resetCircuitBreaker(serverId: string): boolean {
    const cb = this.circuitBreakers.get(serverId);
    if (cb) {
      cb.reset();
      return true;
    }
    return false;
  }

  // Event logging
  private recordEvent(event: Omit<RecoveryEvent, 'id' | 'timestamp'>): void {
    const fullEvent: RecoveryEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...event
    };

    this.events.push(fullEvent);

    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  getEvents(since?: Date): RecoveryEvent[] {
    if (since) {
      return this.events.filter(e => e.timestamp >= since);
    }
    return [...this.events];
  }

  getEventsByType(eventType: RecoveryEvent['eventType']): RecoveryEvent[] {
    return this.events.filter(e => e.eventType === eventType);
  }

  clearEvents(): void {
    this.events = [];
  }

  // Checkpoint management
  getCheckpoints(workflowId: string): WorkflowCheckpoint[] {
    return this.checkpointManager.getCheckpointsForWorkflow(workflowId);
  }

  getLatestCheckpoint(workflowId: string): WorkflowCheckpoint | undefined {
    return this.checkpointManager.getLatestCheckpoint(workflowId);
  }

  clearCheckpoints(workflowId?: string): void {
    if (workflowId) {
      this.checkpointManager.clearWorkflowCheckpoints(workflowId);
    } else {
      this.checkpointManager.clearAllCheckpoints();
    }
  }

  // Service status and reset
  getStatus(): {
    circuitBreakers: number;
    openCircuits: number;
    totalCheckpoints: number;
    workflowsWithCheckpoints: number;
    fallbackHandlers: number;
    totalEvents: number;
  } {
    let openCircuits = 0;
    for (const cb of this.circuitBreakers.values()) {
      if (cb.getStatus().state === 'open') {
        openCircuits++;
      }
    }

    return {
      circuitBreakers: this.circuitBreakers.size,
      openCircuits,
      totalCheckpoints: this.checkpointManager.getCheckpointCount(),
      workflowsWithCheckpoints: this.checkpointManager.getAllWorkflowIds().length,
      fallbackHandlers: this.fallbackHandlers.size,
      totalEvents: this.events.length
    };
  }

  reset(): void {
    for (const cb of this.circuitBreakers.values()) {
      cb.reset();
    }
    this.circuitBreakers.clear();
    this.checkpointManager.clearAllCheckpoints();
    for (const handler of this.fallbackHandlers.values()) {
      handler.stopHealthChecks();
    }
    this.fallbackHandlers.clear();
    this.events = [];
  }

  getConfig(): ErrorRecoveryConfig {
    return { ...this.config };
  }

  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.config.retry = { ...this.config.retry, ...config };
    this.retryMechanism.updateConfig(config);
  }
}

// ============ Singleton Instance ============

let errorRecoveryServiceInstance: ErrorRecoveryService | null = null;

export function getErrorRecoveryService(config?: Partial<ErrorRecoveryConfig>): ErrorRecoveryService {
  if (!errorRecoveryServiceInstance) {
    errorRecoveryServiceInstance = new ErrorRecoveryService(config);
  }
  return errorRecoveryServiceInstance;
}

export function resetErrorRecoveryService(): void {
  if (errorRecoveryServiceInstance) {
    errorRecoveryServiceInstance.reset();
    errorRecoveryServiceInstance = null;
  }
}
