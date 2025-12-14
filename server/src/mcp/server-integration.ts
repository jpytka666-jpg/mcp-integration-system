/**
 * MCP Server Integration
 * Handles server command execution, response handling, and error management
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import { MCPConfigManager } from './config-manager.js';
import { MCPDependencyManager } from './dependency-manager.js';
import {
  MCPServerConfig,
  MCPServerStatus,
  MCPToolCall,
  MCPToolResult,
} from './types.js';

export interface ServerExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

export interface ServerProcess {
  name: string;
  process: ChildProcess;
  status: 'starting' | 'running' | 'stopped' | 'error';
  startTime: Date;
}

export class MCPServerIntegration {
  private configManager: MCPConfigManager;
  private dependencyManager: MCPDependencyManager;
  private runningProcesses: Map<string, ServerProcess> = new Map();

  constructor(configManager: MCPConfigManager) {
    this.configManager = configManager;
    this.dependencyManager = new MCPDependencyManager();
  }

  /**
   * Execute a server command synchronously
   */
  executeServerCommand(
    serverName: string,
    timeout: number = 30000
  ): ServerExecutionResult {
    const config = this.configManager.loadMergedConfig();
    const serverConfig = config.servers[serverName];

    if (!serverConfig) {
      return {
        success: false,
        error: `Server "${serverName}" not found in configuration`,
      };
    }

    if (serverConfig.disabled) {
      return {
        success: false,
        error: `Server "${serverName}" is disabled`,
      };
    }

    // Check dependencies
    const depCheck = this.dependencyManager.validateServerCommand(serverConfig.command);
    if (!depCheck.valid) {
      const guidance = this.dependencyManager.handleMissingDependency(serverConfig.command);
      return {
        success: false,
        error: guidance.formattedMessage,
      };
    }

    try {
      const command = this.buildCommand(serverConfig);
      const env = { ...process.env, ...serverConfig.env };

      const output = execSync(command, {
        encoding: 'utf-8',
        timeout,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.configManager.updateServerStatus(serverName, 'connected');

      return {
        success: true,
        output: output.trim(),
        exitCode: 0,
      };
    } catch (error: unknown) {
      const execError = error as { status?: number; stderr?: Buffer; message?: string };
      const errorMessage = execError.stderr?.toString() || execError.message || 'Unknown error';
      
      this.configManager.updateServerStatus(serverName, 'error', errorMessage);

      return {
        success: false,
        error: errorMessage,
        exitCode: execError.status,
      };
    }
  }

  /**
   * Start a server process asynchronously
   */
  startServer(serverName: string): ServerExecutionResult {
    const config = this.configManager.loadMergedConfig();
    const serverConfig = config.servers[serverName];

    if (!serverConfig) {
      return {
        success: false,
        error: `Server "${serverName}" not found in configuration`,
      };
    }

    if (serverConfig.disabled) {
      return {
        success: false,
        error: `Server "${serverName}" is disabled`,
      };
    }

    // Check if already running
    if (this.runningProcesses.has(serverName)) {
      const existing = this.runningProcesses.get(serverName)!;
      if (existing.status === 'running') {
        return {
          success: true,
          output: `Server "${serverName}" is already running`,
        };
      }
    }

    // Check dependencies
    const depCheck = this.dependencyManager.validateServerCommand(serverConfig.command);
    if (!depCheck.valid) {
      const guidance = this.dependencyManager.handleMissingDependency(serverConfig.command);
      return {
        success: false,
        error: guidance.formattedMessage,
      };
    }

    try {
      const env = { ...process.env, ...serverConfig.env };
      const childProcess = spawn(serverConfig.command, serverConfig.args || [], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      const serverProcess: ServerProcess = {
        name: serverName,
        process: childProcess,
        status: 'starting',
        startTime: new Date(),
      };

      childProcess.on('spawn', () => {
        serverProcess.status = 'running';
        this.configManager.updateServerStatus(serverName, 'connected');
      });

      childProcess.on('error', (err) => {
        serverProcess.status = 'error';
        this.configManager.updateServerStatus(serverName, 'error', err.message);
      });

      childProcess.on('exit', (code) => {
        serverProcess.status = 'stopped';
        this.configManager.updateServerStatus(
          serverName,
          code === 0 ? 'disconnected' : 'error',
          code !== 0 ? `Process exited with code ${code}` : undefined
        );
        this.runningProcesses.delete(serverName);
      });

      this.runningProcesses.set(serverName, serverProcess);

      return {
        success: true,
        output: `Server "${serverName}" started`,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.configManager.updateServerStatus(serverName, 'error', err.message);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Stop a running server
   */
  stopServer(serverName: string): ServerExecutionResult {
    const serverProcess = this.runningProcesses.get(serverName);

    if (!serverProcess) {
      return {
        success: false,
        error: `Server "${serverName}" is not running`,
      };
    }

    try {
      serverProcess.process.kill();
      this.runningProcesses.delete(serverName);
      this.configManager.updateServerStatus(serverName, 'disconnected');

      return {
        success: true,
        output: `Server "${serverName}" stopped`,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        error: `Failed to stop server: ${err.message}`,
      };
    }
  }

  /**
   * Restart a server
   */
  restartServer(serverName: string): ServerExecutionResult {
    const stopResult = this.stopServer(serverName);
    if (!stopResult.success && !stopResult.error?.includes('not running')) {
      return stopResult;
    }

    return this.startServer(serverName);
  }

  /**
   * Get running server info
   */
  getRunningServer(serverName: string): ServerProcess | undefined {
    return this.runningProcesses.get(serverName);
  }

  /**
   * Get all running servers
   */
  getAllRunningServers(): ServerProcess[] {
    return Array.from(this.runningProcesses.values());
  }

  /**
   * Handle server response
   */
  handleServerResponse(response: string): MCPToolResult {
    try {
      const parsed = JSON.parse(response);
      return {
        success: true,
        result: parsed,
      };
    } catch {
      // Response is not JSON, return as string
      return {
        success: true,
        result: response,
      };
    }
  }

  /**
   * Handle server error
   */
  handleServerError(error: string, serverName: string): MCPToolResult {
    // Check for common error patterns
    if (error.includes('ENOENT') || error.includes('not found')) {
      const config = this.configManager.loadMergedConfig();
      const serverConfig = config.servers[serverName];
      
      if (serverConfig?.command === 'uvx' || serverConfig?.command === 'uv') {
        const guidance = this.dependencyManager.handleMissingDependency(serverConfig.command);
        return {
          success: false,
          error: guidance.formattedMessage,
        };
      }
    }

    if (error.includes('ETIMEDOUT') || error.includes('timeout')) {
      return {
        success: false,
        error: `Server "${serverName}" timed out. The server may be unresponsive or overloaded.`,
      };
    }

    if (error.includes('ECONNREFUSED')) {
      return {
        success: false,
        error: `Connection refused to server "${serverName}". Ensure the server is running and accessible.`,
      };
    }

    return {
      success: false,
      error: `Server error: ${error}`,
    };
  }

  /**
   * Build command string from server config
   */
  private buildCommand(config: MCPServerConfig): string {
    const args = config.args || [];
    return `${config.command} ${args.join(' ')}`.trim();
  }

  /**
   * Check if a server is healthy
   */
  isServerHealthy(serverName: string): boolean {
    const serverProcess = this.runningProcesses.get(serverName);
    if (!serverProcess) {
      return false;
    }

    return serverProcess.status === 'running' && !serverProcess.process.killed;
  }

  /**
   * Get server uptime in milliseconds
   */
  getServerUptime(serverName: string): number | null {
    const serverProcess = this.runningProcesses.get(serverName);
    if (!serverProcess || serverProcess.status !== 'running') {
      return null;
    }

    return Date.now() - serverProcess.startTime.getTime();
  }

  /**
   * Stop all running servers
   */
  stopAllServers(): Map<string, ServerExecutionResult> {
    const results = new Map<string, ServerExecutionResult>();
    
    for (const serverName of this.runningProcesses.keys()) {
      results.set(serverName, this.stopServer(serverName));
    }

    return results;
  }
}
