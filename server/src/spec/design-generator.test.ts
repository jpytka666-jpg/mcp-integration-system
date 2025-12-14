import { describe, it, expect } from 'vitest';
import { DesignGenerator } from './design-generator.js';
import { RequirementDocument, DesignDocument, DesignGeneratorOptions, UserApprovalGate } from './types.js';

// Simple test approval gate
class TestApprovalGate implements UserApprovalGate {
  private status: 'pending' | 'approved' | 'rejected' = 'pending';
  
  constructor(private autoApprove: boolean = true) {}

  async requestApproval(): Promise<boolean> {
    this.status = this.autoApprove ? 'approved' : 'rejected';
    return this.autoApprove;
  }

  getApprovalStatus(): 'pending' | 'approved' | 'rejected' {
    return this.status;
  }
}

describe('DesignGenerator', () => {
  const mockRequirements: RequirementDocument = {
    introduction: 'A test system for managing user tasks',
    glossary: [
      { term: 'Task', definition: 'A unit of work to be completed' }
    ],
    requirements: [
      {
        id: '1',
        userStory: {
          role: 'user',
          feature: 'add tasks to my list',
          benefit: 'I can track what needs to be done'
        },
        acceptanceCriteria: [
          {
            id: '1.1',
            pattern: 'event-driven',
            system: 'Task System',
            response: 'create a new task and add it to the list',
            trigger: 'user submits a task description'
          }
        ]
      }
    ]
  };

  it('should generate a design template', () => {
    const generator = new DesignGenerator();
    const options: DesignGeneratorOptions = {
      featureName: 'TaskManager',
      requirementsDocument: mockRequirements,
      includeArchitectureDiagram: true,
      testingFramework: 'vitest'
    };

    const result = generator.generateTemplate(options);

    expect(result).toBeDefined();
    expect(result.overview).toContain('TaskManager');
    expect(result.architecture).toContain('layered architecture');
    expect(result.components.length).toBeGreaterThan(0);
    expect(result.dataModels.length).toBeGreaterThan(0);
    expect(result.correctnessProperties.length).toBeGreaterThan(0);
    expect(result.errorHandling).toContain('Input Validation');
    expect(result.testingStrategy).toContain('vitest');
  });

  it('should validate design documents', () => {
    const generator = new DesignGenerator();
    const completeDocument: DesignDocument = {
      overview: 'Complete overview',
      architecture: 'Complete architecture',
      components: [{
        name: 'TaskManager',
        description: 'Manages tasks',
        interfaces: ['ITaskManager'],
        responsibilities: ['Create tasks']
      }],
      dataModels: [{
        name: 'Task',
        description: 'Task model',
        structure: 'interface Task { id: string; }',
        relationships: []
      }],
      correctnessProperties: [{
        id: '1',
        name: 'Task Creation',
        description: 'task creation behavior',
        validatesRequirements: ['1.1'],
        propertyType: 'invariant'
      }],
      errorHandling: 'Complete error handling',
      testingStrategy: 'Complete testing strategy with property-based testing'
    };

    const result = generator.validateDocument(completeDocument);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should generate markdown format', () => {
    const generator = new DesignGenerator();
    const document: DesignDocument = {
      overview: 'System overview',
      architecture: 'System architecture',
      components: [{
        name: 'TaskManager',
        description: 'Manages tasks',
        interfaces: ['ITaskManager'],
        responsibilities: ['Create tasks']
      }],
      dataModels: [{
        name: 'Task',
        description: 'Task data model',
        structure: 'interface Task { id: string; }',
        relationships: []
      }],
      correctnessProperties: [{
        id: '1',
        name: 'Task Creation',
        description: 'task creation preserves list integrity',
        validatesRequirements: ['1.1'],
        propertyType: 'invariant'
      }],
      errorHandling: 'Error handling approach',
      testingStrategy: 'Testing approach'
    };

    const markdown = generator.generateMarkdown(document);
    
    expect(markdown).toContain('# Design Document');
    expect(markdown).toContain('## Overview');
    expect(markdown).toContain('## Architecture');
    expect(markdown).toContain('## Components and Interfaces');
    expect(markdown).toContain('### TaskManager');
    expect(markdown).toContain('## Data Models');
    expect(markdown).toContain('### Task');
    expect(markdown).toContain('## Correctness Properties');
    expect(markdown).toContain('### Property 1: Task Creation');
    expect(markdown).toContain('**Validates: Requirements 1.1**');
  });

  it('should handle approval workflow', async () => {
    const generator = new DesignGenerator();
    const approvalGate = new TestApprovalGate(true);
    generator.setApprovalGate(approvalGate);

    const document: DesignDocument = {
      overview: 'Overview',
      architecture: 'Architecture',
      components: [{
        name: 'Component',
        description: 'Description',
        interfaces: [],
        responsibilities: []
      }],
      dataModels: [{
        name: 'Model',
        description: 'Description',
        structure: 'interface Model {}',
        relationships: []
      }],
      correctnessProperties: [{
        id: '1',
        name: 'Property',
        description: 'description',
        validatesRequirements: ['1.1'],
        propertyType: 'invariant'
      }],
      errorHandling: 'Error handling',
      testingStrategy: 'Testing strategy with property-based testing'
    };

    const result = await generator.processWithApproval(document);
    expect(result.approved).toBe(true);
    expect(approvalGate.getApprovalStatus()).toBe('approved');
  });

  it('should detect changes requiring approval', () => {
    const generator = new DesignGenerator();
    
    const baseDocument: DesignDocument = {
      overview: 'Original overview',
      architecture: 'Original architecture',
      components: [{ name: 'Component1', description: 'Desc', interfaces: [], responsibilities: [] }],
      dataModels: [{ name: 'Model1', description: 'Desc', structure: 'struct', relationships: [] }],
      correctnessProperties: [{ id: '1', name: 'Prop1', description: 'desc', validatesRequirements: ['1.1'], propertyType: 'invariant' }],
      errorHandling: 'Error handling',
      testingStrategy: 'Testing strategy'
    };

    const updatedDocument = { ...baseDocument, overview: 'Updated overview' };
    expect(generator.requiresApproval(baseDocument, updatedDocument)).toBe(true);

    const minorUpdate = { ...baseDocument, errorHandling: 'Updated error handling' };
    expect(generator.requiresApproval(baseDocument, minorUpdate)).toBe(false);
  });

  it('should create and manage design files', () => {
    const generator = new DesignGenerator();
    const testBasePath = './test-temp';
    
    const document: DesignDocument = {
      overview: 'Test overview',
      architecture: 'Test architecture',
      components: [{
        name: 'TestComponent',
        description: 'Test component description',
        interfaces: ['ITestComponent'],
        responsibilities: ['Test responsibility']
      }],
      dataModels: [{
        name: 'TestModel',
        description: 'Test model description',
        structure: 'interface TestModel { id: string; }',
        relationships: ['Related to TestComponent']
      }],
      correctnessProperties: [{
        id: '1',
        name: 'Test Property',
        description: 'test behavior validation',
        validatesRequirements: ['1.1'],
        propertyType: 'invariant'
      }],
      errorHandling: 'Test error handling',
      testingStrategy: 'Test strategy with property-based testing'
    };

    // Test file creation
    const filePath = generator.createDesignFile('test-feature', document, testBasePath);
    expect(filePath).toContain('design.md');
    expect(generator.designFileExists('test-feature', testBasePath)).toBe(true);

    // Test file loading
    const loadedDocument = generator.loadDesignFile('test-feature', testBasePath);
    expect(loadedDocument).toBeDefined();
    expect(loadedDocument?.overview).toBe('Test overview');
    expect(loadedDocument?.components).toHaveLength(1);
    expect(loadedDocument?.components[0].name).toBe('TestComponent');

    // Cleanup
    try {
      const fs = require('fs');
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });
});