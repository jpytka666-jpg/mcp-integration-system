/**
 * Tests for requirements document generator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RequirementsGenerator } from './requirements-generator.js';
import { AcceptanceCriterion, RequirementDocument } from './types.js';

describe('RequirementsGenerator', () => {
  let generator: RequirementsGenerator;

  beforeEach(() => {
    generator = new RequirementsGenerator();
  });

  describe('generateTemplate', () => {
    it('should generate a basic requirements document template', () => {
      const options = {
        featureName: 'test-feature',
        featureDescription: 'A test feature for validation',
        enforceEARS: true,
        enforceINCOSE: true
      };

      const document = generator.generateTemplate(options);

      expect(document.introduction).toContain('test-feature');
      expect(document.glossary).toHaveLength(1);
      expect(document.requirements).toHaveLength(1);
      expect(document.requirements[0].userStory.role).toBe('[role]');
    });
  });

  describe('EARS pattern validation', () => {
    it('should validate ubiquitous pattern correctly', () => {
      const criterion: AcceptanceCriterion = {
        id: '1.1',
        pattern: 'ubiquitous',
        system: 'System',
        response: 'perform the action'
      };

      const result = generator.validateAcceptanceCriterion(criterion, 'req1');
      expect(result.valid).toBe(true);
    });

    it('should validate event-driven pattern correctly', () => {
      const criterion: AcceptanceCriterion = {
        id: '1.1',
        pattern: 'event-driven',
        system: 'System',
        response: 'perform the action',
        trigger: 'user clicks button'
      };

      const result = generator.validateAcceptanceCriterion(criterion, 'req1');
      expect(result.valid).toBe(true);
    });

    it('should validate state-driven pattern correctly', () => {
      const criterion: AcceptanceCriterion = {
        id: '1.1',
        pattern: 'state-driven',
        system: 'System',
        response: 'maintain the state',
        condition: 'system is active'
      };

      const result = generator.validateAcceptanceCriterion(criterion, 'req1');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid EARS patterns', () => {
      const criterion: AcceptanceCriterion = {
        id: '1.1',
        pattern: 'event-driven',
        system: 'System',
        response: 'perform the action'
        // Missing trigger for event-driven pattern
      };

      const result = generator.validateAcceptanceCriterion(criterion, 'req1');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_EARS_PATTERN');
    });
  });

  describe('INCOSE quality validation', () => {
    it('should detect vague terms', () => {
      const criterion: AcceptanceCriterion = {
        id: '1.1',
        pattern: 'ubiquitous',
        system: 'System',
        response: 'perform quickly and adequately'
      };

      const result = generator.validateAcceptanceCriterion(criterion, 'req1');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'VAGUE_TERMS')).toBe(true);
    });

    it('should detect escape clauses', () => {
      const criterion: AcceptanceCriterion = {
        id: '1.1',
        pattern: 'ubiquitous',
        system: 'System',
        response: 'perform the action where possible'
      };

      const result = generator.validateAcceptanceCriterion(criterion, 'req1');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'ESCAPE_CLAUSE')).toBe(true);
    });

    it('should detect negative statements', () => {
      const criterion: AcceptanceCriterion = {
        id: '1.1',
        pattern: 'ubiquitous',
        system: 'System',
        response: 'shall not fail'
      };

      const result = generator.validateAcceptanceCriterion(criterion, 'req1');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NEGATIVE_STATEMENT')).toBe(true);
    });

    it('should detect pronouns', () => {
      const criterion: AcceptanceCriterion = {
        id: '1.1',
        pattern: 'ubiquitous',
        system: 'System',
        response: 'process it correctly'
      };

      const result = generator.validateAcceptanceCriterion(criterion, 'req1');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PRONOUNS')).toBe(true);
    });

    it('should detect absolutes', () => {
      const criterion: AcceptanceCriterion = {
        id: '1.1',
        pattern: 'ubiquitous',
        system: 'System',
        response: 'always succeed perfectly'
      };

      const result = generator.validateAcceptanceCriterion(criterion, 'req1');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'ABSOLUTES')).toBe(true);
    });
  });

  describe('generateMarkdown', () => {
    it('should generate proper markdown format', () => {
      const document: RequirementDocument = {
        introduction: 'Test introduction',
        glossary: [
          { term: 'System', definition: 'The test system' }
        ],
        requirements: [
          {
            id: '1',
            userStory: {
              role: 'user',
              feature: 'login functionality',
              benefit: 'access the system'
            },
            acceptanceCriteria: [
              {
                id: '1.1',
                pattern: 'event-driven',
                system: 'System',
                response: 'authenticate the user',
                trigger: 'user enters credentials'
              }
            ]
          }
        ]
      };

      const markdown = generator.generateMarkdown(document);

      expect(markdown).toContain('# Requirements Document');
      expect(markdown).toContain('## Introduction');
      expect(markdown).toContain('## Glossary');
      expect(markdown).toContain('## Requirements');
      expect(markdown).toContain('**User Story:**');
      expect(markdown).toContain('#### Acceptance Criteria');
      expect(markdown).toContain('WHEN user enters credentials, THE System SHALL authenticate the user');
    });
  });

  describe('validateDocument', () => {
    it('should validate complete document', () => {
      const document: RequirementDocument = {
        introduction: 'Test introduction',
        glossary: [],
        requirements: [
          {
            id: '1',
            userStory: {
              role: 'user',
              feature: 'login',
              benefit: 'access system'
            },
            acceptanceCriteria: [
              {
                id: '1.1',
                pattern: 'ubiquitous',
                system: 'System',
                response: 'provide authentication'
              }
            ]
          }
        ]
      };

      const result = generator.validateDocument(document);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});