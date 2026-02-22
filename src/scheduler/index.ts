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

export interface ScheduledJob {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
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
}

export interface SchedulerConfig {
  workspace?: string;
  onJobExecute?: (job: ScheduledJob) => Promise<void>;
}

export class Scheduler extends EventEmitter {
  private workspacePath: string;
  private jobs: Map<string, ScheduledJob> = new Map();
  private tasks: Map<string, ScheduledTask> = new Map();
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
   * Start a cron job
   */
  private startJob(job: ScheduledJob): void {
    if (this.tasks.has(job.id)) {
      this.tasks.get(job.id)?.stop();
    }

    if (!cron.validate(job.cronExpression)) {
      console.error(`Invalid cron expression for job ${job.id}: ${job.cronExpression}`);
      return;
    }

    const task = cron.schedule(job.cronExpression, async () => {
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

      await this.save();
    });

    this.tasks.set(job.id, task);
    
    // Calculate next run
    job.nextRun = this.getNextRun(job.cronExpression);
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
}

// Singleton
export const scheduler = new Scheduler();
