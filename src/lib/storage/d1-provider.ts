// D1 storage provider implementation for CF-Webhook
// Uses Cloudflare D1 SQLite database for structured data storage

import type { StorageProvider, D1StorageConfig, ProviderInfo, StorageStats, WebhookDistribution, MethodDistribution, SizeDistribution, TimeDistribution } from '@/types/storage';
import { StorageError } from '@/types/storage';
import type { WebhookRequest, WebhookConfig } from '@/types/webhook';
import { generateProviderInstanceId, getEnvironment } from './env-helper';

export class D1StorageProvider implements StorageProvider {
  private database: D1Database;
  private config: D1StorageConfig;
  private tablePrefix: string;
  private initialized: boolean = false;
  private instanceId: string;

  constructor(database: D1Database, config: D1StorageConfig, env?: any) {
    // Validate that the database object has the required D1 methods
    if (!database || typeof database !== 'object') {
      throw StorageError.d1BindingNotFound(config.databaseBinding || 'WEBHOOK_DB');
    }
    
    if (typeof database.prepare !== 'function') {
      throw StorageError.d1InitializationFailed(
        'Invalid D1 database object: missing prepare method. ' +
        'This usually means the D1 binding is not properly configured or you are running in an environment ' +
        'where D1 is not available (like local development). ' +
        'Consider setting STORAGE_PROVIDER=memory for development.'
      );
    }
    
    this.database = database;
    this.config = config;
    this.tablePrefix = config.tablePrefix || 'webhook';
    this.instanceId = generateProviderInstanceId('d1', getEnvironment());
  }

  // Provider identification for debugging
  getProviderInfo(): ProviderInfo {
    return {
      type: 'd1',
      name: 'Cloudflare D1 SQLite Database',
      instance: this.instanceId,
      details: {
        databaseBinding: this.config.databaseBinding,
        tablePrefix: this.tablePrefix,
        initialized: this.initialized,
        retentionHours: this.config.retentionHours,
        maxRequestsPerWebhook: this.config.maxRequestsPerWebhook
      }
    };
  }

  // Initialize database tables
  async initialize(force: boolean = false): Promise<void> {
    try {
      // Create requests table
      const createRequestsTableSQL = `CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_requests (
        id TEXT PRIMARY KEY, 
        webhook_id TEXT NOT NULL, 
        method TEXT NOT NULL, 
        path TEXT NOT NULL, 
        headers TEXT, 
        body TEXT, 
        query_params TEXT, 
        ip TEXT, 
        user_agent TEXT, 
        content_type TEXT, 
        body_size INTEGER, 
        timestamp INTEGER NOT NULL, 
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`;
      
      const requestsResult = await this.database.prepare(createRequestsTableSQL).run();

      // Create webhook configs table  
      const createConfigsTableSQL = `CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_configs (
        id TEXT PRIMARY KEY, 
        name TEXT, 
        url TEXT, 
        is_active INTEGER DEFAULT 1, 
        request_count INTEGER DEFAULT 0, 
        created_at INTEGER DEFAULT (strftime('%s', 'now')), 
        last_request_at INTEGER
      )`;
      
      const configsResult = await this.database.prepare(createConfigsTableSQL).run();

      // Create indexes for better performance
      const createIndex1SQL = `CREATE INDEX IF NOT EXISTS idx_requests_webhook_timestamp ON ${this.tablePrefix}_requests(webhook_id, timestamp DESC)`;
      const index1Result = await this.database.prepare(createIndex1SQL).run();

      const createIndex2SQL = `CREATE INDEX IF NOT EXISTS idx_requests_created_at ON ${this.tablePrefix}_requests(created_at)`;
      const index2Result = await this.database.prepare(createIndex2SQL).run();

      // Verify tables were created by querying schema
      const tablesQuery = await this.database.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE '${this.tablePrefix}_%'
        ORDER BY name
      `).all();
      
      const tableNames = tablesQuery.results.map(row => (row as any).name);
      
      // Test basic functionality
      if (tableNames.length > 0) {
        for (const tableName of tableNames) {
          try {
            const countResult = await this.database.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first();
          } catch (err) {
            // Silently handle count errors
          }
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error(`D1Provider: Initialization failed:`, error);
      this.initialized = false;
      throw StorageError.d1InitializationFailed(error);
    }
  }

  // Initialize tables if needed
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
      this.initialized = true;
    }
  }

  // Request operations
  async saveRequest(webhookId: string, request: WebhookRequest): Promise<void> {
    try {
      // Ensure tables are initialized before any operation
      await this.ensureInitialized();
      
      const stmt = this.database.prepare(`
        INSERT INTO ${this.tablePrefix}_requests (
          id, webhook_id, method, path, headers, body, query_params, 
          ip, user_agent, content_type, body_size, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        request.id,
        webhookId,
        request.method,
        request.path,
        JSON.stringify(request.headers || {}),
        request.body || '',
        JSON.stringify(request.queryParams || {}),
        request.ip || '',
        request.userAgent || '',
        request.contentType || '',
        request.bodySize || 0,
        request.timestamp.getTime()
      ).run();

    } catch (error) {
      // If it's a table doesn't exist error, try to initialize and retry once
      if (error instanceof Error && error.message.includes('no such table')) {
        this.initialized = false;
        await this.ensureInitialized();
        
        // Retry the operation once
        try {
          const stmt = this.database.prepare(`
            INSERT INTO ${this.tablePrefix}_requests (
              id, webhook_id, method, path, headers, body, query_params, 
              ip, user_agent, content_type, body_size, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          await stmt.bind(
            request.id,
            webhookId,
            request.method,
            request.path,
            JSON.stringify(request.headers || {}),
            request.body || '',
            JSON.stringify(request.queryParams || {}),
            request.ip || '',
            request.userAgent || '',
            request.contentType || '',
            request.bodySize || 0,
            request.timestamp.getTime()
          ).run();

        } catch (retryError) {
          throw new StorageError(`Failed to save request after retry: ${retryError}`, 'd1');
        }
      } else {
        throw new StorageError(`Failed to save request: ${error}`, 'd1');
      }
    }
  }

  async getRequests(webhookId: string, limit = 100, offset = 0): Promise<WebhookRequest[]> {
    try {
      // Ensure tables are initialized before any operation
      await this.ensureInitialized();
      
      const stmt = this.database.prepare(`
        SELECT * FROM ${this.tablePrefix}_requests 
        WHERE webhook_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `);

      const result = await stmt.bind(webhookId, limit, offset).all();
      
      return result.results.map(row => this.rowToWebhookRequest(row as any));
    } catch (error) {
      throw new StorageError(`Failed to get requests: ${error}`, 'd1');
    }
  }

  async deleteRequest(webhookId: string, requestId: string): Promise<boolean> {
    try {
      const stmt = this.database.prepare(`
        DELETE FROM ${this.tablePrefix}_requests 
        WHERE webhook_id = ? AND id = ?
      `);

      const result = await stmt.bind(webhookId, requestId).run();
      
      if (result.success && result.meta?.changes && result.meta.changes > 0) {
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete request: ${error}`);
      return false;
    }
  }

  async clearRequests(webhookId: string): Promise<void> {
    try {
      const stmt = this.database.prepare(`
        DELETE FROM ${this.tablePrefix}_requests WHERE webhook_id = ?
      `);

      const result = await stmt.bind(webhookId).run();
    } catch (error) {
      throw new StorageError(`Failed to clear requests: ${error}`, 'd1');
    }
  }

  // Webhook configuration operations
  async saveWebhookConfig(config: WebhookConfig): Promise<void> {
    try {
      // Ensure tables are initialized before any operation
      await this.ensureInitialized();
      
      const stmt = this.database.prepare(`
        INSERT OR REPLACE INTO ${this.tablePrefix}_configs (
          id, name, url, is_active, request_count, created_at, last_request_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        config.id,
        config.name || '',
        config.url || '',
        config.isActive ? 1 : 0,
        config.requestCount || 0,
        config.createdAt.getTime(),
        config.lastRequestAt ? config.lastRequestAt.getTime() : null
      ).run();

    } catch (error) {
      throw new StorageError(`Failed to save webhook config: ${error}`, 'd1');
    }
  }

  async getWebhookConfig(webhookId: string): Promise<WebhookConfig | null> {
    try {
      const stmt = this.database.prepare(`
        SELECT * FROM ${this.tablePrefix}_configs WHERE id = ?
      `);

      const result = await stmt.bind(webhookId).first();
      
      if (!result) {
        return null;
      }

      return this.rowToWebhookConfig(result as any);
    } catch (error) {
      console.error(`Failed to get webhook config: ${error}`);
      return null;
    }
  }

  async getAllWebhookConfigs(): Promise<WebhookConfig[]> {
    try {
      const stmt = this.database.prepare(`
        SELECT * FROM ${this.tablePrefix}_configs 
        ORDER BY created_at DESC
      `);

      const result = await stmt.all();
      
      return result.results.map(row => this.rowToWebhookConfig(row as any));
    } catch (error) {
      throw new StorageError(`Failed to get all webhook configs: ${error}`, 'd1');
    }
  }

  async deleteWebhookConfig(webhookId: string): Promise<boolean> {
    try {
      const stmt = this.database.prepare(`
        DELETE FROM ${this.tablePrefix}_configs WHERE id = ?
      `);

      const result = await stmt.bind(webhookId).run();
      
      if (result.success && result.meta?.changes && result.meta.changes > 0) {
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete webhook config: ${error}`);
      return false;
    }
  }

  // Cleanup operations
  async cleanupExpiredRequests(retentionHours: number): Promise<number> {
    try {
      const cutoffTime = Date.now() - (retentionHours * 60 * 60 * 1000);
      
      const stmt = this.database.prepare(`
        DELETE FROM ${this.tablePrefix}_requests 
        WHERE timestamp < ?
      `);

      const result = await stmt.bind(cutoffTime).run();
      
      const deletedCount = result.meta?.changes || 0;
      return deletedCount;
    } catch (error) {
      console.error(`Failed to cleanup expired requests: ${error}`);
      return 0;
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      // Simple query to test database connectivity
      const result = await this.database.prepare('SELECT 1').first();
      return result !== null;
    } catch (error) {
      console.error('D1 health check failed:', error);
      return false;
    }
  }

  // Helper methods to convert database rows to objects
  private rowToWebhookRequest(row: any): WebhookRequest {
    return {
      id: row.id,
      webhookId: row.webhook_id,
      method: row.method,
      path: row.path,
      headers: JSON.parse(row.headers || '{}'),
      body: row.body || '',
      queryParams: JSON.parse(row.query_params || '{}'),
      timestamp: new Date(row.timestamp),
      ip: row.ip || undefined,
      userAgent: row.user_agent || undefined,
      contentType: row.content_type || undefined,
      bodySize: row.body_size || 0,
    };
  }

  private rowToWebhookConfig(row: any): WebhookConfig {
    return {
      id: row.id,
      name: row.name || undefined,
      url: row.url || '',
      isActive: Boolean(row.is_active),
      requestCount: row.request_count || 0,
      createdAt: new Date(row.created_at * 1000), // Convert from Unix timestamp
      lastRequestAt: row.last_request_at ? new Date(row.last_request_at * 1000) : undefined,
    };
  }

  // Get storage statistics for distribution analysis
  async getStats(): Promise<StorageStats> {
    try {
      await this.ensureInitialized();

      // Get all webhook configs
      const configs = await this.getAllWebhookConfigs();
      
      // Get aggregated statistics using SQL queries for better performance
      const statsStmt = this.database.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(body_size) as total_size,
          AVG(body_size) as avg_size,
          MAX(body_size) as max_size,
          method,
          webhook_id
        FROM ${this.tablePrefix}_requests 
        GROUP BY webhook_id, method
      `);
      
      const statsResult = await statsStmt.all();
      const allRequestsStmt = this.database.prepare(`
        SELECT webhook_id, method, body_size, timestamp 
        FROM ${this.tablePrefix}_requests 
        ORDER BY timestamp DESC
      `);
      
      const allRequestsResult = await allRequestsStmt.all();
      const allRequests = allRequestsResult.results as any[];

      // Build webhook distribution
      const webhookDistribution: WebhookDistribution[] = [];
      const webhookStats: Record<string, { count: number; totalSize: number; lastRequest?: number }> = {};

      // Aggregate by webhook
      allRequests.forEach(req => {
        if (!webhookStats[req.webhook_id]) {
          webhookStats[req.webhook_id] = { count: 0, totalSize: 0 };
        }
        webhookStats[req.webhook_id].count++;
        webhookStats[req.webhook_id].totalSize += req.body_size || 0;
        
        const reqTime = req.timestamp;
        if (!webhookStats[req.webhook_id].lastRequest || reqTime > webhookStats[req.webhook_id].lastRequest!) {
          webhookStats[req.webhook_id].lastRequest = reqTime;
        }
      });

      // Create webhook distribution
      for (const config of configs) {
        const stats = webhookStats[config.id] || { count: 0, totalSize: 0 };
        webhookDistribution.push({
          webhookId: config.id,
          webhookName: config.name,
          requestCount: stats.count,
          totalSize: stats.totalSize,
          averageSize: stats.count > 0 ? stats.totalSize / stats.count : 0,
          lastRequestAt: stats.lastRequest ? new Date(stats.lastRequest) : undefined,
          isActive: config.isActive,
          percentage: 0 // Will be calculated below
        });
      }

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
        methodCounts[req.method].totalSize += req.body_size || 0;
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
        const count = allRequests.filter(req => {
          const size = req.body_size || 0;
          return size >= range.min && size < range.max;
        }).length;
        return {
          sizeRange: range.range,
          count,
          percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
          minSize: range.min,
          maxSize: range.max === Infinity ? -1 : range.max
        };
      });

      // Build time distribution
      const now = Date.now();
      const timeRanges = [
        { period: 'Last Hour', hours: 1 },
        { period: 'Last 6 Hours', hours: 6 },
        { period: 'Last 24 Hours', hours: 24 },
        { period: 'Older', hours: Infinity }
      ];

      const timeDistribution: TimeDistribution[] = timeRanges.map(range => {
        const cutoff = range.hours === Infinity ? 0 : now - range.hours * 60 * 60 * 1000;
        const nextCutoff = range.hours === 1 ? now : 
          range.hours === Infinity ? now - 24 * 60 * 60 * 1000 :
          now - (range.hours === 6 ? 1 : 6) * 60 * 60 * 1000;

        const count = allRequests.filter(req => {
          const reqTime = req.timestamp;
          return range.hours === Infinity ? 
            reqTime < nextCutoff :
            reqTime >= cutoff && reqTime < nextCutoff;
        }).length;

        return {
          period: range.period,
          count,
          percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
          timeRange: range.hours === Infinity ? `Before ${new Date(nextCutoff).toLocaleString()}` : 
            `${new Date(cutoff).toLocaleString()} - ${new Date(range.period === 'Last Hour' ? now : nextCutoff).toLocaleString()}`
        };
      });

      // Calculate storage usage
      const totalSizeBytes = allRequests.reduce((sum, req) => sum + (req.body_size || 0), 0);
      const averageRequestSize = totalRequests > 0 ? totalSizeBytes / totalRequests : 0;
      const largestRequestSize = totalRequests > 0 ? Math.max(...allRequests.map(req => req.body_size || 0)) : 0;

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
          totalOperations: 0, // D1 doesn't track this yet
          uptime: 0 // D1 doesn't track this yet
        }
      };
    } catch (error) {
      throw new StorageError(`Failed to get D1 storage stats: ${error}`, 'd1');
    }
  }
} 