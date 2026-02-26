/**
 * Scheduler Types
 * Type definitions for the scheduler system with calendar sync support
 */

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

/**
 * Extended ScheduledJob with calendar sync support
 */
export interface ScheduledJobWithCalendar {
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
    channel?: string;         // telegram, twitter, linkedin
    content?: string;         // Post content or reminder message
    productId?: string;       // Associated product
    campaignId?: string;      // Associated campaign
    action?: string;          // Custom action identifier
    metadata?: Record<string, any>;
  };
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  createdAt: number;
  updatedAt: number;
  
  // Calendar sync fields (new)
  calendarSync?: CalendarSync;
  timezone?: string;          // Job-specific timezone override
}

/**
 * Calendar sync configuration
 */
export interface CalendarSyncConfig {
  defaultCalendarId?: string;
  defaultTimezone?: string;
  enabled?: boolean;          // Global calendar sync enable/disable
}

/**
 * Result from calendar sync operations
 */
export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Options for creating/updating calendar events
 */
export interface CalendarEventOptions {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  calendarId?: string;
  timezone?: string;
  location?: string;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{ method: 'email' | 'popup'; minutes: number }>;
  };
}
