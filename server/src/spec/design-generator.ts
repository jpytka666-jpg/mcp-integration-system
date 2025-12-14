/**
 * Design document generator with section validation and user approval gates
 */

import { 
  RequirementDocument,
  ValidationError,
  ValidationWarning,
  DesignDocument,
  ComponentSection,
  DataModelSection,
  CorrectnessProperty,
  DesignGeneratorOptions,
  DesignValidationResult,
  UserApprovalGate
} from './types.js';
import * as fs from 'fs';
import * as path from 'path';

export class DesignGenerator {
  private readonly requiredSections = [
    'overview',
    'architecture', 
    'components',
    'dataModels',
    'correctnessProperties',
    'errorHandling',
    'testingStrategy'
  ];

  private approvalGate?: UserApprovalGate;

  /**
   * Generate a design document template based on requirements
   */
  generateTemplate(options: DesignGeneratorOptions): DesignDocument {
    return {
      overview: this.generateOverview(options.featureName, options.requirementsDocument),
      architecture: this.generateArchitectureTemplate(options.includeArchitectureDiagram),
      components: this.generateComponentTemplates(options.requirementsDocument),
      dataModels: this.generateDataModelTemplates(options.requirementsDocument),
      correctnessProperties: this.generateCorrectnessPropertyTemplates(options.requirementsDocument),
      errorHandling: this.generateErrorHandlingTemplate(),
      testingStrategy: this.generateTestingStrategyTemplate(options.testingFramework)
    };
  }

  /**
   * Validate design document structure and completeness
   */
  validateDocument(document: DesignDocument): DesignValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const missingRequiredSections: string[] = [];
    const incompleteProperties: string[] = [];

    // Check for required sections
    if (!document.overview || document.overview.trim().length === 0) {
      missingRequiredSections.push('overview');
    }

    if (!document.architecture || document.architecture.trim().length === 0) {
      missingRequiredSections.push('architecture');
    }

    if (!document.components || document.components.length === 0) {
      missingRequiredSections.push('components');
    }

    if (!document.dataModels || document.dataModels.length === 0) {
      missingRequiredSections.push('dataModels');
    }

    if (!document.correctnessProperties || document.correctnessProperties.length === 0) {
      missingRequiredSections.push('correctnessProperties');
    }

    if (!document.errorHandling || document.errorHandling.trim().length === 0) {
      missingRequiredSections.push('errorHandling');
    }

    if (!document.testingStrategy || document.testingStrategy.trim().length === 0) {
      missingRequiredSections.push('testingStrategy');
    }

    // Validate components
    for (const component of document.components) {
      if (!component.name || !component.description) {
        errors.push({
          path: `components.${component.name || 'unnamed'}`,
          message: 'Component must have name and description',
          code: 'INCOMPLETE_COMPONENT'
        });
      }
    }

    // Validate data models
    for (const model of document.dataModels) {
      if (!model.name || !model.description || !model.structure) {
        errors.push({
          path: `dataModels.${model.name || 'unnamed'}`,
          message: 'Data model must have name, description, and structure',
          code: 'INCOMPLETE_DATA_MODEL'
        });
      }
    }

    // Validate correctness properties
    for (const property of document.correctnessProperties) {
      if (!property.name || !property.description || !property.validatesRequirements || property.validatesRequirements.length === 0) {
        incompleteProperties.push(property.id || property.name || 'unnamed');
        errors.push({
          path: `correctnessProperties.${property.id || 'unnamed'}`,
          message: 'Correctness property must have name, description, and validate at least one requirement',
          code: 'INCOMPLETE_PROPERTY'
        });
      }
    }

    // Check for testing strategy completeness
    if (document.testingStrategy && !document.testingStrategy.includes('property-based')) {
      warnings.push({
        path: 'testingStrategy',
        message: 'Testing strategy should include property-based testing approach',
        code: 'MISSING_PBT_STRATEGY'
      });
    }

    return {
      valid: errors.length === 0 && missingRequiredSections.length === 0,
      errors,
      warnings,
      missingRequiredSections,
      incompleteProperties
    };
  }

  /**
   * Generate markdown format for design document
   */
  generateMarkdown(document: DesignDocument): string {
    let markdown = '# Design Document\n\n';

    // Overview
    markdown += '## Overview\n\n';
    markdown += `${document.overview}\n\n`;

    // Architecture
    markdown += '## Architecture\n\n';
    markdown += `${document.architecture}\n\n`;

    // Components and Interfaces
    markdown += '## Components and Interfaces\n\n';
    for (const component of document.components) {
      markdown += `### ${component.name}\n`;
      markdown += `${component.description}\n\n`;
      
      if (component.interfaces && component.interfaces.length > 0) {
        markdown += '**Interfaces:**\n';
        for (const iface of component.interfaces) {
          markdown += `- ${iface}\n`;
        }
        markdown += '\n';
      }

      if (component.responsibilities && component.responsibilities.length > 0) {
        markdown += '**Responsibilities:**\n';
        for (const responsibility of component.responsibilities) {
          markdown += `- ${responsibility}\n`;
        }
        markdown += '\n';
      }
    }

    // Data Models
    markdown += '## Data Models\n\n';
    for (const model of document.dataModels) {
      markdown += `### ${model.name}\n`;
      markdown += `${model.description}\n\n`;
      markdown += '```\n';
      markdown += `${model.structure}\n`;
      markdown += '```\n\n';

      if (model.relationships && model.relationships.length > 0) {
        markdown += '**Relationships:**\n';
        for (const relationship of model.relationships) {
          markdown += `- ${relationship}\n`;
        }
        markdown += '\n';
      }
    }

    // Correctness Properties
    markdown += '## Correctness Properties\n\n';
    markdown += '*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*\n\n';
    
    for (let i = 0; i < document.correctnessProperties.length; i++) {
      const property = document.correctnessProperties[i];
      markdown += `### Property ${i + 1}: ${property.name}\n`;
      markdown += `*For any* ${property.description}\n`;
      markdown += `**Validates: Requirements ${property.validatesRequirements.join(', ')}**\n\n`;
    }

    // Error Handling
    markdown += '## Error Handling\n\n';
    markdown += `${document.errorHandling}\n\n`;

    // Testing Strategy
    markdown += '## Testing Strategy\n\n';
    markdown += `${document.testingStrategy}\n\n`;

    return markdown;
  }

  /**
   * Set the user approval gate for design changes
   */
  setApprovalGate(gate: UserApprovalGate): void {
    this.approvalGate = gate;
  }

  /**
   * Check if user approval is required for design changes
   */
  requiresApproval(originalDocument: DesignDocument, updatedDocument: DesignDocument): boolean {
    // Check if any major sections have changed
    const majorChanges = [
      originalDocument.overview !== updatedDocument.overview,
      originalDocument.architecture !== updatedDocument.architecture,
      originalDocument.correctnessProperties.length !== updatedDocument.correctnessProperties.length,
      originalDocument.components.length !== updatedDocument.components.length,
      originalDocument.dataModels.length !== updatedDocument.dataModels.length
    ];

    return majorChanges.some(changed => changed);
  }

  /**
   * Request user approval for design document changes
   */
  async requestApproval(document: DesignDocument, changes?: string[]): Promise<boolean> {
    if (!this.approvalGate) {
      throw new Error('No approval gate configured. Use setApprovalGate() to configure approval mechanism.');
    }

    return await this.approvalGate.requestApproval(document, changes);
  }

  /**
   * Get the current approval status
   */
  getApprovalStatus(): 'pending' | 'approved' | 'rejected' | 'not-configured' {
    if (!this.approvalGate) {
      return 'not-configured';
    }
    return this.approvalGate.getApprovalStatus();
  }

  /**
   * Process design document with approval workflow
   */
  async processWithApproval(
    document: DesignDocument, 
    originalDocument?: DesignDocument
  ): Promise<{ approved: boolean; document: DesignDocument }> {
    // Validate the document first
    const validation = this.validateDocument(document);
    if (!validation.valid) {
      throw new Error(`Document validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Check if approval is needed
    const needsApproval = originalDocument ? this.requiresApproval(originalDocument, document) : true;
    
    if (!needsApproval) {
      return { approved: true, document };
    }

    // Request approval
    const approved = await this.requestApproval(document);
    return { approved, document };
  }

  /**
   * Create design document file in the spec directory
   */
  createDesignFile(featureName: string, document: DesignDocument, basePath: string = '.kiro'): string {
    const specPath = path.join(basePath, 'specs', featureName);
    
    // Ensure spec directory exists
    if (!fs.existsSync(specPath)) {
      fs.mkdirSync(specPath, { recursive: true });
    }

    const designPath = path.join(specPath, 'design.md');
    const markdown = this.generateMarkdown(document);
    
    fs.writeFileSync(designPath, markdown, 'utf-8');
    
    return designPath;
  }

  /**
   * Load existing design document from file
   */
  loadDesignFile(featureName: string, basePath: string = '.kiro'): DesignDocument | null {
    const designPath = path.join(basePath, 'specs', featureName, 'design.md');
    
    if (!fs.existsSync(designPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(designPath, 'utf-8');
      return this.parseMarkdownToDocument(content);
    } catch (error) {
      console.warn(`Failed to load design file: ${error}`);
      return null;
    }
  }

  /**
   * Update existing design document file
   */
  updateDesignFile(featureName: string, document: DesignDocument, basePath: string = '.kiro'): string {
    const validation = this.validateDocument(document);
    if (!validation.valid) {
      throw new Error(`Cannot update invalid document: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return this.createDesignFile(featureName, document, basePath);
  }

  /**
   * Check if design document file exists
   */
  designFileExists(featureName: string, basePath: string = '.kiro'): boolean {
    const designPath = path.join(basePath, 'specs', featureName, 'design.md');
    return fs.existsSync(designPath);
  }

  // Private helper methods

  private generateOverview(featureName: string, requirements: RequirementDocument): string {
    return `The ${featureName} system provides ${requirements.introduction.toLowerCase()}. This design document outlines the architecture, components, and implementation approach for delivering the functionality specified in the requirements.`;
  }

  private generateArchitectureTemplate(includeDiagram: boolean): string {
    let architecture = 'The system follows a layered architecture pattern with clear separation of concerns:\n\n';
    
    if (includeDiagram) {
      architecture += '```mermaid\n';
      architecture += 'graph TB\n';
      architecture += '    A[User Interface] --> B[Business Logic]\n';
      architecture += '    B --> C[Data Access Layer]\n';
      architecture += '    C --> D[Data Storage]\n';
      architecture += '```\n\n';
    }

    architecture += '- **Presentation Layer**: Handles user interactions and input/output\n';
    architecture += '- **Business Logic Layer**: Implements core functionality and business rules\n';
    architecture += '- **Data Access Layer**: Manages data persistence and retrieval\n';
    architecture += '- **Infrastructure Layer**: Provides cross-cutting concerns like logging and configuration';

    return architecture;
  }

  private generateComponentTemplates(requirements: RequirementDocument): ComponentSection[] {
    const components: ComponentSection[] = [];

    // Generate basic components based on requirements
    for (const requirement of requirements.requirements) {
      const componentName = this.extractComponentName(requirement.userStory.feature);
      if (componentName && !components.find(c => c.name === componentName)) {
        components.push({
          name: componentName,
          description: `Handles ${requirement.userStory.feature} functionality`,
          interfaces: [`I${componentName}`],
          responsibilities: [
            `Implement ${requirement.userStory.feature}`,
            'Validate input parameters',
            'Handle error conditions'
          ]
        });
      }
    }

    // Add default core components if none were generated
    if (components.length === 0) {
      components.push({
        name: 'CoreManager',
        description: 'Central coordinator for system functionality',
        interfaces: ['ICoreManager'],
        responsibilities: [
          'Coordinate system operations',
          'Manage component lifecycle',
          'Handle configuration'
        ]
      });
    }

    return components;
  }

  private generateDataModelTemplates(requirements: RequirementDocument): DataModelSection[] {
    const models: DataModelSection[] = [];

    // Extract potential data models from requirements
    const entities = this.extractEntities(requirements);
    
    for (const entity of entities) {
      models.push({
        name: entity,
        description: `Data model representing ${entity.toLowerCase()} information`,
        structure: `interface ${entity} {\n  id: string;\n  // Additional properties based on requirements\n}`,
        relationships: []
      });
    }

    // Add default configuration model
    models.push({
      name: 'Configuration',
      description: 'System configuration and settings',
      structure: 'interface Configuration {\n  version: string;\n  settings: Record<string, any>;\n}',
      relationships: ['Used by all system components']
    });

    return models;
  }

  private generateCorrectnessPropertyTemplates(requirements: RequirementDocument): CorrectnessProperty[] {
    const properties: CorrectnessProperty[] = [];

    // Generate properties based on acceptance criteria
    for (const requirement of requirements.requirements) {
      for (let i = 0; i < requirement.acceptanceCriteria.length; i++) {
        const criterion = requirement.acceptanceCriteria[i];
        const propertyType = this.inferPropertyType(criterion.response);
        
        properties.push({
          id: `${requirement.id}.${i + 1}`,
          name: this.generatePropertyName(criterion.response),
          description: `system behavior, ${criterion.response.toLowerCase()}`,
          validatesRequirements: [criterion.id],
          propertyType
        });
      }
    }

    return properties;
  }

  private generateErrorHandlingTemplate(): string {
    return `### Input Validation
- Validate all user inputs against expected formats and constraints
- Provide clear error messages for invalid inputs
- Implement proper sanitization for security

### Exception Management
- Use structured exception handling with specific error types
- Log errors with appropriate detail levels
- Implement graceful degradation where possible

### Recovery Mechanisms
- Provide retry logic for transient failures
- Implement circuit breaker patterns for external dependencies
- Maintain system stability during error conditions`;
  }

  private generateTestingStrategyTemplate(framework?: string): string {
    const testFramework = framework || 'vitest';
    
    return `The testing approach combines unit tests and property-based tests to ensure comprehensive coverage:

### Unit Testing
- Test specific examples and edge cases for each component
- Verify integration points between components
- Use ${testFramework} as the testing framework
- Focus on concrete scenarios and error conditions

### Property-Based Testing
- Verify universal properties that should hold across all inputs
- Use property-based testing library for ${testFramework === 'vitest' ? 'fast-check' : 'appropriate PBT library'}
- Configure each property test to run minimum 100 iterations
- Tag each property test with corresponding design property reference

### Integration Testing
- Test complete workflows end-to-end
- Verify system behavior under various load conditions
- Test error scenarios and recovery mechanisms

Both unit tests and property tests are complementary: unit tests catch specific bugs, property tests verify general correctness.`;
  }

  private extractComponentName(feature: string): string | null {
    // Simple heuristic to extract component names from feature descriptions
    const words = feature.split(' ');
    const meaningfulWords = words.filter(word => 
      word.length > 3 && 
      !['want', 'need', 'have', 'with', 'from', 'that', 'this'].includes(word.toLowerCase())
    );
    
    if (meaningfulWords.length > 0) {
      return meaningfulWords[0].charAt(0).toUpperCase() + meaningfulWords[0].slice(1) + 'Manager';
    }
    
    return null;
  }

  private extractEntities(requirements: RequirementDocument): string[] {
    const entities = new Set<string>();
    
    // Look for nouns in requirements that might be entities
    for (const requirement of requirements.requirements) {
      const text = `${requirement.userStory.feature} ${requirement.acceptanceCriteria.map(c => c.response).join(' ')}`;
      const words = text.split(/\s+/);
      
      for (const word of words) {
        const cleaned = word.replace(/[^a-zA-Z]/g, '');
        if (cleaned.length > 3 && /^[A-Z]/.test(cleaned)) {
          entities.add(cleaned);
        }
      }
    }
    
    return Array.from(entities).slice(0, 3); // Limit to 3 entities
  }

  private inferPropertyType(response: string): CorrectnessProperty['propertyType'] {
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('maintain') || lowerResponse.includes('preserve')) {
      return 'invariant';
    }
    if (lowerResponse.includes('parse') || lowerResponse.includes('serialize') || lowerResponse.includes('encode')) {
      return 'round-trip';
    }
    if (lowerResponse.includes('same') || lowerResponse.includes('identical')) {
      return 'idempotence';
    }
    if (lowerResponse.includes('error') || lowerResponse.includes('fail')) {
      return 'error-condition';
    }
    
    return 'metamorphic'; // Default fallback
  }

  private generatePropertyName(response: string): string {
    const words = response.split(' ').slice(0, 3);
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  /**
   * Parse markdown content back to DesignDocument object
   * Note: This is a basic parser for the specific format we generate
   */
  private parseMarkdownToDocument(markdown: string): DesignDocument {
    const sections = this.extractMarkdownSections(markdown);
    
    return {
      overview: sections.overview || '',
      architecture: sections.architecture || '',
      components: this.parseComponentSections(sections.components || ''),
      dataModels: this.parseDataModelSections(sections.dataModels || ''),
      correctnessProperties: this.parseCorrectnessProperties(sections.correctnessProperties || ''),
      errorHandling: sections.errorHandling || '',
      testingStrategy: sections.testingStrategy || ''
    };
  }

  private extractMarkdownSections(markdown: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = markdown.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        // Save previous section
        if (currentSection) {
          sections[this.sectionNameToKey(currentSection)] = currentContent.join('\n').trim();
        }
        
        // Start new section
        currentSection = line.substring(3).trim();
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      sections[this.sectionNameToKey(currentSection)] = currentContent.join('\n').trim();
    }

    return sections;
  }

  private sectionNameToKey(sectionName: string): string {
    const mapping: Record<string, string> = {
      'Overview': 'overview',
      'Architecture': 'architecture',
      'Components and Interfaces': 'components',
      'Data Models': 'dataModels',
      'Correctness Properties': 'correctnessProperties',
      'Error Handling': 'errorHandling',
      'Testing Strategy': 'testingStrategy'
    };
    return mapping[sectionName] || sectionName.toLowerCase().replace(/\s+/g, '');
  }

  private parseComponentSections(content: string): ComponentSection[] {
    const components: ComponentSection[] = [];
    const componentBlocks = content.split(/### /);

    for (const block of componentBlocks) {
      if (!block.trim()) continue;

      const lines = block.split('\n');
      const name = lines[0]?.trim();
      if (!name) continue;

      const description = lines[1]?.trim() || '';
      const interfaces: string[] = [];
      const responsibilities: string[] = [];

      let inInterfaces = false;
      let inResponsibilities = false;

      for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '**Interfaces:**') {
          inInterfaces = true;
          inResponsibilities = false;
        } else if (line === '**Responsibilities:**') {
          inInterfaces = false;
          inResponsibilities = true;
        } else if (line.startsWith('- ')) {
          const item = line.substring(2).trim();
          if (inInterfaces) {
            interfaces.push(item);
          } else if (inResponsibilities) {
            responsibilities.push(item);
          }
        }
      }

      components.push({ name, description, interfaces, responsibilities });
    }

    return components;
  }

  private parseDataModelSections(content: string): DataModelSection[] {
    const models: DataModelSection[] = [];
    const modelBlocks = content.split(/### /);

    for (const block of modelBlocks) {
      if (!block.trim()) continue;

      const lines = block.split('\n');
      const name = lines[0]?.trim();
      if (!name) continue;

      const description = lines[1]?.trim() || '';
      let structure = '';
      const relationships: string[] = [];

      let inCodeBlock = false;
      let inRelationships = false;

      for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim() === '```') {
          inCodeBlock = !inCodeBlock;
        } else if (inCodeBlock) {
          structure += line + '\n';
        } else if (line.trim() === '**Relationships:**') {
          inRelationships = true;
        } else if (inRelationships && line.trim().startsWith('- ')) {
          relationships.push(line.trim().substring(2));
        }
      }

      models.push({ name, description, structure: structure.trim(), relationships });
    }

    return models;
  }

  private parseCorrectnessProperties(content: string): CorrectnessProperty[] {
    const properties: CorrectnessProperty[] = [];
    const propertyBlocks = content.split(/### Property \d+:/);

    for (let i = 1; i < propertyBlocks.length; i++) {
      const block = propertyBlocks[i];
      const lines = block.split('\n');
      
      const nameMatch = lines[0]?.match(/^(.+)$/);
      const name = nameMatch?.[1]?.trim() || '';
      
      const descriptionMatch = lines[1]?.match(/^\*For any\*\s+(.+)$/);
      const description = descriptionMatch?.[1]?.trim() || '';
      
      const validatesMatch = lines[2]?.match(/\*\*Validates: Requirements (.+)\*\*/);
      const validatesRequirements = validatesMatch?.[1]?.split(', ') || [];

      if (name && description) {
        properties.push({
          id: i.toString(),
          name,
          description,
          validatesRequirements,
          propertyType: 'metamorphic' // Default, could be enhanced to parse actual type
        });
      }
    }

    return properties;
  }
}