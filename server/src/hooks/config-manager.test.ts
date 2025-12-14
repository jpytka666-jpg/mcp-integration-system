/**
 * Tests for Hook Configuration Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { HookConfigManager } from './config-manager.js';
import { Hook, HookConfigFile, HookTrigger, HookAction } from './types.js';

describe('HookConfigManager', () => {
  const testWorkspace = '.test-kiro-hooks';
  let manager: HookConfigManager;

  beforeEach(() => {
    manager = new HookConfigManager(testWorkspace);
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

  describe('validateConfig', () => {
    it('should validate a valid configuration', () => {
      const config: HookConfigFile = {
        hooks: [
          {
            id: 'hook-1',
            name: 'Test Hook',
            description: 'A test hook',
            enabled: true,
            trigger: { event: 'file_saved', filePattern: '*.ts' },
            action: { type: 'message', target: 'Run tests' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        version: '1.0.0',
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid root configuration', () => {
      const result = manager.validateConfig(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_ROOT');
    });

    it('should reject missing hooks array', () => {
      const result = manager.validateConfig({ version: '1.0.0' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_HOOKS');
    });

    it('should warn on empty hooks array', () => {
      const result = manager.validateConfig({ hooks: [], version: '1.0.0' });
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'EMPTY_HOOKS')).toBe(true);
    });

    it('should reject duplicate hook IDs', () => {
      const config = {
        hooks: [
          {
            id: 'same-id',
            name: 'Hook 1',
            trigger: { event: 'file_saved' },
            action: { type: 'message', target: 'test' },
          },
          {
            id: 'same-id',
            name: 'Hook 2',
            trigger: { event: 'manual' },
            action: { type: 'command', target: 'echo test' },
          },
        ],
        version: '1.0.0',
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_ID')).toBe(true);
    });

    it('should reject invalid trigger event', () => {
      const config = {
        hooks: [
          {
            id: 'hook-1',
            name: 'Test',
            trigger: { event: 'invalid_event' },
            action: { type: 'message', target: 'test' },
          },
        ],
        version: '1.0.0',
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_TRIGGER_EVENT')).toBe(true);
    });

    it('should reject invalid action type', () => {
      const config = {
        hooks: [
          {
            id: 'hook-1',
            name: 'Test',
            trigger: { event: 'file_saved' },
            action: { type: 'invalid_type', target: 'test' },
          },
        ],
        version: '1.0.0',
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_ACTION_TYPE')).toBe(true);
    });

    it('should warn on disabled hooks', () => {
      const config = {
        hooks: [
          {
            id: 'hook-1',
            name: 'Test',
            enabled: false,
            trigger: { event: 'file_saved' },
            action: { type: 'message', target: 'test' },
          },
        ],
        version: '1.0.0',
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'HOOK_DISABLED')).toBe(true);
    });

    it('should warn on missing filePattern for file_saved events', () => {
      const config = {
        hooks: [
          {
            id: 'hook-1',
            name: 'Test',
            description: 'Test hook',
            trigger: { event: 'file_saved' },
            action: { type: 'message', target: 'test' },
          },
        ],
        version: '1.0.0',
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'MISSING_FILE_PATTERN')).toBe(true);
    });
  });

  describe('saveConfig and loadConfig', () => {
    it('should save and load configuration', () => {
      const config: HookConfigFile = {
        hooks: [
          {
            id: 'hook-1',
            name: 'Test Hook',
            description: 'A test hook',
            enabled: true,
            trigger: { event: 'file_saved', filePattern: '*.ts' },
            action: { type: 'message', target: 'Run tests' },
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        ],
        version: '1.0.0',
      };

      const saveResult = manager.saveConfig(config);
      expect(saveResult.valid).toBe(true);

      const loaded = manager.loadConfig();
      expect(loaded).not.toBeNull();
      expect(loaded?.hooks).toHaveLength(1);
      expect(loaded?.hooks[0].id).toBe('hook-1');
    });

    it('should return null when config file does not exist', () => {
      const loaded = manager.loadConfig();
      expect(loaded).toBeNull();
    });

    it('should not save invalid configuration', () => {
      const invalidConfig = { hooks: 'not-an-array' } as unknown as HookConfigFile;
      const result = manager.saveConfig(invalidConfig);
      expect(result.valid).toBe(false);
    });
  });

  describe('hook registration', () => {
    const createTestHook = (id: string, event: string = 'file_saved'): Hook => ({
      id,
      name: `Test Hook ${id}`,
      enabled: true,
      trigger: { event: event as Hook['trigger']['event'] },
      action: { type: 'message', target: 'test' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should register a hook', () => {
      const hook = createTestHook('hook-1');
      const registration = manager.registerHook(hook);

      expect(registration.hook.id).toBe('hook-1');
      expect(registration.status).toBe('active');
      expect(registration.executionCount).toBe(0);
    });

    it('should register disabled hook as inactive', () => {
      const hook = { ...createTestHook('hook-1'), enabled: false };
      const registration = manager.registerHook(hook);

      expect(registration.status).toBe('inactive');
    });

    it('should unregister a hook', () => {
      const hook = createTestHook('hook-1');
      manager.registerHook(hook);

      const result = manager.unregisterHook('hook-1');
      expect(result).toBe(true);
      expect(manager.getRegistration('hook-1')).toBeUndefined();
    });

    it('should get hooks for specific event', () => {
      manager.registerHook(createTestHook('hook-1', 'file_saved'));
      manager.registerHook(createTestHook('hook-2', 'manual'));
      manager.registerHook(createTestHook('hook-3', 'file_saved'));

      const fileSavedHooks = manager.getHooksForEvent('file_saved');
      expect(fileSavedHooks).toHaveLength(2);
    });

    it('should record execution', () => {
      const hook = createTestHook('hook-1');
      manager.registerHook(hook);

      manager.recordExecution('hook-1', true);
      const registration = manager.getRegistration('hook-1');

      expect(registration?.executionCount).toBe(1);
      expect(registration?.lastExecuted).toBeDefined();
    });

    it('should update status on failed execution', () => {
      const hook = createTestHook('hook-1');
      manager.registerHook(hook);

      manager.recordExecution('hook-1', false, 'Command failed');
      const registration = manager.getRegistration('hook-1');

      expect(registration?.status).toBe('error');
      expect(registration?.lastError).toBe('Command failed');
    });
  });

  describe('hook CRUD operations', () => {
    it('should create a hook with default values', () => {
      const trigger: HookTrigger = { event: 'file_saved', filePattern: '*.ts' };
      const action: HookAction = { type: 'message', target: 'Run tests' };

      const hook = manager.createHook('Test Hook', trigger, action, 'A test hook');

      expect(hook.id).toMatch(/^hook_\d+_[a-z0-9]+$/);
      expect(hook.name).toBe('Test Hook');
      expect(hook.enabled).toBe(true);
      expect(hook.trigger).toEqual(trigger);
      expect(hook.action).toEqual(action);
    });

    it('should add a hook to configuration', () => {
      const trigger: HookTrigger = { event: 'file_saved', filePattern: '*.ts' };
      const action: HookAction = { type: 'message', target: 'Run tests' };
      const hook = manager.createHook('Test Hook', trigger, action, 'A test hook');

      const result = manager.addHook(hook);
      expect(result.valid).toBe(true);

      const config = manager.loadConfig();
      expect(config?.hooks).toHaveLength(1);
    });

    it('should remove a hook from configuration', () => {
      const trigger: HookTrigger = { event: 'file_saved' };
      const action: HookAction = { type: 'message', target: 'test' };
      const hook = manager.createHook('Test', trigger, action, 'Test');
      manager.addHook(hook);

      const result = manager.removeHook(hook.id);
      expect(result).toBe(true);

      const config = manager.loadConfig();
      expect(config?.hooks).toHaveLength(0);
    });

    it('should update an existing hook', () => {
      const trigger: HookTrigger = { event: 'file_saved' };
      const action: HookAction = { type: 'message', target: 'test' };
      const hook = manager.createHook('Original', trigger, action, 'Original');
      manager.addHook(hook);

      const result = manager.updateHook(hook.id, { name: 'Updated' });
      expect(result.valid).toBe(true);

      const config = manager.loadConfig();
      expect(config?.hooks[0].name).toBe('Updated');
    });

    it('should enable/disable a hook', () => {
      const trigger: HookTrigger = { event: 'file_saved' };
      const action: HookAction = { type: 'message', target: 'test' };
      const hook = manager.createHook('Test', trigger, action, 'Test');
      manager.addHook(hook);

      manager.setHookEnabled(hook.id, false);
      let config = manager.loadConfig();
      expect(config?.hooks[0].enabled).toBe(false);

      manager.setHookEnabled(hook.id, true);
      config = manager.loadConfig();
      expect(config?.hooks[0].enabled).toBe(true);
    });
  });

  describe('loadAndRegisterHooks', () => {
    it('should load and register all hooks from config', () => {
      const config: HookConfigFile = {
        hooks: [
          {
            id: 'hook-1',
            name: 'Hook 1',
            enabled: true,
            trigger: { event: 'file_saved' },
            action: { type: 'message', target: 'test' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'hook-2',
            name: 'Hook 2',
            enabled: true,
            trigger: { event: 'manual' },
            action: { type: 'command', target: 'echo test' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        version: '1.0.0',
      };

      manager.saveConfig(config);
      const registrations = manager.loadAndRegisterHooks();

      expect(registrations).toHaveLength(2);
      expect(manager.getAllRegistrations()).toHaveLength(2);
    });

    it('should return empty array when no config exists', () => {
      const registrations = manager.loadAndRegisterHooks();
      expect(registrations).toHaveLength(0);
    });
  });

  describe('validateKiroHookFile', () => {
    it('should validate a valid Kiro hook file', () => {
      const kiroHook = {
        enabled: true,
        name: 'Test Hook',
        description: 'A test hook',
        version: '1',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Review this file',
        },
      };

      const result = manager.validateKiroHookFile(kiroHook);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid JSON structure', () => {
      const result = manager.validateKiroHookFile(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_JSON');
    });

    it('should reject missing name', () => {
      const kiroHook = {
        when: { type: 'manual' },
        then: { type: 'askAgent', prompt: 'test' },
      };

      const result = manager.validateKiroHookFile(kiroHook);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_NAME')).toBe(true);
    });

    it('should reject invalid when type', () => {
      const kiroHook = {
        name: 'Test',
        when: { type: 'invalidType' },
        then: { type: 'askAgent', prompt: 'test' },
      };

      const result = manager.validateKiroHookFile(kiroHook);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_WHEN_TYPE')).toBe(true);
    });

    it('should reject invalid then type', () => {
      const kiroHook = {
        name: 'Test',
        when: { type: 'manual' },
        then: { type: 'invalidAction' },
      };

      const result = manager.validateKiroHookFile(kiroHook);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_THEN_TYPE')).toBe(true);
    });

    it('should reject askAgent without prompt', () => {
      const kiroHook = {
        name: 'Test',
        when: { type: 'manual' },
        then: { type: 'askAgent' },
      };

      const result = manager.validateKiroHookFile(kiroHook);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_PROMPT')).toBe(true);
    });

    it('should reject runCommand without command', () => {
      const kiroHook = {
        name: 'Test',
        when: { type: 'manual' },
        then: { type: 'runCommand' },
      };

      const result = manager.validateKiroHookFile(kiroHook);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_COMMAND')).toBe(true);
    });

    it('should warn on disabled hooks', () => {
      const kiroHook = {
        enabled: false,
        name: 'Test',
        description: 'Test',
        version: '1',
        when: { type: 'manual' },
        then: { type: 'askAgent', prompt: 'test' },
      };

      const result = manager.validateKiroHookFile(kiroHook);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'HOOK_DISABLED')).toBe(true);
    });

    it('should warn on missing description', () => {
      const kiroHook = {
        name: 'Test',
        version: '1',
        when: { type: 'manual' },
        then: { type: 'askAgent', prompt: 'test' },
      };

      const result = manager.validateKiroHookFile(kiroHook);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'MISSING_DESCRIPTION')).toBe(true);
    });

    it('should warn on empty patterns for fileEdited', () => {
      const kiroHook = {
        name: 'Test',
        description: 'Test',
        version: '1',
        when: { type: 'fileEdited' },
        then: { type: 'askAgent', prompt: 'test' },
      };

      const result = manager.validateKiroHookFile(kiroHook);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'EMPTY_PATTERNS')).toBe(true);
    });
  });

  describe('listHooksDirectory', () => {
    it('should return empty listing when directory does not exist', () => {
      const listing = manager.listHooksDirectory();
      expect(listing.hooks).toHaveLength(0);
      expect(listing.errors).toHaveLength(0);
    });

    it('should list valid hook files', () => {
      manager.ensureHooksDirectory();
      const hooksDir = manager.getHooksDirectory();
      
      const validHook = {
        enabled: true,
        name: 'Test Hook',
        description: 'A test hook',
        version: '1',
        when: { type: 'manual' },
        then: { type: 'askAgent', prompt: 'test' },
      };
      
      fs.writeFileSync(
        path.join(hooksDir, 'test-hook.kiro.hook'),
        JSON.stringify(validHook, null, 2)
      );

      const listing = manager.listHooksDirectory();
      expect(listing.hooks).toHaveLength(1);
      expect(listing.hooks[0].valid).toBe(true);
      expect(listing.hooks[0].hook).not.toBeNull();
    });

    it('should report invalid hook files', () => {
      manager.ensureHooksDirectory();
      const hooksDir = manager.getHooksDirectory();
      
      const invalidHook = {
        // Missing required fields
        enabled: true,
      };
      
      fs.writeFileSync(
        path.join(hooksDir, 'invalid-hook.kiro.hook'),
        JSON.stringify(invalidHook, null, 2)
      );

      const listing = manager.listHooksDirectory();
      expect(listing.hooks).toHaveLength(1);
      expect(listing.hooks[0].valid).toBe(false);
      expect(listing.hooks[0].errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON files', () => {
      manager.ensureHooksDirectory();
      const hooksDir = manager.getHooksDirectory();
      
      fs.writeFileSync(
        path.join(hooksDir, 'malformed.kiro.hook'),
        'not valid json {'
      );

      const listing = manager.listHooksDirectory();
      expect(listing.hooks).toHaveLength(1);
      expect(listing.hooks[0].valid).toBe(false);
      expect(listing.errors).toHaveLength(1);
    });
  });

  describe('hook file operations', () => {
    it('should get hook by file name', () => {
      manager.ensureHooksDirectory();
      const hooksDir = manager.getHooksDirectory();
      
      const validHook = {
        enabled: true,
        name: 'Test Hook',
        description: 'A test hook',
        version: '1',
        when: { type: 'manual' },
        then: { type: 'askAgent', prompt: 'test' },
      };
      
      fs.writeFileSync(
        path.join(hooksDir, 'test-hook.kiro.hook'),
        JSON.stringify(validHook, null, 2)
      );

      const hook = manager.getHookByFileName('test-hook.kiro.hook');
      expect(hook).not.toBeNull();
      expect(hook?.name).toBe('Test Hook');
    });

    it('should return null for non-existent hook file', () => {
      const hook = manager.getHookByFileName('non-existent.kiro.hook');
      expect(hook).toBeNull();
    });

    it('should delete hook file', () => {
      manager.ensureHooksDirectory();
      const hooksDir = manager.getHooksDirectory();
      
      const validHook = {
        enabled: true,
        name: 'Test Hook',
        version: '1',
        when: { type: 'manual' },
        then: { type: 'askAgent', prompt: 'test' },
      };
      
      fs.writeFileSync(
        path.join(hooksDir, 'to-delete.kiro.hook'),
        JSON.stringify(validHook, null, 2)
      );

      const result = manager.deleteHookFile('to-delete.kiro.hook');
      expect(result).toBe(true);
      expect(fs.existsSync(path.join(hooksDir, 'to-delete.kiro.hook'))).toBe(false);
    });

    it('should return false when deleting non-existent file', () => {
      const result = manager.deleteHookFile('non-existent.kiro.hook');
      expect(result).toBe(false);
    });

    it('should check if hooks directory exists', () => {
      expect(manager.hooksDirectoryExists()).toBe(false);
      manager.ensureHooksDirectory();
      expect(manager.hooksDirectoryExists()).toBe(true);
    });

    it('should get hook count', () => {
      expect(manager.getHookCount()).toBe(0);
      
      manager.ensureHooksDirectory();
      const hooksDir = manager.getHooksDirectory();
      
      fs.writeFileSync(
        path.join(hooksDir, 'hook1.kiro.hook'),
        JSON.stringify({ name: 'Hook 1', when: { type: 'manual' }, then: { type: 'askAgent', prompt: 'test' } })
      );
      fs.writeFileSync(
        path.join(hooksDir, 'hook2.kiro.hook'),
        JSON.stringify({ name: 'Hook 2', when: { type: 'manual' }, then: { type: 'askAgent', prompt: 'test' } })
      );

      expect(manager.getHookCount()).toBe(2);
    });
  });
});
