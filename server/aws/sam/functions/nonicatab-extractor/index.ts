/**
 * NonicaTab Extractor Lambda
 * Extracts Revit data using NonicaTab MCP integration with circuit breaker
 */

import { Context } from 'aws-lambda';

interface NonicaTabExtractorEvent {
  tenantId: string;
  assessmentId: string;
  correlationId: string;
  revitFile: string;
  extractionOptions?: {
    elementTypes?: string[];
    includeGeometry?: boolean;
    includeParameters?: boolean;
  };
}

interface ExtractedElement {
  id: string;
  category: string;
  family: string;
  type: string;
  parameters: Record<string, unknown>;
  geometry?: {
    boundingBox: { min: number[]; max: number[] };
    volume?: number;
    area?: number;
  };
}

interface ExtractionResult {
  success: boolean;
  data: {
    elements: ExtractedElement[];
    metadata: {
      extractedAt: string;
      elementCount: number;
      revitFile: string;
      duration: number;
    };
  };
  metrics: {
    nonicaTabCalls: number;
    retryCount: number;
    circuitBreakerState: string;
  };
}

// Circuit breaker state
const circuitBreaker = {
  state: 'CLOSED' as 'CLOSED' | 'OPEN' | 'HALF_OPEN',
  failures: 0,
  lastFailure: 0,
  threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
  timeout: 30000 // 30 seconds
};

export async function handler(
  event: NonicaTabExtractorEvent,
  context: Context
): Promise<ExtractionResult> {
  const startTime = Date.now();
  let retryCount = 0;
  let nonicaTabCalls = 0;

  console.log('NonicaTab extraction started', {
    requestId: context.awsRequestId,
    assessmentId: event.assessmentId,
    tenantId: event.tenantId,
    correlationId: event.correlationId,
    revitFile: event.revitFile
  });

  // Check circuit breaker
  if (!canExecute()) {
    throw new CircuitBreakerOpenError('Circuit breaker is open');
  }

  try {
    const maxRetries = parseInt(process.env.RETRY_MAX_ATTEMPTS || '3');
    const baseDelay = parseInt(process.env.RETRY_BASE_DELAY_MS || '100');

    let elements: ExtractedElement[] = [];

    // Extract elements with retry
    while (retryCount <= maxRetries) {
      try {
        nonicaTabCalls++;
        elements = await extractFromNonicaTab(
          event.revitFile,
          event.extractionOptions
        );
        recordSuccess();
        break;
      } catch (error) {
        retryCount++;
        if (retryCount > maxRetries) {
          recordFailure();
          throw error;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, retryCount - 1) + Math.random() * 100;
        await sleep(delay);
        console.log(`Retry ${retryCount}/${maxRetries} after ${delay}ms`);
      }
    }

    const duration = Date.now() - startTime;

    console.log('NonicaTab extraction completed', {
      elementCount: elements.length,
      duration,
      retryCount,
      nonicaTabCalls
    });

    return {
      success: true,
      data: {
        elements,
        metadata: {
          extractedAt: new Date().toISOString(),
          elementCount: elements.length,
          revitFile: event.revitFile,
          duration
        }
      },
      metrics: {
        nonicaTabCalls,
        retryCount,
        circuitBreakerState: circuitBreaker.state
      }
    };
  } catch (error) {
    console.error('NonicaTab extraction failed', {
      error: (error as Error).message,
      circuitBreakerState: circuitBreaker.state
    });
    throw error;
  }
}

async function extractFromNonicaTab(
  revitFile: string,
  options?: NonicaTabExtractorEvent['extractionOptions']
): Promise<ExtractedElement[]> {
  // Simulate NonicaTab MCP call
  // In production, this would use the actual MCP client
  console.log('Calling NonicaTab MCP', { revitFile, options });

  // Simulated extraction (replace with actual MCP call)
  const elementTypes = options?.elementTypes || ['Walls', 'Floors', 'Doors', 'Windows'];
  const elements: ExtractedElement[] = [];

  for (const category of elementTypes) {
    // Simulate extracting 10-50 elements per category
    const count = Math.floor(Math.random() * 40) + 10;
    for (let i = 0; i < count; i++) {
      elements.push({
        id: `${category}-${i}`,
        category,
        family: `${category} Family`,
        type: `Type ${Math.floor(Math.random() * 5) + 1}`,
        parameters: {
          Area: Math.random() * 100,
          Height: Math.random() * 10 + 2,
          Material: ['Concrete', 'Wood', 'Steel', 'Glass'][Math.floor(Math.random() * 4)]
        },
        geometry: options?.includeGeometry ? {
          boundingBox: {
            min: [Math.random() * 10, Math.random() * 10, 0],
            max: [Math.random() * 10 + 10, Math.random() * 10 + 10, Math.random() * 5 + 2]
          },
          volume: Math.random() * 50,
          area: Math.random() * 100
        } : undefined
      });
    }
  }

  return elements;
}

function canExecute(): boolean {
  if (circuitBreaker.state === 'CLOSED') {
    return true;
  }

  if (circuitBreaker.state === 'OPEN') {
    if (Date.now() - circuitBreaker.lastFailure >= circuitBreaker.timeout) {
      circuitBreaker.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }

  // HALF_OPEN - allow one request through
  return true;
}

function recordSuccess(): void {
  if (circuitBreaker.state === 'HALF_OPEN') {
    circuitBreaker.state = 'CLOSED';
    circuitBreaker.failures = 0;
  }
}

function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();

  if (circuitBreaker.failures >= circuitBreaker.threshold) {
    circuitBreaker.state = 'OPEN';
    console.log('Circuit breaker tripped', { failures: circuitBreaker.failures });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpen';
  }
}
