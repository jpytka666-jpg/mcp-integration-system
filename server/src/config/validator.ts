/**
 * Configuration validation utilities for Kiro system
 */

import { ValidationResult, ValidationError, ValidationWarning, MCPConfig, MCPServerConfig } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

export class ConfigValidator {
  /**
   * Validates MCP configuration structure and content
   */
  static validateMCPConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config || typeof config !== 'object') {
      errors.push({
        path: 'root',
        message: 'Configuration must be a valid object',
        code: 'INVALID_ROOT'
      });
      return { valid: false, errors, warnings };
    }

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      errors.push({
        path: 'mcpServers',
        message: 'mcpServers must be an object',
        code: 'MISSING_MCP_SERVERS'
      });
    } else {
      // Validate each server configuration
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        this.validateMCPServer(serverName, serverConfig as any, errors, warnings);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static validateMCPServer(
    serverName: string, 
    config: any, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    const basePath = `mcpServers.${serverName}`;

    if (!config || typeof config !== 'object') {
      errors.push({
        path: basePath,
        message: 'Server configuration must be an object',
        code: 'INVALID_SERVER_CONFIG'
      });
      return;
    }

    // Validate required fields
    if (!config.command || typeof config.command !== 'string') {
      errors.push({
        path: `${basePath}.command`,
        message: 'command is required and must be a string',
        code: 'MISSING_COMMAND'
      });
    }

    if (config.args && !Array.isArray(config.args)) {
      errors.push({
        path: `${basePath}.args`,
        message: 'args must be an array',
        code: 'INVALID_ARGS'
      });
    }

    if (config.env && typeof config.env !== 'object') {
      errors.push({
        path: `${basePath}.env`,
        message: 'env must be an object',
        code: 'INVALID_ENV'
      });
    }

    if (config.disabled !== undefined && typeof config.disabled !== 'boolean') {
      errors.push({
        path: `${basePath}.disabled`,
        message: 'disabled must be a boolean',
        code: 'INVALID_DISABLED'
      });
    }

    if (config.autoApprove && !Array.isArray(config.autoApprove)) {
      errors.push({
        path: `${basePath}.autoApprove`,
        message: 'autoApprove must be an array',
        code: 'INVALID_AUTO_APPROVE'
      });
    }

    // Warnings for common issues
    if (config.command === 'uvx' && (!config.args || config.args.length === 0)) {
      warnings.push({
        path: `${basePath}.args`,
        message: 'uvx command typically requires package arguments',
        code: 'UVX_MISSING_ARGS'
      });
    }
  }

  /**
   * Validates steering file format and front-matter
   */
  static validateSteeringFile(filePath: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      if (!fs.existsSync(filePath)) {
        errors.push({
          path: filePath,
          message: 'Steering file does not exist',
          code: 'FILE_NOT_FOUND'
        });
        return { valid: false, errors, warnings };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Check for front-matter
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontMatterMatch) {
        const frontMatter = frontMatterMatch[1];
        
        // Validate inclusion mode
        const inclusionMatch = frontMatter.match(/inclusion:\s*["']?(always|fileMatch|manual)["']?/);
        if (!inclusionMatch) {
          warnings.push({
            path: `${filePath}:front-matter`,
            message: 'No inclusion mode specified, defaulting to "always"',
            code: 'MISSING_INCLUSION'
          });
        }

        // Check for fileMatchPattern when inclusion is fileMatch
        if (inclusionMatch && inclusionMatch[1] === 'fileMatch') {
          const patternMatch = frontMatter.match(/fileMatchPattern:\s*["']?([^"'\n]+)["']?/);
          if (!patternMatch) {
            errors.push({
              path: `${filePath}:front-matter`,
              message: 'fileMatchPattern is required when inclusion is "fileMatch"',
              code: 'MISSING_FILE_MATCH_PATTERN'
            });
          }
        }
      }

      // Check for file references
      const fileReferences = content.match(/#\[\[file:[^\]]+\]\]/g);
      if (fileReferences) {
        for (const ref of fileReferences) {
          const filePath = ref.match(/#\[\[file:([^\]]+)\]\]/)?.[1];
          if (filePath && !fs.existsSync(filePath)) {
            warnings.push({
              path: `${filePath}:reference`,
              message: `Referenced file does not exist: ${filePath}`,
              code: 'MISSING_REFERENCE'
            });
          }
        }
      }

    } catch (error) {
      errors.push({
        path: filePath,
        message: `Error reading steering file: ${error}`,
        code: 'READ_ERROR'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates directory structure requirements
   */
  static validateDirectoryStructure(basePath: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const requiredDirs = ['specs', 'steering', 'settings'];
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(basePath, dir);
      if (!fs.existsSync(dirPath)) {
        errors.push({
          path: dirPath,
          message: `Required directory does not exist: ${dir}`,
          code: 'MISSING_DIRECTORY'
        });
      } else if (!fs.statSync(dirPath).isDirectory()) {
        errors.push({
          path: dirPath,
          message: `Path exists but is not a directory: ${dir}`,
          code: 'NOT_DIRECTORY'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}