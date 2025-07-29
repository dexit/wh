// src/app/api/webhook/[...params]/route.ts

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
async function handleRequest(
  request: NextRequest,
  context: { params: { params?: string[] } }
) {
  const allSegments = context.params?.params || [];
  if (allSegments.length < 1) {
    return NextResponse.json(
      { success: false, error: 'Missing webhook ID', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }
  const webhookId = allSegments[0];
  const extraPath = allSegments.slice(1);

  // Validate webhook ID format (adjust pattern if necessary)
  if (!/^[a-zA-Z0-9]{6,32}$/.test(webhookId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid webhook ID format', webhookId, timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const method = request.method;
  const url = new URL(request.url);

  try {
    // Parse request data
    const headers = headersToObject(request.headers);
    const queryParams = parseQueryParams(url);
    const body = await parseRequestBody(request);
    const ip = getClientIP(request);
    const userAgent = headers['user-agent'] || 'unknown';
    const contentType = headers['content-type'] || 'unknown';
    const bodySize = new TextEncoder().encode(body).length;

    const webhookRequest: WebhookRequest = {
      id: generateId(),
      webhookId,
      method,
      path: '/' + allSegments.join('/'),
      extraPath: extraPath.length ? extraPath : undefined,
      headers,
      body,
      queryParams,
      timestamp: new Date(),
      ip,
      userAgent,
      contentType,
      bodySize,
    };

    try {
      const cloudflareContext = getCloudflareContext();
      const storageManager = await getStorageManager(cloudflareContext);
      await storageManager.saveRequest(webhookId, webhookRequest);
    } catch (storageError) {
      console.error(`Webhook ${webhookId}: Failed to save to storage:`, storageError);
      if (storageError instanceof Error && 'provider' in storageError && (storageError as any).provider === 'd1') {
        const d1Error = storageError as any;
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
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        );
      }
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

    return NextResponse.json(
      {
        success: true,
        message: 'Webhook request received successfully',
        webhook: {
          id: webhookId,
          method,
          timestamp: webhookRequest.timestamp,
          requestId: webhookRequest.id,
          extraPath,
        },
        request: {
          method,
          path: webhookRequest.path,
          contentType,
          bodySize,
          timestamp: webhookRequest.timestamp,
        },
        debug: {
          headers: Object.keys(headers).length,
          queryParams: Object.keys(queryParams).length,
          userAgent: userAgent.slice(0, 100),
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
export async function GET(request: NextRequest, context: { params: { params?: string[] } }) {
  return handleRequest(request, context);
}
export async function POST(request: NextRequest, context: { params: { params?: string[] } }) {
  return handleRequest(request, context);
}
export async function PUT(request: NextRequest, context: { params: { params?: string[] } }) {
  return handleRequest(request, context);
}
export async function DELETE(request: NextRequest, context: { params: { params?: string[] } }) {
  return handleRequest(request, context);
}
export async function PATCH(request: NextRequest, context: { params: { params?: string[] } }) {
  return handleRequest(request, context);
}
export async function HEAD(request: NextRequest, context: { params: { params?: string[] } }) {
  return handleRequest(request, context);
}
export async function OPTIONS(_request: NextRequest, _context: { params: { params?:  string[] } }) {
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
