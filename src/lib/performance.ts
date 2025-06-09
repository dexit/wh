// Performance optimization utilities for CF-Webhook

import { WebhookRequest, WebhookConfig } from '@/types/webhook';

// Memory optimization utilities
export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private cacheMap = new Map<string, { data: unknown; timestamp: number; size: number }>();
  private maxMemoryUsage = 10 * 1024 * 1024; // 10MB limit
  private currentMemoryUsage = 0;

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  // Calculate object size in bytes
  private calculateSize(obj: unknown): number {
    const str = JSON.stringify(obj);
    return new Blob([str]).size;
  }

  // Set cache with memory management
  set(key: string, data: unknown, ttl: number = 30 * 60 * 1000): boolean {
    const size = this.calculateSize(data);
    
    // Check if adding this would exceed memory limit
    if (this.currentMemoryUsage + size > this.maxMemoryUsage) {
      this.cleanup();
      
      // If still not enough space, don't cache
      if (this.currentMemoryUsage + size > this.maxMemoryUsage) {
        console.warn('Memory limit reached, cannot cache data');
        return false;
      }
    }

    // Remove existing entry if present
    if (this.cacheMap.has(key)) {
      const existing = this.cacheMap.get(key)!;
      this.currentMemoryUsage -= existing.size;
    }

    // Add new entry
    this.cacheMap.set(key, {
      data,
      timestamp: Date.now() + ttl,
      size,
    });
    this.currentMemoryUsage += size;

    return true;
  }

  // Get from cache
  get<T = unknown>(key: string): T | null {
    const entry = this.cacheMap.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.timestamp) {
      this.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // Delete from cache
  delete(key: string): boolean {
    const entry = this.cacheMap.get(key);
    if (!entry) return false;

    this.cacheMap.delete(key);
    this.currentMemoryUsage -= entry.size;
    return true;
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cacheMap.entries()) {
      if (now > entry.timestamp) {
        this.delete(key);
      }
    }
  }

  // Get memory usage stats
  getStats(): { usage: number; limit: number; entries: number } {
    return {
      usage: this.currentMemoryUsage,
      limit: this.maxMemoryUsage,
      entries: this.cacheMap.size,
    };
  }

  // Clear all cache
  clear(): void {
    this.cacheMap.clear();
    this.currentMemoryUsage = 0;
  }
}

// Data compression utilities
export class DataCompressor {
  // Compress webhook request data
  static compressRequest(request: WebhookRequest): Partial<WebhookRequest> {
    const compressed: Partial<WebhookRequest> = {
      id: request.id,
      webhookId: request.webhookId,
      method: request.method,
      timestamp: request.timestamp,
      ip: request.ip,
      contentType: request.contentType,
      bodySize: request.bodySize,
    };

    // Only store essential headers
    const essentialHeaders = ['content-type', 'user-agent', 'authorization', 'x-forwarded-for'];
    compressed.headers = {};
    essentialHeaders.forEach(header => {
      if (request.headers[header]) {
        compressed.headers![header] = request.headers[header];
      }
    });

    // Compress body if it's too large
    if (request.body && request.body.length > 1000) {
      try {
        // Try to parse as JSON and remove formatting
        const parsed = JSON.parse(request.body);
        compressed.body = JSON.stringify(parsed);
      } catch {
        // Truncate if not JSON
        compressed.body = request.body.substring(0, 1000) + '...';
      }
    } else {
      compressed.body = request.body;
    }

    // Store only non-empty query params
    if (request.queryParams && Object.keys(request.queryParams).length > 0) {
      compressed.queryParams = request.queryParams;
    }

    return compressed;
  }

  // Compress webhook config data
  static compressConfig(config: WebhookConfig): WebhookConfig {
    return {
      ...config,
    };
  }

  // Batch compress multiple requests
  static compressRequests(requests: WebhookRequest[]): Partial<WebhookRequest>[] {
    return requests.map(request => this.compressRequest(request));
  }
}

// Caching strategies
export class CacheManager {
  private static memoryOptimizer = MemoryOptimizer.getInstance();

  // Cache webhook requests with compression
  static cacheRequests(webhookId: string, requests: WebhookRequest[]): void {
    const compressed = DataCompressor.compressRequests(requests);
    const cacheKey = `requests:${webhookId}`;
    this.memoryOptimizer.set(cacheKey, compressed, 5 * 60 * 1000); // 5 minutes
  }

  // Get cached requests
  static getCachedRequests(webhookId: string): Partial<WebhookRequest>[] | null {
    const cacheKey = `requests:${webhookId}`;
    return this.memoryOptimizer.get<Partial<WebhookRequest>[]>(cacheKey);
  }

  // Cache webhook configs
  static cacheConfigs(configs: WebhookConfig[]): void {
    const compressed = configs.map(config => DataCompressor.compressConfig(config));
    this.memoryOptimizer.set('webhooks:configs', compressed, 10 * 60 * 1000); // 10 minutes
  }

  // Get cached configs
  static getCachedConfigs(): WebhookConfig[] | null {
    return this.memoryOptimizer.get<WebhookConfig[]>('webhooks:configs');
  }

  // Cache search results
  static cacheSearchResults(query: string, results: unknown[]): void {
    const cacheKey = `search:${query}`;
    this.memoryOptimizer.set(cacheKey, results, 2 * 60 * 1000); // 2 minutes
  }

  // Get cached search results
  static getCachedSearchResults(query: string): unknown[] | null {
    const cacheKey = `search:${query}`;
    return this.memoryOptimizer.get<unknown[]>(cacheKey);
  }

  // Clear all caches
  static clearAll(): void {
    this.memoryOptimizer.clear();
  }

  // Get cache statistics
  static getStats() {
    return this.memoryOptimizer.getStats();
  }
}

// Bundle size optimization utilities
export class BundleOptimizer {
  // Lazy load components
  static async loadComponent(componentName: string) {
    try {
      switch (componentName) {
        case 'RequestDetail':
          return (await import('@/app/components/RequestDetail')).default;
        default:
          throw new Error(`Unknown component: ${componentName}`);
      }
    } catch (error) {
      console.error(`Failed to load component ${componentName}:`, error);
      return null;
    }
  }

  // Preload critical components
  static preloadComponents(components: string[]): void {
    if (typeof window !== 'undefined') {
      // Preload after initial render
      setTimeout(() => {
        components.forEach(component => {
          this.loadComponent(component).catch(console.error);
        });
      }, 1000);
    }
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static measurements = new Map<string, number>();

  // Start performance measurement
  static start(label: string): void {
    this.measurements.set(label, performance.now());
  }

  // End performance measurement
  static end(label: string): number {
    const startTime = this.measurements.get(label);
    if (!startTime) {
      console.warn(`No start time found for: ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.measurements.delete(label);
    
    // Log slow operations
    if (duration > 100) {
      console.warn(`Slow operation detected: ${label} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  // Measure function execution time
  static measure<T>(label: string, fn: () => T): T {
    this.start(label);
    try {
      const result = fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  // Measure async function execution time
  static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      const result = await fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  // Get memory usage (if supported)
  static getMemoryUsage(): unknown {
    if ('memory' in performance) {
      return (performance as unknown as { memory: unknown }).memory;
    }
    return null;
  }
}

// Debounced localStorage operations
export class OptimizedStorage {
  private static writeQueue = new Map<string, unknown>();
  private static writeTimeout: NodeJS.Timeout | null = null;

  // Debounced write to localStorage
  static setItem(key: string, value: unknown, immediate = false): void {
    this.writeQueue.set(key, value);

    if (immediate) {
      this.flushWrites();
      return;
    }

    // Debounce writes
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }

    this.writeTimeout = setTimeout(() => {
      this.flushWrites();
    }, 500);
  }

  // Flush all pending writes
  private static flushWrites(): void {
    try {
      for (const [key, value] of this.writeQueue.entries()) {
        localStorage.setItem(key, JSON.stringify(value));
      }
      this.writeQueue.clear();
    } catch (error) {
      console.error('Failed to write to localStorage:', error);
    }

    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
      this.writeTimeout = null;
    }
  }

  // Read from localStorage with caching
  static getItem<T>(key: string): T | null {
    const cacheKey = `storage:${key}`;
    let cached = MemoryOptimizer.getInstance().get<T>(cacheKey);
    
    if (cached === null) {
      try {
        const stored = localStorage.getItem(key);
        cached = stored ? JSON.parse(stored) : null;
        
        // Cache for 1 minute
        if (cached !== null) {
          MemoryOptimizer.getInstance().set(cacheKey, cached, 60 * 1000);
        }
      } catch (error) {
        console.error('Failed to read from localStorage:', error);
        return null;
      }
    }

    return cached;
  }

  // Remove item
  static removeItem(key: string): void {
    localStorage.removeItem(key);
    MemoryOptimizer.getInstance().delete(`storage:${key}`);
    this.writeQueue.delete(key);
  }
} 