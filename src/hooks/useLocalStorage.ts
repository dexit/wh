// React hooks for localStorage operations

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWebhookStorage } from '@/lib/browser-storage';
import type { 
  WebhookConfig, 
  WebhookRequest, 
  AppSettings, 
  ExportData 
} from '@/types/webhook';

// Hook for managing webhooks
export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Load webhooks from storage
  const loadWebhooks = useCallback(() => {
    try {
      const stored = getWebhookStorage().getWebhooks();
      setWebhooks(stored);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new webhook
  const createWebhook = useCallback((webhook: WebhookConfig) => {
    try {
      getWebhookStorage().saveWebhook(webhook);
      setWebhooks(prev => [...prev, webhook]);
      return true;
    } catch (error) {
      console.error('Failed to create webhook:', error);
      return false;
    }
  }, []);

  // Update existing webhook
  const updateWebhook = useCallback((id: string, updates: Partial<WebhookConfig>) => {
    try {
      const success = getWebhookStorage().updateWebhook(id, updates);
      if (success) {
        setWebhooks(prev => 
          prev.map(webhook => 
            webhook.id === id ? { ...webhook, ...updates } : webhook
          )
        );
      }
      return success;
    } catch (error) {
      console.error('Failed to update webhook:', error);
      return false;
    }
  }, []);

  // Delete webhook
  const deleteWebhook = useCallback((id: string) => {
    try {
      const success = getWebhookStorage().deleteWebhook(id);
      if (success) {
        setWebhooks(prev => prev.filter(webhook => webhook.id !== id));
      }
      return success;
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      return false;
    }
  }, []);

  // Get single webhook
  const getWebhook = useCallback((id: string) => {
    return webhooks.find(webhook => webhook.id === id) || null;
  }, [webhooks]);

  // Load webhooks on mount
  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  return {
    webhooks,
    loading,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    getWebhook,
    refreshWebhooks: loadWebhooks,
  };
}

// Hook for managing webhook requests
export function useWebhookRequests(webhookId: string) {
  const [requests, setRequests] = useState<WebhookRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Load requests from storage
  const loadRequests = useCallback(() => {
    if (!webhookId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      const stored = getWebhookStorage().getRequests(webhookId);
      setRequests(stored);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  }, [webhookId]);

  // Save new request
  const saveRequest = useCallback((request: WebhookRequest) => {
    try {
      getWebhookStorage().saveRequest(request);
      setRequests(prev => [request, ...prev.slice(0, 99)]); // Keep latest 100
      return true;
    } catch (error) {
      console.error('Failed to save request:', error);
      return false;
    }
  }, []);

  // Delete request
  const deleteRequest = useCallback((requestId: string) => {
    try {
      const success = getWebhookStorage().deleteRequest(webhookId, requestId);
      if (success) {
        setRequests(prev => prev.filter(req => req.id !== requestId));
      }
      return success;
    } catch (error) {
      console.error('Failed to delete request:', error);
      return false;
    }
  }, [webhookId]);

  // Clear all requests
  const clearRequests = useCallback(() => {
    try {
      getWebhookStorage().clearRequests(webhookId);
      setRequests([]);
      return true;
    } catch (error) {
      console.error('Failed to clear requests:', error);
      return false;
    }
  }, [webhookId]);

  // Load requests when webhookId changes
  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return {
    requests,
    loading,
    saveRequest,
    deleteRequest,
    clearRequests,
    refreshRequests: loadRequests,
  };
}

// Hook for managing app settings
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Load settings from storage
  const loadSettings = useCallback(() => {
    try {
      const stored = getWebhookStorage().getSettings();
      setSettings(stored);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings: AppSettings) => {
    try {
      getWebhookStorage().saveSettings(newSettings);
      setSettings(newSettings);
      return true;
    } catch (error) {
      console.error('Failed to update settings:', error);
      return false;
    }
  }, []);

  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    try {
      getWebhookStorage().resetSettings();
      const defaultSettings = getWebhookStorage().getSettings();
      setSettings(defaultSettings);
      return true;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      return false;
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    updateSettings,
    resetSettings,
    refreshSettings: loadSettings,
  };
}

// Hook for data import/export operations
export function useDataManagement() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Export all data
  const exportData = useCallback(async (): Promise<ExportData | null> => {
    setIsExporting(true);
    try {
      const data = getWebhookStorage().exportData();
      return data;
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Import data from file
  const importData = useCallback(async (data: ExportData): Promise<boolean> => {
    setIsImporting(true);
    try {
      const success = getWebhookStorage().importData(data);
      return success;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    } finally {
      setIsImporting(false);
    }
  }, []);

  // Clear all data
  const clearAllData = useCallback(() => {
    try {
      getWebhookStorage().clearAllData();
      return true;
    } catch (error) {
      console.error('Failed to clear data:', error);
      return false;
    }
  }, []);

  // Get storage size
  const getStorageSize = useCallback(() => {
    try {
      return getWebhookStorage().getStorageSize();
    } catch (error) {
      console.error('Failed to get storage size:', error);
      return 0;
    }
  }, []);

  // Cleanup expired data
  const cleanupExpiredData = useCallback(() => {
    try {
      getWebhookStorage().cleanupExpiredData();
      return true;
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
      return false;
    }
  }, []);

  return {
    isExporting,
    isImporting,
    exportData,
    importData,
    clearAllData,
    getStorageSize,
    cleanupExpiredData,
  };
}

// Generic localStorage hook for any value
export function useLocalStorageValue<T>(
  key: string, 
  defaultValue: T,
  serialize: (value: T) => string = JSON.stringify,
  deserialize: (value: string) => T = JSON.parse
) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  // Load value from localStorage
  const loadValue = useCallback(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        setValue(deserialize(item));
      } else {
        setValue(defaultValue);
      }
    } catch (error) {
      console.error(`Failed to load value for key ${key}:`, error);
      setValue(defaultValue);
    } finally {
      setLoading(false);
    }
  }, [key, defaultValue, deserialize]);

  // Save value to localStorage
  const saveValue = useCallback((newValue: T) => {
    try {
      localStorage.setItem(key, serialize(newValue));
      setValue(newValue);
      return true;
    } catch (error) {
      console.error(`Failed to save value for key ${key}:`, error);
      return false;
    }
  }, [key, serialize]);

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setValue(defaultValue);
      return true;
    } catch (error) {
      console.error(`Failed to remove value for key ${key}:`, error);
      return false;
    }
  }, [key, defaultValue]);

  // Load value on mount and when key changes
  useEffect(() => {
    loadValue();
  }, [loadValue]);

  return {
    value,
    loading,
    setValue: saveValue,
    removeValue,
    refreshValue: loadValue,
  };
} 