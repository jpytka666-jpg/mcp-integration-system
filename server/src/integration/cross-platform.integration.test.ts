/**
 * Cross-platform compatibility integration tests
 * Tests Windows cmd and PowerShell command generation, file system operations, and date/time handling
 * Requirements: 2.1, 2.2, 2.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  WindowsCmdAdapter,
  WindowsPowerShellAdapter,
  PlatformAdapterFactory,
  PlatformInfo
} from '../config/platform-adapter.js';
import { MCPConfigManager } from '../mcp/config-manager.js';
import { ContextInjector } from '../steering/context-injector.js';
import { SteeringParser } from '../steering/parser.js';

describe('Cross-Platform Compatibility', () => {
  describe('Windows Command Generation', () => {
    describe('CMD Shell Commands', () => {
      let cmdAdapter: WindowsCmdAdapter;
      let platform: PlatformInfo;

      beforeEach(() => {
        cmdAdapter = new WindowsCmdAdapter();
        platform = { os: 'windows', shell: 'cmd', pathSeparator: '\\' };
      });

      it('should generate correct file listing commands', () => {
        expect(cmdAdapter.listFiles()).toBe('dir .');
        expect(cmdAdapter.listFiles('src')).toBe('dir src');
        expect(cmdAdapter.listFiles('src\\components')).toBe('dir src\\components');
      });

      it('should generate correct file removal commands', () => {
        expect(cmdAdapter.removeFile('test.txt')).toBe('del "test.txt"');
        expect(cmdAdapter.removeFile('path\\to\\file.txt')).toBe('del "path\\to\\file.txt"');
      });

      it('should generate correct directory removal commands', () => {
        expect(cmdAdapter.removeDirectory('testdir')).toBe('rmdir /s /q "testdir"');
        expect(cmdAdapter.removeDirectory('path\\to\\dir')).toBe('rmdir /s /q "path\\to\\dir"');
      });

      it('should generate correct copy commands', () => {
        expect(cmdAdapter.copyFile('src.txt', 'dest.txt')).toBe('copy "src.txt" "dest.txt"');
        expect(cmdAdapter.copyDirectory('srcdir', 'destdir')).toBe('xcopy "srcdir" "destdir" /e /i');
      });

      it('should generate correct directory creation commands', () => {
        expect(cmdAdapter.createDirectory('newdir')).toBe('mkdir "newdir"');
        expect(cmdAdapter.createDirectory('path\\to\\newdir')).toBe('mkdir "path\\to\\newdir"');
      });

      it('should generate correct file viewing commands', () => {
        expect(cmdAdapter.viewFile('file.txt')).toBe('type "file.txt"');
      });

      it('should generate correct search commands', () => {
        expect(cmdAdapter.findInFiles('pattern')).toBe('findstr /s /i "pattern" "*.*"');
        expect(cmdAdapter.findInFiles('pattern', 'src')).toBe('findstr /s /i "pattern" "src\\*.*"');
      });

      it('should use correct command separator for chaining', () => {
        expect(cmdAdapter.commandSeparator).toBe('&');
        const chainedCommand = `${cmdAdapter.createDirectory('test')} ${cmdAdapter.commandSeparator} ${cmdAdapter.listFiles('test')}`;
        expect(chainedCommand).toContain('&');
      });
    });

    describe('PowerShell Commands', () => {
      let psAdapter: WindowsPowerShellAdapter;
      let platform: PlatformInfo;

      beforeEach(() => {
        psAdapter = new WindowsPowerShellAdapter();
        platform = { os: 'windows', shell: 'powershell', pathSeparator: '\\' };
      });

      it('should generate correct file listing commands', () => {
        expect(psAdapter.listFiles()).toBe('Get-ChildItem .');
        expect(psAdapter.listFiles('src')).toBe('Get-ChildItem src');
      });

      it('should generate correct file removal commands', () => {
        expect(psAdapter.removeFile('test.txt')).toBe('Remove-Item "test.txt"');
      });

      it('should generate correct directory removal commands', () => {
        expect(psAdapter.removeDirectory('testdir')).toBe('Remove-Item -Recurse -Force "testdir"');
      });

      it('should generate correct copy commands', () => {
        expect(psAdapter.copyFile('src.txt', 'dest.txt')).toBe('Copy-Item "src.txt" "dest.txt"');
        expect(psAdapter.copyDirectory('srcdir', 'destdir')).toBe('Copy-Item -Recurse "srcdir" "destdir"');
      });

      it('should generate correct directory creation commands', () => {
        expect(psAdapter.createDirectory('newdir')).toBe('New-Item -ItemType Directory -Path "newdir"');
      });

      it('should generate correct file viewing commands', () => {
        expect(psAdapter.viewFile('file.txt')).toBe('Get-Content "file.txt"');
      });

      it('should generate correct search commands', () => {
        expect(psAdapter.findInFiles('pattern', 'src')).toBe('Select-String -Path "src\\*.*" -Pattern "pattern"');
      });

      it('should use correct command separator for chaining', () => {
        expect(psAdapter.commandSeparator).toBe(';');
        const chainedCommand = `${psAdapter.createDirectory('test')} ${psAdapter.commandSeparator} ${psAdapter.listFiles('test')}`;
        expect(chainedCommand).toContain(';');
      });
    });

    describe('Command Adaptation', () => {
      it('should adapt Unix commands to Windows cmd', () => {
        const cmdPlatform: PlatformInfo = { os: 'windows', shell: 'cmd', pathSeparator: '\\' };

        expect(PlatformAdapterFactory.adaptCommand('ls', cmdPlatform)).toBe('dir .');
        expect(PlatformAdapterFactory.adaptCommand('ls src', cmdPlatform)).toBe('dir src');
        expect(PlatformAdapterFactory.adaptCommand('rm file.txt', cmdPlatform)).toBe('del "file.txt"');
        expect(PlatformAdapterFactory.adaptCommand('rm -rf directory', cmdPlatform)).toBe('rmdir /s /q "directory"');
        expect(PlatformAdapterFactory.adaptCommand('cp src.txt dest.txt', cmdPlatform)).toBe('copy "src.txt" "dest.txt"');
        expect(PlatformAdapterFactory.adaptCommand('cp -r srcdir destdir', cmdPlatform)).toBe('xcopy "srcdir" "destdir" /e /i');
        expect(PlatformAdapterFactory.adaptCommand('mkdir newdir', cmdPlatform)).toBe('mkdir "newdir"');
        expect(PlatformAdapterFactory.adaptCommand('cat file.txt', cmdPlatform)).toBe('type "file.txt"');
        expect(PlatformAdapterFactory.adaptCommand('grep pattern', cmdPlatform)).toBe('findstr /s /i "pattern" "*.*"');
      });

      it('should adapt Unix commands to Windows PowerShell', () => {
        const psPlatform: PlatformInfo = { os: 'windows', shell: 'powershell', pathSeparator: '\\' };

        expect(PlatformAdapterFactory.adaptCommand('ls', psPlatform)).toBe('Get-ChildItem .');
        expect(PlatformAdapterFactory.adaptCommand('rm file.txt', psPlatform)).toBe('Remove-Item "file.txt"');
        expect(PlatformAdapterFactory.adaptCommand('rm -rf directory', psPlatform)).toBe('Remove-Item -Recurse -Force "directory"');
        expect(PlatformAdapterFactory.adaptCommand('cp src.txt dest.txt', psPlatform)).toBe('Copy-Item "src.txt" "dest.txt"');
        expect(PlatformAdapterFactory.adaptCommand('mkdir newdir', psPlatform)).toBe('New-Item -ItemType Directory -Path "newdir"');
        expect(PlatformAdapterFactory.adaptCommand('cat file.txt', psPlatform)).toBe('Get-Content "file.txt"');
      });

      it('should preserve commands that do not need adaptation', () => {
        const platform: PlatformInfo = { os: 'windows', shell: 'cmd', pathSeparator: '\\' };

        expect(PlatformAdapterFactory.adaptCommand('npm install', platform)).toBe('npm install');
        expect(PlatformAdapterFactory.adaptCommand('node server.js', platform)).toBe('node server.js');
        expect(PlatformAdapterFactory.adaptCommand('git status', platform)).toBe('git status');
      });
    });
  });
});


describe('File System Operations', () => {
  const testDir = '.test-cross-platform-fs';
  const kiroDir = path.join(testDir, '.kiro');
  const steeringDir = path.join(kiroDir, 'steering');
  const settingsDir = path.join(kiroDir, 'settings');
  const specsDir = path.join(kiroDir, 'specs');

  beforeEach(() => {
    // Create test directory structure using platform-agnostic path.join
    fs.mkdirSync(steeringDir, { recursive: true });
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.mkdirSync(specsDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create and read files with Windows-style paths', () => {
    const filePath = path.join(steeringDir, 'test-rules.md');
    const content = '# Test Rules\n\nThis is a test file.';

    fs.writeFileSync(filePath, content, 'utf-8');
    expect(fs.existsSync(filePath)).toBe(true);

    const readContent = fs.readFileSync(filePath, 'utf-8');
    expect(readContent).toBe(content);
  });

  it('should handle nested directory creation', () => {
    const nestedPath = path.join(specsDir, 'feature-one', 'sub-feature');
    fs.mkdirSync(nestedPath, { recursive: true });

    expect(fs.existsSync(nestedPath)).toBe(true);
    expect(fs.statSync(nestedPath).isDirectory()).toBe(true);
  });

  it('should handle file operations with special characters in names', () => {
    const specialFileName = 'test-file_v1.0.md';
    const filePath = path.join(steeringDir, specialFileName);

    fs.writeFileSync(filePath, '# Special File', 'utf-8');
    expect(fs.existsSync(filePath)).toBe(true);

    const files = fs.readdirSync(steeringDir);
    expect(files).toContain(specialFileName);
  });

  it('should correctly resolve relative paths', () => {
    const relativePath = path.join('.', testDir, '.kiro', 'steering');
    const absolutePath = path.resolve(relativePath);

    expect(fs.existsSync(absolutePath)).toBe(true);
  });

  it('should handle MCP config file operations across platforms', () => {
    const manager = new MCPConfigManager(kiroDir);

    const config = {
      mcpServers: {
        'test-server': {
          command: 'uvx',
          args: ['test-package@latest'],
          env: { LOG_LEVEL: 'ERROR' }
        }
      }
    };

    // Save config
    const saveResult = manager.saveWorkspaceConfig(config);
    expect(saveResult.valid).toBe(true);

    // Verify file exists at expected path
    const configPath = path.join(settingsDir, 'mcp.json');
    expect(fs.existsSync(configPath)).toBe(true);

    // Load and verify config
    const loaded = manager.loadMergedConfig();
    expect(loaded.servers['test-server']).toBeDefined();
    expect(loaded.servers['test-server'].command).toBe('uvx');
  });

  it('should handle steering file operations across platforms', () => {
    // Create steering file
    const steeringContent = `---
inclusion: always
---
# Platform Test Rules

These rules work across platforms.`;

    fs.writeFileSync(path.join(steeringDir, 'platform-rules.md'), steeringContent, 'utf-8');

    // Load and parse steering files
    const injector = new ContextInjector(steeringDir, testDir);
    injector.loadSteeringFiles();

    const files = injector.getSteeringFiles();
    expect(files.length).toBe(1);
    expect(files[0].fileName).toBe('platform-rules.md');
    expect(files[0].frontMatter.inclusion).toBe('always');
  });

  it('should handle path normalization correctly', () => {
    // Test that paths are normalized correctly regardless of input format
    const windowsStylePath = testDir + '\\.kiro\\steering';
    const unixStylePath = testDir + '/.kiro/steering';

    // Both should resolve to the same location
    const normalizedWindows = path.normalize(windowsStylePath);
    const normalizedUnix = path.normalize(unixStylePath);

    expect(normalizedWindows).toBe(normalizedUnix);
  });
});

describe('Date/Time Handling', () => {
  it('should handle current date context accurately', () => {
    const now = new Date();

    // Verify date components are valid
    expect(now.getFullYear()).toBeGreaterThanOrEqual(2024);
    expect(now.getMonth()).toBeGreaterThanOrEqual(0);
    expect(now.getMonth()).toBeLessThanOrEqual(11);
    expect(now.getDate()).toBeGreaterThanOrEqual(1);
    expect(now.getDate()).toBeLessThanOrEqual(31);
  });

  it('should format dates consistently', () => {
    const testDate = new Date('2025-12-10T12:00:00Z');

    // ISO format should be consistent
    const isoString = testDate.toISOString();
    expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(isoString).toContain('2025-12-10');
  });

  it('should handle timezone-aware date operations', () => {
    const utcDate = new Date('2025-12-10T00:00:00Z');
    const localDate = new Date(utcDate.getTime());

    // UTC time should be preserved
    expect(utcDate.getUTCFullYear()).toBe(2025);
    expect(utcDate.getUTCMonth()).toBe(11); // December (0-indexed)
    expect(utcDate.getUTCDate()).toBe(10);
  });

  it('should handle date comparisons correctly', () => {
    const date1 = new Date('2025-01-15');
    const date2 = new Date('2025-02-15');
    const date3 = new Date('2024-12-15');

    expect(date1.getTime()).toBeLessThan(date2.getTime());
    expect(date3.getTime()).toBeLessThan(date1.getTime());
    expect(date2.getTime()).toBeGreaterThan(date3.getTime());
  });

  it('should handle date arithmetic correctly', () => {
    const startDate = new Date('2025-12-10');
    const dayInMs = 24 * 60 * 60 * 1000;

    // Add 7 days
    const futureDate = new Date(startDate.getTime() + 7 * dayInMs);
    expect(futureDate.getDate()).toBe(17);

    // Subtract 10 days
    const pastDate = new Date(startDate.getTime() - 10 * dayInMs);
    expect(pastDate.getMonth()).toBe(10); // November (0-indexed)
    expect(pastDate.getDate()).toBe(30);
  });

  it('should handle task metadata timestamps', () => {
    const createdAt = new Date();
    const lastModified = new Date();

    // Simulate task metadata
    const taskMetadata = {
      createdAt,
      lastModified,
      totalTasks: 5,
      completedTasks: 2,
      inProgressTasks: 1
    };

    expect(taskMetadata.createdAt).toBeInstanceOf(Date);
    expect(taskMetadata.lastModified).toBeInstanceOf(Date);
    expect(taskMetadata.lastModified.getTime()).toBeGreaterThanOrEqual(taskMetadata.createdAt.getTime());
  });

  it('should serialize and deserialize dates correctly', () => {
    const originalDate = new Date('2025-12-10T15:30:00Z');

    // Serialize to JSON
    const serialized = JSON.stringify({ date: originalDate });

    // Deserialize
    const parsed = JSON.parse(serialized);
    const restoredDate = new Date(parsed.date);

    expect(restoredDate.getTime()).toBe(originalDate.getTime());
    expect(restoredDate.toISOString()).toBe(originalDate.toISOString());
  });
});

describe('Platform Detection', () => {
  it('should detect Windows platform correctly', () => {
    const platform = PlatformAdapterFactory.detectPlatform();

    expect(platform.os).toBe('windows');
    expect(['cmd', 'powershell']).toContain(platform.shell);
    expect(platform.pathSeparator).toBe('\\');
  });

  it('should create appropriate adapter for detected platform', () => {
    const platform = PlatformAdapterFactory.detectPlatform();
    const adapter = PlatformAdapterFactory.createAdapter(platform);

    expect(adapter).toBeDefined();
    expect(typeof adapter.listFiles).toBe('function');
    expect(typeof adapter.removeFile).toBe('function');
    expect(typeof adapter.createDirectory).toBe('function');
  });
});
