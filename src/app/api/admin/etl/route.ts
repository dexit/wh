// ETL Jobs API endpoint
// Handles ETL job creation and management

import { NextRequest, NextResponse } from 'next/server';
import { getETLEngine } from '@/lib/etl/etl-engine';
import { generateId } from '@/lib/utils';
import type { ETLJobDTO } from '@/types/dto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, webhookId, filters, transformations, destination, schedule } = body;

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: name and type' 
        },
        { status: 400 }
      );
    }

    // Create ETL job
    const job: ETLJobDTO = {
      id: generateId(),
      name,
      type,
      status: 'pending',
      webhookId,
      filters,
      transformations,
      destination,
      schedule,
      createdAt: new Date().toISOString(),
      metadata: {
        createdBy: 'admin',
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      }
    };

    const etlEngine = getETLEngine();
    
    // Store job (in a real implementation, this would be persisted)
    (etlEngine as any).jobs.set(job.id, job);

    // If it's a one-time job, execute immediately
    if (!schedule || schedule.type === 'once') {
      etlEngine.executeJob(job).catch(error => {
        console.error(`ETL job ${job.id} execution failed:`, error);
      });
    }

    return NextResponse.json({
      success: true,
      data: job
    });

  } catch (error) {
    console.error('ETL job creation failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create ETL job',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const etlEngine = getETLEngine();

    if (jobId) {
      // Get specific job
      const job = etlEngine.getJob(jobId);
      if (!job) {
        return NextResponse.json(
          { success: false, error: 'ETL job not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: job
      });
    } else {
      // Get all jobs with optional filtering
      let jobs = etlEngine.getAllJobs();

      if (status) {
        jobs = jobs.filter(job => job.status === status);
      }

      if (type) {
        jobs = jobs.filter(job => job.type === type);
      }

      // Sort by creation time (newest first)
      jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return NextResponse.json({
        success: true,
        data: {
          jobs,
          total: jobs.length
        }
      });
    }

  } catch (error) {
    console.error('Failed to get ETL jobs:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get ETL jobs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle job control operations
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, action } = body;

    if (!jobId || !action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: jobId and action' 
        },
        { status: 400 }
      );
    }

    const etlEngine = getETLEngine();
    const job = etlEngine.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'ETL job not found' },
        { status: 404 }
      );
    }

    let result: any;

    switch (action) {
      case 'start':
        if (job.status !== 'pending') {
          return NextResponse.json(
            { success: false, error: 'Job is not in pending status' },
            { status: 400 }
          );
        }
        etlEngine.executeJob(job).catch(error => {
          console.error(`ETL job ${jobId} execution failed:`, error);
        });
        result = { action: 'started', jobId };
        break;

      case 'cancel':
        const cancelled = etlEngine.cancelJob(jobId);
        if (!cancelled) {
          return NextResponse.json(
            { success: false, error: 'Job could not be cancelled' },
            { status: 400 }
          );
        }
        result = { action: 'cancelled', jobId };
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('ETL job control failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to control ETL job',
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
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}