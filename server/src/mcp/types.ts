/**
 * MCP (Model Context Protocol) types for Kiro system
 */

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
}

export interface MCPConfigFile {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface MCPServerStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'unknown';
  lastConnected?: Date;
  error?: string;
}

export interface MCPMergedConfig {
  servers: Record<string, MCPServerConfig>;
  sources: Record<string, 'user' | 'workspace'>;
}

export interface MCPValidationResult {
  valid: boolean;
  errors: MCPValidationError[];
  warnings: MCPValidationWarning[];
}

export interface MCPValidationError {
  path: string;
  message: string;
  code: MCPErrorCode;
}

export interface MCPValidationWarning {
  path: string;
  message: string;
  code: MCPWarningCode;
}

export type MCPErrorCode =
  | 'INVALID_ROOT'
  | 'MISSING_MCP_SERVERS'
  | 'INVALID_SERVER_CONFIG'
  | 'MISSING_COMMAND'
  | 'INVALID_ARGS'
  | 'INVALID_ENV'
  | 'INVALID_DISABLED'
  | 'INVALID_AUTO_APPROVE'
  | 'INVALID_JSON'
  | 'FILE_NOT_FOUND'
  | 'READ_ERROR';

export type MCPWarningCode =
  | 'UVX_MISSING_ARGS'
  | 'SERVER_DISABLED'
  | 'EMPTY_AUTO_APPROVE';

export interface MCPToolCall {
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
}

export interface MCPToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}
