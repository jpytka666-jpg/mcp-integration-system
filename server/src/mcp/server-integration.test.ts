/**
 * Tests for MCP Server Integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MCPConfigManager } from './config-manager.js';
import { MCPServerIntegration } from './server-integration.js';
import { MCPConfigFile } from './types.js';

describe('MCPServerIntegration', () => {
  const testDir = '.test-kiro-mcp-server';
  let configManager: MCPConfigManager;
  let serverIntegration: MCPServerIntegration;

  beforeEach(() => {
    fs.mkdirSync(path.join(testDir, 'settings'), { recursive: true });
    configManager = new MCPConfigManager(testDir);
    serverIntegration = new MCPServerIntegration(configManager);

    // Set up test config with a simple echo command
    const config: MCPConfigFile = {
      mcpServers: {
        'echo-server': {
          command: 'echo',
          args: ['hello'],
        },
        'disabled-server': {
          command: 'echo',
          args: ['disabled'],
          disabled: true,
        },
        'invalid-server': {
          command: 'nonexistent-command-xyz',
          args: [],
        },
      },
    };
    fs.writeFileSync(
      path.join(testDir, 'settings', 'mcp.json'),
      JSON.stringify(config)
    );
  });

  afterEach(() => {
    // Stop all servers before cleanup
    serverIntegration.stopAllServers();
    
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('executeServerCommand', () => {
    it('should execute a valid server command', () => {
      const result = serverIntegration.executeServerCommand('echo-server');
      expect(result.success).toBe(true);
      expect(result.output).toContain('hello');
    });

    it('should fail for non-existent server', () => {
      const result = serverIntegration.executeServerCommand('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail for disabled server', () => {
      const result = serverIntegration.executeServerCommand('disabled-server');
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should fail for invalid command', () => {
      const result = serverIntegration.executeServerCommand('invalid-server');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('startServer', () => {
    it('should fail for non-existent server', () => {
      const result = serverIntegration.startServer('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail for disabled server', () => {
      const result = serverIntegration.startServer('disabled-server');
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });
  });

  describe('stopServer', () => {
    it('should fail for non-running server', () => {
      const result = serverIntegration.stopServer('echo-server');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not running');
    });
  });

  describe('restartServer', () => {
    it('should handle restart of non-running server', () => {
      const result = serverIntegration.restartServer('echo-server');
      // Should attempt to start even if not running
      expect(result).toHaveProperty('success');
    });
  });

  describe('getRunningServer', () => {
    it('should return undefined for non-running server', () => {
      const server = serverIntegration.getRunningServer('echo-server');
      expect(server).toBeUndefined();
    });
  });

  describe('getAllRunningServers', () => {
    it('should return empty array when no servers running', () => {
      const servers = serverIntegration.getAllRunningServers();
      expect(servers).toEqual([]);
    });
  });

  describe('handleServerResponse', () => {
    it('should parse JSON response', () => {
      const result = serverIntegration.handleServerResponse('{"key": "value"}');
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ key: 'value' });
    });

    it('should handle non-JSON response', () => {
      const result = serverIntegration.handleServerResponse('plain text');
      expect(result.success).toBe(true);
      expect(result.result).toBe('plain text');
    });
  });

  describe('handleServerError', () => {
    it('should handle ENOENT error', () => {
      const result = serverIntegration.handleServerError('ENOENT: command not found', 'echo-server');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle timeout error', () => {
      const result = serverIntegration.handleServerError('ETIMEDOUT', 'echo-server');
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should handle connection refused error', () => {
      const result = serverIntegration.handleServerError('ECONNREFUSED', 'echo-server');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });

    it('should handle generic error', () => {
      const result = serverIntegration.handleServerError('Some error', 'echo-server');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Server error');
    });
  });

  describe('isServerHealthy', () => {
    it('should return false for non-running server', () => {
      const healthy = serverIntegration.isServerHealthy('echo-server');
      expect(healthy).toBe(false);
    });
  });

  describe('getServerUptime', () => {
    it('should return null for non-running server', () => {
      const uptime = serverIntegration.getServerUptime('echo-server');
      expect(uptime).toBeNull();
    });
  });

  describe('stopAllServers', () => {
    it('should return empty map when no servers running', () => {
      const results = serverIntegration.stopAllServers();
      expect(results.size).toBe(0);
    });
  });
});
