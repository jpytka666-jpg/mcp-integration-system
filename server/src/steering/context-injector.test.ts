/**
 * Tests for ContextInjector
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextInjector, createDefaultContextInjector } from './context-injector.js';
import * as fs from 'fs';
import * as path from 'path';

describe('ContextInjector', () => {
  const testDir = '.test-context';
  const steeringDir = path.join(testDir, 'steering');
  let injector: ContextInjector;

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(steeringDir, { recursive: true });
    injector = new ContextInjector(steeringDir, testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadSteeringFiles', () => {
    it('should load all steering files from directory', () => {
      fs.writeFileSync(path.join(steeringDir, 'always.md'), `---
inclusion: always
---
# Always Rules`);
      fs.writeFileSync(path.join(steeringDir, 'manual.md'), `---
inclusion: manual
---
# Manual Rules`);

      const results = injector.loadSteeringFiles();

      expect(results).toHaveLength(2);
      expect(injector.getSteeringFiles()).toHaveLength(2);
    });

    it('should return empty array for empty directory', () => {
      const results = injector.loadSteeringFiles();
      expect(results).toHaveLength(0);
    });
  });

  describe('injectContext', () => {
    beforeEach(() => {
      // Create test steering files
      fs.writeFileSync(path.join(steeringDir, 'always.md'), `---
inclusion: always
---
# Always Included

These rules always apply.`);

      fs.writeFileSync(path.join(steeringDir, 'typescript.md'), `---
inclusion: fileMatch
fileMatchPattern: "**/*.ts"
---
# TypeScript Rules

Use strict types.`);

      fs.writeFileSync(path.join(steeringDir, 'security.md'), `---
inclusion: manual
---
# Security Guidelines

Follow security best practices.`);

      injector.loadSteeringFiles();
    });

    it('should include always-included files by default', () => {
      const result = injector.injectContext();

      expect(result.includedFiles).toBe(1);
      expect(result.content).toContain('Always Included');
      expect(result.sources[0].inclusionMode).toBe('always');
    });

    it('should include fileMatch files when active file matches', () => {
      const result = injector.injectContext({
        activeFilePath: 'src/index.ts'
      });

      expect(result.includedFiles).toBe(2);
      expect(result.content).toContain('TypeScript Rules');
    });

    it('should not include fileMatch files when active file does not match', () => {
      const result = injector.injectContext({
        activeFilePath: 'src/styles.css'
      });

      expect(result.includedFiles).toBe(1);
      expect(result.content).not.toContain('TypeScript Rules');
    });

    it('should include manual files when key is provided', () => {
      const result = injector.injectContext({
        manualKeys: ['security']
      });

      expect(result.includedFiles).toBe(2);
      expect(result.content).toContain('Security Guidelines');
    });

    it('should not include manual files without key', () => {
      const result = injector.injectContext();

      expect(result.content).not.toContain('Security Guidelines');
    });

    it('should combine all inclusion modes correctly', () => {
      const result = injector.injectContext({
        activeFilePath: 'src/utils.ts',
        manualKeys: ['security']
      });

      expect(result.includedFiles).toBe(3);
      expect(result.content).toContain('Always Included');
      expect(result.content).toContain('TypeScript Rules');
      expect(result.content).toContain('Security Guidelines');
    });
  });

  describe('getManualKeys', () => {
    it('should return list of manual steering keys', () => {
      fs.writeFileSync(path.join(steeringDir, 'manual1.md'), `---
inclusion: manual
---
# Manual 1`);
      fs.writeFileSync(path.join(steeringDir, 'manual2.md'), `---
inclusion: manual
---
# Manual 2`);
      fs.writeFileSync(path.join(steeringDir, 'always.md'), `---
inclusion: always
---
# Always`);

      injector.loadSteeringFiles();
      const keys = injector.getManualKeys();

      expect(keys).toContain('manual1');
      expect(keys).toContain('manual2');
      expect(keys).not.toContain('always');
    });
  });

  describe('getMatchingFiles', () => {
    it('should return files matching a specific path', () => {
      fs.writeFileSync(path.join(steeringDir, 'ts-rules.md'), `---
inclusion: fileMatch
fileMatchPattern: "**/*.ts"
---
# TS`);
      fs.writeFileSync(path.join(steeringDir, 'js-rules.md'), `---
inclusion: fileMatch
fileMatchPattern: "**/*.js"
---
# JS`);

      injector.loadSteeringFiles();

      const tsMatches = injector.getMatchingFiles('src/index.ts');
      expect(tsMatches).toHaveLength(1);
      expect(tsMatches[0].fileName).toBe('ts-rules.md');

      const jsMatches = injector.getMatchingFiles('lib/utils.js');
      expect(jsMatches).toHaveLength(1);
      expect(jsMatches[0].fileName).toBe('js-rules.md');
    });
  });

  describe('getAlwaysIncludedFiles', () => {
    it('should return only always-included files', () => {
      fs.writeFileSync(path.join(steeringDir, 'always1.md'), `---
inclusion: always
---
# Always 1`);
      fs.writeFileSync(path.join(steeringDir, 'always2.md'), `---
inclusion: always
---
# Always 2`);
      fs.writeFileSync(path.join(steeringDir, 'manual.md'), `---
inclusion: manual
---
# Manual`);

      injector.loadSteeringFiles();
      const alwaysFiles = injector.getAlwaysIncludedFiles();

      expect(alwaysFiles).toHaveLength(2);
      expect(alwaysFiles.every(f => f.frontMatter.inclusion === 'always')).toBe(true);
    });
  });

  describe('buildContext', () => {
    it('should build complete steering context', () => {
      fs.writeFileSync(path.join(steeringDir, 'test.md'), `---
inclusion: always
---
# Test`);

      injector.loadSteeringFiles();
      const context = injector.buildContext({
        activeFilePath: 'src/index.ts',
        manualKeys: ['security']
      });

      expect(context.steeringFiles).toHaveLength(1);
      expect(context.activeFile).toBe('src/index.ts');
      expect(context.manualKeys).toContain('security');
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      fs.writeFileSync(path.join(steeringDir, 'test.md'), '# Test');
      injector.loadSteeringFiles();
      expect(injector.getSteeringFiles()).toHaveLength(1);

      injector.clearCache();
      expect(injector.getSteeringFiles()).toHaveLength(0);
    });

    it('should refresh cache from disk', () => {
      fs.writeFileSync(path.join(steeringDir, 'test.md'), '# Test');
      injector.loadSteeringFiles();
      expect(injector.getSteeringFiles()).toHaveLength(1);

      fs.writeFileSync(path.join(steeringDir, 'test2.md'), '# Test 2');
      injector.refresh();
      expect(injector.getSteeringFiles()).toHaveLength(2);
    });
  });
});

describe('createDefaultContextInjector', () => {
  const testDir = '.test-default-injector';

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, '.kiro', 'steering'), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create injector for default .kiro/steering directory', () => {
    fs.writeFileSync(
      path.join(testDir, '.kiro', 'steering', 'rules.md'),
      '# Rules'
    );

    const injector = createDefaultContextInjector(testDir);
    injector.loadSteeringFiles();

    expect(injector.getSteeringFiles()).toHaveLength(1);
  });
});
