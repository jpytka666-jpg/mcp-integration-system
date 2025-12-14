/**
 * Desktop Automation Integration Tests
 * Tests for PowerPoint automation, file system operations, clipboard, and UI automation
 * Requirements: Desktop automation aspects of requirements 4.3, 7.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  DesktopAutomationService,
  PowerPointGenerationRequest,
  FileOperation,
  ClipboardOperation,
  UIAutomationOperation,
  UISelector,
  UIElement
} from './desktop-automation.js';
import { PresentationData, SlideData, ChartData } from './types.js';

// ============ Test Arbitraries ============

const slideTypeArb = fc.constantFrom('title', 'content', 'chart', 'table', 'image') as fc.Arbitrary<SlideData['type']>;
const fileOpTypeArb = fc.constantFrom('read', 'write', 'copy', 'move', 'delete', 'exists', 'list', 'mkdir', 'stat') as fc.Arbitrary<FileOperation['type']>;
const clipboardOpTypeArb = fc.constantFrom('read', 'write', 'clear', 'hasFormat') as fc.Arbitrary<ClipboardOperation['type']>;
const uiOpTypeArb = fc.constantFrom('findWindow', 'click', 'type', 'sendKeys', 'focus', 'getState', 'waitFor') as fc.Arbitrary<UIAutomationOperation['type']>;

const slideDataArb = fc.record({
  id: fc.uuid(),
  type: slideTypeArb,
  title: fc.string({ minLength: 1, maxLength: 100 }),
  content: fc.anything(),
  layout: fc.string({ minLength: 1, maxLength: 30 }),
  notes: fc.option(fc.string({ maxLength: 500 }))
}) as fc.Arbitrary<SlideData>;

const presentationDataArb = fc.record({
  id: fc.uuid(),
  slides: fc.array(slideDataArb, { minLength: 1, maxLength: 10 }),
  template: fc.string({ minLength: 1, maxLength: 100 }),
  metadata: fc.record({
    title: fc.string({ minLength: 1, maxLength: 100 }),
    author: fc.string({ minLength: 1, maxLength: 50 }),
    createdDate: fc.date(),
    assessmentType: fc.string({ minLength: 1, maxLength: 50 })
  })
}) as fc.Arbitrary<PresentationData>;

const filePathArb = fc.string({ minLength: 1, maxLength: 100 }).map(s => `C:\\test\\${s.replace(/[^a-zA-Z0-9_]/g, '_')}`);

// ============ Tests ============

describe('Desktop Automation Integration Tests', () => {
  let service: DesktopAutomationService;

  beforeEach(() => {
    service = new DesktopAutomationService();
  });

  afterEach(() => {
    service.reset();
  });

  describe('PowerPoint Automation Tests', () => {

    it('should create presentations with valid structure', async () => {
      await fc.assert(fc.asyncProperty(
        presentationDataArb,
        filePathArb,
        async (presentation, outputPath) => {
          const request: PowerPointGenerationRequest = {
            presentation,
            outputPath: `${outputPath}.pptx`
          };

          const result = await service.createPresentation(request);

          // Property: Should succeed for valid input
          expect(result.success).toBe(true);
          expect(result.filePath).toBe(`${outputPath}.pptx`);
          expect(result.slideCount).toBe(presentation.slides.length);
          expect(result.duration).toBeGreaterThanOrEqual(0);
        }
      ), { numRuns: 20 });
    });

    it('should track active presentations correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(presentationDataArb, { minLength: 1, maxLength: 5 }),
        async (presentations) => {
          // Reset service before each property iteration
          service.reset();

          // Create multiple presentations
          for (let i = 0; i < presentations.length; i++) {
            await service.createPresentation({
              presentation: presentations[i],
              outputPath: `C:\\test\\presentation_${i}.pptx`
            });
          }

          // Property: Active presentations count should match
          const activePresentations = service.getActivePresentations();
          expect(activePresentations.size).toBe(presentations.length);
        }
      ), { numRuns: 10 });
    });

    it('should handle slide operations correctly', async () => {
      await fc.assert(fc.asyncProperty(
        presentationDataArb,
        slideDataArb,
        fc.integer({ min: 0, max: 5 }),
        async (presentation, newSlide, deleteIndex) => {
          // Reset service before each property iteration
          service.reset();

          // Create presentation
          const createResult = await service.createPresentation({
            presentation,
            outputPath: 'C:\\test\\slide_ops.pptx'
          });

          expect(createResult.success).toBe(true);

          // Get session ID from active presentations
          const activePresentations = service.getActivePresentations();
          const sessionId = Array.from(activePresentations.keys())[0];

          // Add slide
          const addResult = await service.addSlide(sessionId, { slideData: newSlide });
          expect(addResult.success).toBe(true);
          expect(addResult.slideCount).toBe(presentation.slides.length + 1);

          // Update slide (if valid index)
          if (deleteIndex < presentation.slides.length) {
            const updateResult = await service.updateSlide(sessionId, deleteIndex, { title: 'Updated' });
            expect(updateResult.success).toBe(true);
          }

          // Delete slide (if valid index)
          const currentCount = addResult.slideCount!;
          if (deleteIndex < currentCount) {
            const deleteResult = await service.deleteSlide(sessionId, deleteIndex);
            expect(deleteResult.success).toBe(true);
            expect(deleteResult.slideCount).toBe(currentCount - 1);
          }
        }
      ), { numRuns: 15 });
    });

    it('should save and close presentations correctly', async () => {
      await fc.assert(fc.asyncProperty(
        presentationDataArb,
        async (presentation) => {
          const outputPath = 'C:\\test\\save_close.pptx';

          const createResult = await service.createPresentation({
            presentation,
            outputPath
          });

          expect(createResult.success).toBe(true);

          const activePresentations = service.getActivePresentations();
          const sessionId = Array.from(activePresentations.keys())[0];

          // Save
          const saveResult = await service.savePresentation(sessionId);
          expect(saveResult.success).toBe(true);
          expect(saveResult.filePath).toBe(outputPath);

          // Close
          const closeResult = await service.closePresentation(sessionId, true);
          expect(closeResult.success).toBe(true);

          // Property: Presentation should be removed from active
          expect(service.getActivePresentations().size).toBe(0);
        }
      ), { numRuns: 15 });
    });

    it('should export presentations to different formats', async () => {
      await fc.assert(fc.asyncProperty(
        presentationDataArb,
        fc.constantFrom('pdf', 'png', 'jpg') as fc.Arbitrary<'pdf' | 'png' | 'jpg'>,
        async (presentation, format) => {
          const createResult = await service.createPresentation({
            presentation,
            outputPath: 'C:\\test\\export_test.pptx'
          });

          expect(createResult.success).toBe(true);

          const activePresentations = service.getActivePresentations();
          const sessionId = Array.from(activePresentations.keys())[0];

          // Export
          const exportPath = `C:\\test\\exported.${format}`;
          const exportResult = await service.exportPresentation(sessionId, exportPath, format);

          expect(exportResult.success).toBe(true);
          expect(exportResult.filePath).toBe(exportPath);
        }
      ), { numRuns: 10 });
    });

    it('should generate presentations from Revit data', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          projectName: fc.string({ minLength: 1, maxLength: 50 }),
          summary: fc.option(fc.string({ maxLength: 200 })),
          elementStats: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.integer({ min: 1, max: 1000 }))),
          families: fc.option(fc.array(fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            category: fc.string({ minLength: 1, maxLength: 30 }),
            instanceCount: fc.integer({ min: 1, max: 500 })
          }), { minLength: 1, maxLength: 10 })),
          assessmentType: fc.option(fc.string({ minLength: 1, maxLength: 30 }))
        }),
        async (revitData) => {
          const result = await service.generateFromRevitData(
            revitData,
            'C:\\templates\\default.pptx',
            'C:\\output\\revit_analysis.pptx'
          );

          expect(result.success).toBe(true);
          expect(result.slideCount).toBeGreaterThan(0);

          // Should create at least title slide
          expect(result.slideCount).toBeGreaterThanOrEqual(1);

          // If has summary, should have +1 slide
          // If has elementStats, should have +1 chart slide
          // If has families, should have +1 table slide
          let expectedMinSlides = 1; // Title slide
          if (revitData.summary) expectedMinSlides++;
          if (revitData.elementStats && Object.keys(revitData.elementStats).length > 0) expectedMinSlides++;
          if (revitData.families && revitData.families.length > 0) expectedMinSlides++;

          expect(result.slideCount).toBeGreaterThanOrEqual(expectedMinSlides);
        }
      ), { numRuns: 15 });
    });

    it('should reject invalid presentation requests', async () => {
      // Missing presentation
      const result1 = await service.createPresentation({
        presentation: undefined as any,
        outputPath: 'C:\\test\\invalid.pptx'
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Invalid request');

      // Missing outputPath
      const result2 = await service.createPresentation({
        presentation: { id: '1', slides: [], template: 't', metadata: {} as any },
        outputPath: ''
      });
      expect(result2.success).toBe(false);
    });

    it('should handle non-existent session errors', async () => {
      const fakeSessionId = 'non-existent-session';

      const addResult = await service.addSlide(fakeSessionId, {
        slideData: { id: '1', type: 'title', title: 'Test', content: {}, layout: 'title' }
      });
      expect(addResult.success).toBe(false);
      expect(addResult.error).toContain('Session not found');

      const saveResult = await service.savePresentation(fakeSessionId);
      expect(saveResult.success).toBe(false);

      const closeResult = await service.closePresentation(fakeSessionId);
      expect(closeResult.success).toBe(false);
    });
  });

  describe('File System Integration Tests', () => {

    it('should execute file operations correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fileOpTypeArb,
        filePathArb,
        async (opType, path) => {
          const operation: FileOperation = {
            type: opType,
            path,
            destination: opType === 'copy' || opType === 'move' ? `${path}_dest` : undefined,
            content: opType === 'write' ? 'test content' : undefined
          };

          const result = await service.executeFileOperation(operation);

          // Property: All operations should return valid result structure
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('path');

          // Property: Operations should succeed (simulated)
          expect(result.success).toBe(true);
        }
      ), { numRuns: 30 });
    });

    it('should check file existence correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom(
          'C:\\existing\\file.txt',
          'C:\\test\\document.pptx',
          'C:\\nonexistent\\file.doc'
        ),
        async (path) => {
          const result = await service.executeFileOperation({
            type: 'exists',
            path
          });

          expect(result.success).toBe(true);
          expect(result).toHaveProperty('exists');

          // Property: 'existing' paths and .pptx should exist (simulated behavior)
          if (path.includes('existing') || path.endsWith('.pptx')) {
            expect(result.exists).toBe(true);
          }
        }
      ), { numRuns: 10 });
    });

    it('should list directory contents', async () => {
      await fc.assert(fc.asyncProperty(
        filePathArb,
        async (path) => {
          const result = await service.executeFileOperation({
            type: 'list',
            path
          });

          expect(result.success).toBe(true);
          expect(result.files).toBeDefined();
          expect(Array.isArray(result.files)).toBe(true);

          // Property: Files should have proper structure
          for (const file of result.files!) {
            expect(file).toHaveProperty('name');
            expect(file).toHaveProperty('path');
            expect(file).toHaveProperty('type');
            expect(file).toHaveProperty('size');
            expect(['file', 'directory']).toContain(file.type);
          }
        }
      ), { numRuns: 10 });
    });

    it('should get file stats', async () => {
      await fc.assert(fc.asyncProperty(
        filePathArb,
        async (path) => {
          const result = await service.executeFileOperation({
            type: 'stat',
            path
          });

          expect(result.success).toBe(true);
          expect(result.stats).toBeDefined();

          const stats = result.stats!;
          expect(stats).toHaveProperty('size');
          expect(stats).toHaveProperty('isFile');
          expect(stats).toHaveProperty('isDirectory');
          expect(stats).toHaveProperty('created');
          expect(stats).toHaveProperty('modified');
        }
      ), { numRuns: 10 });
    });

    it('should handle disabled file system', async () => {
      const disabledService = new DesktopAutomationService({
        enableFileSystem: false
      });

      const result = await disabledService.executeFileOperation({
        type: 'read',
        path: 'C:\\test\\file.txt'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });
  });

  describe('Clipboard Integration Tests', () => {

    it('should read and write clipboard content', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 1000 }),
        async (content) => {
          // Write to clipboard
          const writeResult = await service.executeClipboardOperation({
            type: 'write',
            content,
            format: 'text'
          });

          expect(writeResult.success).toBe(true);

          // Read from clipboard
          const readResult = await service.executeClipboardOperation({
            type: 'read',
            format: 'text'
          });

          expect(readResult.success).toBe(true);
          expect(readResult.content).toBe(content);
        }
      ), { numRuns: 20 });
    });

    it('should clear clipboard', async () => {
      // Write something first
      await service.executeClipboardOperation({
        type: 'write',
        content: 'test content'
      });

      // Clear
      const clearResult = await service.executeClipboardOperation({
        type: 'clear'
      });

      expect(clearResult.success).toBe(true);

      // Verify cleared
      const readResult = await service.executeClipboardOperation({
        type: 'read'
      });

      expect(readResult.success).toBe(true);
      expect(readResult.content).toBe('');
    });

    it('should check clipboard format', async () => {
      // Write text content
      await service.executeClipboardOperation({
        type: 'write',
        content: 'text content',
        format: 'text'
      });

      // Check text format
      const hasTextResult = await service.executeClipboardOperation({
        type: 'hasFormat',
        format: 'text'
      });

      expect(hasTextResult.success).toBe(true);
      expect(hasTextResult.hasFormat).toBe(true);

      // Check image format (should be false)
      const hasImageResult = await service.executeClipboardOperation({
        type: 'hasFormat',
        format: 'image'
      });

      expect(hasImageResult.success).toBe(true);
      expect(hasImageResult.hasFormat).toBe(false);
    });

    it('should handle disabled clipboard', async () => {
      const disabledService = new DesktopAutomationService({
        enableClipboard: false
      });

      const result = await disabledService.executeClipboardOperation({
        type: 'read'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });
  });

  describe('UI Automation Integration Tests', () => {

    it('should find windows by selector', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          windowTitle: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          className: fc.option(fc.string({ minLength: 1, maxLength: 30 }))
        }),
        async (selector) => {
          const result = await service.executeUIOperation({
            type: 'findWindow',
            selector: selector as UISelector
          });

          expect(result.success).toBe(true);
          expect(result.element).toBeDefined();

          const element = result.element!;
          expect(element).toHaveProperty('handle');
          expect(element).toHaveProperty('name');
          expect(element).toHaveProperty('className');
          expect(element).toHaveProperty('bounds');
          expect(element).toHaveProperty('isEnabled');
          expect(element).toHaveProperty('isVisible');
        }
      ), { numRuns: 15 });
    });

    it('should perform UI element operations', async () => {
      // First find a window
      const findResult = await service.executeUIOperation({
        type: 'findWindow',
        selector: { windowTitle: 'Test Window' }
      });

      expect(findResult.success).toBe(true);
      const element = findResult.element!;

      // Click
      const clickResult = await service.executeUIOperation({
        type: 'click',
        target: element
      });
      expect(clickResult.success).toBe(true);

      // Focus
      const focusResult = await service.executeUIOperation({
        type: 'focus',
        target: element
      });
      expect(focusResult.success).toBe(true);

      // Type
      const typeResult = await service.executeUIOperation({
        type: 'type',
        target: element,
        value: 'Test input'
      });
      expect(typeResult.success).toBe(true);

      // Send keys
      const keysResult = await service.executeUIOperation({
        type: 'sendKeys',
        target: element,
        keys: ['Ctrl', 'A']
      });
      expect(keysResult.success).toBe(true);

      // Get state
      const stateResult = await service.executeUIOperation({
        type: 'getState',
        target: element
      });
      expect(stateResult.success).toBe(true);
      expect(stateResult.state).toBeDefined();
      expect(stateResult.state).toHaveProperty('isEnabled');
      expect(stateResult.state).toHaveProperty('isVisible');
    });

    it('should wait for elements', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          name: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
          className: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
          controlType: fc.option(fc.constantFrom('Button', 'TextBox', 'ComboBox', 'ListBox'))
        }),
        fc.integer({ min: 100, max: 5000 }),
        async (selector, timeout) => {
          const result = await service.executeUIOperation({
            type: 'waitFor',
            selector: selector as UISelector,
            timeout
          });

          expect(result.success).toBe(true);
          expect(result.element).toBeDefined();
        }
      ), { numRuns: 10 });
    });

    it('should handle disabled UI automation', async () => {
      const disabledService = new DesktopAutomationService({
        enableUIAutomation: false
      });

      const result = await disabledService.executeUIOperation({
        type: 'findWindow',
        selector: { windowTitle: 'Test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });
  });

  describe('Service Status and History Tests', () => {

    it('should track operation history', async () => {
      await fc.assert(fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (operationCount) => {
          // Reset service before each property iteration
          service.reset();

          // Perform multiple operations
          for (let i = 0; i < operationCount; i++) {
            await service.createPresentation({
              presentation: {
                id: `pres_${i}`,
                slides: [{ id: '1', type: 'title', title: 'Title', content: {}, layout: 'title' }],
                template: 'default',
                metadata: { title: 'Test', author: 'Test', createdDate: new Date(), assessmentType: 'test' }
              },
              outputPath: `C:\\test\\history_${i}.pptx`
            });
          }

          const history = service.getOperationHistory();
          expect(history.length).toBe(operationCount);

          // Property: All operations should have required fields
          for (const op of history) {
            expect(op).toHaveProperty('success');
            expect(op).toHaveProperty('operation');
            expect(op).toHaveProperty('duration');
          }
        }
      ), { numRuns: 10 });
    });

    it('should provide accurate service status', async () => {
      // Initial status
      const initialStatus = service.getStatus();
      expect(initialStatus.isInitialized).toBe(false);
      expect(initialStatus.activePresentations).toBe(0);
      expect(initialStatus.operationCount).toBe(0);

      // Create some presentations
      await service.createPresentation({
        presentation: {
          id: 'test',
          slides: [{ id: '1', type: 'title', title: 'Test', content: {}, layout: 'title' }],
          template: 'default',
          metadata: { title: 'Test', author: 'Test', createdDate: new Date(), assessmentType: 'test' }
        },
        outputPath: 'C:\\test\\status.pptx'
      });

      // Updated status
      const updatedStatus = service.getStatus();
      expect(updatedStatus.isInitialized).toBe(true);
      expect(updatedStatus.activePresentations).toBe(1);
      expect(updatedStatus.operationCount).toBe(1);
    });

    it('should reset service state correctly', async () => {
      // Create presentations and perform operations
      await service.createPresentation({
        presentation: {
          id: 'test',
          slides: [{ id: '1', type: 'title', title: 'Test', content: {}, layout: 'title' }],
          template: 'default',
          metadata: { title: 'Test', author: 'Test', createdDate: new Date(), assessmentType: 'test' }
        },
        outputPath: 'C:\\test\\reset.pptx'
      });

      await service.executeClipboardOperation({
        type: 'write',
        content: 'test'
      });

      // Reset
      service.reset();

      // Verify reset
      const status = service.getStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.activePresentations).toBe(0);
      expect(status.operationCount).toBe(0);

      // Clipboard should be empty
      const clipboardResult = await service.executeClipboardOperation({
        type: 'read'
      });
      expect(clipboardResult.content).toBe('');
    });

    it('should limit operation history to 100 entries', async () => {
      // Perform 110 operations
      for (let i = 0; i < 110; i++) {
        await service.createPresentation({
          presentation: {
            id: `pres_${i}`,
            slides: [{ id: '1', type: 'title', title: 'Title', content: {}, layout: 'title' }],
            template: 'default',
            metadata: { title: 'Test', author: 'Test', createdDate: new Date(), assessmentType: 'test' }
          },
          outputPath: `C:\\test\\limit_${i}.pptx`
        });
      }

      const history = service.getOperationHistory();

      // Property: History should be capped at 100
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Configuration Tests', () => {

    it('should apply custom configuration', () => {
      const customService = new DesktopAutomationService({
        defaultTimeout: 60000,
        enableClipboard: false,
        enableUIAutomation: false,
        enableFileSystem: false,
        tempDirectory: 'D:\\CustomTemp'
      });

      const status = customService.getStatus();
      expect(status.config.defaultTimeout).toBe(60000);
      expect(status.config.enableClipboard).toBe(false);
      expect(status.config.enableUIAutomation).toBe(false);
      expect(status.config.enableFileSystem).toBe(false);
      expect(status.config.tempDirectory).toBe('D:\\CustomTemp');
    });

    it('should use default configuration when not specified', () => {
      const defaultService = new DesktopAutomationService();
      const status = defaultService.getStatus();

      expect(status.config.defaultTimeout).toBe(30000);
      expect(status.config.enableClipboard).toBe(true);
      expect(status.config.enableUIAutomation).toBe(true);
      expect(status.config.enableFileSystem).toBe(true);
    });
  });
});
