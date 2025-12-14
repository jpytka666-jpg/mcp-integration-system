/**
 * Types for code generation utilities
 */

export interface SyntaxCheckResult {
  valid: boolean;
  errors: SyntaxError[];
  warnings: SyntaxWarning[];
  language: string;
}

export interface SyntaxError {
  line: number;
  column: number;
  message: string;
  code: string;
  severity: 'error' | 'fatal';
}

export interface SyntaxWarning {
  line: number;
  column: number;
  message: string;
  code: string;
}

export interface FileWriteOptions {
  chunkSize?: number;
  appendMode?: boolean;
  encoding?: BufferEncoding;
  createDirectories?: boolean;
}

export interface FileWriteResult {
  success: boolean;
  path: string;
  bytesWritten: number;
  chunksWritten: number;
  error?: string;
}

export interface ErrorRecoveryContext {
  operation: string;
  error: Error;
  attempts: number;
  maxAttempts: number;
}

export interface CodegenRecoverySuggestion {
  description: string;
  action: 'retry' | 'alternative' | 'manual' | 'skip';
  details: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ErrorRecoveryResult {
  recovered: boolean;
  suggestions: CodegenRecoverySuggestion[];
  alternativeApproach?: string;
}

export type SupportedLanguage = 
  | 'typescript'
  | 'javascript'
  | 'json'
  | 'markdown'
  | 'yaml'
  | 'html'
  | 'css';
