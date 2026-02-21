# Skills & Marketplace

MarketClaw uses a modular skill system. Skills are self-contained packages that add capabilities to your agent.

> **Note**: The skill system is evolving. This document describes the architecture and roadmap.

## Overview

```
MarketClaw
├── Core (built-in, always available)
│   ├── Scheduling
│   ├── Knowledge base
│   ├── Memory
│   └── Email (Resend)
│
└── Skills (installable)
    ├── twitter        — Post tweets, threads, monitor
    ├── linkedin       — Professional content
    ├── producthunt    — Launch management
    ├── image-gen      — AI image generation
    └── ...more
```

## Core vs Skills

### Core Tools (Built-in)
Always available, essential for basic operation:
- **Scheduling** — Schedule posts, reminders
- **Knowledge** — Product knowledge base
- **Memory** — Products, campaigns, brand
- **Email** — Outbound email via Resend/SMTP

### Skills (Installable)
Optional capabilities, added as needed:
- **Social platforms** — Twitter, LinkedIn, etc.
- **Content tools** — Image generation, video
- **Integrations** — Analytics, CRM, etc.

## Installing Skills

### Via Marketplace (Coming Soon)

```bash
# Ask the agent
> "Install the Twitter skill"

# Or via CLI
marketclaw skill install twitter
```

### Manual Installation

1. Clone/download the skill to `~/.marketclaw/skills/`
2. Install dependencies: `npm install`
3. Register in config:

```yaml
skills:
  twitter:
    enabled: true
    # skill-specific config
```

## Skill Structure

Each skill is a self-contained package:

```
~/.marketclaw/skills/twitter/
├── package.json        # Dependencies & metadata
├── skill.json          # Skill manifest
├── index.ts            # Entry point
├── tools/              # Tool implementations
│   ├── post.ts
│   ├── thread.ts
│   └── search.ts
└── README.md           # Documentation
```

### skill.json Manifest

```json
{
  "name": "twitter",
  "version": "1.0.0",
  "description": "Twitter/X integration for MarketClaw",
  "author": "MarketClaw",
  
  "tools": [
    "post_tweet",
    "post_thread",
    "search_twitter",
    "get_my_tweets"
  ],
  
  "config": {
    "type": "object",
    "properties": {
      "defaultHashtags": {
        "type": "array",
        "description": "Default hashtags to include"
      }
    }
  },
  
  "secrets": [
    {
      "name": "TWITTER_COOKIES",
      "description": "Twitter authentication cookies",
      "required": true
    }
  ],
  
  "dependencies": {
    "node": ">=20"
  }
}
```

### Entry Point (index.ts)

```typescript
import { Skill, Tool } from '@marketclaw/skill-api';
import { postTweetTool } from './tools/post.js';
import { postThreadTool } from './tools/thread.js';

export default {
  name: 'twitter',
  
  async init(config: any): Promise<void> {
    // Initialize skill with config
  },
  
  getTools(): Tool[] {
    return [postTweetTool, postThreadTool];
  },
  
  async shutdown(): Promise<void> {
    // Cleanup
  },
} satisfies Skill;
```

## Creating a Skill

### 1. Initialize

```bash
mkdir -p ~/.marketclaw/skills/myskill
cd ~/.marketclaw/skills/myskill
npm init -y
```

### 2. Create skill.json

```json
{
  "name": "myskill",
  "version": "0.1.0",
  "description": "My custom skill",
  "tools": ["my_action"],
  "secrets": []
}
```

### 3. Implement Tools

```typescript
// tools/action.ts
import { Tool, ToolResult } from '@marketclaw/skill-api';

export const myActionTool: Tool = {
  name: 'my_action',
  description: 'Does something cool',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'The input' }
    },
    required: ['input']
  },
  
  async execute(params): Promise<ToolResult> {
    return {
      success: true,
      message: `Processed: ${params.input}`,
    };
  },
};
```

### 4. Create Entry Point

```typescript
// index.ts
import { myActionTool } from './tools/action.js';

export default {
  name: 'myskill',
  
  async init() {},
  
  getTools() {
    return [myActionTool];
  },
  
  async shutdown() {},
};
```

### 5. Test

```bash
marketclaw skill test myskill
```

## Marketplace

The marketplace is a registry of community skills:

### Browse

```bash
marketclaw marketplace search "social"
marketclaw marketplace list
```

### Install from Marketplace

```bash
marketclaw skill install twitter
# or
> "Install the Twitter skill"
```

The marketplace skill handles:
1. Fetching skill from registry
2. Installing dependencies
3. Prompting for config
4. Guiding secret setup
5. Registering tools

### Publish

```bash
cd ~/.marketclaw/skills/myskill
marketclaw marketplace publish
```

## Configuration

### Skill Config (Non-secrets)

Stored in `~/.marketclaw/config.yaml`:

```yaml
skills:
  twitter:
    enabled: true
    defaultHashtags: ["buildinpublic", "startup"]
  
  image-gen:
    enabled: true
    style: "minimalist"
```

### Secrets

Stored securely via CLI:

```bash
marketclaw config set TWITTER_COOKIES "..."
```

Or environment variables:

```bash
export TWITTER_COOKIES="..."
```

## Skill Lifecycle

```
Install → Init → Active → Shutdown
   │        │       │         │
   │        │       │         └─ Cleanup
   │        │       └─ Tools available
   │        └─ Load config, validate secrets
   └─ Download, install deps
```

## Best Practices

### Security
- Never hardcode secrets in skill code
- Validate all inputs
- Use skill.json to declare required secrets
- Document what permissions/access is needed

### Compatibility
- Specify minimum Node version
- Test with multiple MarketClaw versions
- Handle missing dependencies gracefully

### User Experience
- Provide clear descriptions
- Give helpful error messages
- Document setup steps in README

### Maintenance
- Keep dependencies updated
- Respond to issues
- Version properly (semver)

## Roadmap

- [ ] Skill sandbox/isolation
- [ ] Automatic updates
- [ ] Skill ratings & reviews
- [ ] Private skill registries
- [ ] Skill composition (skills using skills)
