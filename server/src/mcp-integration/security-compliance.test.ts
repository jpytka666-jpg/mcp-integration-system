/**
 * Security and Compliance Framework Property Tests
 * Properties 36-40 for Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  SecurityComplianceFramework,
  SecurityConstraint,
  SecurityContext,
  SecurityValidationResult,
  UserContext,
  DataContext,
  DataProtectionPolicy,
  DataProtectionRule,
  IsolationContext,
  AuditEntry,
  AuditQuery
} from './security-compliance.js';

// ============ Arbitraries for Property Testing ============

const serverTypeArb = fc.constantFrom('nonicatab', 'aions_revit', 'external') as fc.Arbitrary<'nonicatab' | 'aions_revit' | 'external'>;
const sensitivityArb = fc.constantFrom('public', 'internal', 'confidential', 'restricted') as fc.Arbitrary<'public' | 'internal' | 'confidential' | 'restricted'>;
const isolationLevelArb = fc.constantFrom('none', 'sandbox', 'strict') as fc.Arbitrary<'none' | 'sandbox' | 'strict'>;
const outcomeArb = fc.constantFrom('success', 'failure', 'partial', 'blocked') as fc.Arbitrary<'success' | 'failure' | 'partial' | 'blocked'>;

const operationArb = fc.constantFrom(
  'get_active_view_in_revit',
  'get_user_selection_in_revit',
  'get_elements_by_category',
  'get_parameters_from_elementid',
  'unknown_operation',
  'blocked_operation'
);

const userContextArb = fc.record({
  userId: fc.string({ minLength: 1, maxLength: 20 }),
  roles: fc.array(fc.constantFrom('admin', 'user', 'viewer'), { minLength: 0, maxLength: 3 }),
  permissions: fc.array(fc.constantFrom('aions_revit_access', 'read', 'write'), { minLength: 0, maxLength: 3 }),
  sessionId: fc.uuid(),
  ipAddress: fc.option(fc.ipV4())
});

const dataContextArb = fc.record({
  dataType: fc.constantFrom('revit_element', 'geometry', 'parameter', 'family'),
  sensitivity: sensitivityArb,
  projectId: fc.option(fc.uuid()),
  containsPII: fc.boolean(),
  containsSecrets: fc.boolean()
});

const securityContextArb = fc.record({
  serverId: fc.string({ minLength: 1, maxLength: 20 }),
  serverType: serverTypeArb,
  operation: operationArb,
  parameters: fc.record({
    aiConnectorEnabled: fc.option(fc.boolean()),
    revitConnected: fc.option(fc.boolean()),
    tool: fc.option(operationArb),
    skipToolValidation: fc.option(fc.boolean()),
    skipPermissionCheck: fc.option(fc.boolean()),
    skipSessionValidation: fc.option(fc.boolean()),
    addinVersion: fc.option(fc.constantFrom('0.9.0', '1.0.0', '1.1.0', '2.0.0'))
  }),
  timestamp: fc.date()
});

const networkPolicyArb = fc.record({
  allowInbound: fc.boolean(),
  allowOutbound: fc.boolean(),
  allowedHosts: fc.array(fc.domain(), { minLength: 0, maxLength: 3 }),
  blockedHosts: fc.array(fc.domain(), { minLength: 0, maxLength: 3 }),
  allowedPorts: fc.array(fc.integer({ min: 1, max: 65535 }), { minLength: 0, maxLength: 5 }),
  blockedPorts: fc.array(fc.integer({ min: 1, max: 65535 }), { minLength: 0, maxLength: 5 })
});

const resourceQuotaArb = fc.record({
  maxMemoryMB: fc.integer({ min: 64, max: 4096 }),
  maxCpuPercent: fc.integer({ min: 1, max: 100 }),
  maxConnections: fc.integer({ min: 1, max: 100 }),
  maxRequestsPerMinute: fc.integer({ min: 1, max: 1000 }),
  maxDataTransferMB: fc.integer({ min: 1, max: 1000 })
});

const isolationContextArb = fc.record({
  serverId: fc.string({ minLength: 1, maxLength: 20 }),
  isolationLevel: isolationLevelArb,
  allowedOperations: fc.array(operationArb, { minLength: 0, maxLength: 5 }),
  blockedOperations: fc.array(operationArb, { minLength: 0, maxLength: 5 }),
  resourceQuotas: resourceQuotaArb,
  networkPolicy: networkPolicyArb
});

const dataProtectionRuleArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  dataPattern: fc.constantFrom('password', 'secret', 'api_key', 'token', 'ssn'),
  action: fc.constantFrom('block', 'redact', 'encrypt', 'audit', 'allow') as fc.Arbitrary<'block' | 'redact' | 'encrypt' | 'audit' | 'allow'>,
  sensitivity: sensitivityArb
});

const dataProtectionPolicyArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  rules: fc.array(dataProtectionRuleArb, { minLength: 1, maxLength: 5 }),
  scope: fc.constantFrom('global', 'project', 'server') as fc.Arbitrary<'global' | 'project' | 'server'>,
  enforcement: fc.constantFrom('strict', 'warning') as fc.Arbitrary<'strict' | 'warning'>
});

// ============ Property Tests ============

describe('Security and Compliance Framework - Property Tests', () => {

  // ========== Property 36: Security Constraint Compliance (Requirement 8.1) ==========
  describe('Property 36: Security Constraint Compliance', () => {

    it('should validate NonicaTab security constraints consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            operation: operationArb,
            aiConnectorEnabled: fc.boolean(),
            revitConnected: fc.boolean(),
            tool: fc.option(operationArb)
          }),
          (params) => {
            const framework = new SecurityComplianceFramework();

            const result = framework.validateNonicaTabSecurity(params.operation, {
              aiConnectorEnabled: params.aiConnectorEnabled,
              revitConnected: params.revitConnected,
              tool: params.tool ?? undefined
            });

            // Property: Result must have valid structure
            expect(result).toHaveProperty('valid');
            expect(result).toHaveProperty('constraintId');
            expect(result).toHaveProperty('violations');
            expect(result).toHaveProperty('warnings');
            expect(result).toHaveProperty('recommendations');
            expect(Array.isArray(result.violations)).toBe(true);

            // Property: When AI connector is disabled, validation should fail
            if (!params.aiConnectorEnabled) {
              expect(result.valid).toBe(false);
              expect(result.violations.some(v => v.message.includes('AI Connector'))).toBe(true);
            }

            // Property: When Revit is not connected, validation should fail
            if (!params.revitConnected) {
              expect(result.valid).toBe(false);
              expect(result.violations.some(v => v.message.includes('Revit'))).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should enforce AI Connector requirement strictly', () => {
      fc.assert(
        fc.property(operationArb, (operation) => {
          const framework = new SecurityComplianceFramework();

          // Test with AI Connector disabled
          const resultDisabled = framework.validateNonicaTabSecurity(operation, {
            aiConnectorEnabled: false,
            revitConnected: true
          });

          // Test with AI Connector enabled
          const resultEnabled = framework.validateNonicaTabSecurity(operation, {
            aiConnectorEnabled: true,
            revitConnected: true,
            skipToolValidation: true
          });

          // Property: Disabled AI Connector must fail
          expect(resultDisabled.valid).toBe(false);

          // Property: Enabled AI Connector (with valid params) should pass
          expect(resultEnabled.valid).toBe(true);
        }),
        { numRuns: 30 }
      );
    });

    it('should validate tool whitelist for NonicaTab', () => {
      const validTools = [
        'get_active_view_in_revit',
        'get_user_selection_in_revit',
        'get_elements_by_category'
      ];
      const invalidTools = ['malicious_tool', 'unknown_tool', 'hack_revit'];

      fc.assert(
        fc.property(
          fc.constantFrom(...validTools),
          fc.constantFrom(...invalidTools),
          (validTool, invalidTool) => {
            const framework = new SecurityComplianceFramework();

            // Test valid tool
            const validResult = framework.validateNonicaTabSecurity(validTool, {
              aiConnectorEnabled: true,
              revitConnected: true,
              tool: validTool
            });

            // Test invalid tool
            const invalidResult = framework.validateNonicaTabSecurity(invalidTool, {
              aiConnectorEnabled: true,
              revitConnected: true,
              tool: invalidTool
            });

            // Property: Valid tools should pass
            expect(validResult.valid).toBe(true);

            // Property: Invalid tools should fail
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.violations.some(v => v.message.includes('not in the allowed'))).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ========== Property 37: Addin Security Model Compatibility (Requirement 8.2) ==========
  describe('Property 37: Addin Security Model Compatibility', () => {

    it('should validate AIONS.Revit user permissions consistently', () => {
      fc.assert(
        fc.property(
          operationArb,
          userContextArb,
          (operation, user) => {
            const framework = new SecurityComplianceFramework();

            const result = framework.validateAionsRevitSecurity(operation, {}, user as UserContext);

            // Property: Result structure must be valid
            expect(result).toHaveProperty('valid');
            expect(Array.isArray(result.violations)).toBe(true);

            // Property: User with aions_revit_access permission should pass permission check
            const hasPermission = user.permissions.includes('aions_revit_access');
            const hasSession = !!user.sessionId;

            if (hasPermission && hasSession) {
              // Both permission and session are valid
              expect(result.valid).toBe(true);
            }

            // Property: User without permission should have permission violation
            if (!hasPermission) {
              expect(result.violations.some(v => v.type === 'permission')).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should require valid session for AIONS.Revit operations', () => {
      fc.assert(
        fc.property(
          operationArb,
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 10 }),
            roles: fc.constant(['user']),
            permissions: fc.constant(['aions_revit_access']),
            sessionId: fc.constantFrom('', 'valid-session-123')
          }),
          (operation, userSpec) => {
            const framework = new SecurityComplianceFramework();

            const user: UserContext = {
              userId: userSpec.userId,
              roles: userSpec.roles,
              permissions: userSpec.permissions,
              sessionId: userSpec.sessionId
            };

            const result = framework.validateAionsRevitSecurity(operation, {}, user);

            // Property: Empty session should fail
            if (!userSpec.sessionId) {
              expect(result.valid).toBe(false);
              expect(result.violations.some(v => v.message.includes('session'))).toBe(true);
            }

            // Property: Valid session with permission should pass
            if (userSpec.sessionId) {
              expect(result.valid).toBe(true);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should warn about outdated addin versions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('0.5.0', '0.9.0', '0.9.9'),
          fc.constantFrom('1.0.0', '1.1.0', '2.0.0'),
          (oldVersion, newVersion) => {
            const framework = new SecurityComplianceFramework();

            const user: UserContext = {
              userId: 'test-user',
              roles: ['user'],
              permissions: ['aions_revit_access'],
              sessionId: 'valid-session'
            };

            // Test with old version
            const oldResult = framework.validateAionsRevitSecurity('test_op', {
              addinVersion: oldVersion
            }, user);

            // Test with new version
            const newResult = framework.validateAionsRevitSecurity('test_op', {
              addinVersion: newVersion
            }, user);

            // Property: Old version should generate warnings
            expect(oldResult.warnings.length).toBeGreaterThan(0);
            expect(oldResult.warnings.some(w => w.includes('compatibility'))).toBe(true);

            // Property: New version should not generate warnings
            expect(newResult.warnings.length).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow skipPermissionCheck to bypass permission validation', () => {
      fc.assert(
        fc.property(operationArb, (operation) => {
          const framework = new SecurityComplianceFramework();

          // User without permission
          const user: UserContext = {
            userId: 'test-user',
            roles: ['guest'],
            permissions: [], // No permissions
            sessionId: 'valid-session'
          };

          // Without skip
          const resultWithoutSkip = framework.validateAionsRevitSecurity(operation, {}, user);

          // With skip
          const resultWithSkip = framework.validateAionsRevitSecurity(operation, {
            skipPermissionCheck: true,
            skipSessionValidation: true
          }, user);

          // Property: Without skip should fail
          expect(resultWithoutSkip.valid).toBe(false);

          // Property: With skip should pass
          expect(resultWithSkip.valid).toBe(true);
        }),
        { numRuns: 20 }
      );
    });
  });

  // ========== Property 38: Data Protection Policy Compliance (Requirement 8.3) ==========
  describe('Property 38: Data Protection Policy Compliance', () => {

    it('should consistently enforce data protection rules', () => {
      fc.assert(
        fc.property(
          dataContextArb,
          fc.record({
            hasPassword: fc.boolean(),
            hasApiKey: fc.boolean(),
            hasProjectId: fc.boolean()
          }),
          (context, dataFlags) => {
            const framework = new SecurityComplianceFramework();

            // Build test data based on flags
            const testData: Record<string, string> = {};
            if (dataFlags.hasPassword) testData.password = 'secret123';
            if (dataFlags.hasApiKey) testData.apiKey = 'key-abc-123';
            if (dataFlags.hasProjectId) testData.projectId = 'proj-123';

            const result = framework.enforceDataProtection(testData, context as DataContext);

            // Property: Result must have valid structure
            expect(result).toHaveProperty('allowed');
            expect(result).toHaveProperty('action');
            expect(result).toHaveProperty('violations');
            expect(result).toHaveProperty('appliedRules');

            // Property: Sensitive data should trigger rules based on sensitivity level
            if (dataFlags.hasPassword || dataFlags.hasApiKey) {
              if (context.sensitivity === 'restricted' || context.sensitivity === 'confidential') {
                expect(result.appliedRules.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should redact sensitive data correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('password', 'secret', 'api_key', 'token'),
          (sensitiveWord) => {
            const framework = new SecurityComplianceFramework();

            const testData = {
              field: `my_${sensitiveWord}_value`,
              nested: {
                inner: `contains_${sensitiveWord}_here`
              }
            };

            const context: DataContext = {
              dataType: 'config',
              sensitivity: 'restricted',
              containsPII: false,
              containsSecrets: true
            };

            const result = framework.enforceDataProtection(testData, context);

            // Property: Processed data should have redacted values
            if (result.processedData) {
              const processedStr = JSON.stringify(result.processedData);
              expect(processedStr).toContain('[REDACTED]');
            }

            // Property: Original data should be preserved
            const originalStr = JSON.stringify(result.originalData);
            expect(originalStr).toContain(sensitiveWord);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should block data when block action is configured', () => {
      const framework = new SecurityComplianceFramework();

      // Register policy with block action
      const blockPolicy: DataProtectionPolicy = {
        id: 'block-test',
        name: 'Block Test Policy',
        scope: 'global',
        enforcement: 'strict',
        rules: [{
          id: 'block-forbidden',
          name: 'Block Forbidden Data',
          dataPattern: 'FORBIDDEN',
          action: 'block',
          sensitivity: 'public'
        }]
      };

      framework.registerDataProtectionPolicy(blockPolicy);

      fc.assert(
        fc.property(
          fc.boolean(),
          (includeForbidden) => {
            const testData = includeForbidden
              ? { data: 'contains FORBIDDEN content' }
              : { data: 'normal content' };

            const context: DataContext = {
              dataType: 'test',
              sensitivity: 'public',
              containsPII: false,
              containsSecrets: false
            };

            const result = framework.enforceDataProtection(testData, context);

            // Property: FORBIDDEN data should be blocked
            if (includeForbidden) {
              expect(result.allowed).toBe(false);
              expect(result.action).toBe('block');
              expect(result.processedData).toBeUndefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should respect sensitivity levels in data protection', () => {
      const framework = new SecurityComplianceFramework();

      // Add rule with 'confidential' sensitivity
      framework.registerDataProtectionPolicy({
        id: 'sensitivity-test',
        name: 'Sensitivity Test',
        scope: 'global',
        enforcement: 'strict',
        rules: [{
          id: 'confidential-rule',
          name: 'Confidential Rule',
          dataPattern: 'SENSITIVE',
          action: 'redact',
          sensitivity: 'confidential'
        }]
      });

      fc.assert(
        fc.property(
          sensitivityArb,
          (sensitivity) => {
            const testData = { field: 'SENSITIVE_DATA' };
            const context: DataContext = {
              dataType: 'test',
              sensitivity,
              containsPII: false,
              containsSecrets: false
            };

            const result = framework.enforceDataProtection(testData, context);

            // Property: Only confidential and restricted should trigger the rule
            const shouldTrigger = sensitivity === 'confidential' || sensitivity === 'restricted';

            if (shouldTrigger) {
              expect(result.appliedRules).toContain('confidential-rule');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ========== Property 39: Secure Audit Trail Implementation (Requirement 8.4) ==========
  describe('Property 39: Secure Audit Trail Implementation', () => {

    it('should maintain audit trail integrity with hash chain', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              action: fc.string({ minLength: 1, maxLength: 20 }),
              actorId: fc.string({ minLength: 1, maxLength: 10 }),
              resourceId: fc.string({ minLength: 1, maxLength: 10 }),
              outcome: outcomeArb
            }),
            { minLength: 3, maxLength: 10 }
          ),
          (entries) => {
            const framework = new SecurityComplianceFramework();

            // Record multiple audit entries
            for (const entry of entries) {
              framework.recordAudit({
                type: 'operation',
                action: entry.action,
                actor: { type: 'user', id: entry.actorId },
                resource: { type: 'data', id: entry.resourceId },
                outcome: entry.outcome,
                details: {}
              });
            }

            // Verify integrity
            const integrityResult = framework.verifyAuditTrailIntegrity();

            // Property: Audit trail should maintain integrity
            expect(integrityResult.valid).toBe(true);
            expect(integrityResult.errors).toHaveLength(0);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should record all audit entries with proper structure', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom('operation', 'access', 'security', 'compliance', 'data_protection') as fc.Arbitrary<AuditEntry['type']>,
            action: fc.string({ minLength: 1, maxLength: 30 }),
            actorType: fc.constantFrom('user', 'system', 'mcp_server', 'workflow') as fc.Arbitrary<'user' | 'system' | 'mcp_server' | 'workflow'>,
            actorId: fc.string({ minLength: 1, maxLength: 20 }),
            resourceType: fc.constantFrom('mcp_server', 'workflow', 'data', 'file', 'config') as fc.Arbitrary<'mcp_server' | 'workflow' | 'data' | 'file' | 'config'>,
            resourceId: fc.string({ minLength: 1, maxLength: 20 }),
            outcome: outcomeArb
          }),
          (spec) => {
            const framework = new SecurityComplianceFramework();

            const entry = framework.recordAudit({
              type: spec.type,
              action: spec.action,
              actor: { type: spec.actorType, id: spec.actorId },
              resource: { type: spec.resourceType, id: spec.resourceId },
              outcome: spec.outcome,
              details: { test: true }
            });

            // Property: Entry must have all required fields
            expect(entry.id).toBeTruthy();
            expect(entry.timestamp).toBeInstanceOf(Date);
            expect(entry.type).toBe(spec.type);
            expect(entry.action).toBe(spec.action);
            expect(entry.actor.type).toBe(spec.actorType);
            expect(entry.actor.id).toBe(spec.actorId);
            expect(entry.resource.type).toBe(spec.resourceType);
            expect(entry.resource.id).toBe(spec.resourceId);
            expect(entry.outcome).toBe(spec.outcome);
            expect(entry.hash).toBeTruthy();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should support audit trail querying with filters', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              actorId: fc.constantFrom('user1', 'user2', 'system'),
              resourceId: fc.constantFrom('server1', 'server2', 'data1'),
              outcome: outcomeArb
            }),
            { minLength: 5, maxLength: 20 }
          ),
          fc.constantFrom('user1', 'user2', 'system'),
          (entries, filterActorId) => {
            const framework = new SecurityComplianceFramework();

            // Record entries
            for (const entry of entries) {
              framework.recordAudit({
                type: 'operation',
                action: 'test_action',
                actor: { type: 'user', id: entry.actorId },
                resource: { type: 'data', id: entry.resourceId },
                outcome: entry.outcome,
                details: {}
              });
            }

            // Query with filter
            const query: AuditQuery = { actorId: filterActorId };
            const results = framework.queryAuditTrail(query);

            // Property: All results should match the filter
            for (const result of results) {
              expect(result.actor.id).toBe(filterActorId);
            }

            // Property: Count should match filtered entries
            const expectedCount = entries.filter(e => e.actorId === filterActorId).length;
            // Account for default policy registration audit entries
            expect(results.length).toBeGreaterThanOrEqual(expectedCount);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should redact sensitive data in audit exports', () => {
      const framework = new SecurityComplianceFramework();

      fc.assert(
        fc.property(
          fc.uuid(),
          fc.ipV4(),
          (sessionId, ipAddress) => {
            // Record entry with sensitive user context
            framework.recordAudit({
              type: 'access',
              action: 'login',
              actor: { type: 'user', id: 'test-user' },
              resource: { type: 'data', id: 'test-resource' },
              outcome: 'success',
              details: {},
              securityContext: {
                serverId: 'test',
                serverType: 'nonicatab',
                operation: 'login',
                parameters: {},
                user: {
                  userId: 'test-user',
                  roles: ['user'],
                  permissions: ['read'],
                  sessionId,
                  ipAddress
                },
                timestamp: new Date()
              }
            });

            // Export audit trail
            const exported = framework.exportAuditTrail({});
            const parsed = JSON.parse(exported);

            // Property: Session ID should be redacted
            for (const entry of parsed) {
              if (entry.securityContext?.user) {
                expect(entry.securityContext.user.sessionId).toBe('[REDACTED]');
                if (entry.securityContext.user.ipAddress) {
                  expect(entry.securityContext.user.ipAddress).toBe('[REDACTED]');
                }
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should support pagination in audit queries', () => {
      const framework = new SecurityComplianceFramework();

      // Record 20 entries
      for (let i = 0; i < 20; i++) {
        framework.recordAudit({
          type: 'operation',
          action: `action_${i}`,
          actor: { type: 'user', id: 'test' },
          resource: { type: 'data', id: `resource_${i}` },
          outcome: 'success',
          details: {}
        });
      }

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 15 }),
          fc.integer({ min: 1, max: 10 }),
          (offset, limit) => {
            const results = framework.queryAuditTrail({ offset, limit });

            // Property: Results should respect limit
            expect(results.length).toBeLessThanOrEqual(limit);

            // Property: Different offsets should return different results (if available)
            const results2 = framework.queryAuditTrail({ offset: offset + limit, limit });
            if (results.length > 0 && results2.length > 0) {
              expect(results[0].id).not.toBe(results2[0].id);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ========== Property 40: External Server Security Isolation (Requirement 8.5) ==========
  describe('Property 40: External Server Security Isolation', () => {

    it('should enforce operation restrictions for isolated servers', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(operationArb, { minLength: 1, maxLength: 5 }),
          fc.array(operationArb, { minLength: 1, maxLength: 5 }),
          operationArb,
          (serverId, allowedOps, blockedOps, testOperation) => {
            const framework = new SecurityComplianceFramework();

            // Configure isolation
            framework.configureServerIsolation(serverId, {
              isolationLevel: 'strict',
              allowedOperations: allowedOps,
              blockedOperations: blockedOps
            });

            // Validate operation
            const result = framework.validateIsolatedOperation(serverId, testOperation, {});

            // Property: Blocked operations should always fail
            if (blockedOps.includes(testOperation)) {
              expect(result.valid).toBe(false);
              expect(result.violations.some(v => v.type === 'isolation')).toBe(true);
            }

            // Property: Operations not in allowed list should fail (when list is non-empty)
            if (allowedOps.length > 0 && !allowedOps.includes(testOperation) && !blockedOps.includes(testOperation)) {
              expect(result.valid).toBe(false);
            }

            // Property: Allowed operations (not blocked) should pass
            if (allowedOps.includes(testOperation) && !blockedOps.includes(testOperation)) {
              expect(result.valid).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should enforce network policy restrictions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(fc.domain(), { minLength: 1, maxLength: 3 }),
          fc.array(fc.domain(), { minLength: 1, maxLength: 3 }),
          fc.domain(),
          (serverId, allowedHosts, blockedHosts, targetHost) => {
            const framework = new SecurityComplianceFramework();

            // Configure isolation with network policy
            framework.configureServerIsolation(serverId, {
              isolationLevel: 'sandbox',
              networkPolicy: {
                allowInbound: false,
                allowOutbound: true,
                allowedHosts,
                blockedHosts,
                allowedPorts: [80, 443],
                blockedPorts: []
              }
            });

            // Test network access
            const result = framework.validateIsolatedOperation(serverId, 'network_call', {
              targetHost
            });

            // Property: Blocked hosts should always be rejected
            if (blockedHosts.includes(targetHost)) {
              expect(result.valid).toBe(false);
              expect(result.violations.some(v => v.message.includes('blocked'))).toBe(true);
            }

            // Property: Hosts not in allowed list should be rejected (when list is non-empty)
            if (allowedHosts.length > 0 && !allowedHosts.includes(targetHost) && !blockedHosts.includes(targetHost)) {
              expect(result.valid).toBe(false);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should track isolation violations', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(operationArb, { minLength: 1, maxLength: 3 }),
          fc.integer({ min: 1, max: 5 }),
          (serverId, blockedOps, attemptCount) => {
            const framework = new SecurityComplianceFramework();

            // Configure isolation with blocked operations
            framework.configureServerIsolation(serverId, {
              isolationLevel: 'strict',
              blockedOperations: blockedOps
            });

            // Clear previous violations
            framework.clearIsolationViolations();

            // Attempt blocked operations
            for (let i = 0; i < attemptCount; i++) {
              for (const op of blockedOps) {
                framework.validateIsolatedOperation(serverId, op, {});
              }
            }

            // Get violations
            const violations = framework.getIsolationViolations(serverId);

            // Property: Violations should be tracked
            expect(violations.length).toBe(attemptCount * blockedOps.length);

            // Property: All violations should be for the correct server
            for (const violation of violations) {
              expect(violation.serverId).toBe(serverId);
              expect(violation.action).toBe('blocked');
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should respect isolation levels', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          isolationLevelArb,
          operationArb,
          (serverId, level, operation) => {
            const framework = new SecurityComplianceFramework();

            // Configure with specific isolation level
            framework.configureServerIsolation(serverId, {
              isolationLevel: level,
              blockedOperations: ['blocked_operation']
            });

            const result = framework.validateIsolatedOperation(serverId, operation, {});

            // Property: 'none' isolation should allow everything
            if (level === 'none') {
              expect(result.valid).toBe(true);
            }

            // Property: 'sandbox' and 'strict' should enforce blocked operations
            if ((level === 'sandbox' || level === 'strict') && operation === 'blocked_operation') {
              expect(result.valid).toBe(false);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should enforce port restrictions in network policy', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(fc.integer({ min: 1, max: 65535 }), { minLength: 1, maxLength: 5 }),
          fc.array(fc.integer({ min: 1, max: 65535 }), { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 65535 }),
          (serverId, allowedPorts, blockedPorts, targetPort) => {
            const framework = new SecurityComplianceFramework();

            // Configure isolation with port policy
            framework.configureServerIsolation(serverId, {
              isolationLevel: 'sandbox',
              networkPolicy: {
                allowInbound: false,
                allowOutbound: true,
                allowedHosts: ['allowed.com'],
                blockedHosts: [],
                allowedPorts,
                blockedPorts
              }
            });

            // Test port access
            const result = framework.validateIsolatedOperation(serverId, 'network_call', {
              targetHost: 'allowed.com',
              targetPort
            });

            // Property: Blocked ports should be rejected
            if (blockedPorts.includes(targetPort)) {
              expect(result.valid).toBe(false);
              expect(result.violations.some(v => v.message.includes('port'))).toBe(true);
            }

            // Property: Ports not in allowed list should be rejected
            if (allowedPorts.length > 0 && !allowedPorts.includes(targetPort) && !blockedPorts.includes(targetPort)) {
              expect(result.valid).toBe(false);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should provide security status summary', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (serverCount) => {
            const framework = new SecurityComplianceFramework();

            // Configure multiple servers
            for (let i = 0; i < serverCount; i++) {
              framework.configureServerIsolation(`server-${i}`, {
                isolationLevel: 'sandbox'
              });
            }

            // Get status
            const status = framework.getSecurityStatus();

            // Property: Status should reflect configured state
            expect(status.isolatedServersCount).toBe(serverCount);
            expect(status.constraintsCount).toBeGreaterThan(0);
            expect(status.policiesCount).toBeGreaterThan(0);
            expect(status.config).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
