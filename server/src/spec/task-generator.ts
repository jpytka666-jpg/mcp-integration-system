/**
 * Task list generator for spec workflow
 */

import { DesignDocument, RequirementDocument, Task, TaskDocument, TaskGeneratorOptions, TaskValidationResult, ValidationError } from './types.js';

export class TaskGenerator {
  /**
   * Generate task list from design and requirements documents
   */
  generateTaskList(options: TaskGeneratorOptions): TaskDocument {
    const { featureName, designDocument, requirementsDocument } = options;
    
    const tasks = this.createTasksFromDesign(designDocument, requirementsDocument, options);
    
    return {
      featureName,
      tasks,
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        totalTasks: this.countTotalTasks(tasks),
        completedTasks: 0,
        inProgressTasks: 0
      }
    };
  }

  /**
   * Generate markdown format task list with checkboxes
   */
  generateMarkdown(taskDocument: TaskDocument): string {
    let markdown = `# Implementation Plan\n\n`;
    
    for (const task of taskDocument.tasks) {
      markdown += this.formatTaskAsMarkdown(task, 0);
    }
    
    return markdown;
  }

  /**
   * Validate task list against requirements
   */
  validateTasks(taskDocument: TaskDocument, requirements: RequirementDocument): TaskValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const orphanedTasks: string[] = [];
    const missingRequirements: string[] = [];

    // Check all tasks reference valid requirements
    for (const task of taskDocument.tasks) {
      this.validateTaskRequirements(task, requirements, errors, orphanedTasks);
    }

    // Check all requirements are covered by tasks
    const coveredRequirements = new Set<string>();
    this.collectCoveredRequirements(taskDocument.tasks, coveredRequirements);
    
    for (const req of requirements.requirements) {
      if (!coveredRequirements.has(req.id)) {
        missingRequirements.push(req.id);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      orphanedTasks,
      missingRequirements
    };
  }

  private createTasksFromDesign(design: DesignDocument, requirements: RequirementDocument, options: TaskGeneratorOptions): Task[] {
    const tasks: Task[] = [];
    let taskCounter = 1;

    // Core implementation tasks based on design components
    tasks.push({
      id: `${taskCounter}`,
      title: 'Set up project structure and core interfaces',
      description: 'Create directory structure and define system boundaries',
      status: 'not_started',
      level: 0,
      subtasks: [
        {
          id: `${taskCounter}.1`,
          title: 'Create core data model interfaces and types',
          description: 'Define TypeScript interfaces for all data models',
          status: 'not_started',
          level: 1,
          parentId: `${taskCounter}`,
          subtasks: [],
          requirements: this.extractRelevantRequirements(requirements, ['data', 'model', 'interface']),
          optional: false,
          details: ['Write TypeScript interfaces for all data models', 'Implement validation functions for data integrity']
        }
      ],
      requirements: ['1.1'],
      optional: false,
      details: ['Create directory structure for models, services, repositories, and API components', 'Define interfaces that establish system boundaries', 'Set up testing framework']
    });

    taskCounter++;

    // Add component implementation tasks
    for (const component of design.components) {
      tasks.push({
        id: `${taskCounter}`,
        title: `Implement ${component.name}`,
        description: component.description,
        status: 'not_started',
        level: 0,
        subtasks: this.createComponentSubtasks(component, taskCounter, requirements, options),
        requirements: this.extractRelevantRequirements(requirements, [component.name.toLowerCase()]),
        optional: false,
        details: component.responsibilities
      });
      taskCounter++;
    }

    // Add testing tasks if comprehensive strategy
    if (options.testingStrategy === 'comprehensive') {
      tasks.push({
        id: `${taskCounter}`,
        title: 'Implement comprehensive test suite',
        description: 'Create unit tests and property-based tests for all components',
        status: 'not_started',
        level: 0,
        subtasks: this.createTestingSubtasks(design, taskCounter, requirements),
        requirements: [],
        optional: options.includeOptionalTasks ? false : true,
        details: ['Write unit tests for all functions and classes', 'Implement property-based tests for correctness properties', 'Create integration tests for component interactions']
      });
      taskCounter++;
    }

    // Add final checkpoint
    tasks.push({
      id: `${taskCounter}`,
      title: 'Final checkpoint - Ensure all tests pass',
      description: 'Ensure all tests pass, ask the user if questions arise',
      status: 'not_started',
      level: 0,
      subtasks: [],
      requirements: [],
      optional: false,
      details: ['Run all tests and verify they pass', 'Address any failing tests', 'Confirm implementation meets all requirements']
    });

    return tasks;
  }

  private createComponentSubtasks(component: any, parentId: number, requirements: RequirementDocument, options: TaskGeneratorOptions): Task[] {
    const subtasks: Task[] = [];
    let subCounter = 1;

    // Implementation subtask
    subtasks.push({
      id: `${parentId}.${subCounter}`,
      title: `Create ${component.name} implementation`,
      description: `Implement core ${component.name} functionality`,
      status: 'not_started',
      level: 1,
      parentId: `${parentId}`,
      subtasks: [],
      requirements: this.extractRelevantRequirements(requirements, [component.name.toLowerCase()]),
      optional: false,
      details: component.responsibilities
    });
    subCounter++;

    // Testing subtask (always add as optional when includeOptionalTasks is false)
    subtasks.push({
      id: `${parentId}.${subCounter}`,
      title: `Write tests for ${component.name}`,
      description: `Create unit and integration tests for ${component.name}`,
      status: 'not_started',
      level: 1,
      parentId: `${parentId}`,
      subtasks: [],
      requirements: [],
      optional: !options.includeOptionalTasks,
      details: [`Write unit tests for ${component.name} methods`, `Test error handling and edge cases`]
    });

    return subtasks;
  }

  private createTestingSubtasks(design: DesignDocument, parentId: number, requirements: RequirementDocument): Task[] {
    const subtasks: Task[] = [];
    let subCounter = 1;

    // Property-based tests for correctness properties
    for (const property of design.correctnessProperties) {
      subtasks.push({
        id: `${parentId}.${subCounter}`,
        title: `Write property test for ${property.name}`,
        description: `Implement property-based test for: ${property.description}`,
        status: 'not_started',
        level: 1,
        parentId: `${parentId}`,
        subtasks: [],
        requirements: property.validatesRequirements,
        optional: true,
        details: [`**Property ${property.id}: ${property.description}**`, `**Validates: Requirements ${property.validatesRequirements.join(', ')}**`]
      });
      subCounter++;
    }

    return subtasks;
  }

  private extractRelevantRequirements(requirements: RequirementDocument, keywords: string[]): string[] {
    const relevant: string[] = [];
    
    for (const req of requirements.requirements) {
      const text = `${req.userStory.feature} ${req.userStory.benefit}`.toLowerCase();
      if (keywords.some(keyword => text.includes(keyword))) {
        relevant.push(req.id);
      }
    }
    
    return relevant;
  }

  private formatTaskAsMarkdown(task: Task, depth: number): string {
    const indent = '  '.repeat(depth);
    const checkbox = task.status === 'completed' ? '[x]' : 
                    task.status === 'in_progress' ? '[-]' : '[ ]';
    const optional = task.optional ? '*' : '';
    
    let markdown = `${indent}- ${checkbox}${optional} ${task.id}. ${task.title}\n`;
    
    if (task.details.length > 0) {
      for (const detail of task.details) {
        markdown += `${indent}  - ${detail}\n`;
      }
    }
    
    if (task.requirements.length > 0) {
      markdown += `${indent}  - _Requirements: ${task.requirements.join(', ')}_\n`;
    }
    
    markdown += '\n';
    
    // Add subtasks
    for (const subtask of task.subtasks) {
      markdown += this.formatTaskAsMarkdown(subtask, depth + 1);
    }
    
    return markdown;
  }

  private validateTaskRequirements(task: Task, requirements: RequirementDocument, errors: ValidationError[], orphanedTasks: string[]): void {
    for (const reqId of task.requirements) {
      const exists = requirements.requirements.some(req => req.id === reqId);
      if (!exists) {
        errors.push({
          path: `task.${task.id}`,
          message: `Task references non-existent requirement: ${reqId}`,
          code: 'INVALID_REQUIREMENT_REFERENCE'
        });
        orphanedTasks.push(task.id);
      }
    }

    // Validate subtasks recursively
    for (const subtask of task.subtasks) {
      this.validateTaskRequirements(subtask, requirements, errors, orphanedTasks);
    }
  }

  private collectCoveredRequirements(tasks: Task[], covered: Set<string>): void {
    for (const task of tasks) {
      for (const reqId of task.requirements) {
        covered.add(reqId);
      }
      this.collectCoveredRequirements(task.subtasks, covered);
    }
  }

  private countTotalTasks(tasks: Task[]): number {
    let count = tasks.length;
    for (const task of tasks) {
      count += this.countTotalTasks(task.subtasks);
    }
    return count;
  }
}