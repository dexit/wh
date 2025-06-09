// Browser-side storage operations using localStorage for webhook data

import type { 
  WebhookConfig, 
  WebhookRequest, 
  AppSettings, 
  ExportData 
} from '@/types/webhook';
import { DEFAULT_SETTINGS } from '@/types/webhook';
import { config } from './config';

// Storage keys for browser localStorage
const BROWSER_STORAGE_KEYS = {
  WEBHOOKS: `${config.localStoragePrefix}:webhooks`,
  REQUESTS: `${config.localStoragePrefix}:requests`,
  SETTINGS: `${config.localStoragePrefix}:settings`,
  VERSION: `${config.localStoragePrefix}:version`,
} as const;

// Current storage version for migration purposes
const BROWSER_STORAGE_VERSION = '1.0.0';

/**
 * Browser storage interface for webhook data using localStorage
 */
export interface BrowserWebhookStorage {
  // Webhook operations
  getWebhooks(): WebhookConfig[];
  saveWebhook(webhook: WebhookConfig): void;
  updateWebhook(id: string, updates: Partial<WebhookConfig>): boolean;
  deleteWebhook(id: string): boolean;
  getWebhook(id: string): WebhookConfig | null;
  
  // Request operations
  getRequests(webhookId: string): WebhookRequest[];
  saveRequest(request: WebhookRequest): void;
  deleteRequest(webhookId: string, requestId: string): boolean;
  clearRequests(webhookId: string): void;
  
  // Settings operations
  getSettings(): AppSettings;
  saveSettings(settings: AppSettings): void;
  resetSettings(): void;
  
  // Utility operations
  exportData(): ExportData;
  importData(data: ExportData): boolean;
  clearAllData(): void;
  getStorageSize(): number;
  cleanupExpiredData(): void;
}

/**
 * Utility functions for localStorage operations
 */
class LocalStorageUtils {
  static isAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  static getItem<T>(key: string, fallback: T): T {
    if (!this.isAvailable()) {
      console.warn(`localStorage is not available, using fallback for key "${key}"`);
      return fallback;
    }
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
      return fallback;
    }
  }

  static setItem<T>(key: string, value: T): boolean {
    if (!this.isAvailable()) {
      console.warn(`localStorage is not available, cannot save key "${key}"`);
      return false;
    }
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
      return false;
    }
  }

  static removeItem(key: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
      return false;
    }
  }
}

/**
 * Browser-side webhook storage implementation using localStorage
 */
class BrowserWebhookStorageImpl implements BrowserWebhookStorage {
  private isStorageAvailable: boolean = false;

  constructor() {
    this.initializeStorage();
  }
  
  /**
   * Initialize browser storage system
   */
  private initializeStorage(): void {
    console.log('Initializing browser storage system...');
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.warn('Not in browser environment, localStorage unavailable');
      this.isStorageAvailable = false;
      return;
    }

    this.isStorageAvailable = LocalStorageUtils.isAvailable();
    
    if (!this.isStorageAvailable) {
      console.warn('localStorage is not available, using fallback data');
      return;
    }

    console.log('Browser localStorage is available');
    
    // Migrate storage if needed
    this.migrateStorage();
    
    // Initialize with defaults if empty
    this.initializeDefaultData();
    
    // Clean up expired data
    this.cleanupExpiredData();
    
    console.log('Browser storage initialization completed');
  }

  private initializeDefaultData(): void {
    if (!LocalStorageUtils.getItem(BROWSER_STORAGE_KEYS.WEBHOOKS, null)) {
      console.log('Initializing empty webhooks array');
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.WEBHOOKS, []);
    }
    
    if (!LocalStorageUtils.getItem(BROWSER_STORAGE_KEYS.REQUESTS, null)) {
      console.log('Initializing empty requests object');
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.REQUESTS, {});
    }
    
    if (!LocalStorageUtils.getItem(BROWSER_STORAGE_KEYS.SETTINGS, null)) {
      console.log('Initializing default settings');
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    }
  }
  
  /**
   * Handle storage migrations between versions
   */
  private migrateStorage(): void {
    const currentVersion: string = LocalStorageUtils.getItem(BROWSER_STORAGE_KEYS.VERSION, '0.0.0');
    
    if (currentVersion !== BROWSER_STORAGE_VERSION) {
      console.log(`Migrating browser storage from version ${currentVersion} to ${BROWSER_STORAGE_VERSION}`);
      
      // Add migration logic here when needed
      const fromMajor = parseInt(currentVersion.split('.')[0], 10);
      const currentMajor = parseInt(BROWSER_STORAGE_VERSION.split('.')[0], 10);
      
      if (fromMajor < currentMajor) {
        console.log('Major version change detected, clearing old data');
        this.clearAllData();
      }
      
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.VERSION, BROWSER_STORAGE_VERSION);
    }
  }
  
  // Webhook operations
  getWebhooks(): WebhookConfig[] {
    return LocalStorageUtils.getItem(BROWSER_STORAGE_KEYS.WEBHOOKS, []);
  }
  
  saveWebhook(webhook: WebhookConfig): void {
    const webhooks = this.getWebhooks();
    const existingIndex = webhooks.findIndex(w => w.id === webhook.id);
    
    if (existingIndex >= 0) {
      webhooks[existingIndex] = webhook;
    } else {
      webhooks.push(webhook);
    }
    
    LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.WEBHOOKS, webhooks);
  }
  
  updateWebhook(id: string, updates: Partial<WebhookConfig>): boolean {
    const webhooks = this.getWebhooks();
    const index = webhooks.findIndex(w => w.id === id);
    
    if (index >= 0) {
      webhooks[index] = { ...webhooks[index], ...updates };
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.WEBHOOKS, webhooks);
      return true;
    }
    
    return false;
  }
  
  deleteWebhook(id: string): boolean {
    const webhooks = this.getWebhooks();
    const filteredWebhooks = webhooks.filter(w => w.id !== id);
    
    if (filteredWebhooks.length !== webhooks.length) {
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.WEBHOOKS, filteredWebhooks);
      // Also clean up associated requests
      this.clearRequests(id);
      return true;
    }
    
    return false;
  }
  
  getWebhook(id: string): WebhookConfig | null {
    const webhooks = this.getWebhooks();
    return webhooks.find(w => w.id === id) || null;
  }
  
  // Request operations
  getRequests(webhookId: string): WebhookRequest[] {
    const allRequests = LocalStorageUtils.getItem<Record<string, WebhookRequest[]>>(BROWSER_STORAGE_KEYS.REQUESTS, {});
    return allRequests[webhookId] || [];
  }
  
  saveRequest(request: WebhookRequest): void {
    const allRequests = LocalStorageUtils.getItem<Record<string, WebhookRequest[]>>(BROWSER_STORAGE_KEYS.REQUESTS, {});
    const webhookRequests = allRequests[request.webhookId] || [];
    
    // Add new request to the beginning
    webhookRequests.unshift(request);
    
    // Limit the number of requests per webhook
    const maxRequests = config.maxRequestsPerWebhook;
    if (webhookRequests.length > maxRequests) {
      webhookRequests.splice(maxRequests);
    }
    
    allRequests[request.webhookId] = webhookRequests;
    LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.REQUESTS, allRequests);
    
    console.log(`Saved request for webhook ${request.webhookId}, total requests: ${webhookRequests.length}`);
    
    // Update webhook's last request time and count
    this.updateWebhook(request.webhookId, {
      lastRequestAt: request.timestamp,
      requestCount: webhookRequests.length,
    });
  }
  
  deleteRequest(webhookId: string, requestId: string): boolean {
    const allRequests = LocalStorageUtils.getItem<Record<string, WebhookRequest[]>>(BROWSER_STORAGE_KEYS.REQUESTS, {});
    const webhookRequests = allRequests[webhookId] || [];
    
    const filteredRequests = webhookRequests.filter((r: WebhookRequest) => r.id !== requestId);
    
    if (filteredRequests.length !== webhookRequests.length) {
      allRequests[webhookId] = filteredRequests;
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.REQUESTS, allRequests);
      
      // Update webhook request count
      this.updateWebhook(webhookId, {
        requestCount: filteredRequests.length,
      });
      
      return true;
    }
    
    return false;
  }
  
  clearRequests(webhookId: string): void {
    const allRequests = LocalStorageUtils.getItem<Record<string, WebhookRequest[]>>(BROWSER_STORAGE_KEYS.REQUESTS, {});
    delete allRequests[webhookId];
    LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.REQUESTS, allRequests);
    
    // Update webhook request count
    this.updateWebhook(webhookId, {
      requestCount: 0,
    });
  }
  
  // Settings operations
  getSettings(): AppSettings {
    return LocalStorageUtils.getItem(BROWSER_STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }
  
  saveSettings(settings: AppSettings): void {
    LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.SETTINGS, settings);
  }
  
  resetSettings(): void {
    LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }
  
  // Utility operations
  exportData(): ExportData {
    const webhooks = this.getWebhooks();
    const requests = LocalStorageUtils.getItem<Record<string, WebhookRequest[]>>(BROWSER_STORAGE_KEYS.REQUESTS, {});
    
    console.log('Exporting browser data - Webhooks:', webhooks.length, 'Requests:', Object.keys(requests).length);
    
    return {
      version: BROWSER_STORAGE_VERSION,
      exportedAt: new Date(),
      webhooks,
      requests,
    };
  }
  
  importData(data: ExportData): boolean {
    try {
      // Validate import data structure
      if (!data.webhooks || !Array.isArray(data.webhooks)) {
        throw new Error('Invalid webhook data format');
      }
      
      if (!data.requests || typeof data.requests !== 'object') {
        throw new Error('Invalid request data format');
      }
      
      // Import webhooks
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.WEBHOOKS, data.webhooks);
      
      // Import requests
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.REQUESTS, data.requests);
      
      console.log('Browser data imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import browser data:', error);
      return false;
    }
  }
  
  clearAllData(): void {
    LocalStorageUtils.removeItem(BROWSER_STORAGE_KEYS.WEBHOOKS);
    LocalStorageUtils.removeItem(BROWSER_STORAGE_KEYS.REQUESTS);
    LocalStorageUtils.removeItem(BROWSER_STORAGE_KEYS.SETTINGS);
    LocalStorageUtils.removeItem(BROWSER_STORAGE_KEYS.VERSION);
    
    console.log('All browser storage data cleared');
    
    // Reinitialize with defaults
    this.initializeDefaultData();
  }
  
  getStorageSize(): number {
    if (!this.isStorageAvailable) return 0;
    
    let totalSize = 0;
    
    try {
      for (const key in localStorage) {
        if (key.startsWith(config.localStoragePrefix)) {
          totalSize += localStorage[key].length;
        }
      }
    } catch (error) {
      console.error('Error calculating browser storage size:', error);
    }
    
    return totalSize;
  }
  
  cleanupExpiredData(): void {
    const settings = this.getSettings();
    const retentionMs = settings.retentionHours * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - retentionMs);
    
    const allRequests = LocalStorageUtils.getItem<Record<string, WebhookRequest[]>>(BROWSER_STORAGE_KEYS.REQUESTS, {});
    let cleanedCount = 0;
    
    // Clean up expired requests
    for (const webhookId in allRequests) {
      const requests = allRequests[webhookId];
      const filteredRequests = requests.filter((request: WebhookRequest) => {
        const requestTime = new Date(request.timestamp);
        return requestTime > cutoffTime;
      });
      
      if (filteredRequests.length !== requests.length) {
        allRequests[webhookId] = filteredRequests;
        cleanedCount += requests.length - filteredRequests.length;
        
        // Update webhook request count
        this.updateWebhook(webhookId, {
          requestCount: filteredRequests.length,
        });
      }
    }
    
    if (cleanedCount > 0) {
      LocalStorageUtils.setItem(BROWSER_STORAGE_KEYS.REQUESTS, allRequests);
      console.log(`Cleaned up ${cleanedCount} expired requests from browser storage`);
    }
  }
}

/**
 * Server-side fallback that doesn't do anything (for SSR compatibility)
 */
class ServerSideFallbackStorage implements BrowserWebhookStorage {
  getWebhooks = () => [];
  saveWebhook = () => {};
  updateWebhook = () => false;
  deleteWebhook = () => false;
  getWebhook = () => null;
  getRequests = () => [];
  saveRequest = () => {};
  deleteRequest = () => false;
  clearRequests = () => {};
  getSettings = () => DEFAULT_SETTINGS;
  saveSettings = () => {};
  resetSettings = () => {};
  exportData = () => ({
    version: BROWSER_STORAGE_VERSION,
    exportedAt: new Date(),
    webhooks: [],
    requests: {},
  });
  importData = () => false;
  clearAllData = () => {};
  getStorageSize = () => 0;
  cleanupExpiredData = () => {};
}

// Singleton instance
let browserStorageInstance: BrowserWebhookStorageImpl | null = null;

/**
 * Get the browser storage instance (client-side only)
 * Returns a fallback for server-side rendering
 */
export function getBrowserWebhookStorage(): BrowserWebhookStorage {
  // Server-side fallback
  if (typeof window === 'undefined') {
    return new ServerSideFallbackStorage();
  }
  
  // Client-side instance
  if (!browserStorageInstance) {
    browserStorageInstance = new BrowserWebhookStorageImpl();
  }
  
  return browserStorageInstance;
}

// Export for backward compatibility
export const getWebhookStorage = getBrowserWebhookStorage;

// Export types and classes for testing
export { BrowserWebhookStorageImpl, LocalStorageUtils }; 