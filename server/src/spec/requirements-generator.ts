/**
 * Requirements document generator with EARS format validation
 */

import { 
  RequirementDocument, 
  Requirement, 
  AcceptanceCriterion, 
  EARSPattern,
  RequirementValidationResult,
  RequirementValidationError,
  RequirementValidationWarning,
  RequirementGeneratorOptions,
  UserStory,
  GlossaryEntry
} from './types.js';

export class RequirementsGenerator {
  private readonly vagueterms = [
    'quickly', 'adequate', 'sufficient', 'appropriate', 'reasonable',
    'efficient', 'effective', 'optimal', 'good', 'bad', 'better',
    'worse', 'fast', 'slow', 'large', 'small', 'many', 'few'
  ];

  private readonly escapeClauses = [
    'where possible', 'if possible', 'as appropriate', 'when feasible',
    'to the extent possible', 'where practical', 'if practical'
  ];

  private readonly absolutes = [
    'never', 'always', '100%', 'all', 'none', 'every', 'completely',
    'totally', 'absolutely', 'perfectly', 'entirely'
  ];

  private readonly pronouns = [
    'it', 'they', 'them', 'this', 'that', 'these', 'those'
  ];

  /**
   * Generate a requirements document template
   */
  generateTemplate(options: RequirementGeneratorOptions): RequirementDocument {
    return {
      introduction: this.generateIntroduction(options.featureName, options.featureDescription),
      glossary: this.generateGlossaryTemplate(options.featureName),
      requirements: this.generateRequirementTemplates()
    };
  }

  /**
   * Validate a requirements document against EARS and INCOSE standards
   */
  validateDocument(document: RequirementDocument): RequirementValidationResult {
    const errors: RequirementValidationError[] = [];
    const warnings: RequirementValidationWarning[] = [];

    // Validate each requirement
    for (const requirement of document.requirements) {
      const reqValidation = this.validateRequirement(requirement);
      errors.push(...reqValidation.errors);
      warnings.push(...reqValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a single requirement
   */
  validateRequirement(requirement: Requirement): RequirementValidationResult {
    const errors: RequirementValidationError[] = [];
    const warnings: RequirementValidationWarning[] = [];

    // Validate user story format
    if (!requirement.userStory.role || !requirement.userStory.feature || !requirement.userStory.benefit) {
      errors.push({
        requirementId: requirement.id,
        message: 'User story must include role, feature, and benefit',
        code: 'MISSING_SYSTEM'
      });
    }

    // Validate each acceptance criterion
    for (const criterion of requirement.acceptanceCriteria) {
      const criterionValidation = this.validateAcceptanceCriterion(criterion, requirement.id);
      errors.push(...criterionValidation.errors);
      warnings.push(...criterionValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate an acceptance criterion against EARS and INCOSE rules
   */
  validateAcceptanceCriterion(criterion: AcceptanceCriterion, requirementId: string): RequirementValidationResult {
    const errors: RequirementValidationError[] = [];
    const warnings: RequirementValidationWarning[] = [];

    // Validate EARS pattern structure
    const earsValidation = this.validateEARSPattern(criterion);
    if (!earsValidation.valid) {
      errors.push({
        requirementId,
        criterionId: criterion.id,
        message: earsValidation.message,
        code: 'INVALID_EARS_PATTERN'
      });
    }

    // Check for INCOSE quality violations
    const incoseValidation = this.validateINCOSEQuality(criterion, requirementId);
    errors.push(...incoseValidation.errors);
    warnings.push(...incoseValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate EARS pattern structure
   */
  private validateEARSPattern(criterion: AcceptanceCriterion): { valid: boolean; message: string } {
    const text = this.reconstructCriterionText(criterion);

    switch (criterion.pattern) {
      case 'ubiquitous':
        return this.validateUbiquitousPattern(text, criterion);
      case 'event-driven':
        return this.validateEventDrivenPattern(text, criterion);
      case 'state-driven':
        return this.validateStateDrivenPattern(text, criterion);
      case 'unwanted-event':
        return this.validateUnwantedEventPattern(text, criterion);
      case 'optional':
        return this.validateOptionalPattern(text, criterion);
      case 'complex':
        return this.validateComplexPattern(text, criterion);
      default:
        return { valid: false, message: 'Unknown EARS pattern' };
    }
  }

  /**
   * Validate INCOSE quality rules
   */
  private validateINCOSEQuality(criterion: AcceptanceCriterion, requirementId: string): RequirementValidationResult {
    const errors: RequirementValidationError[] = [];
    const warnings: RequirementValidationWarning[] = [];
    const text = this.reconstructCriterionText(criterion);

    // Check for vague terms
    const foundVagueTerms = this.vagueterms.filter(term => {
      const regex = new RegExp(`\\b${term.toLowerCase()}\\b`, 'i');
      return regex.test(text);
    });
    if (foundVagueTerms.length > 0) {
      errors.push({
        requirementId,
        criterionId: criterion.id,
        message: `Contains vague terms: ${foundVagueTerms.join(', ')}`,
        code: 'VAGUE_TERMS'
      });
    }

    // Check for escape clauses
    const foundEscapeClauses = this.escapeClauses.filter(clause => 
      text.toLowerCase().includes(clause.toLowerCase())
    );
    if (foundEscapeClauses.length > 0) {
      errors.push({
        requirementId,
        criterionId: criterion.id,
        message: `Contains escape clauses: ${foundEscapeClauses.join(', ')}`,
        code: 'ESCAPE_CLAUSE'
      });
    }

    // Check for negative statements
    if (text.toLowerCase().includes('shall not')) {
      errors.push({
        requirementId,
        criterionId: criterion.id,
        message: 'Contains negative statement (SHALL NOT)',
        code: 'NEGATIVE_STATEMENT'
      });
    }

    // Check for pronouns
    const foundPronouns = this.pronouns.filter(pronoun => 
      text.toLowerCase().includes(` ${pronoun.toLowerCase()} `)
    );
    if (foundPronouns.length > 0) {
      errors.push({
        requirementId,
        criterionId: criterion.id,
        message: `Contains pronouns: ${foundPronouns.join(', ')}`,
        code: 'PRONOUNS'
      });
    }

    // Check for absolutes
    const foundAbsolutes = this.absolutes.filter(absolute => {
      const regex = new RegExp(`\\b${absolute.toLowerCase()}\\b`, 'i');
      return regex.test(text);
    });
    if (foundAbsolutes.length > 0) {
      errors.push({
        requirementId,
        criterionId: criterion.id,
        message: `Contains absolutes: ${foundAbsolutes.join(', ')}`,
        code: 'ABSOLUTES'
      });
    }

    // Check for passive voice (basic check)
    if (!this.isActiveVoice(text)) {
      warnings.push({
        requirementId,
        criterionId: criterion.id,
        message: 'May not be in active voice',
        code: 'UNCLEAR_TERMINOLOGY'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate markdown format for requirements document
   */
  generateMarkdown(document: RequirementDocument): string {
    let markdown = '# Requirements Document\n\n';
    
    // Introduction
    markdown += '## Introduction\n\n';
    markdown += `${document.introduction}\n\n`;
    
    // Glossary
    if (document.glossary.length > 0) {
      markdown += '## Glossary\n\n';
      for (const entry of document.glossary) {
        markdown += `- **${entry.term}**: ${entry.definition}\n`;
      }
      markdown += '\n';
    }
    
    // Requirements
    markdown += '## Requirements\n\n';
    for (let i = 0; i < document.requirements.length; i++) {
      const req = document.requirements[i];
      markdown += `### Requirement ${i + 1}\n\n`;
      markdown += `**User Story:** As a ${req.userStory.role}, I want ${req.userStory.feature}, so that ${req.userStory.benefit}\n\n`;
      markdown += '#### Acceptance Criteria\n\n';
      
      for (let j = 0; j < req.acceptanceCriteria.length; j++) {
        const criterion = req.acceptanceCriteria[j];
        const text = this.reconstructCriterionText(criterion);
        markdown += `${j + 1}. ${text}\n`;
      }
      markdown += '\n';
    }
    
    return markdown;
  }

  // Private helper methods

  private generateIntroduction(featureName: string, description: string): string {
    return `This feature implements ${featureName}. ${description}`;
  }

  private generateGlossaryTemplate(featureName: string): GlossaryEntry[] {
    return [
      {
        term: 'System',
        definition: `The ${featureName} system being developed`
      }
    ];
  }

  private generateRequirementTemplates(): Requirement[] {
    return [
      {
        id: '1',
        userStory: {
          role: '[role]',
          feature: '[feature description]',
          benefit: '[benefit explanation]'
        },
        acceptanceCriteria: [
          {
            id: '1.1',
            pattern: 'event-driven',
            system: 'System',
            response: '[expected response]',
            trigger: '[trigger event]'
          }
        ]
      }
    ];
  }

  public reconstructCriterionText(criterion: AcceptanceCriterion): string {
    switch (criterion.pattern) {
      case 'ubiquitous':
        return `THE ${criterion.system} SHALL ${criterion.response}`;
      case 'event-driven':
        return `WHEN ${criterion.trigger}, THE ${criterion.system} SHALL ${criterion.response}`;
      case 'state-driven':
        return `WHILE ${criterion.condition}, THE ${criterion.system} SHALL ${criterion.response}`;
      case 'unwanted-event':
        return `IF ${criterion.condition}, THEN THE ${criterion.system} SHALL ${criterion.response}`;
      case 'optional':
        return `WHERE ${criterion.option}, THE ${criterion.system} SHALL ${criterion.response}`;
      case 'complex':
        let text = '';
        if (criterion.option) text += `WHERE ${criterion.option}, `;
        if (criterion.condition) text += `WHILE ${criterion.condition}, `;
        if (criterion.trigger) text += `WHEN ${criterion.trigger}, `;
        text += `THE ${criterion.system} SHALL ${criterion.response}`;
        return text;
      default:
        return `THE ${criterion.system} SHALL ${criterion.response}`;
    }
  }

  private validateUbiquitousPattern(text: string, criterion: AcceptanceCriterion): { valid: boolean; message: string } {
    const pattern = /^THE\s+\S+\s+SHALL\s+.+$/i;
    const valid = pattern.test(text) && !criterion.trigger && !criterion.condition && !criterion.option;
    return {
      valid,
      message: valid ? '' : 'Ubiquitous pattern must be: THE <system> SHALL <response>'
    };
  }

  private validateEventDrivenPattern(text: string, criterion: AcceptanceCriterion): { valid: boolean; message: string } {
    const pattern = /^WHEN\s+.+,\s+THE\s+\S+\s+SHALL\s+.+$/i;
    const valid = pattern.test(text) && !!criterion.trigger && !criterion.condition && !criterion.option;
    return {
      valid,
      message: valid ? '' : 'Event-driven pattern must be: WHEN <trigger>, THE <system> SHALL <response>'
    };
  }

  private validateStateDrivenPattern(text: string, criterion: AcceptanceCriterion): { valid: boolean; message: string } {
    const pattern = /^WHILE\s+.+,\s+THE\s+\S+\s+SHALL\s+.+$/i;
    const valid = pattern.test(text) && !criterion.trigger && !!criterion.condition && !criterion.option;
    return {
      valid,
      message: valid ? '' : 'State-driven pattern must be: WHILE <condition>, THE <system> SHALL <response>'
    };
  }

  private validateUnwantedEventPattern(text: string, criterion: AcceptanceCriterion): { valid: boolean; message: string } {
    const pattern = /^IF\s+.+,\s+THEN\s+THE\s+\S+\s+SHALL\s+.+$/i;
    const valid = pattern.test(text) && !criterion.trigger && !!criterion.condition && !criterion.option;
    return {
      valid,
      message: valid ? '' : 'Unwanted event pattern must be: IF <condition>, THEN THE <system> SHALL <response>'
    };
  }

  private validateOptionalPattern(text: string, criterion: AcceptanceCriterion): { valid: boolean; message: string } {
    const pattern = /^WHERE\s+.+,\s+THE\s+\S+\s+SHALL\s+.+$/i;
    const valid = pattern.test(text) && !criterion.trigger && !criterion.condition && !!criterion.option;
    return {
      valid,
      message: valid ? '' : 'Optional pattern must be: WHERE <option>, THE <system> SHALL <response>'
    };
  }

  private validateComplexPattern(text: string, criterion: AcceptanceCriterion): { valid: boolean; message: string } {
    // Complex pattern allows WHERE, WHILE, WHEN/IF in that order
    const pattern = /^(WHERE\s+.+,\s+)?(WHILE\s+.+,\s+)?(WHEN|IF)\s+.+,\s+(THEN\s+)?THE\s+\S+\s+SHALL\s+.+$/i;
    const valid = pattern.test(text);
    return {
      valid,
      message: valid ? '' : 'Complex pattern must follow order: [WHERE] [WHILE] [WHEN/IF] THE <system> SHALL <response>'
    };
  }

  private isActiveVoice(text: string): boolean {
    // Basic check for active voice - looks for "THE <system> SHALL"
    return /THE\s+\S+\s+SHALL/i.test(text);
  }
}