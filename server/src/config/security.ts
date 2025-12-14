/**
 * Security and PII handling utilities
 */

export interface PIIPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
  description: string;
}

export interface SecurityRule {
  name: string;
  pattern: RegExp;
  action: 'block' | 'warn' | 'sanitize';
  message: string;
}

export interface SecurityResult {
  allowed: boolean;
  sanitized: string;
  warnings: string[];
  blocked: string[];
}

export class SecurityHandler {
  private piiPatterns: PIIPattern[];
  private securityRules: SecurityRule[];
  private maliciousPatterns: RegExp[];

  constructor() {
    this.piiPatterns = [
      {
        name: 'email',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: '[email]',
        description: 'Email address'
      },
      {
        name: 'phone',
        pattern: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
        replacement: '[phone_number]',
        description: 'Phone number'
      },
      {
        name: 'ssn',
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        replacement: '[ssn]',
        description: 'Social Security Number'
      },
      {
        name: 'credit_card',
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: '[credit_card]',
        description: 'Credit card number'
      },
      {
        name: 'ip_address',
        pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
        replacement: '[ip_address]',
        description: 'IP address'
      },
      {
        name: 'address',
        pattern: /\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b/gi,
        replacement: '[address]',
        description: 'Street address'
      },
      {
        name: 'name',
        pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
        replacement: '[name]',
        description: 'Person name (basic pattern)'
      }
    ];

    this.securityRules = [
      {
        name: 'malicious_code',
        pattern: /(?:rm\s+-rf|del\s+\/[sq]|format\s+c:|shutdown|reboot|kill\s+-9)/i,
        action: 'block',
        message: 'Potentially destructive command detected'
      },
      {
        name: 'sql_injection',
        pattern: /(?:union\s+select|drop\s+table|delete\s+from|insert\s+into.*values|update.*set)/i,
        action: 'warn',
        message: 'Potential SQL injection pattern detected'
      },
      {
        name: 'script_injection',
        pattern: /<script[^>]*>.*?<\/script>/gi,
        action: 'sanitize',
        message: 'Script tag detected and removed'
      },
      {
        name: 'file_system_access',
        pattern: /(?:\.\.\/|\.\.\\|\/etc\/passwd|\/etc\/shadow|c:\\windows\\system32)/i,
        action: 'warn',
        message: 'Suspicious file system access pattern detected'
      }
    ];

    this.maliciousPatterns = [
      /(?:virus|malware|trojan|backdoor|keylogger|rootkit)/i,
      /(?:hack|crack|exploit|vulnerability|0day)/i,
      /(?:ddos|dos\s+attack|botnet|zombie)/i,
      /(?:phishing|scam|fraud|steal\s+password)/i
    ];
  }

  /**
   * Detects and substitutes PII in text
   */
  sanitizePII(text: string): string {
    let sanitized = text;
    
    for (const pattern of this.piiPatterns) {
      sanitized = sanitized.replace(pattern.pattern, pattern.replacement);
    }
    
    return sanitized;
  }

  /**
   * Detects PII patterns in text without substitution
   */
  detectPII(text: string): PIIPattern[] {
    const detected: PIIPattern[] = [];
    
    for (const pattern of this.piiPatterns) {
      if (pattern.pattern.test(text)) {
        detected.push(pattern);
      }
    }
    
    return detected;
  }

  /**
   * Checks for malicious code requests
   */
  checkMaliciousIntent(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Check for explicit malicious requests
    const maliciousKeywords = [
      'create virus', 'make malware', 'hack into', 'steal data',
      'bypass security', 'crack password', 'exploit vulnerability',
      'ddos attack', 'phishing email', 'keylogger', 'backdoor'
    ];
    
    for (const keyword of maliciousKeywords) {
      if (lowerText.includes(keyword)) {
        return true;
      }
    }
    
    // Check regex patterns
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Sanitizes shell commands for security
   */
  sanitizeShellCommand(command: string): SecurityResult {
    const warnings: string[] = [];
    const blocked: string[] = [];
    let sanitized = command;
    let allowed = true;

    // Apply security rules
    for (const rule of this.securityRules) {
      if (rule.pattern.test(command)) {
        switch (rule.action) {
          case 'block':
            allowed = false;
            blocked.push(rule.message);
            break;
          case 'warn':
            warnings.push(rule.message);
            break;
          case 'sanitize':
            sanitized = sanitized.replace(rule.pattern, '[REMOVED]');
            warnings.push(rule.message);
            break;
        }
      }
    }

    // Remove dangerous characters and sequences
    sanitized = this.removeDangerousSequences(sanitized);

    // Sanitize PII in commands
    sanitized = this.sanitizePII(sanitized);

    return {
      allowed,
      sanitized,
      warnings,
      blocked
    };
  }

  /**
   * Validates input for general security concerns
   */
  validateInput(input: string): SecurityResult {
    const warnings: string[] = [];
    const blocked: string[] = [];
    let sanitized = input;
    let allowed = true;

    // Check for malicious intent
    if (this.checkMaliciousIntent(input)) {
      allowed = false;
      blocked.push('Malicious intent detected in request');
    }

    // Sanitize PII
    sanitized = this.sanitizePII(sanitized);

    // Check for suspicious patterns
    if (input.length > 10000) {
      warnings.push('Input is unusually long');
    }

    if (/[^\x00-\x7F]/.test(input) && input.includes('\\x')) {
      warnings.push('Potential encoding attack detected');
    }

    return {
      allowed,
      sanitized,
      warnings,
      blocked
    };
  }

  /**
   * Adds custom PII pattern
   */
  addPIIPattern(pattern: PIIPattern): void {
    this.piiPatterns.push(pattern);
  }

  /**
   * Adds custom security rule
   */
  addSecurityRule(rule: SecurityRule): void {
    this.securityRules.push(rule);
  }

  private removeDangerousSequences(command: string): string {
    // Remove command chaining that could be dangerous
    let sanitized = command;
    
    // Remove dangerous command separators in suspicious contexts
    const dangerousChains = [
      /;\s*rm\s/gi,
      /&&\s*del\s/gi,
      /\|\s*format\s/gi,
      /`[^`]*`/g, // Remove command substitution
      /\$\([^)]*\)/g // Remove command substitution
    ];

    for (const pattern of dangerousChains) {
      sanitized = sanitized.replace(pattern, ' [REMOVED] ');
    }

    return sanitized.trim();
  }
}