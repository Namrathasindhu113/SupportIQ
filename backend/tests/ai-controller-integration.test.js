import './setup.js'; // Load environment variables first
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createAIController } from '../src/controllers/aiController.js';
import { createAIService } from '../src/services/aiService.js';
import User from '../src/models/User.js';
import Ticket from '../src/models/Ticket.js';
import Message from '../src/models/Message.js';
import Activity from '../src/models/Activity.js';

describe('AI Controller Integration Tests', () => {
  let mongoServer;
  let customer;
  let agent;
  let ticket;
  let aiController;
  
  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });
  
  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  beforeEach(async () => {
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Message.deleteMany({});
    await Activity.deleteMany({});
    
    customer = await User.create({
      name: 'Test Customer',
      email: 'customer@test.com',
      password: 'password123',
      role: 'customer'
    });
    
    agent = await User.create({
      name: 'Test Agent',
      email: 'agent@test.com',
      password: 'password123',
      role: 'agent'
    });
    
    ticket = await Ticket.create({
      title: 'Login Issue',
      description: 'Cannot login after system update',
      customer: customer._id,
      status: 'open',
      priority: 'medium',
      category: 'technical'
    });
    
    const mockAIService = createAIService({
      createMockAnalyzer: async (title, desc, messages) => ({
        summary: `AI analysis for: ${title}`,
        suggestedCategory: 'technical',
        suggestedPriority: 'high',
        investigationSteps: ['Check logs', 'Test login'],
        draftResponse: 'We are investigating this login issue.',
        generatedAt: new Date()
      })
    });
    
    aiController = createAIController(mockAIService);
  });
  
  describe('getTicketAIAnalysis', () => {
    it('should return no analysis for ticket without AI summary', async () => {
      const req = {
        params: { id: ticket._id.toString() },
        ticket: ticket,   // pre-set by ownerOrAgent
        user: agent
      };
      
      let responseData;
      const res = {
        status: (code) => { assert.strictEqual(code, 200); return res; },
        json: (data) => { responseData = data; }
      };
      
      await aiController.getTicketAIAnalysis(req, res, (err) => { throw err; });
      
      assert(responseData);
      assert.strictEqual(responseData.success, true);
      assert.strictEqual(responseData.message, 'No AI analysis available for this ticket.');
      assert.strictEqual(responseData.analysis, null);
      assert.strictEqual(responseData.ticket.id.toString(), ticket._id.toString());
    });
    
    it('should return existing AI analysis', async () => {
      const analysis = {
        summary: 'Existing analysis',
        suggestedCategory: 'technical',
        suggestedPriority: 'high',
        investigationSteps: ['Existing step'],
        draftResponse: 'Existing response',
        generatedAt: new Date()
      };
      ticket.aiSummary = analysis;
      await ticket.save();
      
      const req = {
        params: { id: ticket._id.toString() },
        ticket: ticket,
        user: agent
      };
      
      let responseData;
      const res = {
        status: (code) => { assert.strictEqual(code, 200); return res; },
        json: (data) => { responseData = data; }
      };
      
      await aiController.getTicketAIAnalysis(req, res, (err) => { throw err; });
      
      assert(responseData);
      assert.strictEqual(responseData.success, true);
      assert(responseData.analysis);
      assert.strictEqual(responseData.analysis.summary, 'Existing analysis');
      assert.strictEqual(responseData.ticket.id.toString(), ticket._id.toString());
    });
    
    it('should return 404 for non-existent ticket', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const req = {
        params: { id: fakeId.toString() },
        ticket: { _id: fakeId },  // will cause DB re-fetch to return null
        user: agent
      };
      
      let error;
      await aiController.getTicketAIAnalysis(req, {}, (err) => { error = err; });
      
      assert(error);
      assert.strictEqual(error.message, 'Ticket not found.');
      assert.strictEqual(error.statusCode, 404);
    });
  });
  
  describe('analyzeTicketAI', () => {
    it('should replace a recent fallback with a valid Groq draft through persistence and response', async () => {
      const previousApiKey = process.env.GROQ_API_KEY;
      const previousModel  = process.env.GROQ_MODEL;
      process.env.GROQ_API_KEY = 'test-key';
      process.env.GROQ_MODEL   = 'test-model';
      const expectedDraft = 'I understand you cannot log in after the update. Could you share the exact error message you see?';
      const serviceDiagnostics    = [];
      const controllerDiagnostics = [];
      let groqCallCount = 0;

      ticket.aiSummary = {
        summary: 'Previous analysis',
        suggestedCategory: 'technical',
        suggestedPriority: 'high',
        investigationSteps: ['Review authentication logs'],
        draftResponse: 'Thank you for contacting us about "Login Issue".',
        draftResponseSource: 'fallback',
        generatedAt: new Date()
      };
      await ticket.save();

      const groqAIService = createAIService({
        createGroqClient: () => ({
          chat: {
            completions: {
              create: async () => {
                groqCallCount += 1;
                return {
                  choices: [{
                    finish_reason: 'stop',
                    message: {
                      content: JSON.stringify({
                        summary: 'The customer cannot log in after an update.',
                        suggestedCategory: 'technical',
                        suggestedPriority: 'high',
                        investigationSteps: ['Review authentication logs'],
                        draftResponse: expectedDraft
                      })
                    }
                  }]
                };
              }
            }
          }
        }),
        logger: {
          info: (...args) => serviceDiagnostics.push(args),
          warn: (...args) => serviceDiagnostics.push(args)
        }
      });
      const groqController = createAIController(groqAIService, {
        info: (...args) => controllerDiagnostics.push(args)
      });

      const req = {
        params: { id: ticket._id.toString() },
        ticket: ticket,
        user: agent
      };
      let responseData;
      const res = {
        status: (code) => { assert.strictEqual(code, 200); return res; },
        json: (data)  => { responseData = data; }
      };

      try {
        await groqController.analyzeTicketAI(req, res, (err) => { throw err; });

        const storedTicket = await Ticket.findById(ticket._id);
        assert.strictEqual(groqCallCount, 1, 'a cached fallback must not suppress a new Groq request');
        assert.strictEqual(responseData.analysis.draftResponse, expectedDraft);
        assert.notStrictEqual(responseData.analysis.draftResponseSource, 'fallback');
        assert.strictEqual(storedTicket.aiSummary.draftResponse, expectedDraft);
        assert.notStrictEqual(storedTicket.aiSummary.draftResponseSource, 'fallback');

        const lifecycleStages = [...serviceDiagnostics, ...controllerDiagnostics];
        const diagnosticFields = new Map(lifecycleStages.map(([, f]) => [f?.stage, f]));
        assert.strictEqual(diagnosticFields.get('controller_cache_decision')?.cacheAction, 'bypass_fallback');
        assert.strictEqual(diagnosticFields.get('groq_completion')?.modelId, 'test-model');
        assert.strictEqual(diagnosticFields.get('groq_completion')?.finishReason, 'stop');
        assert(diagnosticFields.get('groq_response_parsed')?.parsedPropertyNames.includes('draftResponse'));
        assert.strictEqual(diagnosticFields.get('service_analysis_validated')?.draftResponseSource, 'model');
        assert.strictEqual(diagnosticFields.get('controller_persisted')?.hasDraftResponse, true);
        assert.strictEqual(diagnosticFields.get('controller_response')?.hasDraftResponse, true);
        assert(!JSON.stringify(lifecycleStages).includes(expectedDraft));
        assert(lifecycleStages.map(([, f]) => f?.stage).includes('groq_draft_normalized'));
      } finally {
        if (previousApiKey === undefined) delete process.env.GROQ_API_KEY;
        else process.env.GROQ_API_KEY = previousApiKey;
        if (previousModel === undefined) delete process.env.GROQ_MODEL;
        else process.env.GROQ_MODEL = previousModel;
      }
    });

    it('should generate AI analysis for ticket', async () => {
      const req = {
        params: { id: ticket._id.toString() },
        ticket: ticket,
        user: agent
      };
      
      let responseData;
      const res = {
        status: (code) => { assert.strictEqual(code, 200); return res; },
        json: (data) => { responseData = data; }
      };
      
      await aiController.analyzeTicketAI(req, res, (err) => { throw err; });
      
      assert(responseData);
      assert.strictEqual(responseData.success, true);
      assert(responseData.analysis.summary.includes('AI analysis for:'));
      
      const updatedTicket = await Ticket.findById(ticket._id);
      assert(updatedTicket.aiSummary);
      assert.strictEqual(updatedTicket.aiSummary.summary, responseData.analysis.summary);
      
      const activity = await Activity.findOne({ ticket: ticket._id, type: 'ai_analyzed' });
      assert(activity);
      assert.strictEqual(activity.actor.toString(), agent._id.toString());
      
      // Must not mutate ticket operational fields
      assert.strictEqual(updatedTicket.status,     'open');
      assert.strictEqual(updatedTicket.priority,   'medium');
      assert.strictEqual(updatedTicket.category,   'technical');
      assert.strictEqual(updatedTicket.assignedTo, null);
    });
    
    it('should use cached analysis if recent', async () => {
      const recentTime = new Date(Date.now() - 30 * 60 * 1000);
      ticket.aiSummary = {
        summary: 'Cached analysis',
        suggestedCategory: 'technical',
        suggestedPriority: 'medium',
        investigationSteps: ['Cached step'],
        draftResponse: 'Cached response',
        generatedAt: recentTime
      };
      await ticket.save();
      
      const req = {
        params: { id: ticket._id.toString() },
        ticket: ticket,
        user: agent
      };
      let responseData;
      const res = {
        status: (code) => { assert.strictEqual(code, 200); return res; },
        json: (data) => { responseData = data; }
      };
      
      await aiController.analyzeTicketAI(req, res, (err) => { throw err; });
      
      assert(responseData.message.includes('Using cached AI analysis'));
      assert.strictEqual(responseData.analysis.summary, 'Cached analysis');
      
      const activityCount = await Activity.countDocuments({ ticket: ticket._id, type: 'ai_analyzed' });
      assert.strictEqual(activityCount, 0);
    });
    
    it('should generate new analysis if cached is old', async () => {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
      ticket.aiSummary = {
        summary: 'Old analysis',
        suggestedCategory: 'technical',
        suggestedPriority: 'medium',
        investigationSteps: ['Old step'],
        draftResponse: 'Old response',
        generatedAt: oldTime
      };
      await ticket.save();
      
      const req = {
        params: { id: ticket._id.toString() },
        ticket: ticket,
        user: agent
      };
      let responseData;
      const res = {
        status: (code) => { assert.strictEqual(code, 200); return res; },
        json: (data) => { responseData = data; }
      };
      
      await aiController.analyzeTicketAI(req, res, (err) => { throw err; });
      
      assert(responseData.message.includes('AI analysis generated successfully'));
      assert(responseData.analysis.summary.includes('AI analysis for:'));
      
      const activity = await Activity.findOne({ ticket: ticket._id, type: 'ai_analyzed' });
      assert(activity);
      assert.strictEqual(activity.actor.toString(), agent._id.toString());
    });
    
    it('should handle messages in context', async () => {
      await Message.create([
        { ticket: ticket._id, sender: customer._id, body: 'I cannot login' },
        { ticket: ticket._id, sender: agent._id,    body: 'Looking into it' }
      ]);
      
      const req = {
        params: { id: ticket._id.toString() },
        ticket: ticket,
        user: agent
      };
      let responseData;
      const res = {
        status: (code) => { assert.strictEqual(code, 200); return res; },
        json: (data) => { responseData = data; }
      };
      
      await aiController.analyzeTicketAI(req, res, (err) => { throw err; });
      
      assert.strictEqual(responseData.success, true);
      assert(responseData.analysis);
      const activity = await Activity.findOne({ ticket: ticket._id, type: 'ai_analyzed' });
      assert(activity);
    });
    
    it('should return 404 for non-existent ticket', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = {
        params: { id: fakeId.toString() },
        ticket: { _id: fakeId },
        user: agent
      };
      
      let error;
      await aiController.analyzeTicketAI(req, {}, (err) => { error = err; });
      
      assert(error);
      assert.strictEqual(error.message, 'Ticket not found.');
      assert.strictEqual(error.statusCode, 404);
    });
    
    it('should handle AI service errors', async () => {
      const failingService    = createAIService({ createMockAnalyzer: async () => { throw new Error('AI service failed'); } });
      const failingController = createAIController(failingService);
      
      const req = { params: { id: ticket._id.toString() }, ticket: ticket, user: agent };
      let error;
      await failingController.analyzeTicketAI(req, {}, (err) => { error = err; });
      
      assert(error);
      assert(error.message.includes('AI service failed'));
    });
  });
  
  describe('Ticket Field Safety', () => {
    it('should not change ticket fields during AI analysis', async () => {
      ticket.status     = 'in_progress';
      ticket.priority   = 'urgent';
      ticket.category   = 'billing';
      ticket.assignedTo = agent._id;
      await ticket.save();
      
      const req = {
        params: { id: ticket._id.toString() },
        ticket: ticket,
        user: agent
      };
      let responseData;
      const res = {
        status: (code) => { assert.strictEqual(code, 200); return res; },
        json: (data) => { responseData = data; }
      };
      
      await aiController.analyzeTicketAI(req, res, (err) => { throw err; });
      
      const updatedTicket = await Ticket.findById(ticket._id);
      assert.strictEqual(updatedTicket.status,            'in_progress');
      assert.strictEqual(updatedTicket.priority,          'urgent');
      assert.strictEqual(updatedTicket.category,          'billing');
      assert.strictEqual(updatedTicket.assignedTo.toString(), agent._id.toString());
      assert(updatedTicket.aiSummary);
      assert(updatedTicket.aiSummary.summary.includes('AI analysis for:'));
      
      const messageCount = await Message.countDocuments({ ticket: ticket._id });
      assert.strictEqual(messageCount, 0);
    });
  });
});
