// API endpoint for deleting individual webhook requests

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getStorageManager } from '@/lib/storage/storage-manager';
import { isValidWebhookId } from '@/lib/utils';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; requestId: string }> }
) {
  const { id: webhookId, requestId } = await context.params;
  
  // Validate webhook ID format
  if (!isValidWebhookId(webhookId)) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid webhook ID format' 
      }, 
      { status: 400 }
    );
  }

  // Validate request ID
  if (!requestId || typeof requestId !== 'string' || requestId.trim() === '') {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid request ID' 
      }, 
      { status: 400 }
    );
  }

  try {
    // Get Cloudflare context for OpenNext
    const cloudflareContext = getCloudflareContext();
    
    // Get storage manager
    const storageManager = await getStorageManager(cloudflareContext);
    const providerInfo = storageManager.getProviderInfo();
    
    console.log(`Delete request ${requestId} from webhook ${webhookId} using ${providerInfo.name}`);
    
    // Delete request from storage
    const success = await storageManager.deleteRequest(webhookId, requestId);
    
    if (success) {
      console.log(`Successfully deleted request ${requestId} from webhook ${webhookId}`);
      return NextResponse.json({
        success: true,
        message: 'Request deleted successfully',
        webhookId,
        requestId
      });
    } else {
      console.log(`Request ${requestId} not found in webhook ${webhookId}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Request not found',
          webhookId,
          requestId
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error(`Error deleting request ${requestId} from webhook ${webhookId}:`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete request',
        message: error instanceof Error ? error.message : 'Unknown error',
        webhookId,
        requestId
      },
      { status: 500 }
    );
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 