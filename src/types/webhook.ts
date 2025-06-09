// Core webhook type definitions

export interface WebhookConfig {
  id: string;
  name?: string;
  url: string;
  createdAt: Date;
  lastRequestAt?: Date;
  requestCount: number;
  isActive: boolean;
}

export interface WebhookRequest {
  id: string;
  webhookId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  queryParams: Record<string, string>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  contentType?: string;
  bodySize: number;
}

export interface WebhookStats {
  totalRequests: number;
  todayRequests: number;
  avgResponseTime: number;
  topMethods: Array<{ method: string; count: number }>;
  topUserAgents: Array<{ userAgent: string; count: number }>;
}

// HTTP method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// Local storage related types
export interface StorageData {
  webhooks: WebhookConfig[];
  requests: Record<string, WebhookRequest[]>; // webhookId -> requests
  settings: AppSettings;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  autoRefresh: boolean;
  refreshInterval: number; // milliseconds
  maxRequestsPerWebhook: number;
  notificationsEnabled: boolean;
  retentionHours: number;
}

// Real-time communication types
export interface RealtimeEvent {
  type: 'new_request' | 'webhook_created' | 'webhook_deleted';
  data: WebhookRequest | WebhookConfig;
  timestamp: Date;
}

export interface ConnectionStatus {
  isConnected: boolean;
  connectionType: 'websocket' | 'polling' | 'disconnected';
  lastPing?: Date;
  reconnectAttempts: number;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

// Filter and search related types
export interface RequestFilter {
  method?: HttpMethod[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
  userAgent?: string;
  contentType?: string;
}

export interface SortConfig {
  field: keyof WebhookRequest;
  direction: 'asc' | 'desc';
}

// Export/import related types
export interface ExportData {
  version: string;
  exportedAt: Date;
  webhooks: WebhookConfig[];
  requests: Record<string, WebhookRequest[]>;
}

// Error types
export interface WebhookError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// Component props related types
export interface WebhookCreatorProps {
  onWebhookCreated: (webhook: WebhookConfig) => void;
}

export interface RequestViewerProps {
  request: WebhookRequest;
  onClose: () => void;
}

export interface WebhookListProps {
  webhooks: WebhookConfig[];
  onWebhookSelect: (webhook: WebhookConfig) => void;
  onWebhookDelete: (webhookId: string) => void;
}

// Constants
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  autoRefresh: true,
  refreshInterval: 2000,
  maxRequestsPerWebhook: 100,
  notificationsEnabled: true,
  retentionHours: 24,
} as const;

export const HTTP_METHODS: readonly HttpMethod[] = [
  'GET', 
  'POST', 
  'PUT', 
  'DELETE', 
  'PATCH', 
  'HEAD', 
  'OPTIONS'
] as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  TEXT: 'text/plain',
  HTML: 'text/html',
  XML: 'application/xml',
} as const; 