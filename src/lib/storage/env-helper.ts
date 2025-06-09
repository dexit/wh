// Environment helper for accessing Cloudflare bindings
// Handles different execution contexts (Workers, Next.js, local dev, etc.)

import { StorageError } from '@/types/storage';
//
// Configuration Guidelines:
// 
// 1. Production Setup (Recommended):
//    Set STORAGE_PROVIDER environment variable to explicitly specify the provider:
//    - STORAGE_PROVIDER=d1 (requires WEBHOOK_DB binding in wrangler.toml)
//    - STORAGE_PROVIDER=r2 (requires WEBHOOK_STORAGE binding in wrangler.toml)
//
// 2. Development Setup:
//    - STORAGE_PROVIDER=memory (for local development, data won't persist)
//    - Or leave STORAGE_PROVIDER unset for auto-detection
//
// 3. Example wrangler.toml:
//    ```
//    [env.production.vars]
//    STORAGE_PROVIDER = "d1"
//    
//    [[env.production.d1_databases]]
//    binding = "WEBHOOK_DB"
//    database_name = "webhook-db"
//    database_id = "your-d1-database-id"
//    ```

interface CloudflareEnv {
  WEBHOOK_DB?: D1Database;
  WEBHOOK_STORAGE?: R2Bucket;
  WEBHOOK_CACHE?: KVNamespace;
  
  // Environment variables
  STORAGE_PROVIDER?: string;
  STORAGE_TABLE_PREFIX?: string;
  REQUEST_RETENTION_HOURS?: string;
  MAX_REQUESTS_PER_WEBHOOK?: string;
  
  [key: string]: any;
}

// Helper function to get environment from different contexts
export function getEnvironment(request?: any): CloudflareEnv {
  // Try multiple ways to get the environment based on the execution context
  
  // 1. OpenNext Cloudflare context (preferred for OpenNext applications)
  // Check if we have a cloudflare context passed directly
  if (request?.env && typeof request.env === 'object') {
    return request.env;
  }
  
  // 2. From request object (Workers environment)
  if (request?.env) {
    return request.env;
  }
  
  // 3. From global cloudflare object (some Workers setups)
  if ((globalThis as any).cloudflare?.env) {
    return (globalThis as any).cloudflare.env;
  }
  
  // 4. From global process.env (Node.js environment)
  if ((globalThis as any).process?.env) {
    return (globalThis as any).process.env;
  }
  
  // 5. From global CF bindings (alternative Workers setup)
  if ((globalThis as any).WEBHOOK_DB || (globalThis as any).WEBHOOK_STORAGE) {
    return {
      WEBHOOK_DB: (globalThis as any).WEBHOOK_DB,
      WEBHOOK_STORAGE: (globalThis as any).WEBHOOK_STORAGE,
      STORAGE_PROVIDER: (globalThis as any).STORAGE_PROVIDER,
      STORAGE_TABLE_PREFIX: (globalThis as any).STORAGE_TABLE_PREFIX,
      REQUEST_RETENTION_HOURS: (globalThis as any).REQUEST_RETENTION_HOURS,
      MAX_REQUESTS_PER_WEBHOOK: (globalThis as any).MAX_REQUESTS_PER_WEBHOOK,
    };
  }
  
  // 6. Return empty object if nothing found
  return {};
}

// Check if we're running in a Cloudflare Workers environment
export function isWorkersEnvironment(): boolean {
  return !!(
    (globalThis as any).cloudflare ||
    (globalThis as any).WEBHOOK_DB ||
    (globalThis as any).Response?.constructor?.name === 'Response'
  );
}

// Check if D1 database binding is available
export function isD1Available(env?: CloudflareEnv): boolean {
  const environment = env || getEnvironment();
  const hasDatabase = !!(environment.WEBHOOK_DB);
  
  // If we have a database object, also check if it has the required methods
  if (hasDatabase && environment.WEBHOOK_DB) {
    // In development mode, the database object might be a mock without proper methods
    if (typeof environment.WEBHOOK_DB.prepare !== 'function') {
      console.warn('D1 database binding exists but lacks prepare method (likely in development mode)');
      return false;
    }
  }
  
  return hasDatabase;
}

// Check if R2 storage binding is available
export function isR2Available(env?: CloudflareEnv): boolean {
  const environment = env || getEnvironment();
  return !!(environment.WEBHOOK_STORAGE);
}

// Get the required storage provider - no fallback to ensure consistency
export function getPreferredStorageProvider(env?: CloudflareEnv): 'r2' | 'd1' | 'memory' {
  const environment = env || getEnvironment();
  
  // If explicitly set, respect the choice (must be available)
  const explicitProvider = environment.STORAGE_PROVIDER;
  
  // If explicitly set to D1, it must be available
  if (explicitProvider === 'd1') {
    if (!isD1Available(environment)) {
      throw StorageError.d1BindingNotFound('WEBHOOK_DB');
    }
    return 'd1';
  }
  
  // If explicitly set to R2, it must be available
  if (explicitProvider === 'r2') {
    if (!isR2Available(environment)) {
      throw new Error(
        'STORAGE_PROVIDER is set to "r2" but WEBHOOK_STORAGE binding is not available. ' +
        'Please check your wrangler.toml configuration or remove STORAGE_PROVIDER to auto-detect.'
      );
    }
    return 'r2';
  }
  
  // If explicitly set to memory (for development)
  if (explicitProvider === 'memory') {
    return 'memory';
  }
  
  // If not explicitly set, try to auto-detect but be strict
  if (!explicitProvider) {
    // Prefer D1 over R2 if both are available
    if (isD1Available(environment)) {
      return 'd1';
    }
    
    if (isR2Available(environment)) {
      return 'r2';
    }
    
    // In production, we should not fallback to memory
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'No storage provider configured for production environment. ' +
        'Please set STORAGE_PROVIDER environment variable to "d1" or "r2" and configure the corresponding bindings.'
      );
    }
    
    // Only allow memory storage in development
    console.warn('No persistent storage bindings found, using memory storage for development');
    return 'memory';
  }
  
  // If explicitly set to an unknown provider
  throw new Error(
    `Unknown STORAGE_PROVIDER "${explicitProvider}". Supported values are: "d1", "r2", "memory"`
  );
}

// Debug function to log environment status
export function debugEnvironment(env?: CloudflareEnv): void {
  const environment = env || getEnvironment();
  
  console.log('=== Environment Debug Info ===');
  console.log('Workers Environment:', isWorkersEnvironment());
  console.log('D1 Available:', isD1Available(environment));
  console.log('R2 Available:', isR2Available(environment));
  console.log('Preferred Provider:', getPreferredStorageProvider(environment));
  console.log('Storage Provider Setting:', environment.STORAGE_PROVIDER);
  console.log('Available Bindings:', {
    WEBHOOK_DB: !!environment.WEBHOOK_DB,
    WEBHOOK_STORAGE: !!environment.WEBHOOK_STORAGE,
    WEBHOOK_CACHE: !!environment.WEBHOOK_CACHE,
  });
  console.log('==============================');
}

// Generate provider instance ID in format {env}-{database-id}
export function generateProviderInstanceId(
  providerType: 'r2' | 'd1' | 'memory',
  env?: CloudflareEnv
): string {
  const environment = env || getEnvironment();
  
  // Get environment name from NODE_ENV, defaulting to 'dev'
  const envName = environment.NODE_ENV || process.env.NODE_ENV || 'dev';
  
  switch (providerType) {
    case 'd1': {
      // Try to extract database ID from the binding or config
      // For D1, we want to show the database ID if available
      const databaseId = getDatabaseIdFromEnvironment(environment);
      return databaseId ? `${envName}-${databaseId}` : `${envName}-d1-${Date.now().toString(36)}`;
    }
    
    case 'r2': {
      // For R2, we can use bucket binding name or bucket info
      const bucketInfo = getBucketInfoFromEnvironment(environment);
      return bucketInfo ? `${envName}-${bucketInfo}` : `${envName}-r2-${Date.now().toString(36)}`;
    }
    
    case 'memory': {
      // For memory, just use env + timestamp since there's no persistent storage
      return `${envName}-memory-${Date.now().toString(36)}`;
    }
    
    default:
      return `${envName}-unknown-${Date.now().toString(36)}`;
  }
}

// Helper to extract database ID from D1 configuration
function getDatabaseIdFromEnvironment(env: CloudflareEnv): string | null {
  // Try to get from wrangler.jsonc configuration structure
  // We can extract this from common environment variable patterns
  
  // Check if we have database binding info in env vars
  if (env.WEBHOOK_DB_ID) {
    const dbId = env.WEBHOOK_DB_ID.toString();
    // Return last 8 characters for readability, but with prefix to indicate which db
    return dbId.slice(-8);
  }
  
  // For development/staging, use a recognizable pattern based on environment
  const nodeEnv = env.NODE_ENV || process.env.NODE_ENV;
  if (nodeEnv === 'preview') {
    return 'test-db';
  } else if (nodeEnv === 'staging') {
    return 'staging-db';
  } else if (nodeEnv === 'production') {
    return 'prod-db';
  } else if (nodeEnv === 'development' || nodeEnv === 'dev') {
    return 'dev-db';
  }
  
  return null;
}

// Helper to extract bucket info from R2 configuration
function getBucketInfoFromEnvironment(env: CloudflareEnv): string | null {
  // Try to get bucket name or identifier
  if (env.WEBHOOK_STORAGE_BUCKET) {
    return env.WEBHOOK_STORAGE_BUCKET.toString();
  }
  
  // For development/staging, use a recognizable pattern based on environment
  const nodeEnv = env.NODE_ENV || process.env.NODE_ENV;
  if (nodeEnv === 'preview') {
    return 'test-bucket';
  } else if (nodeEnv === 'staging') {
    return 'staging-bucket';
  } else if (nodeEnv === 'production') {
    return 'prod-bucket';
  } else if (nodeEnv === 'development' || nodeEnv === 'dev') {
    return 'dev-bucket';
  }
  
  return null;
} 