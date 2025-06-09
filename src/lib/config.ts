// Environment configuration management

export interface AppConfig {
  // WebSocket configuration
  enableWebSocket: boolean;
  
  // Polling configuration
  pollInterval: number;
  
  // Data limits
  maxRequestsPerWebhook: number;
  requestRetentionHours: number;
  
  // Application info
  appName: string;
  appVersion: string;
  appDescription: string;
  
  // Debug configuration
  isProduction: boolean;
  debugMode: boolean;
  
  // Security configuration
  rateLimitEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number;
  
  // UI configuration
  defaultTheme: 'light' | 'dark' | 'auto';
  enableNotifications: boolean;
  enableDarkMode: boolean;
  
  // Storage configuration
  localStoragePrefix: string;
  sessionStoragePrefix: string;
}

// Default configuration
const DEFAULT_CONFIG: AppConfig = {
  // WebSocket configuration
  enableWebSocket: false,
  
  // Polling configuration
  pollInterval: 2000,
  
  // Data limits
  maxRequestsPerWebhook: 100,
  requestRetentionHours: 24,
  
  // Application info
  appName: 'CF-Webhook',
  appVersion: '1.0.0',
  appDescription: 'Lightweight webhook receiver powered by Cloudflare Workers',
  
  // Debug configuration
  isProduction: process.env.NODE_ENV === 'production',
  debugMode: process.env.NODE_ENV === 'development',
  
  // Security configuration
  rateLimitEnabled: true,
  rateLimitRequests: 60,
  rateLimitWindow: 60000, // 1 minute
  
  // UI configuration
  defaultTheme: 'auto',
  enableNotifications: true,
  enableDarkMode: true,
  
  // Storage configuration
  localStoragePrefix: 'cf-webhook',
  sessionStoragePrefix: 'cf-webhook-session',
};

// Get configuration values from environment variables
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// Generate final configuration
export const config: AppConfig = {
  // WebSocket configuration
  enableWebSocket: getEnvBoolean('ENABLE_WEBSOCKET', DEFAULT_CONFIG.enableWebSocket),
  
  // Polling configuration
  pollInterval: getEnvNumber('POLL_INTERVAL', DEFAULT_CONFIG.pollInterval),
  
  // Data limits
  maxRequestsPerWebhook: getEnvNumber('MAX_REQUESTS_PER_WEBHOOK', DEFAULT_CONFIG.maxRequestsPerWebhook),
  requestRetentionHours: getEnvNumber('REQUEST_RETENTION_HOURS', DEFAULT_CONFIG.requestRetentionHours),
  
  // Application info
  appName: getEnvString('APP_NAME', DEFAULT_CONFIG.appName),
  appVersion: getEnvString('APP_VERSION', DEFAULT_CONFIG.appVersion),
  appDescription: getEnvString('APP_DESCRIPTION', DEFAULT_CONFIG.appDescription),
  
  // Debug configuration
  isProduction: process.env.NODE_ENV === 'production',
  debugMode: getEnvBoolean('DEBUG_MODE', DEFAULT_CONFIG.debugMode),
  
  // Security configuration
  rateLimitEnabled: getEnvBoolean('RATE_LIMIT_ENABLED', DEFAULT_CONFIG.rateLimitEnabled),
  rateLimitRequests: getEnvNumber('RATE_LIMIT_REQUESTS', DEFAULT_CONFIG.rateLimitRequests),
  rateLimitWindow: getEnvNumber('RATE_LIMIT_WINDOW', DEFAULT_CONFIG.rateLimitWindow),
  
  // UI configuration
  defaultTheme: getEnvString('DEFAULT_THEME', DEFAULT_CONFIG.defaultTheme) as 'light' | 'dark' | 'auto',
  enableNotifications: getEnvBoolean('ENABLE_NOTIFICATIONS', DEFAULT_CONFIG.enableNotifications),
  enableDarkMode: getEnvBoolean('ENABLE_DARK_MODE', DEFAULT_CONFIG.enableDarkMode),
  
  // Storage configuration
  localStoragePrefix: getEnvString('LOCAL_STORAGE_PREFIX', DEFAULT_CONFIG.localStoragePrefix),
  sessionStoragePrefix: getEnvString('SESSION_STORAGE_PREFIX', DEFAULT_CONFIG.sessionStoragePrefix),
};

// Configuration validation
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.pollInterval < 1000) {
    errors.push('POLL_INTERVAL must be at least 1000ms');
  }
  
  if (config.maxRequestsPerWebhook < 1) {
    errors.push('MAX_REQUESTS_PER_WEBHOOK must be at least 1');
  }
  
  if (config.requestRetentionHours < 1) {
    errors.push('REQUEST_RETENTION_HOURS must be at least 1');
  }
  
  if (config.rateLimitRequests < 1) {
    errors.push('RATE_LIMIT_REQUESTS must be at least 1');
  }
  
  if (config.rateLimitWindow < 1000) {
    errors.push('RATE_LIMIT_WINDOW must be at least 1000ms');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Debug information
export function getConfigInfo(): Record<string, unknown> {
  return {
    ...config,
    validation: validateConfig(),
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };
}

// Runtime configuration check
if (config.debugMode) {
  const validation = validateConfig();
  if (!validation.isValid) {
    console.warn('Configuration validation failed:', validation.errors);
  }
}

export default config; 