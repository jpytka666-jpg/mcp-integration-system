/**
 * Core configuration types for Kiro system
 */

export interface KiroConfig {
  identity: IdentityConfig;
  responseStyle: ResponseStyleConfig;
  specs: SpecConfig;
  steering: SteeringConfig;
  mcp: MCPConfig;
  hooks: HookConfig;
}

export interface IdentityConfig {
  name: string;
  version: string;
  capabilities: string[];
}

export interface ResponseStyleConfig {
  tone: 'warm' | 'professional' | 'casual';
  verbosity: 'minimal' | 'standard' | 'detailed';
  platformAdaptation: boolean;
}

export interface SpecConfig {
  defaultFormat: 'ears';
  requireApproval: boolean;
  taskIsolation: boolean;
}

export interface SteeringConfig {
  directory: string;
  inclusionModes: ('always' | 'conditional' | 'manual')[];
  fileReferencePattern: string;
}

export interface MCPConfig {
  servers: Record<string, MCPServerConfig>;
  mergeStrategy: 'workspace-priority' | 'user-priority';
}

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
}

export interface HookConfig {
  enabled: boolean;
  triggers: HookTrigger[];
}

export interface HookTrigger {
  event: string;
  action: 'message' | 'command';
  target: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}