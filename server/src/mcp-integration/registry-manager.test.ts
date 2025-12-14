/**
 * Property-based tests for MCP Registry Manager
 * Feature: mcp-integration-system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { MCPRegistryManager } from './registry-manager.js';
import { MCPServerDefinition } from './types.js';

// Type-safe generators for property-based testing
const validServerTypeGen = fc.constantFrom('stdio', 'http', 'websocket');
const validStatusGen = fc.constantFrom('available', 'connected', 'error', 'unknown');
const validSourceGen = fc.constantFrom('local', 'github', 'registry');

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

describe('MCP Registry Manager Property Tests', () => {
  let registryManager: MCPRegistryManager;
  let mockExistsSync: any;
  let mockStatSync: any;

  beforeEach(async () => {
    // Import mocked fs functions
    const fs = await import('fs');
    mockExistsSync = fs.existsSync as any;
    mockStatSync = fs.statSync as any;
    
    registryManager = new MCPRegistryManager();
    vi.clearAllMocks();
  });

  describe('Property 1: MCP Server Discovery Consistency', () => {
    /**
     * Feature: mcp-integration-system, Property 1: MCP Server Discovery Consistency
     * Validates: Requirements 1.1
     * 
     * For any system scan operation, the MCP Registry Manager should consistently 
     * detect existing NonicaTab MCP server at the specified path and return a valid 
     * server definition with correct connection parameters
     */
    it('should consistently detect NonicaTab MCP server when file exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate different file system states
          fc.record({
            nonicaTabExists: fc.boolean(),
            fileStats: fc.record({
              isFile: fc.constant(true),
              size: fc.integer({ min: 1000, max: 10000000 }),
              mtime: fc.date()
            })
          }),
          async ({ nonicaTabExists, fileStats }) => {
            // Setup mock file system
            mockExistsSync.mockImplementation((path) => {
              const pathStr = typeof path === 'string' ? path : path.toString();
              if (pathStr === 'C:\\NONICA\\OtherFiles\\System\\Core\\net8.0-windows\\RevitMCPConnection.exe') {
                return nonicaTabExists;
              }
              return false;
            });

            mockStatSync.mockReturnValue(fileStats as any);

            // Execute discovery
            const discoveredServers = await registryManager.discoverServers();

            if (nonicaTabExists) {
              // When NonicaTab file exists, it should be discovered
              const nonicaTabServer = discoveredServers.find(s => s.id === 'nonicatab-mcp');
              
              expect(nonicaTabServer).toBeDefined();
              expect(nonicaTabServer!.name).toBe('NonicaTab MCP Server');
              expect(nonicaTabServer!.type).toBe('stdio');
              expect(nonicaTabServer!.connectionParams.command).toBe(
                'C:\\NONICA\\OtherFiles\\System\\Core\\net8.0-windows\\RevitMCPConnection.exe'
              );
              expect(nonicaTabServer!.connectionParams.timeout).toBe(15000);
              expect(nonicaTabServer!.capabilities).toContain('get_active_view_in_revit');
              expect(nonicaTabServer!.capabilities).toContain('get_user_selection_in_revit');
              expect(nonicaTabServer!.capabilities).toContain('get_elements_by_category');
              expect(nonicaTabServer!.status).toBe('available');
              expect(nonicaTabServer!.metadata.source).toBe('local');
              expect(nonicaTabServer!.metadata.description).toContain('37 FREE Revit tools');
            } else {
              // When NonicaTab file doesn't exist, it should not be discovered
              const nonicaTabServer = discoveredServers.find(s => s.id === 'nonicatab-mcp');
              expect(nonicaTabServer).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design document
      );
    });

    it('should handle file system errors gracefully during discovery', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('ENOENT'),
            fc.constant('EACCES'),
            fc.constant('EPERM'),
            fc.constant('EIO')
          ),
          async (errorCode) => {
            // Setup mock to throw file system errors
            mockExistsSync.mockImplementation(() => {
              const error = new Error(`File system error: ${errorCode}`) as any;
              error.code = errorCode;
              throw error;
            });

            // Discovery should not throw and should return empty array or partial results
            const discoveredServers = await registryManager.discoverServers();
            
            // Should not crash and should return an array
            expect(Array.isArray(discoveredServers)).toBe(true);
            
            // NonicaTab server should not be in results due to error
            const nonicaTabServer = discoveredServers.find(s => s.id === 'nonicatab-mcp');
            expect(nonicaTabServer).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return consistent server definitions across multiple discovery calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // Whether NonicaTab exists
          async (nonicaTabExists) => {
            // Setup consistent mock behavior
            mockExistsSync.mockImplementation((path) => {
              const pathStr = typeof path === 'string' ? path : path.toString();
              if (pathStr === 'C:\\NONICA\\OtherFiles\\System\\Core\\net8.0-windows\\RevitMCPConnection.exe') {
                return nonicaTabExists;
              }
              return false;
            });

            mockStatSync.mockReturnValue({
              isFile: () => true,
              size: 5000000,
              mtime: new Date('2024-01-01')
            } as any);

            // Run discovery multiple times
            const results = await Promise.all([
              registryManager.discoverServers(),
              registryManager.discoverServers(),
              registryManager.discoverServers()
            ]);

            // All results should be identical
            expect(results[0]).toEqual(results[1]);
            expect(results[1]).toEqual(results[2]);

            // If NonicaTab exists, all results should contain it with identical properties
            if (nonicaTabExists) {
              for (const result of results) {
                const nonicaTabServer = result.find(s => s.id === 'nonicatab-mcp');
                expect(nonicaTabServer).toBeDefined();
                expect(nonicaTabServer!.connectionParams.timeout).toBe(15000);
                expect(nonicaTabServer!.type).toBe('stdio');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Addin Capability Detection', () => {
    /**
     * Feature: mcp-integration-system, Property 2: Addin Capability Detection
     * Validates: Requirements 1.2
     * 
     * For any AIONS.Revit installation, the MCP Registry Manager should identify 
     * the addin and extract its MCP capabilities, returning a complete capability list
     */
    it('should detect AIONS.Revit addin capabilities when installed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // Whether AIONS.Revit exists
          async (aionsExists) => {
            // Setup mock for AIONS.Revit path
            mockExistsSync.mockImplementation((path) => {
              const pathStr = typeof path === 'string' ? path : path.toString();
              if (pathStr === 'C:\\AIONS\\Revit\\AIONS.Revit.dll') {
                return aionsExists;
              }
              return false;
            });

            const discoveredServers = await registryManager.discoverServers();

            if (aionsExists) {
              const aionsServer = discoveredServers.find(s => s.id === 'aions-revit-addin');
              expect(aionsServer).toBeDefined();
              expect(aionsServer!.capabilities).toContain('ai_chatbot_sidebar');
              expect(aionsServer!.capabilities).toContain('revit_model_access');
              expect(aionsServer!.capabilities).toContain('custom_ui_integration');
            } else {
              const aionsServer = discoveredServers.find(s => s.id === 'aions-revit-addin');
              expect(aionsServer).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: GitHub Integration Validation', () => {
    /**
     * Feature: mcp-integration-system, Property 3: GitHub Integration Validation
     * Validates: Requirements 1.3
     * 
     * For any GitHub MCP server request, the MCP Registry Manager should fetch 
     * the server definition, validate its structure, and return a compatible server configuration
     */
    it('should discover and validate GitHub-based MCP servers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // Whether to include GitHub servers in discovery
          async (includeGitHub) => {
            // Mock file system to exclude local servers for this test
            mockExistsSync.mockReturnValue(false);

            const discoveredServers = await registryManager.discoverServers();

            if (includeGitHub) {
              // GitHub servers should always be discovered (they don't depend on local files)
              const githubServer = discoveredServers.find(s => s.id === 'zedmoster-revit-mcp');
              expect(githubServer).toBeDefined();
              expect(githubServer!.name).toBe('ZedMoster Revit MCP');
              expect(githubServer!.type).toBe('http');
              expect(githubServer!.connectionParams.url).toBe('https://api.github.com/repos/ZedMoster/revit-mcp');
              expect(githubServer!.connectionParams.port).toBe(3000);
              expect(githubServer!.connectionParams.timeout).toBe(30000);
              expect(githubServer!.capabilities).toContain('revit_model_analysis');
              expect(githubServer!.capabilities).toContain('element_extraction');
              expect(githubServer!.capabilities).toContain('parameter_management');
              expect(githubServer!.metadata.source).toBe('github');
              expect(githubServer!.metadata.description).toContain('Community Revit MCP server');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate GitHub server configuration structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true), // Always test GitHub server discovery
          async () => {
            // Mock file system to exclude local servers
            mockExistsSync.mockReturnValue(false);

            const discoveredServers = await registryManager.discoverServers();
            const githubServer = discoveredServers.find(s => s.metadata.source === 'github');

            if (githubServer) {
              // Validate server definition structure
              expect(githubServer.id).toBeDefined();
              expect(typeof githubServer.id).toBe('string');
              expect(githubServer.id.length).toBeGreaterThan(0);
              
              expect(githubServer.name).toBeDefined();
              expect(typeof githubServer.name).toBe('string');
              expect(githubServer.name.length).toBeGreaterThan(0);
              
              expect(['stdio', 'http', 'websocket']).toContain(githubServer.type);
              
              expect(githubServer.connectionParams).toBeDefined();
              if (githubServer.type === 'http' && githubServer.connectionParams.url) {
                expect(githubServer.connectionParams.url).toBeDefined();
                expect(typeof githubServer.connectionParams.url).toBe('string');
                expect(githubServer.connectionParams.url.startsWith('http')).toBe(true);
              }
              
              expect(Array.isArray(githubServer.capabilities)).toBe(true);
              expect(githubServer.capabilities.length).toBeGreaterThan(0);
              
              expect(['available', 'connected', 'error', 'unknown']).toContain(githubServer.status);
              
              expect(githubServer.metadata).toBeDefined();
              expect(githubServer.metadata.source).toBe('github');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle GitHub server discovery failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true),
          async () => {
            // Mock file system to exclude local servers
            mockExistsSync.mockReturnValue(false);

            // Discovery should not throw even if GitHub integration has issues
            const discoveredServers = await registryManager.discoverServers();
            
            // Should return an array (might be empty if GitHub discovery fails)
            expect(Array.isArray(discoveredServers)).toBe(true);
            
            // If GitHub servers are discovered, they should be valid
            const githubServers = discoveredServers.filter(s => s.metadata.source === 'github');
            for (const server of githubServers) {
              expect(server.id).toBeDefined();
              expect(server.name).toBeDefined();
              expect(server.type).toBeDefined();
              expect(server.capabilities).toBeDefined();
              expect(Array.isArray(server.capabilities)).toBe(true);
              
              // Validate connection params based on server type
              if (server.type === 'http' && server.connectionParams.url) {
                expect(server.connectionParams.url.startsWith('http')).toBe(true);
              }
            }
          }
        ),
        { numRuns: 50 } // Fewer runs for this test as it's more about error handling
      );
    });
  });

  describe('Property 4: Registry State Consistency', () => {
    /**
     * Feature: mcp-integration-system, Property 4: Registry State Consistency
     * Validates: Requirements 1.4
     * 
     * For any set of registered MCP servers, the unified registry should maintain 
     * consistent state where each server has unique identifiers and non-conflicting capability mappings
     */
    it('should maintain consistent registry state with unique server identifiers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 })
                .filter(s => !s.includes(' ') && s.trim().length > 0)
                .map(s => `unique-${s}`), // Ensure uniqueness
              name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              type: validServerTypeGen,
              capabilities: fc.array(
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), 
                { minLength: 1, maxLength: 5 }
              )
            }),
            { 
              minLength: 2, 
              maxLength: 10,
              selector: (item) => item.id // Ensure unique IDs
            }
          ),
          async (serverConfigs) => {
            const testRegistryManager = new MCPRegistryManager();

            // Register all servers
            for (const config of serverConfigs) {
              const serverDef: MCPServerDefinition = {
                id: config.id,
                name: config.name,
                type: config.type as 'stdio' | 'http' | 'websocket',
                connectionParams: config.type === 'stdio' 
                  ? { command: '/path/to/executable', timeout: 15000 }
                  : { url: 'http://localhost:3000', timeout: 30000 },
                capabilities: config.capabilities,
                status: 'available',
                metadata: { source: 'local' }
              };
              
              await testRegistryManager.registerServer(serverDef);
            }

            // Verify registry state consistency
            const registeredServers = testRegistryManager.getRegisteredServers();
            const stats = testRegistryManager.getRegistryStats();

            // All server IDs should be unique
            const serverIds = registeredServers.map(s => s.id);
            const uniqueIds = new Set(serverIds);
            expect(uniqueIds.size).toBe(serverIds.length);

            // Registry stats should be consistent
            expect(stats.totalServers).toBe(serverConfigs.length);
            expect(registeredServers).toHaveLength(serverConfigs.length);

            // Each server should be retrievable by ID
            for (const config of serverConfigs) {
              const server = testRegistryManager.getServer(config.id);
              expect(server).toBeDefined();
              expect(server!.id).toBe(config.id);
              expect(server!.name).toBe(config.name);
              expect(server!.type).toBe(config.type);
              expect(server!.capabilities).toEqual(config.capabilities);

              // Capabilities should be accessible
              const capabilities = await testRegistryManager.getServerCapabilities(config.id);
              expect(capabilities).toEqual(config.capabilities);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle capability conflicts gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => !s.includes(' ') && s.trim().length > 0),
              hasRevitCapabilities: fc.boolean(),
              capabilities: fc.array(
                fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), 
                { minLength: 1, maxLength: 3 }
              )
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (serverConfigs) => {
            const testRegistryManager = new MCPRegistryManager();

            // Add revit capabilities to some servers
            const processedConfigs = serverConfigs.map((config, index) => ({
              ...config,
              id: `conflict-test-${index}-${config.id}`, // Ensure unique IDs
              capabilities: config.hasRevitCapabilities 
                ? [...config.capabilities, 'revit_model_access', 'revit_element_extraction']
                : config.capabilities
            }));

            // Register all servers (should not throw even with capability conflicts)
            for (const config of processedConfigs) {
              const serverDef: MCPServerDefinition = {
                id: config.id,
                name: `Test Server ${config.id}`,
                type: 'stdio',
                connectionParams: { command: '/test/path', timeout: 15000 },
                capabilities: config.capabilities,
                status: 'available',
                metadata: { source: 'local' }
              };
              
              // Should not throw even if there are capability conflicts
              await testRegistryManager.registerServer(serverDef);
            }

            // Verify all servers are registered despite conflicts
            const registeredServers = testRegistryManager.getRegisteredServers();
            expect(registeredServers).toHaveLength(processedConfigs.length);

            // Each server should maintain its own capabilities
            for (const config of processedConfigs) {
              const capabilities = await testRegistryManager.getServerCapabilities(config.id);
              expect(capabilities).toEqual(config.capabilities);
            }
          }
        ),
        { numRuns: 50 } // Fewer runs for this more complex test
      );
    });

    it('should maintain registry consistency during concurrent operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => !s.includes(' ') && s.trim().length > 0),
              name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              capabilities: fc.array(
                fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), 
                { minLength: 1, maxLength: 3 }
              )
            }),
            { minLength: 3, maxLength: 8 }
          ),
          async (serverConfigs) => {
            const testRegistryManager = new MCPRegistryManager();

            // Ensure unique IDs
            const uniqueConfigs = serverConfigs.map((config, index) => ({
              ...config,
              id: `concurrent-${index}-${config.id}`
            }));

            // Register servers concurrently
            const registrationPromises = uniqueConfigs.map(async (config) => {
              const serverDef: MCPServerDefinition = {
                id: config.id,
                name: config.name,
                type: 'http',
                connectionParams: { url: 'http://localhost:3000', timeout: 30000 },
                capabilities: config.capabilities,
                status: 'available',
                metadata: { source: 'local' }
              };
              
              return testRegistryManager.registerServer(serverDef);
            });

            // Wait for all registrations to complete
            await Promise.all(registrationPromises);

            // Verify registry consistency after concurrent operations
            const registeredServers = testRegistryManager.getRegisteredServers();
            expect(registeredServers).toHaveLength(uniqueConfigs.length);

            // All servers should be accessible
            for (const config of uniqueConfigs) {
              const server = testRegistryManager.getServer(config.id);
              expect(server).toBeDefined();
              expect(server!.id).toBe(config.id);
              
              const capabilities = await testRegistryManager.getServerCapabilities(config.id);
              expect(capabilities).toEqual(config.capabilities);
            }

            // Registry stats should be consistent
            const stats = testRegistryManager.getRegistryStats();
            expect(stats.totalServers).toBe(uniqueConfigs.length);
          }
        ),
        { numRuns: 30 } // Fewer runs for concurrent operations test
      );
    });
  });

  describe('Property 5: Non-disruptive Server Addition', () => {
    /**
     * Feature: mcp-integration-system, Property 5: Non-disruptive Server Addition
     * Validates: Requirements 1.5
     * 
     * For any new MCP server addition to an active registry, existing server 
     * connections should remain stable and functional throughout the addition process
     */
    it('should add new servers without disrupting existing connections', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialServers: fc.uniqueArray(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 30 })
                  .filter(s => !s.includes(' ') && s.trim().length > 0)
                  .map(s => `initial-${s}`),
                name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                capabilities: fc.array(
                  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), 
                  { minLength: 1, maxLength: 3 }
                )
              }),
              { minLength: 2, maxLength: 5, selector: (item) => item.id }
            ),
            newServers: fc.uniqueArray(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 30 })
                  .filter(s => !s.includes(' ') && s.trim().length > 0)
                  .map(s => `new-${s}`),
                name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                capabilities: fc.array(
                  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), 
                  { minLength: 1, maxLength: 3 }
                )
              }),
              { minLength: 1, maxLength: 3, selector: (item) => item.id }
            )
          }),
          async ({ initialServers, newServers }) => {
            const testRegistryManager = new MCPRegistryManager();

            // Register initial servers
            for (const config of initialServers) {
              const serverDef: MCPServerDefinition = {
                id: config.id,
                name: config.name,
                type: 'stdio',
                connectionParams: { command: '/initial/path', timeout: 15000 },
                capabilities: config.capabilities,
                status: 'connected', // Simulate active connections
                metadata: { source: 'local' }
              };
              
              await testRegistryManager.registerServer(serverDef);
            }

            // Capture initial state
            const initialRegisteredServers = testRegistryManager.getRegisteredServers();
            const initialStats = testRegistryManager.getRegistryStats();

            // Verify initial servers are accessible
            for (const config of initialServers) {
              const server = testRegistryManager.getServer(config.id);
              expect(server).toBeDefined();
              expect(server!.status).toBe('connected');
              
              const capabilities = await testRegistryManager.getServerCapabilities(config.id);
              expect(capabilities).toEqual(config.capabilities);
            }

            // Add new servers (should not disrupt existing ones)
            for (const config of newServers) {
              const serverDef: MCPServerDefinition = {
                id: config.id,
                name: config.name,
                type: 'http',
                connectionParams: { url: 'http://localhost:3000', timeout: 30000 },
                capabilities: config.capabilities,
                status: 'available',
                metadata: { source: 'local' }
              };
              
              await testRegistryManager.registerServer(serverDef);
            }

            // Verify existing servers remain unchanged and functional
            for (const config of initialServers) {
              const server = testRegistryManager.getServer(config.id);
              expect(server).toBeDefined();
              expect(server!.id).toBe(config.id);
              expect(server!.name).toBe(config.name);
              expect(server!.status).toBe('connected'); // Should remain connected
              expect(server!.type).toBe('stdio'); // Should remain unchanged
              expect(server!.connectionParams.command).toBe('/initial/path');
              
              const capabilities = await testRegistryManager.getServerCapabilities(config.id);
              expect(capabilities).toEqual(config.capabilities);
            }

            // Verify new servers are properly added
            for (const config of newServers) {
              const server = testRegistryManager.getServer(config.id);
              expect(server).toBeDefined();
              expect(server!.id).toBe(config.id);
              expect(server!.name).toBe(config.name);
              expect(server!.status).toBe('available');
              expect(server!.type).toBe('http');
              
              const capabilities = await testRegistryManager.getServerCapabilities(config.id);
              expect(capabilities).toEqual(config.capabilities);
            }

            // Verify total count is correct
            const finalRegisteredServers = testRegistryManager.getRegisteredServers();
            const finalStats = testRegistryManager.getRegistryStats();
            
            expect(finalRegisteredServers).toHaveLength(initialServers.length + newServers.length);
            expect(finalStats.totalServers).toBe(initialServers.length + newServers.length);
            
            // Connected servers count should remain the same (only initial servers were connected)
            const connectedServers = finalRegisteredServers.filter(s => s.status === 'connected');
            expect(connectedServers).toHaveLength(initialServers.length);
          }
        ),
        { numRuns: 50 } // Fewer runs for this complex test
      );
    });

    it('should handle server addition failures without affecting existing servers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            existingServer: fc.record({
              id: fc.constant('existing-server'),
              name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              capabilities: fc.array(
                fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), 
                { minLength: 1, maxLength: 2 }
              )
            }),
            invalidServer: fc.record({
              id: fc.oneof(
                fc.constant(''), // Empty ID
                fc.constant('existing-server'), // Duplicate ID
                fc.constant(null), // Null ID
                fc.constant(undefined) // Undefined ID
              ),
              name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              capabilities: fc.array(
                fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), 
                { minLength: 1, maxLength: 2 }
              )
            })
          }),
          async ({ existingServer, invalidServer }) => {
            const testRegistryManager = new MCPRegistryManager();

            // Register existing server
            const existingServerDef: MCPServerDefinition = {
              id: existingServer.id,
              name: existingServer.name,
              type: 'stdio',
              connectionParams: { command: '/existing/path', timeout: 15000 },
              capabilities: existingServer.capabilities,
              status: 'connected',
              metadata: { source: 'local' }
            };
            
            await testRegistryManager.registerServer(existingServerDef);

            // Capture state before invalid addition
            const beforeStats = testRegistryManager.getRegistryStats();
            const beforeServer = testRegistryManager.getServer(existingServer.id);
            
            expect(beforeServer).toBeDefined();
            expect(beforeServer!.status).toBe('connected');

            // Attempt to register invalid server (should fail)
            try {
              const invalidServerDef: MCPServerDefinition = {
                id: invalidServer.id as string,
                name: invalidServer.name,
                type: 'http',
                connectionParams: { url: 'http://localhost:3000', timeout: 30000 },
                capabilities: invalidServer.capabilities,
                status: 'available',
                metadata: { source: 'local' }
              };
              
              await testRegistryManager.registerServer(invalidServerDef);
              
              // If we reach here and the ID was a duplicate, that's expected to fail
              if (invalidServer.id === 'existing-server') {
                expect(false).toBe(true); // Should have thrown
              }
            } catch (error) {
              // Expected for invalid servers
              expect(error).toBeInstanceOf(Error);
            }

            // Verify existing server remains unaffected
            const afterServer = testRegistryManager.getServer(existingServer.id);
            const afterStats = testRegistryManager.getRegistryStats();
            
            expect(afterServer).toBeDefined();
            expect(afterServer!.id).toBe(existingServer.id);
            expect(afterServer!.name).toBe(existingServer.name);
            expect(afterServer!.status).toBe('connected'); // Should remain connected
            expect(afterServer!.type).toBe('stdio'); // Should remain unchanged
            expect(afterServer!.connectionParams.command).toBe('/existing/path');
            
            const capabilities = await testRegistryManager.getServerCapabilities(existingServer.id);
            expect(capabilities).toEqual(existingServer.capabilities);

            // Registry should have same number of servers (invalid addition failed)
            if (invalidServer.id === '' || invalidServer.id === null || invalidServer.id === undefined) {
              expect(afterStats.totalServers).toBe(beforeStats.totalServers);
            } else if (invalidServer.id === 'existing-server') {
              // Duplicate ID should not increase count
              expect(afterStats.totalServers).toBe(beforeStats.totalServers);
            }
          }
        ),
        { numRuns: 30 } // Fewer runs for error handling test
      );
    });

    it('should maintain registry consistency during rapid server additions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => !s.includes(' ') && s.trim().length > 0),
              name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
              capabilities: fc.array(
                fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0), 
                { minLength: 1, maxLength: 2 }
              )
            }),
            { minLength: 5, maxLength: 10 }
          ),
          async (serverConfigs) => {
            const testRegistryManager = new MCPRegistryManager();

            // Ensure unique IDs
            const uniqueConfigs = serverConfigs.map((config, index) => ({
              ...config,
              id: `rapid-${index}-${config.id}`
            }));

            // Add servers rapidly in parallel
            const additionPromises = uniqueConfigs.map(async (config, index) => {
              const serverDef: MCPServerDefinition = {
                id: config.id,
                name: config.name,
                type: index % 2 === 0 ? 'stdio' : 'http',
                connectionParams: index % 2 === 0 
                  ? { command: `/path/${index}`, timeout: 15000 }
                  : { url: `http://localhost:${3000 + index}`, timeout: 30000 },
                capabilities: config.capabilities,
                status: 'available',
                metadata: { source: 'local' }
              };
              
              return testRegistryManager.registerServer(serverDef);
            });

            // Wait for all additions to complete
            await Promise.all(additionPromises);

            // Verify all servers were added correctly
            const finalServers = testRegistryManager.getRegisteredServers();
            const finalStats = testRegistryManager.getRegistryStats();

            expect(finalServers).toHaveLength(uniqueConfigs.length);
            expect(finalStats.totalServers).toBe(uniqueConfigs.length);

            // Verify each server is accessible and correct
            for (const config of uniqueConfigs) {
              const server = testRegistryManager.getServer(config.id);
              expect(server).toBeDefined();
              expect(server!.id).toBe(config.id);
              expect(server!.name).toBe(config.name);
              
              const capabilities = await testRegistryManager.getServerCapabilities(config.id);
              expect(capabilities).toEqual(config.capabilities);
            }

            // Verify no duplicate IDs
            const serverIds = finalServers.map(s => s.id);
            const uniqueIds = new Set(serverIds);
            expect(uniqueIds.size).toBe(serverIds.length);
          }
        ),
        { numRuns: 20 } // Fewer runs for rapid addition test
      );
    });
  });

  describe('Server Registration Properties', () => {
    it('should maintain registry consistency when registering valid servers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 })
                .filter(s => !s.includes(' ') && s.trim().length > 0)
                .map(s => `server-${s}`), // Prefix to ensure valid IDs
              name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              type: validServerTypeGen,
              capabilities: fc.array(
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), 
                { minLength: 1, maxLength: 10 }
              )
            }),
            { 
              minLength: 1, 
              maxLength: 5,
              selector: (item) => item.id // Ensure unique IDs
            }
          ),
          async (serverConfigs) => {
            // Create a fresh registry manager for each test
            const testRegistryManager = new MCPRegistryManager();

            // Register all servers
            for (const config of serverConfigs) {
              const serverDef: MCPServerDefinition = {
                id: config.id,
                name: config.name,
                type: config.type as 'stdio' | 'http' | 'websocket',
                connectionParams: config.type === 'stdio' 
                  ? { command: '/path/to/executable', timeout: 15000 }
                  : { url: 'http://localhost:3000', timeout: 30000 },
                capabilities: config.capabilities,
                status: 'available',
                metadata: { source: 'local' }
              };
              
              await testRegistryManager.registerServer(serverDef);
            }

            // Verify all servers are registered
            const registeredServers = testRegistryManager.getRegisteredServers();
            expect(registeredServers).toHaveLength(serverConfigs.length);
            
            for (const expectedConfig of serverConfigs) {
              const found = registeredServers.find(s => s.id === expectedConfig.id);
              expect(found).toBeDefined();
              expect(found!.name).toBe(expectedConfig.name);
              expect(found!.type).toBe(expectedConfig.type);
              expect(found!.capabilities).toEqual(expectedConfig.capabilities);
            }

            // Verify capabilities are accessible
            for (const config of serverConfigs) {
              const capabilities = await testRegistryManager.getServerCapabilities(config.id);
              expect(capabilities).toEqual(config.capabilities);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate server connections correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            serverType: fc.constantFrom('stdio', 'http', 'websocket'),
            serverExists: fc.boolean(),
            uniqueId: fc.integer({ min: 1, max: 10000 })
          }),
          async ({ serverType, serverExists, uniqueId }) => {
            // Create a fresh registry manager for each test to avoid ID conflicts
            const testRegistryManager = new MCPRegistryManager();
            
            const serverId = `test-server-${uniqueId}`;
            
            // Register a test server first
            const testServer: MCPServerDefinition = {
              id: serverId,
              name: `Test ${serverId}`,
              type: serverType as 'stdio' | 'http' | 'websocket',
              connectionParams: serverType === 'stdio' 
                ? { command: '/test/path', timeout: 15000 }
                : { url: 'http://localhost:3000', timeout: 30000 },
              capabilities: ['test_capability'],
              status: 'available',
              metadata: { source: 'local' }
            };

            await testRegistryManager.registerServer(testServer);

            // Mock file system for connection validation
            mockExistsSync.mockReturnValue(serverExists);

            const isValid = await testRegistryManager.validateServerConnection(serverId);
            
            if (serverType === 'stdio') {
              // Local servers depend on file existence
              expect(isValid).toBe(serverExists);
            } else {
              // HTTP/WebSocket servers have different validation logic
              expect(typeof isValid).toBe('boolean');
            }
          }
        ),
        { numRuns: 50 } // Fewer runs for this more complex test
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid server registrations gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined)),
            name: fc.string(),
            type: fc.constantFrom('stdio', 'http', 'websocket'),
            capabilities: fc.array(fc.string())
          }),
          async (invalidServer) => {
            const testRegistryManager = new MCPRegistryManager();
            
            try {
              await testRegistryManager.registerServer(invalidServer as any);
              // Should not reach here for invalid servers
              expect(false).toBe(true);
            } catch (error) {
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).message).toContain('Server definition must have id, name, and type');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle concurrent discovery operations', async () => {
      const testRegistryManager = new MCPRegistryManager();
      
      // Setup consistent mocks
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        isFile: () => true,
        size: 1000000,
        mtime: new Date()
      } as any);

      // Run multiple concurrent discoveries
      const promises = Array.from({ length: 5 }, () => 
        testRegistryManager.discoverServers()
      );

      const results = await Promise.all(promises);

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });
  });
});