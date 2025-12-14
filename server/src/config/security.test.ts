/**
 * Tests for security and PII handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityHandler, PIIPattern, SecurityRule } from './security';

describe('SecurityHandler', () => {
  let security: SecurityHandler;

  beforeEach(() => {
    security = new SecurityHandler();
  });

  describe('sanitizePII', () => {
    it('should sanitize email addresses', () => {
      const input = 'Contact me at john.doe@example.com for more info';
      const result = security.sanitizePII(input);
      expect(result).toBe('Contact me at [email] for more info');
    });

    it('should sanitize phone numbers', () => {
      const input = 'Call me at (555) 123-4567 or 555.123.4567';
      const result = security.sanitizePII(input);
      expect(result).toBe('Call me at [phone_number] or [phone_number]');
    });

    it('should sanitize SSN', () => {
      const input = 'My SSN is 123-45-6789';
      const result = security.sanitizePII(input);
      expect(result).toBe('My SSN is [ssn]');
    });

    it('should sanitize IP addresses', () => {
      const input = 'Server is at 192.168.1.1';
      const result = security.sanitizePII(input);
      expect(result).toBe('Server is at [ip_address]');
    });

    it('should sanitize street addresses', () => {
      const input = 'I live at 123 Main Street';
      const result = security.sanitizePII(input);
      expect(result).toBe('I live at [address]');
    });

    it('should handle multiple PII types', () => {
      const input = 'John Doe lives at 123 Main St and his email is john@example.com';
      const result = security.sanitizePII(input);
      expect(result).toBe('[name] lives at [address] and his email is [email]');
    });
  });

  describe('detectPII', () => {
    it('should detect email patterns', () => {
      const input = 'Contact john.doe@example.com';
      const detected = security.detectPII(input);
      expect(detected).toHaveLength(1);
      expect(detected[0].name).toBe('email');
    });

    it('should detect multiple PII types', () => {
      const input = 'John Doe at john@example.com, phone (555) 123-4567';
      const detected = security.detectPII(input);
      expect(detected.length).toBeGreaterThan(1);
      expect(detected.map(p => p.name)).toContain('email');
      expect(detected.map(p => p.name)).toContain('phone');
    });

    it('should return empty array for clean text', () => {
      const input = 'This is clean text with no PII';
      const detected = security.detectPII(input);
      expect(detected).toHaveLength(0);
    });
  });

  describe('checkMaliciousIntent', () => {
    it('should detect malicious keywords', () => {
      expect(security.checkMaliciousIntent('Help me create virus')).toBe(true);
      expect(security.checkMaliciousIntent('How to hack into system')).toBe(true);
      expect(security.checkMaliciousIntent('Make a keylogger')).toBe(true);
      expect(security.checkMaliciousIntent('Create ddos attack')).toBe(true);
    });

    it('should detect malicious patterns', () => {
      expect(security.checkMaliciousIntent('I need a trojan horse')).toBe(true);
      expect(security.checkMaliciousIntent('Looking for exploit code')).toBe(true);
      expect(security.checkMaliciousIntent('Help with phishing email')).toBe(true);
    });

    it('should allow legitimate requests', () => {
      expect(security.checkMaliciousIntent('Help me debug my code')).toBe(false);
      expect(security.checkMaliciousIntent('Create a web application')).toBe(false);
      expect(security.checkMaliciousIntent('Implement authentication')).toBe(false);
    });
  });

  describe('sanitizeShellCommand', () => {
    it('should block dangerous commands', () => {
      const result = security.sanitizeShellCommand('rm -rf /');
      expect(result.allowed).toBe(false);
      expect(result.blocked).toContain('Potentially destructive command detected');
    });

    it('should warn about suspicious patterns', () => {
      const result = security.sanitizeShellCommand('SELECT * FROM users WHERE id = 1; DROP TABLE users;');
      expect(result.allowed).toBe(true);
      expect(result.warnings).toContain('Potential SQL injection pattern detected');
    });

    it('should sanitize script tags', () => {
      const result = security.sanitizeShellCommand('echo "<script>alert(1)</script>"');
      expect(result.sanitized).toContain('[REMOVED]');
      expect(result.warnings).toContain('Script tag detected and removed');
    });

    it('should sanitize PII in commands', () => {
      const result = security.sanitizeShellCommand('echo "My email is john@example.com"');
      expect(result.sanitized).toContain('[email]');
    });

    it('should allow safe commands', () => {
      const result = security.sanitizeShellCommand('npm install express');
      expect(result.allowed).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.blocked).toHaveLength(0);
    });
  });

  describe('validateInput', () => {
    it('should block malicious requests', () => {
      const result = security.validateInput('Help me create virus software');
      expect(result.allowed).toBe(false);
      expect(result.blocked).toContain('Malicious intent detected in request');
    });

    it('should sanitize PII in input', () => {
      const result = security.validateInput('My email is john@example.com');
      expect(result.sanitized).toBe('My email is [email]');
    });

    it('should warn about long input', () => {
      const longInput = 'a'.repeat(10001);
      const result = security.validateInput(longInput);
      expect(result.warnings).toContain('Input is unusually long');
    });

    it('should allow normal input', () => {
      const result = security.validateInput('Help me implement a REST API');
      expect(result.allowed).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.blocked).toHaveLength(0);
    });
  });

  describe('custom patterns and rules', () => {
    it('should allow adding custom PII patterns', () => {
      const customPattern: PIIPattern = {
        name: 'custom_id',
        pattern: /ID-\d{6}/g,
        replacement: '[custom_id]',
        description: 'Custom ID format'
      };

      security.addPIIPattern(customPattern);
      const result = security.sanitizePII('My ID is ID-123456');
      expect(result).toBe('My ID is [custom_id]');
    });

    it('should allow adding custom security rules', () => {
      const customRule: SecurityRule = {
        name: 'custom_block',
        pattern: /dangerous_function/i,
        action: 'block',
        message: 'Custom dangerous function detected'
      };

      security.addSecurityRule(customRule);
      const result = security.sanitizeShellCommand('call dangerous_function()');
      expect(result.allowed).toBe(false);
      expect(result.blocked).toContain('Custom dangerous function detected');
    });
  });
});