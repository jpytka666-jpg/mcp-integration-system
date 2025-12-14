/**
 * Tests for MCP Configuration Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MCPConfigManager } from './config-manager.js';
import { MCPConfigFile } from './types.js';

describe('MCPConfigManager', () => {
  const testDir = '.test-kiro-mcp';
  let manager: MCPConfigManager;

  beforeEach(() => {
    // Create test directory structure
    fs.mkdirSync(path.join(testDir, 'settings'), { recursive: true });
    manager = new MCPConfigManager(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('validateConfig', () => {
    it('should validate a correct MCP config', () => {
      const config: MCPConfigFile = {
        mcpServers: {
          'test-server': {
            command: 'uvx',
            args: ['test-package@latest'],
            env: { LOG_LEVEL: 'ERROR' },
            disabled: false,
            autoApprove: ['tool1', 'tool2'],
          },
        },
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object config', () => {
      const result = manager.validateConfig(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_ROOT');
    });

    it('should reject config without mcpServers', () => {
      const result = manager.validateConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_MCP_SERVERS');
    });

    it('should reject server without command', () => {
      const config = {
        mcpServers: {
          'test-server': {
            args: ['test'],
          },
        },
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_COMMAND')).toBe(true);
    });

    it('should reject invalid args type', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'uvx',
            args: 'not-an-array',
          },
        },
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_ARGS')).toBe(true);
    });

    it('should warn about uvx without args', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'uvx',
            args: [],
          },
        },
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'UVX_MISSING_ARGS')).toBe(true);
    });

    it('should warn about disabled servers', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'uvx',
            args: ['test'],
            disabled: true,
          },
        },
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'SERVER_DISABLED')).toBe(true);
    });
  });

  describe('loadMergedConfig', () => {
    it('should return config (may include user-level servers)', () => {
      const result = manager.loadMergedConfig();
      // Result may include user-level config, so just verify structure
      expect(result).toHaveProperty('servers');
      expect(result).toHaveProperty('sources');
      expect(typeof result.servers).toBe('object');
    });

    it('should load workspace config', () => {
      const config: MCPConfigFile = {
        mcpServers: {
          'workspace-server': {
            command: 'uvx',
            args: ['workspace-pkg'],
          },
        },
      };

      fs.writeFileSync(
        path.join(testDir, 'settings', 'mcp.json'),
        JSON.stringify(config)
      );

      const result = manager.loadMergedConfig();
      expect(result.servers['workspace-server']).toBeDefined();
      expect(result.sources['workspace-server']).toBe('workspace');
    });
  });

  describe('saveWorkspaceConfig', () => {
    it('should save valid config', () => {
      const config: MCPConfigFile = {
        mcpServers: {
          'new-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      const result = manager.saveWorkspaceConfig(config);
      expect(result.valid).toBe(true);

      const savedConfig = JSON.parse(
        fs.readFileSync(path.join(testDir, 'settings', 'mcp.json'), 'utf-8')
      );
      expect(savedConfig.mcpServers['new-server']).toBeDefined();
    });

    it('should reject invalid config', () => {
      const config = { mcpServers: null } as unknown as MCPConfigFile;
      const result = manager.saveWorkspaceConfig(config);
      expect(result.valid).toBe(false);
    });
  });

  describe('server lifecycle', () => {
    beforeEach(() => {
      const config: MCPConfigFile = {
        mcpServers: {
          'test-server': {
            command: 'uvx',
            args: ['test-pkg'],
          },
          'disabled-server': {
            command: 'uvx',
            args: ['disabled-pkg'],
            disabled: true,
          },
        },
      };
      fs.writeFileSync(
        path.join(testDir, 'settings', 'mcp.json'),
        JSON.stringify(config)
      );
    });

    it('should connect to enabled server', () => {
      const status = manager.connectServer('test-server');
      expect(status.status).toBe('connected');
      expect(status.lastConnected).toBeDefined();
    });

    it('should not connect to disabled server', () => {
      const status = manager.connectServer('disabled-server');
      expect(status.status).toBe('disconnected');
      expect(status.error).toContain('disabled');
    });

    it('should error on non-existent server', () => {
      const status = manager.connectServer('non-existent');
      expect(status.status).toBe('error');
      expect(status.error).toContain('not found');
    });

    it('should disconnect server', () => {
      manager.connectServer('test-server');
      const status = manager.disconnectServer('test-server');
      expect(status.status).toBe('disconnected');
    });

    it('should reconnect server', () => {
      manager.connectServer('test-server');
      const status = manager.reconnectServer('test-server');
      expect(status.status).toBe('connected');
    });

    it('should get all server statuses', () => {
      const statuses = manager.getAllServerStatuses();
      // At minimum, should have our test servers
      expect(statuses.length).toBeGreaterThanOrEqual(2);
      expect(statuses.some((s) => s.name === 'test-server')).toBe(true);
      expect(statuses.some((s) => s.name === 'disabled-server')).toBe(true);
    });
  });

  describe('setServerEnabled', () => {
    beforeEach(() => {
      const config: MCPConfigFile = {
        mcpServers: {
          'test-server': {
            command: 'uvx',
            args: ['test-pkg'],
          },
        },
      };
      fs.writeFileSync(
        path.join(testDir, 'settings', 'mcp.json'),
        JSON.stringify(config)
      );
    });

    it('should disable a server', () => {
      const result = manager.setServerEnabled('test-server', false);
      expect(result.valid).toBe(true);

      const config = JSON.parse(
        fs.readFileSync(path.join(testDir, 'settings', 'mcp.json'), 'utf-8')
      );
      expect(config.mcpServers['test-server'].disabled).toBe(true);
    });

    it('should enable a server', () => {
      manager.setServerEnabled('test-server', false);
      const result = manager.setServerEnabled('test-server', true);
      expect(result.valid).toBe(true);

      const config = JSON.parse(
        fs.readFileSync(path.join(testDir, 'settings', 'mcp.json'), 'utf-8')
      );
      expect(config.mcpServers['test-server'].disabled).toBe(false);
    });

    it('should error on non-existent server', () => {
      const result = manager.setServerEnabled('non-existent', true);
      expect(result.valid).toBe(false);
    });
  });

  describe('setAutoApprove', () => {
    beforeEach(() => {
      const config: MCPConfigFile = {
        mcpServers: {
          'test-server': {
            command: 'uvx',
            args: ['test-pkg'],
          },
        },
      };
      fs.writeFileSync(
        path.join(testDir, 'settings', 'mcp.json'),
        JSON.stringify(config)
      );
    });

    it('should set auto-approve list', () => {
      const result = manager.setAutoApprove('test-server', ['tool1', 'tool2']);
      expect(result.valid).toBe(true);

      const config = JSON.parse(
        fs.readFileSync(path.join(testDir, 'settings', 'mcp.json'), 'utf-8')
      );
      expect(config.mcpServers['test-server'].autoApprove).toEqual(['tool1', 'tool2']);
    });

    it('should error on non-existent server', () => {
      const result = manager.setAutoApprove('non-existent', ['tool1']);
      expect(result.valid).toBe(false);
    });
  });
});
