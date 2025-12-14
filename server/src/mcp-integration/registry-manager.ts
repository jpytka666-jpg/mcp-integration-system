/**
 * MCP Registry Manager
 * Discovers, registers, and manages connections to multiple MCP servers
 */

import * as fs from 'fs';
import * as path from 'path';
import { MCPServerDefinition, MCPRegistry, MCPServerRegistry, MCPConnection, SystemError } from './types.js';

export class MCPRegistryManager implements MCPRegistry {
  private registry: MCPServerRegistry;
  private readonly nonicaTabPath = 'C:\\NONICA\\OtherFiles\\System\\Core\\net8.0-windows\\RevitMCPConnection.exe';
  private readonly aionsRevitPath = 'C:\\AIONS\\Revit\\AIONS.Revit.dll';

  constructor() {
    this.registry = {
      servers: new Map(),
      capabilities: new Map(),
      connections: new Map(),
      lastUpdated: new Date()
    };
  }

  /**
   * Discover all available MCP servers in the environment
   */
  async discoverServers(): Promise<MCPServerDefinition[]> {
    const discovered: MCPServerDefinition[] = [];

    // Discover NonicaTab MCP server
    const nonicaTab = await this.discoverNonicaTabServer();
    if (nonicaTab) {
      discovered.push(nonicaTab);
    }

    // Discover AIONS.Revit addin
    const aionsRevit = await this.discoverAIONSRevitAddin();
    if (aionsRevit) {
      discovered.push(aionsRevit);
    }

    // Discover GitHub-based servers (ZedMoster/revit-mcp)
    const githubServers = await this.discoverGitHubServers();
    discovered.push(...githubServers);

    // Update registry
    for (const server of discovered) {
      this.registry.servers.set(server.id, server);
      this.registry.capabilities.set(server.id, server.capabilities);
    }

    this.registry.lastUpdated = new Date();
    return discovered;
  }

  /**
   * Discover NonicaTab MCP server
   */
  private async discoverNonicaTabServer(): Promise<MCPServerDefinition | null> {
    try {
      if (!fs.existsSync(this.nonicaTabPath)) {
        return null;
      }

      const stats = fs.statSync(this.nonicaTabPath);
      
      return {
        id: 'nonicatab-mcp',
        name: 'NonicaTab MCP Server',
        type: 'stdio',
        connectionParams: {
          command: this.nonicaTabPath,
          args: [],
          timeout: 15000
        },
        capabilities: [
          'get_active_view_in_revit',
          'get_user_selection_in_revit',
          'get_elements_by_category',
          'get_parameters_from_elementid',
          'get_all_additional_properties_from_elementid',
          'get_boundingboxes_for_element_ids',
          'get_location_for_element_ids',
          'get_all_used_families_in_model',
          'get_all_used_types_of_families'
        ],
        status: 'available',
        metadata: {
          source: 'local',
          version: '1.0.0',
          description: '37 FREE Revit tools via RevitMCPConnection.exe'
        }
      };
    } catch (error) {
      console.warn('Failed to discover NonicaTab MCP server:', error);
      return null;
    }
  }

  /**
   * Discover AIONS.Revit addin
   */
  private async discoverAIONSRevitAddin(): Promise<MCPServerDefinition | null> {
    try {
      if (!fs.existsSync(this.aionsRevitPath)) {
        return null;
      }

      return {
        id: 'aions-revit-addin',
        name: 'AIONS.Revit Custom Addin',
        type: 'stdio',
        connectionParams: {
          command: 'revit-addin-bridge',
          args: ['--addin', this.aionsRevitPath],
          timeout: 10000
        },
        capabilities: [
          'ai_chatbot_sidebar',
          'revit_model_access',
          'custom_ui_integration'
        ],
        status: 'available',
        metadata: {
          source: 'local',
          version: '1.0.0',
          description: 'Custom Revit addin for AI-powered chatbot sidebar functionality'
        }
      };
    } catch (error) {
      console.warn('Failed to discover AIONS.Revit addin:', error);
      return null;
    }
  }

  /**
   * Discover GitHub-based MCP servers
   */
  private async discoverGitHubServers(): Promise<MCPServerDefinition[]> {
    const servers: MCPServerDefinition[] = [];

    try {
      // ZedMoster/revit-mcp server
      const zedMosterServer: MCPServerDefinition = {
        id: 'zedmoster-revit-mcp',
        name: 'ZedMoster Revit MCP',
        type: 'http',
        connectionParams: {
          url: 'https://api.github.com/repos/ZedMoster/revit-mcp',
          port: 3000,
          timeout: 30000
        },
        capabilities: [
          'revit_model_analysis',
          'element_extraction',
          'parameter_management'
        ],
        status: 'available',
        metadata: {
          source: 'github',
          version: 'latest',
          description: 'Community Revit MCP server from GitHub'
        }
      };

      servers.push(zedMosterServer);
    } catch (error) {
      console.warn('Failed to discover GitHub MCP servers:', error);
    }

    return servers;
  }

  /**
   * Register a new MCP server
   */
  async registerServer(definition: MCPServerDefinition): Promise<void> {
    // Validate server definition
    this.validateServerDefinition(definition);

    // Check for conflicts
    await this.checkServerConflicts(definition);

    // Register server
    this.registry.servers.set(definition.id, definition);
    this.registry.capabilities.set(definition.id, definition.capabilities);
    this.registry.lastUpdated = new Date();

    console.log(`Registered MCP server: ${definition.name} (${definition.id})`);
  }

  /**
   * Get server capabilities
   */
  async getServerCapabilities(serverId: string): Promise<string[]> {
    const capabilities = this.registry.capabilities.get(serverId);
    if (!capabilities) {
      throw new Error(`Server not found: ${serverId}`);
    }
    return capabilities;
  }

  /**
   * Validate server connection
   */
  async validateServerConnection(serverId: string): Promise<boolean> {
    const server = this.registry.servers.get(serverId);
    if (!server) {
      return false;
    }

    try {
      switch (server.type) {
        case 'stdio':
          return await this.validateStdioConnection(server);
        case 'http':
          return await this.validateHttpConnection(server);
        case 'websocket':
          return await this.validateWebSocketConnection(server);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Connection validation failed for ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Validate stdio connection
   */
  private async validateStdioConnection(server: MCPServerDefinition): Promise<boolean> {
    if (!server.connectionParams.command) {
      return false;
    }

    // For local executables, check if file exists
    if (server.metadata.source === 'local') {
      return fs.existsSync(server.connectionParams.command);
    }

    return true;
  }

  /**
   * Validate HTTP connection
   */
  private async validateHttpConnection(server: MCPServerDefinition): Promise<boolean> {
    if (!server.connectionParams.url) {
      return false;
    }

    try {
      // Simple connectivity check (in real implementation, would make actual HTTP request)
      const url = new URL(server.connectionParams.url);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Validate WebSocket connection
   */
  private async validateWebSocketConnection(server: MCPServerDefinition): Promise<boolean> {
    if (!server.connectionParams.url) {
      return false;
    }

    try {
      const url = new URL(server.connectionParams.url);
      return url.protocol === 'ws:' || url.protocol === 'wss:';
    } catch {
      return false;
    }
  }

  /**
   * Validate server definition
   */
  private validateServerDefinition(definition: MCPServerDefinition): void {
    if (!definition.id || !definition.name || !definition.type) {
      throw new Error('Server definition must have id, name, and type');
    }

    if (!['stdio', 'http', 'websocket'].includes(definition.type)) {
      throw new Error('Invalid server type. Must be stdio, http, or websocket');
    }

    if (!definition.capabilities || definition.capabilities.length === 0) {
      throw new Error('Server must have at least one capability');
    }
  }

  /**
   * Check for server conflicts
   */
  private async checkServerConflicts(definition: MCPServerDefinition): Promise<void> {
    // Check for ID conflicts
    if (this.registry.servers.has(definition.id)) {
      throw new Error(`Server with ID ${definition.id} already exists`);
    }

    // Check for capability conflicts (for Revit servers)
    if (definition.capabilities.some(cap => cap.includes('revit'))) {
      const existingRevitServers = Array.from(this.registry.servers.values())
        .filter(server => server.capabilities.some(cap => cap.includes('revit')));

      if (existingRevitServers.length > 0) {
        console.warn(`Multiple Revit MCP servers detected. Capability conflicts may occur.`);
      }
    }
  }

  /**
   * Get all registered servers
   */
  getRegisteredServers(): MCPServerDefinition[] {
    return Array.from(this.registry.servers.values());
  }

  /**
   * Get server by ID
   */
  getServer(serverId: string): MCPServerDefinition | undefined {
    return this.registry.servers.get(serverId);
  }

  /**
   * Update server status
   */
  updateServerStatus(serverId: string, status: MCPServerDefinition['status'], error?: string): void {
    const server = this.registry.servers.get(serverId);
    if (server) {
      server.status = status;
      if (error && status === 'error') {
        // Store error in metadata
        server.metadata = { ...server.metadata, lastError: error } as any;
      }
      this.registry.lastUpdated = new Date();
    }
  }

  /**
   * Remove server from registry
   */
  unregisterServer(serverId: string): boolean {
    const removed = this.registry.servers.delete(serverId);
    if (removed) {
      this.registry.capabilities.delete(serverId);
      this.registry.connections.delete(serverId);
      this.registry.lastUpdated = new Date();
    }
    return removed;
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalServers: number;
    connectedServers: number;
    availableCapabilities: number;
    lastUpdated: Date;
  } {
    const servers = Array.from(this.registry.servers.values());
    const connectedServers = servers.filter(s => s.status === 'connected').length;
    const allCapabilities = new Set<string>();
    
    this.registry.capabilities.forEach(caps => {
      caps.forEach(cap => allCapabilities.add(cap));
    });

    return {
      totalServers: servers.length,
      connectedServers,
      availableCapabilities: allCapabilities.size,
      lastUpdated: this.registry.lastUpdated
    };
  }
}