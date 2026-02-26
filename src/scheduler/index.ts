/**
 * Scheduler System
 * Cron-based task scheduling for MarketClaw
 * 
 * Features:
 * - Schedule posts for later
 * - Recurring reminders
 * - Campaign automation
 */

import cron, { ScheduledTask } from 'node-cron';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { EventEmitter } from 'events';
import {
  createJobCalendarEvent,
  updateJobCalendarEvent,
  deleteJobCalendarEvent,
  syncJobAfterRun,
  shouldSyncToCalendar,
  isCalendarConnected,
  configureCalendarSync,
} from './calendar-sync.js';

/**
 * Calendar sync status for a job
 */
export interface CalendarSync {
  enabled: boolean;
  eventId?: string;           // Google Calendar event ID
  calendarId?: string;        // Target calendar (overrides default)
  lastSyncedAt?: number;      // Timestamp of last sync
  syncError?: string;         // Last sync error (if any)
}

export interface ScheduledJob {
  id: string;
  name: string;
  description?: string;
  cronExpression?: string;    // For recurring jobs
  executeAt?: number;         // For one-shot jobs (timestamp)
  oneShot?: boolean;          // True for one-shot jobs
  deleteAfterRun?: boolean;   // Auto-delete after successful run
  type: 'post' | 'reminder' | 'task' | 'heartbeat';
  enabled: boolean;
  payload: {
    channel?: string;       // telegram, twitter, linkedin
    content?: string;       // Post content or reminder message
    productId?: string;     // Associated product
    campaignId?: string;    // Associated campaign
    action?: string;        // Custom action identifier
    metadata?: Record<string, any>;
  };
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  createdAt: number;
  updatedAt: number;
  
  // Calendar sync fields
  calendarSync?: CalendarSync;
  timezone?: string;          // Job-specific timezone override
  syncToCalendar?: boolean;   // Opt-out flag (defaults to true if calendar connected)
}

export interface SchedulerConfig {
  workspace?: string;
  onJobExecute?: (job: ScheduledJob) => Promise<void>;
}

export class Scheduler extends EventEmitter {
  private workspacePath: string;
  private jobs: Map<string, ScheduledJob> = new Map();
  private tasks: Map<string, ScheduledTask> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();  // For one-shot jobs
  private onJobExecute?: (job: ScheduledJob) => Promise<void>;

  constructor(config?: SchedulerConfig) {
    super();
    this.workspacePath = config?.workspace || path.join(homedir(), '.marketclaw', 'workspace');
    this.onJobExecute = config?.onJobExecute;
  }

  private get schedulerFile(): string {
    return path.join(this.workspacePath, 'scheduler.json');
  }

  /**
   * Load jobs from disk
   */
  async load(): Promise<void> {
    if (!existsSync(this.schedulerFile)) {
      return;
    }

    const data = await readFile(this.schedulerFile, 'utf-8');
    const jobs: ScheduledJob[] = JSON.parse(data);
    
    for (const job of jobs) {
      this.jobs.set(job.id, job);
      if (job.enabled) {
        this.startJob(job);
      }
    }
  }

  /**
   * Save jobs to disk
   */
  async save(): Promise<void> {
    await mkdir(path.dirname(this.schedulerFile), { recursive: true });
    const jobs = Array.from(this.jobs.values());
    await writeFile(this.schedulerFile, JSON.stringify(jobs, null, 2));
  }

  /**
   * Start a job (cron or one-shot)
   */
  private startJob(job: ScheduledJob): void {
    // Clear any existing task/timeout
    if (this.tasks.has(job.id)) {
      this.tasks.get(job.id)?.stop();
      this.tasks.delete(job.id);
    }
    if (this.timeouts.has(job.id)) {
      clearTimeout(this.timeouts.get(job.id));
      this.timeouts.delete(job.id);
    }

    // One-shot job
    if (job.oneShot && job.executeAt) {
      const delay = job.executeAt - Date.now();
      
      if (delay <= 0) {
        // Already past - execute immediately
        this.executeJob(job);
        return;
      }

      job.nextRun = job.executeAt;
      
      const timeout = setTimeout(async () => {
        await this.executeJob(job);
        
        // Auto-delete one-shot jobs after execution
        if (job.deleteAfterRun !== false) {
          this.timeouts.delete(job.id);
          this.jobs.delete(job.id);
          await this.save();
        }
      }, delay);

      this.timeouts.set(job.id, timeout);
      return;
    }

    // Recurring cron job
    if (!job.cronExpression || !cron.validate(job.cronExpression)) {
      console.error(`Invalid cron expression for job ${job.id}: ${job.cronExpression}`);
      return;
    }

    const task = cron.schedule(job.cronExpression, async () => {
      await this.executeJob(job);
    });

    this.tasks.set(job.id, task);
    
    // Calculate next run
    job.nextRun = this.getNextRun(job.cronExpression);
  }

  /**
   * Execute a job
   */
  private async executeJob(job: ScheduledJob): Promise<void> {
    job.lastRun = Date.now();
    job.runCount++;
    job.updatedAt = Date.now();
    
    this.emit('job:execute', job);
    
    if (this.onJobExecute) {
      try {
        await this.onJobExecute(job);
      } catch (err) {
        console.error(`Error executing job ${job.id}:`, err);
        this.emit('job:error', job, err);
      }
    }

    // Sync calendar after job runs (delete old event, create new for recurring)
    if (job.calendarSync?.eventId || (job.syncToCalendar !== false && shouldSyncToCalendar(job))) {
      const result = await syncJobAfterRun(job);
      if (result.success && result.eventId) {
        job.calendarSync = {
          enabled: true,
          eventId: result.eventId,
          lastSyncedAt: Date.now(),
        };
      } else if (result.error) {
        job.calendarSync = {
          ...job.calendarSync,
          enabled: true,
          syncError: result.error,
        };
      }
      this.emit('job:calendar-synced', job);
    }

    await this.save();
  }

  /**
   * Calculate next run time from cron expression
   */
  private getNextRun(_cronExpression: string): number {
    // Simple approximation - in production you'd use cron-parser
    return Date.now() + 60000; // 1 minute placeholder
  }

  /**
   * Add a new job
   */
  async addJob(params: Omit<ScheduledJob, 'id' | 'runCount' | 'createdAt' | 'updatedAt'>): Promise<ScheduledJob> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const job: ScheduledJob = {
      id,
      ...params,
      runCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.jobs.set(id, job);
    
    if (job.enabled) {
      this.startJob(job);
    }

    // Sync to calendar if enabled and appropriate
    if (job.syncToCalendar !== false && shouldSyncToCalendar(job)) {
      const calendarConnected = await isCalendarConnected();
      if (calendarConnected) {
        const result = await createJobCalendarEvent(job);
        if (result.success && result.eventId) {
          job.calendarSync = {
            enabled: true,
            eventId: result.eventId,
            lastSyncedAt: Date.now(),
          };
        } else if (result.error) {
          job.calendarSync = {
            enabled: true,
            syncError: result.error,
          };
        }
      }
    }

    await this.save();
    return job;
  }

  /**
   * Update a job
   */
  async updateJob(id: string, updates: Partial<ScheduledJob>): Promise<ScheduledJob | null> {
    const job = this.jobs.get(id);
    if (!job) return null;

    Object.assign(job, updates, { updatedAt: Date.now() });

    // Restart if cron changed or enabled state changed
    if (updates.cronExpression || updates.enabled !== undefined) {
      this.tasks.get(id)?.stop();
      this.tasks.delete(id);
      
      if (job.enabled) {
        this.startJob(job);
      }
    }

    await this.save();
    return job;
  }

  /**
   * Remove a job
   */
  async removeJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    // Delete calendar event if it exists
    if (job.calendarSync?.eventId) {
      await deleteJobCalendarEvent(job);
    }

    this.tasks.get(id)?.stop();
    this.tasks.delete(id);
    this.jobs.delete(id);

    await this.save();
    return true;
  }

  /**
   * Get a job
   */
  getJob(id: string): ScheduledJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * List all jobs
   */
  listJobs(filter?: { type?: string; enabled?: boolean; productId?: string }): ScheduledJob[] {
    let jobs = Array.from(this.jobs.values());

    if (filter?.type) {
      jobs = jobs.filter(j => j.type === filter.type);
    }
    if (filter?.enabled !== undefined) {
      jobs = jobs.filter(j => j.enabled === filter.enabled);
    }
    if (filter?.productId) {
      jobs = jobs.filter(j => j.payload.productId === filter.productId);
    }

    return jobs.sort((a, b) => (a.nextRun || 0) - (b.nextRun || 0));
  }

  /**
   * Enable a job
   */
  async enableJob(id: string): Promise<boolean> {
    const job = await this.updateJob(id, { enabled: true });
    return !!job;
  }

  /**
   * Disable a job
   */
  async disableJob(id: string): Promise<boolean> {
    const job = await this.updateJob(id, { enabled: false });
    return !!job;
  }

  /**
   * Run a job immediately (outside of schedule)
   */
  async runNow(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    job.lastRun = Date.now();
    job.runCount++;
    job.updatedAt = Date.now();

    this.emit('job:execute', job);

    if (this.onJobExecute) {
      await this.onJobExecute(job);
    }

    await this.save();
    return true;
  }

  /**
   * Stop all jobs
   */
  stopAll(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
    
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }

  /**
   * Parse human-readable time to cron expression
   */
  static parseToCron(input: string): string | null {
    const lower = input.toLowerCase().trim();

    // Common patterns
    if (lower === 'every minute') return '* * * * *';
    if (lower === 'every hour') return '0 * * * *';
    if (lower === 'every day' || lower === 'daily') return '0 9 * * *';
    if (lower === 'every week' || lower === 'weekly') return '0 9 * * 1';
    if (lower === 'every month' || lower === 'monthly') return '0 9 1 * *';

    // "every X minutes"
    const minMatch = lower.match(/every (\d+) minutes?/);
    if (minMatch) {
      return `*/${minMatch[1]} * * * *`;
    }

    // "every X hours"
    const hourMatch = lower.match(/every (\d+) hours?/);
    if (hourMatch) {
      return `0 */${hourMatch[1]} * * *`;
    }

    // "at HH:MM"
    const timeMatch = lower.match(/at (\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return `${timeMatch[2]} ${timeMatch[1]} * * *`;
    }

    // "at HH:MM on weekdays"
    const weekdayMatch = lower.match(/at (\d{1,2}):(\d{2}) on weekdays/);
    if (weekdayMatch) {
      return `${weekdayMatch[2]} ${weekdayMatch[1]} * * 1-5`;
    }

    // Already a cron expression
    if (cron.validate(input)) {
      return input;
    }

    return null;
  }

  /**
   * Parse human-readable time to timestamp for one-shot scheduling
   * Supports: "in X minutes/hours", "at HH:MM", "tomorrow at HH:MM", etc.
   */
  static parseToTimestamp(input: string): number | null {
    const lower = input.toLowerCase().trim();
    const now = new Date();

    // "in X minutes"
    const inMinMatch = lower.match(/in (\d+) minutes?/);
    if (inMinMatch) {
      return now.getTime() + parseInt(inMinMatch[1]) * 60 * 1000;
    }

    // "in X hours"
    const inHourMatch = lower.match(/in (\d+) hours?/);
    if (inHourMatch) {
      return now.getTime() + parseInt(inHourMatch[1]) * 60 * 60 * 1000;
    }

    // "in X seconds" (mostly for testing)
    const inSecMatch = lower.match(/in (\d+) seconds?/);
    if (inSecMatch) {
      return now.getTime() + parseInt(inSecMatch[1]) * 1000;
    }

    // "at HH:MM" or "at H:MM" (today, or tomorrow if time has passed)
    const atTimeMatch = lower.match(/^at (\d{1,2}):(\d{2})$/);
    if (atTimeMatch) {
      const hours = parseInt(atTimeMatch[1]);
      const minutes = parseInt(atTimeMatch[2]);
      const target = new Date(now);
      target.setHours(hours, minutes, 0, 0);
      
      // If time has passed today, schedule for tomorrow
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return target.getTime();
    }

    // "at HH:MM am/pm" or "at H am/pm"
    const atTimeAmPmMatch = lower.match(/at (\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    if (atTimeAmPmMatch) {
      let hours = parseInt(atTimeAmPmMatch[1]);
      const minutes = atTimeAmPmMatch[2] ? parseInt(atTimeAmPmMatch[2]) : 0;
      const isPm = atTimeAmPmMatch[3] === 'pm';
      
      if (isPm && hours !== 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
      
      const target = new Date(now);
      target.setHours(hours, minutes, 0, 0);
      
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return target.getTime();
    }

    // "tomorrow at HH:MM"
    const tomorrowMatch = lower.match(/tomorrow at (\d{1,2}):(\d{2})/);
    if (tomorrowMatch) {
      const hours = parseInt(tomorrowMatch[1]);
      const minutes = parseInt(tomorrowMatch[2]);
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(hours, minutes, 0, 0);
      return target.getTime();
    }

    // "tonight at HH:MM" (assumes PM if ambiguous)
    const tonightMatch = lower.match(/tonight at (\d{1,2}):(\d{2})/);
    if (tonightMatch) {
      let hours = parseInt(tonightMatch[1]);
      const minutes = parseInt(tonightMatch[2]);
      
      // Assume PM for "tonight" if hours < 12
      if (hours < 12) hours += 12;
      
      const target = new Date(now);
      target.setHours(hours, minutes, 0, 0);
      
      // If already passed, it's for tomorrow night
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return target.getTime();
    }

    // ISO timestamp
    const isoDate = Date.parse(input);
    if (!isNaN(isoDate)) {
      return isoDate;
    }

    return null;
  }

  /**
   * Check if input looks like a one-shot time (vs recurring)
   */
  static isOneShot(input: string): boolean {
    const lower = input.toLowerCase().trim();
    return (
      lower.startsWith('in ') ||
      lower.startsWith('at ') ||
      lower.startsWith('tomorrow') ||
      lower.startsWith('tonight') ||
      /^\d{4}-\d{2}-\d{2}/.test(input)  // ISO date
    );
  }
}

// Singleton
export const scheduler = new Scheduler();

// Re-export calendar sync utilities
export { configureCalendarSync, isCalendarConnected } from './calendar-sync.js';
