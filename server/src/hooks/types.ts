/**
 * Types for the hook management system
 * Implements Requirements 6.1, 6.2
 */

/**
 * Supported hook trigger events
 */
export type HookTriggerEvent =
  | 'message_sent'      // When a message is sent to the agent
  | 'execution_complete' // When an agent execution completes
  | 'session_created'   // When a new session is created (on first message send)
  | 'file_saved'        // When a user saves a code file
  | 'manual'            // When a user clicks a manual hook button
  | 'translation_update'; // When translation strings are updated

/**
 * Supported hook action types
 */
export type HookActionType = 'message' | 'command';

/**
 * Hook action configuration
 */
export interface HookAction {
  type: HookActionType;
  target: string; // Message content or shell command
  workingDirectory?: string; // For command actions
  timeout?: number; // Timeout in milliseconds for command actions
}

/**
 * Hook configuration
 */
export interface Hook {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: HookTrigger;
  action: HookAction;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Hook trigger configuration
 */
export interface HookTrigger {
  event: HookTriggerEvent;
  filePattern?: string; // For file_saved events, glob pattern to match
  condition?: string; // Optional condition expression
}

/**
 * Hook configuration file structure
 */
export interface HookConfigFile {
  hooks: Hook[];
  version: string;
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
  hookId: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  output?: string;
  error?: string;
}

/**
 * Hook validation result
 */
export interface HookValidationResult {
  valid: boolean;
  errors: HookValidationError[];
  warnings: HookValidationWarning[];
}

/**
 * Hook validation error
 */
export interface HookValidationError {
  path: string;
  message: string;
  code: HookErrorCode;
}

/**
 * Hook validation warning
 */
export interface HookValidationWarning {
  path: string;
  message: string;
  code: HookWarningCode;
}

/**
 * Hook error codes
 */
export type HookErrorCode =
  | 'INVALID_ROOT'
  | 'MISSING_HOOKS'
  | 'INVALID_HOOK'
  | 'MISSING_ID'
  | 'MISSING_NAME'
  | 'MISSING_TRIGGER'
  | 'INVALID_TRIGGER_EVENT'
  | 'MISSING_ACTION'
  | 'INVALID_ACTION_TYPE'
  | 'MISSING_ACTION_TARGET'
  | 'INVALID_JSON'
  | 'FILE_NOT_FOUND'
  | 'READ_ERROR'
  | 'DUPLICATE_ID';

/**
 * Hook warning codes
 */
export type HookWarningCode =
  | 'HOOK_DISABLED'
  | 'MISSING_DESCRIPTION'
  | 'MISSING_FILE_PATTERN'
  | 'EMPTY_HOOKS';

/**
 * Hook lifecycle status
 */
export type HookStatus = 'active' | 'inactive' | 'error';

/**
 * Hook registration entry
 */
export interface HookRegistration {
  hook: Hook;
  status: HookStatus;
  lastExecuted?: Date;
  executionCount: number;
  lastError?: string;
}

/**
 * Event context passed to hooks during execution
 */
export interface HookEventContext {
  event: HookTriggerEvent;
  timestamp: Date;
  filePath?: string; // For file_saved events
  message?: string; // For message_sent events
  sessionId?: string; // For session_created events
  metadata?: Record<string, unknown>;
}

/**
 * Kiro IDE hook file format (.kiro.hook)
 */
export interface KiroHookFile {
  enabled: boolean;
  name: string;
  description: string;
  version: string;
  when: {
    type: string;
    patterns?: string[];
  };
  then: {
    type: 'askAgent' | 'runCommand';
    prompt?: string;
    command?: string;
  };
  workspaceFolderName?: string;
  shortName?: string;
}

/**
 * Kiro hook file validation result
 */
export interface KiroHookValidationResult {
  valid: boolean;
  errors: KiroHookValidationError[];
  warnings: KiroHookValidationWarning[];
}

/**
 * Kiro hook file validation error
 */
export interface KiroHookValidationError {
  path: string;
  message: string;
  code: KiroHookErrorCode;
}

/**
 * Kiro hook file validation warning
 */
export interface KiroHookValidationWarning {
  path: string;
  message: string;
  code: KiroHookWarningCode;
}

/**
 * Kiro hook error codes
 */
export type KiroHookErrorCode =
  | 'INVALID_JSON'
  | 'MISSING_NAME'
  | 'MISSING_WHEN'
  | 'INVALID_WHEN_TYPE'
  | 'MISSING_THEN'
  | 'INVALID_THEN_TYPE'
  | 'MISSING_PROMPT'
  | 'MISSING_COMMAND'
  | 'FILE_READ_ERROR';

/**
 * Kiro hook warning codes
 */
export type KiroHookWarningCode =
  | 'HOOK_DISABLED'
  | 'MISSING_DESCRIPTION'
  | 'MISSING_VERSION'
  | 'EMPTY_PATTERNS';

/**
 * Hook directory listing result
 */
export interface HookDirectoryListing {
  hooks: HookFileInfo[];
  errors: HookLoadError[];
}

/**
 * Hook file information
 */
export interface HookFileInfo {
  fileName: string;
  filePath: string;
  hook: Hook | null;
  valid: boolean;
  errors: string[];
}

/**
 * Hook load error
 */
export interface HookLoadError {
  fileName: string;
  filePath: string;
  error: string;
}
