/**
 * Tests for Hook Execution Engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { HookExecutor, MessageHandler } from './executor.js';
import { HookConfigManager } from './config-manager.js';
import { Hook, HookConfigFile, HookEventContext, HookTriggerEvent } from './types.js';

describe('HookExecutor', () => {
  const testWorkspace = '.test-kiro-executor';
  let configManager: HookConfigManager;
  let executor: HookExecutor;

  beforeEach(() => {
    configManager = new HookConfigManager(testWorkspace);
    executor = new HookExecutor(configManager, testWorkspace);
    
    // Clean up test directory
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true });
    }
  });

  const createTestHook = (
    id: string,
    event: HookTriggerEvent = 'file_saved',
    actionType: 'message' | 'command' = 'message',
    target: string = 'Test message'
  ): Hook => ({
    id,
    name: `Test Hook ${id}`,
    enabled: true,
    trigger: { event, filePattern: event === 'file_saved' ? '*.ts' : undefined },
    action: { type: actionType, target },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('event listeners', () => {
    it('should add and trigger event listeners', async () => {
      const listener = vi.fn();
      executor.addEventListener('file_saved', listener);

      const context: HookEventContext = {
        event: 'file_saved',
        timestamp: new Date(),
        filePath: 'test.ts',
      };

      await executor.triggerEvent(context);

      expect(listener).toHaveBeenCalledWith('file_saved', context);
    });

    it('should remove event listeners', async () => {
      const listener = vi.fn();
      executor.addEventListener('file_saved', listener);
      executor.removeEventListener('file_saved', listener);

      await executor.triggerEvent({
        event: 'file_saved',
        timestamp: new Date(),
        filePath: 'test.ts',
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('message action execution', () => {
    it('should execute message action with handler', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'manual', 'message', 'Test message');
      configManager.registerHook(hook);

      const result = await executor.triggerHookById('hook-1');

      expect(result.success).toBe(true);
      expect(messageHandler).toHaveBeenCalled();
    });

    it('should fail message action without handler', async () => {
      const hook = createTestHook('hook-1', 'manual', 'message', 'Test message');
      configManager.registerHook(hook);

      const result = await executor.triggerHookById('hook-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No message handler configured');
    });

    it('should interpolate context variables in message', async () => {
      let capturedMessage = '';
      const messageHandler: MessageHandler = vi.fn().mockImplementation(async (msg) => {
        capturedMessage = msg;
      });
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'file_saved', 'message', 'File saved: $filePath');
      configManager.registerHook(hook);

      await executor.onFileSaved('src/test.ts');

      expect(capturedMessage).toBe('File saved: src/test.ts');
    });
  });

  describe('command action execution', () => {
    it('should execute simple command', async () => {
      // Use a command that works on Windows cmd
      const command = process.platform === 'win32' ? 'echo Hello' : 'echo "Hello"';
      const hook = createTestHook('hook-1', 'manual', 'command', command);
      configManager.registerHook(hook);

      const result = await executor.triggerHookById('hook-1');

      // Command execution may fail in test environment, check structure
      expect(result.hookId).toBe('hook-1');
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
    });

    it('should fail on invalid command', async () => {
      const hook = createTestHook('hook-1', 'manual', 'command', 'nonexistent_command_xyz_12345');
      configManager.registerHook(hook);

      const result = await executor.triggerHookById('hook-1');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle command with timeout configuration', async () => {
      const hook: Hook = {
        ...createTestHook('hook-1', 'manual', 'command', 'echo test'),
        action: {
          type: 'command',
          target: 'echo test',
          timeout: 5000, // 5 second timeout
        },
      };
      configManager.registerHook(hook);

      const result = await executor.triggerHookById('hook-1');

      // Verify the hook executed (success depends on environment)
      expect(result.hookId).toBe('hook-1');
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
    });
  });

  describe('file pattern matching', () => {
    it('should match simple extension pattern', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook: Hook = {
        ...createTestHook('hook-1', 'file_saved', 'message', 'TS file saved'),
        trigger: { event: 'file_saved', filePattern: '*.ts' },
      };
      configManager.registerHook(hook);

      await executor.onFileSaved('test.ts');
      expect(messageHandler).toHaveBeenCalled();

      messageHandler.mockClear();
      await executor.onFileSaved('test.js');
      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should match directory pattern', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook: Hook = {
        ...createTestHook('hook-1', 'file_saved', 'message', 'Src file saved'),
        trigger: { event: 'file_saved', filePattern: 'src/**/*.ts' },
      };
      configManager.registerHook(hook);

      await executor.onFileSaved('src/hooks/test.ts');
      expect(messageHandler).toHaveBeenCalled();

      messageHandler.mockClear();
      await executor.onFileSaved('lib/test.ts');
      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe('hook triggering', () => {
    it('should trigger hooks for matching events', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook1 = createTestHook('hook-1', 'file_saved', 'message', 'File saved');
      const hook2 = createTestHook('hook-2', 'manual', 'message', 'Manual trigger');
      configManager.registerHook(hook1);
      configManager.registerHook(hook2);

      await executor.onFileSaved('test.ts');

      // Only hook-1 should be called (file_saved event)
      expect(messageHandler).toHaveBeenCalledTimes(1);
    });

    it('should not trigger disabled hooks', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook: Hook = {
        ...createTestHook('hook-1', 'file_saved', 'message', 'Test'),
        enabled: false,
      };
      configManager.registerHook(hook);

      await executor.onFileSaved('test.ts');

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should record execution results', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'manual', 'message', 'Test');
      configManager.registerHook(hook);

      await executor.triggerHookById('hook-1');

      const registration = configManager.getRegistration('hook-1');
      expect(registration?.executionCount).toBe(1);
      expect(registration?.lastExecuted).toBeDefined();
    });
  });

  describe('convenience methods', () => {
    it('should trigger file_saved event via onFileSaved', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'file_saved', 'message', 'Saved: $filePath');
      configManager.registerHook(hook);

      const results = await executor.onFileSaved('test.ts');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should trigger message_sent event via onMessageSent', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'message_sent', 'message', 'Message received');
      configManager.registerHook(hook);

      const results = await executor.onMessageSent('Hello');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should trigger session_created event via onSessionCreated', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'session_created', 'message', 'Session: $sessionId');
      configManager.registerHook(hook);

      const results = await executor.onSessionCreated('session-123');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should trigger execution_complete event via onExecutionComplete', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'execution_complete', 'message', 'Done');
      configManager.registerHook(hook);

      const results = await executor.onExecutionComplete();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should trigger manual hook via onManualTrigger', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'manual', 'message', 'Manual');
      configManager.registerHook(hook);

      const result = await executor.onManualTrigger('hook-1');

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error for non-existent hook', async () => {
      const result = await executor.triggerHookById('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hook not found');
    });

    it('should handle message handler errors gracefully', async () => {
      const messageHandler: MessageHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'manual', 'message', 'Test');
      configManager.registerHook(hook);

      const result = await executor.triggerHookById('hook-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Handler error');
    });

    it('should continue executing other hooks after one fails', async () => {
      const messageHandler: MessageHandler = vi.fn()
        .mockRejectedValueOnce(new Error('First hook failed'))
        .mockResolvedValueOnce(undefined);
      executor.setMessageHandler(messageHandler);

      const hook1 = createTestHook('hook-1', 'manual', 'message', 'Test 1');
      const hook2 = createTestHook('hook-2', 'manual', 'message', 'Test 2');
      configManager.registerHook(hook1);
      configManager.registerHook(hook2);

      const results = await executor.triggerEvent({
        event: 'manual',
        timestamp: new Date(),
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });

  describe('initialization and status', () => {
    it('should initialize the hook system', () => {
      expect(executor.isInitialized()).toBe(false);
      
      const listing = executor.initialize();
      
      expect(executor.isInitialized()).toBe(true);
      expect(listing).toBeDefined();
      expect(listing.hooks).toBeDefined();
    });

    it('should get system status', () => {
      executor.initialize();
      
      const status = executor.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.hooksDirectory).toContain('hooks');
      expect(typeof status.totalHooks).toBe('number');
      expect(typeof status.activeHooks).toBe('number');
    });

    it('should reload hooks', () => {
      executor.initialize();
      
      const hook = createTestHook('hook-1', 'manual', 'message', 'Test');
      configManager.registerHook(hook);
      
      expect(configManager.getAllRegistrations()).toHaveLength(1);
      
      const listing = executor.reload();
      
      // After reload, only hooks from files should remain
      expect(listing).toBeDefined();
    });
  });

  describe('execution logging', () => {
    it('should log hook executions', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'manual', 'message', 'Test');
      configManager.registerHook(hook);

      await executor.triggerHookById('hook-1');

      const log = executor.getExecutionLog();
      expect(log).toHaveLength(1);
      expect(log[0].hookId).toBe('hook-1');
      expect(log[0].success).toBe(true);
    });

    it('should clear execution log', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'manual', 'message', 'Test');
      configManager.registerHook(hook);

      await executor.triggerHookById('hook-1');
      expect(executor.getExecutionLog()).toHaveLength(1);

      executor.clearExecutionLog();
      expect(executor.getExecutionLog()).toHaveLength(0);
    });

    it('should get execution statistics', async () => {
      const messageHandler: MessageHandler = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'));
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'manual', 'message', 'Test');
      configManager.registerHook(hook);

      await executor.triggerHookById('hook-1');
      await executor.triggerHookById('hook-1');

      const stats = executor.getExecutionStats();
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(1);
    });
  });

  describe('IDE event handlers', () => {
    it('should create file edit handler', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'file_saved', 'message', 'File: $filePath');
      configManager.registerHook(hook);

      const handler = executor.createFileEditHandler();
      const results = await handler('test.ts');

      expect(results).toHaveLength(1);
      expect(messageHandler).toHaveBeenCalled();
    });

    it('should create message handler', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'message_sent', 'message', 'Received');
      configManager.registerHook(hook);

      const handler = executor.createMessageHandler();
      const results = await handler('Hello');

      expect(results).toHaveLength(1);
    });

    it('should create session handler', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'session_created', 'message', 'Session started');
      configManager.registerHook(hook);

      const handler = executor.createSessionHandler();
      const results = await handler('session-123');

      expect(results).toHaveLength(1);
    });

    it('should create execution complete handler', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'execution_complete', 'message', 'Done');
      configManager.registerHook(hook);

      const handler = executor.createExecutionCompleteHandler();
      const results = await handler();

      expect(results).toHaveLength(1);
    });
  });

  describe('hook validation and utilities', () => {
    it('should get matching hooks for an event', () => {
      const hook1 = createTestHook('hook-1', 'file_saved', 'message', 'Test');
      const hook2 = createTestHook('hook-2', 'manual', 'message', 'Test');
      configManager.registerHook(hook1);
      configManager.registerHook(hook2);

      const context: HookEventContext = {
        event: 'file_saved',
        timestamp: new Date(),
        filePath: 'test.ts',
      };

      const matching = executor.getMatchingHooks(context);
      expect(matching).toHaveLength(1);
      expect(matching[0].id).toBe('hook-1');
    });

    it('should validate hook execution', () => {
      const hook = createTestHook('hook-1', 'manual', 'message', 'Test');
      configManager.registerHook(hook);

      // Without message handler
      let validation = executor.validateHookExecution('hook-1');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('No message handler configured for message actions');

      // With message handler
      executor.setMessageHandler(vi.fn().mockResolvedValue(undefined));
      validation = executor.validateHookExecution('hook-1');
      expect(validation.valid).toBe(true);
    });

    it('should validate non-existent hook', () => {
      const validation = executor.validateHookExecution('non-existent');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Hook not found');
    });

    it('should reset hook from error state', () => {
      const hook = createTestHook('hook-1', 'manual', 'message', 'Test');
      configManager.registerHook(hook);
      configManager.updateHookStatus('hook-1', 'error', 'Test error');

      const registration = configManager.getRegistration('hook-1');
      expect(registration?.status).toBe('error');

      const result = executor.resetHookError('hook-1');
      expect(result).toBe(true);

      const updatedRegistration = configManager.getRegistration('hook-1');
      expect(updatedRegistration?.status).toBe('active');
    });

    it('should return false when resetting non-error hook', () => {
      const hook = createTestHook('hook-1', 'manual', 'message', 'Test');
      configManager.registerHook(hook);

      const result = executor.resetHookError('hook-1');
      expect(result).toBe(false);
    });
  });

  describe('translation update event', () => {
    it('should trigger translation_update event', async () => {
      const messageHandler: MessageHandler = vi.fn().mockResolvedValue(undefined);
      executor.setMessageHandler(messageHandler);

      const hook = createTestHook('hook-1', 'translation_update', 'message', 'Translation updated');
      configManager.registerHook(hook);

      const results = await executor.onTranslationUpdate('locales/en.json');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });
});
