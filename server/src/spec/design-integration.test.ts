import { describe, it, expect } from 'vitest';

describe('Design Generator Integration', () => {
  it('should be able to import design generator', async () => {
    const { DesignGenerator } = await import('./design-generator.js');
    expect(DesignGenerator).toBeDefined();
    
    const generator = new DesignGenerator();
    expect(generator).toBeInstanceOf(DesignGenerator);
  });

  it('should generate and validate design documents', async () => {
    const { DesignGenerator } = await import('./design-generator.js');
    
    const generator = new DesignGenerator();
    const mockRequirements = {
      introduction: 'A test system',
      glossary: [{ term: 'Test', definition: 'A test term' }],
      requirements: [{
        id: '1',
        userStory: { role: 'user', feature: 'test feature', benefit: 'test benefit' },
        acceptanceCriteria: [{
          id: '1.1',
          pattern: 'ubiquitous' as const,
          system: 'Test System',
          response: 'perform test action'
        }]
      }]
    };

    const options = {
      featureName: 'TestFeature',
      requirementsDocument: mockRequirements,
      includeArchitectureDiagram: true,
      testingFramework: 'vitest'
    };

    const result = generator.generateTemplate(options);
    expect(result).toBeDefined();
    expect(result.overview).toContain('TestFeature');
    
    const validation = generator.validateDocument(result);
    expect(validation.valid).toBe(true);
    
    const markdown = generator.generateMarkdown(result);
    expect(markdown).toContain('# Design Document');
    expect(markdown).toContain('## Correctness Properties');
  });
});