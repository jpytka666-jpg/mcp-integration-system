/**
 * Tests for platform-specific command adapters
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  WindowsCmdAdapter, 
  WindowsPowerShellAdapter, 
  PlatformAdapterFactory,
  PlatformInfo 
} from './platform-adapter';

describe('WindowsCmdAdapter', () => {
  let adapter: WindowsCmdAdapter;

  beforeEach(() => {
    adapter = new WindowsCmdAdapter();
  });

  it('should generate correct cmd commands', () => {
    expect(adapter.listFiles()).toBe('dir .');
    expect(adapter.listFiles('src')).toBe('dir src');
    expect(adapter.removeFile('test.txt')).toBe('del "test.txt"');
    expect(adapter.removeDirectory('testdir')).toBe('rmdir /s /q "testdir"');
    expect(adapter.copyFile('src.txt', 'dest.txt')).toBe('copy "src.txt" "dest.txt"');
    expect(adapter.copyDirectory('srcdir', 'destdir')).toBe('xcopy "srcdir" "destdir" /e /i');
    expect(adapter.createDirectory('newdir')).toBe('mkdir "newdir"');
    expect(adapter.viewFile('file.txt')).toBe('type "file.txt"');
    expect(adapter.findInFiles('pattern', 'src')).toBe('findstr /s /i "pattern" "src\\*.*"');
  });

  it('should use correct command separator', () => {
    expect(adapter.commandSeparator).toBe('&');
  });
});

describe('WindowsPowerShellAdapter', () => {
  let adapter: WindowsPowerShellAdapter;

  beforeEach(() => {
    adapter = new WindowsPowerShellAdapter();
  });

  it('should generate correct PowerShell commands', () => {
    expect(adapter.listFiles()).toBe('Get-ChildItem .');
    expect(adapter.listFiles('src')).toBe('Get-ChildItem src');
    expect(adapter.removeFile('test.txt')).toBe('Remove-Item "test.txt"');
    expect(adapter.removeDirectory('testdir')).toBe('Remove-Item -Recurse -Force "testdir"');
    expect(adapter.copyFile('src.txt', 'dest.txt')).toBe('Copy-Item "src.txt" "dest.txt"');
    expect(adapter.copyDirectory('srcdir', 'destdir')).toBe('Copy-Item -Recurse "srcdir" "destdir"');
    expect(adapter.createDirectory('newdir')).toBe('New-Item -ItemType Directory -Path "newdir"');
    expect(adapter.viewFile('file.txt')).toBe('Get-Content "file.txt"');
    expect(adapter.findInFiles('pattern', 'src')).toBe('Select-String -Path "src\\*.*" -Pattern "pattern"');
  });

  it('should use correct command separator', () => {
    expect(adapter.commandSeparator).toBe(';');
  });
});

describe('PlatformAdapterFactory', () => {
  it('should create Windows cmd adapter', () => {
    const platform: PlatformInfo = {
      os: 'windows',
      shell: 'cmd',
      pathSeparator: '\\'
    };
    
    const adapter = PlatformAdapterFactory.createAdapter(platform);
    expect(adapter).toBeInstanceOf(WindowsCmdAdapter);
  });

  it('should create Windows PowerShell adapter', () => {
    const platform: PlatformInfo = {
      os: 'windows',
      shell: 'powershell',
      pathSeparator: '\\'
    };
    
    const adapter = PlatformAdapterFactory.createAdapter(platform);
    expect(adapter).toBeInstanceOf(WindowsPowerShellAdapter);
  });

  it('should detect Windows platform', () => {
    const platform = PlatformAdapterFactory.detectPlatform();
    expect(platform.os).toBe('windows');
    expect(platform.shell).toBe('cmd');
    expect(platform.pathSeparator).toBe('\\');
  });

  describe('adaptCommand', () => {
    let platform: PlatformInfo;

    beforeEach(() => {
      platform = {
        os: 'windows',
        shell: 'cmd',
        pathSeparator: '\\'
      };
    });

    it('should adapt ls commands', () => {
      expect(PlatformAdapterFactory.adaptCommand('ls', platform)).toBe('dir .');
      expect(PlatformAdapterFactory.adaptCommand('ls src', platform)).toBe('dir src');
    });

    it('should adapt rm commands', () => {
      expect(PlatformAdapterFactory.adaptCommand('rm file.txt', platform)).toBe('del "file.txt"');
      expect(PlatformAdapterFactory.adaptCommand('rm -rf directory', platform)).toBe('rmdir /s /q "directory"');
    });

    it('should adapt cp commands', () => {
      expect(PlatformAdapterFactory.adaptCommand('cp src.txt dest.txt', platform)).toBe('copy "src.txt" "dest.txt"');
      expect(PlatformAdapterFactory.adaptCommand('cp -r srcdir destdir', platform)).toBe('xcopy "srcdir" "destdir" /e /i');
    });

    it('should adapt mkdir commands', () => {
      expect(PlatformAdapterFactory.adaptCommand('mkdir newdir', platform)).toBe('mkdir "newdir"');
    });

    it('should adapt cat commands', () => {
      expect(PlatformAdapterFactory.adaptCommand('cat file.txt', platform)).toBe('type "file.txt"');
    });

    it('should adapt grep commands', () => {
      expect(PlatformAdapterFactory.adaptCommand('grep pattern', platform)).toBe('findstr /s /i "pattern" "*.*"');
      expect(PlatformAdapterFactory.adaptCommand('grep pattern src', platform)).toBe('findstr /s /i "pattern" "src\\*.*"');
    });

    it('should return original command if no adaptation needed', () => {
      const originalCommand = 'npm install';
      expect(PlatformAdapterFactory.adaptCommand(originalCommand, platform)).toBe(originalCommand);
    });
  });
});