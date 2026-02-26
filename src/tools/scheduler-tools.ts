/**
 * Scheduler Tools
 * Tools for managing scheduled jobs (posts, reminders, tasks)
 */

import { Tool, ToolResult } from './types.js';
import { scheduler, Scheduler } from '../scheduler/index.js';

// ============ Schedule Reminder ============
export const scheduleReminderTool: Tool = {
  name: 'schedule_reminder',
  description: 'Set a reminder that will be sent via Telegram. Supports one-shot ("in 20 minutes", "at 3pm") and recurring ("every day at 9am").',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Reminder message' },
      when: { 
        type: 'string', 
        description: 'When to remind. One-shot: "in 20 minutes", "at 3pm", "tomorrow at 9am". Recurring: "every hour", "every day at 9am".' 
      },
      syncToCalendar: {
        type: 'boolean',
        description: 'Whether to sync this reminder to Google Calendar. Defaults to true if Calendar is connected.'
      },
    },
    required: ['message', 'when'],
  },

  async execute(params): Promise<ToolResult> {
    // Check if it's a one-shot schedule
    if (Scheduler.isOneShot(params.when)) {
      const executeAt = Scheduler.parseToTimestamp(params.when);
      
      if (!executeAt) {
        return {
          success: false,
          message: `Could not parse schedule "${params.when}".`,
        };
      }

      const job = await scheduler.addJob({
        name: 'Reminder',
        description: params.message.slice(0, 100),
        executeAt,
        oneShot: true,
        deleteAfterRun: true,
        type: 'reminder',
        enabled: true,
        syncToCalendar: params.syncToCalendar,
        payload: {
          content: params.message,
        },
      });

      const scheduledTime = new Date(executeAt).toLocaleString();
      return {
        success: true,
        message: `⏰ Reminder set for ${scheduledTime}`,
        data: { jobId: job.id, executeAt, oneShot: true },
      };
    }

    // Recurring schedule
    const cronExpression = Scheduler.parseToCron(params.when);
    
    if (!cronExpression) {
      return {
        success: false,
        message: `Could not parse schedule "${params.when}".`,
      };
    }

    const job = await scheduler.addJob({
      name: 'Reminder',
      description: params.message.slice(0, 100),
      cronExpression,
      type: 'reminder',
      enabled: true,
      syncToCalendar: params.syncToCalendar,
      payload: {
        content: params.message,
      },
    });

    return {
      success: true,
      message: `🔁 Recurring reminder set (${params.when}). Job ID: ${job.id}`,
      data: { jobId: job.id, schedule: cronExpression, recurring: true },
    };
  },
};

// ============ List Jobs ============
export const listJobsTool: Tool = {
  name: 'list_scheduled_jobs',
  description: 'List all scheduled jobs (posts, reminders, tasks)',
  parameters: {
    type: 'object',
    properties: {
      type: { 
        type: 'string', 
        enum: ['post', 'reminder', 'task', 'heartbeat'],
        description: 'Filter by job type' 
      },
      productId: { type: 'string', description: 'Filter by product' },
    },
  },

  async execute(params): Promise<ToolResult> {
    const jobs = scheduler.listJobs({
      type: params?.type,
      productId: params?.productId,
    });

    if (jobs.length === 0) {
      return {
        success: true,
        message: 'No scheduled jobs found.',
        data: [],
      };
    }

    const summary = jobs.map(j => ({
      id: j.id,
      name: j.name,
      type: j.type,
      schedule: j.oneShot 
        ? `one-shot at ${new Date(j.executeAt!).toLocaleString()}`
        : j.cronExpression,
      oneShot: j.oneShot || false,
      enabled: j.enabled,
      nextRun: j.nextRun ? new Date(j.nextRun).toLocaleString() : null,
      lastRun: j.lastRun ? new Date(j.lastRun).toISOString() : null,
      runCount: j.runCount,
      content: j.payload.content?.slice(0, 50),
    }));

    return {
      success: true,
      message: `Found ${jobs.length} scheduled job(s).`,
      data: summary,
    };
  },
};

// ============ Cancel Job ============
export const cancelJobTool: Tool = {
  name: 'cancel_scheduled_job',
  description: 'Cancel and delete a scheduled job',
  parameters: {
    type: 'object',
    properties: {
      jobId: { type: 'string', description: 'Job ID to cancel' },
    },
    required: ['jobId'],
  },

  async execute(params): Promise<ToolResult> {
    const removed = await scheduler.removeJob(params.jobId);
    
    return removed
      ? { success: true, message: `Job ${params.jobId} cancelled.` }
      : { success: false, message: `Job ${params.jobId} not found.` };
  },
};

// ============ Pause Job ============
export const pauseJobTool: Tool = {
  name: 'pause_scheduled_job',
  description: 'Pause a scheduled job (can resume later)',
  parameters: {
    type: 'object',
    properties: {
      jobId: { type: 'string', description: 'Job ID to pause' },
    },
    required: ['jobId'],
  },

  async execute(params): Promise<ToolResult> {
    const success = await scheduler.disableJob(params.jobId);
    
    return success
      ? { success: true, message: `Job ${params.jobId} paused.` }
      : { success: false, message: `Job ${params.jobId} not found.` };
  },
};

// ============ Resume Job ============
export const resumeJobTool: Tool = {
  name: 'resume_scheduled_job',
  description: 'Resume a paused job',
  parameters: {
    type: 'object',
    properties: {
      jobId: { type: 'string', description: 'Job ID to resume' },
    },
    required: ['jobId'],
  },

  async execute(params): Promise<ToolResult> {
    const success = await scheduler.enableJob(params.jobId);
    
    return success
      ? { success: true, message: `Job ${params.jobId} resumed.` }
      : { success: false, message: `Job ${params.jobId} not found.` };
  },
};

// ============ Run Job Now ============
export const runJobNowTool: Tool = {
  name: 'run_job_now',
  description: 'Execute a scheduled job immediately (outside its normal schedule)',
  parameters: {
    type: 'object',
    properties: {
      jobId: { type: 'string', description: 'Job ID to run' },
    },
    required: ['jobId'],
  },

  async execute(params): Promise<ToolResult> {
    const success = await scheduler.runNow(params.jobId);
    
    return success
      ? { success: true, message: `Job ${params.jobId} executed.` }
      : { success: false, message: `Job ${params.jobId} not found.` };
  },
};

// ============ Schedule Automated Task ============
export const scheduleTaskTool: Tool = {
  name: 'schedule_task',
  description: `Schedule any automated task for the AI to execute. Supports both one-shot ("in 20 minutes", "at 3pm", "tonight at 2am") and recurring ("every hour", "every day at 9am").

Use this for: social media posts, emails, reports, research, inbox checks, etc. The AI will use tools to complete the task.

Examples:
- "in 2 hours" → one-shot, runs once then auto-deletes
- "tonight at 2am" → one-shot overnight task
- "every day at 9am" → recurring daily`,
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name for this task (e.g., "Competitor Research")' },
      task: { 
        type: 'string', 
        description: 'What the AI should do (e.g., "Research top 5 competitors and summarize their positioning")' 
      },
      when: { 
        type: 'string', 
        description: 'When to run. One-shot: "in 20 minutes", "at 3pm", "tonight at 2am", "tomorrow at 9am". Recurring: "every hour", "every day at 9am".' 
      },
      productId: { type: 'string', description: 'Product context for the task (optional)' },
      campaignId: { type: 'string', description: 'Campaign context for the task (optional)' },
      notify: { 
        type: 'boolean', 
        description: 'Whether to send notification when task completes (default: true)' 
      },
      syncToCalendar: {
        type: 'boolean',
        description: 'Whether to sync this task to Google Calendar. Defaults to true if Calendar is connected. Set to false for high-frequency or internal tasks.'
      },
    },
    required: ['name', 'task', 'when'],
  },

  async execute(params): Promise<ToolResult> {
    // Check if it's a one-shot schedule
    if (Scheduler.isOneShot(params.when)) {
      const executeAt = Scheduler.parseToTimestamp(params.when);
      
      if (!executeAt) {
        return {
          success: false,
          message: `Could not parse schedule "${params.when}". Try "in 20 minutes", "at 3pm", "tonight at 2am", etc.`,
        };
      }

      const job = await scheduler.addJob({
        name: params.name,
        description: params.task.slice(0, 200),
        executeAt,
        oneShot: true,
        deleteAfterRun: true,
        type: 'task',
        enabled: true,
        syncToCalendar: params.syncToCalendar,
        payload: {
          content: params.task,
          productId: params.productId,
          campaignId: params.campaignId,
          metadata: { 
            notify: params.notify !== false,
          },
        },
      });

      const scheduledTime = new Date(executeAt).toLocaleString();
      return {
        success: true,
        message: `⏰ Task "${params.name}" scheduled for ${scheduledTime}. I'll notify you when it's done.`,
        data: { 
          jobId: job.id, 
          name: params.name,
          task: params.task,
          executeAt,
          oneShot: true,
          notify: params.notify !== false,
        },
      };
    }

    // Recurring schedule
    const cronExpression = Scheduler.parseToCron(params.when);
    
    if (!cronExpression) {
      return {
        success: false,
        message: `Could not parse schedule "${params.when}". Try "every hour", "every day at 9am", "every 30 minutes", or a cron expression.`,
      };
    }

    const job = await scheduler.addJob({
      name: params.name,
      description: params.task.slice(0, 200),
      cronExpression,
      type: 'task',
      enabled: true,
      syncToCalendar: params.syncToCalendar,
      payload: {
        content: params.task,
        productId: params.productId,
        campaignId: params.campaignId,
        metadata: { 
          notify: params.notify !== false,
        },
      },
    });

    return {
      success: true,
      message: `🔁 Recurring task "${params.name}" scheduled (${params.when}).`,
      data: { 
        jobId: job.id, 
        name: params.name,
        task: params.task,
        schedule: cronExpression,
        recurring: true,
        notify: params.notify !== false,
      },
    };
  },
};

// ============ Export All ============
export const schedulerTools: Tool[] = [
  scheduleReminderTool,
  scheduleTaskTool,
  listJobsTool,
  cancelJobTool,
  pauseJobTool,
  resumeJobTool,
  runJobNowTool,
];
