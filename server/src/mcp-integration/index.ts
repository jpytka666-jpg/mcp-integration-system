/**
 * MCP Integration System
 * Main entry point for the MCP Integration System
 */

// Core classes
export { MCPRegistryManager } from './registry-manager.js';
export { WorkflowOrchestrator } from './workflow-orchestrator.js';
export { DataTransformer } from './data-transformer.js';
export { MCPAssessmentAutomationEngine, AssessmentAutomationEngine } from './assessment-engine.js';
export { ExternalServerIntegration } from './external-server-integration.js';
export {
  MonitoringLoggingSystem,
  getMonitoringSystem,
  resetMonitoringSystem
} from './monitoring-logging.js';
export {
  SecurityComplianceFramework,
  getSecurityFramework,
  resetSecurityFramework
} from './security-compliance.js';
export {
  DesktopAutomationService,
  getDesktopAutomationService,
  resetDesktopAutomationService
} from './desktop-automation.js';
export {
  RetryMechanism,
  CircuitBreaker,
  WorkflowCheckpointManager,
  FallbackHandler,
  ErrorRecoveryService,
  getErrorRecoveryService,
  resetErrorRecoveryService
} from './error-handling.js';
export {
  ConfigurationManager,
  ConfigurationValidator,
  DeploymentManager,
  getConfigurationManager,
  resetConfigurationManager
} from './configuration-manager.js';

// Monitoring types
export type {
  LogLevel,
  LogEntry,
  PerformanceMetric,
  AddinInteraction,
  WorkflowProgress,
  StepMetric,
  CorrelatedError,
  MonitoringConfig,
  LogExporter,
  MetricsAggregation
} from './monitoring-logging.js';

// Security types
export type {
  SecurityConstraint,
  SecurityContext,
  SecurityValidationResult,
  SecurityViolation,
  UserContext,
  DataContext,
  DataProtectionPolicy,
  DataProtectionRule,
  DataProtectionResult,
  DataProtectionViolation,
  AuditEntry,
  AuditActor,
  AuditResource,
  AuditQuery,
  IsolationContext,
  ResourceQuota,
  NetworkPolicy,
  IsolationViolation,
  SecurityConfig
} from './security-compliance.js';

// Desktop automation types
export type {
  DesktopAutomationConfig,
  PowerPointTemplate,
  SlideLayout,
  PlaceholderInfo,
  ColorScheme,
  FontScheme,
  PowerPointOperation,
  PowerPointResult,
  FileOperation,
  FileOperationOptions,
  FileOperationResult,
  FileInfo,
  FileStats,
  ClipboardOperation,
  ClipboardResult,
  UIAutomationOperation,
  UIElement,
  UISelector,
  UIAutomationResult,
  DesktopAutomationResult,
  PowerPointGenerationRequest,
  PowerPointGenerationOptions,
  SlideGenerationRequest
} from './desktop-automation.js';

// Error handling types
export type {
  RetryStrategy,
  RetryConfig,
  RetryResult,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  WorkflowCheckpoint,
  WorkflowRecoveryResult,
  FallbackConfig,
  FallbackOption,
  FallbackResult,
  ErrorRecoveryConfig,
  OperationContext,
  RecoveryEvent
} from './error-handling.js';

// Configuration types
export type {
  Environment,
  MCPServerConfig,
  DatabaseConfig,
  AWSConfig,
  SecurityConfig as SystemSecurityConfig,
  LoggingConfig,
  LogOutput,
  WorkflowConfig,
  DesktopAutomationConfig as SystemDesktopAutomationConfig,
  SystemConfig,
  ConfigValidationResult,
  ConfigValidationError,
  ConfigValidationWarning,
  DeploymentConfig,
  DeploymentResult
} from './configuration-manager.js';

// Types (avoiding conflicts)
export type {
  MCPServerDefinition,
  MCPRegistry,
  WorkflowStep,
  WorkflowDefinition,
  WorkflowResult,
  WorkflowStatus,
  TransformationRule,
  DataTransformer as IDataTransformer,
  AssessmentTask,
  AssessmentResult,
  AssessmentOutput,
  AssessmentMetrics,
  AssessmentProgress,
  RevitElement,
  ElementParameter,
  BoundingBox,
  Point3D,
  FamilyData,
  GeometryData,
  PresentationData,
  SlideData,
  ChartData,
  ChartDataPoint,
  ReportData,
  ReportSection,
  MCPServerRegistry,
  MCPConnection,
  WorkflowExecution,
  AssessmentData,
  SystemError,
  NonicaTabTool,
  CloudServiceConfig,
  LambdaFunction,
  S3StorageConfig,
  BedrockConfig,
  CloudWatchConfig,
  ProcessingResult,
  StorageResult,
  AnalysisResult,
  MonitoringMetrics
} from './types.js';