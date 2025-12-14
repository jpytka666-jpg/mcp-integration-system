/**
 * Tests for response style configuration parser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseStyleParser, UserInputStyle } from './response-style';
import { ResponseStyleConfig } from './types';

describe('ResponseStyleParser', () => {
  let parser: ResponseStyleParser;
  let baseConfig: ResponseStyleConfig;

  beforeEach(() => {
    parser = new ResponseStyleParser();
    baseConfig = {
      tone: 'warm',
      verbosity: 'standard',
      platformAdaptation: true
    };
  });

  describe('detectUserStyle', () => {
    it('should detect formal tone', () => {
      const input = 'Could you please help me with this implementation? I would appreciate your assistance.';
      const style = parser.detectUserStyle(input);
      expect(style.tone).toBe('formal');
    });

    it('should detect casual tone', () => {
      const input = 'Hey, can you help me fix this bug? It\'s pretty cool but not working lol';
      const style = parser.detectUserStyle(input);
      expect(style.tone).toBe('casual');
    });

    it('should detect technical tone', () => {
      const input = 'I need to implement a function that handles API calls and database operations';
      const style = parser.detectUserStyle(input);
      expect(style.tone).toBe('technical');
    });

    it('should detect friendly tone', () => {
      const input = 'Thanks for the help! This is amazing and I love working with this framework';
      const style = parser.detectUserStyle(input);
      expect(style.tone).toBe('friendly');
    });

    it('should detect high urgency', () => {
      const input = 'URGENT: The system is broken and failing! Need immediate help!';
      const style = parser.detectUserStyle(input);
      expect(style.urgency).toBe('high');
    });

    it('should detect low urgency', () => {
      const input = 'When you have time, could you help me understand this? No rush.';
      const style = parser.detectUserStyle(input);
      expect(style.urgency).toBe('low');
    });

    it('should detect complex input', () => {
      const input = 'I need to implement a comprehensive authentication system with JWT tokens, refresh mechanisms, role-based access control, and integration with multiple OAuth providers. The architecture should follow SOLID principles and include proper error handling for various edge cases.';
      const style = parser.detectUserStyle(input);
      expect(style.complexity).toBe('complex');
    });

    it('should detect simple input', () => {
      const input = 'Help me fix this.';
      const style = parser.detectUserStyle(input);
      expect(style.complexity).toBe('simple');
    });

    it('should detect question types', () => {
      expect(parser.detectUserStyle('How do I implement this?').questionType).toBe('help');
      expect(parser.detectUserStyle('There\'s an error in my code').questionType).toBe('debug');
      expect(parser.detectUserStyle('Create a new component').questionType).toBe('implement');
      expect(parser.detectUserStyle('What is dependency injection?').questionType).toBe('explain');
    });
  });

  describe('matchResponseStyle', () => {
    it('should adapt to formal user style', () => {
      const userStyle: UserInputStyle = {
        tone: 'formal',
        complexity: 'moderate',
        urgency: 'medium',
        questionType: 'help'
      };
      
      const result = parser.matchResponseStyle(userStyle, baseConfig);
      expect(result.tone).toBe('professional');
    });

    it('should adapt to casual user style', () => {
      const userStyle: UserInputStyle = {
        tone: 'casual',
        complexity: 'simple',
        urgency: 'low',
        questionType: 'help'
      };
      
      const result = parser.matchResponseStyle(userStyle, baseConfig);
      expect(result.tone).toBe('warm');
    });

    it('should use minimal verbosity for high urgency', () => {
      const userStyle: UserInputStyle = {
        tone: 'technical',
        complexity: 'moderate',
        urgency: 'high',
        questionType: 'debug'
      };
      
      const result = parser.matchResponseStyle(userStyle, baseConfig);
      expect(result.verbosity).toBe('minimal');
    });

    it('should use detailed verbosity for complex input', () => {
      const userStyle: UserInputStyle = {
        tone: 'technical',
        complexity: 'complex',
        urgency: 'medium',
        questionType: 'implement'
      };
      
      const result = parser.matchResponseStyle(userStyle, baseConfig);
      expect(result.verbosity).toBe('detailed');
    });

    it('should preserve platform adaptation setting', () => {
      const userStyle: UserInputStyle = {
        tone: 'casual',
        complexity: 'simple',
        urgency: 'medium',
        questionType: 'help'
      };
      
      const result = parser.matchResponseStyle(userStyle, baseConfig);
      expect(result.platformAdaptation).toBe(true);
    });
  });
});