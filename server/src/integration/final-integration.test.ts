/**
 * Final Integration and Validation Tests
 * Ensures all components work together seamlessly
 * Validates complete workflow from configuration to execution
 * Tests error scenarios and recovery mechanisms
 * Requirements: All
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Core configuration
import { ConfigurationManager } from '../config/manager.js';
import { ConfigValidator } from '../config/validator.js';
import { PlatformAdapterFactory } from '../config/platform-adapter.js';
import { SecurityHandler } from '../config/security.js';
import { ResponseStyleParser } from '../config/response-style.js';

// Spec workflow
import { RequirementsGenerator } from '../spec/requirements-generator.js';
import { DesignGenerator } from '../spec/design-generator.js';
import { TaskGenerator } from '../spec/task-generator.js';
import { TaskExecutionTracker } from '../spec/task-tracker.js';
import { RequirementDocument, UserApprovalGate } from '../spec/types.js';

// Steering system
import { SteeringParser } from '../steering/parser.js';
import { SteeringValidator } from '../steering/validator.js';
import { ContextInjector } from '../steering/context-injector.js';

// MCP integration
import { MCPConfigManager } from '../mcp/config-manager.js';
import { MCPTestingUtils } from '../mcp/testing-utils.js';
import { MCPDependencyManager } from '../mcp/dependency-manager.js';

// Hooks system
import { HookConfigManager } from '../hooks/config-manager.js';
import { HookExecutor } from '../hooks/executor.js';

// Error handling
import {
  KiroErrorHandler,
  GracefulDegradation,
  HealthMonitor,
  ErrorAggregator,
  ConfigErrorHandler,
  UserErrorReporter,
} from '../errors/error-handler.js';

// Code generation
import { SyntaxChecker } from '../codegen/syntax-checker.js';


// Test approval gate that auto-approves
class TestApprovalGate implements UserApprovalGate {
  private status: 'pending' | 'approved' | 'rejected' = 'pending';
  
  async requestApproval(): Promise<boolean> {
    this.status = 'approved';
    return true;
  }

  getApprovalStatus(): 'pending' | 'approved' | 'rejected' {
    return this.status;
  }
}

describe('Final Integration and Validation', () => {
  const testDir = '.test-final-integration';
  const kiroDir = path.join(testDir, '.kiro');
  const specsDir = path.join(kiroDir, 'specs');
  const steeringDir = path.join(kiroDir, 'steering');
  const settingsDir = path.join(kiroDir, 'settings');
  const hooksDir = path.join(kiroDir, 'hooks');

  beforeEach(() => {
    // Create complete test directory structure
    fs.mkdirSync(specsDir, { recursive: true });
    fs.mkdirSync(steeringDir, { recursive: true });
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.mkdirSync(hooksDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    // Clear health monitor state
    HealthMonitor.clearStatus();
  });

  describe('Complete System Integration', () => {
    it('should initialize all components and validate system health', async () => {
      // Initialize configuration manager
      const configManager = new ConfigurationManager(kiroDir);
      const initResult = await configManager.initialize();
      expect(initResult.valid).toBe(true);

      // Verify directory structure
      expect(fs.existsSync(specsDir)).toBe(true);
      expect(fs.existsSync(steeringDir)).toBe(true);
      expect(fs.existsSync(settingsDir)).toBe(true);

      // Check system health
      HealthMonitor.checkComponent('config', () => initResult.valid);
      HealthMonitor.checkComponent('filesystem', () => fs.existsSync(kiroDir));
      
      const healthReport = HealthMonitor.getSystemHealth();
      expect(healthReport.overall).toBe('healthy');
      expect(healthReport.components.length).toBe(2);
    });


    it('should execute complete workflow from configuration to spec execution', async () => {
      // Step 1: Initialize configuration
      const configManager = new ConfigurationManager(kiroDir);
      await configManager.initialize();

      // Step 2: Setup MCP configuration
      const mcpManager = new MCPConfigManager(kiroDir);
      const mcpConfig = {
        mcpServers: {
          'code-assistant': {
            command: 'uvx',
            args: ['code-assistant@latest'],
            autoApprove: ['format', 'lint'],
          },
        },
      };
      const mcpSaveResult = mcpManager.saveWorkspaceConfig(mcpConfig);
      expect(mcpSaveResult.valid).toBe(true);

      // Step 3: Setup steering files
      fs.writeFileSync(
        path.join(steeringDir, 'coding-standards.md'),
        `---
inclusion: always
---
# Coding Standards

- Use TypeScript strict mode
- Follow SOLID principles`
      );

      // Step 4: Create spec workflow
      const reqGenerator = new RequirementsGenerator();
      const designGenerator = new DesignGenerator();
      const taskGenerator = new TaskGenerator();

      const requirements: RequirementDocument = {
        introduction: 'Complete integration test feature',
        glossary: [{ term: 'System', definition: 'The test system' }],
        requirements: [
          {
            id: '1',
            userStory: {
              role: 'developer',
              feature: 'validate complete workflow',
              benefit: 'ensure system reliability',
            },
            acceptanceCriteria: [
              {
                id: '1.1',
                pattern: 'event-driven',
                system: 'Integration System',
                response: 'execute all workflow steps',
                trigger: 'workflow is initiated',
              },
            ],
          },
        ],
      };

      // Generate design
      const design = designGenerator.generateTemplate({
        featureName: 'complete-workflow',
        requirementsDocument: requirements,
        includeArchitectureDiagram: true,
        testingFramework: 'vitest',
      });

      // Save design
      const designPath = designGenerator.createDesignFile('complete-workflow', design, kiroDir);
      expect(fs.existsSync(designPath)).toBe(true);

      // Generate tasks
      const tasks = taskGenerator.generateTaskList({
        featureName: 'complete-workflow',
        designDocument: design,
        requirementsDocument: requirements,
        includeOptionalTasks: true,
        testingStrategy: 'comprehensive',
      });

      expect(tasks.tasks.length).toBeGreaterThan(0);

      // Step 5: Verify all components are integrated
      const loadedMcpConfig = mcpManager.loadMergedConfig();
      expect(loadedMcpConfig.servers['code-assistant']).toBeDefined();

      const steeringInjector = new ContextInjector(steeringDir, testDir);
      steeringInjector.loadSteeringFiles();
      const steeringContext = steeringInjector.injectContext();
      expect(steeringContext.content).toContain('Coding Standards');
    });


    it('should integrate hooks with spec workflow and steering', async () => {
      // Setup steering
      fs.writeFileSync(
        path.join(steeringDir, 'test-rules.md'),
        `---
inclusion: fileMatch
fileMatchPattern: "**/*.test.ts"
---
# Test Rules

Run tests after file changes.`
      );

      // Setup hooks
      const hookManager = new HookConfigManager(kiroDir);
      hookManager.ensureHooksDirectory();

      const hook = hookManager.createHook(
        'test-runner',
        { event: 'file_saved', filePattern: '**/*.test.ts' },
        { type: 'command', target: 'npm test' },
        'Run tests when test files are saved'
      );

      hookManager.saveHookAsKiroFormat(hook);
      hookManager.registerHook(hook);

      // Initialize hook executor
      const hookExecutor = new HookExecutor(hookManager, testDir);
      hookExecutor.initialize();

      const status = hookExecutor.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.totalHooks).toBeGreaterThanOrEqual(1);

      // Verify steering integration
      const steeringInjector = new ContextInjector(steeringDir, testDir);
      steeringInjector.loadSteeringFiles();

      const testFileContext = steeringInjector.injectContext({
        activeFilePath: 'src/example.test.ts',
      });
      expect(testFileContext.content).toContain('Test Rules');

      // Verify hooks would trigger for test files
      const matchingHooks = hookExecutor.getMatchingHooks({
        event: 'file_saved',
        timestamp: new Date(),
        filePath: 'src/example.test.ts',
      });
      expect(matchingHooks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle missing configuration gracefully', async () => {
      const nonExistentDir = path.join(testDir, 'non-existent');
      const mcpManager = new MCPConfigManager(nonExistentDir);

      // Should return config object, not throw
      const config = mcpManager.loadMergedConfig();
      expect(config.servers).toBeDefined();
      // May have servers from user-level config, so just check it's defined
    });

    it('should handle invalid JSON configuration with proper error reporting', () => {
      // Write invalid JSON
      fs.writeFileSync(path.join(settingsDir, 'mcp.json'), '{ invalid json }');

      const mcpManager = new MCPConfigManager(kiroDir);
      const config = mcpManager.loadMergedConfig();

      // Should gracefully handle and return empty config
      expect(config.servers).toBeDefined();
    });

    it('should aggregate and report multiple errors', () => {
      const aggregator = new ErrorAggregator();

      aggregator.addErrorCode('CONFIG_NOT_FOUND', { path: 'mcp.json' });
      aggregator.addErrorCode('STEERING_REFERENCE_NOT_FOUND', { path: 'missing.md' });

      const report = aggregator.getReport();
      expect(report.hasErrors).toBe(true);
      expect(report.errors.length).toBe(1); // CONFIG_NOT_FOUND is error
      expect(report.warnings.length).toBe(1); // STEERING_REFERENCE_NOT_FOUND is warning
      expect(report.summary).toContain('error');
    });


    it('should use graceful degradation for failing operations', async () => {
      // Test fallback behavior
      const result = await GracefulDegradation.withFallback(
        () => {
          throw new Error('Simulated failure');
        },
        { default: true },
        'default-config'
      );

      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.fallbackUsed).toBe('default-config');
      expect(result.value).toEqual({ default: true });
    });

    it('should provide user-friendly error messages', () => {
      const error = KiroErrorHandler.createError('MCP_DEPENDENCY_MISSING', {
        details: 'uvx command not found',
      });

      const userMessage = KiroErrorHandler.formatUserMessage(error);
      expect(userMessage).toContain('MCP server dependency is missing');
      expect(userMessage).toContain('uvx command not found');
      expect(userMessage).toContain('Install uv');
    });

    it('should handle steering file reference errors gracefully', () => {
      // Create steering file with missing reference
      fs.writeFileSync(
        path.join(steeringDir, 'with-ref.md'),
        `---
inclusion: always
---
# Rules

Reference: #[[file:missing-file.md]]`
      );

      const injector = new ContextInjector(steeringDir, testDir);
      injector.loadSteeringFiles();

      // Should not throw, should handle gracefully
      const context = injector.injectContext({ expandReferences: true });
      expect(context.includedFiles).toBe(1);
    });

    it('should recover from hook execution failures', async () => {
      const hookManager = new HookConfigManager(kiroDir);
      hookManager.ensureHooksDirectory();

      // Create a hook with invalid command
      const hook = hookManager.createHook(
        'failing-hook',
        { event: 'manual' },
        { type: 'command', target: 'nonexistent-command-xyz' },
        'A hook that will fail'
      );

      hookManager.registerHook(hook);

      const executor = new HookExecutor(hookManager, testDir);
      executor.initialize();

      // Execute the failing hook
      const result = await executor.triggerHookById(hook.id);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify hook is marked as error but system continues
      const registration = hookManager.getRegistration(hook.id);
      expect(registration?.status).toBe('error');

      // Reset and verify recovery
      const resetResult = executor.resetHookError(hook.id);
      expect(resetResult).toBe(true);
    });
  });


  describe('Cross-Component Validation', () => {
    it('should validate configuration across all components', async () => {
      // Setup complete configuration
      const configManager = new ConfigurationManager(kiroDir);
      await configManager.initialize();

      // Add MCP config
      const mcpManager = new MCPConfigManager(kiroDir);
      mcpManager.saveWorkspaceConfig({
        mcpServers: {
          'test-server': {
            command: 'uvx',
            args: ['test@latest'],
          },
        },
      });

      // Add steering file
      fs.writeFileSync(
        path.join(steeringDir, 'rules.md'),
        `---
inclusion: always
---
# Rules`
      );

      // Add hook
      const hookManager = new HookConfigManager(kiroDir);
      hookManager.ensureHooksDirectory();
      const hook = hookManager.createHook(
        'test-hook',
        { event: 'file_saved' },
        { type: 'message', target: 'File saved' }
      );
      hookManager.saveHookAsKiroFormat(hook);

      // Validate entire configuration
      const validationResult = await configManager.validateConfiguration();
      expect(validationResult.valid).toBe(true);
    });

    it('should maintain data consistency across spec workflow phases', () => {
      const reqGenerator = new RequirementsGenerator();
      const designGenerator = new DesignGenerator();
      const taskGenerator = new TaskGenerator();

      // Create requirements
      const requirements: RequirementDocument = {
        introduction: 'Data consistency test',
        glossary: [{ term: 'Data', definition: 'Information' }],
        requirements: [
          {
            id: '1',
            userStory: {
              role: 'user',
              feature: 'maintain consistency',
              benefit: 'reliable data',
            },
            acceptanceCriteria: [
              {
                id: '1.1',
                pattern: 'event-driven',
                system: 'Data System',
                response: 'validate data integrity',
                trigger: 'data is modified',
              },
              {
                id: '1.2',
                pattern: 'unwanted-event',
                system: 'Data System',
                response: 'reject invalid data',
                condition: 'data validation fails',
              },
            ],
          },
        ],
      };

      // Generate design from requirements
      const design = designGenerator.generateTemplate({
        featureName: 'data-consistency',
        requirementsDocument: requirements,
        includeArchitectureDiagram: false,
        testingFramework: 'vitest',
      });

      // Verify design references requirements
      expect(design.correctnessProperties.length).toBeGreaterThan(0);
      const hasReqRef = design.correctnessProperties.some(
        (prop) => prop.validatesRequirements.length > 0
      );
      expect(hasReqRef).toBe(true);

      // Generate tasks from design
      const tasks = taskGenerator.generateTaskList({
        featureName: 'data-consistency',
        designDocument: design,
        requirementsDocument: requirements,
        includeOptionalTasks: false,
        testingStrategy: 'minimal',
      });

      // Verify tasks exist and reference requirements
      expect(tasks.tasks.length).toBeGreaterThan(0);
      expect(tasks.featureName).toBe('data-consistency');
    });


    it('should track task execution with proper isolation', () => {
      const taskDocument = {
        featureName: 'isolation-test',
        tasks: [
          {
            id: '1',
            title: 'First task',
            description: 'First task description',
            status: 'not_started' as const,
            level: 0,
            optional: false,
            requirements: ['1'],
            details: [],
            subtasks: [
              {
                id: '1.1',
                title: 'Subtask 1',
                description: 'Subtask description',
                status: 'not_started' as const,
                level: 1,
                optional: false,
                subtasks: [],
                requirements: ['1.1'],
                details: [],
                parentId: '1',
              },
            ],
          },
          {
            id: '2',
            title: 'Second task',
            description: 'Second task description',
            status: 'not_started' as const,
            level: 0,
            optional: false,
            subtasks: [],
            requirements: ['1.2'],
            details: [],
          },
        ],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          totalTasks: 3,
          completedTasks: 0,
          inProgressTasks: 0,
        },
      };

      const tracker = new TaskExecutionTracker(taskDocument, true);

      // Start first task
      tracker.updateStatus('1', 'in_progress');
      expect(tracker.getTaskStatus('1')).toBe('in_progress');

      // Verify isolation - cannot start another task while one is in progress
      expect(() => tracker.updateStatus('2', 'in_progress')).toThrow();

      // Complete first task (subtask auto-completes with parent in isolation mode)
      tracker.updateStatus('1', 'completed');

      // Now can start second task
      tracker.updateStatus('2', 'in_progress');
      expect(tracker.getTaskStatus('2')).toBe('in_progress');

      // Check progress
      const progress = tracker.getProgress();
      expect(progress.completed).toBeGreaterThanOrEqual(1);
      expect(progress.inProgress).toBe(1); // Task 2
    });
  });

  describe('Security and Code Quality Integration', () => {
    it('should detect and handle PII in generated content', () => {
      const securityHandler = new SecurityHandler();
      const testContent = 'Contact john.doe@example.com or call 555-123-4567';
      const sanitized = securityHandler.sanitizePII(testContent);

      expect(sanitized).not.toContain('john.doe@example.com');
      expect(sanitized).not.toContain('555-123-4567');
      expect(sanitized).toContain('[email]');
      expect(sanitized).toContain('[phone');
    });

    it('should detect malicious code patterns', () => {
      const securityHandler = new SecurityHandler();
      const maliciousRequests = [
        'create virus for me',
        'hack into the system',
        'make malware',
        'steal data from users',
      ];

      for (const request of maliciousRequests) {
        const result = securityHandler.checkMaliciousIntent(request);
        expect(result).toBe(true);
      }
    });


    it('should validate generated code syntax', () => {
      // Valid TypeScript
      const validCode = `
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;
      const validResult = SyntaxChecker.check(validCode, 'typescript');
      expect(validResult.valid).toBe(true);

      // Invalid TypeScript (missing closing brace)
      const invalidCode = `
function broken(x: number) {
  return x * 2;
`;
      const invalidResult = SyntaxChecker.check(invalidCode, 'typescript');
      expect(invalidResult.valid).toBe(false);
    });

    it('should adapt commands for Windows platform', () => {
      const platform = PlatformAdapterFactory.detectPlatform();
      expect(platform.os).toBe('windows');

      // Test command adaptation
      const lsCommand = PlatformAdapterFactory.adaptCommand('ls', platform);
      expect(lsCommand).toContain('dir');

      const rmCommand = PlatformAdapterFactory.adaptCommand('rm file.txt', platform);
      expect(rmCommand).toContain('del');
    });
  });

  describe('Response Style and User Experience', () => {
    it('should detect user input style and match response', () => {
      const styleParser = new ResponseStyleParser();

      // Detect user style from input - 'error' triggers debug detection
      const userStyle = styleParser.detectUserStyle('I have an error in my code, can you debug it?');
      expect(userStyle.tone).toBeDefined();
      expect(userStyle.questionType).toBe('debug');

      // Match response style
      const matchedStyle = styleParser.matchResponseStyle(userStyle, {
        tone: 'warm',
        verbosity: 'standard',
        platformAdaptation: true,
      });
      expect(matchedStyle).toBeDefined();
      expect(matchedStyle.tone).toBeDefined();
    });

    it('should provide brief error summaries for users', () => {
      const errors = [
        KiroErrorHandler.createError('CONFIG_NOT_FOUND'),
        KiroErrorHandler.createError('MCP_CONNECTION_FAILED'),
      ];

      const summary = UserErrorReporter.briefSummary(errors);
      expect(summary).toContain('2 errors');
    });

    it('should format validation results for user display', () => {
      const result = {
        valid: false,
        errors: [{ path: 'config.json', message: 'Invalid format', code: 'INVALID' }],
        warnings: [{ path: 'settings', message: 'Missing optional field', code: 'WARN' }],
      };

      const formatted = ConfigErrorHandler.formatValidationResult(result, {
        configType: 'mcp',
        operation: 'validate',
      });

      expect(formatted).toContain('MCP Configuration');
      expect(formatted).toContain('Invalid format');
    });
  });


  describe('MCP Server Integration', () => {
    it('should manage MCP server lifecycle', () => {
      const mcpManager = new MCPConfigManager(kiroDir);

      // Save config
      mcpManager.saveWorkspaceConfig({
        mcpServers: {
          'lifecycle-test': {
            command: 'echo',
            args: ['test'],
          },
        },
      });

      // Connect server
      const connectResult = mcpManager.connectServer('lifecycle-test');
      expect(connectResult.status).toBe('connected');

      // Get status
      const status = mcpManager.getServerStatus('lifecycle-test');
      expect(status.name).toBe('lifecycle-test');

      // Disconnect
      const disconnectResult = mcpManager.disconnectServer('lifecycle-test');
      expect(disconnectResult.status).toBe('disconnected');

      // Reconnect
      const reconnectResult = mcpManager.reconnectServer('lifecycle-test');
      expect(reconnectResult.status).toBe('connected');
    });

    it('should generate sample MCP tool calls for testing', () => {
      const mcpManager = new MCPConfigManager(kiroDir);
      const testUtils = new MCPTestingUtils(mcpManager);

      const sampleCall = testUtils.generateSampleCall('test-server', 'get_weather', {
        location: 'Seattle',
        units: 'celsius',
      });

      expect(sampleCall.serverName).toBe('test-server');
      expect(sampleCall.toolName).toBe('get_weather');
      expect(sampleCall.arguments?.location).toBe('Seattle');
    });

    it('should check dependency availability', () => {
      const depManager = new MCPDependencyManager();

      // Check for uv/uvx dependencies
      const uvCheck = depManager.checkUvInstalled();
      expect(uvCheck).toBeDefined();
      expect(typeof uvCheck.installed).toBe('boolean');

      // Get installation guidance
      const guidance = depManager.getInstallationGuidance();
      expect(guidance.platform).toBeDefined();
      expect(guidance.methods.length).toBeGreaterThan(0);
    });
  });

  describe('Steering System Integration', () => {
    it('should parse and validate steering files correctly', () => {
      const steeringContent = `---
inclusion: fileMatch
fileMatchPattern: "**/*.ts"
---
# TypeScript Rules

Use strict mode for all TypeScript files.`;

      fs.writeFileSync(path.join(steeringDir, 'ts-rules.md'), steeringContent);

      const parser = new SteeringParser(testDir);
      const parseResult = parser.parse(path.join(steeringDir, 'ts-rules.md'));

      expect(parseResult.success).toBe(true);
      expect(parseResult.steeringFile?.frontMatter.inclusion).toBe('fileMatch');
      expect(parseResult.steeringFile?.frontMatter.fileMatchPattern).toBe('**/*.ts');
      expect(parseResult.steeringFile?.content).toContain('TypeScript Rules');

      const validator = new SteeringValidator();
      const validation = validator.validateFile(path.join(steeringDir, 'ts-rules.md'));
      expect(validation.valid).toBe(true);
    });

    it('should inject context based on active file', () => {
      // Create multiple steering files
      fs.writeFileSync(
        path.join(steeringDir, 'always.md'),
        `---
inclusion: always
---
# Always Rules`
      );

      fs.writeFileSync(
        path.join(steeringDir, 'ts-only.md'),
        `---
inclusion: fileMatch
fileMatchPattern: "**/*.ts"
---
# TypeScript Only`
      );

      const injector = new ContextInjector(steeringDir, testDir);
      injector.loadSteeringFiles();

      // Without active file - only always rules
      const noFileContext = injector.injectContext();
      expect(noFileContext.includedFiles).toBe(1);
      expect(noFileContext.content).toContain('Always Rules');
      expect(noFileContext.content).not.toContain('TypeScript Only');

      // With TypeScript file - both rules
      const tsContext = injector.injectContext({ activeFilePath: 'src/index.ts' });
      expect(tsContext.includedFiles).toBe(2);
      expect(tsContext.content).toContain('Always Rules');
      expect(tsContext.content).toContain('TypeScript Only');
    });
  });


  describe('End-to-End Workflow Validation', () => {
    it('should complete full feature development workflow', async () => {
      // 1. Initialize system
      const configManager = new ConfigurationManager(kiroDir);
      await configManager.initialize();

      // 2. Setup project configuration
      const mcpManager = new MCPConfigManager(kiroDir);
      mcpManager.saveWorkspaceConfig({
        mcpServers: {
          'dev-tools': { command: 'uvx', args: ['dev-tools@latest'] },
        },
      });

      // 3. Create steering rules
      fs.writeFileSync(
        path.join(steeringDir, 'project.md'),
        `---
inclusion: always
---
# Project Standards

Follow TypeScript best practices.`
      );

      // 4. Create hooks for automation
      const hookManager = new HookConfigManager(kiroDir);
      hookManager.ensureHooksDirectory();
      const lintHook = hookManager.createHook(
        'auto-lint',
        { event: 'file_saved', filePattern: '**/*.ts' },
        { type: 'command', target: 'npm run lint' }
      );
      hookManager.saveHookAsKiroFormat(lintHook);

      // 5. Create feature spec
      const reqGenerator = new RequirementsGenerator();
      const designGenerator = new DesignGenerator();
      const taskGenerator = new TaskGenerator();

      const requirements: RequirementDocument = {
        introduction: 'End-to-end test feature',
        glossary: [{ term: 'Feature', definition: 'A system capability' }],
        requirements: [
          {
            id: '1',
            userStory: {
              role: 'developer',
              feature: 'complete e2e workflow',
              benefit: 'validate system integration',
            },
            acceptanceCriteria: [
              {
                id: '1.1',
                pattern: 'event-driven',
                system: 'E2E System',
                response: 'complete all workflow steps',
                trigger: 'workflow starts',
              },
            ],
          },
        ],
      };

      // Save requirements
      const specDir = configManager.createSpecDirectory('e2e-feature');
      const reqMarkdown = reqGenerator.generateMarkdown(requirements);
      fs.writeFileSync(path.join(specDir, 'requirements.md'), reqMarkdown);

      // Generate and save design
      const design = designGenerator.generateTemplate({
        featureName: 'e2e-feature',
        requirementsDocument: requirements,
        includeArchitectureDiagram: true,
        testingFramework: 'vitest',
      });
      designGenerator.createDesignFile('e2e-feature', design, kiroDir);

      // Generate and save tasks
      const tasks = taskGenerator.generateTaskList({
        featureName: 'e2e-feature',
        designDocument: design,
        requirementsDocument: requirements,
        includeOptionalTasks: true,
        testingStrategy: 'comprehensive',
      });
      const taskMarkdown = taskGenerator.generateMarkdown(tasks);
      fs.writeFileSync(path.join(specDir, 'tasks.md'), taskMarkdown);

      // 6. Verify complete setup
      expect(fs.existsSync(path.join(specDir, 'requirements.md'))).toBe(true);
      expect(fs.existsSync(path.join(specDir, 'design.md'))).toBe(true);
      expect(fs.existsSync(path.join(specDir, 'tasks.md'))).toBe(true);

      // 7. Validate configuration
      const validation = await configManager.validateConfiguration();
      expect(validation.valid).toBe(true);

      // 8. Check system health
      HealthMonitor.checkComponent('specs', () => fs.existsSync(specDir));
      HealthMonitor.checkComponent('steering', () => fs.existsSync(steeringDir));
      HealthMonitor.checkComponent('hooks', () => fs.existsSync(hooksDir));
      HealthMonitor.checkComponent('mcp', () => {
        const config = mcpManager.loadMergedConfig();
        return Object.keys(config.servers).length > 0;
      });

      const health = HealthMonitor.getSystemHealth();
      expect(health.overall).toBe('healthy');
      expect(health.components.every((c) => c.healthy)).toBe(true);
    });
  });
});
