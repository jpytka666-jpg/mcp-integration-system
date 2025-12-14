/**
 * Comprehensive Monitoring and Logging System
 * Provides structured logging, performance metrics, and cross-ecosystem error correlation
 * for MCP Integration System
 */

import { MCPServerDefinition, WorkflowExecution, SystemError } from './types.js';

// Log Levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

// Log Entry Structure
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: 'mcp_operation' | 'addin_interaction' | 'workflow' | 'data_transform' | 'cloud_service' | 'system';
  source: {
    component: string;
    serverId?: string;
    workflowId?: string;
    operationId?: string;
  };
  message: string;
  details: Record<string, any>;
  correlationId?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

// Performance Metric Types
export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent' | 'ops/sec';
  timestamp: Date;
  tags: Record<string, string>;
  source: {
    component: string;
    serverId?: string;
    operationId?: string;
  };
}

// Addin Interaction Record
export interface AddinInteraction {
  id: string;
  addinId: string;
  addinName: string;
  interactionType: 'request' | 'response' | 'event' | 'error';
  operation: string;
  timestamp: Date;
  duration?: number;
  payload?: any;
  response?: any;
  error?: string;
  correlationId: string;
}

// Workflow Progress Record
export interface WorkflowProgress {
  workflowId: string;
  executionId: string;
  currentStep: number;
  totalSteps: number;
  progress: number; // 0-100
  phase: 'initialization' | 'execution' | 'transformation' | 'completion' | 'error';
  stepMetrics: Map<string, StepMetric>;
  startTime: Date;
  estimatedCompletion?: Date;
  lastUpdate: Date;
}

export interface StepMetric {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  retryCount: number;
  error?: string;
}

// Error Correlation
export interface CorrelatedError {
  id: string;
  correlationId: string;
  primaryError: SystemError;
  relatedErrors: SystemError[];
  affectedComponents: string[];
  rootCause?: string;
  suggestedResolution?: string;
  timestamp: Date;
  resolved: boolean;
}

// Monitoring Configuration
export interface MonitoringConfig {
  logLevel: LogLevel;
  enablePerformanceMetrics: boolean;
  enableAddinTracking: boolean;
  enableWorkflowTracking: boolean;
  metricsRetentionDays: number;
  logRetentionDays: number;
  alertThresholds: {
    errorRatePercent: number;
    responseTimeMs: number;
    memoryUsagePercent: number;
  };
  exporters: Array<'console' | 'file' | 'cloudwatch' | 'custom'>;
}

// Log Exporter Interface
export interface LogExporter {
  export(entries: LogEntry[]): Promise<void>;
  flush(): Promise<void>;
}

// Metrics Aggregator
export interface MetricsAggregation {
  name: string;
  period: 'minute' | 'hour' | 'day';
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  timestamp: Date;
}

/**
 * Main Monitoring and Logging System
 */
export class MonitoringLoggingSystem {
  private config: MonitoringConfig;
  private logBuffer: LogEntry[] = [];
  private metricsBuffer: PerformanceMetric[] = [];
  private addinInteractions: Map<string, AddinInteraction[]> = new Map();
  private workflowProgress: Map<string, WorkflowProgress> = new Map();
  private correlatedErrors: Map<string, CorrelatedError> = new Map();
  private exporters: LogExporter[] = [];
  private metricsAggregations: Map<string, MetricsAggregation[]> = new Map();

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      logLevel: 'info',
      enablePerformanceMetrics: true,
      enableAddinTracking: true,
      enableWorkflowTracking: true,
      metricsRetentionDays: 30,
      logRetentionDays: 7,
      alertThresholds: {
        errorRatePercent: 5,
        responseTimeMs: 5000,
        memoryUsagePercent: 80
      },
      exporters: ['console'],
      ...config
    };

    this.initializeExporters();
  }

  // ============ Logging Methods ============

  /**
   * Log a NonicaTab MCP operation
   */
  logMCPOperation(
    serverId: string,
    operation: string,
    details: Record<string, any>,
    level: LogLevel = 'info',
    correlationId?: string
  ): string {
    const logId = this.generateId('log');

    const entry: LogEntry = {
      id: logId,
      timestamp: new Date(),
      level,
      category: 'mcp_operation',
      source: {
        component: 'MCPIntegration',
        serverId,
        operationId: operation
      },
      message: `MCP operation: ${operation} on server ${serverId}`,
      details,
      correlationId: correlationId || this.generateCorrelationId(),
      metadata: {
        serverType: this.getServerType(serverId)
      }
    };

    this.addLogEntry(entry);
    return entry.correlationId!;
  }

  /**
   * Log AIONS.Revit addin interaction
   */
  logAddinInteraction(interaction: Omit<AddinInteraction, 'id'>): string {
    if (!this.config.enableAddinTracking) {
      return interaction.correlationId;
    }

    const id = this.generateId('addin');
    const fullInteraction: AddinInteraction = {
      ...interaction,
      id
    };

    // Store interaction
    const addinInteractions = this.addinInteractions.get(interaction.addinId) || [];
    addinInteractions.push(fullInteraction);
    this.addinInteractions.set(interaction.addinId, addinInteractions);

    // Create log entry
    const entry: LogEntry = {
      id: this.generateId('log'),
      timestamp: interaction.timestamp,
      level: interaction.error ? 'error' : 'info',
      category: 'addin_interaction',
      source: {
        component: 'AddinBridge',
        serverId: interaction.addinId
      },
      message: `Addin ${interaction.addinName}: ${interaction.interactionType} - ${interaction.operation}`,
      details: {
        interactionType: interaction.interactionType,
        operation: interaction.operation,
        payload: interaction.payload,
        response: interaction.response,
        error: interaction.error
      },
      correlationId: interaction.correlationId,
      duration: interaction.duration
    };

    this.addLogEntry(entry);
    return interaction.correlationId;
  }

  /**
   * Log workflow execution event
   */
  logWorkflowEvent(
    workflowId: string,
    executionId: string,
    event: 'started' | 'step_completed' | 'step_failed' | 'completed' | 'failed' | 'paused' | 'resumed',
    details: Record<string, any>,
    correlationId?: string
  ): void {
    const level: LogLevel = event.includes('failed') ? 'error' : 'info';

    const entry: LogEntry = {
      id: this.generateId('log'),
      timestamp: new Date(),
      level,
      category: 'workflow',
      source: {
        component: 'WorkflowOrchestrator',
        workflowId,
        operationId: executionId
      },
      message: `Workflow ${workflowId}: ${event}`,
      details: {
        event,
        ...details
      },
      correlationId: correlationId || this.generateCorrelationId()
    };

    this.addLogEntry(entry);
  }

  /**
   * Log data transformation operation
   */
  logDataTransformation(
    sourceFormat: string,
    targetFormat: string,
    success: boolean,
    details: Record<string, any>,
    duration: number,
    correlationId?: string
  ): void {
    const entry: LogEntry = {
      id: this.generateId('log'),
      timestamp: new Date(),
      level: success ? 'info' : 'error',
      category: 'data_transform',
      source: {
        component: 'DataTransformer'
      },
      message: `Transform ${sourceFormat} -> ${targetFormat}: ${success ? 'success' : 'failed'}`,
      details: {
        sourceFormat,
        targetFormat,
        success,
        ...details
      },
      correlationId: correlationId || this.generateCorrelationId(),
      duration
    };

    this.addLogEntry(entry);
  }

  /**
   * Log system error with correlation
   */
  logError(error: SystemError, correlationId?: string): string {
    const corrId = correlationId || this.generateCorrelationId();

    const entry: LogEntry = {
      id: this.generateId('log'),
      timestamp: error.timestamp,
      level: this.severityToLogLevel(error.severity),
      category: 'system',
      source: {
        component: error.source.component,
        serverId: error.source.mcpServer,
        operationId: error.source.operation
      },
      message: error.message,
      details: error.details,
      correlationId: corrId
    };

    this.addLogEntry(entry);

    // Correlate with existing errors
    this.correlateError(error, corrId);

    return corrId;
  }

  // ============ Performance Metrics ============

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: PerformanceMetric['unit'],
    tags: Record<string, string> = {},
    source?: Partial<PerformanceMetric['source']>
  ): void {
    if (!this.config.enablePerformanceMetrics) {
      return;
    }

    const metric: PerformanceMetric = {
      id: this.generateId('metric'),
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
      source: {
        component: source?.component || 'Unknown',
        serverId: source?.serverId,
        operationId: source?.operationId
      }
    };

    this.metricsBuffer.push(metric);
    this.updateAggregation(metric);
  }

  /**
   * Record operation timing
   */
  recordTiming(
    operationName: string,
    durationMs: number,
    tags: Record<string, string> = {},
    source?: Partial<PerformanceMetric['source']>
  ): void {
    this.recordMetric(`${operationName}_duration`, durationMs, 'ms', tags, source);
  }

  /**
   * Record operation count
   */
  recordCount(
    operationName: string,
    count: number = 1,
    tags: Record<string, string> = {},
    source?: Partial<PerformanceMetric['source']>
  ): void {
    this.recordMetric(`${operationName}_count`, count, 'count', tags, source);
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(operationName: string, tags: Record<string, string> = {}): () => number {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.recordTiming(operationName, duration, tags);
      return duration;
    };
  }

  // ============ Workflow Progress Tracking ============

  /**
   * Initialize workflow progress tracking
   */
  initializeWorkflowProgress(
    workflowId: string,
    executionId: string,
    totalSteps: number
  ): void {
    if (!this.config.enableWorkflowTracking) {
      return;
    }

    const progress: WorkflowProgress = {
      workflowId,
      executionId,
      currentStep: 0,
      totalSteps,
      progress: 0,
      phase: 'initialization',
      stepMetrics: new Map(),
      startTime: new Date(),
      lastUpdate: new Date()
    };

    this.workflowProgress.set(executionId, progress);

    this.logWorkflowEvent(workflowId, executionId, 'started', {
      totalSteps
    });
  }

  /**
   * Update workflow step progress
   */
  updateStepProgress(
    executionId: string,
    stepId: string,
    status: StepMetric['status'],
    error?: string
  ): void {
    const progress = this.workflowProgress.get(executionId);
    if (!progress) {
      return;
    }

    const existingMetric = progress.stepMetrics.get(stepId);
    const now = new Date();

    const stepMetric: StepMetric = {
      stepId,
      status,
      startTime: existingMetric?.startTime || (status === 'running' ? now : undefined),
      endTime: ['completed', 'failed', 'skipped'].includes(status) ? now : undefined,
      duration: existingMetric?.startTime && ['completed', 'failed'].includes(status)
        ? now.getTime() - existingMetric.startTime.getTime()
        : undefined,
      retryCount: existingMetric?.retryCount || 0,
      error
    };

    if (status === 'running' && existingMetric?.status === 'failed') {
      stepMetric.retryCount = (existingMetric.retryCount || 0) + 1;
    }

    progress.stepMetrics.set(stepId, stepMetric);

    // Update overall progress
    const completedSteps = Array.from(progress.stepMetrics.values())
      .filter(m => m.status === 'completed').length;
    progress.currentStep = completedSteps;
    progress.progress = Math.round((completedSteps / progress.totalSteps) * 100);
    progress.lastUpdate = now;

    // Update phase
    if (status === 'failed' && !error?.includes('retry')) {
      progress.phase = 'error';
    } else if (completedSteps === progress.totalSteps) {
      progress.phase = 'completion';
    } else if (completedSteps > 0) {
      progress.phase = 'execution';
    }

    // Estimate completion
    if (completedSteps > 0 && completedSteps < progress.totalSteps) {
      const avgStepDuration = this.calculateAverageStepDuration(progress);
      const remainingSteps = progress.totalSteps - completedSteps;
      progress.estimatedCompletion = new Date(now.getTime() + (avgStepDuration * remainingSteps));
    }

    // Record timing metric
    if (stepMetric.duration) {
      this.recordTiming('workflow_step', stepMetric.duration, {
        workflowId: progress.workflowId,
        stepId,
        status
      });
    }

    // Log event
    const event = status === 'completed' ? 'step_completed' :
                  status === 'failed' ? 'step_failed' : 'started';
    if (['completed', 'failed'].includes(status)) {
      this.logWorkflowEvent(progress.workflowId, executionId, event as any, {
        stepId,
        duration: stepMetric.duration,
        error
      });
    }
  }

  /**
   * Get workflow progress
   */
  getWorkflowProgress(executionId: string): WorkflowProgress | undefined {
    return this.workflowProgress.get(executionId);
  }

  /**
   * Complete workflow tracking
   */
  completeWorkflow(executionId: string, success: boolean, error?: string): void {
    const progress = this.workflowProgress.get(executionId);
    if (!progress) {
      return;
    }

    progress.phase = success ? 'completion' : 'error';
    progress.progress = success ? 100 : progress.progress;
    progress.lastUpdate = new Date();

    const totalDuration = progress.lastUpdate.getTime() - progress.startTime.getTime();

    this.logWorkflowEvent(
      progress.workflowId,
      executionId,
      success ? 'completed' : 'failed',
      {
        totalDuration,
        completedSteps: progress.currentStep,
        totalSteps: progress.totalSteps,
        error
      }
    );

    this.recordTiming('workflow_total', totalDuration, {
      workflowId: progress.workflowId,
      success: String(success)
    });
  }

  // ============ Error Correlation ============

  /**
   * Correlate errors across ecosystems
   */
  correlateError(error: SystemError, correlationId: string): CorrelatedError {
    const existing = this.correlatedErrors.get(correlationId);

    if (existing) {
      existing.relatedErrors.push(error);
      if (!existing.affectedComponents.includes(error.source.component)) {
        existing.affectedComponents.push(error.source.component);
      }
      existing.rootCause = this.analyzeRootCause(existing);
      existing.suggestedResolution = this.suggestResolution(existing);
      return existing;
    }

    const correlated: CorrelatedError = {
      id: this.generateId('corr'),
      correlationId,
      primaryError: error,
      relatedErrors: [],
      affectedComponents: [error.source.component],
      rootCause: this.analyzeRootCause({ primaryError: error, relatedErrors: [] } as CorrelatedError),
      suggestedResolution: undefined,
      timestamp: new Date(),
      resolved: false
    };

    correlated.suggestedResolution = this.suggestResolution(correlated);
    this.correlatedErrors.set(correlationId, correlated);

    return correlated;
  }

  /**
   * Get correlated errors
   */
  getCorrelatedErrors(correlationId?: string): CorrelatedError[] {
    if (correlationId) {
      const error = this.correlatedErrors.get(correlationId);
      return error ? [error] : [];
    }
    return Array.from(this.correlatedErrors.values());
  }

  /**
   * Mark error as resolved
   */
  resolveError(correlationId: string): void {
    const error = this.correlatedErrors.get(correlationId);
    if (error) {
      error.resolved = true;
    }
  }

  // ============ Metrics Aggregation ============

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(
    name: string,
    period: MetricsAggregation['period'] = 'hour'
  ): MetricsAggregation[] {
    const key = `${name}_${period}`;
    return this.metricsAggregations.get(key) || [];
  }

  /**
   * Get all metrics for a time range
   */
  getMetrics(
    startTime: Date,
    endTime: Date,
    filter?: { name?: string; tags?: Record<string, string> }
  ): PerformanceMetric[] {
    return this.metricsBuffer.filter(metric => {
      if (metric.timestamp < startTime || metric.timestamp > endTime) {
        return false;
      }
      if (filter?.name && !metric.name.includes(filter.name)) {
        return false;
      }
      if (filter?.tags) {
        for (const [key, value] of Object.entries(filter.tags)) {
          if (metric.tags[key] !== value) {
            return false;
          }
        }
      }
      return true;
    });
  }

  // ============ Log Retrieval ============

  /**
   * Get logs by correlation ID
   */
  getLogsByCorrelationId(correlationId: string): LogEntry[] {
    return this.logBuffer.filter(entry => entry.correlationId === correlationId);
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: LogEntry['category'], limit: number = 100): LogEntry[] {
    return this.logBuffer
      .filter(entry => entry.category === category)
      .slice(-limit);
  }

  /**
   * Get logs by time range
   */
  getLogs(startTime: Date, endTime: Date, filter?: { level?: LogLevel; category?: LogEntry['category'] }): LogEntry[] {
    return this.logBuffer.filter(entry => {
      if (entry.timestamp < startTime || entry.timestamp > endTime) {
        return false;
      }
      if (filter?.level && this.logLevelPriority(entry.level) < this.logLevelPriority(filter.level)) {
        return false;
      }
      if (filter?.category && entry.category !== filter.category) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get addin interactions
   */
  getAddinInteractions(addinId?: string): AddinInteraction[] {
    if (addinId) {
      return this.addinInteractions.get(addinId) || [];
    }
    return Array.from(this.addinInteractions.values()).flat();
  }

  // ============ Export and Flush ============

  /**
   * Flush all buffers to exporters
   */
  async flush(): Promise<void> {
    const entries = [...this.logBuffer];

    for (const exporter of this.exporters) {
      await exporter.export(entries);
      await exporter.flush();
    }
  }

  /**
   * Clear old data based on retention policy
   */
  cleanup(): void {
    const logCutoff = new Date();
    logCutoff.setDate(logCutoff.getDate() - this.config.logRetentionDays);

    const metricsCutoff = new Date();
    metricsCutoff.setDate(metricsCutoff.getDate() - this.config.metricsRetentionDays);

    this.logBuffer = this.logBuffer.filter(entry => entry.timestamp > logCutoff);
    this.metricsBuffer = this.metricsBuffer.filter(metric => metric.timestamp > metricsCutoff);

    // Cleanup resolved errors older than 24 hours
    const errorCutoff = new Date();
    errorCutoff.setHours(errorCutoff.getHours() - 24);

    for (const [id, error] of this.correlatedErrors) {
      if (error.resolved && error.timestamp < errorCutoff) {
        this.correlatedErrors.delete(id);
      }
    }
  }

  // ============ Private Helper Methods ============

  private initializeExporters(): void {
    for (const exporterType of this.config.exporters) {
      switch (exporterType) {
        case 'console':
          this.exporters.push(new ConsoleExporter(this.config.logLevel));
          break;
        // Other exporters can be added here
      }
    }
  }

  private addLogEntry(entry: LogEntry): void {
    if (this.logLevelPriority(entry.level) >= this.logLevelPriority(this.config.logLevel)) {
      this.logBuffer.push(entry);

      // Immediately export to console if enabled
      for (const exporter of this.exporters) {
        if (exporter instanceof ConsoleExporter) {
          exporter.export([entry]).catch(() => {});
        }
      }
    }
  }

  private updateAggregation(metric: PerformanceMetric): void {
    const periods: MetricsAggregation['period'][] = ['minute', 'hour', 'day'];

    for (const period of periods) {
      const key = `${metric.name}_${period}`;
      const aggregations = this.metricsAggregations.get(key) || [];

      const periodStart = this.getPeriodStart(metric.timestamp, period);
      let aggregation = aggregations.find(a => a.timestamp.getTime() === periodStart.getTime());

      if (!aggregation) {
        aggregation = {
          name: metric.name,
          period,
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          timestamp: periodStart
        };
        aggregations.push(aggregation);
      }

      aggregation.count++;
      aggregation.sum += metric.value;
      aggregation.min = Math.min(aggregation.min, metric.value);
      aggregation.max = Math.max(aggregation.max, metric.value);
      aggregation.avg = aggregation.sum / aggregation.count;

      this.metricsAggregations.set(key, aggregations);
    }
  }

  private getPeriodStart(date: Date, period: MetricsAggregation['period']): Date {
    const result = new Date(date);
    result.setSeconds(0, 0);

    switch (period) {
      case 'minute':
        break;
      case 'hour':
        result.setMinutes(0);
        break;
      case 'day':
        result.setMinutes(0);
        result.setHours(0);
        break;
    }

    return result;
  }

  private calculateAverageStepDuration(progress: WorkflowProgress): number {
    const completedSteps = Array.from(progress.stepMetrics.values())
      .filter(m => m.status === 'completed' && m.duration);

    if (completedSteps.length === 0) {
      return 5000; // Default estimate
    }

    const totalDuration = completedSteps.reduce((sum, m) => sum + (m.duration || 0), 0);
    return totalDuration / completedSteps.length;
  }

  private analyzeRootCause(correlated: CorrelatedError): string {
    const errors = [correlated.primaryError, ...correlated.relatedErrors];

    // Check for connection errors
    if (errors.some(e => e.type === 'connection')) {
      return 'Server connection failure';
    }

    // Check for data errors
    if (errors.some(e => e.type === 'data')) {
      return 'Data validation or transformation error';
    }

    // Check for workflow errors
    if (errors.some(e => e.type === 'workflow')) {
      return 'Workflow execution failure';
    }

    // Check for security errors
    if (errors.some(e => e.type === 'security')) {
      return 'Security constraint violation';
    }

    return 'Unknown root cause';
  }

  private suggestResolution(correlated: CorrelatedError): string {
    const suggestions = correlated.primaryError.suggestedActions;

    if (suggestions && suggestions.length > 0) {
      return suggestions[0];
    }

    switch (correlated.rootCause) {
      case 'Server connection failure':
        return 'Check server status and network connectivity. Try reconnecting or use fallback server.';
      case 'Data validation or transformation error':
        return 'Verify input data format and schema. Check transformation rules.';
      case 'Workflow execution failure':
        return 'Review workflow step dependencies. Check for resource availability.';
      case 'Security constraint violation':
        return 'Verify permissions and credentials. Check security configuration.';
      default:
        return 'Review error details and consult documentation.';
    }
  }

  private severityToLogLevel(severity: SystemError['severity']): LogLevel {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'error';
      case 'medium': return 'warn';
      case 'low': return 'info';
      default: return 'info';
    }
  }

  private logLevelPriority(level: LogLevel): number {
    const priorities: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      critical: 4
    };
    return priorities[level];
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getServerType(serverId: string): string {
    if (serverId.includes('nonicatab')) return 'nonicatab';
    if (serverId.includes('aions')) return 'aions_addin';
    if (serverId.includes('zedmoster')) return 'github_external';
    return 'unknown';
  }
}

/**
 * Console Log Exporter
 */
class ConsoleExporter implements LogExporter {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  async export(entries: LogEntry[]): Promise<void> {
    for (const entry of entries) {
      if (this.shouldLog(entry.level)) {
        const timestamp = entry.timestamp.toISOString();
        const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
        const message = `${prefix} ${entry.message}`;

        switch (entry.level) {
          case 'debug':
            console.debug(message, entry.details);
            break;
          case 'info':
            console.info(message);
            break;
          case 'warn':
            console.warn(message, entry.details);
            break;
          case 'error':
          case 'critical':
            console.error(message, entry.details);
            break;
        }
      }
    }
  }

  async flush(): Promise<void> {
    // Console doesn't need flushing
  }

  private shouldLog(level: LogLevel): boolean {
    const priorities: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      critical: 4
    };
    return priorities[level] >= priorities[this.minLevel];
  }
}

/**
 * Create a singleton instance for global use
 */
let globalMonitoringSystem: MonitoringLoggingSystem | null = null;

export function getMonitoringSystem(config?: Partial<MonitoringConfig>): MonitoringLoggingSystem {
  if (!globalMonitoringSystem) {
    globalMonitoringSystem = new MonitoringLoggingSystem(config);
  }
  return globalMonitoringSystem;
}

export function resetMonitoringSystem(): void {
  globalMonitoringSystem = null;
}
