/**
 * Task execution tracking and isolation system
 */

import { TaskStatus, TaskProgress, TaskTracker, TaskExecutionContext, TaskDocument } from './types.js';

export class TaskExecutionTracker implements TaskTracker {
  private taskStatuses: Map<string, TaskStatus> = new Map();
  private taskDocument: TaskDocument;
  private isolationMode: boolean;

  constructor(taskDocument: TaskDocument, isolationMode: boolean = true) {
    this.taskDocument = taskDocument;
    this.isolationMode = isolationMode;
    this.initializeTaskStatuses();
  }

  /**
   * Update task status and handle isolation rules
   */
  updateStatus(taskId: string, status: TaskStatus): void {
    if (this.isolationMode && !this.canUpdateTask(taskId, status)) {
      throw new Error(`Cannot update task ${taskId} to ${status}: isolation rules violated`);
    }

    this.taskStatuses.set(taskId, status);
    this.updateTaskDocument(taskId, status);
    
    // Update parent task status if all subtasks are complete
    const task = this.findTask(taskId);
    if (task?.parentId) {
      this.updateParentTaskIfNeeded(task.parentId);
    }
  }

  /**
   * Get current status of a task
   */
  getTaskStatus(taskId: string): TaskStatus {
    return this.taskStatuses.get(taskId) || 'not_started';
  }

  /**
   * Get overall progress statistics
   */
  getProgress(): TaskProgress {
    const total = this.taskStatuses.size;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;

    for (const status of this.taskStatuses.values()) {
      switch (status) {
        case 'completed':
          completed++;
          break;
        case 'in_progress':
          inProgress++;
          break;
        case 'not_started':
          notStarted++;
          break;
      }
    }

    return {
      total,
      completed,
      inProgress,
      notStarted,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  /**
   * Validate that a task can be marked as complete
   */
  validateTaskCompletion(taskId: string): boolean {
    const task = this.findTask(taskId);
    if (!task) return false;

    // Check if all subtasks are completed
    for (const subtask of task.subtasks) {
      if (this.getTaskStatus(subtask.id) !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Get next recommended task based on dependencies and current progress
   */
  getNextTask(): string | null {
    // Find first non-completed task that has all dependencies met
    for (const task of this.getAllTasks()) {
      const status = this.getTaskStatus(task.id);
      if (status === 'not_started' && this.areDependenciesMet(task.id)) {
        return task.id;
      }
    }
    return null;
  }

  /**
   * Create execution context for task isolation
   */
  createExecutionContext(taskId: string, workspaceRoot: string): TaskExecutionContext {
    return {
      taskId,
      featureName: this.taskDocument.featureName,
      workspaceRoot,
      isolationMode: this.isolationMode
    };
  }

  /**
   * Check if task execution should be isolated (one task at a time)
   */
  enforceTaskIsolation(): boolean {
    if (!this.isolationMode) return true;

    const inProgressTasks = Array.from(this.taskStatuses.entries())
      .filter(([_, status]) => status === 'in_progress')
      .map(([taskId, _]) => taskId);

    return inProgressTasks.length <= 1;
  }

  private initializeTaskStatuses(): void {
    for (const task of this.getAllTasks()) {
      this.taskStatuses.set(task.id, task.status);
    }
  }

  private getAllTasks(): any[] {
    const allTasks: any[] = [];
    
    const collectTasks = (tasks: any[]) => {
      for (const task of tasks) {
        allTasks.push(task);
        collectTasks(task.subtasks);
      }
    };
    
    collectTasks(this.taskDocument.tasks);
    return allTasks;
  }

  private findTask(taskId: string): any | null {
    const findInTasks = (tasks: any[]): any | null => {
      for (const task of tasks) {
        if (task.id === taskId) return task;
        const found = findInTasks(task.subtasks);
        if (found) return found;
      }
      return null;
    };
    
    return findInTasks(this.taskDocument.tasks);
  }

  private canUpdateTask(taskId: string, newStatus: TaskStatus): boolean {
    // In isolation mode, only one task can be in progress at a time
    if (newStatus === 'in_progress') {
      const currentInProgress = Array.from(this.taskStatuses.entries())
        .filter(([id, status]) => id !== taskId && status === 'in_progress');
      
      if (currentInProgress.length > 0) {
        return false;
      }
    }

    // Check if dependencies are met
    if (newStatus === 'in_progress' || newStatus === 'completed') {
      return this.areDependenciesMet(taskId);
    }

    return true;
  }

  private areDependenciesMet(taskId: string): boolean {
    const task = this.findTask(taskId);
    if (!task) return false;

    // For subtasks, parent must be in progress or completed
    if (task.parentId) {
      const parentStatus = this.getTaskStatus(task.parentId);
      if (parentStatus === 'not_started') {
        return false;
      }
    }

    return true;
  }

  private updateParentTaskIfNeeded(parentId: string): void {
    const parentTask = this.findTask(parentId);
    if (!parentTask) return;

    const allSubtasksCompleted = parentTask.subtasks.every((subtask: any) => 
      this.getTaskStatus(subtask.id) === 'completed'
    );

    if (allSubtasksCompleted && this.getTaskStatus(parentId) !== 'completed') {
      this.taskStatuses.set(parentId, 'completed');
      this.updateTaskDocument(parentId, 'completed');
    }
  }

  private updateTaskDocument(taskId: string, status: TaskStatus): void {
    const updateInTasks = (tasks: any[]) => {
      for (const task of tasks) {
        if (task.id === taskId) {
          task.status = status;
          return true;
        }
        if (updateInTasks(task.subtasks)) {
          return true;
        }
      }
      return false;
    };

    updateInTasks(this.taskDocument.tasks);
    this.taskDocument.metadata.lastModified = new Date();
    
    // Update progress counters
    const progress = this.getProgress();
    this.taskDocument.metadata.completedTasks = progress.completed;
    this.taskDocument.metadata.inProgressTasks = progress.inProgress;
  }
}

/**
 * Utility functions for task management
 */
export class TaskUtils {
  /**
   * Parse task markdown to extract task information
   */
  static parseTaskFromMarkdown(line: string): { id: string; title: string; status: TaskStatus; optional: boolean } | null {
    const taskRegex = /^(\s*)-\s*\[([x\-\s])\](\*)?\s*(\d+(?:\.\d+)?)\.\s*(.+)$/;
    const match = line.match(taskRegex);
    
    if (!match) return null;
    
    const [, , statusChar, optionalMarker, id, fullTitle] = match;
    
    let status: TaskStatus = 'not_started';
    if (statusChar === 'x') status = 'completed';
    else if (statusChar === '-') status = 'in_progress';
    
    return {
      id,
      title: fullTitle.trim(),
      status,
      optional: !!optionalMarker
    };
  }

  /**
   * Update task status in markdown content
   */
  static updateTaskStatusInMarkdown(content: string, taskId: string, newStatus: TaskStatus): string {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const taskInfo = this.parseTaskFromMarkdown(lines[i]);
      if (taskInfo && taskInfo.id === taskId) {
        const statusChar = newStatus === 'completed' ? 'x' : 
                          newStatus === 'in_progress' ? '-' : ' ';
        
        lines[i] = lines[i].replace(/\[([x\-\s])\]/, `[${statusChar}]`);
        break;
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Extract requirement references from task details
   */
  static extractRequirementReferences(details: string[]): string[] {
    const requirements: string[] = [];
    
    for (const detail of details) {
      const match = detail.match(/_Requirements:\s*([^_]+)_/);
      if (match) {
        const reqIds = match[1].split(',').map(id => id.trim());
        requirements.push(...reqIds);
      }
    }
    
    return requirements;
  }
}