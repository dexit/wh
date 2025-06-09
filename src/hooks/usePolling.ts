// Hook for polling webhook requests with real-time updates

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWebhookStorage } from '@/lib/browser-storage';
import type { WebhookRequest } from '@/types/webhook';

interface PollingOptions {
  interval?: number; // Polling interval in milliseconds
  onNewRequest?: (request: WebhookRequest) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
}

interface PollingState {
  requests: WebhookRequest[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isConnected: boolean;
  requestCount: number;
  refreshNow: () => void;
  pausePolling: () => void;
  resumePolling: () => void;
  isPaused: boolean;
  setInterval: (interval: number) => void;
  currentInterval: number;
  countdown: number;
  storageError?: {
    provider: string;
    type: string;
    details: any;
  };
}

interface PollingResponse {
  success: boolean;
  webhookId: string;
  count: number;
  requests: WebhookRequest[];
  timestamp: string;
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number;
  message?: string;
  storageError?: {
    provider: string;
    type: string;
    details: any;
  };
}

export function usePolling(
  webhookId: string,
  options: PollingOptions = {}
): PollingState {
  const {
    interval = 5000, // Default 5 seconds
    onNewRequest,
    onError,
    enabled = true,
  } = options;

  const [requests, setRequests] = useState<WebhookRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentInterval, setCurrentInterval] = useState(interval);
  const [countdown, setCountdown] = useState(0);
  const [storageError, setStorageError] = useState<{
    provider: string;
    type: string;
    details: any;
  } | undefined>(undefined);
  
  // Refs to manage polling state
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPollingActiveRef = useRef(false);
  const shouldRestartRef = useRef(false);
  
  // Use refs to store callbacks to avoid useEffect dependency issues
  const onNewRequestRef = useRef(onNewRequest);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onNewRequestRef.current = onNewRequest;
  }, [onNewRequest]);
  
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Load historical data from localStorage on mount
  useEffect(() => {
    if (!webhookId) return;
    
    try {
      const storage = getWebhookStorage();
      const historicalRequests = storage.getRequests(webhookId);
      if (historicalRequests.length > 0) {
        console.log(`[Polling] Loaded ${historicalRequests.length} historical requests from localStorage for ${webhookId}`);
        setRequests(historicalRequests);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to load historical requests from localStorage:', error);
    }
  }, [webhookId]); // Only run when webhookId changes

  // Manual refresh function
  const refreshNow = useCallback(async () => {
    if (loading || !enabled) return;
    
    console.log(`[Polling] Manual refresh for ${webhookId}`);
    setLoading(true);
    
    try {
      const response = await fetch(`/api/poll/${webhookId}`);
      const data = await response.json() as PollingResponse;
      
      if (data.success) {
        const serverRequests = data.requests || [];
        
        // Clear any previous storage errors
        setStorageError(undefined);
        setError(null);
        
        // Get current requests from localStorage to merge with server data
        const storage = getWebhookStorage();
        const localRequests = storage.getRequests(webhookId);
        
        // Save only new server requests to localStorage
        if (serverRequests.length > 0) {
          try {
            serverRequests.forEach(request => {
              const exists = localRequests.some(existing => existing.id === request.id);
              if (!exists) {
                storage.saveRequest(request);
              }
            });
            console.log(`Manual refresh: Processed ${serverRequests.length} server requests, saved new ones to localStorage`);
          } catch (error) {
            console.error('Failed to save requests to localStorage:', error);
          }
        }
        
        // Get the updated local requests after saving
        const updatedLocalRequests = storage.getRequests(webhookId);
        
        setRequests(updatedLocalRequests);
        setLastUpdate(new Date());
        setIsConnected(true);
        
        if (data.rateLimited) {
          console.log(`[Polling] Manual refresh rate limited, retry after ${data.retryAfter}s`);
        }
        
        // Restart the countdown cycle if not paused
        if (!isPaused) {
          // Clear existing timers
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          
          // Immediately start a new countdown cycle
          setCountdown(Math.floor(currentInterval / 1000));
          
          const countdownInterval = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(countdownInterval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          countdownRef.current = countdownInterval;
          
          // Schedule next automatic poll
          timeoutRef.current = setTimeout(async () => {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            
            // Start a new polling cycle
            isPollingActiveRef.current = false;
          }, currentInterval);
        }
      } else {
        // Check if this is a D1 storage error
        if (data.storageError && data.storageError.provider === 'd1') {
          setStorageError(data.storageError);
          setError(data.message || data.error || 'D1 Database Configuration Error');
          setIsConnected(false);
          if (onErrorRef.current) onErrorRef.current(data.message || data.error || 'D1 Database Configuration Error');
        } else {
          throw new Error(data.error || 'Failed to fetch requests');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsConnected(false);
      if (onErrorRef.current) onErrorRef.current(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [webhookId, loading, enabled, isPaused, currentInterval]);

  // Pause polling
  const pausePolling = useCallback(() => {
    console.log(`[Polling] Pausing polling for ${webhookId}`);
    setIsPaused(true);
    isPollingActiveRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setCountdown(0);
    setIsConnected(false);
  }, [webhookId]);

  // Resume polling
  const resumePolling = useCallback(() => {
    console.log(`[Polling] Resuming polling for ${webhookId}`);
    setIsPaused(false);
    setCountdown(0);
  }, [webhookId]);

  // Effect to restart polling when interval changes
  useEffect(() => {
    if (shouldRestartRef.current && !isPaused && enabled) {
      console.log(`[Polling] Restarting polling immediately due to interval change: ${currentInterval}ms`);
      shouldRestartRef.current = false;
      
      // Clear any existing timers first
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      
      // Reset polling state and force restart
      isPollingActiveRef.current = false;
    }
  }, [currentInterval, isPaused, enabled]);

  // Main polling effect
  useEffect(() => {
    // Early return if conditions not met
    if (!enabled || isPaused || isPollingActiveRef.current) {
      return;
    }

    console.log(`[Polling] Starting polling for ${webhookId} with ${currentInterval}ms interval`);
    isPollingActiveRef.current = true;

    const pollFunction = async (): Promise<void> => {
      if (!isPollingActiveRef.current || isPaused) {
        return;
      }

      try {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch(`/api/poll/${webhookId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as PollingResponse;

        if (data.success) {
          const serverRequests = data.requests || [];
          
          // Clear any previous storage errors
          setStorageError(undefined);
          
          // Get current requests from localStorage to merge with server data
          const storage = getWebhookStorage();
          const localRequests = storage.getRequests(webhookId);
          
          // Save only new server requests to localStorage
          if (serverRequests.length > 0) {
            try {
              serverRequests.forEach(request => {
                const exists = localRequests.some(existing => existing.id === request.id);
                if (!exists) {
                  storage.saveRequest(request);
                }
              });
              console.log(`Processed ${serverRequests.length} server requests, saved new ones to localStorage`);
            } catch (error) {
              console.error('Failed to save requests to localStorage:', error);
            }
          }
          
          // Get the updated local requests after saving
          const updatedLocalRequests = storage.getRequests(webhookId);
          
          // Check for new requests for notifications
          if (onNewRequestRef.current && serverRequests.length > 0) {
            const currentIds = new Set(requests.map(r => r.id));
            const newServerRequests = serverRequests.filter(r => !currentIds.has(r.id));
            newServerRequests.forEach(onNewRequestRef.current);
          }

          setRequests(updatedLocalRequests);
          setLastUpdate(new Date());
          setIsConnected(true);
          setError(null);

          if (data.rateLimited) {
            console.log(`[Polling] Rate limited for ${webhookId}, will retry normally after interval`);
          }
        } else {
          // Check if this is a D1 storage error
          if (data.storageError && data.storageError.provider === 'd1') {
            setStorageError(data.storageError);
            setError(data.message || data.error || 'D1 Database Configuration Error');
            setIsConnected(false);
            if (onErrorRef.current) onErrorRef.current(data.message || data.error || 'D1 Database Configuration Error');
          } else {
            throw new Error(data.error || 'Failed to fetch requests');
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted, ignore
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Polling] Error for ${webhookId}:`, errorMessage);
        setError(errorMessage);
        setIsConnected(false);
        
        if (onErrorRef.current) {
          onErrorRef.current(errorMessage);
        }
      }

      // Schedule next poll only if still active
      if (isPollingActiveRef.current && !isPaused) {
        // Start countdown
        setCountdown(Math.floor(currentInterval / 1000));
        
        const countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        countdownRef.current = countdownInterval;
        timeoutRef.current = setTimeout(() => {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          pollFunction();
        }, currentInterval);
      }
    };

    // Start first poll immediately
    pollFunction();

    // Cleanup function
    return () => {
      console.log(`[Polling] Cleanup polling for ${webhookId}`);
      isPollingActiveRef.current = false;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webhookId, currentInterval, enabled, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPollingActiveRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    requests,
    loading,
    error,
    lastUpdate,
    isConnected,
    requestCount: requests.length,
    refreshNow,
    pausePolling,
    resumePolling,
    isPaused,
    setInterval: (newInterval: number) => {
      console.log(`[Polling] Changing interval from ${currentInterval}ms to ${newInterval}ms for ${webhookId}`);
      
      // If polling is currently active, mark for restart
      if (isPollingActiveRef.current && !isPaused) {
        shouldRestartRef.current = true;
      }
      
      // Update interval - this will trigger the restart effect
      setCurrentInterval(newInterval);
      setCountdown(0);
    },
    currentInterval,
    countdown,
    storageError,
  };
} 