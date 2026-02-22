/**
 * Calendar Tools Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listCalendarEventsTool,
  createCalendarEventTool,
  updateCalendarEventTool,
  deleteCalendarEventTool,
  listCalendarsTool,
  googleCalendarAuthTool,
} from './calendar-tools.js';

// Mock the auth module
vi.mock('../auth/google-calendar.js', () => ({
  isAuthenticated: vi.fn(),
  getCalendarClient: vi.fn(),
  getAuthUrl: vi.fn(),
  exchangeCode: vi.fn(),
}));

// Mock the config modules
vi.mock('./config.js', () => ({
  getProductToolConfig: vi.fn(),
}));

vi.mock('../config/index.js', () => ({
  loadConfig: vi.fn(),
}));

import { isAuthenticated, getCalendarClient, getAuthUrl, exchangeCode } from '../auth/google-calendar.js';
import { getProductToolConfig } from './config.js';
import { loadConfig } from '../config/index.js';

describe('Calendar Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated
    vi.mocked(isAuthenticated).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ list_calendar_events ============
  describe('list_calendar_events', () => {
    it('should return events when authenticated', async () => {
      const mockEvents = [
        {
          id: 'event1',
          summary: 'Team Meeting',
          description: 'Weekly sync',
          start: { dateTime: '2024-01-15T10:00:00Z' },
          end: { dateTime: '2024-01-15T11:00:00Z' },
          htmlLink: 'https://calendar.google.com/event1',
        },
        {
          id: 'event2',
          summary: 'Product Launch',
          start: { dateTime: '2024-01-16T14:00:00Z' },
          end: { dateTime: '2024-01-16T15:00:00Z' },
        },
      ];

      const mockCalendar = {
        events: {
          list: vi.fn().mockResolvedValue({ data: { items: mockEvents } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await listCalendarEventsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Found 2 event(s)');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].title).toBe('Team Meeting');
      expect(result.data[1].title).toBe('Product Launch');
    });

    it('should handle empty results', async () => {
      const mockCalendar = {
        events: {
          list: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await listCalendarEventsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('No upcoming events found.');
      expect(result.data).toEqual([]);
    });

    it('should fail when not authenticated', async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(false);

      const result = await listCalendarEventsTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('not authenticated');
    });

    it('should use product-specific calendar ID', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue({
        calendar: { calendarId: 'product-calendar@group.calendar.google.com' },
      });

      const mockCalendar = {
        events: {
          list: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await listCalendarEventsTool.execute({ productId: 'myproduct' });

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'product-calendar@group.calendar.google.com',
        })
      );
    });

    it('should fall back to global calendar ID', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(loadConfig).mockResolvedValue({
        calendar: { calendarId: 'global-calendar@group.calendar.google.com' },
      } as any);

      const mockCalendar = {
        events: {
          list: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await listCalendarEventsTool.execute({ productId: 'myproduct' });

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'global-calendar@group.calendar.google.com',
        })
      );
    });

    it('should default to primary calendar', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(loadConfig).mockResolvedValue({} as any);

      const mockCalendar = {
        events: {
          list: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await listCalendarEventsTool.execute({});

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'primary',
        })
      );
    });

    it('should support custom calendarId parameter', async () => {
      const mockCalendar = {
        events: {
          list: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await listCalendarEventsTool.execute({ calendarId: 'custom@group.calendar.google.com' });

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'custom@group.calendar.google.com',
        })
      );
    });

    it('should pass query parameter for filtering', async () => {
      const mockCalendar = {
        events: {
          list: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await listCalendarEventsTool.execute({ query: 'meeting' });

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'meeting',
        })
      );
    });
  });

  // ============ create_calendar_event ============
  describe('create_calendar_event', () => {
    it('should create an event successfully', async () => {
      const mockEvent = {
        id: 'new-event-id',
        summary: 'New Meeting',
        start: { dateTime: '2024-01-20T10:00:00Z' },
        end: { dateTime: '2024-01-20T11:00:00Z' },
        htmlLink: 'https://calendar.google.com/new-event',
      };

      const mockCalendar = {
        events: {
          insert: vi.fn().mockResolvedValue({ data: mockEvent }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await createCalendarEventTool.execute({
        title: 'New Meeting',
        start: '2024-01-20T10:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Created event');
      expect(result.message).toContain('New Meeting');
      expect(result.data.id).toBe('new-event-id');
    });

    it('should default end time to 1 hour after start', async () => {
      const mockCalendar = {
        events: {
          insert: vi.fn().mockResolvedValue({
            data: { id: 'event', summary: 'Test' },
          }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await createCalendarEventTool.execute({
        title: 'Test Event',
        start: '2024-01-20T10:00:00Z',
      });

      const insertCall = mockCalendar.events.insert.mock.calls[0][0];
      const startTime = new Date(insertCall.requestBody.start.dateTime).getTime();
      const endTime = new Date(insertCall.requestBody.end.dateTime).getTime();
      
      expect(endTime - startTime).toBe(60 * 60 * 1000); // 1 hour in ms
    });

    it('should add attendees when provided', async () => {
      const mockCalendar = {
        events: {
          insert: vi.fn().mockResolvedValue({
            data: { id: 'event', summary: 'Test' },
          }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await createCalendarEventTool.execute({
        title: 'Team Meeting',
        start: '2024-01-20T10:00:00Z',
        attendees: ['alice@example.com', 'bob@example.com'],
      });

      const insertCall = mockCalendar.events.insert.mock.calls[0][0];
      expect(insertCall.requestBody.attendees).toEqual([
        { email: 'alice@example.com' },
        { email: 'bob@example.com' },
      ]);
      expect(insertCall.sendUpdates).toBe('all');
    });

    it('should add custom reminders when provided', async () => {
      const mockCalendar = {
        events: {
          insert: vi.fn().mockResolvedValue({
            data: { id: 'event', summary: 'Test' },
          }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await createCalendarEventTool.execute({
        title: 'Important Meeting',
        start: '2024-01-20T10:00:00Z',
        reminders: [10, 60, 1440],
      });

      const insertCall = mockCalendar.events.insert.mock.calls[0][0];
      expect(insertCall.requestBody.reminders).toEqual({
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 1440 },
        ],
      });
    });

    it('should fail with invalid start time', async () => {
      const result = await createCalendarEventTool.execute({
        title: 'Test',
        start: 'invalid-date',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid start time');
    });

    it('should fail when not authenticated', async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(false);

      const result = await createCalendarEventTool.execute({
        title: 'Test',
        start: '2024-01-20T10:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not authenticated');
    });
  });

  // ============ update_calendar_event ============
  describe('update_calendar_event', () => {
    it('should update an event successfully', async () => {
      const mockCalendar = {
        events: {
          get: vi.fn().mockResolvedValue({
            data: { id: 'event1', summary: 'Old Title' },
          }),
          patch: vi.fn().mockResolvedValue({
            data: { id: 'event1', summary: 'New Title' },
          }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await updateCalendarEventTool.execute({
        eventId: 'event1',
        title: 'New Title',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated event');
      expect(mockCalendar.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event1',
          requestBody: expect.objectContaining({
            summary: 'New Title',
          }),
        })
      );
    });

    it('should update time fields', async () => {
      const mockCalendar = {
        events: {
          get: vi.fn().mockResolvedValue({
            data: { id: 'event1', summary: 'Meeting' },
          }),
          patch: vi.fn().mockResolvedValue({
            data: { id: 'event1', summary: 'Meeting' },
          }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await updateCalendarEventTool.execute({
        eventId: 'event1',
        start: '2024-01-25T14:00:00Z',
        end: '2024-01-25T15:00:00Z',
      });

      const patchCall = mockCalendar.events.patch.mock.calls[0][0];
      expect(patchCall.requestBody.start.dateTime).toBe('2024-01-25T14:00:00.000Z');
      expect(patchCall.requestBody.end.dateTime).toBe('2024-01-25T15:00:00.000Z');
    });

    it('should fail with invalid time', async () => {
      const mockCalendar = {
        events: {
          get: vi.fn().mockResolvedValue({
            data: { id: 'event1', summary: 'Meeting' },
          }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await updateCalendarEventTool.execute({
        eventId: 'event1',
        start: 'not-a-date',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid start time');
    });
  });

  // ============ delete_calendar_event ============
  describe('delete_calendar_event', () => {
    it('should delete an event successfully', async () => {
      const mockCalendar = {
        events: {
          get: vi.fn().mockResolvedValue({
            data: { id: 'event1', summary: 'To Delete' },
          }),
          delete: vi.fn().mockResolvedValue({}),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await deleteCalendarEventTool.execute({ eventId: 'event1' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Deleted event');
      expect(result.message).toContain('To Delete');
      expect(mockCalendar.events.delete).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'event1' })
      );
    });

    it('should handle deletion of non-existent event gracefully', async () => {
      const mockCalendar = {
        events: {
          get: vi.fn().mockRejectedValue(new Error('Not found')),
          delete: vi.fn().mockRejectedValue(new Error('Not found')),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await deleteCalendarEventTool.execute({ eventId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to delete');
    });
  });

  // ============ list_calendars ============
  describe('list_calendars', () => {
    it('should list all calendars', async () => {
      const mockCalendars = [
        {
          id: 'primary',
          summary: 'Personal',
          primary: true,
          accessRole: 'owner',
        },
        {
          id: 'work@group.calendar.google.com',
          summary: 'Work',
          accessRole: 'writer',
        },
      ];

      const mockCalendar = {
        calendarList: {
          list: vi.fn().mockResolvedValue({ data: { items: mockCalendars } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await listCalendarsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Found 2 calendar(s)');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Personal');
      expect(result.data[0].primary).toBe(true);
      expect(result.data[1].name).toBe('Work');
    });

    it('should handle empty calendar list', async () => {
      const mockCalendar = {
        calendarList: {
          list: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await listCalendarsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('No calendars found.');
      expect(result.data).toEqual([]);
    });
  });

  // ============ google_calendar_auth ============
  describe('google_calendar_auth', () => {
    it('should return status when authenticated', async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(true);

      const result = await googleCalendarAuthTool.execute({ action: 'status' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('connected');
      expect(result.data.authenticated).toBe(true);
    });

    it('should return status when not authenticated', async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(false);

      const result = await googleCalendarAuthTool.execute({ action: 'status' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('not authenticated');
      expect(result.data.authenticated).toBe(false);
    });

    it('should return auth URL on start action', async () => {
      vi.mocked(getAuthUrl).mockResolvedValue('https://accounts.google.com/oauth?...');

      const result = await googleCalendarAuthTool.execute({ action: 'start' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('https://accounts.google.com');
      expect(result.data.authUrl).toBe('https://accounts.google.com/oauth?...');
    });

    it('should fail start when credentials not configured', async () => {
      vi.mocked(getAuthUrl).mockResolvedValue(null);

      const result = await googleCalendarAuthTool.execute({ action: 'start' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('should complete auth flow with code', async () => {
      vi.mocked(exchangeCode).mockResolvedValue({
        access_token: 'token123',
        refresh_token: 'refresh123',
      });

      const result = await googleCalendarAuthTool.execute({
        action: 'complete',
        code: 'auth-code-123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('connected successfully');
      expect(exchangeCode).toHaveBeenCalledWith('auth-code-123');
    });

    it('should fail complete without code', async () => {
      const result = await googleCalendarAuthTool.execute({ action: 'complete' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing authorization code');
    });

    it('should fail complete with invalid code', async () => {
      vi.mocked(exchangeCode).mockResolvedValue(null);

      const result = await googleCalendarAuthTool.execute({
        action: 'complete',
        code: 'invalid-code',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid or expired');
    });

    it('should default to status action', async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(true);

      const result = await googleCalendarAuthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data.authenticated).toBe(true);
    });
  });

  // ============ Calendar Resolution Logic ============
  describe('Calendar ID Resolution', () => {
    it('should prioritize product config over global', async () => {
      // Product has specific calendar
      vi.mocked(getProductToolConfig).mockResolvedValue({
        calendar: { calendarId: 'product-calendar' },
      });
      // Global also has calendar
      vi.mocked(loadConfig).mockResolvedValue({
        calendar: { calendarId: 'global-calendar' },
      } as any);

      const mockCalendar = {
        events: {
          list: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await listCalendarEventsTool.execute({ productId: 'myproduct' });

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'product-calendar',
        })
      );
    });

    it('should use explicit calendarId over any config', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue({
        calendar: { calendarId: 'product-calendar' },
      });

      const mockCalendar = {
        events: {
          list: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      await listCalendarEventsTool.execute({
        productId: 'myproduct',
        calendarId: 'explicit-calendar',
      });

      expect(mockCalendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'explicit-calendar',
        })
      );
    });
  });

  // ============ Error Handling ============
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockCalendar = {
        events: {
          list: vi.fn().mockRejectedValue(new Error('API rate limit exceeded')),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await listCalendarEventsTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('API rate limit exceeded');
    });

    it('should handle network errors', async () => {
      const mockCalendar = {
        events: {
          list: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await listCalendarEventsTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });

    it('should handle permission errors', async () => {
      const mockCalendar = {
        events: {
          insert: vi.fn().mockRejectedValue(new Error('Insufficient permission')),
        },
      };
      vi.mocked(getCalendarClient).mockResolvedValue(mockCalendar as any);

      const result = await createCalendarEventTool.execute({
        title: 'Test',
        start: '2024-01-20T10:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient permission');
    });
  });
});
