/**
 * Tests for MCP Dependency Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MCPDependencyManager } from './dependency-manager.js';

describe('MCPDependencyManager', () => {
  let manager: MCPDependencyManager;

  beforeEach(() => {
    manager = new MCPDependencyManager();
  });

  describe('checkUvInstalled', () => {
    it('should return a dependency check result', () => {
      const result = manager.checkUvInstalled();
      expect(result).toHaveProperty('installed');
      expect(typeof result.installed).toBe('boolean');
    });

    it('should include version when installed', () => {
      const result = manager.checkUvInstalled();
      if (result.installed) {
        expect(result.version).toBeDefined();
      }
    });

    it('should include error when not installed', () => {
      const result = manager.checkUvInstalled();
      if (!result.installed) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('checkUvxInstalled', () => {
    it('should return a dependency check result', () => {
      const result = manager.checkUvxInstalled();
      expect(result).toHaveProperty('installed');
      expect(typeof result.installed).toBe('boolean');
    });
  });

  describe('getInstallationGuidance', () => {
    it('should return guidance for uv', () => {
      const guidance = manager.getInstallationGuidance('uv');
      expect(guidance.tool).toBe('uv');
      expect(guidance.methods.length).toBeGreaterThan(0);
      expect(guidance.documentationUrl).toContain('astral.sh');
    });

    it('should return guidance for uvx', () => {
      const guidance = manager.getInstallationGuidance('uvx');
      expect(guidance.tool).toBe('uvx');
    });

    it('should include platform-specific methods', () => {
      const guidance = manager.getInstallationGuidance();
      expect(['windows', 'macos', 'linux']).toContain(guidance.platform);
    });

    it('should have at least one recommended method', () => {
      const guidance = manager.getInstallationGuidance();
      const recommended = guidance.methods.find((m) => m.recommended);
      expect(recommended).toBeDefined();
    });

    it('should include pip method', () => {
      const guidance = manager.getInstallationGuidance();
      const pip = guidance.methods.find((m) => m.name === 'pip');
      expect(pip).toBeDefined();
      expect(pip?.command).toContain('pip install uv');
    });
  });

  describe('checkAllDependencies', () => {
    it('should check both uv and uvx', () => {
      const result = manager.checkAllDependencies();
      expect(result).toHaveProperty('uv');
      expect(result).toHaveProperty('uvx');
      expect(result).toHaveProperty('allInstalled');
    });

    it('should set allInstalled correctly', () => {
      const result = manager.checkAllDependencies();
      expect(result.allInstalled).toBe(result.uv.installed && result.uvx.installed);
    });
  });

  describe('getFormattedInstructions', () => {
    it('should return formatted markdown', () => {
      const instructions = manager.getFormattedInstructions();
      expect(instructions).toContain('# UV/UVX Installation Guide');
      expect(instructions).toContain('## Installation Methods');
      expect(instructions).toContain('## Documentation');
    });

    it('should include platform info', () => {
      const instructions = manager.getFormattedInstructions();
      expect(instructions).toMatch(/Platform: (windows|macos|linux)/);
    });

    it('should include code blocks', () => {
      const instructions = manager.getFormattedInstructions();
      expect(instructions).toContain('```');
    });
  });

  describe('handleMissingDependency', () => {
    it('should return error info for uvx command', () => {
      const result = manager.handleMissingDependency('uvx');
      expect(result.error).toContain('uvx');
      expect(result.guidance).toBeDefined();
      expect(result.formattedMessage).toContain('uvx');
    });

    it('should include installation command in message', () => {
      const result = manager.handleMissingDependency('uvx');
      expect(result.formattedMessage).toContain('To install');
    });
  });

  describe('validateServerCommand', () => {
    it('should validate uvx command', () => {
      const result = manager.validateServerCommand('uvx');
      expect(result).toHaveProperty('valid');
      if (!result.valid) {
        expect(result.missingDependency).toBe('uvx');
        expect(result.guidance).toBeDefined();
      }
    });

    it('should validate uv command', () => {
      const result = manager.validateServerCommand('uv');
      expect(result).toHaveProperty('valid');
      if (!result.valid) {
        expect(result.missingDependency).toBe('uv');
      }
    });

    it('should return valid for non-uv commands', () => {
      const result = manager.validateServerCommand('node');
      expect(result.valid).toBe(true);
      expect(result.missingDependency).toBeUndefined();
    });
  });
});
