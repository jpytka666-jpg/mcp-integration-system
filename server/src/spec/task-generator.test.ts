/**
 * Tests for task generator functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskGenerator } from './task-generator.js';
import { DesignDocument, RequirementDocument, TaskGeneratorOptions } from './types.js';

describe('TaskGenerator', () => {
  let generator: TaskGenerator;
  let mockRequirements: RequirementDocument;
  let mockDesign: DesignDocument;
  let options: TaskGeneratorOptions;

  beforeEach(() => {
    generator = new TaskGenerator();
    
    mockRequirements = {
      introduction: 'Test requirements',
      glossary: [],
      requirements: [
        {
          id: '1.1',
          userStory: {
            role: 'developer',
            feature: 'task management',
            benefit: 'organized development'
          },
          acceptanceCriteria: [
            {
              id: '1.1.1',
              pattern: 'event-driven',
              system: 'TaskSystem',
              response: 'create new task',
              trigger: 'user creates task'
            }
          ]
        }
      ]
    };

    mockDesign = {
      overview: 'Test design',
      architecture: 'Layered architecture',
      components: [
        {
          name: 'TaskManager',
          description: 'Manages task operations',
          interfaces: ['ITaskManager'],
          responsibilities: ['Create tasks', 'Update task status']
        }
      ],
      dataModels: [],
      correctnessProperties: [
        {
          id: '1',
          name: 'Task creation consistency',
          description: 'For any valid task data, creating a task should result in a task that can be retrieved',
          validatesRequirements: ['1.1'],
          propertyType: 'round-trip'
        }
      ],
      errorHandling: 'Comprehensive error handling',
      testingStrategy: 'Unit and property-based testing'
    };

    options = {
      featureName: 'test-feature',
      designDocument: mockDesign,
      requirementsDocument: mockRequirements,
      includeOptionalTasks: false,
      testingStrategy: 'minimal'
    };
  });

  describe('generateTaskList', () => {
    it('should generate task list with proper structure', () => {
      const result = generator.generateTaskList(options);
      
      expect(result.featureName).toBe('test-feature');
      expect(result.tasks).toHaveLength(3); // Setup, component implementation, checkpoint
      expect(result.metadata.totalTasks).toBeGreaterThan(0);
    });

    it('should create tasks with proper hierarchy', () => {
      const result = generator.generateTaskList(options);
      
      const setupTask = result.tasks[0];
      expect(setupTask.level).toBe(0);
      expect(setupTask.subtasks.length).toBeGreaterThan(0);
      expect(setupTask.subtasks[0].level).toBe(1);
      expect(setupTask.subtasks[0].parentId).toBe(setupTask.id);
    });

    it('should include component implementation tasks', () => {
      const result = generator.generateTaskList(options);
      
      const componentTask = result.tasks.find(t => t.title.includes('TaskManager'));
      expect(componentTask).toBeDefined();
      expect(componentTask?.description).toBe('Manages task operations');
    });

    it('should mark testing tasks as optional when includeOptionalTasks is false', () => {
      const result = generator.generateTaskList(options);
      
      const hasOptionalTasks = result.tasks.some(task => 
        task.subtasks.some(subtask => subtask.optional && subtask.title.includes('test'))
      );
      expect(hasOptionalTasks).toBe(true);
    });
  });

  describe('generateMarkdown', () => {
    it('should generate proper markdown format', () => {
      const taskDoc = generator.generateTaskList(options);
      const markdown = generator.generateMarkdown(taskDoc);
      
      expect(markdown).toContain('# Implementation Plan');
      expect(markdown).toContain('- [ ] 1.');
      expect(markdown).toContain('  - [ ] 1.1');
      expect(markdown).toContain('_Requirements:');
    });

    it('should mark optional tasks with asterisk', () => {
      const taskDoc = generator.generateTaskList({
        ...options,
        includeOptionalTasks: true,
        testingStrategy: 'comprehensive'
      });
      const markdown = generator.generateMarkdown(taskDoc);
      
      expect(markdown).toContain('[ ]*');
    });

    it('should show different checkbox states', () => {
      const taskDoc = generator.generateTaskList(options);
      taskDoc.tasks[0].status = 'completed';
      taskDoc.tasks[1].status = 'in_progress';
      
      const markdown = generator.generateMarkdown(taskDoc);
      
      expect(markdown).toContain('[x]');
      expect(markdown).toContain('[-]');
      expect(markdown).toContain('[ ]');
    });
  });

  describe('validateTasks', () => {
    it('should validate task requirements successfully', () => {
      const taskDoc = generator.generateTaskList(options);
      const result = generator.validateTasks(taskDoc, mockRequirements);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect orphaned tasks with invalid requirement references', () => {
      const taskDoc = generator.generateTaskList(options);
      taskDoc.tasks[0].requirements = ['invalid-req'];
      
      const result = generator.validateTasks(taskDoc, mockRequirements);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.orphanedTasks).toContain('1');
    });

    it('should detect missing requirement coverage', () => {
      const extendedRequirements = {
        ...mockRequirements,
        requirements: [
          ...mockRequirements.requirements,
          {
            id: '2.1',
            userStory: {
              role: 'user',
              feature: 'uncovered feature',
              benefit: 'some benefit'
            },
            acceptanceCriteria: []
          }
        ]
      };
      
      const taskDoc = generator.generateTaskList(options);
      const result = generator.validateTasks(taskDoc, extendedRequirements);
      
      expect(result.missingRequirements).toContain('2.1');
    });
  });
});