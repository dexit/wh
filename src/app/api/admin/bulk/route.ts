// Bulk Operations API endpoint
// Handles bulk administrative operations

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDispatcher } from '@/lib/admin/admin-dispatcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, targets, parameters } = body;

    // Validate required fields
    if (!type || !targets || !Array.isArray(targets)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: type and targets (array)' 
        },
        { status: 400 }
      );
    }

    if (targets.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Targets array cannot be empty' 
        },
        { status: 400 }
      );
    }

    // Get admin dispatcher
    const dispatcher = getAdminDispatcher();

    // Execute bulk operation
    const operationId = await dispatcher.executeBulkOperation({
      type,
      targets,
      parameters: parameters || {}
    });

    return NextResponse.json({
      success: true,
      data: {
        operationId,
        status: 'started',
        targets: targets.length
      }
    });

  } catch (error) {
    console.error('Bulk operation failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute bulk operation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get('operationId');
    const status = searchParams.get('status');

    const dispatcher = getAdminDispatcher();

    if (operationId) {
      // Get specific bulk operation
      const operation = dispatcher.getBulkOperation(operationId);
      if (!operation) {
        return NextResponse.json(
          { success: false, error: 'Bulk operation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: operation
      });
    } else {
      // Get all bulk operations with optional filtering
      let operations = dispatcher.getAllBulkOperations();

      if (status) {
        operations = operations.filter(op => op.status === status);
      }

      // Sort by creation time (newest first)
      operations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return NextResponse.json({
        success: true,
        data: {
          operations,
          total: operations.length
        }
      });
    }

  } catch (error) {
    console.error('Failed to get bulk operations:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get bulk operations',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}