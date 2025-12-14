/**
 * Steering file parser for Kiro system
 * Parses markdown files with front-matter and resolves file references
 * Supports Kiro global storage location for steering files
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SteeringFile,
  SteeringFrontMatter,
  SteeringParseResult,
  SteeringParseError,
  SteeringParseWarning,
  FileReference,
  InclusionMode,
  SteeringErrorCode,
  SteeringWarningCode
} from './types.js';

// Pattern for file references: #[[file:relative/path.ext]]
const FILE_REFERENCE_PATTERN = /#\[\[file:([^\]]+)\]\]/g;

// Pattern for front-matter block
const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;

// Valid inclusion modes
const VALID_INCLUSION_MODES: InclusionMode[] = ['always', 'fileMatch', 'manual'];

/**
 * Get the Kiro steering files path for the workspace
 * Default location: .kiro/steering (relative to workspace root)
 * @param workspaceRoot - Optional workspace root path, defaults to current directory
 */
export function getKiroGlobalSteeringPath(workspaceRoot: string = '.'): string {
  // Use environment variable if set, otherwise use workspace .kiro/steering
  if (process.env.KIRO_STEERING_PATH) {
    return process.env.KIRO_STEERING_PATH;
  }
  
  // Default Kiro steering location in workspace
  return path.join(workspaceRoot, '.kiro', 'steering');
}

export interface SteeringParserOptions {
  /** Base path for resolving relative file references */
  basePath?: string;
  /** Use Kiro global storage path instead of workspace path */
  useGlobalStorage?: boolean;
  /** Custom steering directory path (overrides other options) */
  customSteeringPath?: string;
}

export class SteeringParser {
  private basePath: string;
  private steeringPath: string;

  constructor(basePathOrOptions: string | SteeringParserOptions = '.') {
    if (typeof basePathOrOptions === 'string') {
      this.basePath = basePathOrOptions;
      this.steeringPath = basePathOrOptions;
    } else {
      this.basePath = basePathOrOptions.basePath || '.';
      
      if (basePathOrOptions.customSteeringPath) {
        this.steeringPath = basePathOrOptions.customSteeringPath;
      } else if (basePathOrOptions.useGlobalStorage) {
        this.steeringPath = getKiroGlobalSteeringPath(this.basePath);
      } else {
        this.steeringPath = this.basePath;
      }
    }
  }

  /**
   * Get the configured steering path
   */
  getSteeringPath(): string {
    return this.steeringPath;
  }

  /**
   * Parse a steering file from the given path
   */
  parse(filePath: string): SteeringParseResult {
    const errors: SteeringParseError[] = [];
    const warnings: SteeringParseWarning[] = [];

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      errors.push({
        filePath,
        message: `Steering file does not exist: ${filePath}`,
        code: 'FILE_NOT_FOUND'
      });
      return { success: false, errors, warnings };
    }

    // Read file content
    let rawContent: string;
    try {
      rawContent = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      errors.push({
        filePath,
        message: `Error reading steering file: ${error}`,
        code: 'READ_ERROR'
      });
      return { success: false, errors, warnings };
    }

    // Parse front-matter
    const frontMatterResult = this.parseFrontMatter(rawContent, filePath);
    errors.push(...frontMatterResult.errors);
    warnings.push(...frontMatterResult.warnings);

    // Extract content (without front-matter)
    const content = this.extractContent(rawContent);

    if (!content.trim()) {
      warnings.push({
        filePath,
        message: 'Steering file has no content after front-matter',
        code: 'EMPTY_CONTENT'
      });
    }

    // Resolve file references
    const references = this.resolveFileReferences(content, filePath);
    for (const ref of references) {
      if (!ref.exists) {
        warnings.push({
          filePath,
          message: `Referenced file does not exist: ${ref.relativePath}`,
          code: 'REFERENCE_NOT_FOUND'
        });
      }
    }

    // Build steering file object
    const steeringFile: SteeringFile = {
      filePath,
      fileName: path.basename(filePath),
      frontMatter: frontMatterResult.frontMatter,
      content,
      resolvedReferences: references
    };

    return {
      success: errors.length === 0,
      steeringFile,
      errors,
      warnings
    };
  }

  /**
   * Parse front-matter from raw content
   */
  private parseFrontMatter(
    rawContent: string,
    filePath: string
  ): { frontMatter: SteeringFrontMatter; errors: SteeringParseError[]; warnings: SteeringParseWarning[] } {
    const errors: SteeringParseError[] = [];
    const warnings: SteeringParseWarning[] = [];

    // Default front-matter (always included)
    const defaultFrontMatter: SteeringFrontMatter = {
      inclusion: 'always'
    };

    const match = rawContent.match(FRONT_MATTER_PATTERN);
    if (!match) {
      warnings.push({
        filePath,
        message: 'No front-matter found, defaulting to inclusion: always',
        code: 'MISSING_FRONT_MATTER'
      });
      return { frontMatter: defaultFrontMatter, errors, warnings };
    }

    const frontMatterContent = match[1];
    const frontMatter: SteeringFrontMatter = { ...defaultFrontMatter };

    // Parse inclusion mode
    const inclusionMatch = frontMatterContent.match(/inclusion:\s*["']?([\w]+)["']?/);
    if (inclusionMatch) {
      const inclusionValue = inclusionMatch[1] as InclusionMode;
      if (VALID_INCLUSION_MODES.includes(inclusionValue)) {
        frontMatter.inclusion = inclusionValue;
      } else {
        errors.push({
          filePath,
          message: `Invalid inclusion mode: ${inclusionValue}. Must be one of: ${VALID_INCLUSION_MODES.join(', ')}`,
          code: 'INVALID_INCLUSION_MODE'
        });
      }
    } else {
      warnings.push({
        filePath,
        message: 'No inclusion mode specified in front-matter, defaulting to "always"',
        code: 'MISSING_INCLUSION'
      });
    }

    // Parse fileMatchPattern (required when inclusion is fileMatch)
    const patternMatch = frontMatterContent.match(/fileMatchPattern:\s*["']?([^"'\n]+)["']?/);
    if (patternMatch) {
      frontMatter.fileMatchPattern = patternMatch[1].trim();
    } else if (frontMatter.inclusion === 'fileMatch') {
      errors.push({
        filePath,
        message: 'fileMatchPattern is required when inclusion mode is "fileMatch"',
        code: 'MISSING_FILE_MATCH_PATTERN'
      });
    }

    return { frontMatter, errors, warnings };
  }

  /**
   * Extract content without front-matter
   */
  private extractContent(rawContent: string): string {
    return rawContent.replace(FRONT_MATTER_PATTERN, '').trim();
  }

  /**
   * Resolve all file references in the content
   */
  resolveFileReferences(content: string, sourceFilePath: string): FileReference[] {
    const references: FileReference[] = [];
    const sourceDir = path.dirname(sourceFilePath);

    // Reset regex state
    FILE_REFERENCE_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = FILE_REFERENCE_PATTERN.exec(content)) !== null) {
      const originalSyntax = match[0];
      const relativePath = match[1].trim();

      // Try multiple resolution strategies:
      // 1. Absolute path
      // 2. Relative to source file directory
      // 3. Relative to base path
      // 4. As-is (current working directory)
      let resolvedPath: string;
      let exists = false;

      if (path.isAbsolute(relativePath)) {
        resolvedPath = relativePath;
        exists = fs.existsSync(resolvedPath);
      } else {
        // Try relative to source file first
        resolvedPath = path.resolve(sourceDir, relativePath);
        exists = fs.existsSync(resolvedPath);

        // Try relative to base path
        if (!exists) {
          resolvedPath = path.resolve(this.basePath, relativePath);
          exists = fs.existsSync(resolvedPath);
        }

        // Try as-is (current working directory)
        if (!exists) {
          resolvedPath = path.resolve(relativePath);
          exists = fs.existsSync(resolvedPath);
        }
      }

      let resolvedContent: string | null = null;
      if (exists) {
        try {
          resolvedContent = fs.readFileSync(resolvedPath, 'utf-8');
        } catch {
          resolvedContent = null;
        }
      }

      references.push({
        originalSyntax,
        relativePath,
        resolvedContent,
        exists
      });
    }

    return references;
  }

  /**
   * Expand file references in content with their actual content
   */
  expandReferences(steeringFile: SteeringFile): string {
    let expandedContent = steeringFile.content;

    for (const ref of steeringFile.resolvedReferences) {
      if (ref.exists && ref.resolvedContent !== null) {
        expandedContent = expandedContent.replace(
          ref.originalSyntax,
          ref.resolvedContent
        );
      }
    }

    return expandedContent;
  }

  /**
   * Parse all steering files in a directory
   */
  parseDirectory(directoryPath: string): SteeringParseResult[] {
    const results: SteeringParseResult[] = [];

    if (!fs.existsSync(directoryPath)) {
      return results;
    }

    try {
      const files = fs.readdirSync(directoryPath);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(directoryPath, file);
          results.push(this.parse(filePath));
        }
      }
    } catch {
      // Directory read error - return empty results
    }

    return results;
  }
}

/**
 * Check if a file path matches a glob-like pattern
 * Supports basic patterns: *, **, ?
 */
export function matchesFilePattern(filePath: string, pattern: string): boolean {
  // Normalize paths
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Convert glob pattern to regex
  const regexPattern = normalizedPattern
    .replace(/\./g, '\\.')           // Escape dots
    .replace(/\*\*/g, '{{GLOBSTAR}}') // Temporarily replace **
    .replace(/\*/g, '[^/]*')          // * matches anything except /
    .replace(/\?/g, '[^/]')           // ? matches single char except /
    .replace(/{{GLOBSTAR}}/g, '.*');  // ** matches anything including /

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(normalizedPath);
}
