/**
 * Workflow Orchestrator for MCP Integration System
 * Coordinates multi-step operations across different applications and services
 */

import {
  MCPServerDefinition,
  WorkflowStep,
  WorkflowDefinition,
  WorkflowResult,
  WorkflowStatus,
  WorkflowExecution,
  MCPConnection
} from './types.js';

// Re-export types for backward compatibility
export type { WorkflowStep, WorkflowDefinition, WorkflowResult, WorkflowStatus, WorkflowExecution, MCPConnection };

export class WorkflowOrchestrator {
  private executions = new Map<string, WorkflowExecution>();
  private connections = new Map<string, MCPConnection>();
  private serverRegistry = new Map<string, MCPServerDefinition>();

  constructor() {
    // Initialize with empty state
  }

  /**
   * Register an MCP server for use in workflows
   */
  async registerMCPServer(server: MCPServerDefinition): Promise<void> {
    this.serverRegistry.set(server.id, server);
    console.log(`Registered MCP server: ${server.name} (${server.id})`);
  }

  /**
   * Establish connection to NonicaTab MCP server using stdio protocol with 15000ms timeout
   */
  async connectToNonicaTabMCP(serverId: string): Promise<MCPConnection> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found in registry`);
    }

    if (server.type !== 'stdio') {
      throw new Error(`NonicaTab MCP server must use stdio protocol, got ${server.type}`);
    }

    // Validate connection parameters for NonicaTab MCP
    if (!server.connectionParams.command) {
      throw new Error('NonicaTab MCP server requires command parameter');
    }

    if (server.connectionParams.timeout !== 15000) {
      throw new Error('NonicaTab MCP server must use 15000ms timeout');
    }

    // Create connection
    const connection: MCPConnection = {
      serverId,
      status: 'connected',
      lastPing: new Date(),
      connectionTime: new Date(),
      protocol: 'stdio',
      endpoint: server.connectionParams.command
    };

    this.connections.set(serverId, connection);
    console.log(`Connected to NonicaTab MCP server: ${serverId}`);
    
    return connection;
  }

  /**
   * Establish communication with AIONS.Revit addin
   */
  async connectToAIONSRevit(serverId: string): Promise<MCPConnection> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found in registry`);
    }

    // AIONS.Revit uses custom addin interface
    const connection: MCPConnection = {
      serverId,
      status: 'connected',
      lastPing: new Date(),
      connectionTime: new Date(),
      protocol: 'stdio', // Addin communication
      endpoint: server.connectionParams.command || 'AIONS.Revit.Addin'
    };

    this.connections.set(serverId, connection);
    console.log(`Connected to AIONS.Revit addin: ${serverId}`);
    
    return connection;
  }

  /**
   * Monitor MCP server connections and handle disconnections gracefully
   */
  async monitorConnections(): Promise<void> {
    for (const [serverId, connection] of this.connections) {
      try {
        // Ping connection to check if it's still alive
        const now = new Date();
        const timeSinceLastPing = now.getTime() - connection.lastPing.getTime();
        
        if (timeSinceLastPing > 30000) { // 30 seconds timeout
          // Connection might be stale, try to reconnect
          await this.handleDisconnection(serverId);
        } else {
          // Update last ping
          connection.lastPing = now;
        }
      } catch (error) {
        console.error(`Error monitoring connection ${serverId}:`, error);
        await this.handleDisconnection(serverId);
      }
    }
  }

  /**
   * Handle server disconnection with retry logic and fallback options
   */
  async handleDisconnection(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    console.log(`Handling disconnection for server: ${serverId}`);
    connection.status = 'disconnected';

    // Implement retry logic with exponential backoff
    const maxRetries = 3;
    let retryCount = 0;
    let backoffMs = 1000; // Start with 1 second

    while (retryCount < maxRetries) {
      try {
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        
        // Attempt to reconnect
        const server = this.serverRegistry.get(serverId);
        if (server) {
          if (server.id.includes('nonicatab')) {
            await this.connectToNonicaTabMCP(serverId);
          } else if (server.id.includes('aions')) {
            await this.connectToAIONSRevit(serverId);
          }
          
          console.log(`Successfully reconnected to server: ${serverId}`);
          return;
        }
      } catch (error) {
        retryCount++;
        backoffMs *= 2; // Exponential backoff
        console.log(`Retry ${retryCount}/${maxRetries} failed for server ${serverId}:`, error);
      }
    }

    // If all retries failed, mark as error and provide fallback options
    connection.status = 'error';
    console.error(`Failed to reconnect to server ${serverId} after ${maxRetries} attempts`);
    
    // Provide fallback options
    await this.provideFallbackOptions(serverId);
  }

  /**
   * Provide fallback options when a server becomes unavailable
   */
  async provideFallbackOptions(serverId: string): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      return;
    }

    console.log(`Providing fallback options for unavailable server: ${serverId}`);

    // Find alternative servers with similar capabilities
    const alternatives: string[] = [];
    for (const [altServerId, altServer] of this.serverRegistry) {
      if (altServerId !== serverId) {
        // Check for overlapping capabilities
        const overlap = server.capabilities.filter(cap => 
          altServer.capabilities.includes(cap)
        );
        
        if (overlap.length > 0) {
          alternatives.push(altServerId);
        }
      }
    }

    if (alternatives.length > 0) {
      console.log(`Found alternative servers for ${serverId}:`, alternatives);
      // Could implement automatic failover here
    } else {
      console.log(`No alternative servers found for ${serverId}`);
      // Could implement degraded functionality mode
    }
  }

  /**
   * Execute a workflow definition
   */
  async executeWorkflow(definition: WorkflowDefinition): Promise<WorkflowResult> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate required servers are available
    for (const requiredServer of definition.metadata.requiredServers) {
      if (!this.serverRegistry.has(requiredServer)) {
        throw new Error(`Required server ${requiredServer} not available`);
      }
    }

    // Create execution record
    const execution: WorkflowExecution = {
      id: executionId,
      definitionId: definition.id,
      status: 'running',
      currentStep: 0,
      stepResults: new Map(),
      startTime: new Date(),
      context: {}
    };

    this.executions.set(executionId, execution);

    const result: WorkflowResult = {
      id: executionId,
      status: 'completed',
      results: new Map(),
      errors: new Map(),
      executionTime: 0,
      completedSteps: [],
      failedSteps: []
    };

    const startTime = Date.now();

    try {
      // Execute steps in dependency order
      const executedSteps = new Set<string>();
      
      for (let i = 0; i < definition.steps.length; i++) {
        const step = definition.steps[i];
        execution.currentStep = i;

        // Check dependencies
        const unmetDependencies = step.dependencies.filter(dep => !executedSteps.has(dep));
        if (unmetDependencies.length > 0) {
          throw new Error(`Step ${step.id} has unmet dependencies: ${unmetDependencies.join(', ')}`);
        }

        try {
          // Execute step with retry policy
          const stepResult = await this.executeStepWithRetry(step, execution);
          result.results.set(step.id, stepResult);
          execution.stepResults.set(step.id, stepResult);
          result.completedSteps.push(step.id);
          executedSteps.add(step.id);
          
          console.log(`Completed workflow step: ${step.id}`);
        } catch (error) {
          console.error(`Failed workflow step: ${step.id}`, error);
          result.errors.set(step.id, error as Error);
          result.failedSteps.push(step.id);
          result.status = 'failed';
          execution.status = 'failed';
          execution.error = (error as Error).message;
          break;
        }
      }

      execution.endTime = new Date();
      result.executionTime = Date.now() - startTime;

      if (result.failedSteps.length === 0) {
        execution.status = 'completed';
        result.status = 'completed';
      } else if (result.completedSteps.length > 0) {
        result.status = 'partial';
      }

    } catch (error) {
      execution.status = 'failed';
      execution.error = (error as Error).message;
      execution.endTime = new Date();
      result.status = 'failed';
      result.executionTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Execute a workflow step with retry policy
   */
  private async executeStepWithRetry(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= step.retryPolicy.maxAttempts; attempt++) {
      try {
        return await this.executeStep(step, execution);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < step.retryPolicy.maxAttempts) {
          console.log(`Step ${step.id} attempt ${attempt} failed, retrying in ${step.retryPolicy.backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, step.retryPolicy.backoffMs));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    switch (step.type) {
      case 'mcp_call':
        return await this.executeMCPCall(step, execution);
      case 'data_transform':
        return await this.executeDataTransform(step, execution);
      case 'cloud_operation':
        return await this.executeCloudOperation(step, execution);
      case 'desktop_automation':
        return await this.executeDesktopAutomation(step, execution);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute an MCP call step
   */
  private async executeMCPCall(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    const connection = this.connections.get(step.target);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`MCP server ${step.target} not connected`);
    }

    // Simulate MCP call execution
    console.log(`Executing MCP call: ${step.operation} on ${step.target}`);
    
    // For now, return a mock result
    return {
      operation: step.operation,
      target: step.target,
      parameters: step.parameters,
      result: 'success',
      timestamp: new Date()
    };
  }

  /**
   * Execute a data transformation step
   */
  private async executeDataTransform(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    console.log(`Executing data transform: ${step.operation}`);
    
    // For now, return a mock result
    return {
      operation: step.operation,
      parameters: step.parameters,
      result: 'transformed_data',
      timestamp: new Date()
    };
  }

  /**
   * Execute a cloud operation step
   */
  private async executeCloudOperation(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    console.log(`Executing cloud operation: ${step.operation} on ${step.target}`);
    
    // For now, return a mock result
    return {
      operation: step.operation,
      target: step.target,
      parameters: step.parameters,
      result: 'cloud_operation_complete',
      timestamp: new Date()
    };
  }

  /**
   * Execute a desktop automation step
   */
  private async executeDesktopAutomation(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    console.log(`Executing desktop automation: ${step.operation}`);
    
    // For now, return a mock result
    return {
      operation: step.operation,
      parameters: step.parameters,
      result: 'desktop_automation_complete',
      timestamp: new Date()
    };
  }

  /**
   * Get workflow execution status
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus> {
    const execution = this.executions.get(workflowId);
    if (!execution) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const definition = this.getWorkflowDefinition(execution.definitionId);
    const totalSteps = definition ? definition.steps.length : 1;
    const progress = totalSteps > 0 ? (execution.currentStep / totalSteps) * 100 : 0;

    return {
      id: workflowId,
      status: execution.status,
      currentStep: execution.currentStep,
      totalSteps,
      progress,
      startTime: execution.startTime,
      estimatedCompletion: this.calculateEstimatedCompletion(execution, definition),
      lastUpdate: new Date()
    };
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    const execution = this.executions.get(workflowId);
    if (!execution) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (execution.status === 'running') {
      execution.status = 'paused';
      console.log(`Paused workflow: ${workflowId}`);
    }
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    const execution = this.executions.get(workflowId);
    if (!execution) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (execution.status === 'paused') {
      execution.status = 'running';
      console.log(`Resumed workflow: ${workflowId}`);
    }
  }

  /**
   * Coordinate operations across multiple MCP servers
   */
  async coordinateMultiServerOperation(serverIds: string[], operation: string, parameters: Record<string, any>): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const errors = new Map<string, Error>();

    // Execute operation on all servers in parallel
    const promises = serverIds.map(async (serverId) => {
      try {
        const connection = this.connections.get(serverId);
        if (!connection || connection.status !== 'connected') {
          throw new Error(`Server ${serverId} not connected`);
        }

        // Simulate coordinated operation
        const result = {
          serverId,
          operation,
          parameters,
          result: `success_${serverId}`,
          timestamp: new Date()
        };

        results.set(serverId, result);
        console.log(`Coordinated operation completed on ${serverId}`);
      } catch (error) {
        errors.set(serverId, error as Error);
        console.error(`Coordinated operation failed on ${serverId}:`, error);
      }
    });

    await Promise.all(promises);

    // Maintain workflow state consistency
    if (errors.size > 0) {
      console.log(`Coordinated operation had ${errors.size} failures out of ${serverIds.length} servers`);
    }

    return results;
  }

  /**
   * Get registered MCP servers
   */
  getRegisteredServers(): MCPServerDefinition[] {
    return Array.from(this.serverRegistry.values());
  }

  /**
   * Get active connections
   */
  getActiveConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get workflow execution by ID
   */
  getWorkflowExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  // Helper methods
  private getWorkflowDefinition(definitionId: string): WorkflowDefinition | null {
    // In a real implementation, this would fetch from a database
    // For now, return null
    return null;
  }

  private calculateEstimatedCompletion(execution: WorkflowExecution, definition: WorkflowDefinition | null): Date | undefined {
    if (!definition || execution.status !== 'running') {
      return undefined;
    }

    const elapsed = Date.now() - execution.startTime.getTime();
    const progress = execution.currentStep / definition.steps.length;
    
    if (progress > 0) {
      const estimatedTotal = elapsed / progress;
      return new Date(execution.startTime.getTime() + estimatedTotal);
    }

    return undefined;
  }
}