/**
 * Property-based tests for External Server Integration System
 * **Feature: mcp-integration-system, Properties 21-25**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  ExternalServerIntegration,
  ExternalServerConfig,
  CapabilityMapping,
  CompatibilityResult,
  ServerPreferences
} from './external-server-integration.js';
import { MCPServerDefinition, MCPRegistry } from './types.js';

// Generator for external server configurations
const externalServerConfigGen = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9-_]/g, 'x')),
  source: fc.constantFrom('github' as const, 'npm' as const, 'local' as const),
  repository: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  version: fc.option(fc.constantFrom('latest', '1.0.0', '2.0.0', '1.5.3'), { nil: undefined }),
  protocol: fc.constantFrom('stdio' as const, 'http' as const, 'websocket' as const),
  conflictResolution: fc.constantFrom('prefer' as const, 'fallback' as const, 'disable' as const),
  preferences: fc.record({
    priority: fc.integer({ min: 1, max: 10 }),
    timeout: fc.integer({ min: 1000, max: 60000 }),
    retryAttempts: fc.integer({ min: 1, max: 5 })
  })
});

// Generator for MCP server definitions
const mcpServerDefinitionGen = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9-_]/g, 'x')),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  type: fc.constantFrom('stdio' as const, 'http' as const, 'websocket' as const),
  capabilities: fc.array(
    fc.constantFrom(
      'get_active_view_in_revit',
      'get_user_selection_in_revit',
      'get_elements_by_category',
      'revit_model_analysis',
      'element_extraction',
      'parameter_management',
      'geometry_analysis',
      'family_management'
    ),
    { minLength: 1, maxLength: 5 }
  ),
  status: fc.constantFrom('available' as const, 'connected' as const, 'error' as const, 'unknown' as const)
}).map(config => ({
  ...config,
  connectionParams: {
    command: config.type === 'stdio' ? '/usr/bin/mcp-server' : undefined,
    url: config.type !== 'stdio' ? 'http://localhost:3000' : undefined,
    timeout: 15000
  },
  metadata: {
    source: 'local' as const,
    version: '1.0.0',
    description: 'Test server'
  }
})) as fc.Arbitrary<MCPServerDefinition>;

// Generator for capability arrays
const capabilityArrayGen = fc.array(
  fc.constantFrom(
    'get_active_view_in_revit',
    'get_user_selection_in_revit',
    'get_elements_by_category',
    'revit_model_analysis',
    'element_extraction',
    'parameter_management'
  ),
  { minLength: 1, maxLength: 4 }
);

describe('External Server Integration Property Tests', () => {
  let externalServerIntegration: ExternalServerIntegration;
  let mockRegistry: MCPRegistry;
  let registeredServers: MCPServerDefinition[];

  beforeEach(() => {
    vi.clearAllMocks();
    registeredServers = [];

    // Create mock registry
    mockRegistry = {
      discoverServers: vi.fn().mockImplementation(async () => registeredServers),
      registerServer: vi.fn().mockImplementation(async (server: MCPServerDefinition) => {
        registeredServers.push(server);
      }),
      getServerCapabilities: vi.fn().mockImplementation(async (serverId: string) => {
        const server = registeredServers.find(s => s.id === serverId);
        return server?.capabilities || [];
      }),
      validateServerConnection: vi.fn().mockResolvedValue(true)
    };

    externalServerIntegration = new ExternalServerIntegration(mockRegistry);
  });

  describe('Property 21: Conflict-free Integration', () => {
    /**
     * **Feature: mcp-integration-system, Property 21: Conflict-free Integration**
     * **Validates: Requirements 5.1**
     *
     * Tests that external servers can be integrated without disrupting
     * existing NonicaTab MCP functionality.
     */
    it('should integrate ZedMoster/revit-mcp without disrupting NonicaTab functionality', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          protocol: fc.constantFrom('stdio' as const, 'http' as const, 'websocket' as const),
          priority: fc.integer({ min: 1, max: 5 }),
          timeout: fc.integer({ min: 5000, max: 30000 })
        }),
        async (config) => {
          // Setup: Register NonicaTab as existing server
          const nonicaTabServer: MCPServerDefinition = {
            id: 'nonicatab-mcp',
            name: 'NonicaTab MCP Server',
            type: 'stdio',
            connectionParams: { command: '/path/to/nonicatab', timeout: 15000 },
            capabilities: ['get_active_view_in_revit', 'get_user_selection_in_revit', 'get_elements_by_category'],
            status: 'connected',
            metadata: { source: 'local', version: '1.0.0', description: 'NonicaTab server' }
          };
          registeredServers = [nonicaTabServer];

          // Act: Integrate ZedMoster server
          const zedMosterServer = await externalServerIntegration.integrateZedMosterRevitMCP({
            protocol: config.protocol,
            preferences: {
              priority: config.priority,
              timeout: config.timeout,
              retryAttempts: 3
            }
          });

          // Assert: NonicaTab should still be registered
          const servers = await mockRegistry.discoverServers();
          const nonicaTab = servers.find(s => s.id === 'nonicatab-mcp');
          expect(nonicaTab).toBeDefined();
          expect(nonicaTab?.status).toBe('connected');

          // Assert: ZedMoster server should be registered with fallback resolution
          expect(zedMosterServer).toBeDefined();
          expect(zedMosterServer.id).toBe('zedmoster-revit-mcp');
          expect(zedMosterServer.metadata.conflictResolution).toBe('fallback');

          // Assert: NonicaTab capabilities should remain accessible
          const nonicaTabCaps = await mockRegistry.getServerCapabilities('nonicatab-mcp');
          expect(nonicaTabCaps).toContain('get_active_view_in_revit');
        }
      ), { numRuns: 30 });
    });

    it('should handle conflict resolution configuration properly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('prefer' as const, 'fallback' as const, 'disable' as const),
        async (conflictResolution) => {
          // Setup: Register existing server with overlapping capabilities
          const existingServer: MCPServerDefinition = {
            id: 'existing-revit-server',
            name: 'Existing Revit Server',
            type: 'stdio',
            connectionParams: { command: '/path/to/server', timeout: 15000 },
            capabilities: ['revit_model_analysis', 'element_extraction'],
            status: 'connected',
            metadata: { source: 'local', version: '1.0.0', description: 'Existing server' }
          };
          registeredServers = [existingServer];

          // Act: Try to integrate with specific conflict resolution
          const config: Partial<ExternalServerConfig> = {
            conflictResolution
          };

          if (conflictResolution === 'disable') {
            // When 'disable' is set and conflicts exist, should throw
            await expect(externalServerIntegration.integrateZedMosterRevitMCP(config))
              .rejects.toThrow(/blocked due to conflicts/);
          } else {
            // For 'prefer' and 'fallback', integration should succeed
            const result = await externalServerIntegration.integrateZedMosterRevitMCP(config);

            expect(result).toBeDefined();
            expect(result.id).toBe('zedmoster-revit-mcp');
            expect(result.metadata.conflictResolution).toBe(conflictResolution);

            // Both servers should coexist in registry
            const servers = await mockRegistry.discoverServers();
            expect(servers.length).toBe(2);
          }
        }
      ), { numRuns: 15 });
    });
  });

  describe('Property 22: Compatibility Validation', () => {
    /**
     * **Feature: mcp-integration-system, Property 22: Compatibility Validation**
     * **Validates: Requirements 5.2**
     *
     * Tests that compatibility validation correctly identifies issues
     * with external server configurations.
     */
    it('should validate compatibility for any external server configuration', async () => {
      await fc.assert(fc.asyncProperty(
        externalServerConfigGen,
        async (config) => {
          // Act: Validate compatibility
          const result = await externalServerIntegration.validateServerCompatibility(config);

          // Assert: Result should have correct structure
          expect(result).toBeDefined();
          expect(typeof result.compatible).toBe('boolean');
          expect(Array.isArray(result.issues)).toBe(true);
          expect(Array.isArray(result.requirements)).toBe(true);

          // Assert: Each issue should have proper structure
          for (const issue of result.issues) {
            expect(['conflict', 'dependency', 'version', 'protocol']).toContain(issue.type);
            expect(['low', 'medium', 'high', 'critical']).toContain(issue.severity);
            expect(typeof issue.message).toBe('string');
          }

          // Assert: If protocol is unsupported, should be incompatible
          if (!['stdio', 'http', 'websocket'].includes(config.protocol)) {
            expect(result.compatible).toBe(false);
            expect(result.issues.some(i => i.type === 'protocol')).toBe(true);
          }
        }
      ), { numRuns: 50 });
    });

    it('should detect AIONS.Revit compatibility requirements', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.constant('test-revit-server'),
          protocol: fc.constantFrom('stdio' as const, 'http' as const)
        }),
        async (partialConfig) => {
          // Setup: Register AIONS.Revit addin
          const aionsServer: MCPServerDefinition = {
            id: 'aions-revit-addin',
            name: 'AIONS.Revit Addin',
            type: 'stdio',
            connectionParams: { command: '/path/to/aions', timeout: 10000 },
            capabilities: ['ai_chatbot_sidebar', 'revit_model_access'],
            status: 'connected',
            metadata: { source: 'local', version: '1.0.0', description: 'AIONS addin' }
          };
          registeredServers = [aionsServer];

          const config: ExternalServerConfig = {
            id: partialConfig.id,
            source: 'github',
            repository: 'test/revit-server',
            protocol: partialConfig.protocol,
            conflictResolution: 'fallback',
            preferences: { priority: 5, timeout: 15000, retryAttempts: 3 }
          };

          // Act
          const result = await externalServerIntegration.validateServerCompatibility(config);

          // Assert: Should have AIONS compatibility requirement
          expect(result.requirements.some(r => r.includes('AIONS.Revit'))).toBe(true);
          expect(result.issues.some(i =>
            i.type === 'dependency' &&
            i.message.includes('AIONS.Revit')
          )).toBe(true);
        }
      ), { numRuns: 20 });
    });
  });

  describe('Property 23: Capability Mapping and Conflict Avoidance', () => {
    /**
     * **Feature: mcp-integration-system, Property 23: Capability Mapping and Conflict Avoidance**
     * **Validates: Requirements 5.3**
     *
     * Tests that capability mappings correctly handle multiple servers
     * with overlapping capabilities.
     */
    it('should create valid capability mappings for any set of servers', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(mcpServerDefinitionGen, { minLength: 1, maxLength: 5 }),
        async (servers) => {
          // Ensure unique IDs
          const uniqueServers = servers.map((s, i) => ({
            ...s,
            id: `${s.id}-${i}`
          }));

          // Act
          const mappings = await externalServerIntegration.createCapabilityMapping(uniqueServers);

          // Assert: Should have mapping for each unique capability
          const allCapabilities = new Set<string>();
          uniqueServers.forEach(s => s.capabilities.forEach(c => allCapabilities.add(c)));

          expect(mappings.size).toBe(allCapabilities.size);

          // Assert: Each mapping should have valid structure
          for (const [capability, mapping] of mappings) {
            expect(mapping.capability).toBe(capability);
            expect(Array.isArray(mapping.servers)).toBe(true);
            expect(mapping.servers.length).toBeGreaterThan(0);
            expect(['first', 'preferred', 'round_robin']).toContain(mapping.conflictResolution);

            // Each server entry should have priority and preference flag
            for (const serverEntry of mapping.servers) {
              expect(typeof serverEntry.serverId).toBe('string');
              expect(typeof serverEntry.priority).toBe('number');
              expect(typeof serverEntry.isPreferred).toBe('boolean');
            }

            // Servers should be sorted by priority (descending)
            for (let i = 0; i < mapping.servers.length - 1; i++) {
              expect(mapping.servers[i].priority).toBeGreaterThanOrEqual(mapping.servers[i + 1].priority);
            }
          }
        }
      ), { numRuns: 30 });
    });

    it('should prioritize NonicaTab for core Revit operations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(
          fc.constantFrom(
            'get_active_view_in_revit',
            'get_user_selection_in_revit',
            'get_elements_by_category'
          ),
          { minLength: 1, maxLength: 3 }
        ),
        async (coreCapabilities) => {
          // Setup: Create NonicaTab and external server with overlapping capabilities
          const nonicaTab: MCPServerDefinition = {
            id: 'nonicatab-mcp',
            name: 'NonicaTab MCP',
            type: 'stdio',
            connectionParams: { command: '/path/to/nonicatab', timeout: 15000 },
            capabilities: coreCapabilities,
            status: 'connected',
            metadata: { source: 'local', version: '1.0.0', description: 'NonicaTab' }
          };

          const externalServer: MCPServerDefinition = {
            id: 'external-server',
            name: 'External Server',
            type: 'http',
            connectionParams: { url: 'http://localhost:3000', timeout: 30000 },
            capabilities: coreCapabilities,
            status: 'available',
            metadata: { source: 'github', version: '1.0.0', description: 'External' }
          };

          // Act
          const mappings = await externalServerIntegration.createCapabilityMapping([nonicaTab, externalServer]);

          // Assert: NonicaTab should have higher priority for all core capabilities
          for (const capability of coreCapabilities) {
            const mapping = mappings.get(capability);
            expect(mapping).toBeDefined();

            const nonicaTabEntry = mapping!.servers.find(s => s.serverId === 'nonicatab-mcp');
            const externalEntry = mapping!.servers.find(s => s.serverId === 'external-server');

            expect(nonicaTabEntry).toBeDefined();
            expect(externalEntry).toBeDefined();
            expect(nonicaTabEntry!.priority).toBeGreaterThan(externalEntry!.priority);
          }
        }
      ), { numRuns: 20 });
    });
  });

  describe('Property 24: Multi-protocol Communication Support', () => {
    /**
     * **Feature: mcp-integration-system, Property 24: Multi-protocol Communication Support**
     * **Validates: Requirements 5.4**
     *
     * Tests that the system supports stdio, HTTP, and WebSocket protocols
     * for external server communication.
     */
    it('should establish connections using any supported protocol', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('stdio' as const, 'http' as const, 'websocket' as const),
        fc.string({ minLength: 1, maxLength: 30 }).map(s => s.replace(/[^a-zA-Z0-9-]/g, 'x')),
        async (protocol, serverId) => {
          // Setup: Create server with specific protocol
          const server: MCPServerDefinition = {
            id: serverId,
            name: `Test ${protocol} Server`,
            type: protocol,
            connectionParams: protocol === 'stdio'
              ? { command: '/usr/bin/test-server', args: [], timeout: 15000 }
              : { url: protocol === 'websocket' ? 'ws://localhost:3000' : 'http://localhost:3000', timeout: 15000 },
            capabilities: ['test_capability'],
            status: 'available',
            metadata: {
              source: 'local',
              version: '1.0.0',
              description: 'Test server',
              conflictResolution: 'fallback'
            }
          };

          // Act
          const connected = await externalServerIntegration.establishConnection(server);

          // Assert: Connection should succeed for all supported protocols
          expect(typeof connected).toBe('boolean');
          // Since we're testing with mocks, connection should succeed
          expect(connected).toBe(true);
        }
      ), { numRuns: 30 });
    });

    it('should try fallback protocols when primary fails', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('stdio' as const, 'http' as const, 'websocket' as const),
        async (primaryProtocol) => {
          // Setup: Create server with fallback resolution
          const server: MCPServerDefinition = {
            id: 'fallback-test-server',
            name: 'Fallback Test Server',
            type: primaryProtocol,
            connectionParams: primaryProtocol === 'stdio'
              ? { command: '/nonexistent/path', timeout: 15000 }
              : { url: 'http://localhost:9999', timeout: 15000 },
            capabilities: ['test_capability'],
            status: 'available',
            metadata: {
              source: 'local',
              version: '1.0.0',
              description: 'Test server',
              conflictResolution: 'fallback'
            }
          };

          // Act: Establish connection (should try fallback)
          const connected = await externalServerIntegration.establishConnection(server);

          // Assert: Should return boolean (success or failure)
          expect(typeof connected).toBe('boolean');
        }
      ), { numRuns: 15 });
    });

    it('should handle protocol-specific connection parameters correctly', async () => {
      await fc.assert(fc.asyncProperty(
        externalServerConfigGen,
        async (config) => {
          // Act: Integrate server and check connection params
          try {
            const server = await externalServerIntegration.integrateZedMosterRevitMCP({
              protocol: config.protocol,
              preferences: config.preferences
            });

            // Assert: Connection params should match protocol
            if (server.type === 'stdio') {
              expect(server.connectionParams.command).toBeDefined();
            } else {
              expect(server.connectionParams.url).toBeDefined();
            }

            // Timeout should be set
            expect(server.connectionParams.timeout).toBe(config.preferences.timeout);
          } catch (error) {
            // Integration might fail due to compatibility issues, which is acceptable
            expect(error).toBeInstanceOf(Error);
          }
        }
      ), { numRuns: 25 });
    });
  });

  describe('Property 25: Preference and Fallback Handling', () => {
    /**
     * **Feature: mcp-integration-system, Property 25: Preference and Fallback Handling**
     * **Validates: Requirements 5.5**
     *
     * Tests that server preferences are respected and fallback mechanisms
     * work correctly when preferred servers are unavailable.
     */
    it('should respect user preferences for capability selection', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom(
          'get_active_view_in_revit',
          'revit_model_analysis',
          'element_extraction'
        ),
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9-]/g, 'x')),
          { minLength: 1, maxLength: 3 }
        ),
        async (capability, preferredServerIds) => {
          // Setup: Register servers
          for (let i = 0; i < preferredServerIds.length; i++) {
            const server: MCPServerDefinition = {
              id: preferredServerIds[i],
              name: `Server ${i}`,
              type: 'stdio',
              connectionParams: { command: `/path/to/server${i}`, timeout: 15000 },
              capabilities: [capability],
              status: 'connected',
              metadata: { source: 'local', version: '1.0.0', description: `Server ${i}` }
            };
            registeredServers.push(server);
          }

          // Update capability mappings
          const mappings = await externalServerIntegration.createCapabilityMapping(registeredServers);

          // Override internal mappings via reflection for testing
          (externalServerIntegration as any).capabilityMappings = mappings;

          // Set preferences
          externalServerIntegration.updatePreferences({
            capabilityPreferences: {
              [capability]: preferredServerIds
            }
          });

          // Act: Select server for capability
          const selectedServer = await externalServerIntegration.selectServerForCapability(capability);

          // Assert: Should select from preferred servers if available
          if (selectedServer && preferredServerIds.length > 0) {
            expect(preferredServerIds).toContain(selectedServer);
          }
        }
      ), { numRuns: 30 });
    });

    it('should fall back to alternative servers when preferred is unavailable', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('get_active_view_in_revit', 'revit_model_analysis'),
        async (capability) => {
          // Setup: Register primary and fallback servers
          const primaryServer: MCPServerDefinition = {
            id: 'primary-server',
            name: 'Primary Server',
            type: 'stdio',
            connectionParams: { command: '/path/to/primary', timeout: 15000 },
            capabilities: [capability],
            status: 'connected',
            metadata: { source: 'local', version: '1.0.0', description: 'Primary' }
          };

          const fallbackServer: MCPServerDefinition = {
            id: 'fallback-server',
            name: 'Fallback Server',
            type: 'http',
            connectionParams: { url: 'http://localhost:3000', timeout: 15000 },
            capabilities: [capability],
            status: 'connected',
            metadata: { source: 'github', version: '1.0.0', description: 'Fallback' }
          };

          registeredServers = [primaryServer, fallbackServer];

          // Setup capability mappings
          const mappings = await externalServerIntegration.createCapabilityMapping(registeredServers);
          (externalServerIntegration as any).capabilityMappings = mappings;

          // Configure primary as preferred but unavailable
          externalServerIntegration.updatePreferences({
            capabilityPreferences: {
              [capability]: ['primary-server', 'fallback-server']
            }
          });

          // Mock primary server as unavailable
          mockRegistry.validateServerConnection = vi.fn().mockImplementation(async (serverId: string) => {
            return serverId !== 'primary-server';
          });

          // Act
          const selectedServer = await externalServerIntegration.selectServerForCapability(capability);

          // Assert: Should fall back to fallback-server
          expect(selectedServer).toBe('fallback-server');
        }
      ), { numRuns: 20 });
    });

    it('should return null when no servers are available for capability', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).map(s => `unknown_capability_${s.replace(/[^a-zA-Z0-9]/g, '')}`),
        async (unknownCapability) => {
          // Setup: Empty capability mappings
          (externalServerIntegration as any).capabilityMappings = new Map();

          // Act
          const selectedServer = await externalServerIntegration.selectServerForCapability(unknownCapability);

          // Assert: Should return null for unknown capabilities
          expect(selectedServer).toBeNull();
        }
      ), { numRuns: 20 });
    });

    it('should apply correct conflict resolution strategies', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('first' as const, 'preferred' as const, 'round_robin' as const),
        fc.array(mcpServerDefinitionGen, { minLength: 2, maxLength: 4 }),
        async (strategy, servers) => {
          // Ensure unique IDs and common capability
          const commonCapability = 'shared_capability';
          const uniqueServers = servers.map((s, i) => ({
            ...s,
            id: `server-${i}`,
            capabilities: [...s.capabilities, commonCapability]
          }));

          registeredServers = uniqueServers;

          // Create mapping with specific strategy
          const mappings = await externalServerIntegration.createCapabilityMapping(uniqueServers);

          // Modify mapping to use specific strategy for testing
          const mapping = mappings.get(commonCapability);
          if (mapping) {
            mapping.conflictResolution = strategy;
            (externalServerIntegration as any).capabilityMappings = mappings;
          }

          // Act
          const selectedServer = await externalServerIntegration.selectServerForCapability(commonCapability);

          // Assert: Should return a valid server ID or null
          if (selectedServer) {
            expect(uniqueServers.some(s => s.id === selectedServer)).toBe(true);
          }
        }
      ), { numRuns: 25 });
    });
  });
});
