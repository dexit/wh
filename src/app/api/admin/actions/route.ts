// Admin Actions API endpoint
// Handles administrative operations and dispatching

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDispatcher } from '@/lib/admin/admin-dispatcher';
import type { AdminActionDTO } from '@/types/dto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, action, targetId, parameters, userId } = body;

    // Validate required fields
    if (!type || !action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: type and action' 
        },
        { status: 400 }
      );
    }

    // Get admin dispatcher
    const dispatcher = getAdminDispatcher();

    // Dispatch action
    const actionId = await dispatcher.dispatch({
      type,
      action,
      targetId,
      parameters: parameters || {},
      userId,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        actionId,
        status: 'dispatched'
      }
    });

  } catch (error) {
    console.error('Admin action dispatch failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to dispatch admin action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('actionId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const dispatcher = getAdminDispatcher();

    if (actionId) {
      // Get specific action
      const action = dispatcher.getAction(actionId);
      if (!action) {
        return NextResponse.json(
          { success: false, error: 'Action not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: action
      });
    } else {
      // Get all actions with optional filtering
      let actions = dispatcher.getAllActions();

      if (status) {
        actions = actions.filter(action => action.status === status);
      }

      if (type) {
        actions = actions.filter(action => action.type === type);
      }

      // Sort by timestamp (newest first)
      actions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return NextResponse.json({
        success: true,
        data: {
          actions,
          total: actions.length
        }
      });
    }

  } catch (error) {
    console.error('Failed to get admin actions:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get admin actions',
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