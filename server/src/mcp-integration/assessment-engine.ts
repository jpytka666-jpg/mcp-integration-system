/**
 * Assessment Automation Engine
 * Specialized engine for completing assessment tasks using AI assistance and multi-application workflows
 */

import { 
  AssessmentTask,
  AssessmentResult,
  AssessmentProgress,
  AssessmentOutput,
  AssessmentMetrics,
  WorkflowDefinition,
  WorkflowStep,
  NONICATAB_TOOLS,
  NonicaTabTool
} from './types.js';
import { MCPRegistryManager } from './registry-manager.js';
import { WorkflowOrchestrator } from './workflow-orchestrator.js';
import { DataTransformer } from './data-transformer.js';

export interface AssessmentAutomationEngine {
  createAssessmentWorkflow(task: AssessmentTask): Promise<WorkflowDefinition>;
  executeAssessment(taskId: string): Promise<AssessmentResult>;
  getAssessmentProgress(taskId: string): Promise<AssessmentProgress>;
  generateReport(assessmentId: string, format: 'pdf' | 'docx' | 'pptx'): Promise<Buffer>;
}

export class MCPAssessmentAutomationEngine implements AssessmentAutomationEngine {
  private registryManager: MCPRegistryManager;
  private workflowOrchestrator: WorkflowOrchestrator;
  private dataTransformer: DataTransformer;
  private activeTasks: Map<string, AssessmentTask> = new Map();
  private taskProgress: Map<string, AssessmentProgress> = new Map();
  private taskResults: Map<string, AssessmentResult> = new Map();

  constructor(
    registryManager: MCPRegistryManager,
    workflowOrchestrator: WorkflowOrchestrator,
    dataTransformer: DataTransformer
  ) {
    this.registryManager = registryManager;
    this.workflowOrchestrator = workflowOrchestrator;
    this.dataTransformer = dataTransformer;
  }

  /**
   * Create assessment workflow from task requirements
   */
  async createAssessmentWorkflow(task: AssessmentTask): Promise<WorkflowDefinition> {
    // Validate NonicaTab MCP server availability
    await this.validateRequiredServers(task);

    // Analyze task requirements to determine workflow steps
    const steps = await this.generateWorkflowSteps(task);

    const workflow: WorkflowDefinition = {
      id: `assessment_workflow_${task.id}`,
      name: `Assessment Workflow for ${task.type}`,
      description: `Automated workflow for ${task.type} assessment task`,
      steps,
      metadata: {
        assessmentType: task.type,
        requiredServers: ['nonicatab-mcp', 'aions-revit-addin'],
        estimatedDuration: this.estimateWorkflowDuration(steps)
      }
    };

    return workflow;
  }

  /**
   * Execute assessment task
   */
  async executeAssessment(taskId: string): Promise<AssessmentResult> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Assessment task not found: ${taskId}`);
    }

    const startTime = Date.now();
    
    try {
      // Initialize progress tracking
      this.initializeProgress(taskId, task);

      // Create and execute workflow
      const workflow = await this.createAssessmentWorkflow(task);
      
      this.updateProgress(taskId, 'extraction', 10, 'Starting data extraction');
      
      const workflowResult = await this.workflowOrchestrator.executeWorkflow(workflow);
      
      this.updateProgress(taskId, 'transformation', 50, 'Transforming data');
      
      // Process workflow results into assessment outputs
      const outputs = await this.processWorkflowResults(workflowResult, task);
      
      this.updateProgress(taskId, 'generation', 80, 'Generating outputs');
      
      // Calculate metrics
      const metrics = this.calculateAssessmentMetrics(workflowResult, startTime);
      
      this.updateProgress(taskId, 'validation', 95, 'Validating results');

      const result: AssessmentResult = {
        id: `assessment_result_${taskId}`,
        taskId,
        status: workflowResult.status === 'completed' ? 'completed' : 'partial',
        outputs,
        metrics,
        errors: Array.from(workflowResult.errors.values()).map(err => err.message)
      };

      this.taskResults.set(taskId, result);
      this.updateProgress(taskId, 'validation', 100, 'Assessment completed');

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const failedResult: AssessmentResult = {
        id: `assessment_result_${taskId}`,
        taskId,
        status: 'failed',
        outputs: [],
        metrics: {
          executionTime: Date.now() - startTime,
          dataPointsProcessed: 0,
          completenessScore: 0
        },
        errors: [errorMessage]
      };

      this.taskResults.set(taskId, failedResult);
      throw error;
    }
  }

  /**
   * Get assessment progress
   */
  async getAssessmentProgress(taskId: string): Promise<AssessmentProgress> {
    const progress = this.taskProgress.get(taskId);
    if (!progress) {
      throw new Error(`Assessment progress not found: ${taskId}`);
    }
    return progress;
  }

  /**
   * Generate report from assessment results
   */
  async generateReport(assessmentId: string, format: 'pdf' | 'docx' | 'pptx'): Promise<Buffer> {
    const result = this.taskResults.get(assessmentId);
    if (!result) {
      throw new Error(`Assessment result not found: ${assessmentId}`);
    }

    // Generate report based on format
    switch (format) {
      case 'pptx':
        return await this.generatePowerPointReport(result);
      case 'pdf':
        return await this.generatePDFReport(result);
      case 'docx':
        return await this.generateWordReport(result);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Validate required servers are available
   */
  private async validateRequiredServers(task: AssessmentTask): Promise<void> {
    // Check NonicaTab MCP server
    const nonicaTabServer = this.registryManager.getServer('nonicatab-mcp');
    if (!nonicaTabServer) {
      throw new Error('NonicaTab MCP server not found. Please ensure it is installed and registered.');
    }

    const isNonicaTabConnected = await this.registryManager.validateServerConnection('nonicatab-mcp');
    if (!isNonicaTabConnected) {
      throw new Error('Cannot connect to NonicaTab MCP server. Please check the installation and AI Connector settings in Revit.');
    }

    // Check AIONS.Revit addin
    const aionsServer = this.registryManager.getServer('aions-revit-addin');
    if (!aionsServer) {
      throw new Error('AIONS.Revit addin not found. Please ensure it is installed and accessible.');
    }

    const isAIONSConnected = await this.registryManager.validateServerConnection('aions-revit-addin');
    if (!isAIONSConnected) {
      throw new Error('Cannot connect to AIONS.Revit addin. Please ensure Revit is running and the addin is loaded.');
    }
  }

  /**
   * Generate workflow steps based on task requirements
   */
  private async generateWorkflowSteps(task: AssessmentTask): Promise<WorkflowStep[]> {
    const steps: WorkflowStep[] = [];

    // Step 1: Data extraction from Revit
    steps.push(...this.createDataExtractionSteps(task));

    // Step 2: Data transformation
    steps.push(...this.createDataTransformationSteps(task));

    // Step 3: Output generation
    steps.push(...this.createOutputGenerationSteps(task));

    return steps;
  }

  /**
   * Create data extraction steps
   */
  private createDataExtractionSteps(task: AssessmentTask): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Determine required NonicaTab tools based on data types
    const requiredTools = this.selectNonicaTabTools(task.requirements.dataTypes);

    requiredTools.forEach((tool, index) => {
      steps.push({
        id: `extract_${tool}`,
        type: 'mcp_call',
        target: 'nonicatab-mcp',
        operation: tool,
        parameters: this.getToolParameters(tool, task),
        dependencies: index === 0 ? [] : [`extract_${requiredTools[index - 1]}`],
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 1000
        }
      });
    });

    return steps;
  }

  /**
   * Create data transformation steps
   */
  private createDataTransformationSteps(task: AssessmentTask): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Transform extracted data for each output format
    task.requirements.outputFormats.forEach((format, index) => {
      steps.push({
        id: `transform_to_${format}`,
        type: 'data_transform',
        target: 'data-transformer',
        operation: `transform_to_${format}`,
        parameters: {
          targetFormat: format,
          qualityCriteria: task.requirements.qualityCriteria
        },
        dependencies: this.getExtractionStepIds(task),
        retryPolicy: {
          maxAttempts: 2,
          backoffMs: 500
        }
      });
    });

    return steps;
  }

  /**
   * Create output generation steps
   */
  private createOutputGenerationSteps(task: AssessmentTask): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Generate PowerPoint presentation if required
    if (task.requirements.outputFormats.includes('powerpoint')) {
      steps.push({
        id: 'generate_powerpoint',
        type: 'desktop_automation',
        target: 'powerpoint-mcp',
        operation: 'create_presentation',
        parameters: {
          template: 'assessment_template',
          includeCharts: true,
          includeTables: true
        },
        dependencies: ['transform_to_powerpoint'],
        retryPolicy: {
          maxAttempts: 2,
          backoffMs: 1000
        }
      });
    }

    return steps;
  }

  /**
   * Select appropriate NonicaTab tools based on data requirements
   */
  private selectNonicaTabTools(dataTypes: string[]): NonicaTabTool[] {
    const selectedTools: NonicaTabTool[] = [];

    for (const dataType of dataTypes) {
      switch (dataType) {
        case 'elements':
          selectedTools.push('get_elements_by_category', 'get_user_selection_in_revit');
          break;
        case 'parameters':
          selectedTools.push('get_parameters_from_elementid', 'get_all_additional_properties_from_elementid');
          break;
        case 'geometry':
          selectedTools.push('get_boundingboxes_for_element_ids', 'get_location_for_element_ids');
          break;
        case 'families':
          selectedTools.push('get_all_used_families_in_model', 'get_all_used_types_of_families');
          break;
        case 'views':
          selectedTools.push('get_active_view_in_revit');
          break;
      }
    }

    // Remove duplicates and ensure we have at least basic tools
    const uniqueTools = Array.from(new Set(selectedTools));
    if (uniqueTools.length === 0) {
      uniqueTools.push('get_active_view_in_revit', 'get_user_selection_in_revit');
    }

    return uniqueTools;
  }

  /**
   * Get parameters for specific NonicaTab tools
   */
  private getToolParameters(tool: NonicaTabTool, task: AssessmentTask): Record<string, any> {
    const baseParams = {
      timeout: 15000,
      retryOnFailure: true
    };

    switch (tool) {
      case 'get_elements_by_category':
        return {
          ...baseParams,
          categories: task.requirements.qualityCriteria.filter(c => c.startsWith('category:'))
        };
      case 'get_parameters_from_elementid':
        return {
          ...baseParams,
          includeReadOnly: false
        };
      default:
        return baseParams;
    }
  }

  /**
   * Get extraction step IDs for dependencies
   */
  private getExtractionStepIds(task: AssessmentTask): string[] {
    const tools = this.selectNonicaTabTools(task.requirements.dataTypes);
    return tools.map(tool => `extract_${tool}`);
  }

  /**
   * Initialize progress tracking
   */
  private initializeProgress(taskId: string, task: AssessmentTask): void {
    const progress: AssessmentProgress = {
      taskId,
      phase: 'extraction',
      progress: 0,
      currentOperation: 'Initializing assessment',
      estimatedTimeRemaining: this.estimateTaskDuration(task)
    };

    this.taskProgress.set(taskId, progress);
  }

  /**
   * Update progress tracking
   */
  private updateProgress(
    taskId: string, 
    phase: AssessmentProgress['phase'], 
    progress: number, 
    operation: string
  ): void {
    const currentProgress = this.taskProgress.get(taskId);
    if (currentProgress) {
      currentProgress.phase = phase;
      currentProgress.progress = progress;
      currentProgress.currentOperation = operation;
      currentProgress.estimatedTimeRemaining = Math.max(0, currentProgress.estimatedTimeRemaining - 1000);
    }
  }

  /**
   * Process workflow results into assessment outputs
   */
  private async processWorkflowResults(workflowResult: any, task: AssessmentTask): Promise<AssessmentOutput[]> {
    const outputs: AssessmentOutput[] = [];

    // Process each result based on output format requirements
    for (const [stepId, result] of workflowResult.results) {
      if (stepId.startsWith('generate_')) {
        const format = stepId.replace('generate_', '');
        outputs.push({
          type: this.mapFormatToOutputType(format),
          format,
          path: result.outputPath || `/tmp/assessment_${task.id}.${format}`,
          metadata: {
            generatedAt: new Date().toISOString(),
            stepId,
            taskId: task.id
          }
        });
      }
    }

    return outputs;
  }

  /**
   * Calculate assessment metrics
   */
  private calculateAssessmentMetrics(workflowResult: any, startTime: number): AssessmentMetrics {
    const executionTime = Date.now() - startTime;
    
    // Count data points processed
    let dataPointsProcessed = 0;
    for (const [stepId, result] of workflowResult.results) {
      if (stepId.startsWith('extract_') && result.elements) {
        dataPointsProcessed += Array.isArray(result.elements) ? result.elements.length : 1;
      }
    }

    // Calculate completeness score
    const totalSteps = workflowResult.results.size;
    const successfulSteps = Array.from(workflowResult.results.values())
      .filter(result => result && !(result as any).error).length;
    const completenessScore = totalSteps > 0 ? (successfulSteps / totalSteps) * 100 : 0;

    return {
      executionTime,
      dataPointsProcessed,
      completenessScore,
      accuracyScore: completenessScore > 90 ? 95 : completenessScore > 70 ? 85 : 75
    };
  }

  /**
   * Generate PowerPoint report
   */
  private async generatePowerPointReport(result: AssessmentResult): Promise<Buffer> {
    // Simulate PowerPoint generation
    const reportContent = this.generateReportContent(result);
    return Buffer.from(reportContent, 'utf-8');
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(result: AssessmentResult): Promise<Buffer> {
    // Simulate PDF generation
    const reportContent = this.generateReportContent(result);
    return Buffer.from(reportContent, 'utf-8');
  }

  /**
   * Generate Word report
   */
  private async generateWordReport(result: AssessmentResult): Promise<Buffer> {
    // Simulate Word document generation
    const reportContent = this.generateReportContent(result);
    return Buffer.from(reportContent, 'utf-8');
  }

  /**
   * Generate report content
   */
  private generateReportContent(result: AssessmentResult): string {
    return `
# Assessment Report

## Summary
- Task ID: ${result.taskId}
- Status: ${result.status}
- Execution Time: ${result.metrics.executionTime}ms
- Data Points Processed: ${result.metrics.dataPointsProcessed}
- Completeness Score: ${result.metrics.completenessScore}%

## Outputs
${result.outputs.map(output => `- ${output.type}: ${output.path}`).join('\n')}

## Errors
${result.errors.length > 0 ? result.errors.join('\n') : 'No errors reported'}

Generated at: ${new Date().toISOString()}
    `.trim();
  }

  /**
   * Map format to output type
   */
  private mapFormatToOutputType(format: string): AssessmentOutput['type'] {
    switch (format) {
      case 'powerpoint':
      case 'pptx':
        return 'presentation';
      case 'pdf':
      case 'docx':
        return 'report';
      default:
        return 'data_file';
    }
  }

  /**
   * Estimate workflow duration
   */
  private estimateWorkflowDuration(steps: WorkflowStep[]): number {
    // Estimate based on step types and complexity
    return steps.length * 30000; // 30 seconds per step average
  }

  /**
   * Estimate task duration
   */
  private estimateTaskDuration(task: AssessmentTask): number {
    const baseTime = 60000; // 1 minute base
    const dataTypeMultiplier = task.requirements.dataTypes.length * 15000; // 15 seconds per data type
    const outputMultiplier = task.requirements.outputFormats.length * 10000; // 10 seconds per output format
    
    return baseTime + dataTypeMultiplier + outputMultiplier;
  }

  /**
   * Register assessment task
   */
  registerTask(task: AssessmentTask): void {
    this.activeTasks.set(task.id, task);
  }

  /**
   * Get registered task
   */
  getTask(taskId: string): AssessmentTask | undefined {
    return this.activeTasks.get(taskId);
  }
}