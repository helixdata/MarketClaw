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
| `schedule_post` | Schedule a post for later |
| `list_scheduled_posts` | Show upcoming scheduled posts |
| `cancel_scheduled_post` | Cancel a scheduled post |
| `add_reminder` | Add a reminder |
| `list_reminders` | Show active reminders |

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

### 👥 Leads Tools

| Tool | Description |
|------|-------------|
| `add_lead` | Add a new lead |
| `list_leads` | List all leads |
| `update_lead` | Update lead status |
| `add_lead_note` | Add note to lead |

### ⚙️ Config Tools

| Tool | Description |
|------|-------------|
| `get_product_config` | Get product config |
| `set_product_config` | Set product config value |

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
AI: tool_call(schedule_post, {channel: 'twitter', content: '...', time: '...'})
  ↓
Tool: Executes, returns {success: true, message: 'Scheduled for...', data: {id: '123'}}
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
