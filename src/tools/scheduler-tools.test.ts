/**
 * Scheduler Tools Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scheduleReminderTool,
  scheduleTaskTool,
  listJobsTool,
  cancelJobTool,
  pauseJobTool,
  resumeJobTool,
  runJobNowTool,
} from './scheduler-tools.js';
import { scheduler, Scheduler, ScheduledJob } from '../scheduler/index.js';

// Mock the scheduler module
vi.mock('../scheduler/index.js', () => {
  const mockScheduler = {
    addJob: vi.fn(),
    removeJob: vi.fn(),
    listJobs: vi.fn(),
    enableJob: vi.fn(),
    disableJob: vi.fn(),
    runNow: vi.fn(),
  };

  const MockScheduler = {
    parseToCron: vi.fn(),
  };

  return {
    scheduler: mockScheduler,
    Scheduler: MockScheduler,
  };
});

// Helper to create a mock job
function createMockJob(overrides: Partial<ScheduledJob> = {}): ScheduledJob {
  return {
    id: 'job_123',
    name: 'Test Job',
    description: 'A test job',
    cronExpression: '0 9 * * *',
    type: 'post',
    enabled: true,
    payload: {
      channel: 'twitter',
      content: 'Hello world!',
    },
    runCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('Scheduler Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ schedule_reminder ============
  describe('schedule_reminder', () => {
    it('schedules a reminder successfully', async () => {
      const mockJob = createMockJob({
        id: 'job_reminder_1',
        type: 'reminder',
      });
      vi.mocked(Scheduler.parseToCron).mockReturnValue('0 14 * * *');
      vi.mocked(scheduler.addJob).mockResolvedValue(mockJob);

      const result = await scheduleReminderTool.execute({
        message: 'Remember to check metrics!',
        when: 'at 14:00',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Reminder set for at 14:00');
      expect(result.data.jobId).toBe('job_reminder_1');

      expect(scheduler.addJob).toHaveBeenCalledWith({
        name: 'Reminder',
        description: 'Remember to check metrics!',
        cronExpression: '0 14 * * *',
        type: 'reminder',
        enabled: true,
        payload: {
          content: 'Remember to check metrics!',
          metadata: { recurring: false },
        },
      });
    });

    it('passes recurring flag when specified', async () => {
      const mockJob = createMockJob({ type: 'reminder' });
      vi.mocked(Scheduler.parseToCron).mockReturnValue('0 9 * * 1');
      vi.mocked(scheduler.addJob).mockResolvedValue(mockJob);

      await scheduleReminderTool.execute({
        message: 'Weekly standup!',
        when: 'every Monday',
        recurring: true,
      });

      expect(scheduler.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            metadata: { recurring: true },
          }),
        })
      );
    });

    it('returns error for invalid schedule', async () => {
      vi.mocked(Scheduler.parseToCron).mockReturnValue(null);

      const result = await scheduleReminderTool.execute({
        message: 'Reminder',
        when: 'invalid time',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Could not parse schedule');
    });
  });

  // ============ list_scheduled_jobs ============
  describe('list_scheduled_jobs', () => {
    it('lists all jobs', async () => {
      const mockJobs = [
        createMockJob({
          id: 'job_1',
          name: 'Morning Post',
          type: 'post',
          cronExpression: '0 9 * * *',
          payload: { content: 'Good morning everyone!' },
          lastRun: Date.now() - 86400000,
          runCount: 5,
        }),
        createMockJob({
          id: 'job_2',
          name: 'Reminder',
          type: 'reminder',
          cronExpression: '0 14 * * *',
          payload: { content: 'Check analytics' },
          runCount: 10,
        }),
      ];
      vi.mocked(scheduler.listJobs).mockReturnValue(mockJobs);

      const result = await listJobsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Found 2 scheduled job(s).');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: 'job_1',
        name: 'Morning Post',
        type: 'post',
        schedule: '0 9 * * *',
        enabled: true,
        runCount: 5,
      });
    });

    it('filters by type', async () => {
      vi.mocked(scheduler.listJobs).mockReturnValue([]);

      await listJobsTool.execute({ type: 'reminder' });

      expect(scheduler.listJobs).toHaveBeenCalledWith({
        type: 'reminder',
        productId: undefined,
      });
    });

    it('filters by productId', async () => {
      vi.mocked(scheduler.listJobs).mockReturnValue([]);

      await listJobsTool.execute({ productId: 'prod_123' });

      expect(scheduler.listJobs).toHaveBeenCalledWith({
        type: undefined,
        productId: 'prod_123',
      });
    });

    it('returns appropriate message when no jobs found', async () => {
      vi.mocked(scheduler.listJobs).mockReturnValue([]);

      const result = await listJobsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('No scheduled jobs found.');
      expect(result.data).toEqual([]);
    });

    it('truncates long content in summary', async () => {
      const mockJobs = [
        createMockJob({
          payload: { content: 'A'.repeat(100) },
        }),
      ];
      vi.mocked(scheduler.listJobs).mockReturnValue(mockJobs);

      const result = await listJobsTool.execute({});

      expect(result.data[0].content).toHaveLength(50);
    });

    it('handles jobs with no lastRun', async () => {
      const mockJobs = [createMockJob({ lastRun: undefined })];
      vi.mocked(scheduler.listJobs).mockReturnValue(mockJobs);

      const result = await listJobsTool.execute({});

      expect(result.data[0].lastRun).toBeNull();
    });
  });

  // ============ cancel_scheduled_job ============
  describe('cancel_scheduled_job', () => {
    it('cancels job successfully', async () => {
      vi.mocked(scheduler.removeJob).mockResolvedValue(true);

      const result = await cancelJobTool.execute({ jobId: 'job_123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job job_123 cancelled.');
      expect(scheduler.removeJob).toHaveBeenCalledWith('job_123');
    });

    it('returns error when job not found', async () => {
      vi.mocked(scheduler.removeJob).mockResolvedValue(false);

      const result = await cancelJobTool.execute({ jobId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Job nonexistent not found.');
    });
  });

  // ============ pause_scheduled_job ============
  describe('pause_scheduled_job', () => {
    it('pauses job successfully', async () => {
      vi.mocked(scheduler.disableJob).mockResolvedValue(true);

      const result = await pauseJobTool.execute({ jobId: 'job_123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job job_123 paused.');
      expect(scheduler.disableJob).toHaveBeenCalledWith('job_123');
    });

    it('returns error when job not found', async () => {
      vi.mocked(scheduler.disableJob).mockResolvedValue(false);

      const result = await pauseJobTool.execute({ jobId: 'missing_job' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Job missing_job not found.');
    });
  });

  // ============ resume_scheduled_job ============
  describe('resume_scheduled_job', () => {
    it('resumes job successfully', async () => {
      vi.mocked(scheduler.enableJob).mockResolvedValue(true);

      const result = await resumeJobTool.execute({ jobId: 'job_123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job job_123 resumed.');
      expect(scheduler.enableJob).toHaveBeenCalledWith('job_123');
    });

    it('returns error when job not found', async () => {
      vi.mocked(scheduler.enableJob).mockResolvedValue(false);

      const result = await resumeJobTool.execute({ jobId: 'nope' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Job nope not found.');
    });
  });

  // ============ run_job_now ============
  describe('run_job_now', () => {
    it('runs job immediately', async () => {
      vi.mocked(scheduler.runNow).mockResolvedValue(true);

      const result = await runJobNowTool.execute({ jobId: 'job_123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job job_123 executed.');
      expect(scheduler.runNow).toHaveBeenCalledWith('job_123');
    });

    it('returns error when job not found', async () => {
      vi.mocked(scheduler.runNow).mockResolvedValue(false);

      const result = await runJobNowTool.execute({ jobId: 'gone' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Job gone not found.');
    });
  });

  // ============ schedule_task ============
  describe('schedule_task', () => {
    it('schedules an automated task successfully', async () => {
      vi.mocked(Scheduler.parseToCron).mockReturnValue('0 * * * *');
      vi.mocked(scheduler.addJob).mockResolvedValue(createMockJob({
        id: 'task_123',
        name: 'Email Auto-Responder',
        type: 'task',
        payload: {
          content: 'Check inbox and respond to leads',
          metadata: { notify: true },
        },
      }));

      const result = await scheduleTaskTool.execute({
        name: 'Email Auto-Responder',
        task: 'Check inbox and respond to leads',
        when: 'every hour',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Email Auto-Responder');
      expect(result.message).toContain('scheduled');
      expect(result.data?.jobId).toBe('task_123');
      expect(result.data?.task).toBe('Check inbox and respond to leads');
      expect(scheduler.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Email Auto-Responder',
          type: 'task',
          payload: expect.objectContaining({
            content: 'Check inbox and respond to leads',
          }),
        })
      );
    });

    it('includes product and campaign context', async () => {
      vi.mocked(Scheduler.parseToCron).mockReturnValue('0 9 * * *');
      vi.mocked(scheduler.addJob).mockResolvedValue(createMockJob({ id: 'task_456' }));

      const result = await scheduleTaskTool.execute({
        name: 'Daily Report',
        task: 'Generate campaign metrics report',
        when: 'every day at 9am',
        productId: 'proofping',
        campaignId: 'launch-2026',
      });

      expect(result.success).toBe(true);
      expect(scheduler.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            productId: 'proofping',
            campaignId: 'launch-2026',
          }),
        })
      );
    });

    it('handles notify option', async () => {
      vi.mocked(Scheduler.parseToCron).mockReturnValue('*/30 * * * *');
      vi.mocked(scheduler.addJob).mockResolvedValue(createMockJob({ id: 'task_789' }));

      const result = await scheduleTaskTool.execute({
        name: 'Silent Task',
        task: 'Background cleanup',
        when: 'every 30 minutes',
        notify: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.notify).toBe(false);
      expect(scheduler.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            metadata: { notify: false },
          }),
        })
      );
    });

    it('returns error for invalid schedule', async () => {
      vi.mocked(Scheduler.parseToCron).mockReturnValue(null);

      const result = await scheduleTaskTool.execute({
        name: 'Bad Task',
        task: 'Do something',
        when: 'whenever',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Could not parse schedule');
    });

    it('defaults notify to true', async () => {
      vi.mocked(Scheduler.parseToCron).mockReturnValue('0 * * * *');
      vi.mocked(scheduler.addJob).mockResolvedValue(createMockJob({ id: 'task_default' }));

      const result = await scheduleTaskTool.execute({
        name: 'Default Notify',
        task: 'Check something',
        when: 'every hour',
      });

      expect(result.success).toBe(true);
      expect(result.data?.notify).toBe(true);
    });
  });

  // ============ Tool Metadata ============
  describe('Tool Metadata', () => {
    it('schedule_reminder has correct definition', () => {
      expect(scheduleReminderTool.name).toBe('schedule_reminder');
      expect(scheduleReminderTool.parameters.required).toContain('message');
      expect(scheduleReminderTool.parameters.required).toContain('when');
    });

    it('list_scheduled_jobs has optional filters', () => {
      expect(listJobsTool.name).toBe('list_scheduled_jobs');
      expect(listJobsTool.parameters.required).toBeUndefined();
      expect(listJobsTool.parameters.properties.type.enum).toContain('post');
      expect(listJobsTool.parameters.properties.type.enum).toContain('reminder');
    });

    it('cancel_scheduled_job requires jobId', () => {
      expect(cancelJobTool.name).toBe('cancel_scheduled_job');
      expect(cancelJobTool.parameters.required).toContain('jobId');
    });

    it('schedule_task has correct definition', () => {
      expect(scheduleTaskTool.name).toBe('schedule_task');
      expect(scheduleTaskTool.parameters.required).toContain('name');
      expect(scheduleTaskTool.parameters.required).toContain('task');
      expect(scheduleTaskTool.parameters.required).toContain('when');
      expect(scheduleTaskTool.parameters.properties.productId).toBeDefined();
      expect(scheduleTaskTool.parameters.properties.campaignId).toBeDefined();
      expect(scheduleTaskTool.parameters.properties.notify).toBeDefined();
    });

    it('list_scheduled_jobs includes task type', () => {
      expect(listJobsTool.parameters.properties.type.enum).toContain('task');
    });
  });
});
