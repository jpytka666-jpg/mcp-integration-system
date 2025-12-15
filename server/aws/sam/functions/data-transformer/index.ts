/**
 * Data Transformer Lambda
 * Transforms extracted Revit data into presentation-ready format
 */

import { Context } from 'aws-lambda';

interface DataTransformerEvent {
  tenantId: string;
  assessmentId: string;
  correlationId: string;
  extractedData: {
    elements: ExtractedElement[];
    metadata: Record<string, unknown>;
  };
  transformOptions?: {
    groupBy?: string;
    sortBy?: string;
    filterEmpty?: boolean;
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

interface TransformResult {
  success: boolean;
  data: TransformedData;
  metadata: {
    transformedAt: string;
    inputElementCount: number;
    outputCategoryCount: number;
    duration: number;
  };
}

export async function handler(
  event: DataTransformerEvent,
  context: Context
): Promise<TransformResult> {
  const startTime = Date.now();

  console.log('Data transformation started', {
    requestId: context.awsRequestId,
    assessmentId: event.assessmentId,
    tenantId: event.tenantId,
    correlationId: event.correlationId,
    elementCount: event.extractedData.elements.length
  });

  const elements = event.extractedData.elements;
  const options = event.transformOptions || {};

  // Group elements by category
  const categoryGroups = groupByCategory(elements);

  // Build category summaries
  const categories = buildCategorySummaries(categoryGroups, options);

  // Calculate statistics
  const statistics = calculateStatistics(categories);

  // Generate chart data
  const charts = generateCharts(categories);

  // Generate tables
  const tables = generateTables(categories, options);

  const duration = Date.now() - startTime;

  console.log('Data transformation completed', {
    categoryCount: categories.length,
    chartCount: charts.length,
    tableCount: tables.length,
    duration
  });

  return {
    success: true,
    data: {
      categories,
      statistics,
      charts,
      tables
    },
    metadata: {
      transformedAt: new Date().toISOString(),
      inputElementCount: elements.length,
      outputCategoryCount: categories.length,
      duration
    }
  };
}

function groupByCategory(elements: ExtractedElement[]): Map<string, ExtractedElement[]> {
  const groups = new Map<string, ExtractedElement[]>();

  for (const element of elements) {
    const category = element.category;
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(element);
  }

  return groups;
}

function buildCategorySummaries(
  groups: Map<string, ExtractedElement[]>,
  options: DataTransformerEvent['transformOptions']
): CategorySummary[] {
  const summaries: CategorySummary[] = [];

  for (const [category, elements] of groups) {
    if (options?.filterEmpty && elements.length === 0) {
      continue;
    }

    // Group by family within category
    const familyGroups = new Map<string, ExtractedElement[]>();
    for (const element of elements) {
      if (!familyGroups.has(element.family)) {
        familyGroups.set(element.family, []);
      }
      familyGroups.get(element.family)!.push(element);
    }

    const families: FamilySummary[] = [];
    for (const [family, familyElements] of familyGroups) {
      const types = [...new Set(familyElements.map(e => e.type))];
      families.push({
        name: family,
        count: familyElements.length,
        types
      });
    }

    // Calculate totals
    let totalArea = 0;
    let totalVolume = 0;
    for (const element of elements) {
      if (element.geometry) {
        totalArea += element.geometry.area || 0;
        totalVolume += element.geometry.volume || 0;
      }
      if (element.parameters.Area) {
        totalArea += element.parameters.Area as number;
      }
    }

    summaries.push({
      name: category,
      count: elements.length,
      totalArea: Math.round(totalArea * 100) / 100,
      totalVolume: Math.round(totalVolume * 100) / 100,
      families
    });
  }

  // Sort by specified field
  if (options?.sortBy === 'count') {
    summaries.sort((a, b) => b.count - a.count);
  } else if (options?.sortBy === 'area') {
    summaries.sort((a, b) => b.totalArea - a.totalArea);
  } else if (options?.sortBy === 'name') {
    summaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  return summaries;
}

function calculateStatistics(categories: CategorySummary[]): Statistics {
  let totalElements = 0;
  let totalArea = 0;
  let totalVolume = 0;
  let familyCount = 0;

  for (const category of categories) {
    totalElements += category.count;
    totalArea += category.totalArea;
    totalVolume += category.totalVolume;
    familyCount += category.families.length;
  }

  return {
    totalElements,
    totalArea: Math.round(totalArea * 100) / 100,
    totalVolume: Math.round(totalVolume * 100) / 100,
    categoryCount: categories.length,
    familyCount
  };
}

function generateCharts(categories: CategorySummary[]): ChartData[] {
  const charts: ChartData[] = [];

  // Element distribution pie chart
  charts.push({
    type: 'pie',
    title: 'Element Distribution by Category',
    data: categories.map(c => ({ label: c.name, value: c.count }))
  });

  // Area distribution bar chart
  charts.push({
    type: 'bar',
    title: 'Total Area by Category',
    data: categories
      .filter(c => c.totalArea > 0)
      .map(c => ({ label: c.name, value: c.totalArea }))
  });

  // Family count bar chart
  charts.push({
    type: 'bar',
    title: 'Family Count by Category',
    data: categories.map(c => ({ label: c.name, value: c.families.length }))
  });

  return charts;
}

function generateTables(
  categories: CategorySummary[],
  options: DataTransformerEvent['transformOptions']
): TableData[] {
  const tables: TableData[] = [];

  // Summary table
  tables.push({
    title: 'Category Summary',
    headers: ['Category', 'Count', 'Families', 'Total Area', 'Total Volume'],
    rows: categories.map(c => [
      c.name,
      c.count,
      c.families.length,
      c.totalArea,
      c.totalVolume
    ])
  });

  // Family details table
  const familyRows: (string | number)[][] = [];
  for (const category of categories) {
    for (const family of category.families) {
      familyRows.push([
        category.name,
        family.name,
        family.count,
        family.types.length,
        family.types.join(', ')
      ]);
    }
  }

  tables.push({
    title: 'Family Details',
    headers: ['Category', 'Family', 'Count', 'Type Count', 'Types'],
    rows: familyRows
  });

  return tables;
}
