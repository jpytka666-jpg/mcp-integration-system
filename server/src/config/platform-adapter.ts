/**
 * Platform-specific command adapters for Windows
 */

export interface PlatformInfo {
  os: 'windows' | 'linux' | 'macos';
  shell: 'cmd' | 'powershell' | 'bash' | 'zsh';
  pathSeparator: string;
}

export interface CommandAdapter {
  listFiles: (path?: string) => string;
  removeFile: (file: string) => string;
  removeDirectory: (dir: string) => string;
  copyFile: (source: string, destination: string) => string;
  copyDirectory: (source: string, destination: string) => string;
  createDirectory: (dir: string) => string;
  viewFile: (file: string) => string;
  findInFiles: (pattern: string, path?: string) => string;
  commandSeparator: string;
}

export class WindowsCmdAdapter implements CommandAdapter {
  commandSeparator = '&';

  listFiles(path = '.'): string {
    return `dir ${path}`;
  }

  removeFile(file: string): string {
    return `del "${file}"`;
  }

  removeDirectory(dir: string): string {
    return `rmdir /s /q "${dir}"`;
  }

  copyFile(source: string, destination: string): string {
    return `copy "${source}" "${destination}"`;
  }

  copyDirectory(source: string, destination: string): string {
    return `xcopy "${source}" "${destination}" /e /i`;
  }

  createDirectory(dir: string): string {
    return `mkdir "${dir}"`;
  }

  viewFile(file: string): string {
    return `type "${file}"`;
  }

  findInFiles(pattern: string, path = '.'): string {
    if (path === '.') {
      return `findstr /s /i "${pattern}" "*.*"`;
    }
    return `findstr /s /i "${pattern}" "${path}\\*.*"`;
  }
}

export class WindowsPowerShellAdapter implements CommandAdapter {
  commandSeparator = ';';

  listFiles(path = '.'): string {
    return `Get-ChildItem ${path}`;
  }

  removeFile(file: string): string {
    return `Remove-Item "${file}"`;
  }

  removeDirectory(dir: string): string {
    return `Remove-Item -Recurse -Force "${dir}"`;
  }

  copyFile(source: string, destination: string): string {
    return `Copy-Item "${source}" "${destination}"`;
  }

  copyDirectory(source: string, destination: string): string {
    return `Copy-Item -Recurse "${source}" "${destination}"`;
  }

  createDirectory(dir: string): string {
    return `New-Item -ItemType Directory -Path "${dir}"`;
  }

  viewFile(file: string): string {
    return `Get-Content "${file}"`;
  }

  findInFiles(pattern: string, path = '.'): string {
    return `Select-String -Path "${path}\\*.*" -Pattern "${pattern}"`;
  }
}

export class PlatformAdapterFactory {
  static createAdapter(platform: PlatformInfo): CommandAdapter {
    if (platform.os === 'windows') {
      if (platform.shell === 'powershell') {
        return new WindowsPowerShellAdapter();
      }
      return new WindowsCmdAdapter();
    }
    
    // For non-Windows platforms, we'll use bash-like commands
    // This is a simplified implementation for the current Windows focus
    throw new Error(`Platform ${platform.os} with shell ${platform.shell} not yet supported`);
  }

  static detectPlatform(): PlatformInfo {
    // In a real implementation, this would detect the actual platform
    // For now, defaulting to Windows cmd as per requirements
    return {
      os: 'windows',
      shell: 'cmd',
      pathSeparator: '\\'
    };
  }

  static adaptCommand(command: string, platform: PlatformInfo): string {
    const adapter = this.createAdapter(platform);
    
    // Basic command adaptation - this could be expanded with more sophisticated parsing
    if (command.includes('ls ') || command.startsWith('ls')) {
      const path = command.replace(/^ls\s*/, '') || '.';
      return adapter.listFiles(path);
    }
    
    if (command.includes('rm ') && !command.includes('rm -rf')) {
      const file = command.replace(/^rm\s+/, '');
      return adapter.removeFile(file);
    }
    
    if (command.includes('rm -rf ')) {
      const dir = command.replace(/^rm -rf\s+/, '');
      return adapter.removeDirectory(dir);
    }
    
    if (command.includes('cp ') && !command.includes('cp -r')) {
      const parts = command.replace(/^cp\s+/, '').split(' ');
      if (parts.length >= 2) {
        return adapter.copyFile(parts[0], parts[1]);
      }
    }
    
    if (command.includes('cp -r ')) {
      const parts = command.replace(/^cp -r\s+/, '').split(' ');
      if (parts.length >= 2) {
        return adapter.copyDirectory(parts[0], parts[1]);
      }
    }
    
    if (command.includes('mkdir ')) {
      const dir = command.replace(/^mkdir\s+/, '');
      return adapter.createDirectory(dir);
    }
    
    if (command.includes('cat ')) {
      const file = command.replace(/^cat\s+/, '');
      return adapter.viewFile(file);
    }
    
    if (command.includes('grep ')) {
      const parts = command.replace(/^grep\s+/, '').split(' ');
      if (parts.length >= 1) {
        const pattern = parts[0];
        const path = parts[1] || '.';
        return adapter.findInFiles(pattern, path);
      }
    }
    
    // If no adaptation needed, return original command
    return command;
  }
}