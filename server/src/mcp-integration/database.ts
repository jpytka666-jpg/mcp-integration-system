/**
 * Aurora DSQL Database Configuration and Schema Management
 */

import { DSQLClient } from '@aws-sdk/client-dsql';
import { 
  MCPServerDefinition, 
  WorkflowDefinition, 
  WorkflowExecution, 
  AssessmentData,
  TransformationRule 
} from './types.js';

export interface DatabaseConfig {
  endpoint: string;
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export class MCPIntegrationDatabase {
  private client: DSQLClient;
  private isInitialized = false;

  constructor(config: DatabaseConfig) {
    this.client = new DSQLClient({
      region: config.region,
      endpoint: config.endpoint,
      credentials: config.credentials
    });
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.createTables();
      await this.createIndexes();
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const createTableStatements = [
      // MCP Server Registry
      `CREATE TABLE IF NOT EXISTS mcp_servers (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        connection_params JSONB NOT NULL,
        capabilities TEXT[] NOT NULL,
        status VARCHAR(50) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Workflow Definitions
      `CREATE TABLE IF NOT EXISTS workflow_definitions (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        steps JSONB NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Workflow Executions
      `CREATE TABLE IF NOT EXISTS workflow_executions (
        id UUID PRIMARY KEY,
        definition_id UUID REFERENCES workflow_definitions(id),
        status VARCHAR(50) NOT NULL,
        current_step INTEGER DEFAULT 0,
        step_results JSONB,
        context JSONB,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        error_message TEXT
      )`,

      // Assessment Data
      `CREATE TABLE IF NOT EXISTS assessments (
        id UUID PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        source_data JSONB NOT NULL,
        transformed_data JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Transformation Rules
      `CREATE TABLE IF NOT EXISTS transformation_rules (
        id UUID PRIMARY KEY,
        source_format VARCHAR(100) NOT NULL,
        target_format VARCHAR(100) NOT NULL,
        transform_function TEXT NOT NULL,
        validation_schema JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const statement of createTableStatements) {
      await this.executeStatement(statement);
    }
  }

  /**
   * Create database indexes
   */
  private async createIndexes(): Promise<void> {
    const indexStatements = [
      'CREATE INDEX IF NOT EXISTS idx_mcp_servers_status ON mcp_servers(status)',
      'CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status)',
      'CREATE INDEX IF NOT EXISTS idx_assessments_project_id ON assessments(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_assessments_type ON assessments(type)',
      'CREATE INDEX IF NOT EXISTS idx_transformation_rules_formats ON transformation_rules(source_format, target_format)'
    ];

    for (const statement of indexStatements) {
      await this.executeStatement(statement);
    }
  }

  /**
   * Execute a single SQL statement
   */
  async executeStatement(sql: string, parameters?: any[]): Promise<any> {
    try {
      // Note: This is a placeholder implementation for Aurora DSQL
      // In a real implementation, you would use the actual DSQL client methods
      console.log(`Executing SQL: ${sql}`, parameters);
      return [];
    } catch (error) {
      console.error('Database execution error:', error);
      throw error;
    }
  }

  /**
   * Execute multiple SQL statements in a transaction
   */
  async executeTransaction(statements: { sql: string; parameters?: any[] }[]): Promise<any[]> {
    try {
      // Note: This is a placeholder implementation for Aurora DSQL
      // In a real implementation, you would use the actual DSQL client methods
      console.log('Executing transaction:', statements);
      return [];
    } catch (error) {
      console.error('Database transaction error:', error);
      throw error;
    }
  }

  /**
   * Save MCP server definition
   */
  async saveMCPServer(server: MCPServerDefinition): Promise<void> {
    const sql = `
      INSERT INTO mcp_servers (id, name, type, connection_params, capabilities, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        connection_params = EXCLUDED.connection_params,
        capabilities = EXCLUDED.capabilities,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.executeStatement(sql, [
      server.id,
      server.name,
      server.type,
      JSON.stringify(server.connectionParams),
      server.capabilities,
      server.status,
      JSON.stringify(server.metadata)
    ]);
  }

  /**
   * Get MCP server by ID
   */
  async getMCPServer(serverId: string): Promise<MCPServerDefinition | null> {
    const sql = 'SELECT * FROM mcp_servers WHERE id = $1';
    const records = await this.executeStatement(sql, [serverId]);
    
    if (!records || records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      name: record.name,
      type: record.type,
      connectionParams: JSON.parse(record.connection_params),
      capabilities: record.capabilities,
      status: record.status,
      metadata: JSON.parse(record.metadata || '{}')
    };
  }

  /**
   * Get all MCP servers
   */
  async getAllMCPServers(): Promise<MCPServerDefinition[]> {
    const sql = 'SELECT * FROM mcp_servers ORDER BY name';
    const records = await this.executeStatement(sql);
    
    return (records || []).map((record: any) => ({
      id: record.id,
      name: record.name,
      type: record.type,
      connectionParams: JSON.parse(record.connection_params),
      capabilities: record.capabilities,
      status: record.status,
      metadata: JSON.parse(record.metadata || '{}')
    }));
  }

  /**
   * Save workflow definition
   */
  async saveWorkflowDefinition(workflow: WorkflowDefinition): Promise<void> {
    const sql = `
      INSERT INTO workflow_definitions (id, name, description, steps, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        steps = EXCLUDED.steps,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.executeStatement(sql, [
      workflow.id,
      workflow.name,
      workflow.description,
      JSON.stringify(workflow.steps),
      JSON.stringify(workflow.metadata)
    ]);
  }

  /**
   * Get workflow definition by ID
   */
  async getWorkflowDefinition(workflowId: string): Promise<WorkflowDefinition | null> {
    const sql = 'SELECT * FROM workflow_definitions WHERE id = $1';
    const records = await this.executeStatement(sql, [workflowId]);
    
    if (!records || records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      steps: JSON.parse(record.steps),
      metadata: JSON.parse(record.metadata || '{}')
    };
  }

  /**
   * Save workflow execution
   */
  async saveWorkflowExecution(execution: WorkflowExecution): Promise<void> {
    const sql = `
      INSERT INTO workflow_executions (
        id, definition_id, status, current_step, step_results, context, 
        start_time, end_time, error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        current_step = EXCLUDED.current_step,
        step_results = EXCLUDED.step_results,
        context = EXCLUDED.context,
        end_time = EXCLUDED.end_time,
        error_message = EXCLUDED.error_message
    `;

    await this.executeStatement(sql, [
      execution.id,
      execution.definitionId,
      execution.status,
      execution.currentStep,
      JSON.stringify(Object.fromEntries(execution.stepResults)),
      JSON.stringify(execution.context),
      execution.startTime,
      execution.endTime,
      execution.error
    ]);
  }

  /**
   * Get workflow execution by ID
   */
  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution | null> {
    const sql = 'SELECT * FROM workflow_executions WHERE id = $1';
    const records = await this.executeStatement(sql, [executionId]);
    
    if (!records || records.length === 0) {
      return null;
    }

    const record = records[0];
    const stepResults = new Map(Object.entries(JSON.parse(record.step_results || '{}')));

    return {
      id: record.id,
      definitionId: record.definition_id,
      status: record.status,
      currentStep: record.current_step,
      stepResults,
      startTime: new Date(record.start_time),
      endTime: record.end_time ? new Date(record.end_time) : undefined,
      error: record.error_message,
      context: JSON.parse(record.context || '{}')
    };
  }

  /**
   * Save assessment data
   */
  async saveAssessmentData(assessment: AssessmentData): Promise<void> {
    const sql = `
      INSERT INTO assessments (id, project_id, type, source_data, transformed_data, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id,
        type = EXCLUDED.type,
        source_data = EXCLUDED.source_data,
        transformed_data = EXCLUDED.transformed_data,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.executeStatement(sql, [
      assessment.id,
      assessment.projectId,
      assessment.type,
      JSON.stringify(assessment.sourceData),
      JSON.stringify(assessment.transformedData),
      JSON.stringify(assessment.metadata)
    ]);
  }

  /**
   * Get assessment data by ID
   */
  async getAssessmentData(assessmentId: string): Promise<AssessmentData | null> {
    const sql = 'SELECT * FROM assessments WHERE id = $1';
    const records = await this.executeStatement(sql, [assessmentId]);
    
    if (!records || records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      projectId: record.project_id,
      type: record.type,
      sourceData: JSON.parse(record.source_data),
      transformedData: JSON.parse(record.transformed_data || '{}'),
      metadata: JSON.parse(record.metadata || '{}')
    };
  }

  /**
   * Save transformation rule
   */
  async saveTransformationRule(rule: TransformationRule): Promise<void> {
    const sql = `
      INSERT INTO transformation_rules (id, source_format, target_format, transform_function, validation_schema)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        source_format = EXCLUDED.source_format,
        target_format = EXCLUDED.target_format,
        transform_function = EXCLUDED.transform_function,
        validation_schema = EXCLUDED.validation_schema
    `;

    await this.executeStatement(sql, [
      rule.id,
      rule.sourceFormat,
      rule.targetFormat,
      rule.transformFunction,
      JSON.stringify(rule.validation.schema || {})
    ]);
  }

  /**
   * Get transformation rules by source format
   */
  async getTransformationRules(sourceFormat?: string): Promise<TransformationRule[]> {
    const sql = sourceFormat 
      ? 'SELECT * FROM transformation_rules WHERE source_format = $1'
      : 'SELECT * FROM transformation_rules';
    
    const parameters = sourceFormat ? [sourceFormat] : [];
    const records = await this.executeStatement(sql, parameters);
    
    return (records || []).map((record: any) => ({
      id: record.id,
      sourceFormat: record.source_format,
      targetFormat: record.target_format,
      transformFunction: record.transform_function,
      validation: {
        required: true,
        schema: JSON.parse(record.validation_schema || '{}')
      }
    }));
  }

  /**
   * Clean up old records
   */
  async cleanup(retentionDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const cleanupStatements = [
      {
        sql: 'DELETE FROM workflow_executions WHERE start_time < $1 AND status IN (\'completed\', \'failed\')',
        parameters: [cutoffDate]
      },
      {
        sql: 'DELETE FROM assessments WHERE created_at < $1',
        parameters: [cutoffDate]
      }
    ];

    await this.executeTransaction(cleanupStatements);
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<Record<string, number>> {
    const queries = [
      { name: 'mcp_servers', sql: 'SELECT COUNT(*) as count FROM mcp_servers' },
      { name: 'workflow_definitions', sql: 'SELECT COUNT(*) as count FROM workflow_definitions' },
      { name: 'workflow_executions', sql: 'SELECT COUNT(*) as count FROM workflow_executions' },
      { name: 'assessments', sql: 'SELECT COUNT(*) as count FROM assessments' },
      { name: 'transformation_rules', sql: 'SELECT COUNT(*) as count FROM transformation_rules' }
    ];

    const stats: Record<string, number> = {};

    for (const query of queries) {
      try {
        const records = await this.executeStatement(query.sql);
        stats[query.name] = records?.[0]?.count || 0;
      } catch (error) {
        console.warn(`Failed to get statistics for ${query.name}:`, error);
        stats[query.name] = 0;
      }
    }

    return stats;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    // DSQL client doesn't require explicit closing
    this.isInitialized = false;
  }
}