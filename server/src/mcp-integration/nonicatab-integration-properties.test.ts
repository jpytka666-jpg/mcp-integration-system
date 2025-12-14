/**
 * Property-based tests for NonicaTab MCP Tool Integration Layer
 * **Feature: mcp-integration-system, Properties 11-15**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { NonicaTabMCPIntegration } from './nonicatab-integration.js';
import { NONICATAB_TOOLS, NonicaTabTool } from './types.js';

describe('NonicaTab Integration Property Tests', () => {
  let integration: NonicaTabMCPIntegration;

  beforeEach(() => {
    integration = new NonicaTabMCPIntegration();
  });

  describe('Property 11: NonicaTab Tool Utilization', () => {
    /**
     * **Feature: mcp-integration-system, Property 11: NonicaTab Tool Utilization**
     * **Validates: Requirements 3.1**
     */
    it('should successfully execute any valid NonicaTab tool', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom(...NONICATAB_TOOLS),
        async (toolName) => {
          // Provide required parameters for tools that need them
          let parameters: any = {};
          if (toolName.includes('elementid')) {
            parameters = { elementId: 'test-element-123' };
          } else if (toolName.includes('element_ids')) {
            parameters = { elementIds: ['test-1', 'test-2'] };
          } else if (toolName.includes('category')) {
            parameters = { categories: ['Walls'] };
          }

          const result = await integration.executeTool(toolName, parameters);

          // All valid tools should execute successfully
          expect(result.success).toBe(true);
          expect(result.toolName).toBe(toolName);
          expect(result.data).toBeDefined();
          expect(result.executionTime).toBeGreaterThanOrEqual(0);
          expect(result.metadata).toBeDefined();
          expect(result.metadata.timestamp).toBeInstanceOf(Date);
        }
      ), { numRuns: 20 });
    });

    it('should handle tool parameters consistently', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('get_elements_by_category', 'get_parameters_from_elementid', 'get_boundingboxes_for_element_ids'),
        fc.record({
          categories: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          elementId: fc.string({ minLength: 1, maxLength: 50 }),
          elementIds: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 })
        }),
        async (toolName, params) => {
          let toolParams: any = {};
          
          switch (toolName) {
            case 'get_elements_by_category':
              toolParams = { categories: params.categories };
              break;
            case 'get_parameters_from_elementid':
              toolParams = { elementId: params.elementId };
              break;
            case 'get_boundingboxes_for_element_ids':
              toolParams = { elementIds: params.elementIds };
              break;
          }

          const result = await integration.executeTool(toolName as NonicaTabTool, toolParams);

          // Tool should handle parameters correctly
          expect(result.success).toBe(true);
          expect(result.toolName).toBe(toolName);
          expect(result.data).toBeDefined();
        }
      ), { numRuns: 30 });
    });

    it('should maintain consistent response structure across all tools', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom(...NONICATAB_TOOLS),
        async (toolName) => {
          const result = await integration.executeTool(toolName);

          // All tools should return consistent structure
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('toolName');
          expect(result).toHaveProperty('executionTime');
          expect(result).toHaveProperty('metadata');
          
          expect(typeof result.success).toBe('boolean');
          expect(typeof result.toolName).toBe('string');
          expect(typeof result.executionTime).toBe('number');
          expect(typeof result.metadata).toBe('object');
          
          if (result.success) {
            expect(result).toHaveProperty('data');
          } else {
            expect(result).toHaveProperty('error');
            expect(typeof result.error).toBe('string');
          }
        }
      ), { numRuns: 25 });
    });
  });

  describe('Property 12: Model Data Processing Tool Selection', () => {
    /**
     * **Feature: mcp-integration-system, Property 12: Model Data Processing Tool Selection**
     * **Validates: Requirements 3.2**
     */
    it('should select appropriate tools for different data processing needs', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('parameters', 'properties', 'geometry', 'families'),
        async (dataType) => {
          let selectedTools: NonicaTabTool[] = [];
          
          switch (dataType) {
            case 'parameters':
              selectedTools = ['get_parameters_from_elementid'];
              break;
            case 'properties':
              selectedTools = ['get_all_additional_properties_from_elementid'];
              break;
            case 'geometry':
              selectedTools = ['get_boundingboxes_for_element_ids', 'get_location_for_element_ids'];
              break;
            case 'families':
              selectedTools = ['get_all_used_families_in_model', 'get_all_used_types_of_families'];
              break;
          }

          // Execute selected tools
          const results = await Promise.all(
            selectedTools.map(tool => {
              const params = tool.includes('elementid') ? { elementId: 'test-element' } :
                           tool.includes('element_ids') ? { elementIds: ['test-1', 'test-2'] } : {};
              return integration.executeTool(tool, params);
            })
          );

          // All selected tools should execute successfully
          for (const result of results) {
            expect(result.success).toBe(true);
            expect(selectedTools).toContain(result.toolName as NonicaTabTool);
          }

          // Validate data type-specific results
          switch (dataType) {
            case 'parameters':
            case 'properties':
              results.forEach(result => {
                expect(Array.isArray(result.data)).toBe(true);
                if (result.data.length > 0) {
                  expect(result.data[0]).toHaveProperty('parameterName');
                  expect(result.data[0]).toHaveProperty('value');
                }
              });
              break;
            case 'geometry':
              results.forEach(result => {
                expect(Array.isArray(result.data)).toBe(true);
                if (result.data.length > 0) {
                  expect(result.data[0]).toHaveProperty('elementId');
                  if (result.toolName.includes('boundingbox')) {
                    expect(result.data[0]).toHaveProperty('boundingBox');
                  } else {
                    expect(result.data[0]).toHaveProperty('location');
                  }
                }
              });
              break;
            case 'families':
              results.forEach(result => {
                expect(result.data).toHaveProperty('families');
                expect(Array.isArray(result.data.families)).toBe(true);
              });
              break;
          }
        }
      ), { numRuns: 20 });
    });

    it('should process element data consistently across different tools', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
        async (elementIds) => {
          // Execute multiple tools on the same elements
          const [parametersResults, boundingBoxResults, locationResults] = await Promise.all([
            Promise.all(elementIds.map(id => integration.getParametersFromElementId(id))),
            integration.getBoundingBoxesForElementIds(elementIds),
            integration.getLocationForElementIds(elementIds)
          ]);

          // All tools should succeed
          parametersResults.forEach(result => expect(result.success).toBe(true));
          expect(boundingBoxResults.success).toBe(true);
          expect(locationResults.success).toBe(true);

          // Results should correspond to input elements
          expect(boundingBoxResults.data.length).toBe(elementIds.length);
          expect(locationResults.data.length).toBe(elementIds.length);

          // Element IDs should match
          boundingBoxResults.data.forEach((item: any, index: number) => {
            expect(item.elementId).toBe(elementIds[index]);
          });
          
          locationResults.data.forEach((item: any, index: number) => {
            expect(item.elementId).toBe(elementIds[index]);
          });
        }
      ), { numRuns: 15 });
    });
  });

  describe('Property 13: Geometry Analysis Tool Usage', () => {
    /**
     * **Feature: mcp-integration-system, Property 13: Geometry Analysis Tool Usage**
     * **Validates: Requirements 3.3**
     */
    it('should provide valid geometric data for all elements', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 8 }),
        async (elementIds) => {
          const [boundingBoxResult, locationResult] = await Promise.all([
            integration.getBoundingBoxesForElementIds(elementIds),
            integration.getLocationForElementIds(elementIds)
          ]);

          // Both geometry tools should succeed
          expect(boundingBoxResult.success).toBe(true);
          expect(locationResult.success).toBe(true);

          // Should return data for all elements
          expect(boundingBoxResult.data.length).toBe(elementIds.length);
          expect(locationResult.data.length).toBe(elementIds.length);

          // Validate bounding box structure
          boundingBoxResult.data.forEach((item: any) => {
            expect(item.boundingBox).toBeDefined();
            expect(item.boundingBox.min).toBeDefined();
            expect(item.boundingBox.max).toBeDefined();
            
            // Coordinates should be numbers
            expect(typeof item.boundingBox.min.x).toBe('number');
            expect(typeof item.boundingBox.min.y).toBe('number');
            expect(typeof item.boundingBox.min.z).toBe('number');
            expect(typeof item.boundingBox.max.x).toBe('number');
            expect(typeof item.boundingBox.max.y).toBe('number');
            expect(typeof item.boundingBox.max.z).toBe('number');
            
            // Max should be >= min (valid bounding box)
            expect(item.boundingBox.max.x).toBeGreaterThanOrEqual(item.boundingBox.min.x);
            expect(item.boundingBox.max.y).toBeGreaterThanOrEqual(item.boundingBox.min.y);
            expect(item.boundingBox.max.z).toBeGreaterThanOrEqual(item.boundingBox.min.z);
          });

          // Validate location structure
          locationResult.data.forEach((item: any) => {
            expect(item.location).toBeDefined();
            expect(typeof item.location.x).toBe('number');
            expect(typeof item.location.y).toBe('number');
            expect(typeof item.location.z).toBe('number');
            
            // Coordinates should be finite numbers
            expect(isFinite(item.location.x)).toBe(true);
            expect(isFinite(item.location.y)).toBe(true);
            expect(isFinite(item.location.z)).toBe(true);
          });
        }
      ), { numRuns: 25 });
    });

    it('should handle geometric calculations consistently', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        async (elementId) => {
          const [boundingBoxResult, locationResult] = await Promise.all([
            integration.getBoundingBoxesForElementIds([elementId]),
            integration.getLocationForElementIds([elementId])
          ]);

          expect(boundingBoxResult.success).toBe(true);
          expect(locationResult.success).toBe(true);

          const bbox = boundingBoxResult.data[0].boundingBox;
          const location = locationResult.data[0].location;

          // Location should typically be within or near the bounding box
          // (This is a geometric consistency check)
          const centerX = (bbox.min.x + bbox.max.x) / 2;
          const centerY = (bbox.min.y + bbox.max.y) / 2;
          const centerZ = (bbox.min.z + bbox.max.z) / 2;

          // Calculate bounding box dimensions
          const width = bbox.max.x - bbox.min.x;
          const height = bbox.max.y - bbox.min.y;
          const depth = bbox.max.z - bbox.min.z;

          // All dimensions should be non-negative
          expect(width).toBeGreaterThanOrEqual(0);
          expect(height).toBeGreaterThanOrEqual(0);
          expect(depth).toBeGreaterThanOrEqual(0);

          // Location coordinates should be reasonable (not NaN or infinite)
          expect(isFinite(location.x)).toBe(true);
          expect(isFinite(location.y)).toBe(true);
          expect(isFinite(location.z)).toBe(true);
        }
      ), { numRuns: 20 });
    });
  });

  describe('Property 14: Family and Type Analysis Tool Selection', () => {
    /**
     * **Feature: mcp-integration-system, Property 14: Family and Type Analysis Tool Selection**
     * **Validates: Requirements 3.4**
     */
    it('should provide comprehensive family and type information', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constant(null), // No parameters needed for family tools
        async () => {
          const [familiesResult, typesResult] = await Promise.all([
            integration.getAllUsedFamiliesInModel(),
            integration.getAllUsedTypesOfFamilies()
          ]);

          // Both family analysis tools should succeed
          expect(familiesResult.success).toBe(true);
          expect(typesResult.success).toBe(true);

          // Both should return family data structure
          expect(familiesResult.data.families).toBeDefined();
          expect(typesResult.data.families).toBeDefined();
          expect(Array.isArray(familiesResult.data.families)).toBe(true);
          expect(Array.isArray(typesResult.data.families)).toBe(true);

          // Validate family data structure
          const validateFamilyData = (families: any[]) => {
            families.forEach(family => {
              expect(family.name).toBeDefined();
              expect(typeof family.name).toBe('string');
              expect(family.category).toBeDefined();
              expect(typeof family.category).toBe('string');
              expect(Array.isArray(family.types)).toBe(true);
              expect(Array.isArray(family.parameters)).toBe(true);
              expect(typeof family.instanceCount).toBe('number');
              expect(family.instanceCount).toBeGreaterThanOrEqual(0);
            });
          };

          if (familiesResult.data.families.length > 0) {
            validateFamilyData(familiesResult.data.families);
          }
          
          if (typesResult.data.families.length > 0) {
            validateFamilyData(typesResult.data.families);
          }
        }
      ), { numRuns: 15 });
    });

    it('should maintain data consistency between family and type analysis', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constant(null),
        async () => {
          const [familiesResult, typesResult] = await Promise.all([
            integration.getAllUsedFamiliesInModel(),
            integration.getAllUsedTypesOfFamilies()
          ]);

          expect(familiesResult.success).toBe(true);
          expect(typesResult.success).toBe(true);

          const families = familiesResult.data.families;
          const types = typesResult.data.families;

          // Both results should have similar structure
          expect(Array.isArray(families)).toBe(true);
          expect(Array.isArray(types)).toBe(true);

          // If both have data, they should be consistent
          if (families.length > 0 && types.length > 0) {
            // Family names should be consistent
            const familyNames = new Set(families.map((f: any) => f.name));
            const typeNames = new Set(types.map((f: any) => f.name));
            
            // There should be some overlap in family names
            const intersection = new Set([...familyNames].filter(name => typeNames.has(name)));
            
            // At least some families should appear in both results
            // (This validates that both tools are analyzing the same model)
            if (familyNames.size > 0 && typeNames.size > 0) {
              expect(intersection.size).toBeGreaterThan(0);
            }
          }

          // Instance counts should be reasonable
          families.forEach((family: any) => {
            expect(family.instanceCount).toBeGreaterThanOrEqual(0);
            expect(family.instanceCount).toBeLessThan(10000); // Reasonable upper bound
          });
        }
      ), { numRuns: 10 });
    });
  });

  describe('Property 15: Data Transformation Capability', () => {
    /**
     * **Feature: mcp-integration-system, Property 15: Data Transformation Capability**
     * **Validates: Requirements 3.5**
     */
    it('should transform raw tool data into standardized formats', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom(...NONICATAB_TOOLS),
        async (toolName) => {
          // Provide required parameters for tools that need them
          let parameters: any = {};
          if (toolName.includes('elementid')) {
            parameters = { elementId: 'test-element-123' };
          } else if (toolName.includes('element_ids')) {
            parameters = { elementIds: ['test-1', 'test-2'] };
          } else if (toolName.includes('category')) {
            parameters = { categories: ['Walls'] };
          }

          const result = await integration.executeTool(toolName, parameters);

          expect(result.success).toBe(true);

          // Data should be transformed into appropriate format based on tool
          switch (toolName) {
            case 'get_active_view_in_revit':
              expect(result.data.viewId).toBeDefined();
              expect(result.data.viewName).toBeDefined();
              expect(result.data.viewType).toBeDefined();
              break;

            case 'get_user_selection_in_revit':
            case 'get_elements_by_category':
              expect(Array.isArray(result.data)).toBe(true);
              if (result.data.length > 0) {
                const element = result.data[0];
                expect(element.elementId).toBeDefined();
                expect(element.category).toBeDefined();
                expect(element.familyName).toBeDefined();
                expect(element.typeName).toBeDefined();
                expect(element.parameters).toBeDefined();
                expect(element.geometry).toBeDefined();
              }
              break;

            case 'get_parameters_from_elementid':
            case 'get_all_additional_properties_from_elementid':
              expect(Array.isArray(result.data)).toBe(true);
              if (result.data.length > 0) {
                const param = result.data[0];
                expect(param.elementId).toBeDefined();
                expect(param.parameterName).toBeDefined();
                expect(param.value).toBeDefined();
                expect(param.type).toMatch(/^(string|number|boolean|date)$/);
              }
              break;

            case 'get_boundingboxes_for_element_ids':
              expect(Array.isArray(result.data)).toBe(true);
              if (result.data.length > 0) {
                const bbox = result.data[0];
                expect(bbox.elementId).toBeDefined();
                expect(bbox.boundingBox).toBeDefined();
                expect(bbox.boundingBox.min).toBeDefined();
                expect(bbox.boundingBox.max).toBeDefined();
              }
              break;

            case 'get_location_for_element_ids':
              expect(Array.isArray(result.data)).toBe(true);
              if (result.data.length > 0) {
                const loc = result.data[0];
                expect(loc.elementId).toBeDefined();
                expect(loc.location).toBeDefined();
                expect(typeof loc.location.x).toBe('number');
                expect(typeof loc.location.y).toBe('number');
                expect(typeof loc.location.z).toBe('number');
              }
              break;

            case 'get_all_used_families_in_model':
            case 'get_all_used_types_of_families':
              expect(result.data.families).toBeDefined();
              expect(Array.isArray(result.data.families)).toBe(true);
              if (result.data.families.length > 0) {
                const family = result.data.families[0];
                expect(family.name).toBeDefined();
                expect(family.category).toBeDefined();
                expect(Array.isArray(family.types)).toBe(true);
              }
              break;
          }
        }
      ), { numRuns: 30 });
    });

    it('should maintain data integrity during transformation', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 5 }),
        async (elementIds) => {
          // Get comprehensive data for elements
          const comprehensiveData = await integration.getComprehensiveModelData();

          // Validate overall data structure
          expect(comprehensiveData.activeView).toBeDefined();
          expect(Array.isArray(comprehensiveData.allElements)).toBe(true);
          expect(comprehensiveData.families).toBeDefined();
          expect(Array.isArray(comprehensiveData.parameters)).toBe(true);
          expect(Array.isArray(comprehensiveData.geometry)).toBe(true);

          // Validate data relationships
          if (comprehensiveData.allElements.length > 0) {
            const elementIds = comprehensiveData.allElements.map(e => e.elementId);
            
            // Geometry data should correspond to elements
            comprehensiveData.geometry.forEach(geom => {
              expect(elementIds).toContain(geom.elementId);
              expect(geom.boundingBox).toBeDefined();
              expect(geom.location).toBeDefined();
            });

            // Parameters should reference valid elements
            comprehensiveData.parameters.forEach(param => {
              expect(typeof param.elementId).toBe('string');
              expect(typeof param.parameterName).toBe('string');
              expect(param.value).toBeDefined();
            });
          }

          // Family data should be well-formed
          if (comprehensiveData.families.families && comprehensiveData.families.families.length > 0) {
            comprehensiveData.families.families.forEach(family => {
              expect(typeof family.name).toBe('string');
              expect(typeof family.category).toBe('string');
              expect(typeof family.instanceCount).toBe('number');
              expect(family.instanceCount).toBeGreaterThanOrEqual(0);
            });
          }
        }
      ), { numRuns: 15 });
    });

    it('should handle batch transformations consistently', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.constantFrom(...NONICATAB_TOOLS), { minLength: 2, maxLength: 5 }),
        async (toolNames) => {
          const toolCalls = toolNames.map(tool => ({ tool }));
          const results = await integration.executeBatch(toolCalls);

          expect(results.length).toBe(toolNames.length);

          // All results should have consistent structure
          results.forEach((result, index) => {
            expect(result.toolName).toBe(toolNames[index]);
            expect(typeof result.success).toBe('boolean');
            expect(typeof result.executionTime).toBe('number');
            expect(result.metadata).toBeDefined();
            
            if (result.success) {
              expect(result.data).toBeDefined();
              // Data should be properly transformed based on tool type
              expect(result.data).not.toBeNull();
            }
          });

          // Execution times should be reasonable
          results.forEach(result => {
            expect(result.executionTime).toBeGreaterThanOrEqual(0);
            expect(result.executionTime).toBeLessThan(30000); // Less than 30 seconds
          });
        }
      ), { numRuns: 20 });
    });
  });
});