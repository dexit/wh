// Webhook monitoring page - displays request history and real-time data

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useWebhooks } from '@/hooks/useLocalStorage';
import { usePolling } from '@/hooks/usePolling';
import { useRequestNotes } from '@/hooks/useRequestNotes';
import { PageContainer, Card } from '@/app/components/Layout';
import WebhookHeader from '@/app/components/WebhookHeader';
import Footer from '@/app/components/Footer';
import RequestDetail from '@/app/components/RequestDetail';
import D1ErrorAlert from '@/app/components/D1ErrorAlert';
import { formatRelativeTime, getMethodColor, formatBytes, isValidWebhookId, generateWebhookUrl, getBaseUrl } from '@/lib/utils';
import { StorageError } from '@/types/storage';
import { getWebhookStorage } from '@/lib/browser-storage';
import type { WebhookRequest, WebhookConfig } from '@/types/webhook';

export default function WebhookMonitorPage() {
  const params = useParams();
  const webhookId = params.id as string;
  
  const { getWebhook, createWebhook } = useWebhooks();
  const { hasNote, getNote, getAllNotes } = useRequestNotes(webhookId);
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [webhookIdError, setWebhookIdError] = useState<string | null>(null);
  const [, setLastNotification] = useState<Date | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<WebhookRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [pollingInterval, setPollingInterval] = useState(10000); // Default to 10 seconds
  const [localRequests, setLocalRequests] = useState<WebhookRequest[]>([]);
  const [noteUpdateTrigger, setNoteUpdateTrigger] = useState(0); // Trigger to force re-render when notes change

  // Delete request handler
  const handleDeleteRequest = useCallback(async (requestId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // Prevent selecting the request when clicking delete
    }
    
    try {
      // First delete from remote storage via API
      const response = await fetch(`/api/webhook/${webhookId}/requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json() as { success: boolean; error?: string; message?: string };
      
      if (result.success) {
        // Also delete from local storage
        const storage = getWebhookStorage();
        storage.deleteRequest(webhookId, requestId);
        
        // Update local state immediately
        setLocalRequests(prev => prev.filter(req => req.id !== requestId));
        
        // If the deleted request was selected, clear the selection
        if (selectedRequest?.id === requestId) {
          setSelectedRequest(null);
        }
        
        console.log(`Successfully deleted request ${requestId} from remote and local storage`);
      } else {
        console.error(`Failed to delete request ${requestId} from remote storage:`, result.error);
        
        // If remote deletion failed, still try to delete from local storage
        const storage = getWebhookStorage();
        const localSuccess = storage.deleteRequest(webhookId, requestId);
        
        if (localSuccess) {
          setLocalRequests(prev => prev.filter(req => req.id !== requestId));
          if (selectedRequest?.id === requestId) {
            setSelectedRequest(null);
          }
          console.log(`Deleted request ${requestId} from local storage only (remote deletion failed)`);
        }
      }
    } catch (error) {
      console.error('Error deleting request:', error);
      
      // If API call failed, still try to delete from local storage
      try {
        const storage = getWebhookStorage();
        const localSuccess = storage.deleteRequest(webhookId, requestId);
        
        if (localSuccess) {
          setLocalRequests(prev => prev.filter(req => req.id !== requestId));
          if (selectedRequest?.id === requestId) {
            setSelectedRequest(null);
          }
          console.log(`Deleted request ${requestId} from local storage only (API call failed)`);
        }
      } catch (localError) {
        console.error('Failed to delete from local storage as well:', localError);
      }
    }
  }, [webhookId, selectedRequest]);

  // Validate webhook ID and auto-create webhook if needed
  useEffect(() => {
    // First validate the webhook ID format
    if (!isValidWebhookId(webhookId)) {
      setWebhookIdError('Invalid webhook ID format. Must be 6-12 alphanumeric characters.');
      return;
    }

    // Clear any previous error
    setWebhookIdError(null);

    // Check if webhook exists in local storage
    const existingWebhook = getWebhook(webhookId);
    if (existingWebhook) {
      setWebhook(existingWebhook);
      return;
    }

    // Auto-create webhook if it doesn't exist
    setIsCreatingWebhook(true);
    const newWebhook: WebhookConfig = {
      id: webhookId,
      name: `Webhook ${webhookId}`,
      url: generateWebhookUrl(getBaseUrl(), webhookId),
      createdAt: new Date(),
      requestCount: 0,
      isActive: true,
    };

    const success = createWebhook(newWebhook);
    if (success) {
      setWebhook(newWebhook);
      console.log(`Auto-created webhook: ${webhookId}`);
    } else {
      console.error(`Failed to auto-create webhook: ${webhookId}`);
    }
    setIsCreatingWebhook(false);
  }, [webhookId, getWebhook, createWebhook]);

  // Memoize callback functions to prevent usePolling re-initialization
  const handleNewRequest = useCallback((request: WebhookRequest) => {
    // Show notification for new requests
    setLastNotification(new Date());
    
    // Auto-select the new request if no request is currently selected
    if (!selectedRequest) {
      setSelectedRequest(request);
    }
    
    // Browser notification (if permission granted)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`New ${request.method} request`, {
        body: `Webhook received a ${request.method} request from ${request.ip}`,
        icon: '/favicon.ico',
      });
    }
  }, [selectedRequest]);

  const handlePollingError = useCallback((error: string) => {
    console.error('Polling error:', error);
  }, []);

  // Polling for new requests with configurable interval
  const {
    requests,
    loading,
    error,
    isConnected,
    requestCount,
    pausePolling,
    resumePolling,
    isPaused,
    setInterval,
    currentInterval,
    countdown,
    refreshNow,
    storageError,
  } = usePolling(webhookId, {
    interval: pollingInterval,
    onNewRequest: handleNewRequest,
    onError: handlePollingError,
  });

  // Sync polling requests with local state
  useEffect(() => {
    setLocalRequests(requests);
  }, [requests]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Auto-select first request when requests load and no request is selected
  useEffect(() => {
    if (localRequests.length > 0 && !selectedRequest) {
      setSelectedRequest(localRequests[0]);
    }
  }, [localRequests, selectedRequest]);

  // Handle interval change
  const handleIntervalChange = (newInterval: number) => {
    setPollingInterval(newInterval);
    setInterval(newInterval);
  };

  // Handle note changes - force re-render to update note display in request list
  const handleNoteChange = useCallback(() => {
    setNoteUpdateTrigger(prev => prev + 1);
  }, []);

  // Filter requests based on search and method
  const filteredRequests = localRequests.filter((request: WebhookRequest) => {
    const matchesSearch = searchTerm === '' || 
      request.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.ip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.userAgent?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMethod = methodFilter === '' || request.method === methodFilter;
    
    return matchesSearch && matchesMethod;
  });

  // Get unique methods for filter
  const uniqueMethods = [...new Set(localRequests.map((r: WebhookRequest) => r.method))];

  // Show error for invalid webhook ID
  if (webhookIdError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
        <WebhookHeader 
          currentWebhookId={webhookId} 
        />
        
        <main className="flex-1">
          <PageContainer>
            <Card className="text-center py-12">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Invalid Webhook ID
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {webhookIdError}
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>Provided ID: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{webhookId}</code></p>
                <p className="mt-2">Valid format: 6-12 alphanumeric characters (a-z, A-Z, 0-9)</p>
              </div>
            </Card>
          </PageContainer>
        </main>
        <Footer />
      </div>
    );
  }

  // Show loading state while creating webhook
  if (isCreatingWebhook || (!webhook && loading)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
        <WebhookHeader 
          currentWebhookId={webhookId} 
        />
        
        <main className="flex-1">
          <PageContainer>
            <Card className="text-center py-12">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <svg className="h-6 w-6 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {isCreatingWebhook ? 'Creating Webhook' : 'Loading'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {isCreatingWebhook ? 'Setting up your webhook for monitoring...' : 'Loading webhook data...'}
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>Webhook ID: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{webhookId}</code></p>
              </div>
            </Card>
          </PageContainer>
        </main>
        <Footer />
      </div>
    );
  }

  // This case should no longer happen since we auto-create webhooks
  // Keep as fallback for error cases
  if (!webhook && !loading && !isCreatingWebhook && !webhookIdError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
        <WebhookHeader 
          currentWebhookId={webhookId} 
        />
        
        <main className="flex-1">
          <PageContainer>
            <Card className="text-center py-12">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Failed to Create Webhook
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Unable to create or load webhook. Please try refreshing the page.
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>Webhook ID: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{webhookId}</code></p>
              </div>
            </Card>
          </PageContainer>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      <WebhookHeader 
        currentWebhookId={webhookId} 
      />
      
      <main className="flex-1">
        <PageContainer>
          {/* D1 Error display */}
          {storageError && storageError.provider === 'd1' && (
            <D1ErrorAlert 
              error={new StorageError(
                error || 'D1 Database Configuration Error',
                'd1',
                storageError.type,
                storageError.details
              )}
              className="mb-4"
            />
          )}
          
          {/* General Error display */}
          {error && (!storageError || storageError.provider !== 'd1') && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

        {/* Responsive layout: Mobile stack (top/bottom) + Desktop sidebar (left/right) */}
        <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-20rem)] bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Request Inbox - Mobile: top section, Desktop: left sidebar */}
          <div className="w-full lg:w-1/3 lg:min-w-[300px] lg:max-w-[450px] border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex flex-col max-h-[50vh] lg:max-h-none">
            {/* Inbox Header */}
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              {/* Top row: Title, Status, and Controls */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">Inbox</h3>
                  {/* Status indicator with connection info */}
                  <div className="flex items-center space-x-1.5">
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-400' : 'bg-red-400'
                    } ${isConnected ? 'animate-pulse' : ''}`} />
                    <span className={`text-xs font-medium ${
                      isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {isConnected ? 'Live' : 'Offline'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({requestCount})
                    </span>
                  </div>
                </div>

                {/* Auto-refresh controls - unified height across devices */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  {/* Interval selector with integrated countdown */}
                  <div className="flex items-center px-2 py-1">
                    <div className="relative flex items-center">
                      {/* Refresh button with progress ring */}
                      <div className="relative mr-1 w-5 h-5 flex items-center justify-center">
                        <button
                          onClick={refreshNow}
                          disabled={loading}
                          className="flex items-center justify-center w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50 relative z-10"
                          title="Refresh now"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        
                        {/* Progress ring around refresh button */}
                        {!isPaused && countdown > 0 && (
                          <svg className="absolute inset-0 w-5 h-5 transform -rotate-90 pointer-events-none" viewBox="0 0 20 20">
                            <circle
                              cx="10"
                              cy="10"
                              r="8.5"
                              stroke="currentColor"
                              strokeWidth="1"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 8.5}`}
                              strokeDashoffset={`${2 * Math.PI * 8.5 * (1 - (currentInterval - countdown * 1000) / currentInterval)}`}
                              className="text-blue-500 transition-all duration-1000 ease-linear"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </div>

                      <select
                        value={currentInterval}
                        onChange={(e) => handleIntervalChange(Number(e.target.value))}
                        disabled={loading}
                        className="text-xs bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer font-medium min-w-0 mr-1"
                      >
                        <option value={3000}>3s</option>
                        <option value={5000}>5s</option>
                        <option value={10000}>10s</option>
                        <option value={15000}>15s</option>
                        <option value={30000}>30s</option>
                      </select>
                      

                    </div>
                  </div>

                  {/* Separator */}
                  <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>

                  {/* Control button */}
                  <div className="flex items-center px-1.5 py-1">
                    <button
                      onClick={isPaused ? resumePolling : pausePolling}
                      className={`p-1 rounded transition-all duration-200 touch-manipulation flex items-center justify-center ${
                        isPaused
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                      title={isPaused ? 'Resume auto-refresh' : 'Stop auto-refresh'}
                    >
                      {isPaused ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5.25 3A2.25 2.25 0 003 5.25v9.5A2.25 2.25 0 005.25 17h9.5A2.25 2.25 0 0017 14.75v-9.5A2.25 2.25 0 0014.75 3h-9.5z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom row: Filters - more compact */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-20 px-1.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All</option>
                  {uniqueMethods.map((method: string) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
                
                {/* Show filtered count inline */}
                {(searchTerm || methodFilter) && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 self-center whitespace-nowrap">
                    {filteredRequests.length}/{localRequests.length}
                  </span>
                )}
              </div>
            </div>

            {/* Request List */}
            <div className="flex-1 overflow-y-auto">
              {loading && localRequests.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="animate-pulse">
                    <div className="mx-auto h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded-full mb-2"></div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-2/3 mx-auto mb-1"></div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mx-auto"></div>
                  </div>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="p-4 text-center">
                  <svg className="mx-auto h-6 w-6 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {localRequests.length === 0 ? 'No requests yet' : 'No matching requests'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {localRequests.length === 0 
                      ? `Send HTTP requests to your webhook URL to see them here.`
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRequests.map((request: WebhookRequest, index: number) => (
                    <div
                      key={request.id}
                      className={`px-3 py-1.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 group ${
                        selectedRequest?.id === request.id 
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' 
                          : ''
                      }`}
                      onClick={() => setSelectedRequest(request)}
                    >
                      {/* Top row: Number, Method badge, simplified ID, note indicator, and delete button */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-6 text-right">
                            {filteredRequests.length - index}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getMethodColor(request.method)}`}>
                            {request.method}
                          </span>
                          <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                            #{request.id.split('-')[0]}
                          </span>
                          {(() => {
                            // Force re-evaluation by reading directly from localStorage
                            let currentNote = '';
                            try {
                              const stored = localStorage.getItem('webhook-request-notes');
                              if (stored) {
                                const allNotes = JSON.parse(stored);
                                const webhookNotes = allNotes[webhookId] || {};
                                currentNote = webhookNotes[request.id]?.note || '';
                              }
                            } catch (error) {
                              console.error('Failed to read note:', error);
                            }
                            
                            if (currentNote) {
                              return (
                                <div className="flex items-center space-x-1.5 min-w-0 flex-1" title="Has note" key={`note-${request.id}-${noteUpdateTrigger}`}>
                                  <svg 
                                    className="w-3 h-3 text-blue-500 dark:text-blue-400 flex-shrink-0" 
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                  >
                                    <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H7l-4 4V5z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                    {currentNote}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <button
                          onClick={(e) => handleDeleteRequest(request.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                          title="Delete request"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Bottom row: Compact info display */}
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                          <span className="truncate" title={request.ip}>
                            {request.ip}
                          </span>
                          <span>•</span>
                          <span>{formatBytes(request.bodySize)}</span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          {formatRelativeTime(request.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Request Details - Mobile: bottom section, Desktop: right panel */}
          <div className="flex-1 flex flex-col min-h-[50vh] lg:min-h-0">
            {selectedRequest ? (
              <RequestDetail
                request={selectedRequest}
                onClose={() => setSelectedRequest(null)}
                isInline={true}
                onNoteChange={handleNoteChange}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Select a request to view details
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Choose a request from the inbox to see its headers, body, and other details.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </main>
    <Footer />
    </div>
  );
} 