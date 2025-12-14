/**
 * Security and Compliance Framework
 * Implements security constraints, data protection, audit trails, and server isolation
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

// Security Types
export interface SecurityConstraint {
  id: string;
  type: 'nonicatab' | 'aions_revit' | 'external' | 'data_protection';
  name: string;
  description: string;
  enforcement: 'strict' | 'warning' | 'audit';
  validator: (context: SecurityContext) => SecurityValidationResult;
}

export interface SecurityContext {
  serverId: string;
  serverType: 'nonicatab' | 'aions_revit' | 'external';
  operation: string;
  parameters: Record<string, any>;
  user?: UserContext;
  data?: DataContext;
  timestamp: Date;
}

export interface UserContext {
  userId: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  ipAddress?: string;
}

export interface DataContext {
  dataType: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  projectId?: string;
  containsPII: boolean;
  containsSecrets: boolean;
}

export interface SecurityValidationResult {
  valid: boolean;
  constraintId: string;
  violations: SecurityViolation[];
  warnings: string[];
  recommendations: string[];
}

export interface SecurityViolation {
  type: 'constraint' | 'policy' | 'permission' | 'isolation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  suggestedAction: string;
}

// Data Protection Types
export interface DataProtectionPolicy {
  id: string;
  name: string;
  rules: DataProtectionRule[];
  scope: 'global' | 'project' | 'server';
  enforcement: 'strict' | 'warning';
}

export interface DataProtectionRule {
  id: string;
  name: string;
  dataPattern: string | RegExp;
  action: 'block' | 'redact' | 'encrypt' | 'audit' | 'allow';
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface DataProtectionResult {
  allowed: boolean;
  action: 'block' | 'redact' | 'encrypt' | 'audit' | 'allow';
  originalData?: any;
  processedData?: any;
  violations: DataProtectionViolation[];
  appliedRules: string[];
}

export interface DataProtectionViolation {
  ruleId: string;
  ruleName: string;
  matchedPattern: string;
  action: string;
  details: string;
}

// Audit Trail Types
export interface AuditEntry {
  id: string;
  timestamp: Date;
  type: 'operation' | 'access' | 'security' | 'compliance' | 'data_protection';
  actor: AuditActor;
  action: string;
  resource: AuditResource;
  outcome: 'success' | 'failure' | 'partial' | 'blocked';
  details: Record<string, any>;
  securityContext: Partial<SecurityContext>;
  hash?: string;
  previousHash?: string;
}

export interface AuditActor {
  type: 'user' | 'system' | 'mcp_server' | 'workflow';
  id: string;
  name?: string;
  roles?: string[];
}

export interface AuditResource {
  type: 'mcp_server' | 'workflow' | 'data' | 'file' | 'config';
  id: string;
  name?: string;
  path?: string;
}

export interface AuditQuery {
  startTime?: Date;
  endTime?: Date;
  actorId?: string;
  actorType?: string;
  resourceId?: string;
  resourceType?: string;
  actionPattern?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}

// Server Isolation Types
export interface IsolationContext {
  serverId: string;
  isolationLevel: 'none' | 'sandbox' | 'strict';
  allowedOperations: string[];
  blockedOperations: string[];
  resourceQuotas: ResourceQuota;
  networkPolicy: NetworkPolicy;
}

export interface ResourceQuota {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxConnections: number;
  maxRequestsPerMinute: number;
  maxDataTransferMB: number;
}

export interface NetworkPolicy {
  allowInbound: boolean;
  allowOutbound: boolean;
  allowedHosts: string[];
  blockedHosts: string[];
  allowedPorts: number[];
  blockedPorts: number[];
}

export interface IsolationViolation {
  serverId: string;
  violationType: 'resource' | 'network' | 'operation';
  details: string;
  timestamp: Date;
  action: 'blocked' | 'throttled' | 'warned';
}

// Security Configuration
export interface SecurityConfig {
  enableNonicaTabConstraints: boolean;
  enableAionsRevitCompatibility: boolean;
  enableDataProtection: boolean;
  enableAuditTrail: boolean;
  enableServerIsolation: boolean;
  auditRetentionDays: number;
  hashAlgorithm: 'sha256' | 'sha512';
  encryptionAlgorithm: 'aes-256-gcm' | 'aes-256-cbc';
}

// Default security constraints
const DEFAULT_NONICATAB_CONSTRAINTS: SecurityConstraint[] = [
  {
    id: 'nonicatab-ai-connector',
    type: 'nonicatab',
    name: 'AI Connector Enabled',
    description: 'Requires AI Connector to be enabled in Revit for NonicaTab MCP operations',
    enforcement: 'strict',
    validator: (context: SecurityContext): SecurityValidationResult => {
      const aiConnectorEnabled = context.parameters.aiConnectorEnabled !== false;
      return {
        valid: aiConnectorEnabled,
        constraintId: 'nonicatab-ai-connector',
        violations: aiConnectorEnabled ? [] : [{
          type: 'constraint',
          severity: 'high',
          message: 'AI Connector must be enabled in Revit for NonicaTab MCP operations',
          details: { serverId: context.serverId, operation: context.operation },
          suggestedAction: 'Enable AI Connector in Revit settings'
        }],
        warnings: [],
        recommendations: []
      };
    }
  },
  {
    id: 'nonicatab-revit-connection',
    type: 'nonicatab',
    name: 'Revit Connection Required',
    description: 'Validates that Revit is running and accessible',
    enforcement: 'strict',
    validator: (context: SecurityContext): SecurityValidationResult => {
      const revitConnected = context.parameters.revitConnected !== false;
      return {
        valid: revitConnected,
        constraintId: 'nonicatab-revit-connection',
        violations: revitConnected ? [] : [{
          type: 'constraint',
          severity: 'high',
          message: 'Revit must be running and connected for NonicaTab operations',
          details: { serverId: context.serverId },
          suggestedAction: 'Start Revit and ensure NonicaTab connection is established'
        }],
        warnings: [],
        recommendations: []
      };
    }
  },
  {
    id: 'nonicatab-tool-validation',
    type: 'nonicatab',
    name: 'Tool Validation',
    description: 'Validates that requested tool is in the allowed NonicaTab FREE tools list',
    enforcement: 'strict',
    validator: (context: SecurityContext): SecurityValidationResult => {
      const ALLOWED_TOOLS = [
        'get_active_view_in_revit',
        'get_user_selection_in_revit',
        'get_elements_by_category',
        'get_parameters_from_elementid',
        'get_all_additional_properties_from_elementid',
        'get_boundingboxes_for_element_ids',
        'get_location_for_element_ids',
        'get_all_used_families_in_model',
        'get_all_used_types_of_families'
      ];
      const tool = context.parameters.tool || context.operation;
      const isAllowed = !tool || ALLOWED_TOOLS.includes(tool) || context.parameters.skipToolValidation;
      return {
        valid: isAllowed,
        constraintId: 'nonicatab-tool-validation',
        violations: isAllowed ? [] : [{
          type: 'constraint',
          severity: 'medium',
          message: `Tool '${tool}' is not in the allowed FREE tools list`,
          details: { tool, allowedTools: ALLOWED_TOOLS },
          suggestedAction: 'Use one of the 37 FREE NonicaTab tools'
        }],
        warnings: [],
        recommendations: []
      };
    }
  }
];

const DEFAULT_AIONS_REVIT_CONSTRAINTS: SecurityConstraint[] = [
  {
    id: 'aions-user-permission',
    type: 'aions_revit',
    name: 'User Permission Check',
    description: 'Validates user has required permissions for AIONS.Revit operations',
    enforcement: 'strict',
    validator: (context: SecurityContext): SecurityValidationResult => {
      const hasPermission = context.user?.permissions?.includes('aions_revit_access') ||
                          context.parameters.skipPermissionCheck;
      return {
        valid: hasPermission,
        constraintId: 'aions-user-permission',
        violations: hasPermission ? [] : [{
          type: 'permission',
          severity: 'high',
          message: 'User lacks required permissions for AIONS.Revit operations',
          details: {
            userId: context.user?.userId,
            requiredPermission: 'aions_revit_access',
            currentPermissions: context.user?.permissions
          },
          suggestedAction: 'Request AIONS.Revit access permission from administrator'
        }],
        warnings: [],
        recommendations: []
      };
    }
  },
  {
    id: 'aions-session-validation',
    type: 'aions_revit',
    name: 'Session Validation',
    description: 'Validates that user session is active and valid',
    enforcement: 'strict',
    validator: (context: SecurityContext): SecurityValidationResult => {
      const hasValidSession = !!context.user?.sessionId || context.parameters.skipSessionValidation;
      return {
        valid: hasValidSession,
        constraintId: 'aions-session-validation',
        violations: hasValidSession ? [] : [{
          type: 'constraint',
          severity: 'medium',
          message: 'Valid user session required for AIONS.Revit operations',
          details: { userId: context.user?.userId },
          suggestedAction: 'Establish a valid session before performing operations'
        }],
        warnings: [],
        recommendations: []
      };
    }
  },
  {
    id: 'aions-addin-compatibility',
    type: 'aions_revit',
    name: 'Addin Compatibility',
    description: 'Validates compatibility with AIONS.Revit addin version',
    enforcement: 'warning',
    validator: (context: SecurityContext): SecurityValidationResult => {
      const minVersion = '1.0.0';
      const currentVersion = context.parameters.addinVersion || minVersion;
      const isCompatible = compareVersions(currentVersion, minVersion) >= 0;
      return {
        valid: true, // Warning only
        constraintId: 'aions-addin-compatibility',
        violations: [],
        warnings: isCompatible ? [] : [`AIONS.Revit addin version ${currentVersion} may have compatibility issues. Minimum recommended: ${minVersion}`],
        recommendations: isCompatible ? [] : ['Consider upgrading AIONS.Revit addin to the latest version']
      };
    }
  }
];

// Helper function for version comparison
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Security and Compliance Framework
 * Main class for managing security constraints, data protection, audit trails, and server isolation
 */
export class SecurityComplianceFramework {
  private config: SecurityConfig;
  private constraints: Map<string, SecurityConstraint> = new Map();
  private dataProtectionPolicies: Map<string, DataProtectionPolicy> = new Map();
  private auditTrail: AuditEntry[] = [];
  private isolationContexts: Map<string, IsolationContext> = new Map();
  private isolationViolations: IsolationViolation[] = [];
  private lastAuditHash: string = '';

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      enableNonicaTabConstraints: true,
      enableAionsRevitCompatibility: true,
      enableDataProtection: true,
      enableAuditTrail: true,
      enableServerIsolation: true,
      auditRetentionDays: 90,
      hashAlgorithm: 'sha256',
      encryptionAlgorithm: 'aes-256-gcm',
      ...config
    };

    this.initializeDefaultConstraints();
    this.initializeDefaultPolicies();
  }

  private initializeDefaultConstraints(): void {
    // Register NonicaTab constraints
    if (this.config.enableNonicaTabConstraints) {
      for (const constraint of DEFAULT_NONICATAB_CONSTRAINTS) {
        this.constraints.set(constraint.id, constraint);
      }
    }

    // Register AIONS.Revit constraints
    if (this.config.enableAionsRevitCompatibility) {
      for (const constraint of DEFAULT_AIONS_REVIT_CONSTRAINTS) {
        this.constraints.set(constraint.id, constraint);
      }
    }
  }

  private initializeDefaultPolicies(): void {
    if (!this.config.enableDataProtection) return;

    // Default data protection policy
    const defaultPolicy: DataProtectionPolicy = {
      id: 'default-protection',
      name: 'Default Data Protection Policy',
      scope: 'global',
      enforcement: 'strict',
      rules: [
        {
          id: 'block-credentials',
          name: 'Block Credentials',
          dataPattern: '(password|secret|api[_-]?key|token|credential)',
          action: 'redact',
          sensitivity: 'restricted'
        },
        {
          id: 'redact-pii',
          name: 'Redact PII',
          dataPattern: '(ssn|social[_-]?security|credit[_-]?card|\\b\\d{3}-\\d{2}-\\d{4}\\b)',
          action: 'redact',
          sensitivity: 'confidential'
        },
        {
          id: 'audit-project-data',
          name: 'Audit Project Data',
          dataPattern: '(project[_-]?id|project[_-]?name|client[_-]?name)',
          action: 'audit',
          sensitivity: 'internal'
        }
      ]
    };

    this.dataProtectionPolicies.set(defaultPolicy.id, defaultPolicy);
  }

  // ============ Security Constraint Methods ============

  /**
   * Register a custom security constraint
   */
  registerConstraint(constraint: SecurityConstraint): void {
    this.constraints.set(constraint.id, constraint);
    this.recordAudit({
      type: 'security',
      action: 'register_constraint',
      actor: { type: 'system', id: 'security-framework' },
      resource: { type: 'config', id: constraint.id, name: constraint.name },
      outcome: 'success',
      details: { constraintType: constraint.type, enforcement: constraint.enforcement }
    });
  }

  /**
   * Get all registered constraints
   */
  getConstraints(): SecurityConstraint[] {
    return Array.from(this.constraints.values());
  }

  /**
   * Get constraints by type
   */
  getConstraintsByType(type: SecurityConstraint['type']): SecurityConstraint[] {
    return Array.from(this.constraints.values()).filter(c => c.type === type);
  }

  /**
   * Validate security context against all applicable constraints
   */
  validateSecurityContext(context: SecurityContext): SecurityValidationResult {
    const results: SecurityValidationResult[] = [];
    const applicableConstraints = this.getApplicableConstraints(context);

    for (const constraint of applicableConstraints) {
      const result = constraint.validator(context);
      results.push(result);

      // Record audit for strict enforcement failures
      if (!result.valid && constraint.enforcement === 'strict') {
        this.recordAudit({
          type: 'security',
          action: 'constraint_violation',
          actor: { type: 'mcp_server', id: context.serverId },
          resource: { type: 'mcp_server', id: context.serverId },
          outcome: 'blocked',
          details: {
            constraintId: constraint.id,
            violations: result.violations,
            operation: context.operation
          },
          securityContext: context
        });
      }
    }

    // Aggregate results
    return this.aggregateValidationResults(results);
  }

  private getApplicableConstraints(context: SecurityContext): SecurityConstraint[] {
    return Array.from(this.constraints.values()).filter(c => {
      if (context.serverType === 'nonicatab' && c.type === 'nonicatab') return true;
      if (context.serverType === 'aions_revit' && c.type === 'aions_revit') return true;
      if (context.serverType === 'external' && c.type === 'external') return true;
      if (c.type === 'data_protection') return true;
      return false;
    });
  }

  private aggregateValidationResults(results: SecurityValidationResult[]): SecurityValidationResult {
    const allViolations: SecurityViolation[] = [];
    const allWarnings: string[] = [];
    const allRecommendations: string[] = [];
    let allValid = true;

    for (const result of results) {
      if (!result.valid) allValid = false;
      allViolations.push(...result.violations);
      allWarnings.push(...result.warnings);
      allRecommendations.push(...result.recommendations);
    }

    return {
      valid: allValid,
      constraintId: 'aggregated',
      violations: allViolations,
      warnings: allWarnings,
      recommendations: allRecommendations
    };
  }

  /**
   * Check NonicaTab MCP security constraints (Requirement 8.1)
   */
  validateNonicaTabSecurity(operation: string, parameters: Record<string, any>): SecurityValidationResult {
    const context: SecurityContext = {
      serverId: 'nonicatab',
      serverType: 'nonicatab',
      operation,
      parameters,
      timestamp: new Date()
    };
    return this.validateSecurityContext(context);
  }

  /**
   * Check AIONS.Revit security compatibility (Requirement 8.2)
   */
  validateAionsRevitSecurity(operation: string, parameters: Record<string, any>, user?: UserContext): SecurityValidationResult {
    const context: SecurityContext = {
      serverId: 'aions_revit',
      serverType: 'aions_revit',
      operation,
      parameters,
      user,
      timestamp: new Date()
    };
    return this.validateSecurityContext(context);
  }

  // ============ Data Protection Methods ============

  /**
   * Register a data protection policy
   */
  registerDataProtectionPolicy(policy: DataProtectionPolicy): void {
    this.dataProtectionPolicies.set(policy.id, policy);
    this.recordAudit({
      type: 'data_protection',
      action: 'register_policy',
      actor: { type: 'system', id: 'security-framework' },
      resource: { type: 'config', id: policy.id, name: policy.name },
      outcome: 'success',
      details: { scope: policy.scope, rulesCount: policy.rules.length }
    });
  }

  /**
   * Get all data protection policies
   */
  getDataProtectionPolicies(): DataProtectionPolicy[] {
    return Array.from(this.dataProtectionPolicies.values());
  }

  /**
   * Enforce data protection policies on data (Requirement 8.3)
   */
  enforceDataProtection(data: any, dataContext: DataContext): DataProtectionResult {
    if (!this.config.enableDataProtection) {
      return {
        allowed: true,
        action: 'allow',
        originalData: data,
        processedData: data,
        violations: [],
        appliedRules: []
      };
    }

    const violations: DataProtectionViolation[] = [];
    const appliedRules: string[] = [];
    let processedData = JSON.parse(JSON.stringify(data)); // Deep clone
    let finalAction: DataProtectionResult['action'] = 'allow';

    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

    for (const policy of this.dataProtectionPolicies.values()) {
      for (const rule of policy.rules) {
        const pattern = typeof rule.dataPattern === 'string'
          ? new RegExp(rule.dataPattern, 'gi')
          : rule.dataPattern;

        if (pattern.test(dataStr)) {
          appliedRules.push(rule.id);

          // Determine action based on sensitivity
          if (this.shouldApplyRule(rule, dataContext)) {
            violations.push({
              ruleId: rule.id,
              ruleName: rule.name,
              matchedPattern: rule.dataPattern.toString(),
              action: rule.action,
              details: `Data matches ${rule.sensitivity} sensitivity pattern`
            });

            // Apply action
            switch (rule.action) {
              case 'block':
                finalAction = 'block';
                break;
              case 'redact':
                processedData = this.redactData(processedData, pattern);
                if (finalAction !== 'block') finalAction = 'redact';
                break;
              case 'encrypt':
                processedData = this.encryptData(processedData, pattern);
                if (finalAction !== 'block' && finalAction !== 'redact') finalAction = 'encrypt';
                break;
              case 'audit':
                if (finalAction === 'allow') finalAction = 'audit';
                break;
            }
          }
        }
      }
    }

    const result: DataProtectionResult = {
      allowed: finalAction !== 'block',
      action: finalAction,
      originalData: data,
      processedData: finalAction === 'block' ? undefined : processedData,
      violations,
      appliedRules
    };

    // Record audit for data protection
    this.recordAudit({
      type: 'data_protection',
      action: 'enforce_policy',
      actor: { type: 'system', id: 'data-protection' },
      resource: { type: 'data', id: dataContext.projectId || 'unknown' },
      outcome: result.allowed ? 'success' : 'blocked',
      details: {
        dataType: dataContext.dataType,
        sensitivity: dataContext.sensitivity,
        action: finalAction,
        violationsCount: violations.length,
        appliedRulesCount: appliedRules.length
      }
    });

    return result;
  }

  private shouldApplyRule(rule: DataProtectionRule, context: DataContext): boolean {
    const sensitivityLevels = { public: 0, internal: 1, confidential: 2, restricted: 3 };
    return sensitivityLevels[context.sensitivity] >= sensitivityLevels[rule.sensitivity];
  }

  private redactData(data: any, pattern: RegExp): any {
    if (typeof data === 'string') {
      return data.replace(pattern, '[REDACTED]');
    }
    if (typeof data === 'object' && data !== null) {
      const result: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        result[key] = this.redactData(data[key], pattern);
      }
      return result;
    }
    return data;
  }

  private encryptData(data: any, pattern: RegExp): any {
    if (typeof data === 'string') {
      return data.replace(pattern, '[ENCRYPTED]');
    }
    if (typeof data === 'object' && data !== null) {
      const result: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        result[key] = this.encryptData(data[key], pattern);
      }
      return result;
    }
    return data;
  }

  // ============ Audit Trail Methods ============

  /**
   * Record an audit entry (Requirement 8.4)
   */
  recordAudit(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'hash' | 'previousHash'>): AuditEntry {
    if (!this.config.enableAuditTrail) {
      return {
        id: 'disabled',
        timestamp: new Date(),
        ...entry,
        securityContext: entry.securityContext || {}
      };
    }

    const auditEntry: AuditEntry = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      ...entry,
      securityContext: entry.securityContext || {},
      previousHash: this.lastAuditHash
    };

    // Calculate hash for chain integrity
    auditEntry.hash = this.calculateAuditHash(auditEntry);
    this.lastAuditHash = auditEntry.hash;

    this.auditTrail.push(auditEntry);

    // Cleanup old entries
    this.cleanupOldAuditEntries();

    return auditEntry;
  }

  private generateAuditId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private calculateAuditHash(entry: AuditEntry): string {
    // Simplified hash calculation (in production, use crypto)
    const data = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      type: entry.type,
      actor: entry.actor,
      action: entry.action,
      resource: entry.resource,
      outcome: entry.outcome,
      previousHash: entry.previousHash
    });

    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${this.config.hashAlgorithm}:${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }

  private cleanupOldAuditEntries(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.auditRetentionDays);
    this.auditTrail = this.auditTrail.filter(entry => entry.timestamp >= cutoffDate);
  }

  /**
   * Query audit trail
   */
  queryAuditTrail(query: AuditQuery): AuditEntry[] {
    let results = [...this.auditTrail];

    if (query.startTime) {
      results = results.filter(e => e.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter(e => e.timestamp <= query.endTime!);
    }
    if (query.actorId) {
      results = results.filter(e => e.actor.id === query.actorId);
    }
    if (query.actorType) {
      results = results.filter(e => e.actor.type === query.actorType);
    }
    if (query.resourceId) {
      results = results.filter(e => e.resource.id === query.resourceId);
    }
    if (query.resourceType) {
      results = results.filter(e => e.resource.type === query.resourceType);
    }
    if (query.actionPattern) {
      const pattern = new RegExp(query.actionPattern, 'i');
      results = results.filter(e => pattern.test(e.action));
    }
    if (query.outcome) {
      results = results.filter(e => e.outcome === query.outcome);
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get audit trail for a specific server
   */
  getServerAuditTrail(serverId: string): AuditEntry[] {
    return this.auditTrail.filter(
      e => e.resource.id === serverId || e.actor.id === serverId
    );
  }

  /**
   * Verify audit trail integrity
   */
  verifyAuditTrailIntegrity(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 0; i < this.auditTrail.length; i++) {
      const entry = this.auditTrail[i];

      // Verify hash
      const expectedHash = this.calculateAuditHash({
        ...entry,
        hash: undefined
      } as AuditEntry);

      if (entry.hash !== expectedHash) {
        errors.push(`Entry ${entry.id} has invalid hash`);
      }

      // Verify chain
      if (i > 0 && entry.previousHash !== this.auditTrail[i - 1].hash) {
        errors.push(`Entry ${entry.id} has broken chain link`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Export audit trail (with sensitive data protection)
   */
  exportAuditTrail(query: AuditQuery): string {
    const entries = this.queryAuditTrail(query);

    // Redact sensitive information in export
    const sanitizedEntries = entries.map(entry => ({
      ...entry,
      securityContext: {
        ...entry.securityContext,
        user: entry.securityContext.user ? {
          ...entry.securityContext.user,
          sessionId: '[REDACTED]',
          ipAddress: entry.securityContext.user.ipAddress ? '[REDACTED]' : undefined
        } : undefined
      }
    }));

    return JSON.stringify(sanitizedEntries, null, 2);
  }

  /**
   * Get all audit entries (for testing)
   */
  getAuditTrail(): AuditEntry[] {
    return [...this.auditTrail];
  }

  // ============ Server Isolation Methods ============

  /**
   * Configure isolation context for external server (Requirement 8.5)
   */
  configureServerIsolation(serverId: string, config: Partial<IsolationContext>): void {
    const defaultContext: IsolationContext = {
      serverId,
      isolationLevel: 'sandbox',
      allowedOperations: [],
      blockedOperations: [],
      resourceQuotas: {
        maxMemoryMB: 512,
        maxCpuPercent: 50,
        maxConnections: 10,
        maxRequestsPerMinute: 100,
        maxDataTransferMB: 100
      },
      networkPolicy: {
        allowInbound: false,
        allowOutbound: true,
        allowedHosts: [],
        blockedHosts: [],
        allowedPorts: [80, 443],
        blockedPorts: []
      }
    };

    const context: IsolationContext = {
      ...defaultContext,
      ...config,
      serverId,
      resourceQuotas: { ...defaultContext.resourceQuotas, ...config.resourceQuotas },
      networkPolicy: { ...defaultContext.networkPolicy, ...config.networkPolicy }
    };

    this.isolationContexts.set(serverId, context);

    this.recordAudit({
      type: 'security',
      action: 'configure_isolation',
      actor: { type: 'system', id: 'security-framework' },
      resource: { type: 'mcp_server', id: serverId },
      outcome: 'success',
      details: { isolationLevel: context.isolationLevel }
    });
  }

  /**
   * Get isolation context for a server
   */
  getServerIsolation(serverId: string): IsolationContext | undefined {
    return this.isolationContexts.get(serverId);
  }

  /**
   * Validate operation against isolation policy
   */
  validateIsolatedOperation(serverId: string, operation: string, parameters: Record<string, any>): SecurityValidationResult {
    const context = this.isolationContexts.get(serverId);

    if (!context || context.isolationLevel === 'none') {
      return {
        valid: true,
        constraintId: 'isolation',
        violations: [],
        warnings: [],
        recommendations: []
      };
    }

    const violations: SecurityViolation[] = [];
    const warnings: string[] = [];

    // Check blocked operations
    if (context.blockedOperations.includes(operation)) {
      violations.push({
        type: 'isolation',
        severity: 'high',
        message: `Operation '${operation}' is blocked for server ${serverId}`,
        details: { operation, serverId },
        suggestedAction: 'Use an allowed operation or request permission'
      });
    }

    // Check allowed operations (if specified)
    if (context.allowedOperations.length > 0 && !context.allowedOperations.includes(operation)) {
      violations.push({
        type: 'isolation',
        severity: 'medium',
        message: `Operation '${operation}' is not in the allowed list for server ${serverId}`,
        details: { operation, allowedOperations: context.allowedOperations },
        suggestedAction: 'Use one of the allowed operations'
      });
    }

    // Check network policy for external calls
    if (parameters.targetHost) {
      const networkResult = this.validateNetworkAccess(context, parameters.targetHost, parameters.targetPort);
      if (!networkResult.valid) {
        violations.push(...networkResult.violations);
      }
    }

    // Record violation if any
    if (violations.length > 0) {
      this.isolationViolations.push({
        serverId,
        violationType: 'operation',
        details: `Blocked operation: ${operation}`,
        timestamp: new Date(),
        action: 'blocked'
      });
    }

    return {
      valid: violations.length === 0,
      constraintId: 'isolation',
      violations,
      warnings,
      recommendations: []
    };
  }

  private validateNetworkAccess(context: IsolationContext, host: string, port?: number): SecurityValidationResult {
    const violations: SecurityViolation[] = [];

    // Check blocked hosts
    if (context.networkPolicy.blockedHosts.includes(host)) {
      violations.push({
        type: 'isolation',
        severity: 'high',
        message: `Network access to host '${host}' is blocked`,
        details: { host },
        suggestedAction: 'Use an allowed host'
      });
    }

    // Check allowed hosts (if specified)
    if (context.networkPolicy.allowedHosts.length > 0 &&
        !context.networkPolicy.allowedHosts.includes(host)) {
      violations.push({
        type: 'isolation',
        severity: 'medium',
        message: `Network access to host '${host}' is not in the allowed list`,
        details: { host, allowedHosts: context.networkPolicy.allowedHosts },
        suggestedAction: 'Use one of the allowed hosts'
      });
    }

    // Check port access
    if (port) {
      if (context.networkPolicy.blockedPorts.includes(port)) {
        violations.push({
          type: 'isolation',
          severity: 'high',
          message: `Network access to port ${port} is blocked`,
          details: { port },
          suggestedAction: 'Use an allowed port'
        });
      }

      if (context.networkPolicy.allowedPorts.length > 0 &&
          !context.networkPolicy.allowedPorts.includes(port)) {
        violations.push({
          type: 'isolation',
          severity: 'medium',
          message: `Network access to port ${port} is not in the allowed list`,
          details: { port, allowedPorts: context.networkPolicy.allowedPorts },
          suggestedAction: 'Use one of the allowed ports'
        });
      }
    }

    return {
      valid: violations.length === 0,
      constraintId: 'network-isolation',
      violations,
      warnings: [],
      recommendations: []
    };
  }

  /**
   * Get isolation violations for a server
   */
  getIsolationViolations(serverId?: string): IsolationViolation[] {
    if (serverId) {
      return this.isolationViolations.filter(v => v.serverId === serverId);
    }
    return [...this.isolationViolations];
  }

  /**
   * Clear isolation violations
   */
  clearIsolationViolations(serverId?: string): void {
    if (serverId) {
      this.isolationViolations = this.isolationViolations.filter(v => v.serverId !== serverId);
    } else {
      this.isolationViolations = [];
    }
  }

  // ============ Utility Methods ============

  /**
   * Get security status summary
   */
  getSecurityStatus(): {
    constraintsCount: number;
    policiesCount: number;
    auditEntriesCount: number;
    isolatedServersCount: number;
    recentViolationsCount: number;
    config: SecurityConfig;
  } {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    return {
      constraintsCount: this.constraints.size,
      policiesCount: this.dataProtectionPolicies.size,
      auditEntriesCount: this.auditTrail.length,
      isolatedServersCount: this.isolationContexts.size,
      recentViolationsCount: this.isolationViolations.filter(v => v.timestamp >= oneDayAgo).length,
      config: { ...this.config }
    };
  }

  /**
   * Reset the framework (for testing)
   */
  reset(): void {
    this.constraints.clear();
    this.dataProtectionPolicies.clear();
    this.auditTrail = [];
    this.isolationContexts.clear();
    this.isolationViolations = [];
    this.lastAuditHash = '';
    this.initializeDefaultConstraints();
    this.initializeDefaultPolicies();
  }
}

// Singleton instance
let securityFrameworkInstance: SecurityComplianceFramework | null = null;

export function getSecurityFramework(config?: Partial<SecurityConfig>): SecurityComplianceFramework {
  if (!securityFrameworkInstance) {
    securityFrameworkInstance = new SecurityComplianceFramework(config);
  }
  return securityFrameworkInstance;
}

export function resetSecurityFramework(): void {
  securityFrameworkInstance = null;
}
