/**
 * Data Transformer for multi-application data conversion
 * Handles conversion between NonicaTab MCP responses and various output formats
 */

import { 
  TransformationRule, 
  DataTransformer as IDataTransformer,
  RevitElement,
  ElementParameter,
  GeometryData,
  FamilyData,
  PresentationData,
  SlideData,
  BoundingBox,
  Point3D,
  ChartData,
  ReportData
} from './types.js';

/**
 * Core data transformer implementation for MCP integration system
 */
export class DataTransformer implements IDataTransformer {
  private transformationRules: Map<string, TransformationRule> = new Map();
  private transformationFunctions: Map<string, Function> = new Map();

  constructor() {
    this.initializeDefaultTransformations();
  }

  /**
   * Register a new transformation rule
   */
  registerTransformation(rule: TransformationRule): void {
    const key = `${rule.sourceFormat}->${rule.targetFormat}`;
    this.transformationRules.set(key, rule);
    
    // Register the transformation function
    this.transformationFunctions.set(rule.transformFunction, this.getTransformFunction(rule.transformFunction));
  }

  /**
   * Transform data from source format to target format
   */
  async transform(data: any, sourceFormat: string, targetFormat: string): Promise<any> {
    const key = `${sourceFormat}->${targetFormat}`;
    const rule = this.transformationRules.get(key);
    
    if (!rule) {
      throw new Error(`No transformation rule found for ${sourceFormat} -> ${targetFormat}`);
    }

    const transformFunction = this.transformationFunctions.get(rule.transformFunction);
    if (!transformFunction) {
      throw new Error(`Transformation function ${rule.transformFunction} not found`);
    }

    try {
      const result = await transformFunction(data);
      
      if (rule.validation.required) {
        const isValid = this.validateTransformation(data, result, rule);
        if (!isValid) {
          throw new Error(`Transformation validation failed for ${sourceFormat} -> ${targetFormat}`);
        }
      }
      
      return result;
    } catch (error) {
      throw new Error(`Transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate transformation result against source data
   */
  validateTransformation(source: any, target: any, rule: TransformationRule): boolean {
    try {
      // Basic validation - ensure target is not null/undefined
      if (target === null || target === undefined) {
        return false;
      }

      // Schema validation if provided
      if (rule.validation.schema) {
        return this.validateAgainstSchema(target, rule.validation.schema);
      }

      // Format-specific validation
      return this.performFormatSpecificValidation(source, target, rule);
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  }

  /**
   * Get available transformations for a source format
   */
  getAvailableTransformations(sourceFormat: string): string[] {
    const availableTargets: string[] = [];
    
    for (const [key, rule] of this.transformationRules) {
      if (rule.sourceFormat === sourceFormat) {
        availableTargets.push(rule.targetFormat);
      }
    }
    
    return availableTargets;
  }

  /**
   * Initialize default transformation rules
   */
  private initializeDefaultTransformations(): void {
    // NonicaTab MCP response to PowerPoint table
    this.registerTransformation({
      id: 'nonicatab-to-powerpoint-table',
      sourceFormat: 'nonicatab_response',
      targetFormat: 'powerpoint_table',
      transformFunction: 'transformNonicaTabToPowerPointTable',
      validation: {
        required: true,
        schema: {
          type: 'object',
          properties: {
            headers: { type: 'array' },
            rows: { type: 'array' },
            title: { type: 'string' }
          },
          required: ['headers', 'rows']
        }
      }
    });

    // Revit element to chart data
    this.registerTransformation({
      id: 'revit-element-to-chart',
      sourceFormat: 'revit_element',
      targetFormat: 'chart_data',
      transformFunction: 'transformRevitElementToChart',
      validation: {
        required: true,
        schema: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            data: { type: 'object' },
            options: { type: 'object' }
          },
          required: ['type', 'data']
        }
      }
    });

    // Geometry data to visual diagram
    this.registerTransformation({
      id: 'geometry-to-diagram',
      sourceFormat: 'geometry_data',
      targetFormat: 'visual_diagram',
      transformFunction: 'transformGeometryToDiagram',
      validation: {
        required: true
      }
    });

    // Family data to structured schedule
    this.registerTransformation({
      id: 'family-to-schedule',
      sourceFormat: 'family_data',
      targetFormat: 'structured_schedule',
      transformFunction: 'transformFamilyToSchedule',
      validation: {
        required: true
      }
    });

    // NonicaTab response to presentation data
    this.registerTransformation({
      id: 'nonicatab-to-presentation',
      sourceFormat: 'nonicatab_response',
      targetFormat: 'presentation_data',
      transformFunction: 'transformNonicaTabToPresentation',
      validation: {
        required: true
      }
    });

    // NonicaTab response to chart data
    this.registerTransformation({
      id: 'nonicatab-to-chart',
      sourceFormat: 'nonicatab_response',
      targetFormat: 'chart_data',
      transformFunction: 'transformNonicaTabToChart',
      validation: {
        required: true
      }
    });

    // Revit element to PowerPoint table
    this.registerTransformation({
      id: 'revit-element-to-table',
      sourceFormat: 'revit_element',
      targetFormat: 'powerpoint_table',
      transformFunction: 'transformRevitElementToTable',
      validation: {
        required: true
      }
    });
  }

  /**
   * Get transformation function by name
   */
  private getTransformFunction(functionName: string): Function {
    const functions: Record<string, Function> = {
      transformNonicaTabToPowerPointTable: this.transformNonicaTabToPowerPointTable.bind(this),
      transformRevitElementToChart: this.transformRevitElementToChart.bind(this),
      transformGeometryToDiagram: this.transformGeometryToDiagram.bind(this),
      transformFamilyToSchedule: this.transformFamilyToSchedule.bind(this),
      transformNonicaTabToPresentation: this.transformNonicaTabToPresentation.bind(this),
      transformNonicaTabToChart: this.transformNonicaTabToChart.bind(this),
      transformRevitElementToTable: this.transformRevitElementToTable.bind(this)
    };

    return functions[functionName] || (() => { throw new Error(`Unknown function: ${functionName}`); });
  }

  /**
   * Transform NonicaTab MCP response to PowerPoint table format
   */
  private async transformNonicaTabToPowerPointTable(data: any): Promise<any> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid NonicaTab response data');
    }

    // Handle different NonicaTab response formats
    if (Array.isArray(data)) {
      return this.transformArrayToTable(data);
    }

    if (data.elements && Array.isArray(data.elements)) {
      return this.transformElementsToTable(data.elements);
    }

    if (data.parameters && Array.isArray(data.parameters)) {
      return this.transformParametersToTable(data.parameters);
    }

    // Generic object transformation
    return this.transformObjectToTable(data);
  }

  /**
   * Transform Revit element to PowerPoint table format
   */
  private async transformRevitElementToTable(element: RevitElement): Promise<any> {
    const headers = ['Property', 'Value'];
    const rows: string[][] = [];

    // Basic element properties
    rows.push(['Element ID', element.elementId || 'N/A']);
    rows.push(['Category', element.category || 'Unknown']);
    rows.push(['Family Name', element.familyName || 'Unknown']);
    rows.push(['Type Name', element.typeName || 'Unknown']);

    // Parameters
    if (element.parameters && Object.keys(element.parameters).length > 0) {
      rows.push(['--- Parameters ---', '']);
      for (const [paramName, paramValue] of Object.entries(element.parameters)) {
        rows.push([paramName, paramValue?.toString() || 'N/A']);
      }
    }

    // Geometry information
    if (element.geometry) {
      rows.push(['--- Geometry ---', '']);
      if (element.geometry.location) {
        const loc = element.geometry.location;
        rows.push(['Location X', loc.x?.toString() || '0']);
        rows.push(['Location Y', loc.y?.toString() || '0']);
        rows.push(['Location Z', loc.z?.toString() || '0']);
      }
      if (element.geometry.boundingBox) {
        const bbox = element.geometry.boundingBox;
        rows.push(['Bounding Box Min', `(${bbox.min.x}, ${bbox.min.y}, ${bbox.min.z})`]);
        rows.push(['Bounding Box Max', `(${bbox.max.x}, ${bbox.max.y}, ${bbox.max.z})`]);
      }
    }

    // Additional properties
    if (element.additionalProperties && Object.keys(element.additionalProperties).length > 0) {
      rows.push(['--- Additional Properties ---', '']);
      for (const [propName, propValue] of Object.entries(element.additionalProperties)) {
        rows.push([propName, propValue?.toString() || 'N/A']);
      }
    }

    return {
      headers,
      rows,
      title: `${element.familyName || 'Element'} - ${element.typeName || 'Properties'}`
    };
  }

  /**
   * Transform Revit element data to chart format
   */
  private async transformRevitElementToChart(element: RevitElement): Promise<ChartData> {
    const chartData: ChartData = {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: `${element.category} Parameters`,
          data: [],
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `${element.familyName} - ${element.typeName}`
          }
        }
      }
    };

    // Extract numeric parameters for chart
    for (const [paramName, paramValue] of Object.entries(element.parameters)) {
      if (typeof paramValue === 'number') {
        chartData.data.labels!.push(paramName);
        chartData.data.datasets![0].data.push(paramValue);
      }
    }

    return chartData;
  }



  /**
   * Transform geometry data to visual diagram format
   */
  private async transformGeometryToDiagram(geometry: GeometryData): Promise<any> {
    return {
      type: 'spatial_diagram',
      elements: geometry.elements?.map(element => ({
        id: element.elementId,
        position: element.geometry.location,
        bounds: element.geometry.boundingBox,
        category: element.category,
        displayName: `${element.familyName} - ${element.typeName}`
      })) || [],
      viewport: this.calculateViewport(geometry),
      metadata: {
        totalElements: geometry.elements?.length || 0,
        boundingBox: this.calculateOverallBounds(geometry)
      }
    };
  }

  /**
   * Transform family data to structured schedule format
   */
  private async transformFamilyToSchedule(familyData: FamilyData): Promise<any> {
    // Group families by name to handle duplicates
    const familyMap = new Map<string, {
      name: string;
      types: Set<string>;
      instanceCount: number;
      category: string;
    }>();

    familyData.families?.forEach(family => {
      const name = family.name || 'Unknown';
      const existing = familyMap.get(name);
      
      if (existing) {
        // Merge with existing family
        family.types?.forEach(type => existing.types.add(type));
        existing.instanceCount += family.instanceCount || 0;
        // Keep the first non-unknown category
        if (existing.category === 'Unknown' && family.category) {
          existing.category = family.category;
        }
      } else {
        // Create new family entry
        familyMap.set(name, {
          name,
          types: new Set(family.types || []),
          instanceCount: family.instanceCount || 0,
          category: family.category || 'Unknown'
        });
      }
    });

    // Convert to rows
    const rows = Array.from(familyMap.values()).map(family => [
      family.name,
      Array.from(family.types).join(', ') || 'N/A',
      family.instanceCount.toString(),
      family.category
    ]);

    return {
      title: 'Family Schedule',
      headers: ['Family Name', 'Type Name', 'Count', 'Category'],
      rows,
      summary: {
        totalFamilies: familyMap.size,
        totalTypes: Array.from(familyMap.values()).reduce((sum, f) => sum + f.types.size, 0),
        totalInstances: Array.from(familyMap.values()).reduce((sum, f) => sum + f.instanceCount, 0)
      }
    };
  }

  /**
   * Transform NonicaTab response to chart data
   */
  private async transformNonicaTabToChart(data: any): Promise<ChartData> {
    // Handle different NonicaTab response formats
    let elements: any[] = [];
    
    if (Array.isArray(data)) {
      elements = data;
    } else if (data.elements && Array.isArray(data.elements)) {
      elements = data.elements;
    } else {
      // Return a simple chart for non-element data
      return {
        type: 'bar',
        data: {
          labels: ['Data Points'],
          datasets: [{
            label: 'NonicaTab Response',
            data: [1],
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }]
        }
      };
    }

    // Generate chart from elements
    return await this.generateChartFromElements(elements);
  }

  /**
   * Transform NonicaTab response to complete presentation data
   */
  private async transformNonicaTabToPresentation(data: any): Promise<PresentationData> {
    const slides: SlideData[] = [];

    // Title slide
    slides.push({
      id: 'title-slide',
      type: 'title',
      title: 'Revit Assessment Report',
      content: {
        subtitle: 'Generated from NonicaTab MCP Analysis',
        date: new Date().toLocaleDateString()
      },
      layout: 'title_layout'
    });

    // Data overview slide
    if (data.elements && Array.isArray(data.elements)) {
      slides.push({
        id: 'overview-slide',
        type: 'content',
        title: 'Model Overview',
        content: {
          elementCount: data.elements.length,
          categories: this.extractCategories(data.elements),
          summary: this.generateElementSummary(data.elements)
        },
        layout: 'content_layout'
      });
    }

    // Chart slide for numeric data
    if (data.elements && data.elements.length > 0) {
      const chartData = await this.generateChartFromElements(data.elements);
      slides.push({
        id: 'chart-slide',
        type: 'chart',
        title: 'Element Analysis',
        content: chartData,
        layout: 'chart_layout'
      });
    }

    return {
      id: `presentation-${Date.now()}`,
      slides,
      template: 'assessment_template',
      metadata: {
        title: 'Revit Assessment Report',
        author: 'MCP Integration System',
        createdDate: new Date(),
        assessmentType: 'automated_analysis'
      }
    };
  }

  /**
   * Helper methods for data transformation
   */
  private transformArrayToTable(data: any[]): any {
    if (data.length === 0) {
      return { headers: [], rows: [], title: 'Empty Data' };
    }

    const firstItem = data[0];
    const headers = Object.keys(firstItem);
    const rows = data.map(item => headers.map(header => item[header] || ''));

    return {
      headers,
      rows,
      title: 'NonicaTab Data Table'
    };
  }

  private transformElementsToTable(elements: any[]): any {
    const headers = ['Element ID', 'Category', 'Family', 'Type', 'Parameters'];
    const rows = elements.map(element => [
      element.elementId || element.id || 'N/A',
      element.category || 'Unknown',
      element.familyName || element.family || 'Unknown',
      element.typeName || element.type || 'Unknown',
      Object.keys(element.parameters || {}).length.toString()
    ]);

    return {
      headers,
      rows,
      title: 'Revit Elements'
    };
  }

  private transformParametersToTable(parameters: any[]): any {
    const headers = ['Parameter Name', 'Value', 'Type', 'Group'];
    const rows = parameters.map(param => [
      param.name || param.parameterName || 'Unknown',
      param.value?.toString() || 'N/A',
      param.type || 'Unknown',
      param.group || 'General'
    ]);

    return {
      headers,
      rows,
      title: 'Element Parameters'
    };
  }

  private transformObjectToTable(data: any): any {
    const headers = ['Property', 'Value'];
    const rows = Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'object' ? JSON.stringify(value) : value?.toString() || 'N/A'
    ]);

    return {
      headers,
      rows,
      title: 'Data Properties'
    };
  }

  private calculateViewport(geometry: GeometryData): any {
    if (!geometry.elements || geometry.elements.length === 0) {
      return { center: { x: 0, y: 0, z: 0 }, scale: 1 };
    }

    const bounds = this.calculateOverallBounds(geometry);
    const center = {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2
    };

    const size = Math.max(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z
    );

    return {
      center,
      scale: size > 0 ? 100 / size : 1
    };
  }

  private calculateOverallBounds(geometry: GeometryData): BoundingBox {
    if (!geometry.elements || geometry.elements.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      };
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const element of geometry.elements) {
      const bounds = element.geometry.boundingBox;
      
      // Handle NaN values by skipping invalid bounds
      if (isNaN(bounds.min.x) || isNaN(bounds.min.y) || isNaN(bounds.min.z) ||
          isNaN(bounds.max.x) || isNaN(bounds.max.y) || isNaN(bounds.max.z)) {
        continue;
      }
      
      minX = Math.min(minX, bounds.min.x);
      minY = Math.min(minY, bounds.min.y);
      minZ = Math.min(minZ, bounds.min.z);
      maxX = Math.max(maxX, bounds.max.x);
      maxY = Math.max(maxY, bounds.max.y);
      maxZ = Math.max(maxZ, bounds.max.z);
    }

    // If all bounds were invalid, return default
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(minZ) ||
        !isFinite(maxX) || !isFinite(maxY) || !isFinite(maxZ)) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      };
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  private extractCategories(elements: any[]): string[] {
    const categories = new Set<string>();
    elements.forEach(element => {
      if (element.category) {
        categories.add(element.category);
      }
    });
    return Array.from(categories);
  }

  private generateElementSummary(elements: any[]): any {
    const categoryCount: Record<string, number> = {};
    const familyCount: Record<string, number> = {};

    elements.forEach(element => {
      const category = element.category || 'Unknown';
      const family = element.familyName || element.family || 'Unknown';
      
      categoryCount[category] = (categoryCount[category] || 0) + 1;
      familyCount[family] = (familyCount[family] || 0) + 1;
    });

    return {
      totalElements: elements.length,
      categoriesCount: Object.keys(categoryCount).length,
      familiesCount: Object.keys(familyCount).length,
      topCategories: Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category, count]) => ({ category, count })),
      topFamilies: Object.entries(familyCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([family, count]) => ({ family, count }))
    };
  }

  private async generateChartFromElements(elements: any[]): Promise<ChartData> {
    const categoryCount: Record<string, number> = {};
    
    elements.forEach(element => {
      const category = element.category || 'Unknown';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    return {
      type: 'pie',
      data: {
        labels: Object.keys(categoryCount),
        datasets: [{
          data: Object.values(categoryCount),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Elements by Category'
          },
          legend: {
            position: 'right'
          }
        }
      }
    };
  }

  private createEmptyChart(): ChartData {
    return {
      type: 'bar',
      data: {
        labels: ['No Data'],
        datasets: [{
          label: 'Empty Dataset',
          data: [0],
          backgroundColor: '#E0E0E0'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'No Data Available'
          }
        }
      }
    };
  }

  private createChartFromArray(elements: any[]): ChartData {
    if (elements.length === 0) {
      return this.createEmptyChart();
    }

    const categoryCount: Record<string, number> = {};
    
    elements.forEach(element => {
      const category = element.category || element.type || 'Unknown';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    return {
      type: 'pie',
      data: {
        labels: Object.keys(categoryCount),
        datasets: [{
          data: Object.values(categoryCount),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Data Distribution'
          },
          legend: {
            position: 'right'
          }
        }
      }
    };
  }

  private createChartFromParameters(parameters: any[]): ChartData {
    if (parameters.length === 0) {
      return this.createEmptyChart();
    }

    const numericParams = parameters.filter(p => typeof p.value === 'number');
    
    if (numericParams.length === 0) {
      return this.createEmptyChart();
    }

    return {
      type: 'bar',
      data: {
        labels: numericParams.map(p => p.name || p.parameterName || 'Parameter'),
        datasets: [{
          label: 'Parameter Values',
          data: numericParams.map(p => p.value),
          backgroundColor: '#36A2EB'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Parameter Values'
          }
        }
      }
    };
  }

  private validateAgainstSchema(data: any, schema: any): boolean {
    // Basic schema validation implementation
    if (schema.type === 'object' && typeof data !== 'object') {
      return false;
    }

    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (schema.required?.includes(prop) && !(prop in data)) {
          return false;
        }
        
        if (prop in data) {
          const propType = (propSchema as any).type;
          if (propType === 'array' && !Array.isArray(data[prop])) {
            return false;
          }
          if (propType === 'string' && typeof data[prop] !== 'string') {
            return false;
          }
          if (propType === 'number' && typeof data[prop] !== 'number') {
            return false;
          }
        }
      }
    }

    return true;
  }

  private performFormatSpecificValidation(source: any, target: any, rule: TransformationRule): boolean {
    // Format-specific validation logic
    switch (rule.targetFormat) {
      case 'powerpoint_table':
        return target.headers && Array.isArray(target.headers) && 
               target.rows && Array.isArray(target.rows);
      
      case 'chart_data':
        return target.type && target.data && 
               target.data.labels && Array.isArray(target.data.labels) &&
               target.data.datasets && Array.isArray(target.data.datasets);
      
      case 'presentation_data':
        return target.slides && Array.isArray(target.slides) && 
               target.metadata && target.template;
      
      default:
        return true; // Default to valid for unknown formats
    }
  }
}