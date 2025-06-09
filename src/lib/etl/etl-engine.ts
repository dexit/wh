// ETL Engine for webhook data processing
// Handles Extract, Transform, Load operations with job management

import type { 
  WebhookRequest, 
  WebhookConfig 
} from '@/types/webhook';
import type { 
  ETLJobDTO, 
  ETLFilters, 
  ETLTransformation, 
  ETLDestination, 
  ETLProgress,
  WebhookRequestDTO 
} from '@/types/dto';
import { getStorageManager } from '@/lib/storage/storage-manager';

export class ETLEngine {
  private jobs = new Map<string, ETLJobDTO>();
  private activeJobs = new Set<string>();

  // Extract phase: Get data based on filters
  async extract(jobId: string, filters?: ETLFilters): Promise<WebhookRequest[]> {
    console.log(`[ETL:${jobId}] Starting extract phase`);
    
    try {
      const storageManager = await getStorageManager();
      let allRequests: WebhookRequest[] = [];

      if (filters?.webhookId) {
        // Extract from specific webhook
        const requests = await storageManager.getRequests(filters.webhookId, 1000);
        allRequests = requests;
      } else {
        // Extract from all webhooks
        const configs = await storageManager.getAllWebhookConfigs();
        for (const config of configs) {
          const requests = await storageManager.getRequests(config.id, 1000);
          allRequests.push(...requests);
        }
      }

      // Apply filters
      const filteredRequests = this.applyFilters(allRequests, filters);
      
      console.log(`[ETL:${jobId}] Extracted ${filteredRequests.length} records`);
      return filteredRequests;
    } catch (error) {
      console.error(`[ETL:${jobId}] Extract failed:`, error);
      throw error;
    }
  }

  // Transform phase: Apply transformations to data
  async transform(
    jobId: string, 
    data: WebhookRequest[], 
    transformations?: ETLTransformation[]
  ): Promise<any[]> {
    console.log(`[ETL:${jobId}] Starting transform phase with ${data.length} records`);
    
    if (!transformations || transformations.length === 0) {
      return data;
    }

    let transformedData = [...data];

    // Sort transformations by order
    const sortedTransformations = transformations
      .filter(t => t.enabled)
      .sort((a, b) => a.order - b.order);

    for (const transformation of sortedTransformations) {
      try {
        transformedData = await this.applyTransformation(transformedData, transformation);
        console.log(`[ETL:${jobId}] Applied transformation ${transformation.type}, ${transformedData.length} records remaining`);
      } catch (error) {
        console.error(`[ETL:${jobId}] Transformation ${transformation.id} failed:`, error);
        throw error;
      }
    }

    console.log(`[ETL:${jobId}] Transform phase completed`);
    return transformedData;
  }

  // Load phase: Send data to destination
  async load(
    jobId: string, 
    data: any[], 
    destination?: ETLDestination
  ): Promise<void> {
    console.log(`[ETL:${jobId}] Starting load phase with ${data.length} records`);
    
    if (!destination) {
      console.log(`[ETL:${jobId}] No destination specified, skipping load phase`);
      return;
    }

    try {
      switch (destination.type) {
        case 'webhook':
          await this.loadToWebhook(data, destination.config);
          break;
        case 'file':
          await this.loadToFile(data, destination.config);
          break;
        case 'email':
          await this.loadToEmail(data, destination.config);
          break;
        case 'api':
          await this.loadToAPI(data, destination.config);
          break;
        default:
          throw new Error(`Unsupported destination type: ${destination.type}`);
      }
      
      console.log(`[ETL:${jobId}] Load phase completed`);
    } catch (error) {
      console.error(`[ETL:${jobId}] Load failed:`, error);
      throw error;
    }
  }

  // Execute complete ETL job
  async executeJob(job: ETLJobDTO): Promise<void> {
    const jobId = job.id;
    
    if (this.activeJobs.has(jobId)) {
      throw new Error(`Job ${jobId} is already running`);
    }

    this.activeJobs.add(jobId);
    
    try {
      // Update job status
      job.status = 'running';
      job.startedAt = new Date().toISOString();
      job.progress = {
        totalRecords: 0,
        processedRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        percentage: 0,
        currentPhase: 'extract'
      };
      
      this.jobs.set(jobId, job);

      // Extract
      job.progress.currentPhase = 'extract';
      const extractedData = await this.extract(jobId, job.filters);
      job.progress.totalRecords = extractedData.length;

      // Transform
      job.progress.currentPhase = 'transform';
      const transformedData = await this.transform(jobId, extractedData, job.transformations);
      job.progress.processedRecords = transformedData.length;

      // Load
      job.progress.currentPhase = 'load';
      await this.load(jobId, transformedData, job.destination);
      job.progress.successfulRecords = transformedData.length;
      job.progress.percentage = 100;

      // Complete job
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.progress.currentPhase = 'completed';
      
      console.log(`[ETL:${jobId}] Job completed successfully`);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date().toISOString();
      
      console.error(`[ETL:${jobId}] Job failed:`, error);
      throw error;
    } finally {
      this.activeJobs.delete(jobId);
      this.jobs.set(jobId, job);
    }
  }

  // Apply filters to webhook requests
  private applyFilters(requests: WebhookRequest[], filters?: ETLFilters): WebhookRequest[] {
    if (!filters) return requests;

    return requests.filter(request => {
      // Date range filter
      if (filters.dateRange) {
        const requestTime = request.timestamp.getTime();
        const startTime = new Date(filters.dateRange.start).getTime();
        const endTime = new Date(filters.dateRange.end).getTime();
        if (requestTime < startTime || requestTime > endTime) {
          return false;
        }
      }

      // Method filter
      if (filters.methods && filters.methods.length > 0) {
        if (!filters.methods.includes(request.method)) {
          return false;
        }
      }

      // Content type filter
      if (filters.contentTypes && filters.contentTypes.length > 0) {
        if (!request.contentType || !filters.contentTypes.some(ct => 
          request.contentType!.includes(ct)
        )) {
          return false;
        }
      }

      // IP address filter
      if (filters.ipAddresses && filters.ipAddresses.length > 0) {
        if (!request.ip || !filters.ipAddresses.includes(request.ip)) {
          return false;
        }
      }

      // User agent filter
      if (filters.userAgents && filters.userAgents.length > 0) {
        if (!request.userAgent || !filters.userAgents.some(ua => 
          request.userAgent!.includes(ua)
        )) {
          return false;
        }
      }

      // Body contains filter
      if (filters.bodyContains) {
        if (!request.body.includes(filters.bodyContains)) {
          return false;
        }
      }

      // Header conditions
      if (filters.headerConditions && filters.headerConditions.length > 0) {
        for (const condition of filters.headerConditions) {
          const headerValue = request.headers[condition.key];
          if (!headerValue) return false;

          switch (condition.operator) {
            case 'equals':
              if (headerValue !== condition.value) return false;
              break;
            case 'contains':
              if (!headerValue.includes(condition.value)) return false;
              break;
            case 'regex':
              try {
                const regex = new RegExp(condition.value);
                if (!regex.test(headerValue)) return false;
              } catch {
                return false;
              }
              break;
          }
        }
      }

      return true;
    });
  }

  // Apply single transformation
  private async applyTransformation(data: any[], transformation: ETLTransformation): Promise<any[]> {
    switch (transformation.type) {
      case 'filter':
        return this.filterTransformation(data, transformation.config);
      case 'map':
        return this.mapTransformation(data, transformation.config);
      case 'aggregate':
        return this.aggregateTransformation(data, transformation.config);
      case 'enrich':
        return this.enrichTransformation(data, transformation.config);
      case 'validate':
        return this.validateTransformation(data, transformation.config);
      default:
        throw new Error(`Unknown transformation type: ${transformation.type}`);
    }
  }

  // Transformation implementations
  private filterTransformation(data: any[], config: any): any[] {
    // Implement filtering logic based on config
    return data.filter(item => {
      // Example: filter by field value
      if (config.field && config.value) {
        return item[config.field] === config.value;
      }
      return true;
    });
  }

  private mapTransformation(data: any[], config: any): any[] {
    // Implement mapping logic based on config
    return data.map(item => {
      const mapped = { ...item };
      
      // Example: rename fields
      if (config.fieldMappings) {
        for (const [oldField, newField] of Object.entries(config.fieldMappings)) {
          if (mapped[oldField] !== undefined) {
            mapped[newField as string] = mapped[oldField];
            delete mapped[oldField];
          }
        }
      }
      
      return mapped;
    });
  }

  private aggregateTransformation(data: any[], config: any): any[] {
    // Implement aggregation logic
    if (config.groupBy) {
      const groups = new Map();
      
      data.forEach(item => {
        const key = item[config.groupBy];
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(item);
      });
      
      return Array.from(groups.entries()).map(([key, items]) => ({
        [config.groupBy]: key,
        count: items.length,
        items: config.includeItems ? items : undefined
      }));
    }
    
    return data;
  }

  private enrichTransformation(data: any[], config: any): any[] {
    // Implement enrichment logic
    return data.map(item => ({
      ...item,
      ...config.additionalFields,
      enrichedAt: new Date().toISOString()
    }));
  }

  private validateTransformation(data: any[], config: any): any[] {
    // Implement validation logic
    return data.filter(item => {
      if (config.requiredFields) {
        return config.requiredFields.every((field: string) => 
          item[field] !== undefined && item[field] !== null
        );
      }
      return true;
    });
  }

  // Load destination implementations
  private async loadToWebhook(data: any[], config: any): Promise<void> {
    const url = config.url;
    const method = config.method || 'POST';
    const headers = config.headers || { 'Content-Type': 'application/json' };

    for (const item of data) {
      try {
        await fetch(url, {
          method,
          headers,
          body: JSON.stringify(item)
        });
      } catch (error) {
        console.error('Failed to send to webhook:', error);
        throw error;
      }
    }
  }

  private async loadToFile(data: any[], config: any): Promise<void> {
    // In a real implementation, this would save to a file system
    // For now, we'll just log the data
    console.log('Loading to file:', config.filename);
    console.log('Data:', JSON.stringify(data, null, 2));
  }

  private async loadToEmail(data: any[], config: any): Promise<void> {
    // In a real implementation, this would send an email
    console.log('Sending email to:', config.recipients);
    console.log('Subject:', config.subject);
    console.log('Data summary:', `${data.length} records processed`);
  }

  private async loadToAPI(data: any[], config: any): Promise<void> {
    const url = config.url;
    const method = config.method || 'POST';
    const headers = config.headers || { 'Content-Type': 'application/json' };

    try {
      await fetch(url, {
        method,
        headers,
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error('Failed to send to API:', error);
      throw error;
    }
  }

  // Job management methods
  getJob(jobId: string): ETLJobDTO | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ETLJobDTO[] {
    return Array.from(this.jobs.values());
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && this.activeJobs.has(jobId)) {
      job.status = 'cancelled';
      job.completedAt = new Date().toISOString();
      this.activeJobs.delete(jobId);
      this.jobs.set(jobId, job);
      return true;
    }
    return false;
  }

  isJobRunning(jobId: string): boolean {
    return this.activeJobs.has(jobId);
  }
}

// Singleton instance
let etlEngineInstance: ETLEngine | null = null;

export function getETLEngine(): ETLEngine {
  if (!etlEngineInstance) {
    etlEngineInstance = new ETLEngine();
  }
  return etlEngineInstance;
}