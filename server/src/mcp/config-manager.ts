/**
 * MCP Configuration Manager
 * Handles JSON schema validation, workspace/user config merging, and server lifecycle
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  MCPConfigFile,
  MCPServerConfig,
  MCPMergedConfig,
  MCPValidationResult,
  MCPValidationError,
  MCPValidationWarning,
  MCPServerStatus,
} from './types.js';

export class MCPConfigManager {
  private workspacePath: string;
  private userConfigPath: string;
  private serverStatuses: Map<string, MCPServerStatus> = new Map();

  constructor(workspacePath: string = '.kiro') {
    this.workspacePath = workspacePath;
    this.userConfigPath = this.getUserConfigPath();
  }

  /**
   * Get the user-level MCP config path
   */
  private getUserConfigPath(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, '.kiro', 'settings', 'mcp.json');
  }

  /**
   * Get the workspace-level MCP config path
   */
  getWorkspaceConfigPath(): string {
    return path.join(this.workspacePath, 'settings', 'mcp.json');
  }

  /**
   * Validate MCP configuration JSON schema
   */
  validateConfig(config: unknown): MCPValidationResult {
    const errors: MCPValidationError[] = [];
    const warnings: MCPValidationWarning[] = [];

    if (!config || typeof config !== 'object') {
      errors.push({
        path: 'root',
        message: 'Configuration must be a valid object',
        code: 'INVALID_ROOT',
      });
      return { valid: false, errors, warnings };
    }

    const configObj = config as Record<string, unknown>;

    if (!configObj.mcpServers || typeof configObj.mcpServers !== 'object') {
      errors.push({
        path: 'mcpServers',
        message: 'mcpServers must be an object',
        code: 'MISSING_MCP_SERVERS',
      });
      return { valid: false, errors, warnings };
    }

    const servers = configObj.mcpServers as Record<string, unknown>;
    for (const [serverName, serverConfig] of Object.entries(servers)) {
      this.validateServerConfig(serverName, serverConfig, errors, warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate individual server configuration
   */
  private validateServerConfig(
    serverName: string,
    config: unknown,
    errors: MCPValidationError[],
    warnings: MCPValidationWarning[]
  ): void {
    const basePath = `mcpServers.${serverName}`;

    if (!config || typeof config !== 'object') {
      errors.push({
        path: basePath,
        message: 'Server configuration must be an object',
        code: 'INVALID_SERVER_CONFIG',
      });
      return;
    }

    const serverConfig = config as Record<string, unknown>;

    // Validate command (required)
    if (!serverConfig.command || typeof serverConfig.command !== 'string') {
      errors.push({
        path: `${basePath}.command`,
        message: 'command is required and must be a string',
        code: 'MISSING_COMMAND',
      });
    }

    // Validate args (optional, must be array)
    if (serverConfig.args !== undefined && !Array.isArray(serverConfig.args)) {
      errors.push({
        path: `${basePath}.args`,
        message: 'args must be an array of strings',
        code: 'INVALID_ARGS',
      });
    }

    // Validate env (optional, must be object)
    if (serverConfig.env !== undefined && typeof serverConfig.env !== 'object') {
      errors.push({
        path: `${basePath}.env`,
        message: 'env must be an object',
        code: 'INVALID_ENV',
      });
    }

    // Validate disabled (optional, must be boolean)
    if (serverConfig.disabled !== undefined && typeof serverConfig.disabled !== 'boolean') {
      errors.push({
        path: `${basePath}.disabled`,
        message: 'disabled must be a boolean',
        code: 'INVALID_DISABLED',
      });
    }

    // Validate autoApprove (optional, must be array)
    if (serverConfig.autoApprove !== undefined && !Array.isArray(serverConfig.autoApprove)) {
      errors.push({
        path: `${basePath}.autoApprove`,
        message: 'autoApprove must be an array of strings',
        code: 'INVALID_AUTO_APPROVE',
      });
    }

    // Warnings
    if (serverConfig.command === 'uvx') {
      const args = serverConfig.args as string[] | undefined;
      if (!args || args.length === 0) {
        warnings.push({
          path: `${basePath}.args`,
          message: 'uvx command typically requires package arguments',
          code: 'UVX_MISSING_ARGS',
        });
      }
    }

    if (serverConfig.disabled === true) {
      warnings.push({
        path: `${basePath}.disabled`,
        message: `Server "${serverName}" is disabled`,
        code: 'SERVER_DISABLED',
      });
    }

    if (serverConfig.autoApprove && (serverConfig.autoApprove as string[]).length === 0) {
      warnings.push({
        path: `${basePath}.autoApprove`,
        message: 'autoApprove array is empty',
        code: 'EMPTY_AUTO_APPROVE',
      });
    }
  }

  /**
   * Load configuration from a file path
   */
  loadConfigFile(filePath: string): MCPConfigFile | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as MCPConfigFile;
    } catch {
      return null;
    }
  }

  /**
   * Load and merge workspace and user-level configurations
   * Workspace config takes priority over user config
   */
  loadMergedConfig(): MCPMergedConfig {
    const result: MCPMergedConfig = {
      servers: {},
      sources: {},
    };

    // Load user config first (lower priority)
    const userConfig = this.loadConfigFile(this.userConfigPath);
    if (userConfig?.mcpServers) {
      for (const [name, config] of Object.entries(userConfig.mcpServers)) {
        result.servers[name] = config;
        result.sources[name] = 'user';
      }
    }

    // Load workspace config (higher priority, overwrites user)
    const workspaceConfig = this.loadConfigFile(this.getWorkspaceConfigPath());
    if (workspaceConfig?.mcpServers) {
      for (const [name, config] of Object.entries(workspaceConfig.mcpServers)) {
        result.servers[name] = config;
        result.sources[name] = 'workspace';
      }
    }

    return result;
  }

  /**
   * Save configuration to workspace config file
   */
  saveWorkspaceConfig(config: MCPConfigFile): MCPValidationResult {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return validation;
    }

    const configPath = this.getWorkspaceConfigPath();
    const settingsDir = path.dirname(configPath);

    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return validation;
  }

  /**
   * Get server status
   */
  getServerStatus(serverName: string): MCPServerStatus {
    return (
      this.serverStatuses.get(serverName) || {
        name: serverName,
        status: 'unknown',
      }
    );
  }

  /**
   * Update server status
   */
  updateServerStatus(
    serverName: string,
    status: MCPServerStatus['status'],
    error?: string
  ): void {
    this.serverStatuses.set(serverName, {
      name: serverName,
      status,
      lastConnected: status === 'connected' ? new Date() : undefined,
      error,
    });
  }

  /**
   * Connect to a server (simulated - actual connection handled by IDE)
   */
  connectServer(serverName: string): MCPServerStatus {
    const config = this.loadMergedConfig();
    const serverConfig = config.servers[serverName];

    if (!serverConfig) {
      this.updateServerStatus(serverName, 'error', 'Server not found in configuration');
      return this.getServerStatus(serverName);
    }

    if (serverConfig.disabled) {
      this.updateServerStatus(serverName, 'disconnected', 'Server is disabled');
      return this.getServerStatus(serverName);
    }

    // In real implementation, this would trigger IDE connection
    this.updateServerStatus(serverName, 'connected');
    return this.getServerStatus(serverName);
  }

  /**
   * Disconnect from a server
   */
  disconnectServer(serverName: string): MCPServerStatus {
    this.updateServerStatus(serverName, 'disconnected');
    return this.getServerStatus(serverName);
  }

  /**
   * Reconnect to a server
   */
  reconnectServer(serverName: string): MCPServerStatus {
    this.disconnectServer(serverName);
    return this.connectServer(serverName);
  }

  /**
   * Get all server statuses
   */
  getAllServerStatuses(): MCPServerStatus[] {
    const config = this.loadMergedConfig();
    return Object.keys(config.servers).map((name) => this.getServerStatus(name));
  }

  /**
   * Enable or disable a server
   */
  setServerEnabled(serverName: string, enabled: boolean): MCPValidationResult {
    const configPath = this.getWorkspaceConfigPath();
    let config = this.loadConfigFile(configPath);

    if (!config) {
      config = { mcpServers: {} };
    }

    if (!config.mcpServers[serverName]) {
      return {
        valid: false,
        errors: [
          {
            path: `mcpServers.${serverName}`,
            message: 'Server not found',
            code: 'INVALID_SERVER_CONFIG',
          },
        ],
        warnings: [],
      };
    }

    config.mcpServers[serverName].disabled = !enabled;
    return this.saveWorkspaceConfig(config);
  }

  /**
   * Update auto-approve list for a server
   */
  setAutoApprove(serverName: string, tools: string[]): MCPValidationResult {
    const configPath = this.getWorkspaceConfigPath();
    let config = this.loadConfigFile(configPath);

    if (!config) {
      config = { mcpServers: {} };
    }

    if (!config.mcpServers[serverName]) {
      return {
        valid: false,
        errors: [
          {
            path: `mcpServers.${serverName}`,
            message: 'Server not found',
            code: 'INVALID_SERVER_CONFIG',
          },
        ],
        warnings: [],
      };
    }

    config.mcpServers[serverName].autoApprove = tools;
    return this.saveWorkspaceConfig(config);
  }
}
