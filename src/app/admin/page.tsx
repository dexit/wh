// Admin Dashboard Page
// Provides administrative interface for webhook management and ETL operations

'use client';

import { useState, useEffect } from 'react';
import { PageContainer, Card, Button } from '@/app/components/Layout';
import WebhookHeader from '@/app/components/WebhookHeader';
import Footer from '@/app/components/Footer';
import type { AdminActionDTO, BulkOperationDTO, ETLJobDTO } from '@/types/dto';

interface AdminStats {
  totalWebhooks: number;
  totalRequests: number;
  activeJobs: number;
  pendingActions: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats>({
    totalWebhooks: 0,
    totalRequests: 0,
    activeJobs: 0,
    pendingActions: 0
  });
  const [recentActions, setRecentActions] = useState<AdminActionDTO[]>([]);
  const [activeJobs, setActiveJobs] = useState<ETLJobDTO[]>([]);
  const [bulkOperations, setBulkOperations] = useState<BulkOperationDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Load admin data
  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAdminData = async () => {
    try {
      // Load recent actions
      const actionsResponse = await fetch('/api/admin/actions?status=pending');
      if (actionsResponse.ok) {
        const actionsData = await actionsResponse.json();
        setRecentActions(actionsData.data?.actions || []);
        setStats(prev => ({ ...prev, pendingActions: actionsData.data?.actions?.length || 0 }));
      }

      // Load ETL jobs
      const jobsResponse = await fetch('/api/admin/etl?status=running');
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setActiveJobs(jobsData.data?.jobs || []);
        setStats(prev => ({ ...prev, activeJobs: jobsData.data?.jobs?.length || 0 }));
      }

      // Load bulk operations
      const bulkResponse = await fetch('/api/admin/bulk?status=running');
      if (bulkResponse.ok) {
        const bulkData = await bulkResponse.json();
        setBulkOperations(bulkData.data?.operations || []);
      }

      // Load server stats for webhook/request counts
      const serverStatsResponse = await fetch('/api/server-stats');
      if (serverStatsResponse.ok) {
        const serverStats = await serverStatsResponse.json();
        if (serverStats.storage?.distribution) {
          setStats(prev => ({
            ...prev,
            totalWebhooks: serverStats.storage.distribution.totalWebhooks || 0,
            totalRequests: serverStats.storage.distribution.totalRequests || 0
          }));
        }
      }

    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Quick actions
  const handleQuickAction = async (type: string, action: string, parameters: any = {}) => {
    try {
      const response = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          action,
          parameters,
          userId: 'admin'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Action dispatched:', result.data.actionId);
        // Refresh data
        setTimeout(loadAdminData, 1000);
      } else {
        const error = await response.json();
        alert(`Action failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Quick action failed:', error);
      alert('Action failed: Network error');
    }
  };

  // Create ETL job
  const handleCreateETLJob = async () => {
    const jobName = prompt('Enter ETL job name:');
    if (!jobName) return;

    try {
      const response = await fetch('/api/admin/etl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: jobName,
          type: 'full',
          filters: {
            dateRange: {
              start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString()
            }
          },
          transformations: [
            {
              id: 'filter-success',
              type: 'filter',
              config: { field: 'method', value: 'POST' },
              enabled: true,
              order: 1
            }
          ],
          destination: {
            type: 'file',
            config: { filename: `export-${Date.now()}.json` }
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('ETL job created:', result.data.id);
        loadAdminData();
      } else {
        const error = await response.json();
        alert(`ETL job creation failed: ${error.error}`);
      }
    } catch (error) {
      console.error('ETL job creation failed:', error);
      alert('ETL job creation failed: Network error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <WebhookHeader />
        <main className="flex-1">
          <PageContainer>
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </PageContainer>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <WebhookHeader />
      
      <main className="flex-1">
        <PageContainer>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage webhooks, ETL jobs, and system operations
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Webhooks</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalWebhooks}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Requests</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalRequests}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active ETL Jobs</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.activeJobs}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Actions</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.pendingActions}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="mb-8">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button
                  onClick={() => handleQuickAction('system_operation', 'cleanup_expired_data', { retentionHours: 24 })}
                  variant="outline"
                  className="w-full"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Cleanup Data
                </Button>

                <Button
                  onClick={() => handleQuickAction('system_operation', 'backup_system')}
                  variant="outline"
                  className="w-full"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Backup System
                </Button>

                <Button
                  onClick={() => handleQuickAction('system_operation', 'health_check')}
                  variant="outline"
                  className="w-full"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Health Check
                </Button>

                <Button
                  onClick={handleCreateETLJob}
                  variant="primary"
                  className="w-full"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create ETL Job
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Actions */}
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Actions</h2>
                {recentActions.length > 0 ? (
                  <div className="space-y-3">
                    {recentActions.slice(0, 5).map((action) => (
                      <div key={action.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {action.type}: {action.action}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(action.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            action.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            action.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            action.status === 'executing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {action.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent actions</p>
                )}
              </div>
            </Card>

            {/* Active ETL Jobs */}
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active ETL Jobs</h2>
                {activeJobs.length > 0 ? (
                  <div className="space-y-3">
                    {activeJobs.slice(0, 5).map((job) => (
                      <div key={job.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {job.name}
                          </p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            job.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            job.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        {job.progress && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                              <span>{job.progress.currentPhase}</span>
                              <span>{job.progress.percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${job.progress.percentage}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No active ETL jobs</p>
                )}
              </div>
            </Card>
          </div>

          {/* Bulk Operations */}
          {bulkOperations.length > 0 && (
            <Card className="mt-8">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Bulk Operations</h2>
                <div className="space-y-3">
                  {bulkOperations.map((operation) => (
                    <div key={operation.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {operation.type} ({operation.targets.length} items)
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          operation.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          operation.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          operation.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {operation.status}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>Progress: {operation.progress.completed}/{operation.progress.total}</span>
                          <span>Failed: {operation.progress.failed}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${(operation.progress.completed / operation.progress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </PageContainer>
      </main>
      
      <Footer />
    </div>
  );
}