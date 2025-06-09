// Storage provider abstraction for CF-Webhook
// Supports different storage backends like R2, KV, D1, etc.

import type { WebhookRequest, WebhookConfig } from './webhook';

// Base storage provider interface
export interface StorageProvider {
  // Provider identification (for debugging)
  getProviderInfo(): ProviderInfo;
  
  // Request operations
  saveRequest(webhookId: string, request: WebhookRequest): Promise<void>;
  getRequests(webhookId: string, limit?: number, offset?: number): Promise<WebhookRequest[]>;
  deleteRequest(webhookId: string, requestId: string): Promise<boolean>;
  clearRequests(webhookId: string): Promise<void>;
  
  // Webhook configuration operations
  saveWebhookConfig(config: WebhookConfig): Promise<void>;
  getWebhookConfig(webhookId: string): Promise<WebhookConfig | null>;
  getAllWebhookConfigs(): Promise<WebhookConfig[]>;
  deleteWebhookConfig(webhookId: string): Promise<boolean>;
  
  // Cleanup operations
  cleanupExpiredRequests(retentionHours: number): Promise<number>;
  
  // Health check
  isHealthy(): Promise<boolean>;
  
  // Statistics
  getStats(): Promise<StorageStats> | StorageStats;
}

// Provider identification information for debugging
export interface ProviderInfo {
  type: 'r2' | 'kv' | 'd1' | 'memory';
  name: string;
  instance: string; // unique instance identifier
  details?: ProviderDetails; // provider-specific details
}

// Provider-specific details for monitoring and debugging
export interface ProviderDetails {
  // Common fields
  retentionHours?: number;
  maxRequestsPerWebhook?: number;
  
  // Performance metrics
  totalOperations?: number;
  uptime?: number;
  
  // Provider-specific fields
  [key: string]: any;
  
  // D1 specific
  databaseBinding?: string;
  tablePrefix?: string;
  initialized?: boolean;
  
  // R2 specific
  bucketBinding?: string;
  pathPrefix?: string;
  
  // Memory specific
  currentWebhooks?: number;
  totalRequests?: number;
  memoryUsage?: {
    webhooks: number;
    requests: number;
    totalKB: number;
  };
}

// Storage configuration
export interface StorageConfig {
  provider: 'r2' | 'kv' | 'd1' | 'memory';
  retentionHours: number;
  maxRequestsPerWebhook: number;
}

// R2 specific configuration
export interface R2StorageConfig extends StorageConfig {
  provider: 'r2';
  bucketBinding: string;
  pathPrefix?: string;
}

// KV specific configuration
export interface KVStorageConfig extends StorageConfig {
  provider: 'kv';
  namespaceBinding: string;
}

// D1 specific configuration
export interface D1StorageConfig extends StorageConfig {
  provider: 'd1';
  databaseBinding: string;
  tablePrefix?: string;
}

// Storage operation metrics
export interface StorageMetrics {
  operationType: 'save' | 'get' | 'delete' | 'clear' | 'health';
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// Storage statistics for distribution analysis
export interface StorageStats {
  totalWebhooks: number;
  totalRequests: number;
  webhooksWithRequests: number;
  webhookDistribution: WebhookDistribution[];
  requestMethodDistribution: MethodDistribution[];
  requestSizeDistribution: SizeDistribution[];
  timeDistribution: TimeDistribution[];
  storageUsage: {
    totalSizeBytes: number;
    averageRequestSize: number;
    largestRequestSize: number;
  };
  performance: {
    totalOperations: number;
    uptime: number;
  };
}

// Webhook distribution stats
export interface WebhookDistribution {
  webhookId: string;
  webhookName?: string;
  requestCount: number;
  totalSize: number;
  averageSize: number;
  lastRequestAt?: Date;
  isActive: boolean;
  percentage: number;
}

// HTTP method distribution
export interface MethodDistribution {
  method: string;
  count: number;
  percentage: number;
  totalSize: number;
}

// Request size distribution
export interface SizeDistribution {
  sizeRange: string;
  count: number;
  percentage: number;
  minSize: number;
  maxSize: number;
}

// Time-based distribution
export interface TimeDistribution {
  period: string;
  count: number;
  percentage: number;
  timeRange: string;
}

// Enhanced error class with provider context
export class StorageError extends Error {
  public readonly timestamp: Date;
  public readonly operation?: string;
  public readonly details?: Record<string, any>;
  
  constructor(
    message: string, 
    public readonly provider: string,
    operation?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'StorageError';
    this.timestamp = new Date();
    this.operation = operation;
    this.details = details;
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      provider: this.provider,
      operation: this.operation,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }

  // Check if this is a D1 binding error
  isD1BindingError(): boolean {
    return this.provider === 'd1' && (
      this.message.includes('database binding') ||
      this.message.includes('D1 database binding not found') ||
      this.message.includes('WEBHOOK_DB') ||
      this.details?.isBindingError === true
    );
  }

  // Check if this is a D1 initialization error
  isD1InitializationError(): boolean {
    return this.provider === 'd1' && (
      this.message.includes('initialization') ||
      this.message.includes('Failed to initialize D1') ||
      this.message.includes('prepare method') ||
      this.details?.isInitializationError === true
    );
  }

  // Static factory method for D1 binding errors
  static d1BindingNotFound(databaseBinding: string = 'WEBHOOK_DB'): StorageError {
    return new StorageError(
      `D1 database binding "${databaseBinding}" not found. Please configure the binding in your wrangler.toml file.`,
      'd1',
      'binding_check',
      {
        isBindingError: true,
        databaseBinding,
        configurationHelp: {
          message: 'D1 database binding is not configured',
          steps: [
            'Go to Cloudflare Dashboard',
            'Navigate to Workers & Pages > Your Worker',
            'Go to Settings > Variables and Secrets',
            'Add a D1 Database binding',
            'Set Variable name to "WEBHOOK_DB"',
            'Select your D1 database'
          ],
          dashboardUrl: 'https://dash.cloudflare.com/'
        }
      }
    );
  }

  // Static factory method for D1 initialization errors
  static d1InitializationFailed(originalError: any): StorageError {
    return new StorageError(
      `Failed to initialize D1 database. This usually indicates the D1 binding is not properly configured or the database is not accessible.`,
      'd1',
      'initialization',
      {
        isInitializationError: true,
        originalError: originalError?.toString(),
        configurationHelp: {
          message: 'D1 database initialization failed',
          steps: [
            'Verify D1 database binding in wrangler.toml',
            'Check that the database exists in Cloudflare Dashboard',
            'Ensure the binding name matches "WEBHOOK_DB"',
            'Verify database permissions and accessibility'
          ],
          dashboardUrl: 'https://dash.cloudflare.com/'
        }
      }
    );
  }
} 