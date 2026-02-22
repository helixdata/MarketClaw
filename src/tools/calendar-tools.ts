/**
 * Google Calendar Tools
 * Tools for managing Google Calendar events
 */

import { Tool, ToolResult } from './types.js';
import { getCalendarClient, isAuthenticated, getAuthUrl, exchangeCode } from '../auth/google-calendar.js';
import { getProductToolConfig } from './config.js';
import { loadConfig } from '../config/index.js';
import { calendar_v3 } from 'googleapis';

// Calendar config types
interface CalendarConfig {
  provider?: string;
  calendarId?: string;
  createEventsForScheduledPosts?: boolean;
}

interface GlobalConfig {
  calendar?: CalendarConfig;
}

interface ProductConfig {
  calendar?: {
    calendarId?: string;
  };
}

/**
 * Resolve which calendar ID to use
 * Priority: product-specific > global > 'primary'
 */
async function resolveCalendarId(productId?: string): Promise<string> {
  // 1. Check product-specific config
  if (productId) {
    try {
      const productConfig = await getProductToolConfig(productId) as ProductConfig | null;
      if (productConfig?.calendar?.calendarId) {
        return productConfig.calendar.calendarId;
      }
    } catch {
      // Product config not found, continue to global
    }
  }

  // 2. Check global config
  try {
    const globalConfig = await loadConfig() as GlobalConfig;
    if (globalConfig?.calendar?.calendarId) {
      return globalConfig.calendar.calendarId;
    }
  } catch {
    // Global config not found, use default
  }

  // 3. Default to primary
  return 'primary';
}

/**
 * Format event for display
 */
function formatEvent(event: calendar_v3.Schema$Event): Record<string, unknown> {
  return {
    id: event.id,
    title: event.summary,
    description: event.description,
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    location: event.location,
    status: event.status,
    link: event.htmlLink,
    creator: event.creator?.email,
    organizer: event.organizer?.email,
    attendees: event.attendees?.map(a => ({
      email: a.email,
      name: a.displayName,
      responseStatus: a.responseStatus,
    })),
  };
}

// ============ List Calendar Events ============
export const listCalendarEventsTool: Tool = {
  name: 'list_calendar_events',
  description: 'List upcoming Google Calendar events. Filter by date range or calendar.',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID to use product-specific calendar (optional)',
      },
      calendarId: {
        type: 'string',
        description: 'Calendar ID to use (overrides product/global config)',
      },
      timeMin: {
        type: 'string',
        description: 'Start of time range (ISO 8601, default: now)',
      },
      timeMax: {
        type: 'string',
        description: 'End of time range (ISO 8601, default: 7 days from now)',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of events to return (default: 10)',
      },
      query: {
        type: 'string',
        description: 'Search query to filter events',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    if (!await isAuthenticated()) {
      return {
        success: false,
        message: 'Google Calendar not authenticated. Use google_calendar_auth to connect your account.',
      };
    }

    try {
      const calendar = await getCalendarClient();
      const calendarId = params.calendarId || await resolveCalendarId(params.productId);
      
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const response = await calendar.events.list({
        calendarId,
        timeMin: params.timeMin || now.toISOString(),
        timeMax: params.timeMax || weekFromNow.toISOString(),
        maxResults: params.maxResults || 10,
        singleEvents: true,
        orderBy: 'startTime',
        q: params.query,
      });

      const events = response.data.items || [];

      if (events.length === 0) {
        return {
          success: true,
          message: 'No upcoming events found.',
          data: [],
        };
      }

      return {
        success: true,
        message: `Found ${events.length} event(s)`,
        data: events.map(formatEvent),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to list events: ${message}`,
      };
    }
  },
};

// ============ Create Calendar Event ============
export const createCalendarEventTool: Tool = {
  name: 'create_calendar_event',
  description: 'Create a new Google Calendar event.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Event title/summary',
      },
      start: {
        type: 'string',
        description: 'Start time (ISO 8601 or human-readable like "tomorrow 2pm")',
      },
      end: {
        type: 'string',
        description: 'End time (ISO 8601, default: 1 hour after start)',
      },
      description: {
        type: 'string',
        description: 'Event description/notes',
      },
      location: {
        type: 'string',
        description: 'Event location',
      },
      productId: {
        type: 'string',
        description: 'Product ID to use product-specific calendar',
      },
      calendarId: {
        type: 'string',
        description: 'Calendar ID to use (overrides product/global config)',
      },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of attendee email addresses',
      },
      reminders: {
        type: 'array',
        items: { type: 'number' },
        description: 'Reminder times in minutes before event (e.g., [10, 60])',
      },
    },
    required: ['title', 'start'],
  },

  async execute(params): Promise<ToolResult> {
    if (!await isAuthenticated()) {
      return {
        success: false,
        message: 'Google Calendar not authenticated. Use google_calendar_auth to connect your account.',
      };
    }

    try {
      const calendar = await getCalendarClient();
      const calendarId = params.calendarId || await resolveCalendarId(params.productId);
      
      // Parse start time
      const startDate = new Date(params.start);
      if (isNaN(startDate.getTime())) {
        return {
          success: false,
          message: `Invalid start time: ${params.start}. Use ISO 8601 format.`,
        };
      }

      // Calculate end time (default: 1 hour after start)
      let endDate: Date;
      if (params.end) {
        endDate = new Date(params.end);
        if (isNaN(endDate.getTime())) {
          return {
            success: false,
            message: `Invalid end time: ${params.end}. Use ISO 8601 format.`,
          };
        }
      } else {
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      }

      const event: calendar_v3.Schema$Event = {
        summary: params.title,
        description: params.description,
        location: params.location,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      // Add attendees
      if (params.attendees && Array.isArray(params.attendees)) {
        event.attendees = params.attendees.map((email: string) => ({ email }));
      }

      // Add reminders
      if (params.reminders && Array.isArray(params.reminders)) {
        event.reminders = {
          useDefault: false,
          overrides: params.reminders.map((minutes: number) => ({
            method: 'popup',
            minutes,
          })),
        };
      }

      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates: params.attendees ? 'all' : 'none',
      });

      return {
        success: true,
        message: `Created event "${params.title}" for ${startDate.toLocaleString()}`,
        data: formatEvent(response.data),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to create event: ${message}`,
      };
    }
  },
};

// ============ Update Calendar Event ============
export const updateCalendarEventTool: Tool = {
  name: 'update_calendar_event',
  description: 'Update an existing Google Calendar event.',
  parameters: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: 'Event ID to update',
      },
      title: {
        type: 'string',
        description: 'New event title',
      },
      start: {
        type: 'string',
        description: 'New start time (ISO 8601)',
      },
      end: {
        type: 'string',
        description: 'New end time (ISO 8601)',
      },
      description: {
        type: 'string',
        description: 'New event description',
      },
      location: {
        type: 'string',
        description: 'New event location',
      },
      productId: {
        type: 'string',
        description: 'Product ID for calendar resolution',
      },
      calendarId: {
        type: 'string',
        description: 'Calendar ID (overrides product/global config)',
      },
    },
    required: ['eventId'],
  },

  async execute(params): Promise<ToolResult> {
    if (!await isAuthenticated()) {
      return {
        success: false,
        message: 'Google Calendar not authenticated. Use google_calendar_auth to connect your account.',
      };
    }

    try {
      const calendar = await getCalendarClient();
      const calendarId = params.calendarId || await resolveCalendarId(params.productId);
      
      // Validate event exists (will throw if not found)
      await calendar.events.get({
        calendarId,
        eventId: params.eventId,
      });

      // Build update payload
      const updates: calendar_v3.Schema$Event = {};

      if (params.title) updates.summary = params.title;
      if (params.description !== undefined) updates.description = params.description;
      if (params.location !== undefined) updates.location = params.location;

      if (params.start) {
        const startDate = new Date(params.start);
        if (isNaN(startDate.getTime())) {
          return { success: false, message: `Invalid start time: ${params.start}` };
        }
        updates.start = {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      if (params.end) {
        const endDate = new Date(params.end);
        if (isNaN(endDate.getTime())) {
          return { success: false, message: `Invalid end time: ${params.end}` };
        }
        updates.end = {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      const response = await calendar.events.patch({
        calendarId,
        eventId: params.eventId,
        requestBody: updates,
      });

      return {
        success: true,
        message: `Updated event "${response.data.summary}"`,
        data: formatEvent(response.data),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to update event: ${message}`,
      };
    }
  },
};

// ============ Delete Calendar Event ============
export const deleteCalendarEventTool: Tool = {
  name: 'delete_calendar_event',
  description: 'Delete a Google Calendar event.',
  parameters: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: 'Event ID to delete',
      },
      productId: {
        type: 'string',
        description: 'Product ID for calendar resolution',
      },
      calendarId: {
        type: 'string',
        description: 'Calendar ID (overrides product/global config)',
      },
    },
    required: ['eventId'],
  },

  async execute(params): Promise<ToolResult> {
    if (!await isAuthenticated()) {
      return {
        success: false,
        message: 'Google Calendar not authenticated. Use google_calendar_auth to connect your account.',
      };
    }

    try {
      const calendar = await getCalendarClient();
      const calendarId = params.calendarId || await resolveCalendarId(params.productId);

      // Get event info before deleting (for confirmation message)
      let eventTitle = params.eventId;
      try {
        const event = await calendar.events.get({
          calendarId,
          eventId: params.eventId,
        });
        eventTitle = event.data.summary || params.eventId;
      } catch {
        // Event might not exist, will fail on delete
      }

      await calendar.events.delete({
        calendarId,
        eventId: params.eventId,
      });

      return {
        success: true,
        message: `Deleted event "${eventTitle}"`,
        data: { eventId: params.eventId },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to delete event: ${message}`,
      };
    }
  },
};

// ============ List Calendars ============
export const listCalendarsTool: Tool = {
  name: 'list_calendars',
  description: 'List all available Google Calendars for the connected account.',
  parameters: {
    type: 'object',
    properties: {
      showHidden: {
        type: 'boolean',
        description: 'Include hidden calendars (default: false)',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    if (!await isAuthenticated()) {
      return {
        success: false,
        message: 'Google Calendar not authenticated. Use google_calendar_auth to connect your account.',
      };
    }

    try {
      const calendar = await getCalendarClient();

      const response = await calendar.calendarList.list({
        showHidden: params.showHidden || false,
      });

      const calendars = response.data.items || [];

      if (calendars.length === 0) {
        return {
          success: true,
          message: 'No calendars found.',
          data: [],
        };
      }

      return {
        success: true,
        message: `Found ${calendars.length} calendar(s)`,
        data: calendars.map(cal => ({
          id: cal.id,
          name: cal.summary,
          description: cal.description,
          primary: cal.primary || false,
          accessRole: cal.accessRole,
          backgroundColor: cal.backgroundColor,
          timeZone: cal.timeZone,
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to list calendars: ${message}`,
      };
    }
  },
};

// ============ Create Calendar ============
export const createCalendarTool: Tool = {
  name: 'create_calendar',
  description: 'Create a new Google Calendar. Returns the calendar ID which can be used in product config.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name for the new calendar (e.g., "ProofPing Marketing")',
      },
      description: {
        type: 'string',
        description: 'Description of the calendar (optional)',
      },
      timeZone: {
        type: 'string',
        description: 'Time zone (e.g., "America/New_York", default: UTC)',
      },
    },
    required: ['name'],
  },

  async execute(params): Promise<ToolResult> {
    if (!await isAuthenticated()) {
      return {
        success: false,
        message: 'Google Calendar not authenticated. Use google_calendar_auth to connect your account.',
      };
    }

    try {
      const calendar = await getCalendarClient();

      const response = await calendar.calendars.insert({
        requestBody: {
          summary: params.name,
          description: params.description,
          timeZone: params.timeZone || 'UTC',
        },
      });

      const newCalendar = response.data;

      return {
        success: true,
        message: `Created calendar "${params.name}"`,
        data: {
          id: newCalendar.id,
          name: newCalendar.summary,
          description: newCalendar.description,
          timeZone: newCalendar.timeZone,
          // Hint for user
          configHint: `Add to product config: "calendar": { "calendarId": "${newCalendar.id}" }`,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to create calendar: ${message}`,
      };
    }
  },
};

// ============ Google Calendar Auth ============
export const googleCalendarAuthTool: Tool = {
  name: 'google_calendar_auth',
  description: 'Start or complete Google Calendar OAuth authentication. First call generates auth URL, second call with code completes auth.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'complete', 'status'],
        description: 'Auth action: start (get URL), complete (submit code), status (check auth state)',
      },
      code: {
        type: 'string',
        description: 'Authorization code from Google (for "complete" action)',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const action = params.action || 'status';

    if (action === 'status') {
      const authenticated = await isAuthenticated();
      return {
        success: true,
        message: authenticated
          ? '✅ Google Calendar is connected and authenticated.'
          : '❌ Google Calendar is not authenticated. Use action="start" to begin OAuth flow.',
        data: { authenticated },
      };
    }

    if (action === 'start') {
      const authUrl = await getAuthUrl();
      if (!authUrl) {
        return {
          success: false,
          message: 'Google OAuth credentials not configured. See docs/CALENDAR.md for setup instructions.',
        };
      }

      return {
        success: true,
        message: `🔗 Open this URL to authorize Google Calendar access:\n\n${authUrl}\n\nAfter authorizing, use google_calendar_auth with action="complete" and the code you receive.`,
        data: { authUrl },
      };
    }

    if (action === 'complete') {
      if (!params.code) {
        return {
          success: false,
          message: 'Missing authorization code. Provide the code from Google OAuth.',
        };
      }

      const tokens = await exchangeCode(params.code);
      if (!tokens) {
        return {
          success: false,
          message: 'Failed to exchange authorization code. The code may be invalid or expired.',
        };
      }

      return {
        success: true,
        message: '✅ Google Calendar connected successfully! You can now use calendar tools.',
        data: { authenticated: true },
      };
    }

    return {
      success: false,
      message: `Unknown action: ${action}. Use "start", "complete", or "status".`,
    };
  },
};

// ============ Export All ============
export const calendarTools: Tool[] = [
  listCalendarEventsTool,
  createCalendarEventTool,
  updateCalendarEventTool,
  deleteCalendarEventTool,
  listCalendarsTool,
  createCalendarTool,
  googleCalendarAuthTool,
];
