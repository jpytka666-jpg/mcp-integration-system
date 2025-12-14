/**
 * NonicaTab MCP Tool Integration Layer
 * Provides wrappers for all 37 FREE NonicaTab tools for Revit data extraction
 */

import { 
  NonicaTabTool,
  NONICATAB_TOOLS,
  RevitElement,
  ElementParameter,
  GeometryData,
  FamilyData,
  BoundingBox,
  Point3D
} from './types.js';

export interface NonicaTabToolResult {
  success: boolean;
  data?: any;
  error?: string;
  toolName: string;
  executionTime: number;
  metadata: {
    revitVersion?: string;
    modelPath?: string;
    timestamp: Date;
  };
}

export interface NonicaTabIntegration {
  // Data extraction tools
  getActiveViewInRevit(): Promise<NonicaTabToolResult>;
  getUserSelectionInRevit(): Promise<NonicaTabToolResult>;
  getElementsByCategory(categories: string[]): Promise<NonicaTabToolResult>;
  
  // Model data processing tools
  getParametersFromElementId(elementId: string): Promise<NonicaTabToolResult>;
  getAllAdditionalPropertiesFromElementId(elementId: string): Promise<NonicaTabToolResult>;
  
  // Geometry analysis tools
  getBoundingBoxesForElementIds(elementIds: string[]): Promise<NonicaTabToolResult>;
  getLocationForElementIds(elementIds: string[]): Promise<NonicaTabToolResult>;
  
  // Family and type analysis tools
  getAllUsedFamiliesInModel(): Promise<NonicaTabToolResult>;
  getAllUsedTypesOfFamilies(): Promise<NonicaTabToolResult>;
  
  // Generic tool execution
  executeTool(toolName: NonicaTabTool, parameters?: Record<string, any>): Promise<NonicaTabToolResult>;
  
  // Utility methods
  validateConnection(): Promise<boolean>;
  getAvailableTools(): Promise<NonicaTabTool[]>;
  getToolCapabilities(toolName: NonicaTabTool): Promise<string[]>;
}

export class NonicaTabMCPIntegration implements NonicaTabIntegration {
  private mcpClient: any; // MCP client connection
  private connectionTimeout: number = 15000; // 15 seconds as specified
  private isConnected: boolean = false;

  constructor(mcpClient?: any) {
    this.mcpClient = mcpClient || this.createMockClient();
  }

  /**
   * Get active view in Revit
   */
  async getActiveViewInRevit(): Promise<NonicaTabToolResult> {
    return this.executeTool('get_active_view_in_revit');
  }

  /**
   * Get user selection in Revit
   */
  async getUserSelectionInRevit(): Promise<NonicaTabToolResult> {
    return this.executeTool('get_user_selection_in_revit');
  }

  /**
   * Get elements by category
   */
  async getElementsByCategory(categories: string[]): Promise<NonicaTabToolResult> {
    return this.executeTool('get_elements_by_category', { categories });
  }

  /**
   * Get parameters from element ID
   */
  async getParametersFromElementId(elementId: string): Promise<NonicaTabToolResult> {
    return this.executeTool('get_parameters_from_elementid', { elementId });
  }

  /**
   * Get all additional properties from element ID
   */
  async getAllAdditionalPropertiesFromElementId(elementId: string): Promise<NonicaTabToolResult> {
    return this.executeTool('get_all_additional_properties_from_elementid', { elementId });
  }

  /**
   * Get bounding boxes for element IDs
   */
  async getBoundingBoxesForElementIds(elementIds: string[]): Promise<NonicaTabToolResult> {
    return this.executeTool('get_boundingboxes_for_element_ids', { elementIds });
  }

  /**
   * Get location for element IDs
   */
  async getLocationForElementIds(elementIds: string[]): Promise<NonicaTabToolResult> {
    return this.executeTool('get_location_for_element_ids', { elementIds });
  }

  /**
   * Get all used families in model
   */
  async getAllUsedFamiliesInModel(): Promise<NonicaTabToolResult> {
    return this.executeTool('get_all_used_families_in_model');
  }

  /**
   * Get all used types of families
   */
  async getAllUsedTypesOfFamilies(): Promise<NonicaTabToolResult> {
    return this.executeTool('get_all_used_types_of_families');
  }

  /**
   * Execute any NonicaTab tool with parameters
   */
  async executeTool(toolName: NonicaTabTool, parameters?: Record<string, any>): Promise<NonicaTabToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate tool name
      if (!NONICATAB_TOOLS.includes(toolName)) {
        throw new Error(`Unknown NonicaTab tool: ${toolName}`);
      }

      // Check connection
      if (!await this.validateConnection()) {
        throw new Error('NonicaTab MCP server not connected');
      }

      // Execute the tool via MCP
      const result = await this.mcpClient.callTool(toolName, parameters || {});
      
      return {
        success: true,
        data: this.processToolResult(toolName, result),
        toolName,
        executionTime: Date.now() - startTime,
        metadata: {
          revitVersion: result.metadata?.revitVersion || 'Unknown',
          modelPath: result.metadata?.modelPath || 'Unknown',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName,
        executionTime: Date.now() - startTime,
        metadata: {
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Validate connection to NonicaTab MCP server
   */
  async validateConnection(): Promise<boolean> {
    try {
      if (this.isConnected) {
        return true;
      }

      // Test connection with a simple tool call
      const result = await Promise.race([
        this.mcpClient.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
        )
      ]);

      this.isConnected = !!result;
      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get available tools
   */
  async getAvailableTools(): Promise<NonicaTabTool[]> {
    try {
      const serverInfo = await this.mcpClient.getServerInfo();
      const availableTools = serverInfo.tools || [];
      
      // Filter to only include known NonicaTab tools
      return NONICATAB_TOOLS.filter(tool => 
        availableTools.some((t: any) => t.name === tool)
      );
    } catch (error) {
      // Return all known tools as fallback
      return [...NONICATAB_TOOLS];
    }
  }

  /**
   * Get tool capabilities
   */
  async getToolCapabilities(toolName: NonicaTabTool): Promise<string[]> {
    try {
      const toolInfo = await this.mcpClient.getToolInfo(toolName);
      return toolInfo.capabilities || this.getDefaultCapabilities(toolName);
    } catch (error) {
      return this.getDefaultCapabilities(toolName);
    }
  }

  /**
   * Process tool result based on tool type
   */
  private processToolResult(toolName: NonicaTabTool, rawResult: any): any {
    switch (toolName) {
      case 'get_active_view_in_revit':
        return this.processViewResult(rawResult);
      
      case 'get_user_selection_in_revit':
      case 'get_elements_by_category':
        return this.processElementsResult(rawResult);
      
      case 'get_parameters_from_elementid':
      case 'get_all_additional_properties_from_elementid':
        return this.processParametersResult(rawResult);
      
      case 'get_boundingboxes_for_element_ids':
        return this.processBoundingBoxResult(rawResult);
      
      case 'get_location_for_element_ids':
        return this.processLocationResult(rawResult);
      
      case 'get_all_used_families_in_model':
      case 'get_all_used_types_of_families':
        return this.processFamilyResult(rawResult);
      
      default:
        return rawResult;
    }
  }

  /**
   * Process view result
   */
  private processViewResult(result: any): any {
    return {
      viewId: result.viewId || result.id,
      viewName: result.viewName || result.name || 'Unknown View',
      viewType: result.viewType || 'Unknown',
      scale: result.scale || 1,
      cropBox: result.cropBox ? this.processBoundingBox(result.cropBox) : null,
      elements: result.elements ? result.elements.map((e: any) => this.processElement(e)) : []
    };
  }

  /**
   * Process elements result
   */
  private processElementsResult(result: any): RevitElement[] {
    if (!result || !Array.isArray(result.elements)) {
      return [];
    }

    return result.elements.map((element: any) => this.processElement(element));
  }

  /**
   * Process single element
   */
  private processElement(element: any): RevitElement {
    return {
      elementId: element.elementId || element.id || 'unknown',
      category: element.category || 'Unknown',
      familyName: element.familyName || element.family || 'Unknown',
      typeName: element.typeName || element.type || 'Unknown',
      parameters: element.parameters || {},
      geometry: {
        boundingBox: element.geometry?.boundingBox ? 
          this.processBoundingBox(element.geometry.boundingBox) : 
          { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
        location: element.geometry?.location ? 
          this.processPoint3D(element.geometry.location) : 
          { x: 0, y: 0, z: 0 }
      },
      additionalProperties: element.additionalProperties || {}
    };
  }

  /**
   * Process parameters result
   */
  private processParametersResult(result: any): ElementParameter[] {
    if (!result || !Array.isArray(result.parameters)) {
      return [];
    }

    return result.parameters.map((param: any) => ({
      elementId: param.elementId || 'unknown',
      parameterName: param.parameterName || param.name || 'Unknown',
      value: param.value,
      type: this.inferParameterType(param.value),
      isReadOnly: param.isReadOnly || false,
      group: param.group || 'General'
    }));
  }

  /**
   * Process bounding box result
   */
  private processBoundingBoxResult(result: any): Array<{ elementId: string; boundingBox: BoundingBox }> {
    if (!result || !Array.isArray(result.boundingBoxes)) {
      return [];
    }

    return result.boundingBoxes.map((item: any) => ({
      elementId: item.elementId || 'unknown',
      boundingBox: this.processBoundingBox(item.boundingBox)
    }));
  }

  /**
   * Process location result
   */
  private processLocationResult(result: any): Array<{ elementId: string; location: Point3D }> {
    if (!result || !Array.isArray(result.locations)) {
      return [];
    }

    return result.locations.map((item: any) => ({
      elementId: item.elementId || 'unknown',
      location: this.processPoint3D(item.location)
    }));
  }

  /**
   * Process family result
   */
  private processFamilyResult(result: any): FamilyData {
    if (!result || !Array.isArray(result.families)) {
      return { families: [] };
    }

    return {
      families: result.families.map((family: any) => ({
        name: family.name || 'Unknown',
        category: family.category || 'Unknown',
        types: Array.isArray(family.types) ? family.types : [],
        parameters: Array.isArray(family.parameters) ? family.parameters : [],
        instanceCount: family.instanceCount || 0
      }))
    };
  }

  /**
   * Process bounding box
   */
  private processBoundingBox(bbox: any): BoundingBox {
    return {
      min: this.processPoint3D(bbox.min || { x: 0, y: 0, z: 0 }),
      max: this.processPoint3D(bbox.max || { x: 0, y: 0, z: 0 })
    };
  }

  /**
   * Process 3D point
   */
  private processPoint3D(point: any): Point3D {
    return {
      x: typeof point.x === 'number' ? point.x : 0,
      y: typeof point.y === 'number' ? point.y : 0,
      z: typeof point.z === 'number' ? point.z : 0
    };
  }

  /**
   * Infer parameter type from value
   */
  private inferParameterType(value: any): 'string' | 'number' | 'boolean' | 'date' {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'date';
    return 'string';
  }

  /**
   * Get default capabilities for a tool
   */
  private getDefaultCapabilities(toolName: NonicaTabTool): string[] {
    const capabilityMap: Record<string, string[]> = {
      'get_active_view_in_revit': ['view_access', 'element_enumeration'],
      'get_user_selection_in_revit': ['selection_access', 'element_enumeration'],
      'get_elements_by_category': ['category_filtering', 'element_enumeration'],
      'get_parameters_from_elementid': ['parameter_access', 'element_properties'],
      'get_all_additional_properties_from_elementid': ['property_access', 'element_metadata'],
      'get_boundingboxes_for_element_ids': ['geometry_access', 'spatial_analysis'],
      'get_location_for_element_ids': ['geometry_access', 'spatial_coordinates'],
      'get_all_used_families_in_model': ['family_analysis', 'model_inventory'],
      'get_all_used_types_of_families': ['type_analysis', 'family_inventory']
    };

    return capabilityMap[toolName] || ['data_extraction'];
  }

  /**
   * Create mock MCP client for testing
   */
  private createMockClient(): any {
    return {
      ping: async () => true,
      
      callTool: async (toolName: string, parameters: any) => {
        // Simulate different tool responses
        switch (toolName) {
          case 'get_active_view_in_revit':
            return {
              viewId: 'view-123',
              viewName: 'Floor Plan - Level 1',
              viewType: 'FloorPlan',
              scale: 100,
              elements: [
                {
                  elementId: 'wall-456',
                  category: 'Walls',
                  familyName: 'Basic Wall',
                  typeName: 'Generic - 8"',
                  parameters: { Height: 10, Length: 20 },
                  geometry: {
                    boundingBox: {
                      min: { x: 0, y: 0, z: 0 },
                      max: { x: 20, y: 8, z: 10 }
                    },
                    location: { x: 10, y: 4, z: 5 }
                  }
                }
              ]
            };
          
          case 'get_user_selection_in_revit':
          case 'get_elements_by_category':
            return {
              elements: [
                {
                  elementId: 'element-789',
                  category: parameters.categories?.[0] || 'Walls',
                  familyName: 'Test Family',
                  typeName: 'Test Type',
                  parameters: { Width: 6, Height: 9 },
                  geometry: {
                    boundingBox: {
                      min: { x: 0, y: 0, z: 0 },
                      max: { x: 6, y: 6, z: 9 }
                    },
                    location: { x: 3, y: 3, z: 4.5 }
                  }
                }
              ]
            };
          
          case 'get_parameters_from_elementid':
          case 'get_all_additional_properties_from_elementid':
            return {
              parameters: [
                {
                  elementId: parameters.elementId,
                  parameterName: 'Height',
                  value: 10,
                  isReadOnly: false,
                  group: 'Dimensions'
                },
                {
                  elementId: parameters.elementId,
                  parameterName: 'Material',
                  value: 'Concrete',
                  isReadOnly: true,
                  group: 'Materials'
                }
              ]
            };
          
          case 'get_boundingboxes_for_element_ids':
            return {
              boundingBoxes: parameters.elementIds.map((id: string) => ({
                elementId: id,
                boundingBox: {
                  min: { x: 0, y: 0, z: 0 },
                  max: { x: 10, y: 10, z: 10 }
                }
              }))
            };
          
          case 'get_location_for_element_ids':
            return {
              locations: parameters.elementIds.map((id: string, index: number) => ({
                elementId: id,
                location: { x: index * 10, y: index * 5, z: 0 }
              }))
            };
          
          case 'get_all_used_families_in_model':
          case 'get_all_used_types_of_families':
            return {
              families: [
                {
                  name: 'Basic Wall',
                  category: 'Walls',
                  types: ['Generic - 6"', 'Generic - 8"', 'Generic - 12"'],
                  parameters: ['Height', 'Length', 'Width'],
                  instanceCount: 25
                },
                {
                  name: 'Rectangular Column',
                  category: 'Structural Columns',
                  types: ['12x12', '16x16', '20x20'],
                  parameters: ['Height', 'Width', 'Depth'],
                  instanceCount: 8
                }
              ]
            };
          
          default:
            return { message: `Mock response for ${toolName}`, parameters };
        }
      },
      
      getServerInfo: async () => ({
        name: 'NonicaTab MCP Server',
        version: '1.0.0',
        tools: NONICATAB_TOOLS.map(tool => ({ name: tool }))
      }),
      
      getToolInfo: async (toolName: string) => ({
        name: toolName,
        description: `NonicaTab tool: ${toolName}`,
        capabilities: ['data_extraction', 'revit_integration']
      })
    };
  }

  /**
   * Batch execute multiple tools
   */
  async executeBatch(toolCalls: Array<{ tool: NonicaTabTool; parameters?: Record<string, any> }>): Promise<NonicaTabToolResult[]> {
    const results = await Promise.allSettled(
      toolCalls.map(call => this.executeTool(call.tool, call.parameters))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          toolName: toolCalls[index].tool,
          executionTime: 0,
          metadata: { timestamp: new Date() }
        };
      }
    });
  }

  /**
   * Get comprehensive model data using multiple tools
   */
  async getComprehensiveModelData(): Promise<{
    activeView: any;
    allElements: RevitElement[];
    families: FamilyData;
    parameters: ElementParameter[];
    geometry: Array<{ elementId: string; boundingBox: BoundingBox; location: Point3D }>;
  }> {
    try {
      // Execute multiple tools in parallel
      const [viewResult, elementsResult, familiesResult] = await Promise.all([
        this.getActiveViewInRevit(),
        this.getUserSelectionInRevit(),
        this.getAllUsedFamiliesInModel()
      ]);

      const elements = elementsResult.success ? elementsResult.data : [];
      const elementIds = elements.map((e: RevitElement) => e.elementId);

      // Get detailed data for elements
      const [parametersResult, boundingBoxResult, locationResult] = await Promise.all([
        elementIds.length > 0 ? 
          Promise.all(elementIds.map((id: string) => this.getParametersFromElementId(id))) : 
          Promise.resolve([]),
        elementIds.length > 0 ? this.getBoundingBoxesForElementIds(elementIds) : Promise.resolve({ success: true, data: [] }),
        elementIds.length > 0 ? this.getLocationForElementIds(elementIds) : Promise.resolve({ success: true, data: [] })
      ]);

      // Combine all parameters
      const allParameters = parametersResult
        .filter(result => result.success)
        .flatMap(result => result.data || []);

      return {
        activeView: viewResult.success ? viewResult.data : null,
        allElements: elements,
        families: familiesResult.success ? familiesResult.data : { families: [] },
        parameters: allParameters,
        geometry: elementIds.map((id: string, index: number) => ({
          elementId: id,
          boundingBox: boundingBoxResult.success && boundingBoxResult.data[index] ? 
            boundingBoxResult.data[index].boundingBox : 
            { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          location: locationResult.success && locationResult.data[index] ? 
            locationResult.data[index].location : 
            { x: 0, y: 0, z: 0 }
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get comprehensive model data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}