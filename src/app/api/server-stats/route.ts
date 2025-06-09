// Server statistics API - provides system health and storage information

import { NextRequest, NextResponse } from 'next/server';
import { getStorageManager } from '@/lib/storage/storage-manager';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
  try {
    // Get storage manager statistics
    let storageStats = null;
    let storageError = null;
    
    try {
      const cloudflareContext = getCloudflareContext();
      const storageManager = await getStorageManager(cloudflareContext);
      const providerInfo = storageManager.getProviderInfo();
      const isHealthy = await storageManager.isHealthy();
      
      // Get detailed storage statistics
      let distributionStats = null;
      try {
        distributionStats = await storageManager.getStats();
      } catch (statsError) {
        console.warn('Failed to get storage distribution stats:', statsError);
      }
      
      storageStats = {
        provider: providerInfo.type,
        name: providerInfo.name,
        instance: providerInfo.instance,
        health: isHealthy ? 'healthy' : 'unhealthy',
        details: providerInfo.details || {},
        distribution: distributionStats
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      
      // Check if this is a D1-specific error and provide detailed information
      if (error instanceof Error && 'provider' in error && (error as any).provider === 'd1') {
        const d1Error = error as any; // StorageError with D1 details
        storageError = {
          provider: 'd1',
          type: d1Error.details?.isBindingError ? 'binding_error' : 'initialization_error',
          message: d1Error.message,
          details: d1Error.details?.configurationHelp || null
        };
      } else {
        storageError = error instanceof Error ? error.message : 'Unknown storage error';
      }
    }
    
    const stats = {
      success: true,
      timestamp: new Date().toISOString(),
      storage: storageStats,
      storageError,
      server: {
        uptime: process.uptime ? process.uptime() : 'unknown',
        nodeVersion: process.version || 'unknown',
        platform: process.platform || 'unknown',
        memoryUsage: process.memoryUsage ? {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        } : null,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        isProduction: process.env.NODE_ENV === 'production',
      }
    };

    return NextResponse.json(stats, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error generating server stats:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate server statistics',
        timestamp: new Date().toISOString(),
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
} 