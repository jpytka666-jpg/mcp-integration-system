/**
 * Output Generator Lambda
 * Generates PowerPoint/PDF/Excel output from transformed data
 */

import { Context } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface OutputGeneratorEvent {
  tenantId: string;
  assessmentId: string;
  correlationId: string;
  transformedData: TransformedData;
  outputFormat?: 'powerpoint' | 'pdf' | 'excel' | 'json';
  templateId?: string;
}

interface TransformedData {
  categories: CategorySummary[];
  statistics: Statistics;
  charts: ChartData[];
  tables: TableData[];
}

interface CategorySummary {
  name: string;
  count: number;
  totalArea: number;
  totalVolume: number;
  families: FamilySummary[];
}

interface FamilySummary {
  name: string;
  count: number;
  types: string[];
}

interface Statistics {
  totalElements: number;
  totalArea: number;
  totalVolume: number;
  categoryCount: number;
  familyCount: number;
}

interface ChartData {
  type: 'pie' | 'bar' | 'line';
  title: string;
  data: { label: string; value: number }[];
}

interface TableData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

interface OutputResult {
  success: boolean;
  output: {
    format: string;
    s3Key: string;
    s3Url: string;
    fileSize: number;
    slideCount?: number;
    pageCount?: number;
  };
  metadata: {
    generatedAt: string;
    assessmentId: string;
    tenantId: string;
    duration: number;
  };
}

const s3Client = new S3Client({});
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET!;

export async function handler(
  event: OutputGeneratorEvent,
  context: Context
): Promise<OutputResult> {
  const startTime = Date.now();

  console.log('Output generation started', {
    requestId: context.awsRequestId,
    assessmentId: event.assessmentId,
    tenantId: event.tenantId,
    correlationId: event.correlationId,
    outputFormat: event.outputFormat || 'powerpoint'
  });

  const format = event.outputFormat || 'powerpoint';
  let output: Buffer;
  let slideCount: number | undefined;
  let pageCount: number | undefined;

  switch (format) {
    case 'powerpoint':
      const pptxResult = generatePowerPoint(event.transformedData, event.templateId);
      output = pptxResult.buffer;
      slideCount = pptxResult.slideCount;
      break;
    case 'json':
      output = Buffer.from(JSON.stringify(event.transformedData, null, 2));
      break;
    default:
      output = Buffer.from(JSON.stringify(event.transformedData, null, 2));
  }

  // Upload to S3
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = format === 'powerpoint' ? 'pptx' : format;
  const s3Key = `${event.tenantId}/assessments/${event.assessmentId}/output-${timestamp}.${extension}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: OUTPUT_BUCKET,
    Key: s3Key,
    Body: output,
    ContentType: getContentType(format),
    Metadata: {
      tenantId: event.tenantId,
      assessmentId: event.assessmentId,
      correlationId: event.correlationId
    }
  }));

  const duration = Date.now() - startTime;

  console.log('Output generation completed', {
    s3Key,
    fileSize: output.length,
    slideCount,
    duration
  });

  return {
    success: true,
    output: {
      format,
      s3Key,
      s3Url: `s3://${OUTPUT_BUCKET}/${s3Key}`,
      fileSize: output.length,
      slideCount,
      pageCount
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      assessmentId: event.assessmentId,
      tenantId: event.tenantId,
      duration
    }
  };
}

function generatePowerPoint(
  data: TransformedData,
  templateId?: string
): { buffer: Buffer; slideCount: number } {
  // In production, use pptxgenjs or similar library
  // For now, generate a JSON representation that can be converted
  const slides = [];

  // Title slide
  slides.push({
    type: 'title',
    title: 'Assessment Report',
    subtitle: `Generated: ${new Date().toISOString()}`,
    template: templateId
  });

  // Statistics slide
  slides.push({
    type: 'statistics',
    title: 'Summary Statistics',
    content: {
      totalElements: data.statistics.totalElements,
      totalArea: `${data.statistics.totalArea} m²`,
      totalVolume: `${data.statistics.totalVolume} m³`,
      categoryCount: data.statistics.categoryCount,
      familyCount: data.statistics.familyCount
    }
  });

  // Chart slides
  for (const chart of data.charts) {
    slides.push({
      type: 'chart',
      title: chart.title,
      chartType: chart.type,
      data: chart.data
    });
  }

  // Category detail slides
  for (const category of data.categories) {
    slides.push({
      type: 'category',
      title: category.name,
      content: {
        count: category.count,
        totalArea: `${category.totalArea} m²`,
        totalVolume: `${category.totalVolume} m³`,
        families: category.families.map(f => ({
          name: f.name,
          count: f.count,
          types: f.types
        }))
      }
    });
  }

  // Table slides
  for (const table of data.tables) {
    slides.push({
      type: 'table',
      title: table.title,
      headers: table.headers,
      rows: table.rows
    });
  }

  // Closing slide
  slides.push({
    type: 'closing',
    title: 'Thank You',
    content: 'Report generated by MCP Integration System'
  });

  const pptxJson = JSON.stringify({
    version: '1.0',
    slides,
    metadata: {
      generated: new Date().toISOString(),
      generator: 'MCP Integration System'
    }
  }, null, 2);

  return {
    buffer: Buffer.from(pptxJson),
    slideCount: slides.length
  };
}

function getContentType(format: string): string {
  switch (format) {
    case 'powerpoint':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'pdf':
      return 'application/pdf';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}
