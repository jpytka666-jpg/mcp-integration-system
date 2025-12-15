/**
 * Assessment Validator Lambda
 * Validates assessment requests before processing
 */

import { Context } from 'aws-lambda';

interface AssessmentValidatorEvent {
  tenantId: string;
  assessmentId: string;
  correlationId: string;
  input: {
    revitFile: string;
    extractionOptions?: ExtractOptions;
    transformOptions?: TransformOptions;
    outputFormat?: string;
    templateId?: string;
  };
}

interface ExtractOptions {
  elementTypes?: string[];
  includeGeometry?: boolean;
  includeParameters?: boolean;
}

interface TransformOptions {
  groupBy?: string;
  sortBy?: string;
  filterEmpty?: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    validatedAt: string;
    assessmentId: string;
    tenantId: string;
  };
}

export async function handler(
  event: AssessmentValidatorEvent,
  context: Context
): Promise<ValidationResult> {
  console.log('Assessment validation started', {
    requestId: context.awsRequestId,
    assessmentId: event.assessmentId,
    tenantId: event.tenantId,
    correlationId: event.correlationId
  });

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!event.tenantId) {
    errors.push('tenantId is required');
  }

  if (!event.assessmentId) {
    errors.push('assessmentId is required');
  }

  if (!event.input) {
    errors.push('input is required');
  } else {
    // Validate Revit file
    if (!event.input.revitFile) {
      errors.push('input.revitFile is required');
    } else if (!isValidRevitPath(event.input.revitFile)) {
      errors.push('input.revitFile must be a valid .rvt file path or S3 URI');
    }

    // Validate extraction options
    if (event.input.extractionOptions) {
      const extractErrors = validateExtractionOptions(event.input.extractionOptions);
      errors.push(...extractErrors);
    }

    // Validate transform options
    if (event.input.transformOptions) {
      const transformWarnings = validateTransformOptions(event.input.transformOptions);
      warnings.push(...transformWarnings);
    }

    // Validate output format
    if (event.input.outputFormat) {
      const validFormats = ['powerpoint', 'pdf', 'excel', 'json'];
      if (!validFormats.includes(event.input.outputFormat.toLowerCase())) {
        warnings.push(`Unknown output format: ${event.input.outputFormat}. Defaulting to powerpoint.`);
      }
    }
  }

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      validatedAt: new Date().toISOString(),
      assessmentId: event.assessmentId,
      tenantId: event.tenantId
    }
  };

  console.log('Assessment validation completed', {
    valid: result.valid,
    errorCount: errors.length,
    warningCount: warnings.length
  });

  return result;
}

function isValidRevitPath(path: string): boolean {
  // S3 URI
  if (path.startsWith('s3://')) {
    return path.endsWith('.rvt');
  }

  // Local path (for testing)
  if (path.endsWith('.rvt')) {
    return true;
  }

  return false;
}

function validateExtractionOptions(options: ExtractOptions): string[] {
  const errors: string[] = [];

  if (options.elementTypes) {
    if (!Array.isArray(options.elementTypes)) {
      errors.push('extractionOptions.elementTypes must be an array');
    } else {
      const validTypes = ['Walls', 'Floors', 'Ceilings', 'Roofs', 'Doors', 'Windows', 'Furniture', 'MEP'];
      for (const type of options.elementTypes) {
        if (!validTypes.includes(type)) {
          errors.push(`Unknown element type: ${type}`);
        }
      }
    }
  }

  return errors;
}

function validateTransformOptions(options: TransformOptions): string[] {
  const warnings: string[] = [];

  if (options.groupBy) {
    const validGroupBy = ['category', 'family', 'type', 'level'];
    if (!validGroupBy.includes(options.groupBy)) {
      warnings.push(`Unknown groupBy value: ${options.groupBy}. Using default.`);
    }
  }

  if (options.sortBy) {
    const validSortBy = ['name', 'count', 'area', 'volume'];
    if (!validSortBy.includes(options.sortBy)) {
      warnings.push(`Unknown sortBy value: ${options.sortBy}. Using default.`);
    }
  }

  return warnings;
}
