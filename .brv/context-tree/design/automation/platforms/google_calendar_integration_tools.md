## Raw Concept
**Task:**
Document the Google Calendar integration tools and OAuth flow

**Files:**
- src/tools/calendar-tools.ts
- src/auth/google-calendar.ts

**Flow:**
Tool.execute -> resolveCalendarId(productId) -> getCalendarClient() -> Google Calendar API -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
Google Calendar integration is implemented using the official `googleapis` library. The `calendarTools` module in src/tools/calendar-tools.ts provides tools for managing events and calendars with support for per-product configuration.

### Features
Event management (list, create, update, delete), calendar management (list, create), and an interactive OAuth authentication flow.

### Rules
1. Calendar ID resolution priority: Product-specific config > Global config > "primary".
2. Time parameters must be in ISO 8601 format.
3. Attendees are added via email addresses; notifications are sent if attendees are present.
4. Reminders can be set as an array of minutes before the event.

### Examples
Google Calendar Tool Suite:
| Tool Name | Action | Description |
| :--- | :--- | :--- |
| `list_calendar_events` | `events.list` | Fetch upcoming events for a specific calendar and date range |
| `create_calendar_event` | `events.insert` | Create a new event with title, start/end, location, and attendees |
| `update_calendar_event` | `events.patch` | Modify an existing event by its ID |
| `delete_calendar_event` | `events.delete` | Permanently remove an event |
| `list_calendars` | `calendarList.list` | List all available calendars in the account |
| `create_calendar` | `calendars.insert` | Create a new secondary calendar |
| `google_calendar_auth` | N/A | Manage OAuth flow (start, complete, status) |
