/**
 * MCP Integration System Types
 */

// Core MCP Server Definition
export interface MCPServerDefinition {
  id: string;
  name: string;
  type: 'stdio' | 'http' | 'websocket';
  connectionParams: {
    command?: string;
    args?: string[];
    url?: string;
    port?: number;
    timeout?: number;
  };
  capabilities: string[];
  status: 'available' | 'connected' | 'error' | 'unknown';
  metadata: {
    source: 'local' | 'github' | 'registry';
    version?: string;
    description?: string;
    repository?: string;
    conflictResolution?: string;
  };
}

// Registry Interface
export interface MCPRegistry {
  discoverServers(): Promise<MCPServerDefinition[]>;
  registerServer(definition: MCPServerDefinition): Promise<void>;
  getServerCapabilities(serverId: string): Promise<string[]>;
  validateServerConnection(serverId: string): Promise<boolean>;
}

// Workflow Types
export interface WorkflowStep {
  id: string;
  type: 'mcp_call' | 'data_transform' | 'cloud_operation' | 'desktop_automation';
  target: string; // MCP server ID, AWS service, etc.
  operation: string;
  parameters: Record<string, any>;
  dependencies: string[]; // IDs of prerequisite steps
  retryPolicy: {
    maxAttempts: number;
    backoffMs: number;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  metadata: {
    assessmentType?: string;
    requiredServers: string[];
    estimatedDuration: number;
  };
}

export interface WorkflowResult {
  id: string;
  status: 'completed' | 'failed' | 'partial';
  results: Map<string, any>; // stepId -> result
  errors: Map<string, Error>; // stepId -> error
  executionTime: number;
  completedSteps: string[];
  failedSteps: string[];
}

export interface WorkflowStatus {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  progress: number; // 0-100
  startTime: Date;
  estimatedCompletion?: Date;
  lastUpdate?: Date;
}

// Data Transformation Types
export interface TransformationRule {
  id: string;
  sourceFormat: string; // 'nonicatab_response' | 'revit_element' | 'geometry_data'
  targetFormat: string; // 'powerpoint_table' | 'chart_data' | 'report_section'
  transformFunction: string; // Reference to transformation logic
  validation: {
    required: boolean;
    schema?: object;
  };
}

export interface DataTransformer {
  registerTransformation(rule: TransformationRule): void;
  transform(data: any, sourceFormat: string, targetFormat: string): Promise<any>;
  validateTransformation(source: any, target: any, rule: TransformationRule): boolean;
  getAvailableTransformations(sourceFormat: string): string[];
}

// Assessment Types
export interface AssessmentTask {
  id: string;
  type: 'data_extraction' | 'analysis' | 'report_generation' | 'presentation_creation';
  requirements: {
    sourceApplications: string[];
    dataTypes: string[];
    outputFormats: string[];
    qualityCriteria: string[];
  };
  workflow: WorkflowDefinition;
}

export interface AssessmentResult {
  id: string;
  taskId: string;
  status: 'completed' | 'failed' | 'partial';
  outputs: AssessmentOutput[];
  metrics: AssessmentMetrics;
  errors: string[];
}

export interface AssessmentOutput {
  type: 'presentation' | 'report' | 'data_file';
  format: string;
  path: string;
  metadata: Record<string, any>;
}

export interface AssessmentMetrics {
  executionTime: number;
  dataPointsProcessed: number;
  accuracyScore?: number;
  completenessScore: number;
}

export interface AssessmentProgress {
  taskId: string;
  phase: 'extraction' | 'transformation' | 'generation' | 'validation';
  progress: number; // 0-100
  currentOperation: string;
  estimatedTimeRemaining: number;
}

// Revit Data Models (from NonicaTab MCP)
export interface RevitElement {
  elementId: string;
  category: string;
  familyName: string;
  typeName: string;
  parameters: Record<string, any>;
  geometry: {
    boundingBox: BoundingBox;
    location: Point3D;
  };
  additionalProperties: Record<string, any>;
}

export interface ElementParameter {
  elementId: string;
  parameterName: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'date';
  isReadOnly: boolean;
  group: string;
}

export interface BoundingBox {
  min: Point3D;
  max: Point3D;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface FamilyData {
  families?: Array<{
    name: string;
    category?: string;
    types?: string[];
    parameters?: string[];
    instanceCount?: number;
  }>;
}

export interface GeometryData {
  elements?: RevitElement[];
  elementId?: string;
  type?: 'solid' | 'surface' | 'curve' | 'point';
  boundingBox?: BoundingBox;
  volume?: number;
  area?: number;
  length?: number;
}

// Presentation Data Models
export interface PresentationData {
  id: string;
  slides: SlideData[];
  template: string;
  metadata: {
    title: string;
    author: string;
    createdDate: Date;
    assessmentType: string;
  };
}

export interface SlideData {
  id: string;
  type: 'title' | 'content' | 'chart' | 'table' | 'image';
  title: string;
  content: any; // Varies by slide type
  layout: string;
  notes?: string;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'scatter';
  data: {
    labels: string[];
    datasets: Array<{
      label?: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
    }>;
  };
  options?: {
    responsive?: boolean;
    plugins?: {
      title?: {
        display: boolean;
        text: string;
      };
      legend?: {
        position?: 'top' | 'bottom' | 'left' | 'right';
      };
    };
  };
}

export interface ChartDataPoint {
  label: string;
  value: number;
  category?: string;
}

export interface ReportData {
  id: string;
  sections: ReportSection[];
  metadata: {
    title: string;
    author: string;
    createdDate: Date;
    version: string;
  };
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'table' | 'chart' | 'image';
  data?: any;
}

// Database Models
export interface MCPServerRegistry {
  servers: Map<string, MCPServerDefinition>;
  capabilities: Map<string, string[]>; // serverId -> capabilities
  connections: Map<string, MCPConnection>;
  lastUpdated: Date;
}

export interface MCPConnection {
  serverId: string;
  status: 'connected' | 'disconnected' | 'error';
  lastPing: Date;
  connectionTime: Date;
  protocol: 'stdio' | 'http' | 'websocket';
  endpoint?: string;
  error?: string;
  process?: any; // Node.js ChildProcess
}

export interface WorkflowExecution {
  id: string;
  definitionId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  stepResults: Map<string, any>;
  startTime: Date;
  endTime?: Date;
  error?: string;
  context: Record<string, any>;
}

export interface AssessmentData {
  id: string;
  projectId: string;
  type: string;
  sourceData: {
    revitElements: RevitElement[];
    parameters: ElementParameter[];
    geometry: GeometryData[];
    families: FamilyData[];
  };
  transformedData: {
    presentations: PresentationData[];
    reports: ReportData[];
    charts: ChartData[];
  };
  metadata: {
    extractionTimestamp: Date;
    sourceModel: string;
    assessmentCriteria: string[];
  };
}

// Error Types
export interface SystemError {
  id: string;
  type: 'connection' | 'data' | 'workflow' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: {
    component: string;
    operation: string;
    mcpServer?: string;
  };
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
  suggestedActions: string[];
}

// NonicaTab MCP Tool Names (37 FREE tools)
export const NONICATAB_TOOLS = [
  'get_active_view_in_revit',
  'get_user_selection_in_revit',
  'get_elements_by_category',
  'get_parameters_from_elementid',
  'get_all_additional_properties_from_elementid',
  'get_boundingboxes_for_element_ids',
  'get_location_for_element_ids',
  'get_all_used_families_in_model',
  'get_all_used_types_of_families',
  // Additional tools would be listed here
] as const;

export type NonicaTabTool = typeof NONICATAB_TOOLS[number];
// Cloud Services Types
export interface CloudServiceConfig {
  region: string;
  credentials: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    profile?: string;
  };
  endpoints?: {
    lambda?: string;
    s3?: string;
    bedrock?: string;
    cloudwatch?: string;
  };
}

export interface LambdaFunction {
  name: string;
  runtime: string;
  handler: string;
  role: string;
  code: Buffer;
  description?: string;
  timeout?: number;
  memorySize?: number;
  environment?: Record<string, string>;
}

export interface S3StorageConfig {
  versioning?: boolean;
  encryption?: {
    type: 'AES256' | 'aws:kms';
    kmsKeyId?: string;
  };
  lifecycle?: {
    rules: Array<{
      id: string;
      status: 'Enabled' | 'Disabled';
      transitions: Array<{
        days: number;
        storageClass: string;
      }>;
    }>;
  };
}

export interface BedrockConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface CloudWatchConfig {
  metricName: string;
  namespace: string;
  comparisonOperator?: string;
  evaluationPeriods?: number;
  period?: number;
  statistic?: string;
  threshold: number;
  alarmActions?: string[];
  description?: string;
  unit?: string;
}

export interface ProcessingResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  metadata: Record<string, any>;
}

export interface StorageResult {
  success: boolean;
  location?: string;
  etag?: string;
  size?: number;
  error?: string;
  metadata: Record<string, any>;
}

export interface AnalysisResult {
  success: boolean;
  analysis?: string;
  confidence: number;
  insights: string[];
  error?: string;
  metadata: Record<string, any>;
}

export interface MonitoringMetrics {
  name: string;
  value: number;
  unit?: string;
  timestamp?: Date;
  dimensions?: Array<{
    name: string;
    value: string;
  }>;
}

// ==================== Multi-Tenant Types ====================

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  userId: string;
  roles: TenantRole[];
  permissions: TenantPermission[];
  subscription: TenantSubscription;
  settings: TenantSettings;
  metadata: Record<string, any>;
}

export interface TenantRole {
  id: string;
  name: string;
  permissions: TenantPermission[];
  scope: 'global' | 'project' | 'resource';
}

export type TenantPermission =
  | 'read:assessments'
  | 'write:assessments'
  | 'delete:assessments'
  | 'read:workflows'
  | 'write:workflows'
  | 'execute:workflows'
  | 'read:reports'
  | 'write:reports'
  | 'admin:tenant'
  | 'admin:users'
  | 'admin:billing';

export interface TenantSubscription {
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  limits: TenantLimits;
  features: string[];
  expiresAt?: Date;
}

export interface TenantLimits {
  maxAssessmentsPerMonth: number;
  maxWorkflowsPerMonth: number;
  maxStorageGB: number;
  maxConcurrentWorkflows: number;
  maxUsersPerTenant: number;
  maxProjectsPerTenant: number;
}

export interface TenantSettings {
  defaultOutputFormat: 'powerpoint' | 'pdf' | 'excel';
  defaultLanguage: string;
  timezone: string;
  notificationsEnabled: boolean;
  retentionDays: number;
  customBranding?: {
    logoUrl?: string;
    primaryColor?: string;
    companyName?: string;
  };
}

export interface TenantIsolationPolicy {
  tenantId: string;
  dataIsolation: 'strict' | 'shared' | 'hybrid';
  encryptionKeyId: string;
  allowedRegions: string[];
  networkPolicy: {
    allowedIPs: string[];
    blockedIPs: string[];
    vpcEndpoints?: string[];
  };
  auditLevel: 'minimal' | 'standard' | 'comprehensive';
}

export interface TenantUsageMetrics {
  tenantId: string;
  period: {
    start: Date;
    end: Date;
  };
  assessments: {
    count: number;
    successRate: number;
    avgDurationMs: number;
  };
  workflows: {
    count: number;
    successRate: number;
    avgSteps: number;
  };
  storage: {
    usedGB: number;
    limitGB: number;
  };
  api: {
    totalRequests: number;
    errorRate: number;
    avgLatencyMs: number;
  };
}