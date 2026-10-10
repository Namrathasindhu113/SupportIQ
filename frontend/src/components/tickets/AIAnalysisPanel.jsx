import React, { useState, useEffect } from 'react';
import Spinner from '../common/Spinner.jsx';
import ErrorMessage from '../common/ErrorMessage.jsx';
import Button from '../common/Button.jsx';
import { formatDate } from '../../utils/formatDate.js';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '../../utils/ticketHelpers.js';

const AIAnalysisPanel = ({ 
  ticketId, 
  initialAnalysis = null,
  onGetAnalysis,
  onGenerateAnalysis,
  loading = false,
  error = null
}) => {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [action, setAction] = useState(null); // 'get' or 'generate'

  // Update analysis when initialAnalysis changes
  useEffect(() => {
    if (initialAnalysis) {
      setAnalysis(initialAnalysis);
    }
  }, [initialAnalysis]);

  const findLabel = (options, value) => {
    const option = options.find(o => o.value === value);
    return option ? option.label : value;
  };

  const handleGetAnalysis = async () => {
    if (loading) return;
    
    setAction('get');
    if (onGetAnalysis) {
      await onGetAnalysis();
    }
  };

  const handleGenerateAnalysis = async () => {
    if (loading) return;
    
    setAction('generate');
    if (onGenerateAnalysis) {
      await onGenerateAnalysis();
    }
  };

  if (!analysis) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">AI Analysis</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Get AI-powered insights to help analyze and respond to this ticket.
          </p>
          
          <div className="flex gap-3">
            <Button
              onClick={handleGetAnalysis}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading && action === 'get' ? <Spinner size="sm" className="mr-2" /> : null}
              Get Existing Analysis
            </Button>
            
            <Button
              onClick={handleGenerateAnalysis}
              disabled={loading}
              size="sm"
            >
              {loading && action === 'generate' ? <Spinner size="sm" className="mr-2" /> : null}
              Generate New Analysis
            </Button>
          </div>
          
          {error && <ErrorMessage error={error} size="sm" />}
          
          {loading && (
            <div className="text-sm text-gray-500 space-y-2">
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span>
                  {action === 'generate' 
                    ? 'Generating AI analysis...' 
                    : 'Fetching AI analysis...'}
                </span>
              </div>
              <p className="text-xs">
                {action === 'generate' 
                  ? 'Analyzing ticket content and conversation...' 
                  : 'Checking for existing analysis...'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">AI Analysis</h2>
        <div className="flex gap-2">
          <Button
            onClick={handleGetAnalysis}
            disabled={loading}
            variant="outline"
            size="xs"
          >
            Refresh
          </Button>
          
          <Button
            onClick={handleGenerateAnalysis}
            disabled={loading}
            size="xs"
          >
            {loading && action === 'generate' ? <Spinner size="sm" className="mr-2" /> : null}
            Regenerate
          </Button>
        </div>
      </div>

      {error && <ErrorMessage error={error} size="sm" className="mb-4" />}

      <div className="space-y-5">
        {/* Summary */}
        <div>
          <h3 className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Summary</h3>
          <p className="text-sm text-gray-700">{analysis.summary}</p>
        </div>

        {/* Suggestions */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Suggested Category</h3>
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
              <div className={`h-1.5 w-1.5 rounded-full ${
                analysis.suggestedCategory === 'technical' ? 'bg-blue-500' :
                analysis.suggestedCategory === 'billing' ? 'bg-green-500' :
                analysis.suggestedCategory === 'general' ? 'bg-gray-500' : 'bg-purple-500'
              }`} />
              {findLabel(CATEGORY_OPTIONS, analysis.suggestedCategory)}
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Suggested Priority</h3>
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
              <div className={`h-1.5 w-1.5 rounded-full ${
                analysis.suggestedPriority === 'urgent' ? 'bg-red-500' :
                analysis.suggestedPriority === 'high' ? 'bg-orange-500' :
                analysis.suggestedPriority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
              }`} />
              {findLabel(PRIORITY_OPTIONS, analysis.suggestedPriority)}
            </div>
          </div>
        </div>

        {/* Investigation Steps */}
        <div>
          <h3 className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Investigation Steps</h3>
          <ol className="space-y-2">
            {analysis.investigationSteps?.map((step, index) => (
              <li key={index} className="flex gap-3">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
                  {index + 1}
                </div>
                <p className="text-sm text-gray-700">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Draft Response */}
        <div>
          <h3 className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Draft Response</h3>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysis.draftResponse}</p>
          </div>
          {analysis.draftResponseSource === 'fallback' && (
            <p className="mt-2 text-xs text-amber-700">
              AI did not provide a draft; this response was generated from the ticket title.
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            This is a suggested draft. Edit as needed before sending.
          </p>
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>AI Analysis generated {formatDate(analysis.generatedAt)}</span>
            <span>Powered by Groq AI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisPanel;