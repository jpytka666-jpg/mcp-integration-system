/**
 * MCP Testing Utilities
 * Provides sample call generation, server availability checking, and security management
 */

import { MCPConfigManager } from './config-manager.js';
import {
  MCPServerConfig,
  MCPServerStatus,
  MCPToolCall,
  MCPToolResult,
} from './types.js';

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPServerInfo {
  name: string;
  config: MCPServerConfig;
  status: MCPServerStatus;
  tools?: MCPToolDefinition[];
}

export class MCPTestingUtils {
  private configManager: MCPConfigManager;

  constructor(configManager: MCPConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Generate a sample tool call for testing an MCP tool
   * Creates a call structure without checking configuration first
   */
  generateSampleCall(
    serverName: string,
    toolName: string,
    sampleArgs?: Record<string, unknown>
  ): MCPToolCall {
    return {
      serverName,
      toolName,
      arguments: sampleArgs || {},
    };
  }

  /**
   * Generate multiple sample calls for batch testing
   */
  generateSampleCalls(
    serverName: string,
    tools: Array<{ name: string; args?: Record<string, unknown> }>
  ): MCPToolCall[] {
    return tools.map((tool) =>
      this.generateSampleCall(serverName, tool.name, tool.args)
    );
  }

  /**
   * Check if a server is available (connected and not disabled)
   */
  checkServerAvailability(serverName: string): {
    available: boolean;
    reason?: string;
  } {
    const config = this.configManager.loadMergedConfig();
    const serverConfig = config.servers[serverName];

    if (!serverConfig) {
      return { available: false, reason: 'Server not found in configuration' };
    }

    if (serverConfig.disabled) {
      return { available: false, reason: 'Server is disabled' };
    }

    const status = this.configManager.getServerStatus(serverName);
    if (status.status === 'error') {
      return { available: false, reason: status.error || 'Server in error state' };
    }

    if (status.status === 'disconnected' || status.status === 'unknown') {
      return { available: false, reason: 'Server is not connected' };
    }

    return { available: true };
  }

  /**
   * Check availability of all configured servers
   */
  checkAllServersAvailability(): Map<string, { available: boolean; reason?: string }> {
    const config = this.configManager.loadMergedConfig();
    const results = new Map<string, { available: boolean; reason?: string }>();

    for (const serverName of Object.keys(config.servers)) {
      results.set(serverName, this.checkServerAvailability(serverName));
    }

    return results;
  }

  /**
   * Get server info including config and status
   */
  getServerInfo(serverName: string): MCPServerInfo | null {
    const config = this.configManager.loadMergedConfig();
    const serverConfig = config.servers[serverName];

    if (!serverConfig) {
      return null;
    }

    return {
      name: serverName,
      config: serverConfig,
      status: this.configManager.getServerStatus(serverName),
    };
  }

  /**
   * Get all servers info
   */
  getAllServersInfo(): MCPServerInfo[] {
    const config = this.configManager.loadMergedConfig();
    const servers: MCPServerInfo[] = [];

    for (const [name, serverConfig] of Object.entries(config.servers)) {
      servers.push({
        name,
        config: serverConfig,
        status: this.configManager.getServerStatus(name),
      });
    }

    return servers;
  }

  /**
   * Check if a tool is auto-approved for a server
   */
  isToolAutoApproved(serverName: string, toolName: string): boolean {
    const config = this.configManager.loadMergedConfig();
    const serverConfig = config.servers[serverName];

    if (!serverConfig?.autoApprove) {
      return false;
    }

    return serverConfig.autoApprove.includes(toolName);
  }

  /**
   * Get list of auto-approved tools for a server
   */
  getAutoApprovedTools(serverName: string): string[] {
    const config = this.configManager.loadMergedConfig();
    const serverConfig = config.servers[serverName];

    return serverConfig?.autoApprove || [];
  }

  /**
   * Add a tool to auto-approve list
   */
  addAutoApprovedTool(serverName: string, toolName: string): boolean {
    const currentTools = this.getAutoApprovedTools(serverName);
    
    if (currentTools.includes(toolName)) {
      return true; // Already approved
    }

    const newTools = [...currentTools, toolName];
    const result = this.configManager.setAutoApprove(serverName, newTools);
    return result.valid;
  }

  /**
   * Remove a tool from auto-approve list
   */
  removeAutoApprovedTool(serverName: string, toolName: string): boolean {
    const currentTools = this.getAutoApprovedTools(serverName);
    const newTools = currentTools.filter((t) => t !== toolName);
    
    if (newTools.length === currentTools.length) {
      return true; // Tool wasn't in list
    }

    const result = this.configManager.setAutoApprove(serverName, newTools);
    return result.valid;
  }

  /**
   * Simulate a tool call result (for testing purposes)
   * In real implementation, this would be handled by the IDE
   */
  simulateToolCall(call: MCPToolCall): MCPToolResult {
    const availability = this.checkServerAvailability(call.serverName);
    
    if (!availability.available) {
      return {
        success: false,
        error: availability.reason,
      };
    }

    // Simulated successful call
    return {
      success: true,
      result: {
        message: `Simulated call to ${call.serverName}/${call.toolName}`,
        arguments: call.arguments,
      },
    };
  }

  /**
   * Validate tool call structure
   */
  validateToolCall(call: MCPToolCall): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!call.serverName || typeof call.serverName !== 'string') {
      errors.push('serverName is required and must be a string');
    }

    if (!call.toolName || typeof call.toolName !== 'string') {
      errors.push('toolName is required and must be a string');
    }

    if (call.arguments !== undefined && typeof call.arguments !== 'object') {
      errors.push('arguments must be an object');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get security settings summary for a server
   */
  getSecuritySettings(serverName: string): {
    autoApproveEnabled: boolean;
    autoApprovedTools: string[];
    disabled: boolean;
  } | null {
    const config = this.configManager.loadMergedConfig();
    const serverConfig = config.servers[serverName];

    if (!serverConfig) {
      return null;
    }

    return {
      autoApproveEnabled: (serverConfig.autoApprove?.length || 0) > 0,
      autoApprovedTools: serverConfig.autoApprove || [],
      disabled: serverConfig.disabled || false,
    };
  }
}
