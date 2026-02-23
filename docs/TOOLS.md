# Tools

MarketClaw uses tools to interact with external services and perform actions. This document covers the available tools and how to add your own.

## How Tools Work

Tools are functions that the AI can call to:
- Get information (check inbox, search knowledge base)
- Take actions (schedule posts, send emails)
- Generate content (create images, draft posts)

Each tool has:
- **Name**: Unique identifier (snake_case)
- **Description**: What it does (helps AI decide when to use it)
- **Parameters**: JSON Schema defining inputs
- **Execute function**: The actual implementation

## Built-in Tools

### 📅 Scheduling Tools

| Tool | Description |
|------|-------------|
| `schedule_task` | Schedule any automated AI task (posts, emails, reports, etc.) |
| `schedule_reminder` | Set a simple reminder |
| `list_scheduled_jobs` | List all scheduled jobs |
| `cancel_scheduled_job` | Cancel a scheduled job |
| `pause_scheduled_job` | Pause a job |
| `resume_scheduled_job` | Resume a paused job |
| `run_job_now` | Execute a job immediately |

#### Automated Tasks

The `schedule_task` tool is the **primary scheduling tool**. It schedules tasks that the AI will actually **execute**, not just remind you about. Use it for everything: social posts, emails, reports, inbox monitoring, etc.

```
User: "Post to Twitter every day at 9am with a tip"

MarketClaw creates a task that:
1. Runs every day at 9am
2. Invokes the AI with the task prompt
3. AI uses tools (post_tweet, etc.) to complete the task
4. Notifies you of the results
```

**Parameters:**
- `name` — Name for the task (e.g., "Daily Twitter Post")
- `task` — What the AI should do (e.g., "Post a helpful tip about uptime monitoring to Twitter")
- `when` — Schedule (e.g., "every hour", "every day at 9am")
- `productId` — Product context (optional)
- `campaignId` — Campaign context (optional)
- `notify` — Send results to user (default: true)

**Examples:**
- "Post to Twitter every morning at 9am with a tip about ProofPing"
- "Send daily summary email to brett@example.com at 6pm"
- "Check inbox and respond to leads every 30 minutes"
- "Generate weekly campaign report every Monday"

### 📚 Knowledge Tools

| Tool | Description |
|------|-------------|
| `search_knowledge` | Search product knowledge base |
| `add_knowledge` | Add new knowledge entry |
| `get_brand_voice` | Get brand voice guidelines |
| `get_product_info` | Get product details |

### 🐦 Twitter Tools

| Tool | Description |
|------|-------------|
| `post_tweet` | Post a tweet |
| `post_thread` | Post a Twitter thread |
| `get_my_tweets` | Get recent tweets |
| `search_twitter` | Search Twitter |

### 💼 LinkedIn Tools

| Tool | Description |
|------|-------------|
| `post_linkedin` | Post to LinkedIn |
| `get_linkedin_posts` | Get recent posts |

### 🚀 Product Hunt Tools

| Tool | Description |
|------|-------------|
| `draft_ph_launch` | Draft a Product Hunt launch |
| `get_ph_trending` | Get trending products |
| `search_ph` | Search Product Hunt |

### 📧 Email Tools

| Tool | Description |
|------|-------------|
| `send_email` | Send email via Resend |
| `check_inbox` | Check inbox (IMAP) |
| `search_emails` | Search emails |
| `read_email_thread` | Read full thread |

### 🖼️ Image Tools

| Tool | Description |
|------|-------------|
| `generate_image` | Generate image via DALL-E |
| `get_image_path` | Get path to generated image |

### 📊 Campaign Tools

| Tool | Description |
|------|-------------|
| `create_campaign` | Create a marketing campaign |
| `list_campaigns` | List campaigns (filter by product/status) |
| `get_campaign` | Get campaign details with posts |
| `update_campaign` | Update campaign status/details |
| `delete_campaign` | Delete a campaign |
| `add_campaign_post` | Add content to a campaign |
| `get_campaign_post` | Get full post content (not truncated) |
| `update_campaign_post` | Update a post in a campaign |
| `set_active_campaign` | Set active campaign (per-member) |
| `get_campaign_metrics` | Get aggregated metrics + costs |
| `get_campaign_costs` | Detailed cost breakdown |

Campaigns auto-create when you add posts without specifying one:
```
User: "Draft a tweet for ProofPing"
→ Auto-creates "ProofPing — General" campaign
→ Adds post to it
```

**Per-member active campaigns:** Each team member has their own active campaign context. Setting your active campaign doesn't affect other team members.

### 👥 Leads Tools

| Tool | Description |
|------|-------------|
| `add_lead` | Add a new lead |
| `list_leads` | List all leads |
| `update_lead` | Update lead status |
| `add_lead_note` | Add note to lead |

### 📆 Calendar Tools

| Tool | Description |
|------|-------------|
| `list_calendar_events` | List upcoming Google Calendar events |
| `create_calendar_event` | Create a new calendar event |
| `update_calendar_event` | Update an existing event |
| `delete_calendar_event` | Delete an event |
| `list_calendars` | List available calendars |
| `create_calendar` | Create a new calendar (for product-specific use) |
| `google_calendar_auth` | Authenticate with Google Calendar |

Calendar tools support product-specific calendars. See [CALENDAR.md](./CALENDAR.md) for full setup and configuration.

**Examples:**
- "What's on my calendar tomorrow?"
- "Schedule a launch meeting for Monday 2pm"
- "Create a calendar for ProofPing"
- "Delete the team sync event"

### 📦 Product Tools

| Tool | Description |
|------|-------------|
| `create_product` | Create a new product to manage marketing for |
| `delete_product` | Delete a product and all its associated data |
| `update_product` | Update basic product information (name, description) |

**Examples:**
- "Create a product called ProofPing"
- "Update ProofPing's tagline to 'Uptime monitoring that just works'"
- "Delete the old_product product"

### ⚙️ Config Tools

| Tool | Description |
|------|-------------|
| `get_product_config` | Get product config |
| `set_product_config` | Set product config value |

### 🌐 Browser Automation Tools

Browser automation allows posting to social media via the MarketClaw Chrome extension. No API costs — posts like a human using your logged-in sessions.

**Requires:** MarketClaw Chrome extension installed and connected.

#### Generic Tools

| Tool | Description |
|------|-------------|
| `browser_post` | Post to any platform (10 supported) |
| `browser_status` | Check extension connection and profiles |
| `browser_navigate` | Open a URL in browser |
| `browser_click` | Click element by CSS selector |
| `browser_type` | Type text into element |
| `browser_find` | Find elements matching selector |
| `browser_wait` | Wait for element to appear |
| `browser_page_info` | Get page URL, title, dimensions |
| `browser_scroll` | Scroll page |
| `browser_get_text` | Get text content of element |

#### Platform-Specific Tools

| Tool | Platform | Actions |
|------|----------|---------|
| `reddit_post` | Reddit | `post`, `comment` |
| `hn_submit` | Hacker News | `submit`, `comment`, `upvote` |
| `ph_interact` | Product Hunt | `upvote`, `comment`, `reply` |
| `instagram_interact` | Instagram | `comment`, `dm` |
| `facebook_post` | Facebook | `post`, `comment`, `like` |
| `threads_post` | Threads | `post`, `reply`, `like` |
| `bluesky_post` | Bluesky | `post`, `reply`, `like`, `repost` |
| `youtube_interact` | YouTube | `comment`, `reply`, `like`, `subscribe` |

#### Supported Platforms

| Platform | Via browser_post | Dedicated Tool |
|----------|------------------|----------------|
| Twitter/X | ✅ | — |
| LinkedIn | ✅ | — |
| Reddit | ✅ | `reddit_post` |
| Instagram | ✅ | `instagram_interact` |
| Hacker News | ✅ | `hn_submit` |
| Product Hunt | ✅ | `ph_interact` |
| Facebook | ✅ | `facebook_post` |
| Threads | ✅ | `threads_post` |
| Bluesky | ✅ | `bluesky_post` |
| YouTube | ✅ | `youtube_interact` |

#### Profile Support

Target specific Chrome profiles for multi-account management:

```
browser_post({ platform: 'twitter', content: 'Hello!', profile: 'Work' })
```

**Examples:**
- "Post to Twitter: Hello world!"
- "Comment on this Reddit post with 'Great insight!'"
- "Upvote this Product Hunt launch"
- "Like this YouTube video"
- "Post to Bluesky from my personal account"

See [extension/README.md](../extension/README.md) for full documentation.

---

## Creating a Tool

### Basic Structure

```typescript
import { Tool, ToolResult } from '../tools/types.js';

export const myTool: Tool = {
  name: 'my_tool',
  
  description: 'Does something useful. Use when the user asks to...',
  
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to process',
      },
      count: {
        type: 'number',
        description: 'How many times (default: 1)',
      },
    },
    required: ['message'],
  },
  
  async execute(params): Promise<ToolResult> {
    try {
      // Do the work
      const result = await doSomething(params.message, params.count || 1);
      
      return {
        success: true,
        message: 'Successfully did the thing',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed: ${error.message}`,
      };
    }
  },
};
```

### Register the Tool

```typescript
// In src/tools/index.ts
import { myTools } from './my-tools.js';

export async function initializeTools(): Promise<void> {
  // ... existing registrations ...
  
  toolRegistry.registerAll(myTools, { category: 'utility' });
}
```

### Categories

Tools are organized by category:
- `scheduling` — Time-based actions
- `knowledge` — Product knowledge
- `marketing` — Content & campaigns
- `social` — Social media
- `utility` — General purpose

### Tool Result Format

```typescript
interface ToolResult {
  success: boolean;      // Did it work?
  message: string;       // Human-readable result
  data?: any;            // Optional structured data
}
```

---

## Tool Parameters

### Types

```typescript
// String
{ type: 'string', description: '...' }

// Number
{ type: 'number', description: '...' }

// Boolean
{ type: 'boolean', description: '...' }

// Enum
{ type: 'string', enum: ['option1', 'option2'], description: '...' }

// Array
{ type: 'array', items: { type: 'string' }, description: '...' }

// Object
{ 
  type: 'object', 
  properties: { 
    nested: { type: 'string' } 
  }, 
  description: '...' 
}
```

### Best Practices

1. **Clear descriptions** — Help the AI understand when to use the tool
2. **Sensible defaults** — Don't require parameters that have obvious defaults
3. **Validate inputs** — Check parameters before doing work
4. **Meaningful errors** — Return helpful error messages
5. **Structured data** — Return data the AI can use

---

## Tool Execution Flow

1. User sends message
2. AI analyzes and decides which tools to use
3. AI generates tool calls with parameters
4. MarketClaw executes tools and returns results
5. AI incorporates results into response
6. User sees final message

```
User: "Schedule a tweet about our launch for tomorrow 9am"
  ↓
AI: tool_call(schedule_task, {name: 'Launch Tweet', task: 'Post to Twitter: ...', when: 'tomorrow at 9am'})
  ↓
Tool: Executes, returns {success: true, message: 'Scheduled...', data: {jobId: '123'}}
  ↓
AI: "Done! I've scheduled your tweet for tomorrow at 9am."
```

---

## Disabling Tools

You can disable tools that aren't needed:

```typescript
import { toolRegistry } from './tools/index.js';

// Disable specific tools
toolRegistry.disable('post_tweet');
toolRegistry.disable('post_linkedin');

// Enable later
toolRegistry.enable('post_tweet');
```

Or filter during registration:

```typescript
// Only register non-social tools
const coreTools = [schedulerTools, knowledgeTools, emailTools];
for (const tools of coreTools) {
  toolRegistry.registerAll(tools);
}
```

---

## Testing Tools

```typescript
import { toolRegistry } from './tools/index.js';

// Test a tool directly
const result = await toolRegistry.execute('search_knowledge', {
  productId: 'myproduct',
  query: 'pricing',
});

console.log(result);
// { success: true, message: 'Found 3 results', data: [...] }
```

---

## External API Tools

When tools need external APIs:

```typescript
export const apiTool: Tool = {
  name: 'fetch_data',
  description: 'Fetch data from API',
  parameters: { type: 'object', properties: {} },
  
  async execute(): Promise<ToolResult> {
    const apiKey = process.env.MY_API_KEY;
    
    if (!apiKey) {
      return {
        success: false,
        message: 'API key not configured. Set MY_API_KEY environment variable.',
      };
    }
    
    // Make API call...
  },
};
```

Always:
- Check for required credentials
- Handle API errors gracefully
- Respect rate limits
- Return meaningful error messages
