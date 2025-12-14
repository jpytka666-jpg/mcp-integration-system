/**
 * Tests for NonicaTab MCP Tool Integration Layer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NonicaTabMCPIntegration } from './nonicatab-integration.js';
import { NONICATAB_TOOLS } from './types.js';

describe('NonicaTab MCP Integration', () => {
  let integration: NonicaTabMCPIntegration;

  beforeEach(() => {
    integration = new NonicaTabMCPIntegration();
  });

  describe('Connection Management', () => {
    it('should validate connection successfully', async () => {
      const isConnected = await integration.validateConnection();
      expect(isConnected).toBe(true);
    });

    it('should get available tools', async () => {
      const tools = await integration.getAvailableTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Should include known NonicaTab tools
      expect(tools).toContain('get_active_view_in_revit');
      expect(tools).toContain('get_user_selection_in_revit');
    });

    it('should get tool capabilities', async () => {
      const capabilities = await integration.getToolCapabilities('get_active_view_in_revit');
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('Data Extraction Tools', () => {
    it('should get active view in Revit', async () => {
      const result = await integration.getActiveViewInRevit();
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_active_view_in_revit');
      expect(result.data).toBeDefined();
      expect(result.data.viewId).toBeDefined();
      expect(result.data.viewName).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should get user selection in Revit', async () => {
      const result = await integration.getUserSelectionInRevit();
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_user_selection_in_revit');
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get elements by category', async () => {
      const categories = ['Walls', 'Doors'];
      const result = await integration.getElementsByCategory(categories);
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_elements_by_category');
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data.length > 0) {
        const element = result.data[0];
        expect(element.elementId).toBeDefined();
        expect(element.category).toBeDefined();
        expect(element.familyName).toBeDefined();
        expect(element.typeName).toBeDefined();
      }
    });
  });

  describe('Model Data Processing Tools', () => {
    it('should get parameters from element ID', async () => {
      const elementId = 'test-element-123';
      const result = await integration.getParametersFromElementId(elementId);
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_parameters_from_elementid');
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      
      if (result.data.length > 0) {
        const parameter = result.data[0];
        expect(parameter.elementId).toBe(elementId);
        expect(parameter.parameterName).toBeDefined();
        expect(parameter.value).toBeDefined();
        expect(parameter.type).toMatch(/^(string|number|boolean|date)$/);
      }
    });

    it('should get additional properties from element ID', async () => {
      const elementId = 'test-element-456';
      const result = await integration.getAllAdditionalPropertiesFromElementId(elementId);
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_all_additional_properties_from_elementid');
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('Geometry Analysis Tools', () => {
    it('should get bounding boxes for element IDs', async () => {
      const elementIds = ['element-1', 'element-2', 'element-3'];
      const result = await integration.getBoundingBoxesForElementIds(elementIds);
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_boundingboxes_for_element_ids');
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(elementIds.length);
      
      if (result.data.length > 0) {
        const bbox = result.data[0];
        expect(bbox.elementId).toBeDefined();
        expect(bbox.boundingBox).toBeDefined();
        expect(bbox.boundingBox.min).toBeDefined();
        expect(bbox.boundingBox.max).toBeDefined();
        expect(typeof bbox.boundingBox.min.x).toBe('number');
        expect(typeof bbox.boundingBox.min.y).toBe('number');
        expect(typeof bbox.boundingBox.min.z).toBe('number');
      }
    });

    it('should get locations for element IDs', async () => {
      const elementIds = ['element-1', 'element-2'];
      const result = await integration.getLocationForElementIds(elementIds);
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_location_for_element_ids');
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(elementIds.length);
      
      if (result.data.length > 0) {
        const location = result.data[0];
        expect(location.elementId).toBeDefined();
        expect(location.location).toBeDefined();
        expect(typeof location.location.x).toBe('number');
        expect(typeof location.location.y).toBe('number');
        expect(typeof location.location.z).toBe('number');
      }
    });
  });

  describe('Family and Type Analysis Tools', () => {
    it('should get all used families in model', async () => {
      const result = await integration.getAllUsedFamiliesInModel();
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_all_used_families_in_model');
      expect(result.data).toBeDefined();
      expect(result.data.families).toBeDefined();
      expect(Array.isArray(result.data.families)).toBe(true);
      
      if (result.data.families.length > 0) {
        const family = result.data.families[0];
        expect(family.name).toBeDefined();
        expect(family.category).toBeDefined();
        expect(Array.isArray(family.types)).toBe(true);
        expect(typeof family.instanceCount).toBe('number');
      }
    });

    it('should get all used types of families', async () => {
      const result = await integration.getAllUsedTypesOfFamilies();
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_all_used_types_of_families');
      expect(result.data).toBeDefined();
      expect(result.data.families).toBeDefined();
      expect(Array.isArray(result.data.families)).toBe(true);
    });
  });

  describe('Generic Tool Execution', () => {
    it('should execute any valid NonicaTab tool', async () => {
      const toolName = 'get_active_view_in_revit';
      const result = await integration.executeTool(toolName);
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe(toolName);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
    });

    it('should handle invalid tool names', async () => {
      const result = await integration.executeTool('invalid_tool_name' as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown NonicaTab tool');
    });

    it('should execute tools with parameters', async () => {
      const result = await integration.executeTool('get_elements_by_category', {
        categories: ['Walls', 'Windows']
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('should execute multiple tools in batch', async () => {
      const toolCalls = [
        { tool: 'get_active_view_in_revit' as const },
        { tool: 'get_user_selection_in_revit' as const },
        { tool: 'get_all_used_families_in_model' as const }
      ];
      
      const results = await integration.executeBatch(toolCalls);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(toolCalls.length);
      
      results.forEach((result, index) => {
        expect(result.toolName).toBe(toolCalls[index].tool);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });
    });

    it('should handle batch execution with some failures', async () => {
      const toolCalls = [
        { tool: 'get_active_view_in_revit' as const },
        { tool: 'invalid_tool' as any },
        { tool: 'get_all_used_families_in_model' as const }
      ];
      
      const results = await integration.executeBatch(toolCalls);
      
      expect(results.length).toBe(toolCalls.length);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('Comprehensive Model Data', () => {
    it('should get comprehensive model data', async () => {
      const data = await integration.getComprehensiveModelData();
      
      expect(data).toBeDefined();
      expect(data.activeView).toBeDefined();
      expect(Array.isArray(data.allElements)).toBe(true);
      expect(data.families).toBeDefined();
      expect(data.families.families).toBeDefined();
      expect(Array.isArray(data.parameters)).toBe(true);
      expect(Array.isArray(data.geometry)).toBe(true);
      
      // Validate structure
      if (data.allElements.length > 0) {
        const element = data.allElements[0];
        expect(element.elementId).toBeDefined();
        expect(element.category).toBeDefined();
        expect(element.familyName).toBeDefined();
        expect(element.typeName).toBeDefined();
        expect(element.parameters).toBeDefined();
        expect(element.geometry).toBeDefined();
      }
      
      if (data.geometry.length > 0) {
        const geom = data.geometry[0];
        expect(geom.elementId).toBeDefined();
        expect(geom.boundingBox).toBeDefined();
        expect(geom.location).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      // Create integration with failing client
      const failingClient = {
        ping: async () => { throw new Error('Connection failed'); },
        callTool: async () => { throw new Error('Tool execution failed'); },
        getServerInfo: async () => { throw new Error('Server info failed'); },
        getToolInfo: async () => { throw new Error('Tool info failed'); }
      };
      
      const failingIntegration = new NonicaTabMCPIntegration(failingClient);
      
      const result = await failingIntegration.executeTool('get_active_view_in_revit');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.toolName).toBe('get_active_view_in_revit');
    });

    it('should handle connection validation failures', async () => {
      const failingClient = {
        ping: async () => { throw new Error('Connection timeout'); }
      };
      
      const failingIntegration = new NonicaTabMCPIntegration(failingClient);
      const isConnected = await failingIntegration.validateConnection();
      
      expect(isConnected).toBe(false);
    });
  });
});