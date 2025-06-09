// Hook for checking server status and storage provider health

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServerStatus {
  success: boolean;
  timestamp: string;
  storage?: {
    provider: string;
    name: string;
    instance: string;
    health: string;
    details: any;
    distribution?: any;
  };
  storageError?: any;
  server?: {
    uptime: number | string;
    nodeVersion: string;
    platform: string;
    memoryUsage?: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
  };
  environment?: {
    nodeEnv: string;
    isProduction: boolean;
  };
}

interface UseServerStatusOptions {
  enabled?: boolean;
  interval?: number; // Check interval in milliseconds
}

interface UseServerStatusReturn {
  status: ServerStatus | null;
  loading: boolean;
  error: string | null;
  isHealthy: boolean;
  storageError: any;
  refreshStatus: () => void;
}

export function useServerStatus(options: UseServerStatusOptions = {}): UseServerStatusReturn {
  const { enabled = true, interval = 30000 } = options; // Default 30 seconds
  
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/server-stats');
      const data = await response.json() as ServerStatus;
      
      if (data.success) {
        setStatus(data);
      } else {
        throw new Error((data as any).error || 'Failed to fetch server status');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to fetch server status:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchStatus();
    }
  }, [enabled, fetchStatus]);

  // Periodic refresh
  useEffect(() => {
    if (!enabled || !interval) return;

    const intervalId = setInterval(fetchStatus, interval);
    return () => clearInterval(intervalId);
  }, [enabled, interval, fetchStatus]);

  const isHealthy = status?.storage?.health === 'healthy' && !status?.storageError;
  const storageError = status?.storageError;

  return {
    status,
    loading,
    error,
    isHealthy,
    storageError,
    refreshStatus: fetchStatus,
  };
} 