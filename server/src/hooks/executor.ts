/**
 * Hook Execution Engine
 * Handles automatic hook triggering and action execution
 * Implements Requirements 6.2, 6.4
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import {
  Hook,
  HookAction,
  HookTriggerEvent,
  HookEventContext,
  HookExecutionResult,
  HookRegistration,
  HookDirectoryListing,
} from './types.js';
import { HookConfigManager } from './config-manager.js';

/**
 * Hook execution log entry
 */
export interface HookExecutionLog {
  hookId: string;
  hookName: string;
  event: HookTriggerEvent;
  timestamp: Date;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

/**
 * Hook system status
 */
export interface HookSystemStatus {
  initialized: boolean;
  hooksDirectory: string;
  totalHooks: number;
  activeHooks: number;
  inactiveHooks: number;
  errorHooks: number;
  lastExecution?: Date;
}

/**
 * Event listener callback type
 */
export type HookEventListener = (
  event: HookTriggerEvent,
  context: HookEventContext
) => void;

/**
 * Message handler callback type for message actions
 */
export type MessageHandler = (message: string, context: HookEventContext) => Promise<void>;

/**
 * Hook Executor - manages hook triggering and execution
 */
export class HookExecutor {
  private configManager: HookConfigManager;
  private eventListeners: Map<HookTriggerEvent, Set<HookEventListener>> = new Map();
  private messageHandler?: MessageHandler;
  private defaultTimeout: number = 30000; // 30 seconds default timeout
  private workingDirectory: string;
  private initialized: boolean = false;
  private executionLog: HookExecutionLog[] = [];
  private maxLogEntries: number = 100;
  private lastExecution?: Date;

  constructor(configManager: HookConfigManager, workingDirectory: string = process.cwd()) {
    this.configManager = configManager;
    this.workingDirectory = workingDirectory;
    this.initializeEventListeners();
  }

  /**
   * Initialize the hook system by loading all hooks from the .kiro/hooks/ directory
   * This should be called when the IDE starts or when hooks need to be reloaded
   */
  initialize(): HookDirectoryListing {
    // Ensure hooks directory exists
    this.configManager.ensureHooksDirectory();
    
    // Load and register all hooks
    this.configManager.loadAndRegisterHooks();
    
    // Get directory listing for status reporting
    const listing = this.configManager.listHooksDirectory();
    
    this.initialized = true;
    return listing;
  }

  /**
   * Check if the hook system has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the current status of the hook system
   */
  getStatus(): HookSystemStatus {
    const registrations = this.configManager.getAllRegistrations();
    
    return {
      initialized: this.initialized,
      hooksDirectory: this.configManager.getHooksDirectory(),
      totalHooks: registrations.length,
      activeHooks: registrations.filter(r => r.status === 'active').length,
      inactiveHooks: registrations.filter(r => r.status === 'inactive').length,
      errorHooks: registrations.filter(r => r.status === 'error').length,
      lastExecution: this.lastExecution,
    };
  }

  /**
   * Reload all hooks from the hooks directory
   * Useful when hooks are added, modified, or removed
   */
  reload(): HookDirectoryListing {
    // Clear existing registrations
    const existingRegistrations = this.configManager.getAllRegistrations();
    for (const reg of existingRegistrations) {
      this.configManager.unregisterHook(reg.hook.id);
    }
    
    // Re-initialize
    return this.initialize();
  }

  /**
   * Get the execution log
   */
  getExecutionLog(): HookExecutionLog[] {
    return [...this.executionLog];
  }

  /**
   * Clear the execution log
   */
  clearExecutionLog(): void {
    this.executionLog = [];
  }

  /**
   * Add an entry to the execution log
   */
  private logExecution(result: HookExecutionResult, hook: Hook, context: HookEventContext): void {
    const duration = result.endTime.getTime() - result.startTime.getTime();
    
    const logEntry: HookExecutionLog = {
      hookId: hook.id,
      hookName: hook.name,
      event: context.event,
      timestamp: result.startTime,
      success: result.success,
      duration,
      output: result.output,
      error: result.error,
    };
    
    this.executionLog.push(logEntry);
    this.lastExecution = result.endTime;
    
    // Trim log if it exceeds max entries
    if (this.executionLog.length > this.maxLogEntries) {
      this.executionLog = this.executionLog.slice(-this.maxLogEntries);
    }
  }

  /**
   * Initialize event listener maps for all trigger events
   */
  private initializeEventListeners(): void {
    const events: HookTriggerEvent[] = [
      'message_sent',
      'execution_complete',
      'session_created',
      'file_saved',
      'manual',
      'translation_update',
    ];

    for (const event of events) {
      this.eventListeners.set(event, new Set());
    }
  }

  /**
   * Set the message handler for message-type actions
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Add an event listener for a specific trigger event
   */
  addEventListener(event: HookTriggerEvent, listener: HookEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Remove an event listener
   */
  removeEventListener(event: HookTriggerEvent, listener: HookEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Trigger an event and execute all matching hooks
   */
  async triggerEvent(context: HookEventContext): Promise<HookExecutionResult[]> {
    const results: HookExecutionResult[] = [];
    const registrations = this.configManager.getHooksForEvent(context.event);

    // Notify event listeners
    const listeners = this.eventListeners.get(context.event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(context.event, context);
        } catch {
          // Listeners should not throw, but we catch just in case
        }
      }
    }

    // Execute matching hooks
    for (const registration of registrations) {
      if (this.shouldExecuteHook(registration, context)) {
        const result = await this.executeHook(registration.hook, context);
        results.push(result);
        
        // Log the execution
        this.logExecution(result, registration.hook, context);
        
        // Record in config manager
        this.configManager.recordExecution(
          registration.hook.id,
          result.success,
          result.error
        );
      }
    }

    return results;
  }

  /**
   * Check if a hook should be executed based on context
   */
  private shouldExecuteHook(registration: HookRegistration, context: HookEventContext): boolean {
    const { hook } = registration;

    // Check if hook is active
    if (registration.status !== 'active') {
      return false;
    }

    // Check file pattern for file_saved events
    if (context.event === 'file_saved' && hook.trigger.filePattern && context.filePath) {
      if (!this.matchesFilePattern(context.filePath, hook.trigger.filePattern)) {
        return false;
      }
    }

    // Check condition if specified
    if (hook.trigger.condition) {
      if (!this.evaluateCondition(hook.trigger.condition, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Match a file path against a glob pattern
   */
  private matchesFilePattern(filePath: string, pattern: string): boolean {
    // Simple glob matching - supports * and ** wildcards
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    // Convert glob pattern to regex
    const regexPattern = normalizedPattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{DOUBLE_STAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{DOUBLE_STAR}}/g, '.*');

    const regex = new RegExp(`^${regexPattern}$|/${regexPattern}$`);
    return regex.test(normalizedPath);
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, context: HookEventContext): boolean {
    // Simple condition evaluation - supports basic expressions
    try {
      // Replace context variables in condition
      let evaluatedCondition = condition;
      
      if (context.filePath) {
        evaluatedCondition = evaluatedCondition.replace(/\$filePath/g, `"${context.filePath}"`);
      }
      if (context.message) {
        evaluatedCondition = evaluatedCondition.replace(/\$message/g, `"${context.message}"`);
      }
      if (context.sessionId) {
        evaluatedCondition = evaluatedCondition.replace(/\$sessionId/g, `"${context.sessionId}"`);
      }

      // For security, only allow simple boolean expressions
      // This is a simplified implementation - in production, use a proper expression parser
      if (/^(true|false)$/i.test(evaluatedCondition.trim())) {
        return evaluatedCondition.trim().toLowerCase() === 'true';
      }

      // Default to true if condition cannot be evaluated
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Execute a single hook
   */
  async executeHook(hook: Hook, context: HookEventContext): Promise<HookExecutionResult> {
    const startTime = new Date();

    try {
      if (hook.action.type === 'message') {
        await this.executeMessageAction(hook.action, context);
      } else if (hook.action.type === 'command') {
        await this.executeCommandAction(hook.action, context);
      }

      return {
        hookId: hook.id,
        success: true,
        startTime,
        endTime: new Date(),
      };
    } catch (error) {
      return {
        hookId: hook.id,
        success: false,
        startTime,
        endTime: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a message action
   */
  private async executeMessageAction(action: HookAction, context: HookEventContext): Promise<void> {
    if (!this.messageHandler) {
      throw new Error('No message handler configured');
    }

    // Interpolate context variables in message
    const message = this.interpolateMessage(action.target, context);
    await this.messageHandler(message, context);
  }

  /**
   * Interpolate context variables in a message string
   */
  private interpolateMessage(template: string, context: HookEventContext): string {
    let result = template;

    if (context.filePath) {
      result = result.replace(/\$filePath/g, context.filePath);
      result = result.replace(/\$fileName/g, path.basename(context.filePath));
    }
    if (context.message) {
      result = result.replace(/\$message/g, context.message);
    }
    if (context.sessionId) {
      result = result.replace(/\$sessionId/g, context.sessionId);
    }
    result = result.replace(/\$timestamp/g, context.timestamp.toISOString());

    return result;
  }

  /**
   * Execute a command action
   */
  private async executeCommandAction(action: HookAction, context: HookEventContext): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = action.timeout || this.defaultTimeout;
      const cwd = action.workingDirectory || this.workingDirectory;

      // Interpolate context variables in command
      const command = this.interpolateMessage(action.target, context);

      // Determine shell based on platform
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'cmd' : '/bin/sh';
      const shellArgs = isWindows ? ['/c', command] : ['-c', command];

      let output = '';
      let errorOutput = '';
      let timedOut = false;

      const childProcess: ChildProcess = spawn(shell, shellArgs, {
        cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        childProcess.kill('SIGTERM');
      }, timeout);

      childProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeoutId);

        if (timedOut) {
          reject(new Error(`Command timed out after ${timeout}ms`));
        } else if (code !== 0) {
          reject(new Error(`Command failed with exit code ${code}: ${errorOutput || output}`));
        } else {
          resolve(output);
        }
      });

      childProcess.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
    });
  }

  /**
   * Manually trigger a specific hook by ID
   */
  async triggerHookById(hookId: string, context?: Partial<HookEventContext>): Promise<HookExecutionResult> {
    const registration = this.configManager.getRegistration(hookId);
    
    if (!registration) {
      return {
        hookId,
        success: false,
        startTime: new Date(),
        endTime: new Date(),
        error: 'Hook not found',
      };
    }

    const fullContext: HookEventContext = {
      event: registration.hook.trigger.event,
      timestamp: new Date(),
      ...context,
    };

    const result = await this.executeHook(registration.hook, fullContext);
    
    // Log the execution
    this.logExecution(result, registration.hook, fullContext);
    
    // Record in config manager
    this.configManager.recordExecution(hookId, result.success, result.error);
    
    return result;
  }

  /**
   * Convenience method to trigger file_saved event
   */
  async onFileSaved(filePath: string): Promise<HookExecutionResult[]> {
    return this.triggerEvent({
      event: 'file_saved',
      timestamp: new Date(),
      filePath,
    });
  }

  /**
   * Convenience method to trigger message_sent event
   */
  async onMessageSent(message: string): Promise<HookExecutionResult[]> {
    return this.triggerEvent({
      event: 'message_sent',
      timestamp: new Date(),
      message,
    });
  }

  /**
   * Convenience method to trigger session_created event
   */
  async onSessionCreated(sessionId: string): Promise<HookExecutionResult[]> {
    return this.triggerEvent({
      event: 'session_created',
      timestamp: new Date(),
      sessionId,
    });
  }

  /**
   * Convenience method to trigger execution_complete event
   */
  async onExecutionComplete(): Promise<HookExecutionResult[]> {
    return this.triggerEvent({
      event: 'execution_complete',
      timestamp: new Date(),
    });
  }

  /**
   * Convenience method to trigger manual event
   */
  async onManualTrigger(hookId: string): Promise<HookExecutionResult> {
    return this.triggerHookById(hookId, { event: 'manual' });
  }

  /**
   * Convenience method to trigger translation_update event
   */
  async onTranslationUpdate(filePath: string): Promise<HookExecutionResult[]> {
    return this.triggerEvent({
      event: 'translation_update',
      timestamp: new Date(),
      filePath,
    });
  }

  /**
   * Create an IDE event handler that can be attached to IDE events
   * Returns a function that can be used as an event callback
   */
  createFileEditHandler(): (filePath: string) => Promise<HookExecutionResult[]> {
    return async (filePath: string) => {
      return this.onFileSaved(filePath);
    };
  }

  /**
   * Create an IDE event handler for message events
   */
  createMessageHandler(): (message: string) => Promise<HookExecutionResult[]> {
    return async (message: string) => {
      return this.onMessageSent(message);
    };
  }

  /**
   * Create an IDE event handler for session events
   */
  createSessionHandler(): (sessionId: string) => Promise<HookExecutionResult[]> {
    return async (sessionId: string) => {
      return this.onSessionCreated(sessionId);
    };
  }

  /**
   * Create an IDE event handler for execution complete events
   */
  createExecutionCompleteHandler(): () => Promise<HookExecutionResult[]> {
    return async () => {
      return this.onExecutionComplete();
    };
  }

  /**
   * Get hooks that would be triggered by a specific event
   * Useful for previewing which hooks will run before triggering
   */
  getMatchingHooks(context: HookEventContext): Hook[] {
    const registrations = this.configManager.getHooksForEvent(context.event);
    return registrations
      .filter(reg => this.shouldExecuteHook(reg, context))
      .map(reg => reg.hook);
  }

  /**
   * Validate that a hook can be executed
   * Returns validation errors if any
   */
  validateHookExecution(hookId: string): { valid: boolean; errors: string[] } {
    const registration = this.configManager.getRegistration(hookId);
    const errors: string[] = [];

    if (!registration) {
      errors.push('Hook not found');
      return { valid: false, errors };
    }

    if (registration.status === 'inactive') {
      errors.push('Hook is disabled');
    }

    if (registration.status === 'error') {
      errors.push(`Hook is in error state: ${registration.lastError || 'Unknown error'}`);
    }

    const { hook } = registration;

    if (hook.action.type === 'message' && !this.messageHandler) {
      errors.push('No message handler configured for message actions');
    }

    if (hook.action.type === 'command' && !hook.action.target) {
      errors.push('Command action has no target command');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Reset a hook from error state back to active
   */
  resetHookError(hookId: string): boolean {
    const registration = this.configManager.getRegistration(hookId);
    if (!registration) {
      return false;
    }

    if (registration.status === 'error') {
      this.configManager.updateHookStatus(hookId, registration.hook.enabled ? 'active' : 'inactive');
      return true;
    }

    return false;
  }

  /**
   * Get statistics about hook executions
   */
  getExecutionStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    hookStats: Map<string, { executions: number; successes: number; failures: number; avgDuration: number }>;
  } {
    const hookStats = new Map<string, { executions: number; successes: number; failures: number; totalDuration: number }>();
    
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let totalDuration = 0;

    for (const entry of this.executionLog) {
      totalExecutions++;
      totalDuration += entry.duration;
      
      if (entry.success) {
        successfulExecutions++;
      } else {
        failedExecutions++;
      }

      const existing = hookStats.get(entry.hookId) || { executions: 0, successes: 0, failures: 0, totalDuration: 0 };
      existing.executions++;
      existing.totalDuration += entry.duration;
      if (entry.success) {
        existing.successes++;
      } else {
        existing.failures++;
      }
      hookStats.set(entry.hookId, existing);
    }

    // Convert to final format with average duration
    const finalHookStats = new Map<string, { executions: number; successes: number; failures: number; avgDuration: number }>();
    for (const [hookId, stats] of hookStats) {
      finalHookStats.set(hookId, {
        executions: stats.executions,
        successes: stats.successes,
        failures: stats.failures,
        avgDuration: stats.executions > 0 ? stats.totalDuration / stats.executions : 0,
      });
    }

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageDuration: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
      hookStats: finalHookStats,
    };
  }
}
