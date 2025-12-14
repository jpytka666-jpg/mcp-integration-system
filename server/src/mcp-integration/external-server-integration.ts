/**
 * External MCP Server Integration System
 * Handles integration of external MCP servers like ZedMoster/revit-mcp
 * with conflict avoidance and multi-protocol support
 */

import { MCPServerDefinition, MCPRegistry, SystemError } from './types.js';

export interface ExternalServerConfig {
  id: string;
  source: 'github' | 'npm' | 'local';
  repository?: string;
  version?: string;
  protocol: 'stdio' | 'http' | 'websocket';
  conflictResolution: 'prefer' | 'fallback' | 'disable';
  preferences: {
    priority: number;
    timeout: number;
    retryAttempts: number;
  };
}

export interface CapabilityMapping {
  capability: string;
  servers: Array<{
    serverId: string;
    priority: number;
    isPreferred: boolean;
  }>;
  conflictResolution: 'first' | 'preferred' | 'round_robin';
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: Array<{
    type: 'conflict' | 'dependency' | 'version' | 'protocol';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    suggestion?: string;
  }>;
  requirements: string[];
}

export interface ServerPreferences {
  defaultProtocol: 'stdio' | 'http' | 'websocket';
  timeoutMs: number;
  retryPolicy: {
    maxAttempts: number;
    backoffMs: number;
    exponentialBackoff: boolean;
  };
  fallbackBehavior: 'disable' | 'alternative' | 'degraded';
  capabilityPreferences: Record<string, string[]>; // capability -> preferred server IDs
}

export class ExternalServerIntegration {
  private registry: MCPRegistry;
  private capabilityMappings: Map<string, CapabilityMapping>;
  private serverPreferences: ServerPreferences;
  private compatibilityCache: Map<string, CompatibilityResult>;

  constructor(registry: MCPRegistry) {
    this.registry = registry;
    this.capabilityMappings = new Map();
    this.compatibilityCache = new Map();
    this.serverPreferences = this.getDefaultPreferences();
  }

  /**
   * Integrate ZedMoster/revit-mcp server with conflict avoidance
   */
  async integrateZedMosterRevitMCP(config?: Partial<ExternalServerConfig>): Promise<MCPServerDefinition> {
    const serverConfig: ExternalServerConfig = {
      id: 'zedmoster-revit-mcp',
      source: 'github',
      repository: 'ZedMoster/revit-mcp',
      version: 'latest',
      protocol: 'http',
      conflictResolution: 'fallback',
      preferences: {
        priority: 2, // Lower priority than NonicaTab
        timeout: 30000,
        retryAttempts: 3
      },
      ...config
    };

    // Validate compatibility with existing servers
    const compatibility = await this.validateServerCompatibility(serverConfig);
    if (!compatibility.compatible && compatibility.issues.some(i => i.severity === 'critical')) {
      throw new Error(`Cannot integrate ZedMoster/revit-mcp: ${compatibility.issues.map(i => i.message).join(', ')}`);
    }

    // Create server definition
    const serverDefinition: MCPServerDefinition = {
      id: serverConfig.id,
      name: 'ZedMoster Revit MCP',
      type: serverConfig.protocol,
      connectionParams: this.createConnectionParams(serverConfig),
      capabilities: await this.fetchServerCapabilities(serverConfig),
      status: 'available',
      metadata: {
        source: 'github',
        version: serverConfig.version,
        description: 'Community Revit MCP server with complementary functionality',
        repository: serverConfig.repository,
        conflictResolution: serverConfig.conflictResolution
      }
    };

    // Register server with conflict avoidance
    await this.registerServerWithConflictAvoidance(serverDefinition);

    // Update capability mappings
    await this.updateCapabilityMappings(serverDefinition);

    return serverDefinition;
  }

  /**
   * Validate compatibility of a server with existing infrastructure
   */
  async validateServerCompatibility(config: ExternalServerConfig): Promise<CompatibilityResult> {
    const cacheKey = `${config.id}-${config.version}`;
    if (this.compatibilityCache.has(cacheKey)) {
      return this.compatibilityCache.get(cacheKey)!;
    }

    const result: CompatibilityResult = {
      compatible: true,
      issues: [],
      requirements: []
    };

    // Check for existing servers
    const existingServers = await this.registry.discoverServers();
    
    // Check for Revit installation compatibility
    if (config.id.includes('revit')) {
      const revitServers = existingServers.filter(s => 
        s.capabilities.some(cap => cap.includes('revit'))
      );

      if (revitServers.length > 0) {
        // Check for capability conflicts
        const capabilities = await this.fetchServerCapabilities(config);
        const conflicts = this.detectCapabilityConflicts(capabilities, revitServers);
        
        if (conflicts.length > 0) {
          result.issues.push({
            type: 'conflict',
            severity: 'medium',
            message: `Capability conflicts detected with existing Revit servers: ${conflicts.join(', ')}`,
            suggestion: 'Use conflict resolution strategies or adjust server priorities'
          });
        }
      }

      // Check AIONS.Revit compatibility
      const aionsServer = existingServers.find(s => s.id === 'aions-revit-addin');
      if (aionsServer) {
        result.requirements.push('AIONS.Revit addin must remain primary interface');
        result.issues.push({
          type: 'dependency',
          severity: 'low',
          message: 'External server must not interfere with AIONS.Revit addin functionality',
          suggestion: 'Configure as secondary/complementary server'
        });
      }
    }

    // Check protocol compatibility
    if (!this.isProtocolSupported(config.protocol)) {
      result.compatible = false;
      result.issues.push({
        type: 'protocol',
        severity: 'critical',
        message: `Protocol ${config.protocol} is not supported`,
        suggestion: 'Use stdio, http, or websocket protocols'
      });
    }

    // Check version compatibility
    if (config.version && config.version !== 'latest') {
      const versionCheck = await this.validateVersion(config);
      if (!versionCheck.valid) {
        result.issues.push({
          type: 'version',
          severity: 'medium',
          message: versionCheck.message,
          suggestion: 'Update to compatible version or use latest'
        });
      }
    }

    this.compatibilityCache.set(cacheKey, result);
    return result;
  }

  /**
   * Create capability mapping to avoid conflicts
   */
  async createCapabilityMapping(servers: MCPServerDefinition[]): Promise<Map<string, CapabilityMapping>> {
    const mappings = new Map<string, CapabilityMapping>();

    // Collect all capabilities
    const allCapabilities = new Set<string>();
    for (const server of servers) {
      server.capabilities.forEach(cap => allCapabilities.add(cap));
    }

    // Create mappings for each capability
    for (const capability of allCapabilities) {
      const serversWithCapability = servers
        .filter(s => s.capabilities.includes(capability))
        .map(s => ({
          serverId: s.id,
          priority: this.getServerPriority(s),
          isPreferred: this.isPreferredServer(s, capability)
        }))
        .sort((a, b) => b.priority - a.priority);

      const mapping: CapabilityMapping = {
        capability,
        servers: serversWithCapability,
        conflictResolution: this.getConflictResolutionStrategy(capability)
      };

      mappings.set(capability, mapping);
    }

    return mappings;
  }

  /**
   * Handle multi-protocol communication
   */
  async establishConnection(server: MCPServerDefinition): Promise<boolean> {
    try {
      switch (server.type) {
        case 'stdio':
          return await this.establishStdioConnection(server);
        case 'http':
          return await this.establishHttpConnection(server);
        case 'websocket':
          return await this.establishWebSocketConnection(server);
        default:
          throw new Error(`Unsupported protocol: ${server.type}`);
      }
    } catch (error) {
      console.error(`Failed to establish connection to ${server.id}:`, error);
      
      // Try fallback if configured
      if (server.metadata.conflictResolution === 'fallback') {
        return await this.tryFallbackConnection(server);
      }
      
      return false;
    }
  }

  /**
   * Implement preference settings and fallback mechanisms
   */
  async selectServerForCapability(capability: string): Promise<string | null> {
    const mapping = this.capabilityMappings.get(capability);
    if (!mapping || mapping.servers.length === 0) {
      return null;
    }

    // Check user preferences first
    const preferredServers = this.serverPreferences.capabilityPreferences[capability];
    if (preferredServers) {
      for (const serverId of preferredServers) {
        const server = mapping.servers.find(s => s.serverId === serverId);
        if (server && await this.isServerAvailable(serverId)) {
          return serverId;
        }
      }
    }

    // Use conflict resolution strategy
    switch (mapping.conflictResolution) {
      case 'preferred':
        const preferred = mapping.servers.find(s => s.isPreferred);
        if (preferred && await this.isServerAvailable(preferred.serverId)) {
          return preferred.serverId;
        }
        // Fall through to first available
      
      case 'first':
        for (const server of mapping.servers) {
          if (await this.isServerAvailable(server.serverId)) {
            return server.serverId;
          }
        }
        break;

      case 'round_robin':
        return await this.selectRoundRobinServer(mapping);
    }

    return null;
  }

  /**
   * Update server preferences
   */
  updatePreferences(preferences: Partial<ServerPreferences>): void {
    this.serverPreferences = {
      ...this.serverPreferences,
      ...preferences
    };
  }

  /**
   * Get current capability mappings
   */
  getCapabilityMappings(): Map<string, CapabilityMapping> {
    return new Map(this.capabilityMappings);
  }

  // Private helper methods

  private getDefaultPreferences(): ServerPreferences {
    return {
      defaultProtocol: 'stdio',
      timeoutMs: 15000,
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 1000,
        exponentialBackoff: true
      },
      fallbackBehavior: 'alternative',
      capabilityPreferences: {
        // NonicaTab gets preference for core Revit operations
        'get_active_view_in_revit': ['nonicatab-mcp'],
        'get_user_selection_in_revit': ['nonicatab-mcp'],
        'get_elements_by_category': ['nonicatab-mcp'],
        // External servers can be preferred for specialized operations
        'revit_model_analysis': ['zedmoster-revit-mcp', 'nonicatab-mcp']
      }
    };
  }

  private createConnectionParams(config: ExternalServerConfig): MCPServerDefinition['connectionParams'] {
    switch (config.protocol) {
      case 'stdio':
        return {
          command: this.resolveCommand(config),
          args: this.resolveArgs(config),
          timeout: config.preferences.timeout
        };
      
      case 'http':
        return {
          url: this.resolveUrl(config),
          timeout: config.preferences.timeout
        };
      
      case 'websocket':
        return {
          url: this.resolveWebSocketUrl(config),
          timeout: config.preferences.timeout
        };
      
      default:
        throw new Error(`Unsupported protocol: ${config.protocol}`);
    }
  }

  private async fetchServerCapabilities(config: ExternalServerConfig): Promise<string[]> {
    // In a real implementation, this would fetch capabilities from the server
    // For now, return known capabilities based on server type
    if (config.id === 'zedmoster-revit-mcp') {
      return [
        'revit_model_analysis',
        'element_extraction',
        'parameter_management',
        'geometry_analysis',
        'family_management'
      ];
    }
    
    return [];
  }

  private async registerServerWithConflictAvoidance(server: MCPServerDefinition): Promise<void> {
    // Check for existing servers with same capabilities
    const existingServers = await this.registry.discoverServers();
    const conflicts = this.detectCapabilityConflicts(server.capabilities, existingServers);
    
    if (conflicts.length > 0) {
      console.warn(`Registering server ${server.id} with capability conflicts: ${conflicts.join(', ')}`);
      
      // Apply conflict resolution based on server metadata
      const resolution = server.metadata.conflictResolution as string;
      if (resolution === 'disable') {
        throw new Error(`Server registration blocked due to conflicts: ${conflicts.join(', ')}`);
      }
    }

    await this.registry.registerServer(server);
  }

  private async updateCapabilityMappings(server: MCPServerDefinition): Promise<void> {
    const allServers = await this.registry.discoverServers();
    this.capabilityMappings = await this.createCapabilityMapping(allServers);
  }

  private detectCapabilityConflicts(capabilities: string[], existingServers: MCPServerDefinition[]): string[] {
    const conflicts: string[] = [];
    
    for (const capability of capabilities) {
      const serversWithCapability = existingServers.filter(s => 
        s.capabilities.includes(capability)
      );
      
      if (serversWithCapability.length > 0) {
        conflicts.push(capability);
      }
    }
    
    return conflicts;
  }

  private isProtocolSupported(protocol: string): boolean {
    return ['stdio', 'http', 'websocket'].includes(protocol);
  }

  private async validateVersion(config: ExternalServerConfig): Promise<{ valid: boolean; message: string }> {
    // Simplified version validation
    if (!config.version || config.version === 'latest') {
      return { valid: true, message: 'Version is valid' };
    }
    
    // In real implementation, would check against available versions
    return { valid: true, message: 'Version validation passed' };
  }

  private getServerPriority(server: MCPServerDefinition): number {
    // NonicaTab gets highest priority for Revit operations
    if (server.id === 'nonicatab-mcp') return 10;
    if (server.id === 'aions-revit-addin') return 9;
    if (server.id === 'zedmoster-revit-mcp') return 5;
    return 1;
  }

  private isPreferredServer(server: MCPServerDefinition, capability: string): boolean {
    const preferences = this.serverPreferences.capabilityPreferences[capability];
    return preferences ? preferences.includes(server.id) : false;
  }

  private getConflictResolutionStrategy(capability: string): CapabilityMapping['conflictResolution'] {
    // Core Revit operations prefer first (highest priority)
    if (capability.includes('revit') && capability.includes('get_')) {
      return 'first';
    }
    
    // Analysis operations can use preferred servers
    if (capability.includes('analysis')) {
      return 'preferred';
    }
    
    return 'first';
  }

  private async establishStdioConnection(server: MCPServerDefinition): Promise<boolean> {
    // Simplified stdio connection establishment
    if (!server.connectionParams.command) {
      return false;
    }
    
    // In real implementation, would spawn process and establish communication
    console.log(`Establishing stdio connection to ${server.id}`);
    return true;
  }

  private async establishHttpConnection(server: MCPServerDefinition): Promise<boolean> {
    // Simplified HTTP connection establishment
    if (!server.connectionParams.url) {
      return false;
    }
    
    // In real implementation, would make HTTP request to validate connection
    console.log(`Establishing HTTP connection to ${server.id}`);
    return true;
  }

  private async establishWebSocketConnection(server: MCPServerDefinition): Promise<boolean> {
    // Simplified WebSocket connection establishment
    if (!server.connectionParams.url) {
      return false;
    }
    
    // In real implementation, would establish WebSocket connection
    console.log(`Establishing WebSocket connection to ${server.id}`);
    return true;
  }

  private async tryFallbackConnection(server: MCPServerDefinition): Promise<boolean> {
    console.log(`Trying fallback connection for ${server.id}`);
    
    // Try alternative protocols or configurations
    const fallbackProtocols: Array<MCPServerDefinition['type']> = ['stdio', 'http', 'websocket'];
    
    for (const protocol of fallbackProtocols) {
      if (protocol !== server.type) {
        try {
          const fallbackServer = { ...server, type: protocol };
          const success = await this.establishConnection(fallbackServer);
          if (success) {
            console.log(`Fallback connection successful using ${protocol}`);
            return true;
          }
        } catch (error) {
          console.warn(`Fallback protocol ${protocol} failed:`, error);
        }
      }
    }
    
    return false;
  }

  private async isServerAvailable(serverId: string): Promise<boolean> {
    return await this.registry.validateServerConnection(serverId);
  }

  private async selectRoundRobinServer(mapping: CapabilityMapping): Promise<string | null> {
    // Simple round-robin implementation
    const availableServers = [];
    for (const server of mapping.servers) {
      if (await this.isServerAvailable(server.serverId)) {
        availableServers.push(server.serverId);
      }
    }
    
    if (availableServers.length === 0) {
      return null;
    }
    
    // In real implementation, would maintain round-robin state
    return availableServers[0];
  }

  private resolveCommand(config: ExternalServerConfig): string {
    if (config.source === 'github' && config.repository) {
      // For GitHub servers, might use a wrapper script
      return `github-mcp-runner`;
    }
    return 'mcp-server';
  }

  private resolveArgs(config: ExternalServerConfig): string[] {
    if (config.source === 'github' && config.repository) {
      return ['--repo', config.repository, '--version', config.version || 'latest'];
    }
    return [];
  }

  private resolveUrl(config: ExternalServerConfig): string {
    if (config.source === 'github' && config.repository) {
      return `https://api.github.com/repos/${config.repository}`;
    }
    return 'http://localhost:3000';
  }

  private resolveWebSocketUrl(config: ExternalServerConfig): string {
    if (config.source === 'github' && config.repository) {
      return `wss://api.github.com/repos/${config.repository}/ws`;
    }
    return 'ws://localhost:3000';
  }
}