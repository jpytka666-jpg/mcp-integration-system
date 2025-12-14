/**
 * Steering file validation system for Kiro
 * Validates steering files against schema and structure requirements
 * Supports the correct Kiro global storage location
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SteeringFrontMatter,
  InclusionMode,
  SteeringParseError,
  SteeringParseWarning,
  SteeringErrorCode,
  SteeringWarningCode
} from './types.js';

// Valid inclusion modes
const VALID_INCLUSION_MODES: InclusionMode[] = ['always', 'fileMatch', 'manual'];

// Front-matter field patterns
const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;
const INCLUSION_PATTERN = /inclusion:\s*["']?([\w]+)["']?/;
const FILE_MATCH_PATTERN_REGEX = /fileMatchPattern:\s*["']?([^"'\n]+)["']?/;

export interface SteeringValidationResult {
  valid: boolean;
  errors: SteeringParseError[];
  warnings: SteeringParseWarning[];
  frontMatter?: SteeringFrontMatter;
}

export interface SteeringLocationConfig {
  /** The Kiro global storage path for steering files */
  globalStoragePath: string;
  /** Workspace-level steering directory (fallback) */
  workspacePath?: string;
}

/**
 * Get the Kiro steering files path for the workspace
 * Default location: .kiro/steering (relative to workspace root)
 * @param workspaceRoot - Optional workspace root path, defaults to current directory
 */
export function getKiroSteeringPath(workspaceRoot: string = '.'): string {
  // Use environment variable if set, otherwise use workspace .kiro/steering
  if (process.env.KIRO_STEERING_PATH) {
    return process.env.KIRO_STEERING_PATH;
  }
  
  // Default Kiro steering location in workspace
  return path.join(workspaceRoot, '.kiro', 'steering');
}

/**
 * Get the workspace-level steering path
 */
export function getWorkspaceSteeringPath(workspacePath: string = '.'): string {
  return path.join(workspacePath, '.kiro', 'steering');
}

/**
 * Validate that a steering directory exists and is accessible
 */
export function validateSteeringDirectory(directoryPath: string): SteeringValidationResult {
  const errors: SteeringParseError[] = [];
  const warnings: SteeringParseWarning[] = [];

  if (!fs.existsSync(directoryPath)) {
    warnings.push({
      filePath: directoryPath,
      message: `Steering directory does not exist: ${directoryPath}`,
      code: 'MISSING_FRONT_MATTER' as SteeringWarningCode
    });
    return { valid: true, errors, warnings }; // Not an error, just no steering files
  }

  try {
    fs.accessSync(directoryPath, fs.constants.R_OK);
  } catch {
    errors.push({
      filePath: directoryPath,
      message: `Cannot read steering directory: ${directoryPath}`,
      code: 'READ_ERROR'
    });
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

/**
 * Validate steering file structure and schema
 */
export function validateSteeringFile(filePath: string): SteeringValidationResult {
  const errors: SteeringParseError[] = [];
  const warnings: SteeringParseWarning[] = [];

  // Check file exists
  if (!fs.existsSync(filePath)) {
    errors.push({
      filePath,
      message: `Steering file does not exist: ${filePath}`,
      code: 'FILE_NOT_FOUND'
    });
    return { valid: false, errors, warnings };
  }

  // Check file extension
  if (!filePath.endsWith('.md')) {
    errors.push({
      filePath,
      message: 'Steering files must have .md extension',
      code: 'INVALID_FRONT_MATTER'
    });
    return { valid: false, errors, warnings };
  }

  // Read file content
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    errors.push({
      filePath,
      message: `Error reading steering file: ${error}`,
      code: 'READ_ERROR'
    });
    return { valid: false, errors, warnings };
  }

  // Validate front-matter
  const frontMatterResult = validateFrontMatter(content, filePath);
  errors.push(...frontMatterResult.errors);
  warnings.push(...frontMatterResult.warnings);

  // Validate content structure
  const contentResult = validateContent(content, filePath);
  warnings.push(...contentResult.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    frontMatter: frontMatterResult.frontMatter
  };
}

/**
 * Validate front-matter section of a steering file
 */
export function validateFrontMatter(
  content: string,
  filePath: string
): { frontMatter?: SteeringFrontMatter; errors: SteeringParseError[]; warnings: SteeringParseWarning[] } {
  const errors: SteeringParseError[] = [];
  const warnings: SteeringParseWarning[] = [];

  const match = content.match(FRONT_MATTER_PATTERN);
  
  if (!match) {
    warnings.push({
      filePath,
      message: 'No front-matter found, defaulting to inclusion: always',
      code: 'MISSING_FRONT_MATTER'
    });
    return { 
      frontMatter: { inclusion: 'always' }, 
      errors, 
      warnings 
    };
  }

  const frontMatterContent = match[1];
  const frontMatter: SteeringFrontMatter = { inclusion: 'always' };

  // Validate inclusion mode
  const inclusionMatch = frontMatterContent.match(INCLUSION_PATTERN);
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

  // Validate fileMatchPattern when inclusion is fileMatch
  const patternMatch = frontMatterContent.match(FILE_MATCH_PATTERN_REGEX);
  if (patternMatch) {
    frontMatter.fileMatchPattern = patternMatch[1].trim();
    
    // Validate pattern syntax
    const patternValidation = validateFileMatchPattern(frontMatter.fileMatchPattern);
    if (!patternValidation.valid) {
      warnings.push({
        filePath,
        message: patternValidation.message,
        code: 'EMPTY_CONTENT'
      });
    }
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
 * Validate file match pattern syntax
 */
export function validateFileMatchPattern(pattern: string): { valid: boolean; message: string } {
  if (!pattern || pattern.trim().length === 0) {
    return { valid: false, message: 'File match pattern cannot be empty' };
  }

  // Check for common pattern issues
  if (pattern.includes('***')) {
    return { valid: false, message: 'Invalid pattern: "***" is not a valid glob pattern' };
  }

  // Check for unbalanced brackets
  const openBrackets = (pattern.match(/\[/g) || []).length;
  const closeBrackets = (pattern.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    return { valid: false, message: 'Invalid pattern: unbalanced brackets' };
  }

  return { valid: true, message: 'Pattern is valid' };
}

/**
 * Validate steering file content structure
 */
export function validateContent(
  content: string,
  filePath: string
): { warnings: SteeringParseWarning[] } {
  const warnings: SteeringParseWarning[] = [];

  // Remove front-matter for content analysis
  const contentWithoutFrontMatter = content.replace(FRONT_MATTER_PATTERN, '').trim();

  if (!contentWithoutFrontMatter) {
    warnings.push({
      filePath,
      message: 'Steering file has no content after front-matter',
      code: 'EMPTY_CONTENT'
    });
  }

  // Check for file references and validate syntax
  const fileRefPattern = /#\[\[file:([^\]]*)\]\]/g;
  let match;
  while ((match = fileRefPattern.exec(contentWithoutFrontMatter)) !== null) {
    const refPath = match[1];
    if (!refPath || refPath.trim().length === 0) {
      warnings.push({
        filePath,
        message: `Empty file reference found at position ${match.index}`,
        code: 'REFERENCE_NOT_FOUND'
      });
    }
  }

  return { warnings };
}

/**
 * Validate all steering files in a directory
 */
export function validateSteeringDirectory_Files(directoryPath: string): SteeringValidationResult[] {
  const results: SteeringValidationResult[] = [];

  // First validate the directory itself
  const dirResult = validateSteeringDirectory(directoryPath);
  if (!dirResult.valid) {
    return [dirResult];
  }

  if (!fs.existsSync(directoryPath)) {
    return results;
  }

  try {
    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(directoryPath, file);
        results.push(validateSteeringFile(filePath));
      }
    }
  } catch {
    // Directory read error handled by validateSteeringDirectory
  }

  return results;
}

/**
 * Steering file validator class for comprehensive validation
 */
export class SteeringValidator {
  private locationConfig: SteeringLocationConfig;

  constructor(config?: Partial<SteeringLocationConfig>) {
    const workspaceRoot = config?.workspacePath || '.';
    this.locationConfig = {
      globalStoragePath: config?.globalStoragePath || getKiroSteeringPath(workspaceRoot),
      workspacePath: config?.workspacePath
    };
  }

  /**
   * Get the configured steering paths
   */
  getSteeringPaths(): string[] {
    const paths: string[] = [this.locationConfig.globalStoragePath];
    if (this.locationConfig.workspacePath) {
      paths.push(getWorkspaceSteeringPath(this.locationConfig.workspacePath));
    }
    return paths;
  }

  /**
   * Validate all configured steering locations
   */
  validateAllLocations(): Map<string, SteeringValidationResult[]> {
    const results = new Map<string, SteeringValidationResult[]>();
    
    for (const steeringPath of this.getSteeringPaths()) {
      results.set(steeringPath, validateSteeringDirectory_Files(steeringPath));
    }

    return results;
  }

  /**
   * Validate a single steering file
   */
  validateFile(filePath: string): SteeringValidationResult {
    return validateSteeringFile(filePath);
  }

  /**
   * Check if the Kiro global storage path exists
   */
  isGlobalStorageAvailable(): boolean {
    return fs.existsSync(this.locationConfig.globalStoragePath);
  }

  /**
   * Get summary of validation results
   */
  getValidationSummary(results: Map<string, SteeringValidationResult[]>): {
    totalFiles: number;
    validFiles: number;
    totalErrors: number;
    totalWarnings: number;
  } {
    let totalFiles = 0;
    let validFiles = 0;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const fileResults of results.values()) {
      for (const result of fileResults) {
        totalFiles++;
        if (result.valid) validFiles++;
        totalErrors += result.errors.length;
        totalWarnings += result.warnings.length;
      }
    }

    return { totalFiles, validFiles, totalErrors, totalWarnings };
  }
}
