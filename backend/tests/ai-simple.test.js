import './setup.js'; // Load environment variables first
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createAIService } from '../src/services/aiService.js';

describe('AI Service - Simple Tests', () => {
  const aiService = createAIService({
    createMockAnalyzer: async (title, desc, messages) => ({
      summary: `Mock analysis for: ${title}`,
      suggestedCategory: 'technical',
      suggestedPriority: 'medium',
      investigationSteps: ['Step 1', 'Step 2'],
      draftResponse: 'Mock response',
      generatedAt: new Date()
    })
  });
  
  describe('mockAnalyzeTicket', () => {
    it('should return mock analysis with correct structure', async () => {
      const title = 'Login issue';
      const description = 'Cannot login after update';
      
      const result = await aiService.mockAnalyzeTicket(title, description);
      
      assert.strictEqual(typeof result.summary, 'string');
      assert.strictEqual(typeof result.suggestedCategory, 'string');
      assert.strictEqual(typeof result.suggestedPriority, 'string');
      assert(Array.isArray(result.investigationSteps));
      assert.strictEqual(typeof result.draftResponse, 'string');
      assert(result.generatedAt instanceof Date);
      
      // Validate enum values
      const validCategories = ['billing', 'technical', 'general', 'other'];
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      
      assert(validCategories.includes(result.suggestedCategory));
      assert(validPriorities.includes(result.suggestedPriority));
    });
    
    it('should include ticket title in summary', async () => {
      const title = 'Specific Login Issue';
      const description = 'Cannot login after update';
      
      const result = await aiService.mockAnalyzeTicket(title, description);
      
      assert(result.summary.includes('Mock analysis for:'));
      assert(result.summary.includes('Specific'));
    });
    
    it('should have investigation steps array', async () => {
      const result = await aiService.mockAnalyzeTicket('test', 'test');
      
      assert(Array.isArray(result.investigationSteps));
      assert(result.investigationSteps.length > 0);
      assert.strictEqual(typeof result.investigationSteps[0], 'string');
    });
    
    it('should return valid draft response', async () => {
      const result = await aiService.mockAnalyzeTicket('test', 'test');
      
      assert(result.draftResponse.length > 0);
      assert(result.draftResponse.includes('Thank you'));
    });
  });
});