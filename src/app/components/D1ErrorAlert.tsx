// D1 Error Alert Component
// Shows detailed instructions for configuring D1 database binding

'use client';

import { useState } from 'react';
import { StorageError } from '@/types/storage';

interface D1ErrorAlertProps {
  error: StorageError;
  className?: string;
  showDetailedSteps?: boolean;
}

export default function D1ErrorAlert({ 
  error, 
  className = '', 
  showDetailedSteps = true 
}: D1ErrorAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show for D1 errors
  if (error.provider !== 'd1' || (!error.isD1BindingError() && !error.isD1InitializationError())) {
    return null;
  }

  const configHelp = error.details?.configurationHelp;
  const isBindingError = error.isD1BindingError();
  const isInitError = error.isD1InitializationError();

  return (
    <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}>
      {/* Error Header */}
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            {isBindingError ? 'D1 Database Not Configured' : 'D1 Database Initialization Failed'}
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {error.message}
          </p>

          {/* Quick Action Button */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <a
              href="https://dash.cloudflare.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-1M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Cloudflare Dashboard
            </a>
            
            {showDetailedSteps && configHelp && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-600 text-sm leading-4 font-medium rounded-md text-red-700 dark:text-red-200 bg-white dark:bg-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <svg 
                  className={`mr-2 h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {isExpanded ? 'Hide' : 'Show'} Setup Instructions
              </button>
            )}
          </div>

          {/* Detailed Setup Instructions */}
          {isExpanded && configHelp && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/40 rounded-md border border-red-200 dark:border-red-700">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-3">
                {configHelp.message}
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-red-700 dark:text-red-300">
                {configHelp.steps?.map((step: string, index: number) => (
                  <li key={index} className="leading-relaxed">
                    {step}
                  </li>
                ))}
              </ol>

              {/* Additional Help */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded">
                <div className="flex items-start">
                  <svg className="flex-shrink-0 h-4 w-4 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-2">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Need help?</strong> The binding name must exactly match <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">WEBHOOK_DB</code> for this application to work properly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Technical Details (collapsed by default) */}
          <details className="mt-4">
            <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:text-red-800 dark:hover:text-red-200 transition-colors">
              Technical Details
            </summary>
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 font-mono">
              <p><strong>Provider:</strong> {error.provider}</p>
              <p><strong>Operation:</strong> {error.operation || 'unknown'}</p>
              <p><strong>Timestamp:</strong> {error.timestamp.toISOString()}</p>
              {error.details?.databaseBinding && (
                <p><strong>Expected Binding:</strong> {error.details.databaseBinding}</p>
              )}
              {error.details?.originalError && (
                <p><strong>Original Error:</strong> {error.details.originalError}</p>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
} 