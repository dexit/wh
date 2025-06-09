// Component to display webhook information

'use client';

import { formatRelativeTime, copyToClipboard } from '@/lib/utils';
import { Card, Button } from './Layout';
import type { WebhookConfig } from '@/types/webhook';
import { useState } from 'react';

interface WebhookInfoProps {
  webhook: WebhookConfig | null;
  webhookUrl: string;
  requestCount: number;
}

export default function WebhookInfo({ webhook, webhookUrl, requestCount }: WebhookInfoProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyUrl = async () => {
    const success = await copyToClipboard(webhookUrl);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <Card>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Webhook Information</h3>
      
      <div className="space-y-4">
        {/* Webhook URL - Enhanced Display */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 sm:p-4">
          <label className="block text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
            🌐 Webhook API URL
          </label>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={webhookUrl}
                readOnly
                className="flex-1 block w-full px-3 py-3 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyUrl}
                title="Copy URL"
                className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-600 min-w-[44px] sm:min-w-auto"
              >
                {copySuccess ? (
                  <>
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="ml-1 hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="ml-1 hidden sm:inline">Copy</span>
                  </>
                )}
              </Button>
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-300 font-medium">
              💡 Send HTTP requests to this URL to test your webhooks
            </div>
          </div>
        </div>

        {webhook && (
          <>
            {/* Webhook Name */}
            {webhook.name && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <p className="text-sm text-gray-900 dark:text-white">{webhook.name}</p>
              </div>
            )}



            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                webhook.isActive 
                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" 
                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  webhook.isActive ? "bg-green-400" : "bg-gray-400"
                }`} />
                {webhook.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Created At */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Created
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatRelativeTime(webhook.createdAt)}
              </p>
            </div>

            {/* Last Request */}
            {webhook.lastRequestAt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Request
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatRelativeTime(webhook.lastRequestAt)}
                </p>
              </div>
            )}
          </>
        )}

        {/* Request Count */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Total Requests
          </label>
          <div className="flex items-center">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{requestCount}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">received</span>
          </div>
        </div>

        {/* Webhook ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Webhook ID
          </label>
          <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300 break-all">
            {webhook?.id || webhookUrl.split('/').pop()}
          </code>
        </div>
      </div>
    </Card>
  );
} 