// Data Transfer Objects for webhook operations
// Provides structured data transformation and validation

export interface WebhookRequestDTO {
  id: string;
  webhookId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  queryParams: Record<string, string>;
  timestamp: string; // ISO string for serialization
  ip?: string;
  userAgent?: string;
  contentType?: string;
  bodySize: number;
  // Additional metadata
  processed?: boolean;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  retryCount?: number;
}

export interface WebhookConfigDTO {
  id: string;
  name?: string;
  url: string;
  createdAt: string; // ISO string
  lastRequestAt?: string; // ISO string
  requestCount: number;
  isActive: boolean;
  // Configuration options
  maxRetries?: number;
  timeout?: number;
  enableLogging?: boolean;
  transformRules?: TransformRule[];
}

export interface TransformRule {
  id: string;
  name: string;
  condition: string; // JSONPath or simple condition
  action: 'filter' | 'modify' | 'enrich' | 'route';
  parameters: Record<string, any>;
  enabled: boolean;
  order: number;
}

export interface ETLJobDTO {
  id: string;
  name: string;
  type: 'extract' | 'transform' | 'load' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  webhookId?: string; // Optional: specific webhook
  filters?: ETLFilters;
  transformations?: ETLTransformation[];
  destination?: ETLDestination;
  schedule?: ETLSchedule;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress?: ETLProgress;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ETLFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  methods?: string[];
  contentTypes?: string[];
  ipAddresses?: string[];
  userAgents?: string[];
  bodyContains?: string;
  headerConditions?: Array<{
    key: string;
    operator: 'equals' | 'contains' | 'regex';
    value: string;
  }>;
}

export interface ETLTransformation {
  id: string;
  type: 'map' | 'filter' | 'aggregate' | 'enrich' | 'validate';
  config: Record<string, any>;
  enabled: boolean;
  order: number;
}

export interface ETLDestination {
  type: 'webhook' | 'email' | 'file' | 'database' | 'api';
  config: Record<string, any>;
  credentials?: Record<string, string>;
}

export interface ETLSchedule {
  type: 'once' | 'recurring';
  cron?: string; // For recurring jobs
  timezone?: string;
  enabled: boolean;
}

export interface ETLProgress {
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  percentage: number;
  estimatedTimeRemaining?: number; // seconds
  currentPhase: string;
}

export interface AdminActionDTO {
  id: string;
  type: 'webhook_operation' | 'etl_operation' | 'system_operation' | 'user_operation';
  action: string;
  targetId?: string;
  parameters: Record<string, any>;
  userId?: string;
  timestamp: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface BulkOperationDTO {
  id: string;
  type: 'delete' | 'update' | 'export' | 'transform';
  targets: string[]; // Array of IDs
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  createdAt: string;
  completedAt?: string;
  results?: Array<{
    id: string;
    success: boolean;
    error?: string;
  }>;
}

// Validation schemas
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// API Response DTOs
export interface ApiResponseDTO<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
    pagination?: PaginationDTO;
  };
}

export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Search and Filter DTOs
export interface SearchRequestDTO {
  query?: string;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface SearchResultDTO<T = any> {
  items: T[];
  total: number;
  pagination: PaginationDTO;
  facets?: Record<string, Array<{
    value: string;
    count: number;
  }>>;
  suggestions?: string[];
}