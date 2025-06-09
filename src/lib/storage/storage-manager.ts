// Storage manager for CF-Webhook
// Manages different storage providers and provides a unified interface

import type { StorageProvider, StorageConfig, R2StorageConfig, D1StorageConfig } from '@/types/storage';
import { StorageError } from '@/types/storage';
import { R2StorageProvider } from './r2-provider';
import { D1StorageProvider } from './d1-provider';
import { MemoryStorageProvider } from './memory-provider';
import { getEnvironment, getPreferredStorageProvider, debugEnvironment } from './env-helper';
import type { WebhookRequest, WebhookConfig } from '@/types/webhook';

export class StorageManager {
  private provider: StorageProvider;
  private config: StorageConfig;
  private startTime: number;

  private constructor(provider: StorageProvider, config: StorageConfig) {
    this.provider = provider;
    this.config = config;
    this.startTime = Date.now();
  }

  static async create(config: StorageConfig, env?: any): Promise<StorageManager> {
    const createStartTime = performance.now();
    
    try {
      const provider = await StorageManager.createProvider(config, env);
      const manager = new StorageManager(provider, config);
      const providerInfo = provider.getProviderInfo();
      
      const createDuration = performance.now() - createStartTime;
      
      return manager;
    } catch (error) {
      const createDuration = performance.now() - createStartTime;
      console.error(`[StorageManager] Failed to create in ${createDuration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  private static async createProvider(config: StorageConfig, env?: any): Promise<StorageProvider> {
    
    switch (config.provider) {
      case 'r2':
        if (!env?.WEBHOOK_STORAGE) {
          throw new StorageError(
            'R2 bucket binding not found. Please configure WEBHOOK_STORAGE in wrangler.toml',
            'r2'
          );
        }
        return new R2StorageProvider(env.WEBHOOK_STORAGE, config as R2StorageConfig, env);
      
      case 'kv':
        throw new StorageError('KV provider not implemented yet', 'kv');
      
      case 'd1':
        if (!env?.WEBHOOK_DB) {
          throw StorageError.d1BindingNotFound('WEBHOOK_DB');
        }
        const d1Provider = new D1StorageProvider(env.WEBHOOK_DB, config as D1StorageConfig, env);
        // Initialize database tables on first use
        try {
          await d1Provider.initialize();
        } catch (error) {
          throw StorageError.d1InitializationFailed(error);
        }
        return d1Provider;
      
      case 'memory':
        console.warn('[StorageManager] Using memory storage - data will not persist between restarts!');
        return new MemoryStorageProvider(config, env);
      
      default:
        throw new StorageError(`Unknown storage provider: ${config.provider}`, 'unknown');
    }
  }

  // Request operations with timing and error handling
  async saveRequest(webhookId: string, request: WebhookRequest): Promise<void> {
    try {
      await this.provider.saveRequest(webhookId, request);
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to save request:`, error);
      throw error;
    }
  }

  async getRequests(webhookId: string, limit: number = 100, offset: number = 0): Promise<WebhookRequest[]> {
    try {
      const requests = await this.provider.getRequests(webhookId, limit, offset);
      return requests;
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to get requests:`, error);
      throw error;
    }
  }

  async deleteRequest(webhookId: string, requestId: string): Promise<boolean> {
    try {
      const result = await this.provider.deleteRequest(webhookId, requestId);
      return result;
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to delete request:`, error);
      throw error;
    }
  }

  async clearRequests(webhookId: string): Promise<void> {
    try {
      await this.provider.clearRequests(webhookId);
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to clear requests:`, error);
      throw error;
    }
  }

  // Webhook configuration operations
  async saveWebhookConfig(config: WebhookConfig): Promise<void> {
    try {
      await this.provider.saveWebhookConfig(config);
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to save webhook config:`, error);
      throw error;
    }
  }

  async getWebhookConfig(webhookId: string): Promise<WebhookConfig | null> {
    try {
      const config = await this.provider.getWebhookConfig(webhookId);
      return config;
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to get webhook config:`, error);
      throw error;
    }
  }

  async getAllWebhookConfigs(): Promise<WebhookConfig[]> {
    try {
      const configs = await this.provider.getAllWebhookConfigs();
      return configs;
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to get all webhook configs:`, error);
      throw error;
    }
  }

  async deleteWebhookConfig(webhookId: string): Promise<boolean> {
    try {
      const result = await this.provider.deleteWebhookConfig(webhookId);
      return result;
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to delete webhook config:`, error);
      throw error;
    }
  }

  // Utility operations
  async cleanupExpiredRequests(): Promise<number> {
    try {
      const deletedCount = await this.provider.cleanupExpiredRequests(this.config.retentionHours);
      return deletedCount;
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to cleanup expired requests:`, error);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const healthy = await this.provider.isHealthy();
      return healthy;
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Health check failed:`, error);
      return false;
    }
  }

  // Configuration and info
  getConfig(): StorageConfig {
    return { ...this.config };
  }

  getProviderInfo() {
    return this.provider.getProviderInfo();
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  // Get storage statistics for distribution analysis
  async getStats() {
    try {
      const stats = await this.provider.getStats();
      return stats;
    } catch (error) {
      const providerInfo = this.provider.getProviderInfo();
      console.error(`[${providerInfo.type}:${providerInfo.instance.slice(-8)}] Failed to get stats:`, error);
      throw error;
    }
  }
}

// Build default configuration from environment
function buildDefaultConfig(provider: 'r2' | 'd1' | 'memory', env: any): StorageConfig {
  const baseConfig = {
    retentionHours: parseInt(env?.REQUEST_RETENTION_HOURS || '24'),
    maxRequestsPerWebhook: parseInt(env?.MAX_REQUESTS_PER_WEBHOOK || '100'),
  };

  switch (provider) {
    case 'd1':
      return {
        ...baseConfig,
        provider: 'd1',
        databaseBinding: 'WEBHOOK_DB',
        tablePrefix: env?.STORAGE_TABLE_PREFIX || 'webhook',
      } as D1StorageConfig;
      
    case 'r2':
      return {
        ...baseConfig,
        provider: 'r2',
        bucketBinding: 'WEBHOOK_STORAGE',
        pathPrefix: env?.STORAGE_PATH_PREFIX || 'cf-webhook',
      } as R2StorageConfig;
      
    case 'memory':
    default:
      return {
        ...baseConfig,
        provider: 'memory',
      } as StorageConfig;
  }
}

// Simplified factory function - always creates fresh instances for edge runtime compatibility
export async function createStorageManager(requestOrEnv?: any): Promise<StorageManager> {
  const env = getEnvironment(requestOrEnv);
  const provider = getPreferredStorageProvider(env);
  const config = buildDefaultConfig(provider, env);
  
  // Only debug in development or when explicitly requested
  if (env?.DEBUG_STORAGE || process.env.NODE_ENV === 'development') {
    debugEnvironment(env);
  }

  return await StorageManager.create(config, env);
}

// Main export - use this for all storage operations
export async function getStorageManager(env?: any): Promise<StorageManager> {
  return await createStorageManager(env);
} 