// DTO Mapper utilities
// Converts between domain objects and DTOs for API serialization

import type { WebhookRequest, WebhookConfig } from '@/types/webhook';
import type { WebhookRequestDTO, WebhookConfigDTO } from '@/types/dto';

export class DTOMapper {
  // Convert WebhookRequest to DTO
  static toWebhookRequestDTO(request: WebhookRequest): WebhookRequestDTO {
    return {
      id: request.id,
      webhookId: request.webhookId,
      method: request.method,
      path: request.path,
      headers: request.headers,
      body: request.body,
      queryParams: request.queryParams,
      timestamp: request.timestamp.toISOString(),
      ip: request.ip,
      userAgent: request.userAgent,
      contentType: request.contentType,
      bodySize: request.bodySize,
      // Default values for new fields
      processed: false,
      tags: [],
      priority: 'medium',
      retryCount: 0
    };
  }

  // Convert DTO to WebhookRequest
  static fromWebhookRequestDTO(dto: WebhookRequestDTO): WebhookRequest {
    return {
      id: dto.id,
      webhookId: dto.webhookId,
      method: dto.method,
      path: dto.path,
      headers: dto.headers,
      body: dto.body,
      queryParams: dto.queryParams,
      timestamp: new Date(dto.timestamp),
      ip: dto.ip,
      userAgent: dto.userAgent,
      contentType: dto.contentType,
      bodySize: dto.bodySize
    };
  }

  // Convert WebhookConfig to DTO
  static toWebhookConfigDTO(config: WebhookConfig): WebhookConfigDTO {
    return {
      id: config.id,
      name: config.name,
      url: config.url,
      createdAt: config.createdAt.toISOString(),
      lastRequestAt: config.lastRequestAt?.toISOString(),
      requestCount: config.requestCount,
      isActive: config.isActive,
      // Default values for new fields
      maxRetries: 3,
      timeout: 30000,
      enableLogging: true,
      transformRules: []
    };
  }

  // Convert DTO to WebhookConfig
  static fromWebhookConfigDTO(dto: WebhookConfigDTO): WebhookConfig {
    return {
      id: dto.id,
      name: dto.name,
      url: dto.url,
      createdAt: new Date(dto.createdAt),
      lastRequestAt: dto.lastRequestAt ? new Date(dto.lastRequestAt) : undefined,
      requestCount: dto.requestCount,
      isActive: dto.isActive
    };
  }

  // Convert array of requests to DTOs
  static toWebhookRequestDTOs(requests: WebhookRequest[]): WebhookRequestDTO[] {
    return requests.map(request => this.toWebhookRequestDTO(request));
  }

  // Convert array of DTOs to requests
  static fromWebhookRequestDTOs(dtos: WebhookRequestDTO[]): WebhookRequest[] {
    return dtos.map(dto => this.fromWebhookRequestDTO(dto));
  }

  // Convert array of configs to DTOs
  static toWebhookConfigDTOs(configs: WebhookConfig[]): WebhookConfigDTO[] {
    return configs.map(config => this.toWebhookConfigDTO(config));
  }

  // Convert array of DTOs to configs
  static fromWebhookConfigDTOs(dtos: WebhookConfigDTO[]): WebhookConfig[] {
    return dtos.map(dto => this.fromWebhookConfigDTO(dto));
  }

  // Validate DTO structure
  static validateWebhookRequestDTO(dto: any): dto is WebhookRequestDTO {
    return (
      typeof dto === 'object' &&
      typeof dto.id === 'string' &&
      typeof dto.webhookId === 'string' &&
      typeof dto.method === 'string' &&
      typeof dto.path === 'string' &&
      typeof dto.headers === 'object' &&
      typeof dto.body === 'string' &&
      typeof dto.queryParams === 'object' &&
      typeof dto.timestamp === 'string' &&
      typeof dto.bodySize === 'number'
    );
  }

  static validateWebhookConfigDTO(dto: any): dto is WebhookConfigDTO {
    return (
      typeof dto === 'object' &&
      typeof dto.id === 'string' &&
      typeof dto.url === 'string' &&
      typeof dto.createdAt === 'string' &&
      typeof dto.requestCount === 'number' &&
      typeof dto.isActive === 'boolean'
    );
  }

  // Sanitize DTO for API response
  static sanitizeWebhookRequestDTO(dto: WebhookRequestDTO): WebhookRequestDTO {
    // Remove sensitive headers
    const sanitizedHeaders = { ...dto.headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitizedHeaders[header]) {
        sanitizedHeaders[header] = '[REDACTED]';
      }
    });

    return {
      ...dto,
      headers: sanitizedHeaders
    };
  }

  // Create summary DTO for list views
  static toWebhookRequestSummaryDTO(request: WebhookRequest): Partial<WebhookRequestDTO> {
    return {
      id: request.id,
      webhookId: request.webhookId,
      method: request.method,
      path: request.path,
      timestamp: request.timestamp.toISOString(),
      ip: request.ip,
      contentType: request.contentType,
      bodySize: request.bodySize
    };
  }

  static toWebhookConfigSummaryDTO(config: WebhookConfig): Partial<WebhookConfigDTO> {
    return {
      id: config.id,
      name: config.name,
      url: config.url,
      createdAt: config.createdAt.toISOString(),
      lastRequestAt: config.lastRequestAt?.toISOString(),
      requestCount: config.requestCount,
      isActive: config.isActive
    };
  }
}