import './setup.js'; // Load environment variables first
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createAIService } from '../src/services/aiService.js';
import AppError from '../src/utils/AppError.js';

describe('AI Service Integration Tests', () => {
  describe('Error Handling', () => {
    it('should throw AppError when GROQ_API_KEY is not configured', async () => {
      const originalEnv = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;
      
      const aiService = createAIService({
        createMockAnalyzer: () => {
          throw new Error('Should not be called');
        }
      });
      
      try {
        await aiService.analyzeTicket('test', 'test');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof AppError);
        assert.strictEqual(error.message, 'GROQ_API_KEY is not configured.');
        assert.strictEqual(error.statusCode, 500);
      } finally {
        process.env.GROQ_API_KEY = originalEnv;
      }
    });
    
    it('should throw AppError when GROQ_MODEL is not configured', async () => {
      const originalEnv = process.env.GROQ_MODEL;
      process.env.GROQ_API_KEY = 'test-key';
      delete process.env.GROQ_MODEL;
      
      const aiService = createAIService({
        createMockAnalyzer: () => {
          throw new Error('Should not be called');
        }
      });
      
      try {
        await aiService.analyzeTicket('test', 'test');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof AppError);
        assert.strictEqual(error.message, 'GROQ_MODEL is not configured.');
        assert.strictEqual(error.statusCode, 500);
      } finally {
        process.env.GROQ_MODEL = originalEnv;
        delete process.env.GROQ_API_KEY;
      }
    });
    
    it('should use mock analyzer when no Groq client provided', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      
      let mockCalled = false;
      const aiService = createAIService({
        createMockAnalyzer: async (title, desc, messages) => {
          mockCalled = true;
          return {
            summary: 'Mock summary',
            suggestedCategory: 'technical',
            suggestedPriority: 'medium',
            investigationSteps: ['Step 1'],
            draftResponse: 'Mock response',
            generatedAt: new Date()
          };
        }
      });
      
      const result = await aiService.analyzeTicket('test', 'test');
      assert(mockCalled);
      assert.strictEqual(result.summary, 'Mock summary');
      
      delete process.env.GROQ_API_KEY;
      delete process.env.GROQ_MODEL;
    });
    
    it('should throw AppError when neither Groq client nor mock analyzer provided', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      
      const aiService = createAIService({
        // No createGroqClient or createMockAnalyzer provided
      });
      
      try {
        await aiService.analyzeTicket('test', 'test');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof AppError);
        assert.strictEqual(error.message, 'AI service not properly configured for testing.');
        assert.strictEqual(error.statusCode, 500);
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });
  });
  
  describe('Mock Analyzer', () => {
    const aiService = createAIService({
      createMockAnalyzer: async (title, desc, messages) => ({
        summary: `Mock analysis for: ${title}`,
        suggestedCategory: 'technical',
        suggestedPriority: 'high',
        investigationSteps: ['Investigate logs', 'Test solution'],
        draftResponse: 'Mock draft response',
        generatedAt: new Date()
      })
    });
    
    it('should return valid mock analysis structure', async () => {
      const result = await aiService.mockAnalyzeTicket('Login Issue', 'Cannot login');
      
      assert.strictEqual(typeof result.summary, 'string');
      assert.strictEqual(result.suggestedCategory, 'technical');
      assert.strictEqual(result.suggestedPriority, 'medium');
      assert(Array.isArray(result.investigationSteps));
      assert.strictEqual(typeof result.draftResponse, 'string');
      assert(result.generatedAt instanceof Date);
    });
    
    it('should handle analyzeTicket with mock', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      
      const result = await aiService.analyzeTicket('Login Issue', 'Cannot login', []);
      
      assert.strictEqual(typeof result.summary, 'string');
      assert(result.summary.includes('Mock analysis for:'));
      assert.strictEqual(result.suggestedCategory, 'technical');
      assert.strictEqual(result.suggestedPriority, 'high');
      assert(Array.isArray(result.investigationSteps));
      assert.strictEqual(typeof result.draftResponse, 'string');
      assert(result.generatedAt instanceof Date);
      
      delete process.env.GROQ_API_KEY;
      delete process.env.GROQ_MODEL;
    });
  });
  
  describe('Validation and Sanitization', () => {
    it('should parse a complete fenced JSON response and request structured output', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      let requestOptions;

      const mockGroqClient = () => ({
        chat: {
          completions: {
            create: async (options) => {
              requestOptions = options;
              return {
                choices: [{
                  message: {
                    content: `\`\`\`json\n${JSON.stringify({
                      summary: 'The customer cannot sign in after an update.',
                      suggestedCategory: 'technical',
                      suggestedPriority: 'high',
                      investigationSteps: ['Review authentication logs'],
                      draftResponse: 'We understand you cannot sign in. We will review this issue and follow up.'
                    })}\n\`\`\``
                  }
                }]
              };
            }
          }
        }
      });
      
      const aiService = createAIService({
        createGroqClient: mockGroqClient
      });
      
      try {
        const result = await aiService.analyzeTicket('Login issue', 'Cannot sign in');

        assert.strictEqual(result.summary, 'The customer cannot sign in after an update.');
        assert.strictEqual(result.suggestedCategory, 'technical');
        assert.strictEqual(result.suggestedPriority, 'high');
        assert.deepStrictEqual(result.investigationSteps, ['Review authentication logs']);
        assert.strictEqual(result.draftResponse, 'We understand you cannot sign in. We will review this issue and follow up.');
        assert(result.generatedAt instanceof Date);
        assert.deepStrictEqual(requestOptions.response_format, { type: 'json_object' });
        assert(requestOptions.messages[0].content.includes('exactly these five required fields'));
        assert(requestOptions.messages[0].content.includes('draftResponse: REQUIRED'));
        assert(requestOptions.messages[0].content.includes('Do not invent a diagnosis'));
        assert(requestOptions.messages[0].content.includes('Return draftResponse as a non-empty string'));
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });

    it('should generate and identify a safe fallback when draftResponse is missing', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      const warnings = [];

      const mockGroqClient = () => ({
        chat: {
          completions: {
            create: async () => ({
              choices: [{
                message: {
                  content: JSON.stringify({
                    summary: 'The customer cannot sign in.',
                    suggestedCategory: 'technical',
                    suggestedPriority: 'high',
                    investigationSteps: ['Review authentication logs']
                  })
                }
              }]
            })
          }
        }
      });
      
      const aiService = createAIService({
        createGroqClient: mockGroqClient,
        logger: {
          warn: (...args) => warnings.push(args)
        }
      });

      try {
        const result = await aiService.analyzeTicket('Login issue', 'Cannot sign in');

        assert.strictEqual(result.suggestedCategory, 'technical');
        assert.strictEqual(result.suggestedPriority, 'high');
        assert(result.draftResponse.includes('"Login issue"'));
        assert.strictEqual(result.draftResponseSource, 'fallback');
        assert.strictEqual(warnings.length, 1);
        assert.strictEqual(warnings[0][1].event, 'ai_response_draft_missing');
        assert.strictEqual(warnings[0][1].fieldState, 'omitted');
        assert.strictEqual(warnings[0][1].alternateField, null);
        assert(!JSON.stringify(warnings).includes('Cannot sign in'));
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });

    it('should accept a recognized alternate customer-draft field and log only its field name', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      const warnings = [];
      const draft = 'I understand the sign-in issue you described. Could you share the exact error message?';

      const aiService = createAIService({
        createGroqClient: () => ({
          chat: {
            completions: {
              create: async () => ({
                choices: [{
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify({
                      summary: 'The customer cannot sign in.',
                      suggestedCategory: 'technical',
                      suggestedPriority: 'high',
                      investigationSteps: ['Review authentication logs'],
                      customerResponse: draft
                    })
                  }
                }]
              })
            }
          }
        }),
        logger: {
          warn: (...args) => warnings.push(args)
        }
      });

      try {
        const result = await aiService.analyzeTicket('Login issue', 'Cannot sign in');

        assert.strictEqual(result.draftResponse, draft);
        assert.notStrictEqual(result.draftResponseSource, 'fallback');
        assert.strictEqual(warnings.length, 1);
        assert.strictEqual(warnings[0][1].alternateField, 'customerResponse');
        assert.strictEqual(warnings[0][1].finishReason, 'stop');
        assert(!JSON.stringify(warnings).includes(draft));
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });

    it('should use strict JSON Schema output for Groq models that support it', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
      let requestOptions;

      const aiService = createAIService({
        createGroqClient: () => ({
          chat: {
            completions: {
              create: async options => {
                requestOptions = options;
                return {
                  choices: [{
                    message: {
                      content: JSON.stringify({
                        summary: 'The customer cannot sign in.',
                        suggestedCategory: 'technical',
                        suggestedPriority: 'high',
                        investigationSteps: ['Review authentication logs'],
                        draftResponse: 'I understand the sign-in issue you described. Could you share the exact error message?'
                      })
                    }
                  }]
                };
              }
            }
          }
        })
      });

      try {
        await aiService.analyzeTicket('Login issue', 'Cannot sign in');
        assert.strictEqual(requestOptions.response_format.type, 'json_schema');
        assert.strictEqual(requestOptions.response_format.json_schema.strict, true);
        assert.deepStrictEqual(
          requestOptions.response_format.json_schema.schema.required,
          ['summary', 'suggestedCategory', 'suggestedPriority', 'investigationSteps', 'draftResponse']
        );
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });
    
    it('should reject invalid category, priority, and investigation steps', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';

      let analysis = {
        summary: 'Test summary',
        suggestedCategory: 'not-a-category',
        suggestedPriority: 'high',
        investigationSteps: ['Step 1'],
        draftResponse: 'Test response'
      };
      const mockGroqClient = () => ({
        chat: {
          completions: {
            create: async () => ({
              choices: [{
                message: {
                  content: JSON.stringify(analysis)
                }
              }]
            })
          }
        }
      });
      
      const aiService = createAIService({
        createGroqClient: mockGroqClient
      });

      try {
        const invalidResponses = [
          ['suggestedCategory', 'not-a-category'],
          ['suggestedPriority', 'not-a-priority'],
          ['investigationSteps', 'not an array']
        ];

        for (const [field, invalidValue] of invalidResponses) {
          analysis = {
            summary: 'Test summary',
            suggestedCategory: 'technical',
            suggestedPriority: 'high',
            investigationSteps: ['Step 1'],
            draftResponse: 'Test response',
            [field]: invalidValue
          };

          await assert.rejects(
            () => aiService.analyzeTicket('test', 'test'),
            error => error instanceof AppError &&
              error.statusCode === 502 &&
              error.message.includes(`invalid required field: ${field}`)
          );
        }
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });
    
    it('should throw AppError for missing required fields', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      
      const mockGroqClient = () => ({
        chat: {
          completions: {
            create: async () => ({
              choices: [{
                message: {
                  content: JSON.stringify({
                    summary: 'Test summary',
                    // Missing suggestedCategory
                    suggestedPriority: 'high',
                    investigationSteps: ['Step 1'],
                    draftResponse: 'Test response'
                  })
                }
              }]
            })
          }
        }
      });
      
      const aiService = createAIService({
        createGroqClient: mockGroqClient
      });

      try {
        await aiService.analyzeTicket('test', 'test');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof AppError);
        assert.strictEqual(error.message, 'AI response missing required field: suggestedCategory');
        assert.strictEqual(error.statusCode, 502);
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });
    
    it('should throw AppError for empty API response', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      
      const mockGroqClient = () => ({
        chat: {
          completions: {
            create: async () => ({
              choices: [{
                message: {
                  content: '' // Empty response
                }
              }]
            })
          }
        }
      });
      
      const aiService = createAIService({
        createGroqClient: mockGroqClient
      });
      
      try {
        await aiService.analyzeTicket('test', 'test');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof AppError);
        assert.strictEqual(error.message, 'AI service returned empty response.');
        assert.strictEqual(error.statusCode, 502);
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });
    
    it('should throw AppError for invalid JSON response', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      
      const mockGroqClient = () => ({
        chat: {
          completions: {
            create: async () => ({
              choices: [{
                message: {
                  content: 'Invalid JSON {' // Invalid JSON
                }
              }]
            })
          }
        }
      });
      
      const aiService = createAIService({
        createGroqClient: mockGroqClient
      });
      
      try {
        await aiService.analyzeTicket('test', 'test');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof AppError);
        assert.strictEqual(error.message, 'AI service returned invalid JSON format.');
        assert.strictEqual(error.statusCode, 502);
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });
    
    it('should throw AppError for Groq API errors', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL = 'test-model';
      
      const mockGroqClient = () => ({
        chat: {
          completions: {
            create: async () => {
              throw new Error('API Error: Rate limit exceeded');
            }
          }
        }
      });
      
      const aiService = createAIService({
        createGroqClient: mockGroqClient
      });
      
      try {
        await aiService.analyzeTicket('test', 'test');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof AppError);
        assert(error.message.includes('AI analysis failed:'));
        assert.strictEqual(error.statusCode, 502);
      } finally {
        delete process.env.GROQ_API_KEY;
        delete process.env.GROQ_MODEL;
      }
    });
  });
});