# Architecture

This document provides an overview of MarketClaw's system design and internal architecture.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         MarketClaw                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │ Telegram │    │ Discord  │    │  Slack   │    │   CLI    │ │
│   └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘ │
│        │               │               │               │        │
│        └───────────────┴───────────────┴───────────────┘        │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │  Channel Router   │                        │
│                    └─────────┬─────────┘                        │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │   Agent Core      │                        │
│                    │  (Conversation)   │                        │
│                    └─────────┬─────────┘                        │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│   ┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐       │
│   │ Providers │       │   Tools   │       │Sub-Agents │       │
│   │ (AI/LLM)  │       │ (Actions) │       │(Specialists)│       │
│   └───────────┘       └───────────┘       └───────────┘       │
│                                                                  │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │                    Memory / State                          │ │
│   │  (Products, Campaigns, Knowledge, Team, Costs, Sessions)  │ │
│   └───────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Channels (`src/channels/`)

Channels are the user-facing interfaces. Each channel implements a common interface:

```typescript
interface Channel {
  name: string;
  initialize(config: ChannelConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(userId: string, message: string, options?: SendOptions): Promise<void>;
}
```

**Supported channels:**
- **Telegram** — Bot API with inline buttons and rich media
- **Discord** — Server/guild support with mentions and attachments
- **Slack** — Workspace integration via Bolt (socket mode)
- **CLI** — Local development and testing

### 2. Providers (`src/providers/`)

Providers abstract AI/LLM services. All providers implement:

```typescript
interface Provider {
  name: string;
  init(config: ProviderConfig): Promise<void>;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  listModels(): Promise<string[]>;
}
```

**Supported providers:**
- Anthropic (Claude)
- OpenAI (GPT)
- Groq (fast inference)
- Google Gemini
- Ollama (local)
- OpenRouter (multi-provider)

### 3. Tools (`src/tools/`)

Tools are actions the agent can take. Each tool has:

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(params: any): Promise<ToolResult>;
}
```

**Tool categories:**
- `scheduling` — Post scheduling, reminders
- `knowledge` — Product knowledge base, RAG
- `marketing` — Email, social posts, leads
- `social` — Twitter, LinkedIn, Product Hunt
- `utility` — Config, costs, admin

### 4. Sub-Agents (`src/agents/`)

Specialists that handle domain-specific tasks:

```typescript
interface SubAgentConfig {
  identity: { name, emoji, persona, voice };
  specialty: { description, systemPrompt, tools };
  model?: string;  // Optional model override
}
```

**Built-in agents:**
- 🐦 Tweety (Twitter)
- 💼 Quinn (LinkedIn)
- ✉️ Emma (Email)
- 🎨 Pixel (Creative)
- 📊 Dash (Analytics)
- 🔍 Scout (Research)
- 🚀 Hunter (Product Hunt)

### 5. Memory (`src/memory/`)

Persistent state across sessions:

```
~/.marketclaw/workspace/
├── BRAND.md           # Brand voice and guidelines
├── products/          # Product definitions (JSON)
├── campaigns/         # Campaign history
├── sessions/          # Conversation logs
├── costs/             # Cost tracking data
└── state.json         # Runtime state
```

### 6. Team (`src/team/`)

Multi-user support with roles and permissions:

```typescript
type Role = 'admin' | 'manager' | 'creator' | 'viewer';

interface TeamMember {
  id: string;
  name: string;
  defaultRole: Role;
  productRoles?: Record<string, Role>;
}
```

### 7. Approvals (`src/approvals/`)

Content approval workflow for teams:

```
Creator → Submit Content → Approvers Notified → Approve/Reject → Post
```

### 8. Costs (`src/costs/`)

Usage tracking and budget management:

```typescript
interface ToolCost {
  usd: number;
  provider: string;
  units?: number;
  unitType?: 'tokens' | 'emails' | 'images';
}
```

## Data Flow

### Message Processing

```
1. User sends message via Channel (Telegram, etc.)
           │
           ▼
2. Channel authenticates user (allowedUsers check)
           │
           ▼
3. Message routed to Agent Core
           │
           ▼
4. Agent builds context:
   - System prompt (brand, persona)
   - Conversation history
   - Active product/campaign
           │
           ▼
5. Provider generates response with tool calls
           │
           ▼
6. Tool Registry executes tools:
   - Permission check (team roles)
   - Budget check (costs)
   - Execute tool
   - Log cost
           │
           ▼
7. Loop until no more tool calls
           │
           ▼
8. Final response sent via Channel
```

### Tool Execution with Costs

```
Tool Call
    │
    ▼
Check Budget ──── Exceeded? ──── Block + Error
    │                              
    │ OK
    ▼
Execute Tool
    │
    ▼
Log Cost (if tool returns cost)
    │
    ▼
Return Result
```

## Extension Points

### Adding a New Provider

1. Create `src/providers/newprovider.ts`
2. Implement `Provider` interface
3. Register in `src/providers/index.ts`

### Adding a New Tool

1. Create tool in `src/tools/` or a skill
2. Implement `Tool` interface
3. Register in `src/tools/index.ts`
4. Optionally add to `TOOL_PERMISSIONS` for access control

### Adding a New Channel

1. Create `src/channels/newchannel.ts`
2. Implement `Channel` interface
3. Register in `src/channels/registry.ts`

### Adding a Sub-Agent

1. Define manifest in `src/agents/specialists.ts` or custom JSON
2. Include identity, voice, expertise, and allowed tools
3. Optionally set a specific model

## Configuration

### Config File (`~/.marketclaw/config.yaml`)

```yaml
telegram:
  botToken: ${TELEGRAM_BOT_TOKEN}
  allowedUsers: [123456789]

providers:
  default: anthropic
  anthropic:
    model: claude-sonnet-4-5-20250514

agent:
  name: MarketClaw
  emoji: 🦀
  voice: friendly
```

### Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=

# AI Providers (at least one)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Optional integrations
RESEND_API_KEY=
TWITTER_COOKIES=
```

## Startup Sequence

```
1. Load config (YAML + env vars)
2. Initialize provider (AI)
3. Register tools
4. Load skills
5. Initialize sub-agents
6. Load team members
7. Initialize approvals
8. Start channel
9. Load scheduler jobs
10. Ready for messages
```

## Error Handling

- **Provider errors**: Retried with exponential backoff
- **Tool errors**: Caught and returned to agent for recovery
- **Channel errors**: Logged, connection retry for webhooks
- **Budget exceeded**: Tool blocked with clear error message

## Testing

```bash
# Unit tests
npm test

# Coverage
npm test -- --coverage

# Type checking
npm run typecheck
```

Tests use Vitest with mocked dependencies. See `*.test.ts` files for patterns.
