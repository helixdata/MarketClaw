/**
 * Calendar Sync Module
 * Synchronizes scheduled jobs with Google Calendar
 */

import pino from 'pino';
import { ScheduledJobWithCalendar, CalendarSync, CalendarSyncResult, CalendarEventOptions } from './types.js';

const logger = pino({ name: 'calendar-sync' });

// Google Calendar API integration (uses gog CLI)
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

/**
 * Configuration for calendar sync
 */
let syncConfig = {
  defaultCalendarId: 'primary',
  defaultTimezone: 'Pacific/Auckland',
  enabled: true,
};

/**
 * Configure calendar sync settings
 */
export function configureCalendarSync(config: Partial<typeof syncConfig>): void {
  syncConfig = { ...syncConfig, ...config };
  logger.info({ config: syncConfig }, 'Calendar sync configured');
}

/**
 * Check if Google Calendar is connected
 */
export async function isCalendarConnected(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('gog calendar list --limit 1 --json 2>/dev/null');
    return stdout.includes('[');
  } catch {
    return false;
  }
}

/**
 * Resolve which calendar to use for a job
 */
export function resolveCalendarId(job: ScheduledJobWithCalendar, productConfig?: { calendarId?: string }): string {
  // Priority: job override → product config → global default → 'primary'
  return job.calendarSync?.calendarId 
    ?? productConfig?.calendarId 
    ?? syncConfig.defaultCalendarId 
    ?? 'primary';
}

/**
 * Resolve timezone for a job
 */
export function resolveTimezone(job: ScheduledJobWithCalendar, memberTimezone?: string): string {
  // Priority: job override → member preference → global default → UTC
  return job.timezone 
    ?? memberTimezone 
    ?? syncConfig.defaultTimezone 
    ?? 'UTC';
}

/**
 * Build calendar event title from job
 */
function buildEventTitle(job: ScheduledJobWithCalendar): string {
  const emoji = job.type === 'reminder' ? '🔔' 
    : job.type === 'post' ? '📝' 
    : job.type === 'task' ? '🤖' 
    : '⚙️';
  return `${emoji} ${job.name}`;
}

/**
 * Build calendar event description from job
 */
function buildEventDescription(job: ScheduledJobWithCalendar): string {
  const lines = [
    `**MarketClaw Scheduled Job**`,
    ``,
    `Type: ${job.type}`,
    `ID: ${job.id}`,
  ];
  
  if (job.description) {
    lines.push(``, `${job.description}`);
  }
  
  if (job.payload.content) {
    lines.push(``, `Content: ${job.payload.content.slice(0, 200)}${job.payload.content.length > 200 ? '...' : ''}`);
  }
  
  if (job.payload.productId) {
    lines.push(`Product: ${job.payload.productId}`);
  }
  
  if (job.cronExpression) {
    lines.push(``, `Schedule: ${job.cronExpression}`);
  }
  
  return lines.join('\n');
}

/**
 * Create a calendar event for a job
 */
export async function createJobCalendarEvent(
  job: ScheduledJobWithCalendar,
  options?: {
    memberTimezone?: string;
    productConfig?: { calendarId?: string };
  }
): Promise<CalendarSyncResult> {
  if (!syncConfig.enabled) {
    return { success: false, error: 'Calendar sync disabled' };
  }

  // Check if explicitly disabled for this job
  if (job.calendarSync?.enabled === false) {
    return { success: false, error: 'Calendar sync disabled for this job' };
  }

  const calendarId = resolveCalendarId(job, options?.productConfig);
  const timezone = resolveTimezone(job, options?.memberTimezone);
  
  // Calculate start time
  let startTime: Date;
  if (job.executeAt) {
    startTime = new Date(job.executeAt);
  } else if (job.nextRun) {
    startTime = new Date(job.nextRun);
  } else {
    return { success: false, error: 'No scheduled time found' };
  }

  const title = buildEventTitle(job);
  const description = buildEventDescription(job);
  
  // Format for gog CLI
  const startIso = startTime.toISOString();
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min default duration
  const endIso = endTime.toISOString();

  try {
    // Use gog CLI to create event
    const cmd = `gog calendar create --calendar "${calendarId}" --title "${title.replace(/"/g, '\\"')}" --start "${startIso}" --end "${endIso}" --description "${description.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" --json`;
    
    logger.debug({ cmd }, 'Creating calendar event');
    const { stdout } = await execAsync(cmd);
    
    const result = JSON.parse(stdout);
    const eventId = result.id || result.eventId;
    
    logger.info({ jobId: job.id, eventId, calendarId }, 'Calendar event created');
    
    return { success: true, eventId };
  } catch (err) {
    const error = (err as Error).message;
    logger.error({ jobId: job.id, error }, 'Failed to create calendar event');
    return { success: false, error };
  }
}

/**
 * Update an existing calendar event
 */
export async function updateJobCalendarEvent(
  job: ScheduledJobWithCalendar,
  options?: {
    memberTimezone?: string;
    productConfig?: { calendarId?: string };
  }
): Promise<CalendarSyncResult> {
  if (!job.calendarSync?.eventId) {
    // No existing event, create new one
    return createJobCalendarEvent(job, options);
  }

  const calendarId = resolveCalendarId(job, options?.productConfig);
  const timezone = resolveTimezone(job, options?.memberTimezone);
  
  // Calculate new start time
  let startTime: Date;
  if (job.executeAt) {
    startTime = new Date(job.executeAt);
  } else if (job.nextRun) {
    startTime = new Date(job.nextRun);
  } else {
    return { success: false, error: 'No scheduled time found' };
  }

  const title = buildEventTitle(job);
  const startIso = startTime.toISOString();
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
  const endIso = endTime.toISOString();

  try {
    // Use gog CLI to update event
    const cmd = `gog calendar update --calendar "${calendarId}" --event "${job.calendarSync.eventId}" --title "${title.replace(/"/g, '\\"')}" --start "${startIso}" --end "${endIso}" --json`;
    
    logger.debug({ cmd }, 'Updating calendar event');
    await execAsync(cmd);
    
    logger.info({ jobId: job.id, eventId: job.calendarSync.eventId }, 'Calendar event updated');
    
    return { success: true, eventId: job.calendarSync.eventId };
  } catch (err) {
    const error = (err as Error).message;
    logger.error({ jobId: job.id, error }, 'Failed to update calendar event');
    
    // If update failed, try creating a new event
    return createJobCalendarEvent(job, options);
  }
}

/**
 * Delete a calendar event for a job
 */
export async function deleteJobCalendarEvent(job: ScheduledJobWithCalendar): Promise<CalendarSyncResult> {
  if (!job.calendarSync?.eventId) {
    return { success: true }; // Nothing to delete
  }

  const calendarId = job.calendarSync.calendarId ?? syncConfig.defaultCalendarId ?? 'primary';

  try {
    const cmd = `gog calendar delete --calendar "${calendarId}" --event "${job.calendarSync.eventId}" --json`;
    
    logger.debug({ cmd }, 'Deleting calendar event');
    await execAsync(cmd);
    
    logger.info({ jobId: job.id, eventId: job.calendarSync.eventId }, 'Calendar event deleted');
    
    return { success: true };
  } catch (err) {
    const error = (err as Error).message;
    logger.warn({ jobId: job.id, error }, 'Failed to delete calendar event (may already be deleted)');
    return { success: true }; // Consider success even if event was already deleted
  }
}

/**
 * Check if a calendar event still exists
 */
export async function checkCalendarEventExists(eventId: string, calendarId?: string): Promise<boolean> {
  const calendar = calendarId ?? syncConfig.defaultCalendarId ?? 'primary';
  
  try {
    const cmd = `gog calendar get --calendar "${calendar}" --event "${eventId}" --json`;
    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync a job after it runs (for recurring jobs)
 * Deletes old event and creates new one for next occurrence
 */
export async function syncJobAfterRun(
  job: ScheduledJobWithCalendar,
  options?: {
    memberTimezone?: string;
    productConfig?: { calendarId?: string };
  }
): Promise<CalendarSyncResult> {
  // Skip if not a recurring job
  if (job.oneShot || !job.cronExpression) {
    // For one-shot jobs, just delete the event
    return deleteJobCalendarEvent(job);
  }

  // Delete old event
  await deleteJobCalendarEvent(job);
  
  // Create new event for next occurrence
  return createJobCalendarEvent(job, options);
}

/**
 * Determine if a job should sync to calendar
 * (Called when deciding whether to sync)
 */
export function shouldSyncToCalendar(job: ScheduledJobWithCalendar): boolean {
  // Explicitly disabled
  if (job.calendarSync?.enabled === false) {
    return false;
  }

  // Global sync disabled
  if (!syncConfig.enabled) {
    return false;
  }

  // Skip heartbeat jobs (too frequent)
  if (job.type === 'heartbeat') {
    return false;
  }

  // Skip high-frequency cron jobs (more than hourly)
  if (job.cronExpression) {
    const expr = job.cronExpression;
    // Very rough check for frequent jobs
    if (expr.startsWith('*/') && !expr.includes(' ')) {
      // Every N minutes pattern
      const match = expr.match(/^\*\/(\d+)/);
      if (match && parseInt(match[1]) < 60) {
        return false; // Less than hourly
      }
    }
  }

  return true;
}
