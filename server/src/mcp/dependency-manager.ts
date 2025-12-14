/**
 * UVX/UV Dependency Manager
 * Provides installation guidance, dependency checking, and error handling
 */

import { execSync } from 'child_process';

export interface DependencyCheckResult {
  installed: boolean;
  version?: string;
  error?: string;
}

export interface InstallationGuidance {
  tool: 'uv' | 'uvx';
  platform: 'windows' | 'macos' | 'linux';
  methods: InstallationMethod[];
  documentationUrl: string;
}

export interface InstallationMethod {
  name: string;
  command: string;
  description: string;
  recommended?: boolean;
}

export class MCPDependencyManager {
  private platform: NodeJS.Platform;

  constructor() {
    this.platform = process.platform;
  }

  /**
   * Check if uv is installed
   */
  checkUvInstalled(): DependencyCheckResult {
    return this.checkCommand('uv', ['--version']);
  }

  /**
   * Check if uvx is installed
   */
  checkUvxInstalled(): DependencyCheckResult {
    return this.checkCommand('uvx', ['--version']);
  }

  /**
   * Check if a command is available
   */
  private checkCommand(command: string, args: string[]): DependencyCheckResult {
    try {
      const result = execSync(`${command} ${args.join(' ')}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });

      const version = this.parseVersion(result);
      return { installed: true, version };
    } catch (error) {
      return {
        installed: false,
        error: `${command} is not installed or not in PATH`,
      };
    }
  }

  /**
   * Parse version from command output
   */
  private parseVersion(output: string): string | undefined {
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : output.trim();
  }

  /**
   * Get installation guidance for uv/uvx
   */
  getInstallationGuidance(tool: 'uv' | 'uvx' = 'uv'): InstallationGuidance {
    const platform = this.getPlatformName();
    const methods = this.getInstallationMethods(platform);

    return {
      tool,
      platform,
      methods,
      documentationUrl: 'https://docs.astral.sh/uv/getting-started/installation/',
    };
  }

  /**
   * Get platform name
   */
  private getPlatformName(): 'windows' | 'macos' | 'linux' {
    switch (this.platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      default:
        return 'linux';
    }
  }

  /**
   * Get installation methods for the platform
   */
  private getInstallationMethods(
    platform: 'windows' | 'macos' | 'linux'
  ): InstallationMethod[] {
    const methods: InstallationMethod[] = [];

    // Standalone installer (recommended for all platforms)
    if (platform === 'windows') {
      methods.push({
        name: 'PowerShell Installer',
        command: 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
        description: 'Official standalone installer for Windows',
        recommended: true,
      });
    } else {
      methods.push({
        name: 'Shell Installer',
        command: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
        description: 'Official standalone installer',
        recommended: true,
      });
    }

    // pip (all platforms)
    methods.push({
      name: 'pip',
      command: 'pip install uv',
      description: 'Install via Python package manager',
    });

    // pipx (all platforms)
    methods.push({
      name: 'pipx',
      command: 'pipx install uv',
      description: 'Install in isolated environment via pipx',
    });

    // Platform-specific package managers
    if (platform === 'macos') {
      methods.push({
        name: 'Homebrew',
        command: 'brew install uv',
        description: 'Install via Homebrew package manager',
      });
    }

    if (platform === 'windows') {
      methods.push({
        name: 'winget',
        command: 'winget install --id=astral-sh.uv -e',
        description: 'Install via Windows Package Manager',
      });
      methods.push({
        name: 'Scoop',
        command: 'scoop install uv',
        description: 'Install via Scoop package manager',
      });
    }

    if (platform === 'linux') {
      methods.push({
        name: 'Homebrew',
        command: 'brew install uv',
        description: 'Install via Homebrew (Linux)',
      });
    }

    return methods;
  }

  /**
   * Check all MCP-related dependencies
   */
  checkAllDependencies(): {
    uv: DependencyCheckResult;
    uvx: DependencyCheckResult;
    allInstalled: boolean;
  } {
    const uv = this.checkUvInstalled();
    const uvx = this.checkUvxInstalled();

    return {
      uv,
      uvx,
      allInstalled: uv.installed && uvx.installed,
    };
  }

  /**
   * Get formatted installation instructions
   */
  getFormattedInstructions(): string {
    const guidance = this.getInstallationGuidance();
    const lines: string[] = [];

    lines.push('# UV/UVX Installation Guide');
    lines.push('');
    lines.push(`Platform: ${guidance.platform}`);
    lines.push('');
    lines.push('## Installation Methods');
    lines.push('');

    for (const method of guidance.methods) {
      const recommended = method.recommended ? ' (Recommended)' : '';
      lines.push(`### ${method.name}${recommended}`);
      lines.push('');
      lines.push(method.description);
      lines.push('');
      lines.push('```');
      lines.push(method.command);
      lines.push('```');
      lines.push('');
    }

    lines.push('## Documentation');
    lines.push('');
    lines.push(`For more information, visit: ${guidance.documentationUrl}`);
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    lines.push('- Once uv is installed, uvx is automatically available');
    lines.push('- uvx runs Python packages without explicit installation');
    lines.push('- MCP servers using uvx will download and run automatically');

    return lines.join('\n');
  }

  /**
   * Handle missing dependency error
   */
  handleMissingDependency(serverCommand: string): {
    error: string;
    guidance: InstallationGuidance;
    formattedMessage: string;
  } {
    const guidance = this.getInstallationGuidance();
    const recommendedMethod = guidance.methods.find((m) => m.recommended);

    const formattedMessage = [
      `Error: The command "${serverCommand}" requires uv/uvx to be installed.`,
      '',
      'To install uv (which includes uvx):',
      '',
      recommendedMethod
        ? `  ${recommendedMethod.command}`
        : '  Visit https://docs.astral.sh/uv/getting-started/installation/',
      '',
      'After installation, restart your terminal and try again.',
    ].join('\n');

    return {
      error: `${serverCommand} requires uv/uvx which is not installed`,
      guidance,
      formattedMessage,
    };
  }

  /**
   * Validate server command dependencies
   */
  validateServerCommand(command: string): {
    valid: boolean;
    missingDependency?: string;
    guidance?: InstallationGuidance;
  } {
    if (command === 'uvx') {
      const check = this.checkUvxInstalled();
      if (!check.installed) {
        return {
          valid: false,
          missingDependency: 'uvx',
          guidance: this.getInstallationGuidance('uvx'),
        };
      }
    }

    if (command === 'uv') {
      const check = this.checkUvInstalled();
      if (!check.installed) {
        return {
          valid: false,
          missingDependency: 'uv',
          guidance: this.getInstallationGuidance('uv'),
        };
      }
    }

    return { valid: true };
  }
}
