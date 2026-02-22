# Google Calendar Integration

MarketClaw integrates with Google Calendar to help you manage events, schedule marketing activities, and keep your calendar in sync with your campaigns.

## Features

- 📅 **List Events** — View upcoming calendar events
- ➕ **Create Events** — Schedule new events with reminders and attendees
- ✏️ **Update Events** — Modify existing events
- 🗑️ **Delete Events** — Remove events
- 📋 **List Calendars** — See all available calendars
- 🔗 **Product-Specific Calendars** — Different calendars per product
- 🤖 **Scheduler Integration** — Optionally create calendar events for scheduled posts

---

## Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Go to **APIs & Services** > **Library**
   - Search for "Google Calendar API"
   - Click **Enable**

### 2. Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - Choose "External" (or "Internal" for Google Workspace)
   - Fill in required fields (app name, email)
   - Add scopes: `calendar.events`, `calendar.readonly`
   - Add your email as a test user
4. Create OAuth client:
   - Application type: **Desktop app**
   - Name: "MarketClaw"
   - Download the credentials JSON file

### 3. Install Credentials

Save the credentials JSON to `~/.marketclaw/google-credentials.json`:

```bash
# Copy downloaded file
cp ~/Downloads/client_secret_*.json ~/.marketclaw/google-credentials.json

# Or create manually:
cat > ~/.marketclaw/google-credentials.json << 'EOF'
{
  "client_id": "your-client-id.apps.googleusercontent.com",
  "client_secret": "your-client-secret",
  "redirect_uri": "urn:ietf:wg:oauth:2.0:oob"
}
EOF
```

### 4. Authenticate

In chat with MarketClaw:

```
You: "Connect my Google Calendar"

MarketClaw: 🔗 Open this URL to authorize Google Calendar access:
            https://accounts.google.com/o/oauth2/auth?...
            
            After authorizing, use google_calendar_auth with the code you receive.

You: "Complete calendar auth with code 4/0AY0e-xxx..."

MarketClaw: ✅ Google Calendar connected successfully!
```

Or use the tool directly:

```
You: "Use google_calendar_auth with action start"
# Get URL, authorize, copy code

You: "Use google_calendar_auth with action complete and code 4/0AY0e-xxx"
# Connected!
```

---

## Configuration

### Global Config

In `~/.marketclaw/config.yaml`:

```yaml
calendar:
  provider: google
  calendarId: primary                    # Default calendar to use
  createEventsForScheduledPosts: true    # Auto-create events for scheduled posts
```

### Per-Product Config

Different products can use different calendars. In `~/.marketclaw/workspace/products/{productId}/tools.json`:

```json
{
  "calendar": {
    "calendarId": "marketing-calendar@group.calendar.google.com"
  }
}
```

### Calendar ID Resolution

When determining which calendar to use:

1. **Explicit parameter** — `calendarId` passed to the tool
2. **Product config** — Product-specific `calendar.calendarId`
3. **Global config** — Default `calendar.calendarId`
4. **Primary** — Falls back to `'primary'` (user's main calendar)

---

## Tools

### list_calendar_events

List upcoming events from Google Calendar.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `productId` | string | Product ID for calendar resolution |
| `calendarId` | string | Override calendar ID |
| `timeMin` | string | Start of range (ISO 8601, default: now) |
| `timeMax` | string | End of range (ISO 8601, default: 7 days) |
| `maxResults` | number | Max events to return (default: 10) |
| `query` | string | Search filter |

**Example:**
```
You: "What's on my calendar this week?"

MarketClaw: 📅 Found 3 event(s):
• Team Meeting — Tomorrow 10:00 AM
• Product Launch — Wed 2:00 PM  
• Marketing Review — Fri 9:00 AM
```

### create_calendar_event

Create a new calendar event.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | ✅ | Event title |
| `start` | string | ✅ | Start time (ISO 8601) |
| `end` | string | | End time (default: 1 hour after start) |
| `description` | string | | Event notes |
| `location` | string | | Event location |
| `attendees` | string[] | | Email addresses to invite |
| `reminders` | number[] | | Minutes before event for reminders |
| `productId` | string | | Product context |
| `calendarId` | string | | Override calendar |

**Example:**
```
You: "Create a calendar event for product launch tomorrow at 2pm"

MarketClaw: ✅ Created event "Product Launch" for Jan 20, 2024 2:00 PM
```

### update_calendar_event

Update an existing event.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | ✅ | Event ID to update |
| `title` | string | | New title |
| `start` | string | | New start time |
| `end` | string | | New end time |
| `description` | string | | New description |
| `location` | string | | New location |

**Example:**
```
You: "Move the product launch meeting to 3pm"

MarketClaw: ✅ Updated event "Product Launch" — now at 3:00 PM
```

### delete_calendar_event

Delete an event.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | ✅ | Event ID to delete |
| `calendarId` | string | | Calendar containing the event |

**Example:**
```
You: "Delete the product launch event"

MarketClaw: ✅ Deleted event "Product Launch"
```

### list_calendars

List all available calendars.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `showHidden` | boolean | Include hidden calendars |

**Example:**
```
You: "What calendars do I have?"

MarketClaw: 📋 Found 3 calendar(s):
• Personal (primary) — owner
• Work — writer
• Marketing Team — reader
```

### create_calendar

Create a new Google Calendar. Useful for creating product-specific calendars.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ✅ | Name for the calendar |
| `description` | string | | Calendar description |
| `timeZone` | string | | Time zone (default: UTC) |

**Example:**
```
You: "Create a calendar for ProofPing"

MarketClaw: ✅ Created calendar "ProofPing"
📆 ID: abc123@group.calendar.google.com
💡 Add to product config: "calendar": { "calendarId": "abc123@group.calendar.google.com" }
```

The returned calendar ID can be added to your product's `tools.json` to use it as the default for that product.

### google_calendar_auth

Manage Google Calendar authentication.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | `start`, `complete`, or `status` |
| `code` | string | Authorization code (for `complete`) |

---

## Examples

### Quick Start

```
You: "Check my calendar for tomorrow"

MarketClaw: 📅 Tomorrow's events:
• 9:00 AM — Stand-up Meeting
• 2:00 PM — Client Call
• 4:30 PM — Marketing Review
```

### Create Event with Details

```
You: "Schedule a launch planning meeting next Monday at 10am, 
      invite alice@company.com and bob@company.com, 
      remind me 1 hour and 10 minutes before"

MarketClaw: ✅ Created event "Launch Planning Meeting"
📅 Monday, Jan 22 at 10:00 AM
👥 Invitations sent to alice@company.com, bob@company.com
⏰ Reminders: 1 hour before, 10 minutes before
```

### Use Product-Specific Calendar

```
You: "Add a ProofPing feature demo to the calendar for Friday 3pm"

MarketClaw: ✅ Created event "ProofPing Feature Demo" 
📅 Friday, Jan 26 at 3:00 PM
📆 Calendar: ProofPing Marketing (product-specific)
```

### Search Events

```
You: "Find all meetings about launch on my calendar"

MarketClaw: 🔍 Found 2 event(s) matching "launch":
• Product Launch Planning — Tomorrow 10:00 AM
• Launch Retrospective — Next week Friday 2:00 PM
```

---

## Scheduler Integration

When `createEventsForScheduledPosts: true` in config, scheduling a post can automatically create a calendar event.

```yaml
# config.yaml
calendar:
  createEventsForScheduledPosts: true
```

```
You: "Schedule a tweet about our launch for tomorrow 9am"

MarketClaw: ✅ Scheduled tweet for tomorrow 9:00 AM
📅 Calendar event created: "Scheduled: Tweet about launch"
```

---

## Troubleshooting

### "Google Calendar not configured"

Missing credentials file. Ensure `~/.marketclaw/google-credentials.json` exists with valid OAuth credentials.

### "Google Calendar not authenticated"

Need to complete OAuth flow:
```
You: "Use google_calendar_auth action start"
# Follow URL, authorize, get code

You: "Use google_calendar_auth action complete code YOUR_CODE"
```

### "Insufficient permission"

The calendar may be read-only or you don't have write access. Check calendar sharing settings.

### "Invalid credentials"

OAuth credentials may be invalid or revoked. Re-download from Google Cloud Console.

### Token Expired

Tokens auto-refresh. If persistent issues, clear tokens and re-auth:

```bash
rm ~/.marketclaw/google-tokens.json
# Then re-authenticate via google_calendar_auth
```

---

## Security

- OAuth tokens stored in `~/.marketclaw/google-tokens.json` with restricted permissions (0600)
- Client secrets stored in `~/.marketclaw/google-credentials.json`
- Tokens auto-refresh when expired
- Use "Desktop app" OAuth type for CLI usage
- Add your email as test user during consent screen setup

---

## Future Enhancements

- [ ] Create calendar events from campaigns automatically
- [ ] Sync scheduled posts with calendar
- [ ] Calendar-based content planning view
- [ ] Recurring event patterns for campaigns
- [ ] Meeting scheduling with availability lookup
