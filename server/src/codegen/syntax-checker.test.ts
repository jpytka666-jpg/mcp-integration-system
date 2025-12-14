/**
 * Tests for syntax checking utilities
 */

import { describe, it, expect } from 'vitest';
import { SyntaxChecker, FileWriter, ErrorRecovery } from './syntax-checker.js';

describe('SyntaxChecker', () => {
  describe('detectLanguage', () => {
    it('detects JSON', () => {
      expect(SyntaxChecker.detectLanguage('{"key": "value"}')).toBe('json');
      expect(SyntaxChecker.detectLanguage('[1, 2, 3]')).toBe('json');
    });

    it('detects TypeScript', () => {
      expect(SyntaxChecker.detectLanguage('interface User { name: string }')).toBe('typescript');
      expect(SyntaxChecker.detectLanguage('const x: number = 5')).toBe('typescript');
    });

    it('detects JavaScript', () => {
      expect(SyntaxChecker.detectLanguage('function test() { return 1; }')).toBe('javascript');
      expect(SyntaxChecker.detectLanguage('const x = () => 5')).toBe('javascript');
    });

    it('detects HTML', () => {
      expect(SyntaxChecker.detectLanguage('<!DOCTYPE html>')).toBe('html');
      expect(SyntaxChecker.detectLanguage('<div>content</div>')).toBe('html');
    });

    it('detects CSS', () => {
      expect(SyntaxChecker.detectLanguage('.class { color: red; }')).toBe('css');
      expect(SyntaxChecker.detectLanguage('@media screen { }')).toBe('css');
    });

    it('detects Markdown', () => {
      expect(SyntaxChecker.detectLanguage('# Heading')).toBe('markdown');
      expect(SyntaxChecker.detectLanguage('[link](url)')).toBe('markdown');
    });
  });

  describe('check - JavaScript/TypeScript', () => {
    it('validates correct code', () => {
      const result = SyntaxChecker.check('function test() { return 1; }', 'javascript');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects unclosed braces', () => {
      const result = SyntaxChecker.check('function test() {', 'javascript');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNCLOSED_BRACE')).toBe(true);
    });

    it('detects unclosed brackets', () => {
      const result = SyntaxChecker.check('const arr = [1, 2, 3', 'javascript');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNCLOSED_BRACKET')).toBe(true);
    });

    it('detects unclosed parentheses', () => {
      const result = SyntaxChecker.check('console.log(test', 'javascript');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNCLOSED_PAREN')).toBe(true);
    });

    it('handles strings correctly', () => {
      const result = SyntaxChecker.check('const s = "{ not a brace }";', 'javascript');
      expect(result.valid).toBe(true);
    });

    it('handles template literals', () => {
      const result = SyntaxChecker.check('const s = `template ${var} string`;', 'javascript');
      expect(result.valid).toBe(true);
    });

    it('handles comments', () => {
      const result = SyntaxChecker.check('// { comment\nconst x = 1;', 'javascript');
      expect(result.valid).toBe(true);
    });
  });


  describe('check - JSON', () => {
    it('validates correct JSON', () => {
      const result = SyntaxChecker.check('{"key": "value"}', 'json');
      expect(result.valid).toBe(true);
    });

    it('detects invalid JSON', () => {
      const result = SyntaxChecker.check('{key: "value"}', 'json');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'JSON_PARSE_ERROR')).toBe(true);
    });

    it('warns about trailing commas', () => {
      const result = SyntaxChecker.check('{"key": "value",}', 'json');
      expect(result.warnings.some(w => w.code === 'TRAILING_COMMA')).toBe(true);
    });
  });

  describe('check - Markdown', () => {
    it('validates correct markdown', () => {
      const result = SyntaxChecker.check('# Heading\n\nParagraph', 'markdown');
      expect(result.valid).toBe(true);
    });

    it('detects unclosed code blocks', () => {
      const result = SyntaxChecker.check('```javascript\ncode', 'markdown');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNCLOSED_CODE_BLOCK')).toBe(true);
    });

    it('warns about empty links', () => {
      const result = SyntaxChecker.check('[link]()', 'markdown');
      expect(result.warnings.some(w => w.code === 'EMPTY_LINK')).toBe(true);
    });
  });

  describe('check - HTML', () => {
    it('validates correct HTML', () => {
      const result = SyntaxChecker.check('<div><p>text</p></div>', 'html');
      expect(result.valid).toBe(true);
    });

    it('detects unclosed tags', () => {
      const result = SyntaxChecker.check('<div><p>text</div>', 'html');
      expect(result.valid).toBe(false);
    });

    it('handles self-closing tags', () => {
      const result = SyntaxChecker.check('<img src="test.jpg"><br>', 'html');
      expect(result.valid).toBe(true);
    });
  });

  describe('check - CSS', () => {
    it('validates correct CSS', () => {
      const result = SyntaxChecker.check('.class { color: red; }', 'css');
      expect(result.valid).toBe(true);
    });

    it('detects unclosed braces', () => {
      const result = SyntaxChecker.check('.class { color: red;', 'css');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNCLOSED_BRACE')).toBe(true);
    });
  });

  describe('check - YAML', () => {
    it('validates correct YAML', () => {
      const result = SyntaxChecker.check('key: value\nother: data', 'yaml');
      expect(result.valid).toBe(true);
    });

    it('detects tabs', () => {
      const result = SyntaxChecker.check('key:\n\tvalue', 'yaml');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'TAB_CHARACTER')).toBe(true);
    });
  });
});

describe('ErrorRecovery', () => {
  describe('analyze', () => {
    it('suggests creating directory for ENOENT errors', () => {
      const result = ErrorRecovery.analyze({
        operation: 'write',
        error: new Error('ENOENT: no such file or directory'),
        attempts: 1,
        maxAttempts: 3
      });
      expect(result.suggestions.some(s => s.action === 'alternative')).toBe(true);
    });

    it('suggests checking permissions for EACCES errors', () => {
      const result = ErrorRecovery.analyze({
        operation: 'write',
        error: new Error('EACCES: permission denied'),
        attempts: 1,
        maxAttempts: 3
      });
      expect(result.suggestions.some(s => s.action === 'manual')).toBe(true);
    });

    it('suggests retry for timeout errors', () => {
      const result = ErrorRecovery.analyze({
        operation: 'connect',
        error: new Error('ETIMEDOUT'),
        attempts: 1,
        maxAttempts: 3
      });
      expect(result.suggestions.some(s => s.action === 'retry')).toBe(true);
    });
  });

  describe('formatError', () => {
    it('formats ENOENT errors', () => {
      const message = ErrorRecovery.formatError(new Error('ENOENT'), 'write file');
      expect(message).toContain('does not exist');
    });

    it('formats permission errors', () => {
      const message = ErrorRecovery.formatError(new Error('EACCES'), 'read file');
      expect(message).toContain('Permission denied');
    });
  });
});
