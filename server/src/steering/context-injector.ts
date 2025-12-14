/**
 * Context injection system for steering files
 * Handles merging steering content into user interactions based on inclusion modes
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SteeringFile,
  SteeringContext,
  InclusionMode,
  SteeringParseResult
} from './types.js';
import { SteeringParser, matchesFilePattern } from './parser.js';

export interface ContextInjectionOptions {
  activeFilePath?: string;
  manualKeys?: string[];
  expandReferences?: boolean;
}

export interface InjectedContext {
  content: string;
  sources: SteeringSource[];
  totalFiles: number;
  includedFiles: number;
}

export interface SteeringSource {
  fileName: string;
  filePath: string;
  inclusionMode: InclusionMode;
  reason: string;
}

export class ContextInjector {
  private parser: SteeringParser;
  private steeringDirectory: string;
  private cachedFiles: Map<string, SteeringFile> = new Map();

  constructor(steeringDirectory: string, basePath: string = '.') {
    this.steeringDirectory = steeringDirectory;
    this.parser = new SteeringParser(basePath);
  }

  /**
   * Load and cache all steering files from the directory
   */
  loadSteeringFiles(): SteeringParseResult[] {
    const results = this.parser.parseDirectory(this.steeringDirectory);
    
    // Cache successfully parsed files
    this.cachedFiles.clear();
    for (const result of results) {
      if (result.success && result.steeringFile) {
        this.cachedFiles.set(result.steeringFile.filePath, result.steeringFile);
      }
    }

    return results;
  }

  /**
   * Get all cached steering files
   */
  getSteeringFiles(): SteeringFile[] {
    return Array.from(this.cachedFiles.values());
  }

  /**
   * Inject relevant steering context based on options
   */
  injectContext(options: ContextInjectionOptions = {}): InjectedContext {
    const { activeFilePath, manualKeys = [], expandReferences = true } = options;
    
    const sources: SteeringSource[] = [];
    const contentParts: string[] = [];
    const allFiles = this.getSteeringFiles();

    for (const steeringFile of allFiles) {
      const shouldInclude = this.shouldIncludeFile(steeringFile, activeFilePath, manualKeys);
      
      if (shouldInclude.include) {
        sources.push({
          fileName: steeringFile.fileName,
          filePath: steeringFile.filePath,
          inclusionMode: steeringFile.frontMatter.inclusion,
          reason: shouldInclude.reason
        });

        // Get content, optionally expanding references
        const content = expandReferences
          ? this.parser.expandReferences(steeringFile)
          : steeringFile.content;

        contentParts.push(this.formatSteeringContent(steeringFile, content));
      }
    }

    return {
      content: contentParts.join('\n\n'),
      sources,
      totalFiles: allFiles.length,
      includedFiles: sources.length
    };
  }

  /**
   * Determine if a steering file should be included based on its mode and context
   */
  private shouldIncludeFile(
    steeringFile: SteeringFile,
    activeFilePath?: string,
    manualKeys: string[] = []
  ): { include: boolean; reason: string } {
    const { inclusion, fileMatchPattern } = steeringFile.frontMatter;

    switch (inclusion) {
      case 'always':
        return { include: true, reason: 'Always included' };

      case 'fileMatch':
        if (!activeFilePath) {
          return { include: false, reason: 'No active file to match against' };
        }
        if (!fileMatchPattern) {
          return { include: false, reason: 'No file match pattern defined' };
        }
        const matches = matchesFilePattern(activeFilePath, fileMatchPattern);
        return {
          include: matches,
          reason: matches
            ? `Active file matches pattern: ${fileMatchPattern}`
            : `Active file does not match pattern: ${fileMatchPattern}`
        };

      case 'manual':
        // Check if the steering file name (without extension) is in manual keys
        const fileKey = this.getManualKey(steeringFile);
        const isActivated = manualKeys.some(
          key => key.toLowerCase() === fileKey.toLowerCase()
        );
        return {
          include: isActivated,
          reason: isActivated
            ? `Manually activated via key: ${fileKey}`
            : `Not manually activated (key: ${fileKey})`
        };

      default:
        return { include: false, reason: `Unknown inclusion mode: ${inclusion}` };
    }
  }

  /**
   * Get the manual activation key for a steering file
   * Uses the filename without extension
   */
  private getManualKey(steeringFile: SteeringFile): string {
    return path.basename(steeringFile.fileName, '.md');
  }

  /**
   * Format steering content with metadata header
   */
  private formatSteeringContent(steeringFile: SteeringFile, content: string): string {
    return `## Included Rules (${steeringFile.fileName}) [Workspace]\n\n${content}`;
  }

  /**
   * Get list of available manual steering keys
   */
  getManualKeys(): string[] {
    return this.getSteeringFiles()
      .filter(f => f.frontMatter.inclusion === 'manual')
      .map(f => this.getManualKey(f));
  }

  /**
   * Get steering files that match a specific file path
   */
  getMatchingFiles(filePath: string): SteeringFile[] {
    return this.getSteeringFiles().filter(steeringFile => {
      if (steeringFile.frontMatter.inclusion !== 'fileMatch') {
        return false;
      }
      const pattern = steeringFile.frontMatter.fileMatchPattern;
      return pattern && matchesFilePattern(filePath, pattern);
    });
  }

  /**
   * Get always-included steering files
   */
  getAlwaysIncludedFiles(): SteeringFile[] {
    return this.getSteeringFiles().filter(
      f => f.frontMatter.inclusion === 'always'
    );
  }

  /**
   * Build a complete steering context object
   */
  buildContext(options: ContextInjectionOptions = {}): SteeringContext {
    const { activeFilePath, manualKeys = [] } = options;
    
    return {
      steeringFiles: this.getSteeringFiles(),
      activeFile: activeFilePath,
      manualKeys
    };
  }

  /**
   * Refresh cached steering files from disk
   */
  refresh(): void {
    this.loadSteeringFiles();
  }

  /**
   * Clear the steering file cache
   */
  clearCache(): void {
    this.cachedFiles.clear();
  }
}

/**
 * Create a context injector for the default .kiro/steering directory
 */
export function createDefaultContextInjector(basePath: string = '.'): ContextInjector {
  const steeringDir = path.join(basePath, '.kiro', 'steering');
  return new ContextInjector(steeringDir, basePath);
}
