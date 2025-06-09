// Polling API to get webhook requests from storage manager only

import { NextRequest, NextResponse } from 'next/server';
import { getStorageManager } from '@/lib/storage/storage-manager';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Rate limiting: minimum 1 second interval per webhook
const lastPollTime = new Map<string, number>();
const MIN_POLL_INTERVAL = 1000; // 1 second in milliseconds

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: webhookId } = await context.params;
  
  // Validate webhook ID format
  if (!/^[a-zA-Z0-9]{6,12}$/.test(webhookId)) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid webhook ID format',
        requests: []
      },
      { status: 400 }
    );
  }

  // Rate limiting check
  const now = Date.now();
  const lastPoll = lastPollTime.get(webhookId) || 0;
  const timeSinceLastPoll = now - lastPoll;

  if (timeSinceLastPoll < MIN_POLL_INTERVAL) {
    // For rate limiting, get cached result from storage manager
    let requests: any[] = [];
    try {
      const cloudflareContext = getCloudflareContext();
      const storageManager = await getStorageManager(cloudflareContext);
      requests = await storageManager.getRequests(webhookId, 100);
    } catch (error) {
      console.warn('Storage failed during rate limiting:', error);
      
      // If it's a D1 configuration error during rate limiting, still return early failure
      if (error instanceof Error && 'provider' in error && (error as any).provider === 'd1') {
        const d1Error = error as any;
        return NextResponse.json(
          {
            success: false,
            error: 'D1 Database Configuration Error',
            webhookId,
            requests: [],
            timestamp: new Date().toISOString(),
            message: d1Error.message,
            storageError: {
              provider: 'd1',
              type: d1Error.details?.isBindingError ? 'binding_error' : 'initialization_error',
              details: d1Error.details?.configurationHelp || null
            }
          },
          { 
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        );
      }
      
      requests = []; // Return empty array if storage fails
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-RateLimit-Limit': '1',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil((MIN_POLL_INTERVAL - timeSinceLastPoll) / 1000)),
    };

    return NextResponse.json(
      {
        success: true,
        webhookId,
        count: requests.length,
        requests,
        timestamp: new Date().toISOString(),
        rateLimited: true,
        retryAfter: Math.ceil((MIN_POLL_INTERVAL - timeSinceLastPoll) / 1000),
      },
      { 
        status: 200,
        headers 
      }
    );
  }

  // Update last poll time
  lastPollTime.set(webhookId, now);

  try {
    // Get requests from storage manager only
    let requests: any[] = [];
    
    try {
      // Get Cloudflare context for OpenNext
      const cloudflareContext = getCloudflareContext();
      
      const storageManager = await getStorageManager(cloudflareContext);
      const providerInfo = storageManager.getProviderInfo();
      
      console.log(`Poll ${webhookId}: Using storage provider: ${providerInfo.name} (${providerInfo.type})`);
      
      // Get requests from storage (works with all provider types)
      requests = await storageManager.getRequests(webhookId, 100);
      console.log(`Poll ${webhookId}: Retrieved ${requests.length} requests from ${providerInfo.name}`);
      
    } catch (storageError) {
      console.error(`Failed to fetch from storage:`, storageError);
      
      // Check if this is a D1-specific error and provide detailed information
      if (storageError instanceof Error && 'provider' in storageError && (storageError as any).provider === 'd1') {
        const d1Error = storageError as any; // StorageError with D1 details
        return NextResponse.json(
          {
            success: false,
            error: 'D1 Database Configuration Error',
            webhookId,
            requests: [],
            timestamp: new Date().toISOString(),
            message: d1Error.message,
            storageError: {
              provider: 'd1',
              type: d1Error.details?.isBindingError ? 'binding_error' : 'initialization_error',
              details: d1Error.details?.configurationHelp || null
            }
          },
          { 
            status: 200, // Return 200 so the client can handle the error properly
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        );
      }
      
      // Return empty requests if storage fails
      requests = [];
    }
    
    // Sort by timestamp (newest first)
    requests = requests
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100); // Limit to 100 most recent requests
    
    // Add CORS headers for cross-origin requests
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-RateLimit-Limit': '1',
      'X-RateLimit-Remaining': String(Math.floor((MIN_POLL_INTERVAL - (Date.now() - now)) / MIN_POLL_INTERVAL)),
      'X-RateLimit-Reset': String(Math.ceil(MIN_POLL_INTERVAL / 1000)),
    };

    return NextResponse.json(
      {
        success: true,
        webhookId,
        count: requests.length,
        requests,
        timestamp: new Date().toISOString(),
        rateLimited: false,
      },
      { 
        status: 200,
        headers 
      }
    );

  } catch (error) {
    console.error('Error fetching webhook requests:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch webhook requests',
        webhookId,
        requests: [],
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