/**
 * Syntax checking utilities for generated code
 */

import {
  SyntaxCheckResult,
  SyntaxError,
  SyntaxWarning,
  SupportedLanguage
} from './types.js';

export class SyntaxChecker {
  /**
   * Check syntax of code based on detected or specified language
   */
  static check(code: string, language?: SupportedLanguage): SyntaxCheckResult {
    const detectedLanguage = language || this.detectLanguage(code);
    
    switch (detectedLanguage) {
      case 'typescript':
      case 'javascript':
        return this.checkJavaScriptSyntax(code, detectedLanguage);
      case 'json':
        return this.checkJSONSyntax(code);
      case 'markdown':
        return this.checkMarkdownSyntax(code);
      case 'yaml':
        return this.checkYAMLSyntax(code);
      case 'html':
        return this.checkHTMLSyntax(code);
      case 'css':
        return this.checkCSSSyntax(code);
      default:
        return { valid: true, errors: [], warnings: [], language: 'unknown' };
    }
  }

  /**
   * Detect language from code content
   */
  static detectLanguage(code: string): SupportedLanguage {
    const trimmed = code.trim();
    
    // JSON detection
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        // Not valid JSON, continue detection
      }
    }
    
    // TypeScript detection
    if (trimmed.includes('interface ') || 
        trimmed.includes(': string') ||
        trimmed.includes(': number') ||
        trimmed.includes(': boolean') ||
        trimmed.includes('<T>') ||
        /:\s*(string|number|boolean|void|any)\b/.test(trimmed)) {
      return 'typescript';
    }
    
    // JavaScript detection
    if (trimmed.includes('function ') ||
        trimmed.includes('const ') ||
        trimmed.includes('let ') ||
        trimmed.includes('var ') ||
        trimmed.includes('=>') ||
        trimmed.includes('export ') ||
        trimmed.includes('import ')) {
      return 'javascript';
    }
    
    // HTML detection
    if (trimmed.startsWith('<!DOCTYPE') ||
        trimmed.startsWith('<html') ||
        /<[a-z]+[^>]*>/i.test(trimmed)) {
      return 'html';
    }
    
    // CSS detection
    if (/[.#]?[a-z-]+\s*\{[^}]*\}/i.test(trimmed) ||
        trimmed.includes('@media') ||
        trimmed.includes('@import')) {
      return 'css';
    }
    
    // YAML detection
    if (/^[a-z_]+:\s/im.test(trimmed) &&
        !trimmed.includes('{') &&
        !trimmed.includes(';')) {
      return 'yaml';
    }
    
    // Markdown detection
    if (trimmed.startsWith('#') ||
        trimmed.includes('\n## ') ||
        trimmed.includes('\n- ') ||
        /\[.*\]\(.*\)/.test(trimmed)) {
      return 'markdown';
    }
    
    return 'javascript'; // Default fallback
  }


  /**
   * Check JavaScript/TypeScript syntax
   */
  private static checkJavaScriptSyntax(code: string, language: 'javascript' | 'typescript'): SyntaxCheckResult {
    const errors: SyntaxError[] = [];
    const warnings: SyntaxWarning[] = [];
    const lines = code.split('\n');

    let braceCount = 0;
    let bracketCount = 0;
    let parenCount = 0;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let inComment = false;
    let inMultiLineComment = false;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      for (let col = 0; col < line.length; col++) {
        const char = line[col];
        const prevChar = col > 0 ? line[col - 1] : '';
        const nextChar = col < line.length - 1 ? line[col + 1] : '';

        // Handle comments
        if (!inString && !inTemplate) {
          if (char === '/' && nextChar === '/') {
            inComment = true;
            break;
          }
          if (char === '/' && nextChar === '*') {
            inMultiLineComment = true;
            col++;
            continue;
          }
          if (inMultiLineComment && char === '*' && nextChar === '/') {
            inMultiLineComment = false;
            col++;
            continue;
          }
        }

        if (inMultiLineComment) continue;

        // Handle strings
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
          if (!inString && !inTemplate) {
            if (char === '`') {
              inTemplate = true;
            } else {
              inString = true;
              stringChar = char;
            }
          } else if (inString && char === stringChar) {
            inString = false;
          } else if (inTemplate && char === '`') {
            inTemplate = false;
          }
          continue;
        }

        if (inString || inTemplate) continue;

        // Track brackets
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;

        if (braceCount < 0) {
          errors.push({ line: lineNum + 1, column: col + 1, message: 'Unexpected closing brace', code: 'UNMATCHED_BRACE', severity: 'error' });
          braceCount = 0;
        }
        if (bracketCount < 0) {
          errors.push({ line: lineNum + 1, column: col + 1, message: 'Unexpected closing bracket', code: 'UNMATCHED_BRACKET', severity: 'error' });
          bracketCount = 0;
        }
        if (parenCount < 0) {
          errors.push({ line: lineNum + 1, column: col + 1, message: 'Unexpected closing parenthesis', code: 'UNMATCHED_PAREN', severity: 'error' });
          parenCount = 0;
        }
      }
      inComment = false;
    }

    if (braceCount > 0) errors.push({ line: lines.length, column: 1, message: `${braceCount} unclosed brace(s)`, code: 'UNCLOSED_BRACE', severity: 'error' });
    if (bracketCount > 0) errors.push({ line: lines.length, column: 1, message: `${bracketCount} unclosed bracket(s)`, code: 'UNCLOSED_BRACKET', severity: 'error' });
    if (parenCount > 0) errors.push({ line: lines.length, column: 1, message: `${parenCount} unclosed parenthesis(es)`, code: 'UNCLOSED_PAREN', severity: 'error' });
    if (inString) errors.push({ line: lines.length, column: 1, message: 'Unclosed string literal', code: 'UNCLOSED_STRING', severity: 'error' });
    if (inTemplate) errors.push({ line: lines.length, column: 1, message: 'Unclosed template literal', code: 'UNCLOSED_TEMPLATE', severity: 'error' });

    return { valid: errors.length === 0, errors, warnings, language };
  }


  /**
   * Check JSON syntax
   */
  private static checkJSONSyntax(code: string): SyntaxCheckResult {
    const errors: SyntaxError[] = [];
    const warnings: SyntaxWarning[] = [];

    try {
      JSON.parse(code);
    } catch (e) {
      const error = e as Error;
      const match = error.message.match(/at position (\d+)/);
      let line = 1, column = 1;
      
      if (match) {
        const position = parseInt(match[1], 10);
        const beforeError = code.substring(0, position);
        line = (beforeError.match(/\n/g) || []).length + 1;
        column = position - beforeError.lastIndexOf('\n');
      }

      errors.push({ line, column, message: error.message, code: 'JSON_PARSE_ERROR', severity: 'error' });
    }

    if (code.match(/,\s*[\]}]/g)) {
      warnings.push({ line: 1, column: 1, message: 'Trailing commas are not allowed in JSON', code: 'TRAILING_COMMA' });
    }

    return { valid: errors.length === 0, errors, warnings, language: 'json' };
  }

  /**
   * Check Markdown syntax
   */
  private static checkMarkdownSyntax(code: string): SyntaxCheckResult {
    const errors: SyntaxError[] = [];
    const warnings: SyntaxWarning[] = [];
    const lines = code.split('\n');

    let inCodeBlock = false;
    let codeBlockStart = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockStart = lineNum + 1;
        } else {
          inCodeBlock = false;
        }
        continue;
      }

      if (inCodeBlock) continue;

      const linkMatches = line.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g);
      for (const match of linkMatches) {
        if (!match[2] || match[2].trim() === '') {
          warnings.push({ line: lineNum + 1, column: match.index! + 1, message: 'Empty link URL', code: 'EMPTY_LINK' });
        }
      }
    }

    if (inCodeBlock) {
      errors.push({ line: codeBlockStart, column: 1, message: 'Unclosed code block', code: 'UNCLOSED_CODE_BLOCK', severity: 'error' });
    }

    return { valid: errors.length === 0, errors, warnings, language: 'markdown' };
  }


  /**
   * Check YAML syntax
   */
  private static checkYAMLSyntax(code: string): SyntaxCheckResult {
    const errors: SyntaxError[] = [];
    const warnings: SyntaxWarning[] = [];
    const lines = code.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      if (line.trim() === '' || line.trim().startsWith('#')) continue;

      if (line.includes('\t')) {
        errors.push({ line: lineNum + 1, column: line.indexOf('\t') + 1, message: 'Tabs are not allowed in YAML, use spaces', code: 'TAB_CHARACTER', severity: 'error' });
      }

      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      if (indent > 0 && indent % 2 !== 0) {
        warnings.push({ line: lineNum + 1, column: 1, message: 'Inconsistent indentation (should be multiples of 2)', code: 'INCONSISTENT_INDENT' });
      }
    }

    return { valid: errors.length === 0, errors, warnings, language: 'yaml' };
  }

  /**
   * Check HTML syntax
   */
  private static checkHTMLSyntax(code: string): SyntaxCheckResult {
    const errors: SyntaxError[] = [];
    const warnings: SyntaxWarning[] = [];
    const tagStack: { tag: string; line: number; column: number }[] = [];
    const selfClosingTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const lines = code.split('\n');
    let inComment = false;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      if (line.includes('<!--')) inComment = true;
      if (line.includes('-->')) { inComment = false; continue; }
      if (inComment) continue;

      const tagMatches = line.matchAll(/<\/?([a-z][a-z0-9]*)[^>]*\/?>/gi);
      
      for (const match of tagMatches) {
        const fullTag = match[0];
        const tagName = match[1].toLowerCase();
        const column = match.index! + 1;

        if (fullTag.startsWith('</')) {
          if (tagStack.length === 0) {
            errors.push({ line: lineNum + 1, column, message: `Unexpected closing tag </${tagName}>`, code: 'UNEXPECTED_CLOSING_TAG', severity: 'error' });
          } else {
            const lastOpen = tagStack.pop()!;
            if (lastOpen.tag !== tagName) {
              errors.push({ line: lineNum + 1, column, message: `Mismatched closing tag: expected </${lastOpen.tag}>, found </${tagName}>`, code: 'MISMATCHED_TAG', severity: 'error' });
            }
          }
        } else if (!fullTag.endsWith('/>') && !selfClosingTags.has(tagName)) {
          tagStack.push({ tag: tagName, line: lineNum + 1, column });
        }
      }
    }

    for (const unclosed of tagStack) {
      errors.push({ line: unclosed.line, column: unclosed.column, message: `Unclosed tag <${unclosed.tag}>`, code: 'UNCLOSED_TAG', severity: 'error' });
    }

    return { valid: errors.length === 0, errors, warnings, language: 'html' };
  }


  /**
   * Check CSS syntax
   */
  private static checkCSSSyntax(code: string): SyntaxCheckResult {
    const errors: SyntaxError[] = [];
    const warnings: SyntaxWarning[] = [];
    const lines = code.split('\n');
    let braceCount = 0;
    let inComment = false;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (let col = 0; col < line.length; col++) {
        const char = line[col];
        const nextChar = col < line.length - 1 ? line[col + 1] : '';

        if (char === '/' && nextChar === '*') { inComment = true; col++; continue; }
        if (inComment && char === '*' && nextChar === '/') { inComment = false; col++; continue; }
        if (inComment) continue;

        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount < 0) {
            errors.push({ line: lineNum + 1, column: col + 1, message: 'Unexpected closing brace', code: 'UNMATCHED_BRACE', severity: 'error' });
            braceCount = 0;
          }
        }
      }

      const trimmed = line.trim();
      if (trimmed.includes(':') && !trimmed.endsWith('{') && !trimmed.endsWith('}') && 
          !trimmed.endsWith(';') && !trimmed.endsWith(',') && !trimmed.startsWith('/*') && !trimmed.startsWith('@')) {
        warnings.push({ line: lineNum + 1, column: line.length, message: 'Missing semicolon', code: 'MISSING_SEMICOLON' });
      }
    }

    if (braceCount > 0) {
      errors.push({ line: lines.length, column: 1, message: `${braceCount} unclosed brace(s)`, code: 'UNCLOSED_BRACE', severity: 'error' });
    }

    return { valid: errors.length === 0, errors, warnings, language: 'css' };
  }
}


/**
 * File writing utilities with optimization for large files
 */
import * as fs from 'fs';
import * as path from 'path';
import { FileWriteOptions, FileWriteResult, ErrorRecoveryContext, ErrorRecoveryResult, CodegenRecoverySuggestion } from './types.js';

export class FileWriter {
  private static readonly DEFAULT_CHUNK_SIZE = 50; // lines

  /**
   * Write content to file with chunked writing for large files
   */
  static async write(filePath: string, content: string, options: FileWriteOptions = {}): Promise<FileWriteResult> {
    const { chunkSize = this.DEFAULT_CHUNK_SIZE, createDirectories = true, encoding = 'utf-8' } = options;
    
    try {
      // Create directories if needed
      if (createDirectories) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      const lines = content.split('\n');
      let bytesWritten = 0;
      let chunksWritten = 0;

      // For small files, write directly
      if (lines.length <= chunkSize) {
        fs.writeFileSync(filePath, content, { encoding });
        return { success: true, path: filePath, bytesWritten: Buffer.byteLength(content, encoding), chunksWritten: 1 };
      }

      // For large files, write in chunks
      fs.writeFileSync(filePath, '', { encoding }); // Create/clear file
      
      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize).join('\n');
        const chunkContent = i + chunkSize < lines.length ? chunk + '\n' : chunk;
        fs.appendFileSync(filePath, chunkContent, { encoding });
        bytesWritten += Buffer.byteLength(chunkContent, encoding);
        chunksWritten++;
      }

      return { success: true, path: filePath, bytesWritten, chunksWritten };
    } catch (error) {
      return { success: false, path: filePath, bytesWritten: 0, chunksWritten: 0, error: (error as Error).message };
    }
  }

  /**
   * Append content to existing file
   */
  static async append(filePath: string, content: string, options: FileWriteOptions = {}): Promise<FileWriteResult> {
    const { encoding = 'utf-8' } = options;
    
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, path: filePath, bytesWritten: 0, chunksWritten: 0, error: 'File does not exist' };
      }

      fs.appendFileSync(filePath, content, { encoding });
      return { success: true, path: filePath, bytesWritten: Buffer.byteLength(content, encoding), chunksWritten: 1 };
    } catch (error) {
      return { success: false, path: filePath, bytesWritten: 0, chunksWritten: 0, error: (error as Error).message };
    }
  }
}

/**
 * Error recovery utilities for code generation
 */
export class ErrorRecovery {
  private static readonly MAX_ATTEMPTS = 3;

  /**
   * Analyze error and suggest recovery approaches
   */
  static analyze(context: ErrorRecoveryContext): ErrorRecoveryResult {
    const suggestions: CodegenRecoverySuggestion[] = [];
    const errorMessage = context.error.message.toLowerCase();

    // File system errors
    if (errorMessage.includes('enoent') || errorMessage.includes('no such file')) {
      suggestions.push({
        description: 'Create missing directory structure',
        action: 'alternative',
        details: 'The target directory does not exist. Create it before writing.',
        confidence: 'high'
      });
    }

    if (errorMessage.includes('eacces') || errorMessage.includes('permission denied')) {
      suggestions.push({
        description: 'Check file permissions',
        action: 'manual',
        details: 'The file or directory has restricted permissions. Check ownership and access rights.',
        confidence: 'high'
      });
    }

    if (errorMessage.includes('eexist')) {
      suggestions.push({
        description: 'File already exists',
        action: 'alternative',
        details: 'Use append mode or remove existing file first.',
        confidence: 'high'
      });
    }

    // Syntax errors
    if (errorMessage.includes('syntax') || errorMessage.includes('unexpected token')) {
      suggestions.push({
        description: 'Fix syntax error in generated code',
        action: 'retry',
        details: 'The generated code has syntax errors. Review and correct the code structure.',
        confidence: 'medium'
      });
    }

    // Network/timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
      if (context.attempts < this.MAX_ATTEMPTS) {
        suggestions.push({
          description: 'Retry the operation',
          action: 'retry',
          details: 'The operation timed out. Retrying may succeed.',
          confidence: 'medium'
        });
      }
    }

    // Memory errors
    if (errorMessage.includes('heap') || errorMessage.includes('memory')) {
      suggestions.push({
        description: 'Process in smaller chunks',
        action: 'alternative',
        details: 'The operation ran out of memory. Try processing smaller portions of data.',
        confidence: 'high'
      });
    }

    // Default suggestion if no specific match
    if (suggestions.length === 0) {
      suggestions.push({
        description: 'Review error details and try alternative approach',
        action: 'manual',
        details: `Error: ${context.error.message}. Consider reviewing the operation and trying a different approach.`,
        confidence: 'low'
      });
    }

    const recovered = suggestions.some(s => s.action === 'retry' && context.attempts < this.MAX_ATTEMPTS);
    const alternativeApproach = suggestions.find(s => s.action === 'alternative')?.details;

    return { recovered, suggestions, alternativeApproach };
  }

  /**
   * Get user-friendly error message
   */
  static formatError(error: Error, operation: string): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('enoent')) {
      return `Cannot ${operation}: The file or directory does not exist.`;
    }
    if (message.includes('eacces')) {
      return `Cannot ${operation}: Permission denied. Check file permissions.`;
    }
    if (message.includes('eexist')) {
      return `Cannot ${operation}: A file or directory already exists at this location.`;
    }
    if (message.includes('syntax')) {
      return `Cannot ${operation}: The code contains syntax errors.`;
    }
    if (message.includes('timeout')) {
      return `Cannot ${operation}: The operation timed out. Please try again.`;
    }
    
    return `Cannot ${operation}: ${error.message}`;
  }
}
