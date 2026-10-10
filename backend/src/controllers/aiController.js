import Ticket from '../models/Ticket.js';
import Message from '../models/Message.js';
import createActivity from '../utils/createActivity.js';
import AppError from '../utils/AppError.js';
import { aiService } from '../services/aiService.js';

const hasCompleteAnalysis = (analysis) =>
  typeof analysis?.summary === 'string' &&
  analysis.summary.trim().length > 0 &&
  ['billing', 'technical', 'general', 'other'].includes(analysis.suggestedCategory) &&
  ['low', 'medium', 'high', 'urgent'].includes(analysis.suggestedPriority) &&
  Array.isArray(analysis.investigationSteps) &&
  analysis.investigationSteps.length > 0 &&
  analysis.investigationSteps.every(step => typeof step === 'string' && step.trim().length > 0) &&
  typeof analysis.draftResponse === 'string' &&
  analysis.draftResponse.trim().length > 0;

/**
 * Factory function to create AI controller with dependency injection
 * @param {Object} aiServiceInstance - AI service instance with analyzeTicket method
 * @returns {Object} Controller methods
 */
export const createAIController = (aiServiceInstance = aiService, logger = console) => {
  /**
   * POST /api/v1/tickets/:id/ai/analyze
   * Generate AI analysis for a ticket (agent / company_admin only).
   *
   * Uses req.ticket set by ownerOrAgent — that middleware already verified
   * the ticket belongs to req.membership.company, preventing cross-company cache leakage.
   */
  const analyzeTicketAI = async (req, res, next) => {
    try {
      const { user } = req;

      // Use the ticket already fetched and company-verified by ownerOrAgent.
      // Re-populate fields needed for the response.
      const ticket = await Ticket.findById(req.ticket._id)
        .populate('customer', 'name email')
        .populate('assignedTo', 'name email');

      if (!ticket) {
        return next(new AppError('Ticket not found.', 404));
      }

      // Check if AI analysis is already recent (within 1 hour).
      // The ticket is already scoped to the correct company by ownerOrAgent,
      // so cached analysis cannot leak across tenants.
      if (ticket.aiSummary && ticket.aiSummary.generatedAt) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCompleteAnalysis =
          new Date(ticket.aiSummary.generatedAt) > oneHourAgo &&
          hasCompleteAnalysis(ticket.aiSummary);
        if (recentCompleteAnalysis) {
          const isFallback = ticket.aiSummary.draftResponseSource === 'fallback';
          logger.info?.('[AI_DIAGNOSTIC]', {
            stage: 'controller_cache_decision',
            hasDraftResponse: true,
            draftResponseSource: ticket.aiSummary.draftResponseSource ?? 'unspecified',
            cacheAction: isFallback ? 'bypass_fallback' : 'reuse',
            companyId: req.membership?.company?.toString() ?? null,
          });
          if (!isFallback) {
            logger.info?.('[AI_DIAGNOSTIC]', {
              stage: 'controller_cache_reused',
              hasDraftResponse: true,
              draftResponseSource: ticket.aiSummary.draftResponseSource ?? 'unspecified',
            });
            return res.status(200).json({
              success: true,
              message: 'Using cached AI analysis (generated within last hour).',
              analysis: ticket.aiSummary,
              ticket: {
                id: ticket._id,
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                category: ticket.category,
              },
            });
          }
        }
      }

      // Fetch recent messages for context (scoped to this ticket which is already verified)
      const messages = await Message.find({ ticket: ticket._id })
        .populate('sender', 'name email role')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      // Generate analysis using injected AI service
      const analysis = await aiServiceInstance.analyzeTicket(
        ticket.title,
        ticket.description,
        messages
      );

      // Update ONLY aiSummary — never touches status, priority, category, or assignment
      ticket.aiSummary = analysis;
      await ticket.save();

      logger.info?.('[AI_DIAGNOSTIC]', {
        stage: 'controller_persisted',
        hasDraftResponse: Boolean(ticket.aiSummary?.draftResponse?.trim()),
        draftResponseSource: ticket.aiSummary?.draftResponseSource ?? 'unspecified',
        companyId: req.membership?.company?.toString() ?? null,
      });

      // Log activity, scoped to company when membership context is present
      await createActivity({
        ticketId: ticket._id,
        actorId: user._id,
        type: 'ai_analyzed',
        ...(req.membership ? { companyId: req.membership.company } : {}),
      });

      const response = {
        success: true,
        message: 'AI analysis generated successfully.',
        analysis,
        ticket: {
          id: ticket._id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
        },
      };
      logger.info?.('[AI_DIAGNOSTIC]', {
        stage: 'controller_response',
        hasDraftResponse: Boolean(response.analysis?.draftResponse?.trim()),
        draftResponseSource: response.analysis?.draftResponseSource ?? 'unspecified',
      });
      res.status(200).json(response);

    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/tickets/:id/ai/analyze
   * Retrieve existing AI analysis.
   * Uses req.ticket (already company-verified by ownerOrAgent).
   */
  const getTicketAIAnalysis = async (req, res, next) => {
    try {
      // Use company-verified ticket from ownerOrAgent
      const ticket = await Ticket.findById(req.ticket._id)
        .select('title status priority category aiSummary')
        .lean();

      if (!ticket) {
        return next(new AppError('Ticket not found.', 404));
      }

      if (!ticket.aiSummary) {
        return res.status(200).json({
          success: true,
          message: 'No AI analysis available for this ticket.',
          analysis: null,
          ticket: {
            id: ticket._id,
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            category: ticket.category,
          },
        });
      }

      if (!hasCompleteAnalysis(ticket.aiSummary)) {
        return next(new AppError(
          'Stored AI analysis is incomplete. Please run AI analysis again.',
          502
        ));
      }

      logger.info?.('[AI_DIAGNOSTIC]', {
        stage: 'controller_stored_response',
        hasDraftResponse: Boolean(ticket.aiSummary.draftResponse?.trim()),
        draftResponseSource: ticket.aiSummary.draftResponseSource ?? 'unspecified',
        companyId: req.membership?.company?.toString() ?? null,
      });

      res.status(200).json({
        success: true,
        message: 'AI analysis retrieved successfully.',
        analysis: ticket.aiSummary,
        ticket: {
          id: ticket._id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
        },
      });

    } catch (error) {
      next(error);
    }
  };

  return {
    analyzeTicketAI,
    getTicketAIAnalysis
  };
};

// Default controller instance for production use
export const aiController = createAIController();
