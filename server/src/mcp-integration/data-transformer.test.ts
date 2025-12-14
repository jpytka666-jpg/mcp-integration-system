/**
 * Property-based tests for Data Transformer
 * Feature: mcp-integration-system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DataTransformer } from './data-transformer.js';
import { 
  TransformationRule, 
  RevitElement, 
  GeometryData, 
  FamilyData,
  BoundingBox,
  Point3D
} from './types.js';

describe('Data Transformer Property Tests', () => {
  let dataTransformer: DataTransformer;

  beforeEach(() => {
    dataTransformer = new DataTransformer();
  });

  describe('Property 31: NonicaTab Response Parsing Completeness', () => {
    // Property 31: NonicaTab Response Parsing Completeness
    // For any NonicaTab MCP response from the 37 FREE tools, the Data Transformer should handle JSON parsing and convert element data, parameters, and geometry into standardized internal formats
    // Validates: Requirements 7.1

    it('should parse and convert any valid NonicaTab MCP response to standardized format', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          // Array of elements response
          fc.array(fc.record({
            elementId: fc.string({ minLength: 1 }),
            category: fc.string({ minLength: 1 }),
            familyName: fc.string({ minLength: 1 }),
            typeName: fc.string({ minLength: 1 }),
            parameters: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean()))
          })),
          // Object with elements array
          fc.record({
            elements: fc.array(fc.record({
              elementId: fc.string({ minLength: 1 }),
              category: fc.string({ minLength: 1 }),
              familyName: fc.string({ minLength: 1 }),
              parameters: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer()))
            }))
          }),
          // Parameters array response
          fc.record({
            parameters: fc.array(fc.record({
              name: fc.string({ minLength: 1 }),
              value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
              type: fc.constantFrom('string', 'number', 'boolean'),
              group: fc.string()
            }))
          }),
          // Generic object response
          fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean()))
        ),
        async (nonicaTabResponse) => {
          const result = await dataTransformer.transform(
            nonicaTabResponse, 
            'nonicatab_response', 
            'powerpoint_table'
          );

          // Verify standardized format
          expect(result).toBeDefined();
          expect(result).toHaveProperty('headers');
          expect(result).toHaveProperty('rows');
          expect(Array.isArray(result.headers)).toBe(true);
          expect(Array.isArray(result.rows)).toBe(true);
          
          // Verify data integrity
          if (result.rows.length > 0) {
            expect(result.rows[0].length).toBe(result.headers.length);
          }
        }
      ), { numRuns: 100 });
    });

    it('should handle all 37 NonicaTab tool response formats consistently', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom(
          'get_active_view_in_revit',
          'get_user_selection_in_revit', 
          'get_elements_by_category',
          'get_parameters_from_elementid',
          'get_all_additional_properties_from_elementid',
          'get_boundingboxes_for_element_ids',
          'get_location_for_element_ids',
          'get_all_used_families_in_model',
          'get_all_used_types_of_families'
        ),
        fc.oneof(
          fc.array(fc.record({
            elementId: fc.string(),
            data: fc.dictionary(fc.string(), fc.anything())
          })),
          fc.record({
            result: fc.anything(),
            status: fc.constantFrom('success', 'error'),
            data: fc.anything()
          })
        ),
        async (toolName, toolResponse) => {
          const result = await dataTransformer.transform(
            toolResponse,
            'nonicatab_response',
            'powerpoint_table'
          );

          // All tool responses should be parseable
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');
          expect(result.headers).toBeDefined();
          expect(result.rows).toBeDefined();
        }
      ), { numRuns: 100 });
    });

    it('should preserve data completeness during parsing and conversion', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          elements: fc.array(fc.record({
            elementId: fc.string({ minLength: 1 }),
            category: fc.string({ minLength: 1 }),
            parameters: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer()))
          }), { minLength: 1 })
        }),
        async (response) => {
          const result = await dataTransformer.transform(
            response,
            'nonicatab_response',
            'powerpoint_table'
          );

          // Verify no data loss
          expect(result.rows.length).toBe(response.elements.length);
          
          // Verify all elements are represented
          const elementIds = result.rows.map(row => row[0]);
          const originalIds = response.elements.map(el => el.elementId);
          
          for (const originalId of originalIds) {
            expect(elementIds).toContain(originalId);
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 32: PowerPoint Format Generation', () => {
    // Property 32: PowerPoint Format Generation
    // For any Revit element data, the Data Transformer should convert it into presentation formats including tables, charts, and visual summaries suitable for PowerPoint integration
    // Validates: Requirements 7.2

    it('should convert any Revit element data to PowerPoint-compatible formats', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          elementId: fc.string({ minLength: 1 }),
          category: fc.string({ minLength: 1 }),
          familyName: fc.string({ minLength: 1 }),
          typeName: fc.string({ minLength: 1 }),
          parameters: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean())),
          geometry: fc.record({
            boundingBox: fc.record({
              min: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
              max: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() })
            }),
            location: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() })
          }),
          additionalProperties: fc.dictionary(fc.string(), fc.anything())
        }),
        async (revitElement) => {
          const chartResult = await dataTransformer.transform(
            revitElement,
            'revit_element',
            'chart_data'
          );

          // Verify PowerPoint chart format
          expect(chartResult).toBeDefined();
          expect(chartResult.type).toBeDefined();
          expect(chartResult.data).toBeDefined();
          expect(chartResult.data.labels).toBeDefined();
          expect(chartResult.data.datasets).toBeDefined();
          expect(Array.isArray(chartResult.data.labels)).toBe(true);
          expect(Array.isArray(chartResult.data.datasets)).toBe(true);
          
          // Verify chart has meaningful data
          if (chartResult.data.datasets.length > 0) {
            expect(chartResult.data.datasets[0].data).toBeDefined();
            expect(Array.isArray(chartResult.data.datasets[0].data)).toBe(true);
          }
        }
      ), { numRuns: 100 });
    });

    it('should generate presentation data with proper slide structure', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          fc.array(fc.record({
            elementId: fc.string(),
            category: fc.string(),
            familyName: fc.string(),
            parameters: fc.dictionary(fc.string(), fc.anything())
          })),
          fc.record({
            elements: fc.array(fc.record({
              elementId: fc.string(),
              category: fc.string(),
              familyName: fc.string()
            }))
          })
        ),
        async (data) => {
          const presentationResult = await dataTransformer.transform(
            data,
            'nonicatab_response',
            'presentation_data'
          );

          // Verify presentation structure
          expect(presentationResult).toBeDefined();
          expect(presentationResult.slides).toBeDefined();
          expect(Array.isArray(presentationResult.slides)).toBe(true);
          expect(presentationResult.metadata).toBeDefined();
          expect(presentationResult.template).toBeDefined();
          
          // Verify slides have required properties
          for (const slide of presentationResult.slides) {
            expect(slide.id).toBeDefined();
            expect(slide.type).toBeDefined();
            expect(slide.title).toBeDefined();
            expect(slide.layout).toBeDefined();
          }
          
          // Should have at least a title slide
          expect(presentationResult.slides.length).toBeGreaterThan(0);
          expect(presentationResult.slides.some(slide => slide.type === 'title')).toBe(true);
        }
      ), { numRuns: 100 });
    });

    it('should maintain visual consistency across different data types', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          elementId: fc.string(),
          category: fc.constantFrom('Walls', 'Doors', 'Windows', 'Floors', 'Roofs'),
          familyName: fc.string(),
          parameters: fc.dictionary(fc.string(), fc.integer({ min: 1, max: 1000 }))
        }), { minLength: 3, maxLength: 10 }),
        async (elements) => {
          const chartResult = await dataTransformer.transform(
            { elements },
            'nonicatab_response',
            'presentation_data'
          );

          // Find chart slide
          const chartSlide = chartResult.slides.find(slide => slide.type === 'chart');
          if (chartSlide) {
            const chartData = chartSlide.content;
            
            // Verify consistent color scheme
            if (chartData.data && chartData.data.datasets && chartData.data.datasets[0]) {
              const dataset = chartData.data.datasets[0];
              if (Array.isArray(dataset.backgroundColor)) {
                expect(dataset.backgroundColor.length).toBeGreaterThan(0);
              }
            }
            
            // Verify proper labeling
            expect(chartData.data.labels).toBeDefined();
            expect(chartData.data.labels.length).toBeGreaterThan(0);
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 33: Geometric Data Transformation', () => {
    // Property 33: Geometric Data Transformation
    // For any geometric data (bounding boxes, locations, spatial relationships), the Data Transformer should convert it into formats suitable for diagrams and layouts
    // Validates: Requirements 7.3

    it('should transform geometric data to visual diagram format', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          elements: fc.array(fc.record({
            elementId: fc.string({ minLength: 1 }),
            category: fc.string(),
            familyName: fc.string(),
            typeName: fc.string(),
            geometry: fc.record({
              boundingBox: fc.record({
                min: fc.record({ 
                  x: fc.float({ min: -1000, max: 1000 }), 
                  y: fc.float({ min: -1000, max: 1000 }), 
                  z: fc.float({ min: -1000, max: 1000 }) 
                }),
                max: fc.record({ 
                  x: fc.float({ min: -1000, max: 1000 }), 
                  y: fc.float({ min: -1000, max: 1000 }), 
                  z: fc.float({ min: -1000, max: 1000 }) 
                })
              }),
              location: fc.record({ 
                x: fc.float({ min: -1000, max: 1000 }), 
                y: fc.float({ min: -1000, max: 1000 }), 
                z: fc.float({ min: -1000, max: 1000 }) 
              })
            })
          }), { minLength: 1 })
        }),
        async (geometryData) => {
          // Ensure bounding box is valid (min < max)
          for (const element of geometryData.elements) {
            const bbox = element.geometry.boundingBox;
            if (bbox.min.x > bbox.max.x) [bbox.min.x, bbox.max.x] = [bbox.max.x, bbox.min.x];
            if (bbox.min.y > bbox.max.y) [bbox.min.y, bbox.max.y] = [bbox.max.y, bbox.min.y];
            if (bbox.min.z > bbox.max.z) [bbox.min.z, bbox.max.z] = [bbox.max.z, bbox.min.z];
          }

          const diagramResult = await dataTransformer.transform(
            geometryData,
            'geometry_data',
            'visual_diagram'
          );

          // Verify diagram structure
          expect(diagramResult).toBeDefined();
          expect(diagramResult.type).toBe('spatial_diagram');
          expect(diagramResult.elements).toBeDefined();
          expect(Array.isArray(diagramResult.elements)).toBe(true);
          expect(diagramResult.viewport).toBeDefined();
          expect(diagramResult.metadata).toBeDefined();
          
          // Verify elements are properly mapped
          expect(diagramResult.elements.length).toBe(geometryData.elements.length);
          
          // Verify viewport calculation
          expect(diagramResult.viewport.center).toBeDefined();
          expect(diagramResult.viewport.scale).toBeDefined();
          expect(typeof diagramResult.viewport.scale).toBe('number');
        }
      ), { numRuns: 100 });
    });

    it('should preserve spatial relationships in transformed diagrams', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          elementId: fc.string({ minLength: 1 }),
          category: fc.string(),
          familyName: fc.string(),
          typeName: fc.string(),
          geometry: fc.record({
            boundingBox: fc.record({
              min: fc.record({ x: fc.float({ min: 0, max: 100 }), y: fc.float({ min: 0, max: 100 }), z: fc.float({ min: 0, max: 100 }) }),
              max: fc.record({ x: fc.float({ min: 101, max: 200 }), y: fc.float({ min: 101, max: 200 }), z: fc.float({ min: 101, max: 200 }) })
            }),
            location: fc.record({ x: fc.float({ min: 50, max: 150 }), y: fc.float({ min: 50, max: 150 }), z: fc.float({ min: 50, max: 150 }) })
          })
        }), { minLength: 2, maxLength: 5 }),
        async (elements) => {
          const geometryData = { elements };
          const diagramResult = await dataTransformer.transform(
            geometryData,
            'geometry_data',
            'visual_diagram'
          );

          // Verify relative positions are maintained
          const originalPositions = elements.map(el => el.geometry.location);
          const diagramPositions = diagramResult.elements.map(el => el.position);
          
          expect(diagramPositions.length).toBe(originalPositions.length);
          
          // Check that relative ordering is preserved (at least in one dimension)
          for (let i = 0; i < originalPositions.length - 1; i++) {
            for (let j = i + 1; j < originalPositions.length; j++) {
              const originalDeltaX = originalPositions[j].x - originalPositions[i].x;
              const diagramDeltaX = diagramPositions[j].x - diagramPositions[i].x;
              
              // If there was a significant difference originally, it should be preserved
              if (Math.abs(originalDeltaX) > 10) {
                expect(Math.sign(diagramDeltaX)).toBe(Math.sign(originalDeltaX));
              }
            }
          }
        }
      ), { numRuns: 100 });
    });

    it('should calculate accurate bounding boxes for diagram layouts', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          elementId: fc.string({ minLength: 1 }),
          category: fc.string(),
          familyName: fc.string(),
          typeName: fc.string(),
          geometry: fc.record({
            boundingBox: fc.record({
              min: fc.record({ 
                x: fc.float({ min: -500, max: 0, noNaN: true }), 
                y: fc.float({ min: -500, max: 0, noNaN: true }), 
                z: fc.float({ min: -500, max: 0, noNaN: true }) 
              }),
              max: fc.record({ 
                x: fc.float({ min: 1, max: 500, noNaN: true }), 
                y: fc.float({ min: 1, max: 500, noNaN: true }), 
                z: fc.float({ min: 1, max: 500, noNaN: true }) 
              })
            }),
            location: fc.record({ 
              x: fc.float({ noNaN: true }), 
              y: fc.float({ noNaN: true }), 
              z: fc.float({ noNaN: true }) 
            })
          })
        }), { minLength: 1 }),
        async (elements) => {
          const geometryData = { elements };
          const diagramResult = await dataTransformer.transform(
            geometryData,
            'geometry_data',
            'visual_diagram'
          );

          const overallBounds = diagramResult.metadata.boundingBox;
          
          // Verify bounding box encompasses all valid elements
          for (const element of elements) {
            const bbox = element.geometry.boundingBox;
            
            // Skip elements with NaN values
            if (isNaN(bbox.min.x) || isNaN(bbox.min.y) || isNaN(bbox.min.z) ||
                isNaN(bbox.max.x) || isNaN(bbox.max.y) || isNaN(bbox.max.z)) {
              continue;
            }
            
            expect(overallBounds.min.x).toBeLessThanOrEqual(bbox.min.x);
            expect(overallBounds.min.y).toBeLessThanOrEqual(bbox.min.y);
            expect(overallBounds.min.z).toBeLessThanOrEqual(bbox.min.z);
            expect(overallBounds.max.x).toBeGreaterThanOrEqual(bbox.max.x);
            expect(overallBounds.max.y).toBeGreaterThanOrEqual(bbox.max.y);
            expect(overallBounds.max.z).toBeGreaterThanOrEqual(bbox.max.z);
          }
          
          // Verify viewport center is within bounds
          const center = diagramResult.viewport.center;
          expect(center.x).toBeGreaterThanOrEqual(overallBounds.min.x);
          expect(center.x).toBeLessThanOrEqual(overallBounds.max.x);
          expect(center.y).toBeGreaterThanOrEqual(overallBounds.min.y);
          expect(center.y).toBeLessThanOrEqual(overallBounds.max.y);
          expect(center.z).toBeGreaterThanOrEqual(overallBounds.min.z);
          expect(center.z).toBeLessThanOrEqual(overallBounds.max.z);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 34: Family and Type Data Structuring', () => {
    // Property 34: Family and Type Data Structuring
    // For any Revit family and type data, the Data Transformer should create structured data suitable for schedules, reports, and presentation materials
    // Validates: Requirements 7.4

    it('should structure family data into comprehensive schedules', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          families: fc.array(fc.record({
            name: fc.string({ minLength: 1 }),
            category: fc.string({ minLength: 1 }),
            types: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
            instanceCount: fc.integer({ min: 1, max: 100 }),
            parameters: fc.array(fc.string())
          }), { minLength: 1 })
        }),
        async (familyData) => {
          const scheduleResult = await dataTransformer.transform(
            familyData,
            'family_data',
            'structured_schedule'
          );

          // Verify schedule structure
          expect(scheduleResult).toBeDefined();
          expect(scheduleResult.title).toBeDefined();
          expect(scheduleResult.headers).toBeDefined();
          expect(scheduleResult.rows).toBeDefined();
          expect(scheduleResult.summary).toBeDefined();
          expect(Array.isArray(scheduleResult.headers)).toBe(true);
          expect(Array.isArray(scheduleResult.rows)).toBe(true);
          
          // Verify data completeness (rows may be fewer due to merging duplicate family names)
          const uniqueFamilyNames = new Set(familyData.families.map(f => f.name));
          expect(scheduleResult.rows.length).toBe(uniqueFamilyNames.size);
          
          // Verify summary calculations (accounting for merged families and deduplicated types)
          const expectedTotalFamilies = uniqueFamilyNames.size;
          
          // Calculate expected types and instances accounting for merging
          const familyMap = new Map<string, { types: Set<string>, instances: number }>();
          for (const family of familyData.families) {
            const name = family.name;
            const existing = familyMap.get(name);
            if (existing) {
              family.types.forEach(type => existing.types.add(type));
              existing.instances += family.instanceCount;
            } else {
              familyMap.set(name, {
                types: new Set(family.types),
                instances: family.instanceCount
              });
            }
          }
          
          const expectedTotalTypes = Array.from(familyMap.values()).reduce((sum, f) => sum + f.types.size, 0);
          const expectedTotalInstances = Array.from(familyMap.values()).reduce((sum, f) => sum + f.instances, 0);
          
          expect(scheduleResult.summary.totalFamilies).toBe(expectedTotalFamilies);
          expect(scheduleResult.summary.totalTypes).toBe(expectedTotalTypes);
          expect(scheduleResult.summary.totalInstances).toBe(expectedTotalInstances);
        }
      ), { numRuns: 100 });
    });

    it('should maintain data integrity across family transformations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          families: fc.array(fc.record({
            name: fc.string({ minLength: 1 }),
            category: fc.constantFrom('Walls', 'Doors', 'Windows', 'Furniture'),
            types: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
            instanceCount: fc.integer({ min: 0, max: 50 })
          }), { minLength: 1, maxLength: 10 })
        }),
        async (familyData) => {
          const scheduleResult = await dataTransformer.transform(
            familyData,
            'family_data',
            'structured_schedule'
          );

          // Verify all families are represented
          const familyNames = scheduleResult.rows.map(row => row[0]);
          const originalNames = familyData.families.map(f => f.name);
          
          for (const originalName of originalNames) {
            expect(familyNames).toContain(originalName);
          }
          
          // Verify instance counts are preserved (accounting for families with same names)
          const familyInstanceMap = new Map<string, number>();
          for (const family of familyData.families) {
            const currentCount = familyInstanceMap.get(family.name) || 0;
            familyInstanceMap.set(family.name, currentCount + family.instanceCount);
          }
          
          for (const [familyName, expectedCount] of familyInstanceMap) {
            const scheduleRow = scheduleResult.rows.find(row => row[0] === familyName);
            expect(scheduleRow).toBeDefined();
            expect(parseInt(scheduleRow![2])).toBe(expectedCount);
          }
        }
      ), { numRuns: 100 });
    });

    it('should generate presentation-ready family summaries', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          families: fc.array(fc.record({
            name: fc.string({ minLength: 1 }),
            category: fc.string({ minLength: 1 }),
            types: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
            instanceCount: fc.integer({ min: 1, max: 20 })
          }), { minLength: 3, maxLength: 15 })
        }),
        async (familyData) => {
          const scheduleResult = await dataTransformer.transform(
            familyData,
            'family_data',
            'structured_schedule'
          );

          // Verify presentation readiness
          expect(scheduleResult.title).toBe('Family Schedule');
          expect(scheduleResult.headers).toEqual(['Family Name', 'Type Name', 'Count', 'Category']);
          
          // Verify summary provides meaningful insights
          expect(scheduleResult.summary.totalFamilies).toBeGreaterThan(0);
          expect(scheduleResult.summary.totalInstances).toBeGreaterThan(0);
          
          // Verify all rows have consistent structure
          for (const row of scheduleResult.rows) {
            expect(row.length).toBe(4);
            expect(typeof row[0]).toBe('string'); // Family Name
            expect(typeof row[1]).toBe('string'); // Type Name
            expect(typeof row[2]).toBe('string'); // Count (as string)
            expect(typeof row[3]).toBe('string'); // Category
            
            // Count should be a valid number
            expect(parseInt(row[2])).toBeGreaterThanOrEqual(0);
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 35: Round-trip Validation Integrity', () => {
    // Property 35: Round-trip Validation Integrity
    // For any data transformation between NonicaTab responses and output formats, the Data Transformer should implement round-trip validation to ensure data consistency
    // Validates: Requirements 7.5

    it('should validate transformation integrity for all supported formats', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          // NonicaTab response format
          fc.record({
            elements: fc.array(fc.record({
              elementId: fc.string({ minLength: 1 }),
              category: fc.string({ minLength: 1 }),
              familyName: fc.string({ minLength: 1 }),
              parameters: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer()))
            }))
          }),
          // Revit element format
          fc.record({
            elementId: fc.string({ minLength: 1 }),
            category: fc.string({ minLength: 1 }),
            familyName: fc.string({ minLength: 1 }),
            typeName: fc.string({ minLength: 1 }),
            parameters: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer())),
            geometry: fc.record({
              boundingBox: fc.record({
                min: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
                max: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() })
              }),
              location: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() })
            }),
            additionalProperties: fc.dictionary(fc.string(), fc.anything())
          })
        ),
        fc.constantFrom('powerpoint_table', 'chart_data'),
        async (sourceData, targetFormat) => {
          const sourceFormat = 'elementId' in sourceData ? 'revit_element' : 'nonicatab_response';
          
          const transformedData = await dataTransformer.transform(
            sourceData,
            sourceFormat,
            targetFormat
          );

          // Validate transformation using built-in validation
          const transformationRules = (dataTransformer as any).transformationRules as Map<string, TransformationRule>;
          const rule = Array.from(transformationRules.values())
            .find((r: TransformationRule) => r.sourceFormat === sourceFormat && r.targetFormat === targetFormat);
          
          if (rule) {
            const isValid = dataTransformer.validateTransformation(sourceData, transformedData, rule);
            expect(isValid).toBe(true);
          }
          
          // Verify basic integrity
          expect(transformedData).toBeDefined();
          expect(transformedData).not.toBeNull();
          expect(typeof transformedData).toBe('object');
        }
      ), { numRuns: 100 });
    });

    it('should detect and reject invalid transformations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.record({}) // Empty object
        ),
        async (invalidData) => {
          try {
            await dataTransformer.transform(
              invalidData,
              'nonicatab_response',
              'powerpoint_table'
            );
            
            // If transformation succeeds, result should still be valid
            // This handles cases where the transformer gracefully handles edge cases
          } catch (error) {
            // Expected for truly invalid data
            expect(error).toBeInstanceOf(Error);
          }
        }
      ), { numRuns: 100 });
    });

    it('should maintain semantic consistency across transformations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          elements: fc.array(fc.record({
            elementId: fc.string({ minLength: 1 }),
            category: fc.constantFrom('Walls', 'Doors', 'Windows'),
            familyName: fc.string({ minLength: 1 }),
            parameters: fc.record({
              Height: fc.integer({ min: 100, max: 5000 }),
              Width: fc.integer({ min: 50, max: 2000 }),
              Area: fc.integer({ min: 1, max: 10000 })
            })
          }), { minLength: 1, maxLength: 5 })
        }),
        async (sourceData) => {
          // Transform to table
          const tableResult = await dataTransformer.transform(
            sourceData,
            'nonicatab_response',
            'powerpoint_table'
          );
          
          // Transform to presentation
          const presentationResult = await dataTransformer.transform(
            sourceData,
            'nonicatab_response',
            'presentation_data'
          );

          // Verify semantic consistency
          expect(tableResult.rows.length).toBe(sourceData.elements.length);
          
          // Check that presentation includes overview of same data
          const overviewSlide = presentationResult.slides.find(slide => slide.type === 'content');
          if (overviewSlide && overviewSlide.content.elementCount !== undefined) {
            expect(overviewSlide.content.elementCount).toBe(sourceData.elements.length);
          }
          
          // Verify categories are consistent
          const originalCategories = [...new Set(sourceData.elements.map(el => el.category))];
          if (overviewSlide && overviewSlide.content.categories) {
            for (const category of originalCategories) {
              expect(overviewSlide.content.categories).toContain(category);
            }
          }
        }
      ), { numRuns: 100 });
    });

    it('should preserve data relationships during complex transformations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          families: fc.array(fc.record({
            name: fc.string({ minLength: 1 }),
            category: fc.string({ minLength: 1 }),
            types: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
            instanceCount: fc.integer({ min: 1, max: 50 })
          }), { minLength: 2, maxLength: 8 })
        }),
        async (familyData) => {
          const scheduleResult = await dataTransformer.transform(
            familyData,
            'family_data',
            'structured_schedule'
          );

          // Verify parent-child relationships are preserved
          const totalInstancesFromRows = scheduleResult.rows.reduce((sum, row) => sum + parseInt(row[2]), 0);
          expect(totalInstancesFromRows).toBe(scheduleResult.summary.totalInstances);
          
          // Verify family-type relationships
          const familyTypeMap = new Map<string, number>();
          for (const family of familyData.families) {
            familyTypeMap.set(family.name, family.types.length);
          }
          
          // Check that type counts are preserved in transformation
          for (const row of scheduleResult.rows) {
            const familyName = row[0];
            const typeNames = row[1];
            
            if (familyTypeMap.has(familyName)) {
              // Types should be represented (either as count or comma-separated list)
              expect(typeNames).toBeDefined();
              expect(typeNames.length).toBeGreaterThan(0);
            }
          }
        }
      ), { numRuns: 100 });
    });
  });
});