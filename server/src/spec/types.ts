/**
 * Types for spec workflow engine
 */

export interface RequirementDocument {
  introduction: string;
  glossary: GlossaryEntry[];
  requirements: Requirement[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface Requirement {
  id: string;
  userStory: UserStory;
  acceptanceCriteria: AcceptanceCriterion[];
}

export interface UserStory {
  role: string;
  feature: string;
  benefit: string;
}

export interface AcceptanceCriterion {
  id: string;
  pattern: EARSPattern;
  system: string;
  response: string;
  trigger?: string;
  condition?: string;
  option?: string;
}

export type EARSPattern = 
  | 'ubiquitous'      // THE <system> SHALL <response>
  | 'event-driven'    // WHEN <trigger>, THE <system> SHALL <response>
  | 'state-driven'    // WHILE <condition>, THE <system> SHALL <response>
  | 'unwanted-event'  // IF <condition>, THEN THE <system> SHALL <response>
  | 'optional'        // WHERE <option>, THE <system> SHALL <response>
  | 'complex';        // [WHERE] [WHILE] [WHEN/IF] THE <system> SHALL <response>

export interface RequirementValidationResult {
  valid: boolean;
  errors: RequirementValidationError[];
  warnings: RequirementValidationWarning[];
}

export interface RequirementValidationError {
  requirementId: string;
  criterionId?: string;
  message: string;
  code: 'INVALID_EARS_PATTERN' | 'MISSING_SYSTEM' | 'VAGUE_TERMS' | 'ESCAPE_CLAUSE' | 'NEGATIVE_STATEMENT' | 'MULTIPLE_THOUGHTS' | 'PRONOUNS' | 'ABSOLUTES' | 'SOLUTION_FOCUSED';
}

export interface RequirementValidationWarning {
  requirementId: string;
  criterionId?: string;
  message: string;
  code: 'UNCLEAR_TERMINOLOGY' | 'PERFORMANCE_TOLERANCE' | 'MEASURABILITY';
}

export interface RequirementGeneratorOptions {
  featureName: string;
  featureDescription: string;
  enforceEARS: boolean;
  enforceINCOSE: boolean;
}

// Base validation types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

// Design document types
export interface DesignDocument {
  overview: string;
  architecture: string;
  components: ComponentSection[];
  dataModels: DataModelSection[];
  correctnessProperties: CorrectnessProperty[];
  errorHandling: string;
  testingStrategy: string;
}

export interface ComponentSection {
  name: string;
  description: string;
  interfaces: string[];
  responsibilities: string[];
}

export interface DataModelSection {
  name: string;
  description: string;
  structure: string;
  relationships: string[];
}

export interface CorrectnessProperty {
  id: string;
  name: string;
  description: string;
  validatesRequirements: string[];
  propertyType: 'invariant' | 'round-trip' | 'idempotence' | 'metamorphic' | 'model-based' | 'confluence' | 'error-condition';
}

export interface DesignGeneratorOptions {
  featureName: string;
  requirementsDocument: RequirementDocument;
  includeArchitectureDiagram: boolean;
  testingFramework?: string;
}

export interface DesignValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  missingRequiredSections: string[];
  incompleteProperties: string[];
}

export interface UserApprovalGate {
  requestApproval(document: DesignDocument, changes?: string[]): Promise<boolean>;
  getApprovalStatus(): 'pending' | 'approved' | 'rejected';
}

// Task management types
export interface TaskDocument {
  featureName: string;
  tasks: Task[];
  metadata: TaskMetadata;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  level: number; // 0 for top-level, 1 for sub-tasks
  parentId?: string;
  subtasks: Task[];
  requirements: string[]; // References to requirement IDs
  optional: boolean;
  details: string[];
}

export type TaskStatus = 'not_started' | 'in_progress' | 'completed';

export interface TaskMetadata {
  createdAt: Date;
  lastModified: Date;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
}

export interface TaskGeneratorOptions {
  featureName: string;
  designDocument: DesignDocument;
  requirementsDocument: RequirementDocument;
  includeOptionalTasks: boolean;
  testingStrategy: 'minimal' | 'comprehensive';
}

export interface TaskValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  orphanedTasks: string[];
  missingRequirements: string[];
}

export interface TaskExecutionContext {
  taskId: string;
  featureName: string;
  workspaceRoot: string;
  isolationMode: boolean;
}

export interface TaskTracker {
  updateStatus(taskId: string, status: TaskStatus): void;
  getTaskStatus(taskId: string): TaskStatus;
  getProgress(): TaskProgress;
  validateTaskCompletion(taskId: string): boolean;
}

export interface TaskProgress {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  percentage: number;
}