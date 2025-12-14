/**
 * Tests for ConfigurationManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigurationManager } from './manager.js';
import { ConfigValidator } from './validator.js';
import * as fs from 'fs';
import * as path from 'path';

describe('ConfigurationManager', () => {
  const testBasePath = '.test-kiro';
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager(testBasePath);
    // Clean up any existing test directory
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
  });

  it('should initialize directory structure', async () => {
    const result = await configManager.initialize();
    
    expect(result.valid).toBe(true);
    expect(fs.existsSync(testBasePath)).toBe(true);
    expect(fs.existsSync(path.join(testBasePath, 'specs'))).toBe(true);
    expect(fs.existsSync(path.join(testBasePath, 'steering'))).toBe(true);
    expect(fs.existsSync(path.join(testBasePath, 'settings'))).toBe(true);
  });

  it('should create spec directories', async () => {
    await configManager.initialize();
    
    const specPath = configManager.createSpecDirectory('test-feature');
    const expectedPath = path.join(testBasePath, 'specs', 'test-feature');
    
    expect(specPath).toBe(expectedPath);
    expect(fs.existsSync(specPath)).toBe(true);
  });

  it('should validate directory structure', async () => {
    await configManager.initialize();
    
    const validation = await configManager.validateConfiguration();
    expect(validation.valid).toBe(true);
  });

  it('should return configuration path', () => {
    const configPath = configManager.getConfigPath('settings');
    expect(configPath).toBe(path.join(testBasePath, 'settings'));
  });

  it('should load default configuration', async () => {
    await configManager.initialize();
    
    const config = configManager.getConfig();
    expect(config.identity?.name).toBe('Kiro');
    expect(config.responseStyle?.tone).toBe('warm');
    expect(config.specs?.defaultFormat).toBe('ears');
  });
});

describe('ConfigValidator', () => {
  it('should validate valid MCP configuration', () => {
    const validConfig = {
      mcpServers: {
        'test-server': {
          command: 'uvx',
          args: ['test-package'],
          disabled: false
        }
      }
    };

    const result = ConfigValidator.validateMCPConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid MCP configuration', () => {
    const invalidConfig = {
      mcpServers: {
        'test-server': {
          // missing required command field
          args: ['test-package']
        }
      }
    };

    const result = ConfigValidator.validateMCPConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate directory structure', () => {
    const testPath = '.test-structure';
    
    // Create test directories
    fs.mkdirSync(testPath, { recursive: true });
    fs.mkdirSync(path.join(testPath, 'specs'));
    fs.mkdirSync(path.join(testPath, 'steering'));
    fs.mkdirSync(path.join(testPath, 'settings'));

    const result = ConfigValidator.validateDirectoryStructure(testPath);
    expect(result.valid).toBe(true);

    // Clean up
    fs.rmSync(testPath, { recursive: true, force: true });
  });
});