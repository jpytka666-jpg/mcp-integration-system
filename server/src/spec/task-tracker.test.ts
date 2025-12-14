/**
 * Tests for task execution tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskExecutionTracker, TaskUtils } from './task-tracker.js';
import { TaskDocument, TaskStatus } from './types.js';

describe('TaskExecutionTracker', () => {
  let tracker: TaskExecutionTracker;
  let mockTaskDocument: TaskDocument;

  beforeEach(() => {
    mockTaskDocument = {
      featureName: 'test-feature',
      tasks: [
        {
          id: '1',
          title: 'Setup task',
          description: 'Setup project',
          status: 'not_started',
          level: 0,
          subtasks: [
            {
              id: '1.1',
              title: 'Create interfaces',
              description: 'Create core interfaces',
              status: 'not_started',
              level: 1,
              parentId: '1',
              subtasks: [],
              requirements: ['1.1'],
              optional: false,
              details: []
            }
          ],
          requirements: ['1.1'],
          optional: false,
          details: []
        },
        {
          id: '2',
          title: 'Implementation task',
          description: 'Implement features',
          status: 'not_started',
          level: 0,
          subtasks: [],
          requirements: ['2.1'],
          optional: false,
          details: []
        }
      ],
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        totalTasks: 3,
        completedTasks: 0,
        inProgressTasks: 0
      }
    };

    tracker = new TaskExecutionTracker(mockTaskDocument, true);
  });

  describe('updateStatus', () => {
    it('should update task status successfully', () => {
      tracker.updateStatus('1', 'in_progress');
      
      expect(tracker.getTaskStatus('1')).toBe('in_progress');
    });

    it('should enforce isolation mode - only one task in progress', () => {
      tracker.updateStatus('1', 'in_progress');
      
      expect(() => {
        tracker.updateStatus('2', 'in_progress');
      }).toThrow('isolation rules violated');
    });

    it('should allow multiple tasks in progress when isolation is disabled', () => {
      const nonIsolatedTracker = new TaskExecutionTracker(mockTaskDocument, false);
      
      nonIsolatedTracker.updateStatus('1', 'in_progress');
      nonIsolatedTracker.updateStatus('2', 'in_progress');
      
      expect(nonIsolatedTracker.getTaskStatus('1')).toBe('in_progress');
      expect(nonIsolatedTracker.getTaskStatus('2')).toBe('in_progress');
    });

    it('should auto-complete parent task when all subtasks are done', () => {
      tracker.updateStatus('1', 'in_progress');
      tracker.updateStatus('1.1', 'completed');
      
      expect(tracker.getTaskStatus('1')).toBe('completed');
    });
  });

  describe('getProgress', () => {
    it('should calculate progress correctly', () => {
      tracker.updateStatus('1', 'in_progress');
      tracker.updateStatus('1.1', 'completed');
      tracker.updateStatus('2', 'in_progress');
      
      const progress = tracker.getProgress();
      
      expect(progress.total).toBe(3);
      expect(progress.completed).toBe(2); // 1.1 completed, 1 auto-completed
      expect(progress.inProgress).toBe(1); // 2 in progress
      expect(progress.notStarted).toBe(0);
      expect(progress.percentage).toBe(67); // 2/3 * 100, rounded
    });
  });

  describe('validateTaskCompletion', () => {
    it('should validate task can be completed when subtasks are done', () => {
      tracker.updateStatus('1', 'in_progress');
      tracker.updateStatus('1.1', 'completed');
      
      expect(tracker.validateTaskCompletion('1')).toBe(true);
    });

    it('should prevent completion when subtasks are not done', () => {
      expect(tracker.validateTaskCompletion('1')).toBe(false);
    });

    it('should allow completion for tasks without subtasks', () => {
      expect(tracker.validateTaskCompletion('2')).toBe(true);
    });
  });

  describe('getNextTask', () => {
    it('should recommend first available task', () => {
      const nextTask = tracker.getNextTask();
      
      expect(nextTask).toBe('1');
    });

    it('should recommend next task after completing previous', () => {
      tracker.updateStatus('1', 'in_progress');
      tracker.updateStatus('1.1', 'completed');
      
      const nextTask = tracker.getNextTask();
      
      expect(nextTask).toBe('2');
    });

    it('should return null when all tasks are completed', () => {
      tracker.updateStatus('1', 'in_progress');
      tracker.updateStatus('1.1', 'completed');
      tracker.updateStatus('2', 'completed');
      
      const nextTask = tracker.getNextTask();
      
      expect(nextTask).toBeNull();
    });
  });

  describe('enforceTaskIsolation', () => {
    it('should return true when no tasks are in progress', () => {
      expect(tracker.enforceTaskIsolation()).toBe(true);
    });

    it('should return true when only one task is in progress', () => {
      tracker.updateStatus('1', 'in_progress');
      
      expect(tracker.enforceTaskIsolation()).toBe(true);
    });

    it('should return true for non-isolated tracker', () => {
      const nonIsolatedTracker = new TaskExecutionTracker(mockTaskDocument, false);
      
      expect(nonIsolatedTracker.enforceTaskIsolation()).toBe(true);
    });
  });
});

describe('TaskUtils', () => {
  describe('parseTaskFromMarkdown', () => {
    it('should parse completed task correctly', () => {
      const line = '- [x] 1.1. Create interfaces';
      const result = TaskUtils.parseTaskFromMarkdown(line);
      
      expect(result).toEqual({
        id: '1.1',
        title: 'Create interfaces',
        status: 'completed',
        optional: false
      });
    });

    it('should parse in-progress task correctly', () => {
      const line = '  - [-] 2.1. Implement feature';
      const result = TaskUtils.parseTaskFromMarkdown(line);
      
      expect(result).toEqual({
        id: '2.1',
        title: 'Implement feature',
        status: 'in_progress',
        optional: false
      });
    });

    it('should parse optional task correctly', () => {
      const line = '- [ ]* 3.1. Write tests';
      const result = TaskUtils.parseTaskFromMarkdown(line);
      
      expect(result).toEqual({
        id: '3.1',
        title: 'Write tests',
        status: 'not_started',
        optional: true
      });
    });

    it('should return null for invalid format', () => {
      const line = 'Invalid task format';
      const result = TaskUtils.parseTaskFromMarkdown(line);
      
      expect(result).toBeNull();
    });
  });

  describe('updateTaskStatusInMarkdown', () => {
    it('should update task status in markdown', () => {
      const content = `# Tasks
- [ ] 1. First task
- [ ] 2. Second task`;
      
      const updated = TaskUtils.updateTaskStatusInMarkdown(content, '1', 'completed');
      
      expect(updated).toContain('- [x] 1. First task');
      expect(updated).toContain('- [ ] 2. Second task');
    });

    it('should update in-progress status', () => {
      const content = '- [ ] 1.1. Subtask';
      
      const updated = TaskUtils.updateTaskStatusInMarkdown(content, '1.1', 'in_progress');
      
      expect(updated).toContain('- [-] 1.1. Subtask');
    });
  });

  describe('extractRequirementReferences', () => {
    it('should extract requirement references from details', () => {
      const details = [
        'Implement core functionality',
        '_Requirements: 1.1, 2.3_',
        'Add error handling'
      ];
      
      const requirements = TaskUtils.extractRequirementReferences(details);
      
      expect(requirements).toEqual(['1.1', '2.3']);
    });

    it('should return empty array when no requirements found', () => {
      const details = ['No requirements here'];
      
      const requirements = TaskUtils.extractRequirementReferences(details);
      
      expect(requirements).toEqual([]);
    });
  });
});