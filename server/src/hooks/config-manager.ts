/**
 * Hook Configuration Manager
 * Handles hook registration, validation, and lifecycle management
 * Implements Requirements 6.1, 6.2
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Hook,
  HookConfigFile,
  HookTrigger,
  HookAction,
  HookTriggerEvent,
  HookActionType,
  HookValidationResult,
  HookValidationError,
  HookValidationWarning,
  HookRegistration,
  HookStatus,
  KiroHookFile,
  KiroHookValidationResult,
  KiroHookValidationError,
  KiroHookValidationWarning,
  HookDirectoryListing,
  HookFileInfo,
  HookLoadError,
} from './types.js';

const VALID_TRIGGER_EVENTS: HookTriggerEvent[] = [
  'message_sent',
  'execution_complete',
  'session_created',
  'file_saved',
  'manual',
  'translation_update',
];

const VALID_ACTION_TYPES: HookActionType[] = ['message', 'command'];

export class HookConfigManager {
  private workspacePath: string;
  private registrations: Map<string, HookRegistration> = new Map();

  constructor(workspacePath: string = '.kiro') {
    this.workspacePath = workspacePath;
  }

  /**
   * Get the hooks configuration file path (JSON format)
   */
  getConfigPath(): string {
    return path.join(this.workspacePath, 'settings', 'hooks.json');
  }

  /**
   * Get the hooks directory path (Markdown format for Kiro IDE)
   */
  getHooksDirectory(): string {
    return path.join(this.workspacePath, 'hooks');
  }

  /**
   * Ensure hooks directory exists
   */
  ensureHooksDirectory(): void {
    const hooksDir = this.getHooksDirectory();
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }
  }

  /**
   * Save hook as Kiro IDE format (.kiro.hook JSON file)
   */
  saveHookAsKiroFormat(hook: Hook): void {
    this.ensureHooksDirectory();
    const fileName = this.generateHookFileName(hook.name);
    const filePath = path.join(this.getHooksDirectory(), fileName);
    
    const content = this.hookToKiroFormat(hook);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
  }

  /**
   * Generate a safe file name from hook name (Kiro IDE format)
   */
  private generateHookFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.kiro.hook';
  }

  /**
   * Convert hook to Kiro IDE JSON format
   */
  private hookToKiroFormat(hook: Hook): KiroHookFile {
    // Map internal event types to Kiro IDE format
    const whenType = this.mapEventToKiroWhenType(hook.trigger.event);
    const thenType = hook.action.type === 'message' ? 'askAgent' : 'runCommand';

    return {
      enabled: hook.enabled,
      name: hook.name,
      description: hook.description || '',
      version: '1',
      when: {
        type: whenType,
        patterns: hook.trigger.filePattern ? [hook.trigger.filePattern] : undefined,
      },
      then: {
        type: thenType,
        prompt: hook.action.type === 'message' ? hook.action.target : undefined,
        command: hook.action.type === 'command' ? hook.action.target : undefined,
      },
    };
  }

  /**
   * Map internal event type to Kiro IDE when type
   */
  private mapEventToKiroWhenType(event: HookTriggerEvent): string {
    const mapping: Record<HookTriggerEvent, string> = {
      'file_saved': 'fileEdited',
      'message_sent': 'messageSent',
      'execution_complete': 'executionComplete',
      'session_created': 'sessionCreated',
      'manual': 'manual',
      'translation_update': 'fileEdited',
    };
    return mapping[event] || 'manual';
  }

  /**
   * Map Kiro IDE when type to internal event type
   */
  private mapKiroWhenTypeToEvent(whenType: string): HookTriggerEvent {
    const mapping: Record<string, HookTriggerEvent> = {
      'fileEdited': 'file_saved',
      'messageSent': 'message_sent',
      'executionComplete': 'execution_complete',
      'sessionCreated': 'session_created',
      'manual': 'manual',
    };
    return mapping[whenType] || 'manual';
  }

  /**
   * Load hooks from .kiro.hook files in .kiro/hooks/
   */
  loadHooksFromKiroFormat(): Hook[] {
    const hooksDir = this.getHooksDirectory();
    if (!fs.existsSync(hooksDir)) {
      return [];
    }

    const hooks: Hook[] = [];
    const files = fs.readdirSync(hooksDir).filter(f => f.endsWith('.kiro.hook'));

    for (const file of files) {
      const filePath = path.join(hooksDir, file);
      const hook = this.parseKiroHookFile(filePath);
      if (hook) {
        hooks.push(hook);
      }
    }

    return hooks;
  }

  /**
   * Parse a Kiro IDE hook file (.kiro.hook)
   */
  private parseKiroHookFile(filePath: string): Hook | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const kiroHook = JSON.parse(content) as KiroHookFile;

      if (!kiroHook.name || !kiroHook.when) {
        return null;
      }

      const event = this.mapKiroWhenTypeToEvent(kiroHook.when.type);
      const actionType: HookActionType = kiroHook.then?.type === 'runCommand' ? 'command' : 'message';
      const actionTarget = kiroHook.then?.prompt || kiroHook.then?.command || '';

      const now = new Date();
      return {
        id: `hook_${path.basename(filePath, '.kiro.hook')}`,
        name: kiroHook.name,
        description: kiroHook.description,
        enabled: kiroHook.enabled !== false,
        trigger: {
          event,
          filePattern: kiroHook.when.patterns?.[0],
        },
        action: {
          type: actionType,
          target: actionTarget,
        },
        createdAt: now,
        updatedAt: now,
      };
    } catch {
      return null;
    }
  }

  /**
   * Validate a complete hook configuration file
   */
  validateConfig(config: unknown): HookValidationResult {
    const errors: HookValidationError[] = [];
    const warnings: HookValidationWarning[] = [];

    if (!config || typeof config !== 'object') {
      errors.push({
        path: 'root',
        message: 'Configuration must be a valid object',
        code: 'INVALID_ROOT',
      });
      return { valid: false, errors, warnings };
    }

    const configObj = config as Record<string, unknown>;

    if (!Array.isArray(configObj.hooks)) {
      errors.push({
        path: 'hooks',
        message: 'hooks must be an array',
        code: 'MISSING_HOOKS',
      });
      return { valid: false, errors, warnings };
    }

    if (configObj.hooks.length === 0) {
      warnings.push({
        path: 'hooks',
        message: 'hooks array is empty',
        code: 'EMPTY_HOOKS',
      });
    }

    const seenIds = new Set<string>();
    const hooks = configObj.hooks as unknown[];

    for (let i = 0; i < hooks.length; i++) {
      this.validateHook(hooks[i], `hooks[${i}]`, errors, warnings, seenIds);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate an individual hook configuration
   */
  private validateHook(
    hook: unknown,
    basePath: string,
    errors: HookValidationError[],
    warnings: HookValidationWarning[],
    seenIds: Set<string>
  ): void {
    if (!hook || typeof hook !== 'object') {
      errors.push({
        path: basePath,
        message: 'Hook must be an object',
        code: 'INVALID_HOOK',
      });
      return;
    }

    const hookObj = hook as Record<string, unknown>;

    // Validate id (required)
    if (!hookObj.id || typeof hookObj.id !== 'string') {
      errors.push({
        path: `${basePath}.id`,
        message: 'id is required and must be a string',
        code: 'MISSING_ID',
      });
    } else {
      if (seenIds.has(hookObj.id)) {
        errors.push({
          path: `${basePath}.id`,
          message: `Duplicate hook id: ${hookObj.id}`,
          code: 'DUPLICATE_ID',
        });
      }
      seenIds.add(hookObj.id);
    }

    // Validate name (required)
    if (!hookObj.name || typeof hookObj.name !== 'string') {
      errors.push({
        path: `${basePath}.name`,
        message: 'name is required and must be a string',
        code: 'MISSING_NAME',
      });
    }

    // Validate description (optional but recommended)
    if (!hookObj.description) {
      warnings.push({
        path: `${basePath}.description`,
        message: 'description is recommended for documentation',
        code: 'MISSING_DESCRIPTION',
      });
    }

    // Validate trigger (required)
    if (!hookObj.trigger || typeof hookObj.trigger !== 'object') {
      errors.push({
        path: `${basePath}.trigger`,
        message: 'trigger is required and must be an object',
        code: 'MISSING_TRIGGER',
      });
    } else {
      this.validateTrigger(hookObj.trigger, `${basePath}.trigger`, errors, warnings);
    }

    // Validate action (required)
    if (!hookObj.action || typeof hookObj.action !== 'object') {
      errors.push({
        path: `${basePath}.action`,
        message: 'action is required and must be an object',
        code: 'MISSING_ACTION',
      });
    } else {
      this.validateAction(hookObj.action, `${basePath}.action`, errors, warnings);
    }

    // Validate enabled (optional, defaults to true)
    if (hookObj.enabled === false) {
      warnings.push({
        path: `${basePath}.enabled`,
        message: 'Hook is disabled',
        code: 'HOOK_DISABLED',
      });
    }
  }

  /**
   * Validate hook trigger configuration
   */
  private validateTrigger(
    trigger: unknown,
    basePath: string,
    errors: HookValidationError[],
    warnings: HookValidationWarning[]
  ): void {
    const triggerObj = trigger as Record<string, unknown>;

    // Validate event (required)
    if (!triggerObj.event || typeof triggerObj.event !== 'string') {
      errors.push({
        path: `${basePath}.event`,
        message: 'event is required and must be a string',
        code: 'INVALID_TRIGGER_EVENT',
      });
    } else if (!VALID_TRIGGER_EVENTS.includes(triggerObj.event as HookTriggerEvent)) {
      errors.push({
        path: `${basePath}.event`,
        message: `Invalid trigger event: ${triggerObj.event}. Valid events: ${VALID_TRIGGER_EVENTS.join(', ')}`,
        code: 'INVALID_TRIGGER_EVENT',
      });
    }

    // Validate filePattern for file_saved events
    if (triggerObj.event === 'file_saved' && !triggerObj.filePattern) {
      warnings.push({
        path: `${basePath}.filePattern`,
        message: 'filePattern is recommended for file_saved events',
        code: 'MISSING_FILE_PATTERN',
      });
    }
  }

  /**
   * Validate hook action configuration
   */
  private validateAction(
    action: unknown,
    basePath: string,
    errors: HookValidationError[],
    _warnings: HookValidationWarning[]
  ): void {
    const actionObj = action as Record<string, unknown>;

    // Validate type (required)
    if (!actionObj.type || typeof actionObj.type !== 'string') {
      errors.push({
        path: `${basePath}.type`,
        message: 'type is required and must be a string',
        code: 'INVALID_ACTION_TYPE',
      });
    } else if (!VALID_ACTION_TYPES.includes(actionObj.type as HookActionType)) {
      errors.push({
        path: `${basePath}.type`,
        message: `Invalid action type: ${actionObj.type}. Valid types: ${VALID_ACTION_TYPES.join(', ')}`,
        code: 'INVALID_ACTION_TYPE',
      });
    }

    // Validate target (required)
    if (!actionObj.target || typeof actionObj.target !== 'string') {
      errors.push({
        path: `${basePath}.target`,
        message: 'target is required and must be a string',
        code: 'MISSING_ACTION_TARGET',
      });
    }
  }

  /**
   * Load hook configuration from file
   */
  loadConfig(): HookConfigFile | null {
    const configPath = this.getConfigPath();

    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as HookConfigFile;
    } catch {
      return null;
    }
  }

  /**
   * Save hook configuration to file
   */
  saveConfig(config: HookConfigFile): HookValidationResult {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return validation;
    }

    const configPath = this.getConfigPath();
    const settingsDir = path.dirname(configPath);

    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return validation;
  }

  /**
   * Register a hook for event triggering
   */
  registerHook(hook: Hook): HookRegistration {
    const registration: HookRegistration = {
      hook,
      status: hook.enabled ? 'active' : 'inactive',
      executionCount: 0,
    };

    this.registrations.set(hook.id, registration);
    return registration;
  }

  /**
   * Unregister a hook
   */
  unregisterHook(hookId: string): boolean {
    return this.registrations.delete(hookId);
  }

  /**
   * Get a hook registration by ID
   */
  getRegistration(hookId: string): HookRegistration | undefined {
    return this.registrations.get(hookId);
  }

  /**
   * Get all hook registrations
   */
  getAllRegistrations(): HookRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Get hooks registered for a specific event
   */
  getHooksForEvent(event: HookTriggerEvent): HookRegistration[] {
    return this.getAllRegistrations().filter(
      (reg) => reg.hook.trigger.event === event && reg.status === 'active'
    );
  }

  /**
   * Update hook status
   */
  updateHookStatus(hookId: string, status: HookStatus, error?: string): void {
    const registration = this.registrations.get(hookId);
    if (registration) {
      registration.status = status;
      if (error) {
        registration.lastError = error;
      }
    }
  }

  /**
   * Record hook execution
   */
  recordExecution(hookId: string, success: boolean, error?: string): void {
    const registration = this.registrations.get(hookId);
    if (registration) {
      registration.lastExecuted = new Date();
      registration.executionCount++;
      if (!success && error) {
        registration.lastError = error;
        registration.status = 'error';
      }
    }
  }

  /**
   * Load and register all hooks from configuration (JSON and Markdown)
   */
  loadAndRegisterHooks(): HookRegistration[] {
    const registrations: HookRegistration[] = [];
    
    // Load from JSON config
    const config = this.loadConfig();
    if (config) {
      for (const hook of config.hooks) {
        registrations.push(this.registerHook(hook));
      }
    }

    // Load from Kiro IDE format files (.kiro/hooks/*.kiro.hook)
    const kiroHooks = this.loadHooksFromKiroFormat();
    for (const hook of kiroHooks) {
      // Avoid duplicates by ID
      if (!this.registrations.has(hook.id)) {
        registrations.push(this.registerHook(hook));
      }
    }

    return registrations;
  }

  /**
   * Create a new hook with default values
   */
  createHook(
    name: string,
    trigger: HookTrigger,
    action: HookAction,
    description?: string
  ): Hook {
    const now = new Date();
    return {
      id: this.generateHookId(),
      name,
      description,
      enabled: true,
      trigger,
      action,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Generate a unique hook ID
   */
  private generateHookId(): string {
    return `hook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Add a hook to the configuration (saves to both JSON and Markdown)
   */
  addHook(hook: Hook): HookValidationResult {
    let config = this.loadConfig();
    if (!config) {
      config = { hooks: [], version: '1.0.0' };
    }

    config.hooks.push(hook);
    const result = this.saveConfig(config);

    if (result.valid) {
      this.registerHook(hook);
      // Also save as Kiro IDE format
      this.saveHookAsKiroFormat(hook);
    }

    return result;
  }

  /**
   * Remove a hook from the configuration
   */
  removeHook(hookId: string): boolean {
    const config = this.loadConfig();
    if (!config) {
      return false;
    }

    const index = config.hooks.findIndex((h) => h.id === hookId);
    if (index === -1) {
      return false;
    }

    config.hooks.splice(index, 1);
    const result = this.saveConfig(config);

    if (result.valid) {
      this.unregisterHook(hookId);
    }

    return result.valid;
  }

  /**
   * Update an existing hook
   */
  updateHook(hookId: string, updates: Partial<Hook>): HookValidationResult {
    const config = this.loadConfig();
    if (!config) {
      return {
        valid: false,
        errors: [{ path: 'config', message: 'Configuration not found', code: 'FILE_NOT_FOUND' }],
        warnings: [],
      };
    }

    const index = config.hooks.findIndex((h) => h.id === hookId);
    if (index === -1) {
      return {
        valid: false,
        errors: [{ path: `hooks.${hookId}`, message: 'Hook not found', code: 'INVALID_HOOK' }],
        warnings: [],
      };
    }

    config.hooks[index] = {
      ...config.hooks[index],
      ...updates,
      id: hookId, // Prevent ID changes
      updatedAt: new Date(),
    };

    const result = this.saveConfig(config);

    if (result.valid) {
      this.registerHook(config.hooks[index]);
    }

    return result;
  }

  /**
   * Enable or disable a hook
   */
  setHookEnabled(hookId: string, enabled: boolean): HookValidationResult {
    return this.updateHook(hookId, { enabled });
  }

  /**
   * Validate a Kiro hook file (.kiro.hook format)
   */
  validateKiroHookFile(content: unknown): KiroHookValidationResult {
    const errors: KiroHookValidationError[] = [];
    const warnings: KiroHookValidationWarning[] = [];

    if (!content || typeof content !== 'object') {
      errors.push({
        path: 'root',
        message: 'Hook file must be a valid JSON object',
        code: 'INVALID_JSON',
      });
      return { valid: false, errors, warnings };
    }

    const hookObj = content as Record<string, unknown>;

    // Validate name (required)
    if (!hookObj.name || typeof hookObj.name !== 'string' || hookObj.name.trim() === '') {
      errors.push({
        path: 'name',
        message: 'name is required and must be a non-empty string',
        code: 'MISSING_NAME',
      });
    }

    // Validate when (required)
    if (!hookObj.when || typeof hookObj.when !== 'object') {
      errors.push({
        path: 'when',
        message: 'when is required and must be an object',
        code: 'MISSING_WHEN',
      });
    } else {
      const when = hookObj.when as Record<string, unknown>;
      const validWhenTypes = ['fileEdited', 'messageSent', 'executionComplete', 'sessionCreated', 'manual'];
      if (!when.type || typeof when.type !== 'string' || !validWhenTypes.includes(when.type)) {
        errors.push({
          path: 'when.type',
          message: `when.type must be one of: ${validWhenTypes.join(', ')}`,
          code: 'INVALID_WHEN_TYPE',
        });
      }
      if (when.type === 'fileEdited' && (!when.patterns || !Array.isArray(when.patterns) || when.patterns.length === 0)) {
        warnings.push({
          path: 'when.patterns',
          message: 'patterns is recommended for fileEdited triggers',
          code: 'EMPTY_PATTERNS',
        });
      }
    }

    // Validate then (required)
    if (!hookObj.then || typeof hookObj.then !== 'object') {
      errors.push({
        path: 'then',
        message: 'then is required and must be an object',
        code: 'MISSING_THEN',
      });
    } else {
      const then = hookObj.then as Record<string, unknown>;
      const validThenTypes = ['askAgent', 'runCommand'];
      if (!then.type || typeof then.type !== 'string' || !validThenTypes.includes(then.type)) {
        errors.push({
          path: 'then.type',
          message: `then.type must be one of: ${validThenTypes.join(', ')}`,
          code: 'INVALID_THEN_TYPE',
        });
      } else if (then.type === 'askAgent' && (!then.prompt || typeof then.prompt !== 'string')) {
        errors.push({
          path: 'then.prompt',
          message: 'prompt is required for askAgent actions',
          code: 'MISSING_PROMPT',
        });
      } else if (then.type === 'runCommand' && (!then.command || typeof then.command !== 'string')) {
        errors.push({
          path: 'then.command',
          message: 'command is required for runCommand actions',
          code: 'MISSING_COMMAND',
        });
      }
    }

    // Validate optional fields
    if (hookObj.enabled === false) {
      warnings.push({
        path: 'enabled',
        message: 'Hook is disabled',
        code: 'HOOK_DISABLED',
      });
    }

    if (!hookObj.description || typeof hookObj.description !== 'string' || hookObj.description.trim() === '') {
      warnings.push({
        path: 'description',
        message: 'description is recommended for documentation',
        code: 'MISSING_DESCRIPTION',
      });
    }

    if (!hookObj.version) {
      warnings.push({
        path: 'version',
        message: 'version is recommended for tracking hook changes',
        code: 'MISSING_VERSION',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * List all hook files in the hooks directory with validation status
   */
  listHooksDirectory(): HookDirectoryListing {
    const hooksDir = this.getHooksDirectory();
    const hooks: HookFileInfo[] = [];
    const errors: HookLoadError[] = [];

    if (!fs.existsSync(hooksDir)) {
      return { hooks, errors };
    }

    const files = fs.readdirSync(hooksDir).filter(f => f.endsWith('.kiro.hook'));

    for (const file of files) {
      const filePath = path.join(hooksDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const validation = this.validateKiroHookFile(parsed);
        const hook = validation.valid ? this.parseKiroHookFile(filePath) : null;

        hooks.push({
          fileName: file,
          filePath,
          hook,
          valid: validation.valid,
          errors: validation.errors.map(e => e.message),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          fileName: file,
          filePath,
          error: errorMessage,
        });
        hooks.push({
          fileName: file,
          filePath,
          hook: null,
          valid: false,
          errors: [errorMessage],
        });
      }
    }

    return { hooks, errors };
  }

  /**
   * Get hook by file name
   */
  getHookByFileName(fileName: string): Hook | null {
    const hooksDir = this.getHooksDirectory();
    const filePath = path.join(hooksDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return this.parseKiroHookFile(filePath);
  }

  /**
   * Delete a hook file from the hooks directory
   */
  deleteHookFile(fileName: string): boolean {
    const hooksDir = this.getHooksDirectory();
    const filePath = path.join(hooksDir, fileName);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      // Also unregister if it was registered
      const hookId = `hook_${path.basename(fileName, '.kiro.hook')}`;
      this.unregisterHook(hookId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if hooks directory exists
   */
  hooksDirectoryExists(): boolean {
    return fs.existsSync(this.getHooksDirectory());
  }

  /**
   * Get the count of hooks in the directory
   */
  getHookCount(): number {
    const hooksDir = this.getHooksDirectory();
    if (!fs.existsSync(hooksDir)) {
      return 0;
    }
    return fs.readdirSync(hooksDir).filter(f => f.endsWith('.kiro.hook')).length;
  }
}
