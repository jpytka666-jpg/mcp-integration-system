/**
 * Types for the steering system
 */

export type InclusionMode = 'always' | 'fileMatch' | 'manual';

export interface SteeringFrontMatter {
  inclusion: InclusionMode;
  fileMatchPattern?: string;
}

export interface SteeringFile {
  filePath: string;
  fileName: string;
  frontMatter: SteeringFrontMatter;
  content: string;
  resolvedReferences: FileReference[];
}

export interface FileReference {
  originalSyntax: string;
  relativePath: string;
  resolvedContent: string | null;
  exists: boolean;
}

export interface SteeringParseResult {
  success: boolean;
  steeringFile?: SteeringFile;
  errors: SteeringParseError[];
  warnings: SteeringParseWarning[];
}

export interface SteeringParseError {
  filePath: string;
  message: string;
  code: SteeringErrorCode;
  line?: number;
}

export interface SteeringParseWarning {
  filePath: string;
  message: string;
  code: SteeringWarningCode;
  line?: number;
}

export type SteeringErrorCode =
  | 'FILE_NOT_FOUND'
  | 'READ_ERROR'
  | 'INVALID_FRONT_MATTER'
  | 'MISSING_FILE_MATCH_PATTERN'
  | 'INVALID_INCLUSION_MODE';

export type SteeringWarningCode =
  | 'MISSING_FRONT_MATTER'
  | 'MISSING_INCLUSION'
  | 'REFERENCE_NOT_FOUND'
  | 'EMPTY_CONTENT';

export interface SteeringContext {
  steeringFiles: SteeringFile[];
  activeFile?: string;
  manualKeys: string[];
}
