// Webhook specific header with dropdown menu and data management

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWebhooks, useDataManagement } from '@/hooks/useLocalStorage';
import { 
  generateShortId, 
  generateWebhookUrl, 
  exportToJson, 
  exportToCsv, 
  importFromJson, 
  calculateStorageUsage,
  formatDateTime,
  copyToClipboard
} from '@/lib/utils';

import { ThemeToggle } from './ThemeProvider';
import type { WebhookConfig, ExportData, WebhookRequest } from '@/types/webhook';

interface WebhookHeaderProps {
  currentWebhookId?: string;
}

export default function WebhookHeader({ currentWebhookId }: WebhookHeaderProps) {
  const router = useRouter();
  const { webhooks, createWebhook, deleteWebhook, updateWebhook } = useWebhooks();
  const { 
    isExporting,
    isImporting,
    exportData,
    importData,
    clearAllData,
    cleanupExpiredData
  } = useDataManagement();
  
  const [showWebhookMenu, setShowWebhookMenu] = useState(false);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  
  const webhookMenuRef = useRef<HTMLDivElement>(null);
  const dataMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentWebhook = webhooks.find(w => w.id === currentWebhookId);
  
  // Generate webhook URL
  const webhookUrl = currentWebhookId ? (currentWebhook?.url || generateWebhookUrl('', currentWebhookId)) : '';

  // Handle copy webhook URL
  const handleCopyUrl = async () => {
    if (!webhookUrl) return;
    await copyToClipboard(webhookUrl);
  };

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (webhookMenuRef.current && !webhookMenuRef.current.contains(event.target as Node)) {
        setShowWebhookMenu(false);
        // Cancel editing when clicking outside
        if (editingWebhookId) {
          setEditingWebhookId(null);
          setEditingName('');
        }
      }
      if (dataMenuRef.current && !dataMenuRef.current.contains(event.target as Node)) {
        setShowDataMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingWebhookId]);

  // Create new webhook
  const handleCreateWebhook = async () => {
    setIsCreating(true);
    
    try {
      const webhookId = generateShortId(8);
      const webhookUrl = generateWebhookUrl('', webhookId);
      
      const newWebhook: WebhookConfig = {
        id: webhookId,
        name: `webhook@${webhookId}`,
        url: webhookUrl,
        createdAt: new Date(),
        requestCount: 0,
        isActive: true,
      };

      createWebhook(newWebhook);
      router.push(`/w/${webhookId}`);
      setShowWebhookMenu(false);
    } catch (error) {
      console.error('Error creating webhook:', error);
      alert('Failed to create webhook. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Switch to webhook
  const handleWebhookSelect = (webhookId: string) => {
    router.push(`/w/${webhookId}`);
    setShowWebhookMenu(false);
  };

  // Start editing webhook name
  const handleStartEdit = (webhookId: string, currentName: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setEditingWebhookId(webhookId);
    setEditingName(currentName);
  };

  // Save webhook name
  const handleSaveName = (webhookId: string) => {
    if (editingName.trim() === '') {
      alert('Webhook name cannot be empty');
      return;
    }

    try {
      const success = updateWebhook(webhookId, { name: editingName.trim() });
      if (success) {
        setEditingWebhookId(null);
        setEditingName('');
      } else {
        alert('Failed to update webhook name. Please try again.');
      }
    } catch (error) {
      console.error('Error updating webhook name:', error);
      alert('An error occurred while updating the webhook name.');
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingWebhookId(null);
    setEditingName('');
  };

  // Handle key press in edit input
  const handleEditKeyPress = (e: React.KeyboardEvent, webhookId: string) => {
    if (e.key === 'Enter') {
      handleSaveName(webhookId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Delete webhook
  const handleDeleteWebhook = async (webhookId: string, webhookName: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const webhook = webhooks.find(w => w.id === webhookId);
    const displayName = webhookName || webhookId.slice(0, 8);
    
    // Show detailed confirmation dialog
    const confirmMessage = [
      `Are you sure you want to delete "${displayName}"?`,
      '',
      'This will permanently delete:',
      '• The webhook endpoint',
      `• All ${webhook?.requestCount || 0} request records`,
      '• Request history and data',
      '',
      'This action cannot be undone.',
      '',
      `${webhooks.length === 1 ? 'Note: This is your last webhook. A new one will be created automatically.' : ''}`
    ].filter(Boolean).join('\n');

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const success = deleteWebhook(webhookId);
      if (success) {
        // Show success feedback
        console.log(`Webhook "${displayName}" deleted successfully`);
        
        // If the deleted webhook is the current one, redirect to home or another webhook
        if (webhookId === currentWebhookId) {
          const remainingWebhooks = webhooks.filter(w => w.id !== webhookId);
          if (remainingWebhooks.length > 0) {
            router.push(`/w/${remainingWebhooks[0].id}`);
          } else {
            // All webhooks deleted, redirect to home (which will create a new one)
            router.push('/');
          }
        }
        setShowWebhookMenu(false);
      } else {
        alert('Failed to delete webhook. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting webhook:', error);
      alert('An error occurred while deleting the webhook.');
    }
  };

  // Export webhooks as JSON
  const handleExportJson = async () => {
    try {
      // Run diagnostics first
      debugLocalStorage();
      
      const data = await exportData();
      
      if (data) {
        // Check if data is actually empty
        const hasWebhooks = data.webhooks && data.webhooks.length > 0;
        const hasRequests = data.requests && Object.keys(data.requests).length > 0;
        const totalRequests = Object.values(data.requests || {}).flat().length;
        
        if (!hasWebhooks && !hasRequests) {
          const confirmExport = confirm('No data found to export. The exported file will be empty. Do you want to continue?');
          if (!confirmExport) {
            setShowDataMenu(false);
            return;
          }
        }
        
        const filename = `webhooks-export-${formatDateTime(new Date()).replace(/[:\s]/g, '-')}`;
        exportToJson(data, filename);
        
        // Show success message with details
        const exportMessage = [
          'Export completed successfully!',
          `Webhooks: ${data.webhooks?.length || 0}`,
          `Requests: ${totalRequests || 0}`
        ].join('\n');
        alert(exportMessage);
      } else {
        alert('Failed to export data: No data available');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setShowDataMenu(false);
  };

  // Export webhook requests as CSV
  const handleExportCsv = async () => {
    try {
      const data = await exportData();
      if (data && data.requests && typeof data.requests === 'object') {
        // Flatten all requests from all webhooks into a single array
        const allRequests: WebhookRequest[] = [];
        Object.entries(data.requests).forEach(([, requests]) => {
          if (Array.isArray(requests)) {
            allRequests.push(...requests);
          }
        });

        if (allRequests.length > 0) {
          const csvData = allRequests.map((req: WebhookRequest) => ({
            webhookId: req.webhookId,
            method: req.method,
            path: req.path,
            timestamp: formatDateTime(req.timestamp),
            ip: req.ip,
            userAgent: req.userAgent,
            contentType: req.contentType,
          }));

          const filename = `webhook-requests-${formatDateTime(new Date()).replace(/[:\s]/g, '-')}`;
          exportToCsv(csvData, filename);
        } else {
          alert('No webhook requests to export');
        }
      } else {
        alert('No webhook requests to export');
      }
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('Failed to export CSV data');
    }
    setShowDataMenu(false);
  };

  // Handle file import
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus('Importing...');

    try {
      const data = await importFromJson<ExportData>(file);
      
      if (!data.webhooks || !Array.isArray(data.webhooks)) {
        throw new Error('Invalid data format: webhooks array missing');
      }

      const success = await importData(data);
      
      if (success) {
        setImportStatus(`Successfully imported ${data.webhooks.length} webhooks`);
        setTimeout(() => setImportStatus(''), 3000);
      } else {
        throw new Error('Import operation failed');
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportStatus(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setImportStatus(''), 5000);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowDataMenu(false);
  };

  // Clear all data
  const handleClearAllData = async () => {
    if (!showConfirmClear) {
      setShowConfirmClear(true);
      return;
    }

    try {
      const success = clearAllData();
      if (success) {
        alert('All data cleared successfully');
        setShowConfirmClear(false);
        router.push('/');
      } else {
        alert('Failed to clear data');
      }
    } catch (error) {
      console.error('Clear data failed:', error);
      alert('Failed to clear data');
    }
    setShowDataMenu(false);
  };

  // Storage statistics
  const storageStats = calculateStorageUsage();

  // Debug: Check localStorage data
  const debugLocalStorage = () => {
    console.log('=== LocalStorage Debug ===');
    if (typeof window !== 'undefined' && window.localStorage) {
      console.log('All localStorage keys:', Object.keys(localStorage));
      console.log('CF-Webhook keys:', Object.keys(localStorage).filter(key => key.includes('cf-webhook')));
      
      // Check specific keys
      const webhookKey = 'cf-webhook:webhooks';
      const requestKey = 'cf-webhook:requests';
      
      console.log(`${webhookKey}:`, localStorage.getItem(webhookKey));
      console.log(`${requestKey}:`, localStorage.getItem(requestKey));
      
      // Check current webhooks state
      console.log('Current webhooks state:', webhooks);
    }
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Unified layout for all screen sizes */}
        <div className="flex justify-between items-center md:items-start lg:items-center h-14 md:h-16 py-2 md:py-0">
          {/* Logo and webhook selector */}
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 md:w-7 md:h-7 lg:w-8 lg:h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            
            {/* Webhook Dropdown */}
            <div className="relative min-w-0 flex-1" ref={webhookMenuRef}>
              <div className="flex flex-col">
                {/* Webhook name with dropdown */}
                <button
                  onClick={() => setShowWebhookMenu(!showWebhookMenu)}
                  className="flex items-center justify-between w-full md:justify-start md:space-x-2 text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300 px-3 md:px-2 lg:px-3 py-2 md:py-1 rounded-lg md:rounded-md text-sm font-medium transition-colors bg-gray-50 dark:bg-gray-800 md:bg-transparent"
                >
                  <span className="font-semibold truncate">
                    {currentWebhook?.name || (currentWebhookId ? `webhook@${currentWebhookId}` : 'Select Webhook')}
                  </span>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Webhook URL as subtitle - desktop only */}
                {currentWebhookId && webhookUrl && (
                  <div className="hidden md:block px-2 lg:px-3 pb-1">
                    <span
                      onClick={handleCopyUrl}
                      className="inline-block text-[10px] font-mono text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all duration-200 truncate bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded max-w-full"
                      title="Click to copy webhook URL"
                    >
                      {webhookUrl}
                    </span>
                  </div>
                )}
              </div>

              {showWebhookMenu && (
                <div className="absolute left-0 mt-2 w-[calc(100vw-2rem)] max-w-xs md:w-72 lg:w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[60]">
                  <div className="py-1">
                    {/* Create new webhook */}
                    <button
                      onClick={handleCreateWebhook}
                      disabled={isCreating}
                      className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-l-2 border-transparent hover:border-blue-200 dark:hover:border-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="flex-shrink-0">
                          {isCreating ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          )}
                        </div>
                        <span className="font-medium">
                          {isCreating ? 'Creating...' : 'Create New Webhook'}
                        </span>
                      </div>
                    </button>
                    
                    {webhooks.length > 0 && (
                      <>
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        
                        {webhooks.map((webhook) => (
                          <div key={webhook.id}>
                            {editingWebhookId === webhook.id ? (
                              // Edit mode - compact edit interface
                              <div className="px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500">
                                <div className="space-y-2.5">
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onKeyDown={(e) => handleEditKeyPress(e, webhook.id)}
                                    className="w-full px-2.5 py-1.5 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    autoFocus
                                    placeholder="Enter webhook name"
                                  />
                                  <div className="flex justify-end space-x-1.5">
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleSaveName(webhook.id)}
                                      className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // Display mode - clickable webhook item
                              <div
                                className={`group relative ${
                                  webhook.id === currentWebhookId 
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' 
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-l-2 border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                                } transition-all duration-200`}
                              >
                                {/* Main clickable area */}
                                <button
                                  onClick={() => handleWebhookSelect(webhook.id)}
                                  className="w-full px-3 py-2.5 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                                      {/* Status indicator */}
                                      <div className="flex-shrink-0">
                                        <span className={`w-2 h-2 rounded-full ${
                                          webhook.isActive ? 'bg-green-500' : 'bg-gray-400'
                                        }`} />
                                      </div>
                                      
                                      {/* Webhook info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-1.5">
                                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {webhook.name || `webhook@${webhook.id}`}
                                          </h3>
                                          {webhook.id === currentWebhookId && (
                                            <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                              Current
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2.5 mt-0.5">
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {webhook.requestCount} requests
                                          </p>
                                          {webhook.createdAt && (
                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                              {new Date(webhook.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Selected indicator */}
                                    {webhook.id === currentWebhookId && (
                                      <div className="flex-shrink-0 ml-1.5">
                                        <svg className="w-3.5 h-3.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                </button>
                                
                                {/* Action buttons - always visible on mobile, hover on desktop */}
                                <div className="absolute right-1.5 top-1/2 transform -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                                  <div className="flex items-center space-x-0.5">
                                    {/* Edit button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEdit(webhook.id, webhook.name || `webhook@${webhook.id}`, e);
                                      }}
                                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                      title="Edit webhook name"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    
                                    {/* Delete button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteWebhook(webhook.id, webhook.name || '', e);
                                      }}
                                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                      title="Delete webhook"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side - URL copy (mobile), Data Management and Theme Toggle */}
          <div className="flex items-center space-x-1 md:space-x-4">
            {/* URL copy button - mobile only */}
            {currentWebhookId && webhookUrl && (
              <button
                onClick={handleCopyUrl}
                className="md:hidden flex items-center justify-center w-10 h-10 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Copy webhook URL"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            
            {/* Data Management Dropdown */}
            <div className="relative" ref={dataMenuRef}>
              <button
                onClick={() => setShowDataMenu(!showDataMenu)}
                className="flex items-center justify-center md:justify-start w-10 h-10 md:w-auto md:h-auto md:space-x-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 md:hover:bg-transparent rounded-lg md:rounded-md md:px-3 md:py-2 text-sm font-medium transition-colors"
                title="Data Management"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c0 2.21 1.79 4 4 4V7M4 7h16M4 7l1-3h14l1 3" />
                </svg>
                <span className="hidden md:block">Data Management</span>
              </button>

              {showDataMenu && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs md:w-56 lg:w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[60]">
                  <div className="p-3">
                    {/* Storage Stats */}
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1.5">Storage Usage</h4>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">Used:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{storageStats.formatted.used}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                          <div 
                            className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(storageStats.percentage, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          {storageStats.percentage.toFixed(1)}% • {webhooks.length} webhooks
                        </div>
                      </div>
                    </div>

                    {importStatus && (
                      <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                        {importStatus}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-1.5">
                      <button
                        onClick={handleExportJson}
                        disabled={isExporting}
                        className="w-full flex items-center justify-center px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export JSON
                      </button>

                      <button
                        onClick={handleExportCsv}
                        disabled={isExporting}
                        className="w-full flex items-center justify-center px-2.5 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export CSV
                      </button>

                      <div className="relative">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleImport}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isImporting}
                          className="w-full flex items-center justify-center px-2.5 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Import JSON
                        </button>
                      </div>

                      <button
                        onClick={() => cleanupExpiredData()}
                        className="w-full flex items-center justify-center px-2.5 py-1.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Cleanup
                      </button>

                      <button
                        onClick={handleClearAllData}
                        className={`w-full flex items-center justify-center px-2.5 py-1.5 text-xs rounded transition-colors ${
                          showConfirmClear 
                            ? 'bg-red-600 text-white hover:bg-red-700' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        {showConfirmClear ? 'Confirm Clear' : 'Clear All'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
} 