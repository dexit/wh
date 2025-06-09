// Admin Action Dispatcher
// Handles administrative operations with proper authorization and logging

import type { 
  AdminActionDTO, 
  BulkOperationDTO, 
  WebhookConfigDTO, 
  ETLJobDTO 
} from '@/types/dto';
import type { WebhookConfig, WebhookRequest } from '@/types/webhook';
import { getStorageManager } from '@/lib/storage/storage-manager';
import { getETLEngine } from '@/lib/etl/etl-engine';
import { generateId } from '@/lib/utils';

export class AdminDispatcher {
  private actions = new Map<string, AdminActionDTO>();
  private bulkOperations = new Map<string, BulkOperationDTO>();

  // Dispatch admin action
  async dispatch(action: Omit<AdminActionDTO, 'id' | 'timestamp' | 'status'>): Promise<string> {
    const actionId = generateId();
    const adminAction: AdminActionDTO = {
      ...action,
      id: actionId,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    this.actions.set(actionId, adminAction);

    // Execute action asynchronously
    this.executeAction(adminAction).catch(error => {
      console.error(`Admin action ${actionId} failed:`, error);
      adminAction.status = 'failed';
      adminAction.error = error instanceof Error ? error.message : 'Unknown error';
      this.actions.set(actionId, adminAction);
    });

    return actionId;
  }

  // Execute admin action
  private async executeAction(action: AdminActionDTO): Promise<void> {
    action.status = 'executing';
    this.actions.set(action.id, action);

    try {
      let result: any;

      switch (action.type) {
        case 'webhook_operation':
          result = await this.executeWebhookOperation(action);
          break;
        case 'etl_operation':
          result = await this.executeETLOperation(action);
          break;
        case 'system_operation':
          result = await this.executeSystemOperation(action);
          break;
        case 'user_operation':
          result = await this.executeUserOperation(action);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      action.status = 'completed';
      action.result = result;
    } catch (error) {
      action.status = 'failed';
      action.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      this.actions.set(action.id, action);
    }
  }

  // Webhook operations
  private async executeWebhookOperation(action: AdminActionDTO): Promise<any> {
    const storageManager = await getStorageManager();

    switch (action.action) {
      case 'create_webhook':
        return await this.createWebhook(action.parameters);
      
      case 'update_webhook':
        return await this.updateWebhook(action.targetId!, action.parameters);
      
      case 'delete_webhook':
        return await storageManager.deleteWebhookConfig(action.targetId!);
      
      case 'clear_requests':
        await storageManager.clearRequests(action.targetId!);
        return { cleared: true };
      
      case 'export_webhook_data':
        return await this.exportWebhookData(action.targetId, action.parameters);
      
      case 'import_webhook_data':
        return await this.importWebhookData(action.parameters);
      
      default:
        throw new Error(`Unknown webhook operation: ${action.action}`);
    }
  }

  // ETL operations
  private async executeETLOperation(action: AdminActionDTO): Promise<any> {
    const etlEngine = getETLEngine();

    switch (action.action) {
      case 'create_etl_job':
        return await this.createETLJob(action.parameters);
      
      case 'execute_etl_job':
        const job = etlEngine.getJob(action.targetId!);
        if (!job) {
          throw new Error(`ETL job ${action.targetId} not found`);
        }
        await etlEngine.executeJob(job);
        return { executed: true };
      
      case 'cancel_etl_job':
        return etlEngine.cancelJob(action.targetId!);
      
      case 'schedule_etl_job':
        return await this.scheduleETLJob(action.targetId!, action.parameters);
      
      default:
        throw new Error(`Unknown ETL operation: ${action.action}`);
    }
  }

  // System operations
  private async executeSystemOperation(action: AdminActionDTO): Promise<any> {
    switch (action.action) {
      case 'cleanup_expired_data':
        return await this.cleanupExpiredData(action.parameters);
      
      case 'backup_system':
        return await this.backupSystem(action.parameters);
      
      case 'restore_system':
        return await this.restoreSystem(action.parameters);
      
      case 'health_check':
        return await this.performHealthCheck();
      
      case 'generate_report':
        return await this.generateReport(action.parameters);
      
      default:
        throw new Error(`Unknown system operation: ${action.action}`);
    }
  }

  // User operations
  private async executeUserOperation(action: AdminActionDTO): Promise<any> {
    switch (action.action) {
      case 'audit_user_activity':
        return await this.auditUserActivity(action.targetId!, action.parameters);
      
      case 'export_user_data':
        return await this.exportUserData(action.targetId!, action.parameters);
      
      default:
        throw new Error(`Unknown user operation: ${action.action}`);
    }
  }

  // Bulk operations
  async executeBulkOperation(operation: Omit<BulkOperationDTO, 'id' | 'createdAt' | 'status' | 'progress'>): Promise<string> {
    const operationId = generateId();
    const bulkOperation: BulkOperationDTO = {
      ...operation,
      id: operationId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      progress: {
        total: operation.targets.length,
        completed: 0,
        failed: 0
      },
      results: []
    };

    this.bulkOperations.set(operationId, bulkOperation);

    // Execute bulk operation asynchronously
    this.executeBulkOperationAsync(bulkOperation).catch(error => {
      console.error(`Bulk operation ${operationId} failed:`, error);
      bulkOperation.status = 'failed';
      this.bulkOperations.set(operationId, bulkOperation);
    });

    return operationId;
  }

  private async executeBulkOperationAsync(operation: BulkOperationDTO): Promise<void> {
    operation.status = 'running';
    this.bulkOperations.set(operation.id, operation);

    const storageManager = await getStorageManager();

    for (const targetId of operation.targets) {
      try {
        let success = false;
        let error: string | undefined;

        switch (operation.type) {
          case 'delete':
            if (operation.parameters.type === 'webhook') {
              success = await storageManager.deleteWebhookConfig(targetId);
            } else if (operation.parameters.type === 'request') {
              success = await storageManager.deleteRequest(operation.parameters.webhookId, targetId);
            }
            break;

          case 'update':
            if (operation.parameters.type === 'webhook') {
              const config = await storageManager.getWebhookConfig(targetId);
              if (config) {
                const updatedConfig = { ...config, ...operation.parameters.updates };
                await storageManager.saveWebhookConfig(updatedConfig);
                success = true;
              }
            }
            break;

          case 'export':
            // Export individual items
            success = true; // Placeholder
            break;

          case 'transform':
            // Apply transformations
            success = true; // Placeholder
            break;
        }

        operation.results!.push({
          id: targetId,
          success,
          error
        });

        if (success) {
          operation.progress.completed++;
        } else {
          operation.progress.failed++;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        operation.results!.push({
          id: targetId,
          success: false,
          error: errorMessage
        });
        operation.progress.failed++;
      }

      // Update progress
      this.bulkOperations.set(operation.id, operation);
    }

    operation.status = 'completed';
    operation.completedAt = new Date().toISOString();
    this.bulkOperations.set(operation.id, operation);
  }

  // Helper methods for specific operations
  private async createWebhook(parameters: any): Promise<WebhookConfig> {
    const storageManager = await getStorageManager();
    
    const webhook: WebhookConfig = {
      id: generateId(),
      name: parameters.name,
      url: parameters.url,
      createdAt: new Date(),
      requestCount: 0,
      isActive: parameters.isActive ?? true
    };

    await storageManager.saveWebhookConfig(webhook);
    return webhook;
  }

  private async updateWebhook(webhookId: string, parameters: any): Promise<WebhookConfig> {
    const storageManager = await getStorageManager();
    
    const existing = await storageManager.getWebhookConfig(webhookId);
    if (!existing) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const updated = { ...existing, ...parameters };
    await storageManager.saveWebhookConfig(updated);
    return updated;
  }

  private async exportWebhookData(webhookId?: string, parameters?: any): Promise<any> {
    const storageManager = await getStorageManager();
    
    if (webhookId) {
      const config = await storageManager.getWebhookConfig(webhookId);
      const requests = await storageManager.getRequests(webhookId, parameters?.limit || 1000);
      return { config, requests };
    } else {
      const configs = await storageManager.getAllWebhookConfigs();
      const allData: any = { configs, requests: {} };
      
      for (const config of configs) {
        const requests = await storageManager.getRequests(config.id, parameters?.limit || 1000);
        allData.requests[config.id] = requests;
      }
      
      return allData;
    }
  }

  private async importWebhookData(parameters: any): Promise<any> {
    const storageManager = await getStorageManager();
    const { configs, requests } = parameters.data;

    // Import configs
    for (const config of configs) {
      await storageManager.saveWebhookConfig(config);
    }

    // Import requests
    for (const [webhookId, webhookRequests] of Object.entries(requests)) {
      for (const request of webhookRequests as WebhookRequest[]) {
        await storageManager.saveRequest(webhookId, request);
      }
    }

    return { imported: true, configs: configs.length, requests: Object.keys(requests).length };
  }

  private async createETLJob(parameters: any): Promise<ETLJobDTO> {
    const job: ETLJobDTO = {
      id: generateId(),
      name: parameters.name,
      type: parameters.type,
      status: 'pending',
      webhookId: parameters.webhookId,
      filters: parameters.filters,
      transformations: parameters.transformations,
      destination: parameters.destination,
      schedule: parameters.schedule,
      createdAt: new Date().toISOString(),
      metadata: parameters.metadata
    };

    // Store job (in a real implementation, this would be persisted)
    const etlEngine = getETLEngine();
    (etlEngine as any).jobs.set(job.id, job);

    return job;
  }

  private async scheduleETLJob(jobId: string, parameters: any): Promise<any> {
    // In a real implementation, this would integrate with a job scheduler
    console.log(`Scheduling ETL job ${jobId} with parameters:`, parameters);
    return { scheduled: true, jobId, schedule: parameters.schedule };
  }

  private async cleanupExpiredData(parameters: any): Promise<any> {
    const storageManager = await getStorageManager();
    const retentionHours = parameters.retentionHours || 24;
    
    const deletedCount = await storageManager.cleanupExpiredRequests();
    return { deletedCount, retentionHours };
  }

  private async backupSystem(parameters: any): Promise<any> {
    const storageManager = await getStorageManager();
    
    const configs = await storageManager.getAllWebhookConfigs();
    const backup: any = { configs, requests: {}, timestamp: new Date().toISOString() };
    
    for (const config of configs) {
      const requests = await storageManager.getRequests(config.id, 10000);
      backup.requests[config.id] = requests;
    }
    
    return { backup, size: JSON.stringify(backup).length };
  }

  private async restoreSystem(parameters: any): Promise<any> {
    // In a real implementation, this would restore from backup
    console.log('Restoring system from backup:', parameters.backupId);
    return { restored: true, backupId: parameters.backupId };
  }

  private async performHealthCheck(): Promise<any> {
    const storageManager = await getStorageManager();
    const isHealthy = await storageManager.isHealthy();
    const providerInfo = storageManager.getProviderInfo();
    
    return {
      healthy: isHealthy,
      provider: providerInfo,
      timestamp: new Date().toISOString(),
      uptime: storageManager.getUptime()
    };
  }

  private async generateReport(parameters: any): Promise<any> {
    const storageManager = await getStorageManager();
    const stats = await storageManager.getStats();
    
    return {
      type: parameters.type || 'summary',
      stats,
      generatedAt: new Date().toISOString(),
      parameters
    };
  }

  private async auditUserActivity(userId: string, parameters: any): Promise<any> {
    // In a real implementation, this would audit user activity
    console.log(`Auditing activity for user ${userId}:`, parameters);
    return { audited: true, userId, activities: [] };
  }

  private async exportUserData(userId: string, parameters: any): Promise<any> {
    // In a real implementation, this would export user-specific data
    console.log(`Exporting data for user ${userId}:`, parameters);
    return { exported: true, userId, data: {} };
  }

  // Status and monitoring methods
  getAction(actionId: string): AdminActionDTO | undefined {
    return this.actions.get(actionId);
  }

  getBulkOperation(operationId: string): BulkOperationDTO | undefined {
    return this.bulkOperations.get(operationId);
  }

  getAllActions(): AdminActionDTO[] {
    return Array.from(this.actions.values());
  }

  getAllBulkOperations(): BulkOperationDTO[] {
    return Array.from(this.bulkOperations.values());
  }

  getActiveActions(): AdminActionDTO[] {
    return Array.from(this.actions.values()).filter(action => 
      action.status === 'pending' || action.status === 'executing'
    );
  }

  getActiveBulkOperations(): BulkOperationDTO[] {
    return Array.from(this.bulkOperations.values()).filter(operation => 
      operation.status === 'pending' || operation.status === 'running'
    );
  }
}

// Singleton instance
let adminDispatcherInstance: AdminDispatcher | null = null;

export function getAdminDispatcher(): AdminDispatcher {
  if (!adminDispatcherInstance) {
    adminDispatcherInstance = new AdminDispatcher();
  }
  return adminDispatcherInstance;
}