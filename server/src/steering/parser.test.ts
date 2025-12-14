/**
 * Tests for SteeringParser
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SteeringParser, matchesFilePattern, getKiroGlobalSteeringPath } from './parser.js';
import * as fs from 'fs';
import * as path from 'path';

describe('SteeringParser', () => {
  const testDir = '.test-steering';
  let parser: SteeringParser;

  beforeEach(() => {
    parser = new SteeringParser(testDir);
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

  describe('getKiroGlobalSteeringPath', () => {
    it('should return the default Kiro steering path', () => {
      const steeringPath = getKiroGlobalSteeringPath();
      expect(steeringPath).toBeDefined();
      // Default path is relative to workspace root: .kiro/steering
      expect(steeringPath).toContain('.kiro');
      expect(steeringPath).toContain('steering');
    });

    it('should use KIRO_STEERING_PATH env variable when set', () => {
      const originalEnv = process.env.KIRO_STEERING_PATH;
      process.env.KIRO_STEERING_PATH = '/custom/steering/path';
      
      const steeringPath = getKiroGlobalSteeringPath();
      expect(steeringPath).toBe('/custom/steering/path');
      
      // Restore original env
      if (originalEnv !== undefined) {
        process.env.KIRO_STEERING_PATH = originalEnv;
      } else {
        delete process.env.KIRO_STEERING_PATH;
      }
    });
  });

  describe('constructor options', () => {
    it('should accept string path for backward compatibility', () => {
      const parser = new SteeringParser('/custom/path');
      expect(parser.getSteeringPath()).toBe('/custom/path');
    });

    it('should accept options object with basePath', () => {
      const parser = new SteeringParser({ basePath: '/workspace' });
      expect(parser.getSteeringPath()).toBe('/workspace');
    });

    it('should use global storage when useGlobalStorage is true', () => {
      const parser = new SteeringParser({ useGlobalStorage: true });
      expect(parser.getSteeringPath()).toBe(getKiroGlobalSteeringPath());
    });

    it('should use custom path when provided', () => {
      const parser = new SteeringParser({ 
        customSteeringPath: '/my/custom/steering',
        useGlobalStorage: true // should be ignored
      });
      expect(parser.getSteeringPath()).toBe('/my/custom/steering');
    });
  });

  describe('parse', () => {
    it('should parse steering file with always inclusion mode', () => {
      const filePath = path.join(testDir, 'always.md');
      const content = `---
inclusion: always
---
# Project Standards

Follow these guidelines.`;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.success).toBe(true);
      expect(result.steeringFile?.frontMatter.inclusion).toBe('always');
      expect(result.steeringFile?.content).toContain('# Project Standards');
    });

    it('should parse steering file with fileMatch inclusion mode', () => {
      const filePath = path.join(testDir, 'conditional.md');
      const content = `---
inclusion: fileMatch
fileMatchPattern: "*.ts"
---
# TypeScript Standards`;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.success).toBe(true);
      expect(result.steeringFile?.frontMatter.inclusion).toBe('fileMatch');
      expect(result.steeringFile?.frontMatter.fileMatchPattern).toBe('*.ts');
    });

    it('should parse steering file with manual inclusion mode', () => {
      const filePath = path.join(testDir, 'manual.md');
      const content = `---
inclusion: manual
---
# Manual Guidelines`;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.success).toBe(true);
      expect(result.steeringFile?.frontMatter.inclusion).toBe('manual');
    });

    it('should default to always inclusion when no front-matter', () => {
      const filePath = path.join(testDir, 'no-frontmatter.md');
      const content = `# Simple Guidelines

No front-matter here.`;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.success).toBe(true);
      expect(result.steeringFile?.frontMatter.inclusion).toBe('always');
      expect(result.warnings.some(w => w.code === 'MISSING_FRONT_MATTER')).toBe(true);
    });

    it('should error when fileMatch mode lacks pattern', () => {
      const filePath = path.join(testDir, 'missing-pattern.md');
      const content = `---
inclusion: fileMatch
---
# Missing Pattern`;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_FILE_MATCH_PATTERN')).toBe(true);
    });

    it('should error on invalid inclusion mode', () => {
      const filePath = path.join(testDir, 'invalid-mode.md');
      const content = `---
inclusion: invalid
---
# Invalid Mode`;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_INCLUSION_MODE')).toBe(true);
    });

    it('should error when file does not exist', () => {
      const result = parser.parse(path.join(testDir, 'nonexistent.md'));

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'FILE_NOT_FOUND')).toBe(true);
    });
  });

  describe('file references', () => {
    it('should resolve existing file references', () => {
      // Create referenced file
      const refFilePath = path.join(testDir, 'types.ts');
      fs.writeFileSync(refFilePath, 'export type MyType = string;');

      const filePath = path.join(testDir, 'with-ref.md');
      const content = `---
inclusion: always
---
# Standards

See types: #[[file:${testDir}/types.ts]]`;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.success).toBe(true);
      expect(result.steeringFile?.resolvedReferences).toHaveLength(1);
      expect(result.steeringFile?.resolvedReferences[0].exists).toBe(true);
      expect(result.steeringFile?.resolvedReferences[0].resolvedContent).toContain('MyType');
    });

    it('should warn on missing file references', () => {
      const filePath = path.join(testDir, 'missing-ref.md');
      const content = `---
inclusion: always
---
# Standards

See: #[[file:nonexistent.ts]]`;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.success).toBe(true);
      expect(result.steeringFile?.resolvedReferences[0].exists).toBe(false);
      expect(result.warnings.some(w => w.code === 'REFERENCE_NOT_FOUND')).toBe(true);
    });

    it('should handle multiple file references', () => {
      const file1 = path.join(testDir, 'file1.ts');
      const file2 = path.join(testDir, 'file2.ts');
      fs.writeFileSync(file1, 'const a = 1;');
      fs.writeFileSync(file2, 'const b = 2;');

      const filePath = path.join(testDir, 'multi-ref.md');
      const content = `---
inclusion: always
---
# Standards

File 1: #[[file:${testDir}/file1.ts]]
File 2: #[[file:${testDir}/file2.ts]]`;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.success).toBe(true);
      expect(result.steeringFile?.resolvedReferences).toHaveLength(2);
    });
  });

  describe('expandReferences', () => {
    it('should expand file references with content', () => {
      const refFilePath = path.join(testDir, 'code.ts');
      fs.writeFileSync(refFilePath, 'export const VALUE = 42;');

      const filePath = path.join(testDir, 'expand.md');
      const content = `---
inclusion: always
---
# Code

\`\`\`typescript
#[[file:${testDir}/code.ts]]
\`\`\``;
      fs.writeFileSync(filePath, content);

      const result = parser.parse(filePath);
      expect(result.steeringFile).toBeDefined();

      const expanded = parser.expandReferences(result.steeringFile!);
      expect(expanded).toContain('export const VALUE = 42;');
      expect(expanded).not.toContain('#[[file:');
    });
  });

  describe('parseDirectory', () => {
    it('should parse all markdown files in directory', () => {
      fs.writeFileSync(path.join(testDir, 'file1.md'), '# File 1');
      fs.writeFileSync(path.join(testDir, 'file2.md'), '# File 2');
      fs.writeFileSync(path.join(testDir, 'not-md.txt'), 'Not markdown');

      const results = parser.parseDirectory(testDir);

      expect(results).toHaveLength(2);
    });

    it('should return empty array for nonexistent directory', () => {
      const results = parser.parseDirectory(path.join(testDir, 'nonexistent'));
      expect(results).toHaveLength(0);
    });
  });
});

describe('matchesFilePattern', () => {
  it('should match exact file names', () => {
    expect(matchesFilePattern('README.md', 'README.md')).toBe(true);
    expect(matchesFilePattern('README.md', 'readme.md')).toBe(true); // case insensitive
  });

  it('should match single wildcard patterns', () => {
    expect(matchesFilePattern('file.ts', '*.ts')).toBe(true);
    expect(matchesFilePattern('file.js', '*.ts')).toBe(false);
    expect(matchesFilePattern('src/file.ts', 'src/*.ts')).toBe(true);
  });

  it('should match double wildcard patterns', () => {
    expect(matchesFilePattern('src/components/Button.tsx', '**/*.tsx')).toBe(true);
    expect(matchesFilePattern('deep/nested/path/file.ts', '**/*.ts')).toBe(true);
  });

  it('should match question mark patterns', () => {
    expect(matchesFilePattern('file1.ts', 'file?.ts')).toBe(true);
    expect(matchesFilePattern('file12.ts', 'file?.ts')).toBe(false);
  });

  it('should handle README patterns', () => {
    expect(matchesFilePattern('README.md', 'README*')).toBe(true);
    expect(matchesFilePattern('README-dev.md', 'README*')).toBe(true);
  });
});
