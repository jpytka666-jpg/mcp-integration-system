/**
 * Property-based tests for Assessment Automation Engine
 * **Feature: mcp-integration-system, Properties 16-20**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Type-safe generators for assessment task types
const assessmentTaskTypeGen = fc.constantFrom(
  'data_extraction' as const,
  'analysis' as const, 
  'report_generation' as const,
  'presentation_creation' as const
);

const dataExtractionTypeGen = fc.constantFrom(
  'data_extraction' as const,
  'analysis' as const
);

const reportGenerationTypeGen = fc.constantFrom(
  'report_generation' as const,
  'presentation_creation' as const
);
import { 
  MCPAssessmentAutomationEngine,
  AssessmentAutomationEngine 
} from './assessment-engine.js';
import { MCPRegistryManager } from './registry-manager.js';
import { WorkflowOrchestrator } from './workflow-orchestrator.js';
import { DataTransformer } from './data-transformer.js';
import { 
  AssessmentTask,
  AssessmentResult,
  WorkflowDefinition
} from './types.js';

describe('Assessment Engine Property Tests', () => {
  let assessmentEngine: AssessmentAutomationEngine;
  let mockRegistryManager: MCPRegistryManager;
  let mockWorkflowOrchestrator: WorkflowOrchestrator;
  let mockDataTransformer: DataTransformer;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Create mock dependencies with proper typing
    mockRegistryManager = {
      getServer: vi.fn().mockReturnValue({
        id: 'test-server',
        name: 'Mock Server',
        status: 'connected',
        capabilities: ['data_extraction', 'automation']
      }),
      validateServerConnection: vi.fn().mockResolvedValue(true),
      registerServer: vi.fn().mockResolvedValue(undefined),
      discoverServers: vi.fn().mockResolvedValue([]),
      getRegisteredServers: vi.fn().mockReturnValue([])
    } as any;

    mockWorkflowOrchestrator = {
      executeWorkflow: vi.fn().mockImplementation(async (workflow: WorkflowDefinition) => ({
        id: workflow.id,
        status: 'completed' as const,
        results: new Map([
          ['extract_get_active_view_in_revit', { elements: [{ id: '1', category: 'Walls' }] }],
          ['transform_to_powerpoint', { outputPath: '/tmp/test.pptx' }],
          ['generate_powerpoint', { outputPath: '/tmp/assessment.pptx' }]
        ]),
        errors: new Map(),
        executionTime: 1000,
        completedSteps: ['extract_get_active_view_in_revit', 'transform_to_powerpoint'],
        failedSteps: []
      }))
    } as any;

    mockDataTransformer = {
      transform: vi.fn().mockResolvedValue({
        headers: ['Property', 'Value'],
        rows: [['Test', 'Data']],
        title: 'Test Table'
      }),
      registerTransformation: vi.fn(),
      validateTransformation: vi.fn().mockReturnValue(true),
      getAvailableTransformations: vi.fn().mockReturnValue(['powerpoint_table', 'chart_data'])
    } as any;

    assessmentEngine = new MCPAssessmentAutomationEngine(
      mockRegistryManager,
      mockWorkflowOrchestrator,
      mockDataTransformer
    );
  });

  describe('Property 16: Assessment Workflow Validation', () => {
    /**
     * **Feature: mcp-integration-system, Property 16: Assessment Workflow Validation**
     * **Validates: Requirements 4.1**
     */
    it('should generate valid workflows for any assessment task configuration', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: assessmentTaskTypeGen,
          requirements: fc.record({
            sourceApplications: fc.array(fc.constantFrom('revit', 'autocad'), { minLength: 1, maxLength: 2 }),
            dataTypes: fc.array(fc.constantFrom('elements', 'parameters', 'geometry', 'families', 'views'), { minLength: 1, maxLength: 5 }),
            outputFormats: fc.array(fc.constantFrom('powerpoint', 'pdf', 'excel', 'json'), { minLength: 1, maxLength: 3 }),
            qualityCriteria: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 })
          })
        }),
        async (taskConfig) => {
          const task: AssessmentTask = {
            id: taskConfig.id,
            type: taskConfig.type,
            requirements: taskConfig.requirements,
            workflow: {
              id: `workflow_${taskConfig.id}`,
              name: 'Test Workflow',
              description: 'Test workflow for assessment',
              steps: [],
              metadata: {
                requiredServers: ['nonicatab-mcp'],
                estimatedDuration: 30000
              }
            }
          };

          const workflow = await assessmentEngine.createAssessmentWorkflow(task);

          // Validate workflow structure
          expect(workflow).toBeDefined();
          expect(workflow.id).toContain('assessment_workflow');
          expect(workflow.steps).toBeDefined();
          expect(Array.isArray(workflow.steps)).toBe(true);
          expect(workflow.steps.length).toBeGreaterThan(0);

          // Validate workflow steps have proper structure
          for (const step of workflow.steps) {
            expect(step.id).toBeDefined();
            expect(step.type).toBeDefined();
            expect(step.target).toBeDefined();
            expect(step.operation).toBeDefined();
            expect(Array.isArray(step.dependencies)).toBe(true);
          }

          // Validate workflow includes required data extraction steps
          const extractionSteps = workflow.steps.filter(step => step.id.startsWith('extract_'));
          expect(extractionSteps.length).toBeGreaterThan(0);

          // Validate workflow includes transformation steps for each output format
          const transformationSteps = workflow.steps.filter(step => step.id.startsWith('transform_to_'));
          expect(transformationSteps.length).toBe(task.requirements.outputFormats.length);
        }
      ), { numRuns: 50 });
    });

    it('should create workflows with proper step dependencies', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: dataExtractionTypeGen,
          requirements: fc.record({
            sourceApplications: fc.array(fc.constantFrom('revit', 'autocad'), { minLength: 1, maxLength: 2 }),
            dataTypes: fc.array(fc.constantFrom('elements', 'parameters'), { minLength: 1, maxLength: 3 }),
            outputFormats: fc.array(fc.constantFrom('powerpoint', 'pdf'), { minLength: 1, maxLength: 2 }),
            qualityCriteria: fc.array(fc.string(), { minLength: 1, maxLength: 5 })
          })
        }),
        async (taskConfig) => {
          const task: AssessmentTask = {
            id: taskConfig.id,
            type: taskConfig.type,
            requirements: taskConfig.requirements,
            workflow: {
              id: `workflow_${taskConfig.id}`,
              name: 'Test Workflow',
              description: 'Test workflow for assessment',
              steps: [],
              metadata: {
                requiredServers: ['nonicatab-mcp'],
                estimatedDuration: 30000
              }
            }
          };

          const workflow = await assessmentEngine.createAssessmentWorkflow(task);

          // Validate dependency chain
          const stepIds = new Set(workflow.steps.map(step => step.id));
          
          for (const step of workflow.steps) {
            // All dependencies should reference valid step IDs
            for (const depId of step.dependencies) {
              expect(stepIds.has(depId)).toBe(true);
            }
          }

          // Transformation steps should depend on extraction steps
          const extractionStepIds = workflow.steps
            .filter(step => step.id.startsWith('extract_'))
            .map(step => step.id);
          
          const transformationSteps = workflow.steps.filter(step => step.id.startsWith('transform_to_'));
          
          for (const transformStep of transformationSteps) {
            const hasExtractionDependency = transformStep.dependencies.some(dep => 
              extractionStepIds.includes(dep)
            );
            expect(hasExtractionDependency).toBe(true);
          }
        }
      ), { numRuns: 30 });
    });
  });

  describe('Property 17: Requirement-based Tool Selection', () => {
    /**
     * **Feature: mcp-integration-system, Property 17: Requirement-based Tool Selection**
     * **Validates: Requirements 4.2**
     */
    it('should select appropriate NonicaTab tools based on data requirements', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: dataExtractionTypeGen,
          requirements: fc.record({
            sourceApplications: fc.array(fc.constantFrom('revit', 'autocad'), { minLength: 1, maxLength: 2 }),
            dataTypes: fc.array(fc.constantFrom('elements', 'parameters', 'geometry', 'families', 'views'), { minLength: 1, maxLength: 5 }),
            outputFormats: fc.array(fc.constantFrom('powerpoint', 'excel'), { minLength: 1, maxLength: 2 }),
            qualityCriteria: fc.array(fc.string(), { minLength: 1, maxLength: 5 })
          })
        }),
        async (taskConfig) => {
          const task: AssessmentTask = {
            id: taskConfig.id,
            type: taskConfig.type,
            requirements: taskConfig.requirements,
            workflow: {
              id: `workflow_${taskConfig.id}`,
              name: 'Test Workflow',
              description: 'Test workflow for assessment',
              steps: [],
              metadata: {
                requiredServers: ['nonicatab-mcp'],
                estimatedDuration: 30000
              }
            }
          };

          const workflow = await assessmentEngine.createAssessmentWorkflow(task);
          const extractionSteps = workflow.steps.filter(step => step.id.startsWith('extract_'));

          // Validate tool selection based on data types
          const selectedTools = extractionSteps.map(step => step.operation);

          for (const dataType of task.requirements.dataTypes) {
            switch (dataType) {
              case 'elements':
                expect(selectedTools.some(tool => 
                  tool === 'get_elements_by_category' || tool === 'get_user_selection_in_revit'
                )).toBe(true);
                break;
              case 'parameters':
                expect(selectedTools.some(tool => 
                  tool === 'get_parameters_from_elementid' || tool === 'get_all_additional_properties_from_elementid'
                )).toBe(true);
                break;
              case 'geometry':
                expect(selectedTools.some(tool => 
                  tool === 'get_boundingboxes_for_element_ids' || tool === 'get_location_for_element_ids'
                )).toBe(true);
                break;
              case 'families':
                expect(selectedTools.some(tool => 
                  tool === 'get_all_used_families_in_model' || tool === 'get_all_used_types_of_families'
                )).toBe(true);
                break;
              case 'views':
                expect(selectedTools.some(tool => 
                  tool === 'get_active_view_in_revit'
                )).toBe(true);
                break;
            }
          }

          // Ensure no duplicate tools are selected
          const uniqueTools = new Set(selectedTools);
          expect(uniqueTools.size).toBe(selectedTools.length);
        }
      ), { numRuns: 40 });
    });

    it('should include fallback tools when no specific data types are provided', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: fc.constant('data_extraction' as const),
          requirements: fc.record({
            sourceApplications: fc.array(fc.constantFrom('revit', 'autocad'), { minLength: 1, maxLength: 2 }),
            dataTypes: fc.constant([]), // Empty data types
            outputFormats: fc.array(fc.constantFrom('powerpoint'), { minLength: 1, maxLength: 1 }),
            qualityCriteria: fc.array(fc.string(), { minLength: 1, maxLength: 3 })
          })
        }),
        async (taskConfig) => {
          const task: AssessmentTask = {
            id: taskConfig.id,
            type: taskConfig.type,
            requirements: taskConfig.requirements,
            workflow: {
              id: `workflow_${taskConfig.id}`,
              name: 'Test Workflow',
              description: 'Test workflow for assessment',
              steps: [],
              metadata: {
                requiredServers: ['nonicatab-mcp'],
                estimatedDuration: 30000
              }
            }
          };

          const workflow = await assessmentEngine.createAssessmentWorkflow(task);
          const extractionSteps = workflow.steps.filter(step => step.id.startsWith('extract_'));

          // Should have fallback tools
          expect(extractionSteps.length).toBeGreaterThan(0);
          
          const selectedTools = extractionSteps.map(step => step.operation);
          expect(selectedTools).toContain('get_active_view_in_revit');
          expect(selectedTools).toContain('get_user_selection_in_revit');
        }
      ), { numRuns: 20 });
    });
  });

  describe('Property 18: PowerPoint Content Generation', () => {
    /**
     * **Feature: mcp-integration-system, Property 18: PowerPoint Content Generation**
     * **Validates: Requirements 4.3**
     */
    it('should generate PowerPoint content from any Revit assessment data', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: reportGenerationTypeGen,
          requirements: fc.record({
            sourceApplications: fc.array(fc.constantFrom('revit', 'autocad'), { minLength: 1, maxLength: 2 }),
            dataTypes: fc.array(fc.constantFrom('elements', 'parameters'), { minLength: 1, maxLength: 3 }),
            outputFormats: fc.constant(['powerpoint']),
            qualityCriteria: fc.array(fc.string(), { minLength: 1, maxLength: 5 })
          })
        }),
        async (taskConfig) => {
          const task: AssessmentTask = {
            id: taskConfig.id,
            type: taskConfig.type,
            requirements: taskConfig.requirements,
            workflow: {
              id: `workflow_${taskConfig.id}`,
              name: 'Test Workflow',
              description: 'Test workflow for assessment',
              steps: [],
              metadata: {
                requiredServers: ['nonicatab-mcp'],
                estimatedDuration: 30000
              }
            }
          };

          // Register the task
          (assessmentEngine as MCPAssessmentAutomationEngine).registerTask(task);

          const result = await assessmentEngine.executeAssessment(task.id);

          // Validate PowerPoint output generation
          expect(result.status).toBe('completed');
          expect(result.outputs).toBeDefined();
          expect(Array.isArray(result.outputs)).toBe(true);

          const powerpointOutputs = result.outputs.filter(output => 
            output.type === 'presentation' || output.format === 'powerpoint'
          );
          expect(powerpointOutputs.length).toBeGreaterThan(0);

          // Validate output structure
          for (const output of powerpointOutputs) {
            expect(output.path).toBeDefined();
            expect(output.metadata).toBeDefined();
            expect(output.metadata.generatedAt).toBeDefined();
            expect(output.metadata.taskId).toBe(task.id);
          }
        }
      ), { numRuns: 25 });
    });

    it('should generate reports in requested formats', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('pdf' as const, 'docx' as const, 'pptx' as const),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (format, assessmentId) => {
          // Create a mock result
          const mockResult: AssessmentResult = {
            id: assessmentId,
            taskId: 'test-task',
            status: 'completed',
            outputs: [{
              type: 'presentation',
              format: 'powerpoint',
              path: '/tmp/test.pptx',
              metadata: { generatedAt: new Date().toISOString(), taskId: 'test-task' }
            }],
            metrics: {
              executionTime: 5000,
              dataPointsProcessed: 10,
              completenessScore: 95
            },
            errors: []
          };

          // Store the result in the engine
          (assessmentEngine as any).taskResults.set(assessmentId, mockResult);

          const reportBuffer = await assessmentEngine.generateReport(assessmentId, format);

          // Validate report generation
          expect(reportBuffer).toBeDefined();
          expect(Buffer.isBuffer(reportBuffer)).toBe(true);
          expect(reportBuffer.length).toBeGreaterThan(0);

          // Validate report content contains key information
          const reportContent = reportBuffer.toString('utf-8');
          expect(reportContent).toContain('Assessment Report');
          expect(reportContent).toContain('test-task'); // This is the taskId in the mock result
          expect(reportContent).toContain('completed');
        }
      ), { numRuns: 30 });
    });
  });

  describe('Property 19: Error Reporting and Alternative Suggestions', () => {
    /**
     * **Feature: mcp-integration-system, Property 19: Error Reporting and Alternative Suggestions**
     * **Validates: Requirements 4.4**
     */
    it('should handle server connection failures gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: fc.constant('data_extraction' as const),
          requirements: fc.record({
            sourceApplications: fc.array(fc.constantFrom('revit', 'autocad'), { minLength: 1, maxLength: 2 }),
            dataTypes: fc.array(fc.constantFrom('elements'), { minLength: 1, maxLength: 1 }),
            outputFormats: fc.array(fc.constantFrom('powerpoint'), { minLength: 1, maxLength: 1 }),
            qualityCriteria: fc.array(fc.string(), { minLength: 1, maxLength: 3 })
          })
        }),
        async (taskConfig) => {
          const task: AssessmentTask = {
            id: taskConfig.id,
            type: taskConfig.type,
            requirements: taskConfig.requirements,
            workflow: {
              id: `workflow_${taskConfig.id}`,
              name: 'Test Workflow',
              description: 'Test workflow for assessment',
              steps: [],
              metadata: {
                requiredServers: ['nonicatab-mcp'],
                estimatedDuration: 30000
              }
            }
          };

          // Create engine with failing server connections
          const failingRegistryManager = {
            ...mockRegistryManager,
            validateServerConnection: async () => false
          };

          const failingEngine = new MCPAssessmentAutomationEngine(
            failingRegistryManager as any,
            mockWorkflowOrchestrator,
            mockDataTransformer
          );

          // Should throw descriptive error for server connection failures
          await expect(failingEngine.createAssessmentWorkflow(task))
            .rejects.toThrow(/Cannot connect to/);
        }
      ), { numRuns: 20 });
    });

    it('should provide detailed error information when assessment fails', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: fc.constant('analysis' as const),
          requirements: fc.record({
            sourceApplications: fc.array(fc.constantFrom('revit', 'autocad'), { minLength: 1, maxLength: 2 }),
            dataTypes: fc.array(fc.constantFrom('elements'), { minLength: 1, maxLength: 1 }),
            outputFormats: fc.array(fc.constantFrom('powerpoint'), { minLength: 1, maxLength: 1 }),
            qualityCriteria: fc.array(fc.string(), { minLength: 1, maxLength: 3 })
          })
        }),
        async (taskConfig) => {
          const task: AssessmentTask = {
            id: taskConfig.id,
            type: taskConfig.type,
            requirements: taskConfig.requirements,
            workflow: {
              id: `workflow_${taskConfig.id}`,
              name: 'Test Workflow',
              description: 'Test workflow for assessment',
              steps: [],
              metadata: {
                requiredServers: ['nonicatab-mcp'],
                estimatedDuration: 30000
              }
            }
          };

          // Create engine with failing workflow orchestrator
          const failingOrchestrator = {
            ...mockWorkflowOrchestrator,
            executeWorkflow: async () => {
              throw new Error('Workflow execution failed');
            }
          };

          const failingEngine = new MCPAssessmentAutomationEngine(
            mockRegistryManager,
            failingOrchestrator as any,
            mockDataTransformer
          );

          failingEngine.registerTask(task);

          try {
            await failingEngine.executeAssessment(task.id);
            expect.fail('Should have thrown an error');
          } catch (error) {
            // Validate error handling
            expect(error).toBeDefined();
            expect(error instanceof Error).toBe(true);

            // Check that failed result is stored
            const result = (failingEngine as any).taskResults.get(task.id);
            expect(result).toBeDefined();
            expect(result.status).toBe('failed');
            expect(result.errors).toBeDefined();
            expect(Array.isArray(result.errors)).toBe(true);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        }
      ), { numRuns: 15 });
    });
  });

  describe('Property 20: Progress Tracking Completeness', () => {
    /**
     * **Feature: mcp-integration-system, Property 20: Progress Tracking Completeness**
     * **Validates: Requirements 4.5**
     */
    it('should track progress through all assessment phases', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: fc.constant('report_generation' as const),
          requirements: fc.record({
            sourceApplications: fc.array(fc.constantFrom('revit', 'autocad'), { minLength: 1, maxLength: 2 }),
            dataTypes: fc.array(fc.constantFrom('elements', 'parameters'), { minLength: 1, maxLength: 2 }),
            outputFormats: fc.array(fc.constantFrom('powerpoint'), { minLength: 1, maxLength: 1 }),
            qualityCriteria: fc.array(fc.string(), { minLength: 1, maxLength: 3 })
          })
        }),
        async (taskConfig) => {
          const task: AssessmentTask = {
            id: taskConfig.id,
            type: taskConfig.type,
            requirements: taskConfig.requirements,
            workflow: {
              id: `workflow_${taskConfig.id}`,
              name: 'Test Workflow',
              description: 'Test workflow for assessment',
              steps: [],
              metadata: {
                requiredServers: ['nonicatab-mcp'],
                estimatedDuration: 30000
              }
            }
          };

          (assessmentEngine as MCPAssessmentAutomationEngine).registerTask(task);

          // Start assessment execution (don't await to check progress)
          const assessmentPromise = assessmentEngine.executeAssessment(task.id);

          // Allow some time for progress initialization
          await new Promise(resolve => setTimeout(resolve, 10));

          const progress = await assessmentEngine.getAssessmentProgress(task.id);

          // Validate progress structure
          expect(progress).toBeDefined();
          expect(progress.taskId).toBe(task.id);
          expect(progress.phase).toBeDefined();
          expect(['extraction', 'transformation', 'generation', 'validation'].includes(progress.phase)).toBe(true);
          expect(typeof progress.progress).toBe('number');
          expect(progress.progress).toBeGreaterThanOrEqual(0);
          expect(progress.progress).toBeLessThanOrEqual(100);
          expect(progress.currentOperation).toBeDefined();
          expect(typeof progress.currentOperation).toBe('string');
          expect(typeof progress.estimatedTimeRemaining).toBe('number');

          // Wait for assessment to complete
          await assessmentPromise;

          // Final progress should show completion
          const finalProgress = await assessmentEngine.getAssessmentProgress(task.id);
          expect(finalProgress.progress).toBe(100);
          expect(finalProgress.phase).toBe('validation');
        }
      ), { numRuns: 20 });
    });

    it('should provide accurate progress estimates', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: fc.constant('presentation_creation' as const),
          requirements: fc.record({
            sourceApplications: fc.array(fc.constantFrom('revit', 'autocad'), { minLength: 1, maxLength: 2 }),
            dataTypes: fc.array(fc.constantFrom('elements'), { minLength: 1, maxLength: 1 }),
            outputFormats: fc.array(fc.constantFrom('powerpoint'), { minLength: 1, maxLength: 1 }),
            qualityCriteria: fc.array(fc.string(), { minLength: 1, maxLength: 2 })
          })
        }),
        async (taskConfig) => {
          const task: AssessmentTask = {
            id: taskConfig.id,
            type: taskConfig.type,
            requirements: taskConfig.requirements,
            workflow: {
              id: `workflow_${taskConfig.id}`,
              name: 'Test Workflow',
              description: 'Test workflow for assessment',
              steps: [],
              metadata: {
                requiredServers: ['nonicatab-mcp'],
                estimatedDuration: 30000
              }
            }
          };

          (assessmentEngine as MCPAssessmentAutomationEngine).registerTask(task);

          const result = await assessmentEngine.executeAssessment(task.id);

          // Validate metrics calculation
          expect(result.metrics).toBeDefined();
          expect(typeof result.metrics.executionTime).toBe('number');
          expect(result.metrics.executionTime).toBeGreaterThanOrEqual(0);
          expect(typeof result.metrics.dataPointsProcessed).toBe('number');
          expect(result.metrics.dataPointsProcessed).toBeGreaterThanOrEqual(0);
          expect(typeof result.metrics.completenessScore).toBe('number');
          expect(result.metrics.completenessScore).toBeGreaterThanOrEqual(0);
          expect(result.metrics.completenessScore).toBeLessThanOrEqual(100);

          // Accuracy score should be present if defined
          if ('accuracyScore' in result.metrics) {
            expect(typeof result.metrics.accuracyScore).toBe('number');
            expect(result.metrics.accuracyScore).toBeGreaterThanOrEqual(0);
            expect(result.metrics.accuracyScore).toBeLessThanOrEqual(100);
          }
        }
      ), { numRuns: 25 });
    });
  });
});