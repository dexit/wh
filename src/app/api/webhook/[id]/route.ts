// Webhook receiver API route - handles all HTTP methods

import { NextRequest, NextResponse } from 'next/server';
import { generateId } from '@/lib/utils';
import { getStorageManager } from '@/lib/storage/storage-manager';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { WebhookRequest } from '@/types/webhook';



// Helper function to extract client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return 'unknown';
}

// Helper function to parse request body safely
async function parseRequestBody(request: NextRequest): Promise<string> {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const json = await request.json();
      return JSON.stringify(json, null, 2);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      const formObject: Record<string, string | File> = {};
      for (const [key, value] of formData.entries()) {
        formObject[key] = value;
      }
      return JSON.stringify(formObject, null, 2);
    } else {
      const text = await request.text();
      return text;
    }
  } catch (error) {
    console.error('Error parsing request body:', error);
    return '[Error parsing body]';
  }
}

// Helper function to convert headers to plain object
function headersToObject(headers: Headers): Record<string, string> {
  const headerObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerObj[key] = value;
  });
  return headerObj;
}

// Helper function to parse query parameters
function parseQueryParams(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

// Main handler function for all HTTP methods
async function handleRequest(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: webhookId } = await context.params;
  const method = request.method;
  const url = new URL(request.url);
  
  // Validate webhook ID format
  if (!/^[a-zA-Z0-9]{6,12}$/.test(webhookId)) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid webhook ID format',
        webhookId,
        timestamp: new Date().toISOString()
      },
      { status: 400 }
    );
  }

  try {
    // Parse request data
    const headers = headersToObject(request.headers);
    const queryParams = parseQueryParams(url);
    const body = await parseRequestBody(request);
    const ip = getClientIP(request);
    const userAgent = headers['user-agent'] || 'unknown';
    const contentType = headers['content-type'] || 'unknown';
    
    // Calculate body size
    const bodySize = new TextEncoder().encode(body).length;
    
    // Create webhook request object
    const webhookRequest: WebhookRequest = {
      id: generateId(),
      webhookId,
      method,
      path: url.pathname,
      headers,
      body,
      queryParams,
      timestamp: new Date(),
      ip,
      userAgent,
      contentType,
      bodySize,
    };

    // Store request using storage manager only
    try {
      const cloudflareContext = getCloudflareContext();
      
      const storageManager = await getStorageManager(cloudflareContext);
      
      await storageManager.saveRequest(webhookId, webhookRequest);
      
    } catch (storageError) {
      console.error(`Webhook ${webhookId}: Failed to save to storage:`, storageError);
      
      // Check if this is a D1-specific error and provide detailed information
      if (storageError instanceof Error && 'provider' in storageError && (storageError as any).provider === 'd1') {
        const d1Error = storageError as any; // StorageError with D1 details
        return NextResponse.json(
          {
            success: false,
            error: 'D1 Database Configuration Error',
            webhookId,
            method,
            timestamp: new Date().toISOString(),
            message: d1Error.message,
            storageError: {
              provider: 'd1',
              type: d1Error.details?.isBindingError ? 'binding_error' : 'initialization_error',
              details: d1Error.details?.configurationHelp || null
            }
          },
          { 
            status: 503, // Service Unavailable due to configuration issue
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        );
      }
      
      // Return generic error for other storage failures
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save webhook request',
          webhookId,
          method,
          timestamp: new Date().toISOString(),
          message: 'Storage system unavailable'
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

    console.log(`Webhook ${webhookId} received ${method} request from ${ip}`);

    // Return success response with request details
    return NextResponse.json(
      {
        success: true,
        message: 'Webhook request received successfully',
        webhook: {
          id: webhookId,
          method,
          timestamp: webhookRequest.timestamp,
          requestId: webhookRequest.id,
        },
        request: {
          method,
          path: url.pathname,
          contentType,
          bodySize,
          timestamp: webhookRequest.timestamp,
        },
        debug: {
          headers: Object.keys(headers).length,
          queryParams: Object.keys(queryParams).length,
          userAgent: userAgent.slice(0, 100), // Truncate for response
        }
      },
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        }
      }
    );

  } catch (error) {
    console.error('Error processing webhook request:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while processing webhook',
        webhookId,
        method,
        timestamp: new Date().toISOString(),
        message: 'Your request was received but could not be processed completely'
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

// Export handlers for all HTTP methods
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRequest(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRequest(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRequest(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRequest(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRequest(request, context);
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRequest(request, context);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function OPTIONS(_request: NextRequest, _context: { params: Promise<{ id: string }> }) {
  // Handle CORS preflight
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}
