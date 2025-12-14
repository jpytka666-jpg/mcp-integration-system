/**
 * Tests for MCP Testing Utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MCPConfigManager } from './config-manager.js';
import { MCPTestingUtils } from './testing-utils.js';
import { MCPConfigFile } from './types.js';

describe('MCPTestingUtils', () => {
  const testDir = '.test-kiro-mcp-utils';
  let configManager: MCPConfigManager;
  let testingUtils: MCPTestingUtils;

  beforeEach(() => {
    fs.mkdirSync(path.join(testDir, 'settings'), { recursive: true });
    configManager = new MCPConfigManager(testDir);
    testingUtils = new MCPTestingUtils(configManager);

    // Set up test config
    const config: MCPConfigFile = {
      mcpServers: {
        'active-server': {
          command: 'uvx',
          args: ['active-pkg@latest'],
          autoApprove: ['tool1', 'tool2'],
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

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('generateSampleCall', () => {
    it('should generate a sample call with arguments', () => {
      const call = testingUtils.generateSampleCall('test-server', 'test-tool', {
        param1: 'value1',
      });

      expect(call.serverName).toBe('test-server');
      expect(call.toolName).toBe('test-tool');
      expect(call.arguments).toEqual({ param1: 'value1' });
    });

    it('should generate a sample call without arguments', () => {
      const call = testingUtils.generateSampleCall('test-server', 'test-tool');

      expect(call.serverName).toBe('test-server');
      expect(call.toolName).toBe('test-tool');
      expect(call.arguments).toEqual({});
    });
  });

  describe('generateSampleCalls', () => {
    it('should generate multiple sample calls', () => {
      const calls = testingUtils.generateSampleCalls('test-server', [
        { name: 'tool1', args: { a: 1 } },
        { name: 'tool2' },
      ]);

      expect(calls).toHaveLength(2);
      expect(calls[0].toolName).toBe('tool1');
      expect(calls[0].arguments).toEqual({ a: 1 });
      expect(calls[1].toolName).toBe('tool2');
    });
  });

  describe('checkServerAvailability', () => {
    it('should return unavailable for non-existent server', () => {
      const result = testingUtils.checkServerAvailability('non-existent');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should return unavailable for disabled server', () => {
      const result = testingUtils.checkServerAvailability('disabled-server');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should return unavailable for not connected server', () => {
      const result = testingUtils.checkServerAvailability('active-server');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('not connected');
    });

    it('should return available for connected server', () => {
      configManager.connectServer('active-server');
      const result = testingUtils.checkServerAvailability('active-server');
      expect(result.available).toBe(true);
    });
  });

  describe('checkAllServersAvailability', () => {
    it('should check all servers', () => {
      const results = testingUtils.checkAllServersAvailability();
      // At minimum, should have our test servers
      expect(results.size).toBeGreaterThanOrEqual(2);
      expect(results.has('active-server')).toBe(true);
      expect(results.has('disabled-server')).toBe(true);
    });
  });

  describe('getServerInfo', () => {
    it('should return null for non-existent server', () => {
      const info = testingUtils.getServerInfo('non-existent');
      expect(info).toBeNull();
    });

    it('should return server info', () => {
      const info = testingUtils.getServerInfo('active-server');
      expect(info).not.toBeNull();
      expect(info?.name).toBe('active-server');
      expect(info?.config.command).toBe('uvx');
    });
  });

  describe('getAllServersInfo', () => {
    it('should return all servers info', () => {
      const servers = testingUtils.getAllServersInfo();
      // At minimum, should have our test servers
      expect(servers.length).toBeGreaterThanOrEqual(2);
      expect(servers.some((s) => s.name === 'active-server')).toBe(true);
      expect(servers.some((s) => s.name === 'disabled-server')).toBe(true);
    });
  });

  describe('auto-approve management', () => {
    it('should check if tool is auto-approved', () => {
      expect(testingUtils.isToolAutoApproved('active-server', 'tool1')).toBe(true);
      expect(testingUtils.isToolAutoApproved('active-server', 'tool3')).toBe(false);
    });

    it('should get auto-approved tools', () => {
      const tools = testingUtils.getAutoApprovedTools('active-server');
      expect(tools).toEqual(['tool1', 'tool2']);
    });

    it('should return empty array for server without auto-approve', () => {
      const tools = testingUtils.getAutoApprovedTools('disabled-server');
      expect(tools).toEqual([]);
    });

    it('should add tool to auto-approve list', () => {
      const result = testingUtils.addAutoApprovedTool('active-server', 'tool3');
      expect(result).toBe(true);
      expect(testingUtils.isToolAutoApproved('active-server', 'tool3')).toBe(true);
    });

    it('should handle adding already approved tool', () => {
      const result = testingUtils.addAutoApprovedTool('active-server', 'tool1');
      expect(result).toBe(true);
    });

    it('should remove tool from auto-approve list', () => {
      const result = testingUtils.removeAutoApprovedTool('active-server', 'tool1');
      expect(result).toBe(true);
      expect(testingUtils.isToolAutoApproved('active-server', 'tool1')).toBe(false);
    });

    it('should handle removing non-existent tool', () => {
      const result = testingUtils.removeAutoApprovedTool('active-server', 'tool99');
      expect(result).toBe(true);
    });
  });

  describe('simulateToolCall', () => {
    it('should fail for unavailable server', () => {
      const call = testingUtils.generateSampleCall('disabled-server', 'test-tool');
      const result = testingUtils.simulateToolCall(call);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should succeed for available server', () => {
      configManager.connectServer('active-server');
      const call = testingUtils.generateSampleCall('active-server', 'test-tool', {
        param: 'value',
      });
      const result = testingUtils.simulateToolCall(call);
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });
  });

  describe('validateToolCall', () => {
    it('should validate correct tool call', () => {
      const call = testingUtils.generateSampleCall('server', 'tool');
      const result = testingUtils.validateToolCall(call);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing serverName', () => {
      const result = testingUtils.validateToolCall({
        serverName: '',
        toolName: 'tool',
      });
      expect(result.valid).toBe(false);
    });

    it('should reject missing toolName', () => {
      const result = testingUtils.validateToolCall({
        serverName: 'server',
        toolName: '',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('getSecuritySettings', () => {
    it('should return null for non-existent server', () => {
      const settings = testingUtils.getSecuritySettings('non-existent');
      expect(settings).toBeNull();
    });

    it('should return security settings', () => {
      const settings = testingUtils.getSecuritySettings('active-server');
      expect(settings).not.toBeNull();
      expect(settings?.autoApproveEnabled).toBe(true);
      expect(settings?.autoApprovedTools).toEqual(['tool1', 'tool2']);
      expect(settings?.disabled).toBe(false);
    });

    it('should return disabled status', () => {
      const settings = testingUtils.getSecuritySettings('disabled-server');
      expect(settings?.disabled).toBe(true);
    });
  });
});
