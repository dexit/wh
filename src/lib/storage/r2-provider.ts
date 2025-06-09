// R2 storage provider implementation for CF-Webhook
// Uses Cloudflare R2 for persistent storage across CDN nodes

import type { StorageProvider, R2StorageConfig, ProviderInfo, StorageStats, WebhookDistribution, MethodDistribution, SizeDistribution, TimeDistribution } from '@/types/storage';
import { StorageError } from '@/types/storage';
import type { WebhookRequest, WebhookConfig } from '@/types/webhook';
import { generateProviderInstanceId } from './env-helper';

export class R2StorageProvider implements StorageProvider {
  private bucket: R2Bucket;
  private config: R2StorageConfig;
  private pathPrefix: string;
  private instanceId: string;

  constructor(bucket: R2Bucket, config: R2StorageConfig, env?: any) {
    this.bucket = bucket;
    this.config = config;
    this.pathPrefix = config.pathPrefix || 'cf-webhook';
    this.instanceId = generateProviderInstanceId('r2', env);
  }

  // Provider identification for debugging
  getProviderInfo(): ProviderInfo {
    return {
      type: 'r2',
      name: 'Cloudflare R2 Object Storage',
      instance: this.instanceId,
      details: {
        bucketBinding: this.config.bucketBinding,
        pathPrefix: this.pathPrefix,
        retentionHours: this.config.retentionHours,
        maxRequestsPerWebhook: this.config.maxRequestsPerWebhook
      }
    };
  }

  // Helper methods for path generation
  private getRequestPath(webhookId: string, requestId?: string): string {
    const base = `${this.pathPrefix}/requests/${webhookId}`;
    return requestId ? `${base}/${requestId}.json` : base;
  }

  private getWebhookConfigPath(webhookId: string): string {
    return `${this.pathPrefix}/configs/${webhookId}.json`;
  }

  // Request operations
  async saveRequest(webhookId: string, request: WebhookRequest): Promise<void> {
    try {
      const path = this.getRequestPath(webhookId, request.id);
      const data = JSON.stringify(request);

      await this.bucket.put(path, data, {
        customMetadata: {
          webhookId,
          requestId: request.id,
          timestamp: request.timestamp.toISOString(),
        },
        httpMetadata: {
          contentType: 'application/json',
        },
      });

    } catch (error) {
      throw new StorageError(`Failed to save request: ${error}`, 'r2');
    }
  }

  async getRequests(webhookId: string, limit = 100, offset = 0): Promise<WebhookRequest[]> {
    try {
      const basePath = this.getRequestPath(webhookId);
      
      // List objects with prefix
      const objects = await this.bucket.list({
        prefix: basePath,
        limit: limit + offset,
      });

      if (!objects.objects || objects.objects.length === 0) {
        return [];
      }

      // Sort by timestamp (newest first) and apply pagination
      const sortedObjects = objects.objects
        .filter(obj => obj.key.endsWith('.json'))
        .sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime())
        .slice(offset, offset + limit);

      // Fetch and parse requests
      const requests: WebhookRequest[] = [];
      
      for (const obj of sortedObjects) {
        try {
          const object = await this.bucket.get(obj.key);
          if (!object) continue;

          const data = await object.text();
          const request = JSON.parse(data) as WebhookRequest;
          request.timestamp = new Date(request.timestamp);
          requests.push(request);
        } catch (parseError) {
          console.warn(`Failed to parse request from ${obj.key}:`, parseError);
          continue;
        }
      }

      return requests;
    } catch (error) {
      throw new StorageError(`Failed to get requests: ${error}`, 'r2');
    }
  }

  async deleteRequest(webhookId: string, requestId: string): Promise<boolean> {
    try {
      const path = this.getRequestPath(webhookId, requestId);
      await this.bucket.delete(path);
      return true;
    } catch (error) {
      console.error(`Failed to delete request: ${error}`);
      return false;
    }
  }

  async clearRequests(webhookId: string): Promise<void> {
    try {
      const basePath = this.getRequestPath(webhookId);
      
      // List all objects for this webhook
      const objects = await this.bucket.list({
        prefix: basePath,
      });

      if (!objects.objects || objects.objects.length === 0) {
        return;
      }

      // Delete in batches to avoid timeout
      const batchSize = 50;
      for (let i = 0; i < objects.objects.length; i += batchSize) {
        const batch = objects.objects.slice(i, i + batchSize);
        const deletePromises = batch.map(obj => this.bucket.delete(obj.key));
        await Promise.allSettled(deletePromises);
      }

    } catch (error) {
      throw new StorageError(`Failed to clear requests: ${error}`, 'r2');
    }
  }

  // Webhook configuration operations
  async saveWebhookConfig(config: WebhookConfig): Promise<void> {
    try {
      const path = this.getWebhookConfigPath(config.id);
      const data = JSON.stringify(config, null, 2);

      await this.bucket.put(path, data, {
        customMetadata: {
          webhookId: config.id,
          name: config.name || 'unnamed',
          updatedAt: new Date().toISOString(),
        },
        httpMetadata: {
          contentType: 'application/json',
        },
      });

    } catch (error) {
      throw new StorageError(`Failed to save webhook config: ${error}`, 'r2');
    }
  }

  async getWebhookConfig(webhookId: string): Promise<WebhookConfig | null> {
    try {
      const path = this.getWebhookConfigPath(webhookId);
      const object = await this.bucket.get(path);

      if (!object) {
        return null;
      }

      const data = await object.text();
      const config = JSON.parse(data) as WebhookConfig;
      
      // Ensure dates are properly parsed
      config.createdAt = new Date(config.createdAt);
      if (config.lastRequestAt) {
        config.lastRequestAt = new Date(config.lastRequestAt);
      }

      return config;
    } catch (error) {
      console.error(`Failed to get webhook config: ${error}`);
      return null;
    }
  }

  async getAllWebhookConfigs(): Promise<WebhookConfig[]> {
    try {
      const objects = await this.bucket.list({
        prefix: `${this.pathPrefix}/configs/`,
      });

      if (!objects.objects || objects.objects.length === 0) {
        return [];
      }

      const configs: WebhookConfig[] = [];

      for (const obj of objects.objects) {
        if (!obj.key.endsWith('.json')) continue;

        try {
          const object = await this.bucket.get(obj.key);
          if (!object) continue;

          const data = await object.text();
          const config = JSON.parse(data) as WebhookConfig;
          
          // Ensure dates are properly parsed
          config.createdAt = new Date(config.createdAt);
          if (config.lastRequestAt) {
            config.lastRequestAt = new Date(config.lastRequestAt);
          }

          configs.push(config);
        } catch (parseError) {
          console.warn(`Failed to parse webhook config from ${obj.key}:`, parseError);
          continue;
        }
      }

      return configs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      throw new StorageError(`Failed to get all webhook configs: ${error}`, 'r2');
    }
  }

  async deleteWebhookConfig(webhookId: string): Promise<boolean> {
    try {
      const path = this.getWebhookConfigPath(webhookId);
      await this.bucket.delete(path);
      return true;
    } catch (error) {
      console.error(`Failed to delete webhook config: ${error}`);
      return false;
    }
  }

  // Cleanup operations
  async cleanupExpiredRequests(retentionHours: number): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
      const objects = await this.bucket.list({
        prefix: `${this.pathPrefix}/requests/`,
      });

      if (!objects.objects || objects.objects.length === 0) {
        return 0;
      }

      const expiredObjects = objects.objects.filter(obj => 
        obj.uploaded < cutoffTime
      );

      if (expiredObjects.length === 0) {
        return 0;
      }

      // Delete in batches
      const batchSize = 50;
      let deletedCount = 0;

      for (let i = 0; i < expiredObjects.length; i += batchSize) {
        const batch = expiredObjects.slice(i, i + batchSize);
        const deletePromises = batch.map(obj => this.bucket.delete(obj.key));
        const results = await Promise.allSettled(deletePromises);
        
        deletedCount += results.filter(result => result.status === 'fulfilled').length;
      }

      return deletedCount;
    } catch (error) {
      console.error(`Failed to cleanup expired requests: ${error}`);
      return 0;
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      // Try to list objects to test connectivity
      await this.bucket.list({ limit: 1 });
      return true;
    } catch (error) {
      console.error('R2 health check failed:', error);
      return false;
    }
  }

  // Get storage statistics for distribution analysis
  async getStats(): Promise<StorageStats> {
    try {
      // Get all webhook configs first
      const configs = await this.getAllWebhookConfigs();
      const allRequests: WebhookRequest[] = [];
      const webhookDistribution: WebhookDistribution[] = [];

      // Collect all requests and build webhook distribution
      for (const config of configs) {
        const requests = await this.getRequests(config.id, 1000); // Get more requests for stats
        allRequests.push(...requests);

        const totalSize = requests.reduce((sum, req) => sum + req.bodySize, 0);
        const lastRequestAt = requests.length > 0 ? new Date(Math.max(...requests.map(r => r.timestamp.getTime()))) : undefined;

        webhookDistribution.push({
          webhookId: config.id,
          webhookName: config.name,
          requestCount: requests.length,
          totalSize,
          averageSize: requests.length > 0 ? totalSize / requests.length : 0,
          lastRequestAt,
          isActive: config.isActive,
          percentage: 0 // Will be calculated below
        });
      }

      // Calculate percentages
      const totalRequests = allRequests.length;
      webhookDistribution.forEach(dist => {
        dist.percentage = totalRequests > 0 ? (dist.requestCount / totalRequests) * 100 : 0;
      });

      // Build method distribution
      const methodCounts: Record<string, { count: number; totalSize: number }> = {};
      allRequests.forEach(req => {
        if (!methodCounts[req.method]) {
          methodCounts[req.method] = { count: 0, totalSize: 0 };
        }
        methodCounts[req.method].count++;
        methodCounts[req.method].totalSize += req.bodySize;
      });

      const requestMethodDistribution: MethodDistribution[] = Object.entries(methodCounts)
        .map(([method, data]) => ({
          method,
          count: data.count,
          percentage: totalRequests > 0 ? (data.count / totalRequests) * 100 : 0,
          totalSize: data.totalSize
        }))
        .sort((a, b) => b.count - a.count);

      // Build size distribution
      const sizeRanges = [
        { range: '0-1KB', min: 0, max: 1024 },
        { range: '1KB-10KB', min: 1024, max: 10240 },
        { range: '10KB-100KB', min: 10240, max: 102400 },
        { range: '100KB-1MB', min: 102400, max: 1048576 },
        { range: '1MB+', min: 1048576, max: Infinity }
      ];

      const requestSizeDistribution: SizeDistribution[] = sizeRanges.map(range => {
        const count = allRequests.filter(req => req.bodySize >= range.min && req.bodySize < range.max).length;
        return {
          sizeRange: range.range,
          count,
          percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
          minSize: range.min,
          maxSize: range.max === Infinity ? -1 : range.max
        };
      });

      // Build time distribution
      const now = new Date();
      const timeRanges = [
        { period: 'Last Hour', hours: 1 },
        { period: 'Last 6 Hours', hours: 6 },
        { period: 'Last 24 Hours', hours: 24 },
        { period: 'Older', hours: Infinity }
      ];

      const timeDistribution: TimeDistribution[] = timeRanges.map(range => {
        const cutoff = range.hours === Infinity ? new Date(0) : new Date(now.getTime() - range.hours * 60 * 60 * 1000);
        const nextCutoff = range.hours === 1 ? now : 
          range.hours === Infinity ? new Date(now.getTime() - 24 * 60 * 60 * 1000) :
          new Date(now.getTime() - (range.hours === 6 ? 1 : 6) * 60 * 60 * 1000);

        const count = allRequests.filter(req => {
          const reqTime = req.timestamp.getTime();
          return range.hours === Infinity ? 
            reqTime < nextCutoff.getTime() :
            reqTime >= cutoff.getTime() && reqTime < nextCutoff.getTime();
        }).length;

        return {
          period: range.period,
          count,
          percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
          timeRange: range.hours === Infinity ? `Before ${nextCutoff.toLocaleString()}` : 
            `${cutoff.toLocaleString()} - ${(range.period === 'Last Hour' ? now : nextCutoff).toLocaleString()}`
        };
      });

      // Calculate storage usage
      const totalSizeBytes = allRequests.reduce((sum, req) => sum + req.bodySize, 0);
      const averageRequestSize = totalRequests > 0 ? totalSizeBytes / totalRequests : 0;
      const largestRequestSize = totalRequests > 0 ? Math.max(...allRequests.map(req => req.bodySize)) : 0;

      return {
        totalWebhooks: configs.length,
        totalRequests,
        webhooksWithRequests: webhookDistribution.filter(w => w.requestCount > 0).length,
        webhookDistribution: webhookDistribution.sort((a, b) => b.requestCount - a.requestCount),
        requestMethodDistribution,
        requestSizeDistribution,
        timeDistribution,
        storageUsage: {
          totalSizeBytes,
          averageRequestSize,
          largestRequestSize
        },
        performance: {
          totalOperations: 0, // R2 doesn't track this yet
          uptime: 0 // R2 doesn't track this yet
        }
      };
    } catch (error) {
      throw new StorageError(`Failed to get R2 storage stats: ${error}`, 'r2');
    }
  }
} 