/**
 * Tests for SteeringValidator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SteeringValidator,
  validateSteeringFile,
  validateFrontMatter,
  validateFileMatchPattern,
  validateContent,
  getKiroSteeringPath,
  getWorkspaceSteeringPath
} from './validator.js';
import * as fs from 'fs';
import * as path from 'path';

describe('SteeringValidator', () => {
  const testDir = '.test-steering-validator';

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getKiroSteeringPath', () => {
    it('should return the default Kiro steering path', () => {
      const steeringPath = getKiroSteeringPath();
      expect(steeringPath).toBeDefined();
      // Default path is relative to workspace root: .kiro/steering
      expect(steeringPath).toContain('.kiro');
      expect(steeringPath).toContain('steering');
    });

    it('should use KIRO_STEERING_PATH env variable when set', () => {
      const originalEnv = process.env.KIRO_STEERING_PATH;
      process.env.KIRO_STEERING_PATH = '/custom/steering/path';
      
      const steeringPath = getKiroSteeringPath();
      expect(steeringPath).toBe('/custom/steering/path');
      
      // Restore original env
      if (originalEnv) {
        process.env.KIRO_STEERING_PATH = originalEnv;
      } else {
        delete process.env.KIRO_STEERING_PATH;
      }
    });
  });

  describe('getWorkspaceSteeringPath', () => {
    it('should return workspace steering path', () => {
      const workspacePath = getWorkspaceSteeringPath('/my/workspace');
      expect(workspacePath).toContain('.kiro');
      expect(workspacePath).toContain('steering');
    });

    it('should default to current directory', () => {
      const workspacePath = getWorkspaceSteeringPath();
      expect(workspacePath).toBe(path.join('.', '.kiro', 'steering'));
    });
  });

  describe('validateSteeringFile', () => {
    it('should validate a valid steering file', () => {
      const filePath = path.join(testDir, 'valid.md');
      fs.writeFileSync(filePath, `---
inclusion: always
---
# Project Standards

Follow these guidelines.`);

      const result = validateSteeringFile(filePath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.frontMatter?.inclusion).toBe('always');
    });

    it('should error on non-existent file', () => {
      const result = validateSteeringFile(path.join(testDir, 'nonexistent.md'));

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'FILE_NOT_FOUND')).toBe(true);
    });

    it('should error on non-md file', () => {
      const filePath = path.join(testDir, 'invalid.txt');
      fs.writeFileSync(filePath, 'content');

      const result = validateSteeringFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('.md extension'))).toBe(true);
    });

    it('should validate fileMatch mode with pattern', () => {
      const filePath = path.join(testDir, 'conditional.md');
      fs.writeFileSync(filePath, `---
inclusion: fileMatch
fileMatchPattern: "**/*.ts"
---
# TypeScript Standards`);

      const result = validateSteeringFile(filePath);

      expect(result.valid).toBe(true);
      expect(result.frontMatter?.inclusion).toBe('fileMatch');
      expect(result.frontMatter?.fileMatchPattern).toBe('**/*.ts');
    });

    it('should error on fileMatch mode without pattern', () => {
      const filePath = path.join(testDir, 'missing-pattern.md');
      fs.writeFileSync(filePath, `---
inclusion: fileMatch
---
# Missing Pattern`);

      const result = validateSteeringFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_FILE_MATCH_PATTERN')).toBe(true);
    });
  });

  describe('validateFrontMatter', () => {
    it('should validate valid front-matter', () => {
      const content = `---
inclusion: always
---
# Content`;

      const result = validateFrontMatter(content, 'test.md');

      expect(result.errors).toHaveLength(0);
      expect(result.frontMatter?.inclusion).toBe('always');
    });

    it('should default to always when no front-matter', () => {
      const content = '# No front-matter';

      const result = validateFrontMatter(content, 'test.md');

      expect(result.frontMatter?.inclusion).toBe('always');
      expect(result.warnings.some(w => w.code === 'MISSING_FRONT_MATTER')).toBe(true);
    });

    it('should error on invalid inclusion mode', () => {
      const content = `---
inclusion: invalid
---
# Content`;

      const result = validateFrontMatter(content, 'test.md');

      expect(result.errors.some(e => e.code === 'INVALID_INCLUSION_MODE')).toBe(true);
    });

    it('should validate manual inclusion mode', () => {
      const content = `---
inclusion: manual
---
# Manual Content`;

      const result = validateFrontMatter(content, 'test.md');

      expect(result.errors).toHaveLength(0);
      expect(result.frontMatter?.inclusion).toBe('manual');
    });
  });

  describe('validateFileMatchPattern', () => {
    it('should validate valid patterns', () => {
      expect(validateFileMatchPattern('*.ts').valid).toBe(true);
      expect(validateFileMatchPattern('**/*.tsx').valid).toBe(true);
      expect(validateFileMatchPattern('src/**/*.js').valid).toBe(true);
      expect(validateFileMatchPattern('README*').valid).toBe(true);
    });

    it('should reject empty patterns', () => {
      expect(validateFileMatchPattern('').valid).toBe(false);
      expect(validateFileMatchPattern('   ').valid).toBe(false);
    });

    it('should reject invalid glob patterns', () => {
      expect(validateFileMatchPattern('***').valid).toBe(false);
    });

    it('should reject unbalanced brackets', () => {
      expect(validateFileMatchPattern('[abc').valid).toBe(false);
      expect(validateFileMatchPattern('abc]').valid).toBe(false);
    });
  });

  describe('validateContent', () => {
    it('should warn on empty content', () => {
      const result = validateContent('---\ninclusion: always\n---', 'test.md');

      expect(result.warnings.some(w => w.code === 'EMPTY_CONTENT')).toBe(true);
    });

    it('should warn on empty file references', () => {
      const content = `---
inclusion: always
---
# Content

See: #[[file:]]`;

      const result = validateContent(content, 'test.md');

      expect(result.warnings.some(w => w.code === 'REFERENCE_NOT_FOUND')).toBe(true);
    });

    it('should not warn on valid file references', () => {
      const content = `---
inclusion: always
---
# Content

See: #[[file:src/types.ts]]`;

      const result = validateContent(content, 'test.md');

      // Should not have warnings about empty references
      expect(result.warnings.filter(w => w.message.includes('Empty file reference'))).toHaveLength(0);
    });
  });

  describe('SteeringValidator class', () => {
    it('should create validator with default paths', () => {
      const validator = new SteeringValidator();
      const paths = validator.getSteeringPaths();

      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0]).toContain('steering');
    });

    it('should create validator with custom paths', () => {
      const validator = new SteeringValidator({
        globalStoragePath: '/custom/path/steering',
        workspacePath: '/workspace'
      });
      const paths = validator.getSteeringPaths();

      expect(paths).toContain('/custom/path/steering');
    });

    it('should validate a single file', () => {
      const filePath = path.join(testDir, 'single.md');
      fs.writeFileSync(filePath, `---
inclusion: always
---
# Single File`);

      const validator = new SteeringValidator({ globalStoragePath: testDir });
      const result = validator.validateFile(filePath);

      expect(result.valid).toBe(true);
    });

    it('should get validation summary', () => {
      const validator = new SteeringValidator({ globalStoragePath: testDir });
      
      // Create test files
      fs.writeFileSync(path.join(testDir, 'valid.md'), '# Valid');
      fs.writeFileSync(path.join(testDir, 'also-valid.md'), '# Also Valid');

      const results = validator.validateAllLocations();
      const summary = validator.getValidationSummary(results);

      expect(summary.totalFiles).toBe(2);
      expect(summary.validFiles).toBe(2);
    });
  });
});
