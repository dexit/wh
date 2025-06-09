// Main homepage with webhook management

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWebhooks } from '@/hooks/useLocalStorage';
import { generateShortId, generateWebhookUrl } from '@/lib/utils';
import type { WebhookConfig } from '@/types/webhook';

export default function HomePage() {
  const router = useRouter();
  const { webhooks, loading, createWebhook } = useWebhooks();

  useEffect(() => {
    // Wait for data to load before making decisions
    if (loading) {
      return;
    }

    const redirectToWebhook = async () => {
      if (webhooks.length > 0) {
        // If webhook exists, redirect to the first one
        router.push(`/w/${webhooks[0].id}`);
      } else {
        // If no webhook exists, create one automatically
        try {
          const webhookId = generateShortId(8);
          const webhookUrl = generateWebhookUrl('', webhookId);
          
          const newWebhook: WebhookConfig = {
            id: webhookId,
            name: `webhook@${webhookId}`,
            url: webhookUrl,
            createdAt: new Date(),
            requestCount: 0,
            isActive: true,
          };

          createWebhook(newWebhook);
          router.push(`/w/${webhookId}`);
        } catch (error) {
          console.error('Error creating webhook:', error);
          // If creation fails, redirect to a default page
          router.push('/w/default');
        }
      }
    };

    redirectToWebhook();
  }, [webhooks, loading, router, createWebhook]);

  // Show loading state
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-sm mx-auto">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-lg flex items-center justify-center animate-pulse mx-auto mb-6">
          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">Webhook Manager</div>
        <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
          {loading ? 'Loading your webhooks...' : 'Setting up your workspace...'}
        </div>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    </div>
  );
}
