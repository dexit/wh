'use client';

import { useState, useEffect } from 'react';
import { getWebhookStorage } from '@/lib/browser-storage';
import { config } from '@/lib/config';
import { formatBytes, formatRelativeTime } from '@/lib/utils';
import type { WebhookConfig, WebhookRequest } from '@/types/webhook';

// Scientific device detection function
const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';
  
  const detectionResults = {
    // 1. Touch support detection
    hasTouchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    
    // 2. User agent string detection (comprehensive pattern matching)
    userAgent: (() => {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipod/.test(ua)) return 'mobile';
      if (/ipad/.test(ua)) return 'tablet';
      if (/android/.test(ua)) {
        // Further distinguish between Android phones and tablets
        return /mobile/.test(ua) ? 'mobile' : 'tablet';
      }
      if (/blackberry|bb|playbook/.test(ua)) return 'mobile';
      if (/kindle|silk/.test(ua)) return 'tablet';
      if (/windows phone|iemobile|wpdesktop/.test(ua)) return 'mobile';
      return null;
    })(),
    
    // 3. Screen size detection (more precise breakpoints)
    screenSize: (() => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const screenArea = width * height;
      
      // Comprehensive judgment based on screen area and width
      if (width <= 480) return 'mobile';
      if (width <= 768 && screenArea < 786432) return 'mobile'; // 1024x768 area
      if (width <= 1024) return 'tablet';
      return 'desktop';
    })(),
    
    // 4. Device pixel ratio detection
    devicePixelRatio: window.devicePixelRatio || 1,
    
    // 5. Pointer type detection (modern browsers)
    pointerType: (() => {
      if ('matchMedia' in window) {
        if (window.matchMedia('(pointer: coarse)').matches) return 'touch';
        if (window.matchMedia('(pointer: fine)').matches) return 'mouse';
      }
      return null;
    })(),
    
    // 6. Hover capability detection
    canHover: typeof window !== 'undefined' && window.matchMedia ? 
      window.matchMedia('(hover: hover)').matches : false,
    
    // 7. Screen orientation support
    orientationSupport: 'orientation' in window || 'onorientationchange' in window,
    
    // 8. Viewport size vs screen size comparison
    viewportRatio: (() => {
      if (screen.width && screen.height) {
        const actualWidth = Math.max(window.innerWidth, window.innerHeight);
        const screenWidth = Math.max(screen.width, screen.height);
        return actualWidth / screenWidth;
      }
      return 1;
    })()
  };
  
  // Comprehensive scoring system
  let mobileScore = 0;
  let tabletScore = 0;
  let desktopScore = 0;
  
  // User agent has the highest weight
  if (detectionResults.userAgent === 'mobile') mobileScore += 40;
  else if (detectionResults.userAgent === 'tablet') tabletScore += 40;
  else if (detectionResults.userAgent === null) desktopScore += 20;
  
  // Screen size scoring
  if (detectionResults.screenSize === 'mobile') mobileScore += 30;
  else if (detectionResults.screenSize === 'tablet') tabletScore += 30;
  else if (detectionResults.screenSize === 'desktop') desktopScore += 30;
  
  // Touch support scoring
  if (detectionResults.hasTouchSupport) {
    mobileScore += 15;
    tabletScore += 15;
  } else {
    desktopScore += 25;
  }
  
  // Pointer type scoring
  if (detectionResults.pointerType === 'touch') {
    mobileScore += 10;
    tabletScore += 10;
  } else if (detectionResults.pointerType === 'mouse') {
    desktopScore += 15;
  }
  
  // Hover capability scoring
  if (!detectionResults.canHover) {
    mobileScore += 5;
    tabletScore += 5;
  } else {
    desktopScore += 10;
  }
  
  // Orientation support scoring
  if (detectionResults.orientationSupport) {
    mobileScore += 5;
    tabletScore += 5;
  }
  
  // High pixel density devices are usually mobile devices
  if (detectionResults.devicePixelRatio > 2) {
    mobileScore += 5;
  }
  
  // Return the device type with the highest score
  const maxScore = Math.max(mobileScore, tabletScore, desktopScore);
  if (maxScore === mobileScore) return 'mobile';
  if (maxScore === tabletScore) return 'tablet';
  return 'desktop';
};

// Get client device emoji
const getClientEmoji = (): string => {
  const deviceType = getDeviceType();
  switch (deviceType) {
    case 'mobile': return '📱';
    case 'tablet': return '📱'; // Tablets also use mobile icon since they are touch devices
    case 'desktop': return '💻';
    default: return '💻';
  }
};

interface MetricItem {
  key: string;
  value: string;
}

interface MetricGroup {
  name: string;
  metrics: MetricItem[];
}

// Get webhook-specific metrics with business data
const getWebhookMetrics = (): MetricGroup[] => {
  const clientEmoji = getClientEmoji();
  let webhooks: WebhookConfig[] = [];
  const allRequests: Record<string, WebhookRequest[]> = {};
  let storageSize = 0;
  
  try {
    const storage = getWebhookStorage();
    webhooks = storage.getWebhooks();
    
    // Calculate total requests and storage usage
    for (const webhook of webhooks) {
      const requests = storage.getRequests(webhook.id);
      allRequests[webhook.id] = requests;
    }
    
    storageSize = storage.getStorageSize();
  } catch (error) {
    console.error('Error fetching webhook data:', error);
  }
  
  const totalRequests = Object.values(allRequests).reduce((sum, requests) => sum + requests.length, 0);
  const activeWebhooks = webhooks.filter(w => w.isActive).length;
  const recentRequests = Object.values(allRequests)
    .flat()
    .filter(req => new Date().getTime() - new Date(req.timestamp).getTime() < 60000); // Last minute
  
  const methodStats = Object.values(allRequests)
    .flat()
    .reduce((stats, req) => {
      stats[req.method] = (stats[req.method] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);
  
  const avgResponseSize = Object.values(allRequests)
    .flat()
    .reduce((sum, req) => sum + req.bodySize, 0) / totalRequests || 0;
  
  return [
    {
      name: `${clientEmoji} Webhook Statistics`,
      metrics: [
        { key: 'Total Webhooks', value: webhooks.length.toString() },
        { key: 'Active Webhooks', value: activeWebhooks.toString() },
        { key: 'Inactive Webhooks', value: (webhooks.length - activeWebhooks).toString() },
        { key: 'Total Requests Stored', value: totalRequests.toString() },
        { key: 'Requests (Last Minute)', value: recentRequests.length.toString() },
        { key: 'Average Request Size', value: formatBytes(avgResponseSize) },
        { key: 'Storage Usage', value: formatBytes(storageSize) },
      ]
    },
    {
      name: `${clientEmoji} Request Methods Distribution`,
      metrics: Object.entries(methodStats)
        .sort(([,a], [,b]) => b - a)
        .map(([method, count]) => ({
          key: method,
          value: `${count} requests (${((count / totalRequests) * 100).toFixed(1)}%)`
        }))
    },
    {
      name: `${clientEmoji} Client Cache Distribution`,
      metrics: webhooks.length > 0 ? webhooks.map(webhook => {
        const requests = allRequests[webhook.id]?.length || 0;
        const percentage = totalRequests > 0 ? ((requests / totalRequests) * 100).toFixed(1) : '0';
        return {
          key: `${webhook.name || webhook.id}`,
          value: `${requests} requests (${percentage}%)`
        };
      }) : [{ key: 'No Webhooks', value: 'No webhooks created yet' }]
    },
    {
      name: `${clientEmoji} Webhook Details`,
      metrics: webhooks.length > 0 ? webhooks.map(webhook => ({
        key: `${webhook.name || webhook.id}`,
        value: `${webhook.requestCount} requests, ${webhook.lastRequestAt ? formatRelativeTime(webhook.lastRequestAt) : 'never'}, ${webhook.isActive ? 'Active' : 'Inactive'}`
      })) : [{ key: 'No Webhooks', value: 'No webhooks created yet' }]
    },
    {
      name: `${clientEmoji} Storage Configuration`,
      metrics: [
        { key: 'Local Storage Prefix', value: config.localStoragePrefix },
        { key: 'Session Storage Prefix', value: config.sessionStoragePrefix },
        { key: 'Storage Available', value: typeof Storage !== 'undefined' ? 'Yes' : 'No' },
        { key: 'IndexedDB Available', value: typeof indexedDB !== 'undefined' ? 'Yes' : 'No' },
      ]
    },
    {
      name: `${clientEmoji} Configuration`,
      metrics: [
        { key: 'App Name', value: config.appName },
        { key: 'App Version', value: config.appVersion },
        { key: 'Environment', value: config.isProduction ? 'Production' : 'Development' },
        { key: 'Debug Mode', value: config.debugMode ? 'Enabled' : 'Disabled' },
        { key: 'Max Requests Per Webhook', value: config.maxRequestsPerWebhook.toString() },
        { key: 'Request Retention Hours', value: config.requestRetentionHours.toString() },
        { key: 'Default Poll Interval', value: `${config.pollInterval}ms` },
        { key: 'WebSocket Enabled', value: config.enableWebSocket ? 'Yes' : 'No' },
        { key: 'Notifications Enabled', value: config.enableNotifications ? 'Yes' : 'No' },
        { key: 'Default Theme', value: config.defaultTheme },
      ]
    },
    {
      name: `${clientEmoji} Rate Limiting`,
      metrics: [
        { key: 'Rate Limiting Enabled', value: config.rateLimitEnabled ? 'Yes' : 'No' },
        { key: 'Rate Limit Requests', value: config.rateLimitRequests.toString() },
        { key: 'Rate Limit Window', value: `${config.rateLimitWindow / 1000}s` },
      ]
    }
  ];
};

// Get server cache metrics from the new API endpoint
const getServerCacheMetrics = async (): Promise<MetricGroup[]> => {
  try {
    const response = await fetch('/api/server-stats');
    const data = await response.json() as {
      success: boolean;
      error?: string;
      timestamp?: string;
      storage?: {
        provider: string;
        name: string;
        instance: string;
        health: string;
        details: Record<string, any>;
        distribution?: {
          totalWebhooks: number;
          totalRequests: number;
          webhooksWithRequests: number;
          webhookDistribution: Array<{
            webhookId: string;
            webhookName?: string;
            requestCount: number;
            totalSize: number;
            averageSize: number;
            lastRequestAt?: string;
            isActive: boolean;
            percentage: number;
          }>;
          requestMethodDistribution: Array<{
            method: string;
            count: number;
            percentage: number;
            totalSize: number;
          }>;
          requestSizeDistribution: Array<{
            sizeRange: string;
            count: number;
            percentage: number;
            minSize: number;
            maxSize: number;
          }>;
          timeDistribution: Array<{
            period: string;
            count: number;
            percentage: number;
            timeRange: string;
          }>;
          storageUsage: {
            totalSizeBytes: number;
            averageRequestSize: number;
            largestRequestSize: number;
          };
          performance: {
            totalOperations: number;
            uptime: number;
          };
        };
      };
      storageError?: string;
      server?: {
        uptime: number | string;
        nodeVersion: string;
        platform: string;
        memoryUsage?: {
          rss: number;
          heapUsed: number;
          heapTotal: number;
        };
      };
      environment?: {
        nodeEnv: string;
        isProduction: boolean;
      };
    };
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch server stats');
    }
    
    const serverMetrics: MetricItem[] = [
      { key: 'Server Status', value: '✅ Running' },
      { key: 'Timestamp', value: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A' }
    ];

    if (data.server) {
      const uptime = typeof data.server.uptime === 'number' 
        ? `${Math.floor(data.server.uptime / 60)}m ${Math.floor(data.server.uptime % 60)}s`
        : data.server.uptime;
      
      serverMetrics.push(
        { key: 'Server Uptime', value: uptime },
        { key: 'Node.js Version', value: data.server.nodeVersion },
        { key: 'Platform', value: data.server.platform }
      );

      if (data.server.memoryUsage) {
        serverMetrics.push(
          { key: 'Memory (RSS)', value: `${data.server.memoryUsage.rss}MB` },
          { key: 'Heap Used', value: `${data.server.memoryUsage.heapUsed}MB` },
          { key: 'Heap Total', value: `${data.server.memoryUsage.heapTotal}MB` }
        );
      }
    }

    if (data.environment) {
      serverMetrics.push(
        { key: 'Environment', value: data.environment.nodeEnv },
        { key: 'Production Mode', value: data.environment.isProduction ? 'Yes' : 'No' }
      );
    }

    const storageMetrics: MetricItem[] = [];
    if (data.storage) {
      storageMetrics.push(
        { key: 'Storage Provider', value: data.storage.provider },
        { key: 'Storage Name', value: data.storage.name },
        { key: 'Storage Instance', value: data.storage.instance },
        { key: 'Storage Health', value: data.storage.health === 'healthy' ? '✅ Healthy' : '❌ Unhealthy' }
      );
      
      // Add any additional storage details
      if (data.storage.details && Object.keys(data.storage.details).length > 0) {
        Object.entries(data.storage.details).forEach(([key, value]) => {
          storageMetrics.push({
            key: `Storage ${key}`,
            value: String(value)
          });
        });
      }
    } else if (data.storageError) {
      storageMetrics.push({
        key: 'Storage Error',
        value: data.storageError
      });
    } else {
      storageMetrics.push({
        key: 'Storage Status',
        value: 'Not available'
      });
    }

    const resultMetrics = [
      {
        name: '🌐 Server Cache Analysis (Global)',
        metrics: serverMetrics
      },
      {
        name: '🌐 Storage Provider Information',
        metrics: storageMetrics
      }
    ];

    // Add distribution statistics if available
    if (data.storage?.distribution) {
      const dist = data.storage.distribution;
      
      // Overall statistics
      resultMetrics.push({
        name: '🌐 Server Cache Distribution Overview',
        metrics: [
          { key: 'Total Webhooks', value: dist.totalWebhooks.toString() },
          { key: 'Total Requests', value: dist.totalRequests.toString() },
          { key: 'Webhooks with Requests', value: dist.webhooksWithRequests.toString() },
          { key: 'Total Storage Size', value: formatBytes(dist.storageUsage.totalSizeBytes) },
          { key: 'Average Request Size', value: formatBytes(dist.storageUsage.averageRequestSize) },
          { key: 'Largest Request Size', value: formatBytes(dist.storageUsage.largestRequestSize) },
          { key: 'Total Operations', value: dist.performance.totalOperations.toString() },
          { key: 'Provider Uptime', value: `${Math.floor(dist.performance.uptime / 1000)}s` }
        ]
      });

      // Webhook distribution
      if (dist.webhookDistribution.length > 0) {
        resultMetrics.push({
          name: '🌐 Server Cache Webhook Distribution',
          metrics: dist.webhookDistribution.map(webhook => ({
            key: webhook.webhookName || webhook.webhookId,
            value: `${webhook.requestCount} requests (${webhook.percentage.toFixed(1)}%), ${formatBytes(webhook.totalSize)}, ${webhook.isActive ? 'Active' : 'Inactive'}`
          }))
        });
      }

      // Method distribution
      if (dist.requestMethodDistribution.length > 0) {
        resultMetrics.push({
          name: '🌐 Server Cache Method Distribution',
          metrics: dist.requestMethodDistribution.map(method => ({
            key: method.method,
            value: `${method.count} requests (${method.percentage.toFixed(1)}%), ${formatBytes(method.totalSize)}`
          }))
        });
      }

      // Size distribution
      if (dist.requestSizeDistribution.length > 0) {
        resultMetrics.push({
          name: '🌐 Server Cache Size Distribution',
          metrics: dist.requestSizeDistribution.map(size => ({
            key: size.sizeRange,
            value: `${size.count} requests (${size.percentage.toFixed(1)}%)`
          }))
        });
      }

      // Time distribution
      if (dist.timeDistribution.length > 0) {
        resultMetrics.push({
          name: '🌐 Server Cache Time Distribution',
          metrics: dist.timeDistribution.map(time => ({
            key: time.period,
            value: `${time.count} requests (${time.percentage.toFixed(1)}%)`
          }))
        });
      }
    }
    
    return resultMetrics;
  } catch (error) {
    console.error('Error fetching server cache metrics:', error);
    return [
      {
        name: '🌐 Server Cache Analysis (Global)',
        metrics: [
          { key: 'Status', value: 'Error fetching server data' },
          { key: 'Error', value: error instanceof Error ? error.message : 'Unknown error' }
        ]
      }
    ];
  }
};

// Get API endpoint status and information
const getApiMetrics = (): MetricGroup[] => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'N/A';
  const clientEmoji = getClientEmoji();
  
  return [
    {
      name: `${clientEmoji} API Endpoints`,
      metrics: [
        { key: 'Base URL', value: baseUrl },
        { key: 'Webhook Endpoint', value: `${baseUrl}/api/webhook/[id]` },
        { key: 'Polling Endpoint', value: `${baseUrl}/api/poll/[id]` },
        { key: 'Supported Methods', value: 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS' },
        { key: 'CORS Enabled', value: 'Yes (Allow-Origin: *)' },
        { key: 'Content-Type Support', value: 'JSON, Form Data, Text, Binary' },
      ]
    }
  ];
};

// Get device detection details
const getDeviceDetectionMetrics = (): MetricGroup[] => {
  if (typeof window === 'undefined') return [];
  
  const clientEmoji = getClientEmoji();
  const deviceType = getDeviceType();
  
  // Re-obtain detection results for display
  const detectionInfo = {
    hasTouchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    devicePixelRatio: window.devicePixelRatio || 1,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    screenArea: window.innerWidth * window.innerHeight,
    pointerType: (() => {
      if ('matchMedia' in window) {
        if (window.matchMedia('(pointer: coarse)').matches) return 'coarse (touch)';
        if (window.matchMedia('(pointer: fine)').matches) return 'fine (mouse)';
      }
      return 'unknown';
    })(),
    canHover: typeof window !== 'undefined' && window.matchMedia ? 
      window.matchMedia('(hover: hover)').matches : false,
    orientationSupport: 'orientation' in window || 'onorientationchange' in window,
    platform: navigator.platform || 'unknown'
  };
  
  return [
    {
      name: `${clientEmoji} Device Detection Details`,
      metrics: [
        { key: 'Detected Device Type', value: `${deviceType.toUpperCase()} ${deviceType === 'mobile' ? '📱' : deviceType === 'tablet' ? '📱' : '💻'}` },
        { key: 'Touch Support', value: detectionInfo.hasTouchSupport ? `Yes (${detectionInfo.maxTouchPoints} points)` : 'No' },
        { key: 'Pointer Type', value: detectionInfo.pointerType },
        { key: 'Hover Capability', value: detectionInfo.canHover ? 'Yes' : 'No' },
        { key: 'Orientation Support', value: detectionInfo.orientationSupport ? 'Yes' : 'No' },
        { key: 'Device Pixel Ratio', value: detectionInfo.devicePixelRatio.toString() },
        { key: 'Viewport Size', value: `${detectionInfo.screenWidth}×${detectionInfo.screenHeight}` },
        { key: 'Screen Area', value: `${Math.round(detectionInfo.screenArea / 1000)}K pixels` },
        { key: 'Platform', value: detectionInfo.platform },
      ]
    }
  ];
};

// Get webhook runtime metrics
const getWebhookRuntimeMetrics = (): MetricGroup[] => {
  const now = new Date();
  const clientEmoji = getClientEmoji();
  
  return [
    {
      name: `${clientEmoji} Runtime Status`,
      metrics: [
        { key: 'Current Time', value: now.toLocaleString() },
        { key: 'User Agent', value: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A' },
        { key: 'Page Load Time', value: typeof performance !== 'undefined' ? `${Math.round(Date.now() - performance.timeOrigin)}ms` : 'N/A' },
        { key: 'Memory Usage', value: typeof (performance as unknown as { memory?: { usedJSHeapSize: number } })?.memory !== 'undefined' ? 
          `${Math.round(((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1024 / 1024))}MB` : 'N/A' },
      ]
    }
  ];
};



const MetricTable = ({ group }: { group: MetricGroup }) => {
  if (!group || !group.metrics || !Array.isArray(group.metrics)) {
    return null;
  }

  return (
    <details open>
      <summary style={{ color: '#333' }}><strong>{group.name}</strong> ({group.metrics.length} items)</summary>
      <table border={1} cellSpacing={0} style={{ 
        borderCollapse: 'collapse', 
        width: '100%', 
        tableLayout: 'fixed',
        fontSize: '13px'
      }}>
        <tbody>
          {group.metrics.map((metric, index) => (
            <tr key={index}>
              <td style={{ 
                border: '1px solid #000', 
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                textAlign: 'left',
                verticalAlign: 'top',
                width: '33.33%',
                minWidth: '0',
                color: '#555',
                padding: '2px'
              }}><strong>{metric.key}</strong></td>
              <td style={{ 
                border: '1px solid #000',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                width: '66.67%',
                minWidth: '0',
                color: '#666',
                padding: '2px'
              }}><code>{metric.value}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
};

export default function InspectPage() {
  const [webhookMetrics, setWebhookMetrics] = useState<MetricGroup[]>([]);
  const [apiMetrics, setApiMetrics] = useState<MetricGroup[]>([]);
  const [serverMetrics, setServerMetrics] = useState<MetricGroup[]>([]);
  const [connectionMetrics, setConnectionMetrics] = useState<MetricItem[]>([
    { key: 'Connection Status', value: 'Checking...' },
    { key: 'Last Poll', value: 'N/A' },
    { key: 'Response Time', value: 'N/A' },
  ]);
  const [runtimeMetrics, setRuntimeMetrics] = useState<MetricGroup[]>([]);
  const [deviceDetectionMetrics, setDeviceDetectionMetrics] = useState<MetricGroup[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Real-time connection check effect
  useEffect(() => {
    const checkConnection = async () => {
      const startTime = performance.now();
      try {
        const testWebhookId = 'test123';
        const response = await fetch(`/api/poll/${testWebhookId}`);
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        const data = await response.json() as { rateLimited?: boolean };
        
        setConnectionMetrics([
          { key: 'Connection Status', value: response.ok ? 'Connected' : 'Disconnected' },
          { key: 'Last Poll', value: new Date().toLocaleTimeString() },
          { key: 'Response Time', value: `${responseTime}ms` },
          { key: 'HTTP Status', value: response.status.toString() },
          { key: 'Rate Limited', value: data.rateLimited ? 'Yes' : 'No' },
        ]);
      } catch (error) {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        setConnectionMetrics([
          { key: 'Connection Status', value: 'Error' },
          { key: 'Error', value: error instanceof Error ? error.message : 'Unknown error' },
          { key: 'Last Poll', value: new Date().toLocaleTimeString() },
          { key: 'Response Time', value: `${responseTime}ms` },
        ]);
      }
    };

    if (isClient) {
      checkConnection();
      const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isClient]);

  useEffect(() => {
    setIsClient(true);
    
    try {
      const webhookData = getWebhookMetrics();
      setWebhookMetrics(Array.isArray(webhookData) ? webhookData : []);
    } catch (error) {
      console.error('Error fetching webhook metrics:', error);
      setWebhookMetrics([]);
    }
    
    try {
      const apiData = getApiMetrics();
      setApiMetrics(Array.isArray(apiData) ? apiData : []);
    } catch (error) {
      console.error('Error fetching API metrics:', error);
      setApiMetrics([]);
    }
    
    // Fetch server metrics
    getServerCacheMetrics().then(serverData => {
      setServerMetrics(Array.isArray(serverData) ? serverData : []);
    }).catch(error => {
      console.error('Error fetching server metrics:', error);
      setServerMetrics([]);
    });
    
    try {
      const runtimeData = getWebhookRuntimeMetrics();
      setRuntimeMetrics(Array.isArray(runtimeData) ? runtimeData : []);
    } catch (error) {
      console.error('Error fetching runtime metrics:', error);
      setRuntimeMetrics([]);
    }
    
    try {
      const deviceData = getDeviceDetectionMetrics();
      setDeviceDetectionMetrics(Array.isArray(deviceData) ? deviceData : []);
    } catch (error) {
      console.error('Error fetching device detection metrics:', error);
      setDeviceDetectionMetrics([]);
    }
  }, []);

  return (
    <div>
      {/* Client information (dynamic device type detection) */}
      {webhookMetrics.filter(group => group && group.metrics).map((group, index) => (
        <MetricTable key={index} group={group} />
      ))}
      
      <MetricTable group={{
        name: `${isClient ? getClientEmoji() : '📱'} Real-time Connection`,
        metrics: connectionMetrics
      }} />

      {runtimeMetrics.filter(group => group && group.metrics).map((group, index) => (
        <MetricTable key={index} group={group} />
      ))}

      {deviceDetectionMetrics.filter(group => group && group.metrics).map((group, index) => (
        <MetricTable key={index} group={group} />
      ))}

      {apiMetrics.filter(group => group && group.metrics).map((group, index) => (
        <MetricTable key={index} group={group} />
      ))}

      {/* Server-side information 🌐 */}
      {serverMetrics.filter(group => group && group.metrics).map((group, index) => (
        <MetricTable key={index} group={group} />
      ))}

      <hr />
      <p><small>
        <strong>Note:</strong> This page displays real client-side webhook information for debugging and monitoring purposes. 
        All metrics are based on actual data from your browser&apos;s local storage and real API calls.
        Connection status is checked every 10 seconds with actual API polling.
        No simulated or fake data is shown.
        Refresh the browser page to update the metrics.
      </small></p>
    </div>
  );
} 