import AppError from '../utils/AppError.js';

const requiredAnalysisFields = [
  'summary',
  'suggestedCategory',
  'suggestedPriority',
  'investigationSteps',
  'draftResponse'
];
const validCategories = ['billing', 'technical', 'general', 'other'];
const validPriorities = ['low', 'medium', 'high', 'urgent'];
const draftResponseAliases = [
  'draft_response',
  'customerResponse',
  'customer_reply',
  'responseDraft',
  'draftReply',
  'customerReply',
  'reply'
];
const strictStructuredOutputModels = new Set([
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b'
]);
const analysisJsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    suggestedCategory: { type: 'string', enum: validCategories },
    suggestedPriority: { type: 'string', enum: validPriorities },
    investigationSteps: { type: 'array', items: { type: 'string' } },
    draftResponse: { type: 'string' }
  },
  required: requiredAnalysisFields,
  additionalProperties: false
};

const responseFormatForModel = (model) => {
  if (strictStructuredOutputModels.has(model)) {
    return {
      type: 'json_schema',
      json_schema: {
        name: 'support_ticket_analysis',
        strict: true,
        schema: analysisJsonSchema
      }
    };
  }
  return { type: 'json_object' };
};

const parseAIResponse = (content) => {
  const trimmedContent = content.trim();
  const isMarkdownFenced = /^```(?:json)?\s*[\s\S]*?\s*```$/i.test(trimmedContent);
  const jsonContent = isMarkdownFenced
    ? trimmedContent.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1')
    : trimmedContent;
  return {
    analysis: JSON.parse(jsonContent),
    responseFormat: isMarkdownFenced ? 'markdown-fenced-json' : 'json'
  };
};

const getFieldState = (object, field) => {
  if (!object || !Object.hasOwn(object, field)) {
    return 'omitted';
  }
  if (typeof object[field] !== 'string') {
    return 'invalid_type';
  }
  return object[field].trim() ? 'present' : 'empty';
};

const createFallbackDraft = (ticketTitle) => {
  if (typeof ticketTitle !== 'string' || !ticketTitle.trim()) {
    return null;
  }

  const safeTitle = ticketTitle.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!safeTitle) {
    return null;
  }

  return `Thank you for contacting us about "${safeTitle}". We appreciate you bringing this to our attention. Our support team will review the details you provided and follow up with you. If you have any additional information that could help us investigate, please reply to this ticket.`;
};

const validateAnalysis = (analysis, ticketTitle) => {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
    throw new AppError('AI service returned an invalid analysis object.', 502);
  }

  for (const field of requiredAnalysisFields.slice(0, 4)) {
    if (!(field in analysis)) {
      throw new AppError(`AI response missing required field: ${field}`, 502);
    }
  }

  if (typeof analysis.summary !== 'string' || !analysis.summary.trim()) {
    throw new AppError('AI response has invalid required field: summary.', 502);
  }
  if (!validCategories.includes(analysis.suggestedCategory)) {
    throw new AppError('AI response has invalid required field: suggestedCategory.', 502);
  }
  if (!validPriorities.includes(analysis.suggestedPriority)) {
    throw new AppError('AI response has invalid required field: suggestedPriority.', 502);
  }
  if (
    !Array.isArray(analysis.investigationSteps) ||
    analysis.investigationSteps.length === 0 ||
    analysis.investigationSteps.some(step => typeof step !== 'string' || !step.trim())
  ) {
    throw new AppError('AI response has invalid required field: investigationSteps.', 502);
  }

  const hasDraftResponse =
    typeof analysis.draftResponse === 'string' && analysis.draftResponse.trim().length > 0;
  const draftResponse = hasDraftResponse
    ? analysis.draftResponse.trim()
    : createFallbackDraft(ticketTitle);

  if (!draftResponse) {
    throw new AppError(
      'AI response is missing draftResponse and a safe fallback could not be generated.',
      502
    );
  }

  return {
    summary: analysis.summary.trim(),
    suggestedCategory: analysis.suggestedCategory,
    suggestedPriority: analysis.suggestedPriority,
    investigationSteps: analysis.investigationSteps.map(step => step.trim()),
    draftResponse,
    ...(hasDraftResponse ? {} : { draftResponseSource: 'fallback' }),
    generatedAt: new Date()
  };
};

/**
 * Factory function to create AI service with dependency injection
 * @param {Object} options
 * @param {Function} options.createGroqClient - Function that returns a Groq client instance
 * @param {Function} options.createMockAnalyzer - Function that returns mock analyzer
 * @returns {Object} AI service methods
 */
export const createAIService = ({
  createGroqClient = null,
  createMockAnalyzer = null,
  logger = console
} = {}) => {
  /**
   * Analyze ticket using Groq API
   */
  const analyzeTicket = async (ticketTitle, ticketDescription, messages = []) => {
    try {
      // Check configuration
      if (!process.env.GROQ_API_KEY) {
        throw new AppError('GROQ_API_KEY is not configured.', 500);
      }

      if (!process.env.GROQ_MODEL) {
        throw new AppError('GROQ_MODEL is not configured.', 500);
      }

      let analysis;

      // Use mock if no Groq client provided (for testing)
      if (!createGroqClient) {
        if (!createMockAnalyzer) {
          throw new AppError('AI service not properly configured for testing.', 500);
        }
        analysis = await createMockAnalyzer(ticketTitle, ticketDescription, messages);
      } else {
        // Prepare conversation context
        const conversationContext = messages
          .slice(-10)
          .map(msg => `${msg.sender?.role === 'customer' ? 'Customer' : 'Agent'}: ${msg.body}`)
          .join('\n');

        const fullContext = `Ticket Title: ${ticketTitle}\n\nTicket Description: ${ticketDescription}` +
          (conversationContext ? `\n\nRecent Conversation:\n${conversationContext}` : '');

        const systemPrompt = `You are a customer support analyst. Return one JSON object containing exactly these five required fields. Never omit a field:

1. summary: A concise, 2-3 sentence summary of the issue
2. suggestedCategory: One of ['billing', 'technical', 'general', 'other'] - categorize the ticket
3. suggestedPriority: One of ['low', 'medium', 'high', 'urgent'] - assess urgency
4. investigationSteps: Array of 3-5 actionable steps to investigate/resolve (each step as a string)
5. draftResponse: REQUIRED. Write a concise, empathetic, customer-facing reply (2-3 sentences) that specifically acknowledges the problem described in this ticket and offers an appropriate next step.

Guidelines:
- For category: 'billing' = payments, invoices, charges; 'technical' = software bugs, setup issues, errors; 'general' = questions, how-tos, non-critical; 'other' = doesn't fit above
- For priority: 'urgent' = system down, security issue, major business impact; 'high' = critical function impaired; 'medium' = normal issue affecting user; 'low' = minor inconvenience, feature request
- investigationSteps should be specific, actionable, and technical
- draftResponse is for the customer, not the support agent. Refer to the reported issue using only details stated in the ticket or conversation.
- Do not invent a diagnosis, cause, fix, resolution, completed action, timeline, or commitment. If the available details are insufficient, acknowledge the issue and ask for relevant information without guessing.
- Return draftResponse as a non-empty string even if the issue is unclear. Do not substitute another field name.

Return ONLY valid JSON with exactly this structure:
{
  "summary": "string",
  "suggestedCategory": "string",
  "suggestedPriority": "string",
  "investigationSteps": ["string", "string", ...],
  "draftResponse": "string"
}`;

        const groqClient = await createGroqClient();
        const completion = await groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullContext }
          ],
          model: process.env.GROQ_MODEL,
          temperature: 0.2,
          max_tokens: 1500,
          response_format: responseFormatForModel(process.env.GROQ_MODEL),
        });

        const choice = completion?.choices?.[0];
        const message = choice?.message;
        const responseContent = message?.content;
        logger.info?.('[AI_DIAGNOSTIC]', {
          stage: 'groq_completion',
          modelId: process.env.GROQ_MODEL,
          choiceExists: Boolean(choice),
          messageExists: Boolean(message),
          finishReason: choice?.finish_reason ?? null,
          responseContentType: typeof responseContent,
          responseContentLength: typeof responseContent === 'string'
            ? responseContent.length
            : null
        });
        if (typeof responseContent !== 'string' || !responseContent.trim()) {
          throw new AppError('AI service returned empty response.', 502);
        }

        let responseFormat = 'unparsed';
        try {
          const parsedResponse = parseAIResponse(responseContent);
          analysis = parsedResponse.analysis;
          responseFormat = parsedResponse.responseFormat;
          logger.info?.('[AI_DIAGNOSTIC]', {
            stage: 'groq_response_parsed',
            modelId: process.env.GROQ_MODEL,
            responseFormat,
            parsedPropertyNames:
              analysis && typeof analysis === 'object' && !Array.isArray(analysis)
                ? Object.keys(analysis)
                : [],
            draftResponseState: getFieldState(analysis, 'draftResponse'),
            recognizedAliasStates: draftResponseAliases.map(field => ({
              field,
              state: getFieldState(analysis, field)
            }))
          });
        } catch (error) {
          if (error instanceof SyntaxError) {
            logger.warn('[AI] Groq returned unparseable analysis JSON.', {
              event: 'ai_response_parse_failed',
              responseFormat: /^```/.test(responseContent.trim())
                ? 'markdown-fenced-invalid-json'
                : 'invalid-json'
            });
          }
          throw error;
        }

        const aliasField = draftResponseAliases.find(
          field => typeof analysis?.[field] === 'string' && analysis[field].trim()
        );
        const hasCanonicalDraft =
          typeof analysis?.draftResponse === 'string' && analysis.draftResponse.trim();
        if (!hasCanonicalDraft && aliasField) {
          analysis.draftResponse = analysis[aliasField];
        }

        logger.info?.('[AI_DIAGNOSTIC]', {
          stage: 'groq_draft_normalized',
          modelId: process.env.GROQ_MODEL,
          canonicalDraftState: getFieldState(analysis, 'draftResponse'),
          aliasUsed: aliasField ?? null,
          fallbackRequired: !hasCanonicalDraft && !aliasField
        });

        if (!hasCanonicalDraft) {
          logger.warn('[AI] Groq response did not include a usable draftResponse field.', {
            event: 'ai_response_draft_missing',
            fieldState: Object.hasOwn(analysis ?? {}, 'draftResponse')
              ? typeof analysis.draftResponse === 'string' && !analysis.draftResponse.trim()
                ? 'empty'
                : 'invalid_type'
              : 'omitted',
            alternateField: aliasField ?? null,
            responseFormat,
            finishReason: completion?.choices?.[0]?.finish_reason ?? 'unknown'
          });
        }
      }

      const validatedAnalysis = validateAnalysis(analysis, ticketTitle);
      logger.info?.('[AI_DIAGNOSTIC]', {
        stage: 'service_analysis_validated',
        modelId: createGroqClient ? process.env.GROQ_MODEL : null,
        draftResponseState: getFieldState(validatedAnalysis, 'draftResponse'),
        draftResponseSource: validatedAnalysis.draftResponseSource ??
          (createGroqClient ? 'model' : 'mock')
      });
      return validatedAnalysis;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        throw new AppError('AI service returned invalid JSON format.', 502);
      }

      // Generic error
      throw new AppError(`AI analysis failed: ${error.message}`, 502);
    }
  };

  /**
   * Mock analyzer for testing/development
   */
  const mockAnalyzeTicket = async (ticketTitle, ticketDescription) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      summary: `Mock analysis for: ${ticketTitle.substring(0, 50)}...`,
      suggestedCategory: 'technical',
      suggestedPriority: 'medium',
      investigationSteps: [
        'Review error logs mentioned in the description',
        'Check system configuration for known issues',
        'Test a potential workaround'
      ],
      draftResponse: `Thank you for reporting this issue. We're looking into it and will get back to you shortly with more information.`,
      generatedAt: new Date()
    };
  };

  return {
    analyzeTicket,
    mockAnalyzeTicket
  };
};

/**
 * Default export with default Groq client for production
 */
export const createDefaultGroqClient = async () => {
  const Groq = (await import('groq-sdk')).default;
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
};

// Default service instance for production use
export const aiService = createAIService({
  createGroqClient: process.env.GROQ_API_KEY ? createDefaultGroqClient : null,
  createMockAnalyzer: (title, desc, messages) => {
    // Default mock when no API key is configured
    return {
      summary: `Development mock analysis for: ${title.substring(0, 50)}...`,
      suggestedCategory: 'technical',
      suggestedPriority: 'medium',
      investigationSteps: ['Check logs', 'Test workaround', 'Contact team'],
      draftResponse: 'Thank you for your report. Our team is investigating.',
      generatedAt: new Date()
    };
  }
});