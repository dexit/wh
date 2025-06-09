// Memory storage provider implementation for CF-Webhook
// Simple in-memory storage for development and fallback scenarios

import type { StorageProvider, StorageConfig, ProviderInfo, StorageStats, WebhookDistribution, MethodDistribution, SizeDistribution, TimeDistribution } from '@/types/storage';
import { StorageError } from '@/types/storage';
import type { WebhookRequest, WebhookConfig } from '@/types/webhook';
import { generateProviderInstanceId } from './env-helper';

export class MemoryStorageProvider implements StorageProvider {
  private requests = new Map<string, WebhookRequest[]>();
  private configs = new Map<string, WebhookConfig>();
  private config: StorageConfig;
  private instanceId: string;
  private createdAt: number;
  private totalOperations: number = 0;

  constructor(config: StorageConfig, env?: any) {
    this.config = config;
    this.instanceId = generateProviderInstanceId('memory', env);
    this.createdAt = Date.now();
  }

  // Provider identification for debugging
  getProviderInfo(): ProviderInfo {
    const totalRequests = Array.from(this.requests.values()).reduce((sum, requests) => sum + requests.length, 0);
    
    return {
      type: 'memory',
      name: 'In-Memory Storage',
      instance: this.instanceId,
      details: {
        retentionHours: this.config.retentionHours,
        maxRequestsPerWebhook: this.config.maxRequestsPerWebhook,
        currentWebhooks: this.configs.size,
        totalRequests,
        totalOperations: this.totalOperations,
        uptime: Date.now() - this.createdAt,
        memoryUsage: this.getMemoryEstimate()
      }
    };
  }

  // Estimate memory usage
  private getMemoryEstimate(): { webhooks: number; requests: number; totalKB: number } {
    const webhookSize = this.configs.size * 200; // Rough estimate per webhook config
    const requestSize = Array.from(this.requests.values())
      .reduce((total, requests) => total + requests.length * 1000, 0); // Rough estimate per request
    
    return {
      webhooks: Math.round(webhookSize / 1024),
      requests: Math.round(requestSize / 1024),
      totalKB: Math.round((webhookSize + requestSize) / 1024)
    };
  }

  // Request operations
  async saveRequest(webhookId: string, request: WebhookRequest): Promise<void> {
    this.totalOperations++;
    
    if (!this.requests.has(webhookId)) {
      this.requests.set(webhookId, []);
    }
    
    const requests = this.requests.get(webhookId)!;
    requests.unshift(request); // Add to beginning
    
    // Limit the number of requests per webhook
    if (requests.length > this.config.maxRequestsPerWebhook) {
      const removed = requests.splice(this.config.maxRequestsPerWebhook);
    }
  }

  async getRequests(webhookId: string, limit = 100, offset = 0): Promise<WebhookRequest[]> {
    this.totalOperations++;
    
    const requests = this.requests.get(webhookId) || [];
    const result = requests.slice(offset, offset + limit);
    
    return result;
  }

  async deleteRequest(webhookId: string, requestId: string): Promise<boolean> {
    this.totalOperations++;
    
    const requests = this.requests.get(webhookId);
    if (!requests) {
      return false;
    }
    
    const initialLength = requests.length;
    const filteredRequests = requests.filter(r => r.id !== requestId);
    
    if (filteredRequests.length !== initialLength) {
      this.requests.set(webhookId, filteredRequests);
      return true;
    }
    
    return false;
  }

  async clearRequests(webhookId: string): Promise<void> {
    this.totalOperations++;
    
    const requests = this.requests.get(webhookId);
    const count = requests ? requests.length : 0;
    this.requests.delete(webhookId);
  }

  // Webhook configuration operations
  async saveWebhookConfig(config: WebhookConfig): Promise<void> {
    this.totalOperations++;
    
    const isUpdate = this.configs.has(config.id);
    this.configs.set(config.id, { ...config });
  }

  async getWebhookConfig(webhookId: string): Promise<WebhookConfig | null> {
    this.totalOperations++;
    
    const config = this.configs.get(webhookId) || null;
    return config;
  }

  async getAllWebhookConfigs(): Promise<WebhookConfig[]> {
    this.totalOperations++;
    
    const configs = Array.from(this.configs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return configs;
  }

  async deleteWebhookConfig(webhookId: string): Promise<boolean> {
    this.totalOperations++;
    
    const existed = this.configs.has(webhookId);
    this.configs.delete(webhookId);
    
    // Also clean up associated requests
    if (existed) {
      const requestCount = this.requests.get(webhookId)?.length || 0;
      this.requests.delete(webhookId);
    }
    
    return existed;
  }

  // Cleanup operations
  async cleanupExpiredRequests(retentionHours: number): Promise<number> {
    this.totalOperations++;
    
    const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
    let totalDeleted = 0;
    let webhooksAffected = 0;
    
    for (const [webhookId, requests] of this.requests.entries()) {
      const initialCount = requests.length;
      const filteredRequests = requests.filter(r => r.timestamp > cutoffTime);
      const deletedFromWebhook = initialCount - filteredRequests.length;
      
      if (deletedFromWebhook > 0) {
        this.requests.set(webhookId, filteredRequests);
        totalDeleted += deletedFromWebhook;
        webhooksAffected++;
      }
    }
    
    return totalDeleted;
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    this.totalOperations++;
    
    try {
      // Basic functionality test
      const testKey = '__health_check__';
      const testRequests = this.requests.get(testKey) || [];
      
      // Memory storage is healthy if we can read/write
      const healthy = Array.isArray(testRequests);
      
      if (!healthy) {
        console.error(`[memory:${this.instanceId.slice(-8)}] Health check: unhealthy (data structure corrupted)`);
      }
      
      return healthy;
    } catch (error) {
      console.error(`[memory:${this.instanceId.slice(-8)}] Health check failed:`, error);
      return false;
    }
  }

  // Debug methods
  getStats(): StorageStats {
    const allRequests: WebhookRequest[] = [];
    const webhookDistribution: WebhookDistribution[] = [];
    
    // Collect all requests and build webhook distribution
    for (const [webhookId, requests] of this.requests.entries()) {
      allRequests.push(...requests);
      
      const config = this.configs.get(webhookId);
      const totalSize = requests.reduce((sum, req) => sum + req.bodySize, 0);
      const lastRequestAt = requests.length > 0 ? new Date(Math.max(...requests.map(r => r.timestamp.getTime()))) : undefined;
      
      webhookDistribution.push({
        webhookId,
        webhookName: config?.name,
        requestCount: requests.length,
        totalSize,
        averageSize: requests.length > 0 ? totalSize / requests.length : 0,
        lastRequestAt,
        isActive: config?.isActive ?? false,
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
    
    // Build time distribution (last 24 hours)
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
      totalWebhooks: this.configs.size,
      totalRequests,
      webhooksWithRequests: this.requests.size,
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
        totalOperations: this.totalOperations,
        uptime: Date.now() - this.createdAt
      }
    };
  }

  // Clear all data (useful for testing)
  clearAll(): void {
    const webhookCount = this.configs.size;
    const requestCount = Array.from(this.requests.values()).reduce((sum, requests) => sum + requests.length, 0);
    
    this.configs.clear();
    this.requests.clear();
    this.totalOperations = 0;
  }
} 