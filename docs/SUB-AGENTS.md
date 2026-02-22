# Sub-Agents

MarketClaw includes a system of specialized sub-agents that handle specific marketing tasks. Think of them as your AI marketing team.

## Overview

Sub-agents are specialists with their own:
- **Identity** — Name, emoji, and persona
- **Voice** — Communication style (professional, casual, friendly, playful)
- **Expertise** — Domain knowledge and system prompt
- **Tools** — Specific tools they can use

## Built-in Specialists

| Agent | Emoji | Name | Specialty |
|-------|-------|------|-----------|
| `twitter` | 🐦 | Tweety | Viral tweets, threads, hooks |
| `linkedin` | 💼 | Quinn | B2B content, thought leadership |
| `email` | ✉️ | Emma | Email marketing, cold outreach |
| `creative` | 🎨 | Pixel | Visual content, image prompts |
| `analyst` | 📊 | Dash | Metrics, performance analysis |
| `researcher` | 🔍 | Scout | Market research, competitor intel |
| `producthunt` | 🚀 | Hunter | Product Hunt launches |
| `audience` | 🎯 | Radar | Audience discovery, community hunting |

## Using Sub-Agents

### List Available Agents

```
You: What agents do I have?
Bot: 8 agents available:
     🐦 Tweety - Twitter/X Specialist
     💼 Quinn - LinkedIn Specialist
     ✉️ Emma - Email Specialist
     🎨 Pixel - Creative Specialist
     📊 Dash - Analytics Specialist
     🔍 Scout - Research Specialist
     🚀 Hunter - Product Hunt Specialist
     🎯 Radar - Audience Researcher
```

### Delegate a Task

```
You: Ask Tweety to write a thread about our new feature
Bot: 🐦 Tweety completed the task:

     Thread:
     1/ We just shipped something big...
     2/ Here's the problem we noticed...
     3/ Our solution: ...
```

### Get Agent Info

```
You: Tell me more about Quinn
Bot: 💼 Quinn
     Specialty: LinkedIn Specialist
     Voice: Professional
     Expert in professional content, thought leadership, and B2B marketing
```

## Tools

### `list_agents`
List all available sub-agents.

### `delegate_task`
Assign a task to a specialist.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `agentId` | Yes | Agent ID (e.g., "twitter", "email") |
| `task` | Yes | Task description |
| `context` | No | Additional context as JSON |
| `wait` | No | Wait for completion (default: true) |

### `agent_info`
Get detailed information about an agent.

### `get_task_status`
Check status of a delegated task.

### `create_agent`
Create a custom agent (admin only).

## Creating Custom Agents

You can create agents tailored to your needs:

```
You: Create an agent called "Sunny" for Instagram content

Bot: ✨ Sunny created and ready!
```

Or via the tool:

```yaml
# Parameters for create_agent
id: instagram
name: Sunny
emoji: ☀️
persona: a visual storytelling expert for Instagram
voice: playful
specialtyName: Instagram Specialist
specialtyDescription: Expert in Instagram posts, reels, stories, and captions
systemPrompt: |
  You specialize in Instagram content creation.
  
  ## Your Expertise
  - Engaging captions with emojis
  - Hashtag strategy
  - Story ideas and formats
  - Reel concepts
  ...
```

## Agent Manifest

Custom agents are defined as manifests:

```typescript
interface SubAgentManifest {
  id: string;           // Unique ID (lowercase, no spaces)
  version: string;      // Semantic version
  identity: {
    name: string;       // Display name
    emoji: string;      // Signature emoji
    persona?: string;   // Description (e.g., "a witty copywriter")
    voice?: 'professional' | 'casual' | 'friendly' | 'playful';
  };
  specialty: {
    displayName: string;      // Human-readable name
    description: string;      // What they do
    systemPrompt: string;     // Detailed expertise
    tools?: string[];         // Allowed tools (empty = all)
  };
  defaultModel?: string;      // AI model for this agent (optional)
}
```

## Model Configuration

Each sub-agent can use a different AI model, allowing you to optimize for cost, speed, or capability.

### Set Agent Model

```
You: Set Tweety to use gpt-4o-mini

Bot: 🐦 Tweety now uses: gpt-4o-mini
```

### View All Agent Models

```
You: Show me which models each agent uses

Bot: Agent models:
     🐦 Tweety: gpt-4o-mini
     💼 Quinn: default
     ✉️ Emma: default
     🎨 Pixel: gemini-2.0-flash
     📊 Dash: default
     🔍 Scout: claude-3-opus
     🚀 Hunter: default
```

### Reset to Default

```
You: Reset Quinn to the default model

Bot: 💼 Quinn now uses: default (global)
```

### Model Tools

| Tool | Description |
|------|-------------|
| `set_agent_model` | Set the model for a specific agent |
| `list_agent_models` | Show all agent model configurations |
| `recommend_agent_model` | Get optimal model recommendations for agents |

### Get Recommendations

```
You: What models should my agents use?

Bot: Agent Model Recommendations

     🐦 Tweety: default → gpt-4o-mini
     💼 Quinn: default → claude-3-5-sonnet
     ✉️ Emma: default → claude-3-5-sonnet
     🎨 Pixel: default → gemini-2.0-flash
     📊 Dash: default → claude-3-5-sonnet
     🔍 Scout: default → claude-3-opus
     🚀 Hunter: default → claude-3-5-sonnet
     🎯 Radar: default → claude-3-opus

     💡 8 agent(s) could be optimized.
```

### Recommended Models by Agent

| Agent | Recommended | Reason |
|-------|-------------|--------|
| 🐦 Tweety | `gpt-4o-mini` | Fast, cheap for short-form |
| 💼 Quinn | Default | Quality matters for B2B |
| ✉️ Emma | Default | Needs good reasoning |
| 🎨 Pixel | `gemini-2.0-flash` | Vision + fast |
| 📊 Dash | Default | Analysis needs reasoning |
| 🔍 Scout | `claude-3-opus` | Deep research benefits |
| 🚀 Hunter | Default | Launch content is critical |
| 🎯 Radar | `claude-3-opus` | Deep research + synthesis |

### Create Agent with Model

When creating a custom agent, specify the model:

```
create_agent id=instagram name=Sunny emoji=☀️ ... model=gpt-4o-mini
```

## How Delegation Works

1. **Task Received** — You ask MarketClaw to delegate a task
2. **Agent Selected** — The appropriate specialist is chosen
3. **Context Loaded** — Agent gets its system prompt + your task
4. **Execution** — Agent completes the task using its tools
5. **Result Returned** — You get the output from the specialist

## Voice Styles

Each agent has a communication style:

| Voice | Description |
|-------|-------------|
| `professional` | Formal, polished, business-appropriate |
| `casual` | Relaxed, conversational, approachable |
| `friendly` | Warm, helpful, personable |
| `playful` | Fun, energetic, uses humor |

## Best Practices

1. **Be Specific** — Give clear task descriptions
2. **Add Context** — Include product/campaign info when relevant
3. **Match Specialists** — Use the right agent for the job
4. **Review Output** — Sub-agents draft; you approve

## Example Workflows

### Twitter Thread

```
You: Ask Tweety to write a thread about building in public

Bot: 🐦 Tweety completed the task:

     1/ Building in public is scary. Here's why you should do it anyway 🧵

     2/ Most founders hide until launch. Then wonder why no one cares...
```

### LinkedIn Post

```
You: Have Quinn write about the importance of product-led growth

Bot: 💼 Quinn completed the task:

     I used to think marketing was about telling people how great your product was.

     I was wrong.

     Here's what 5 years of B2B taught me about product-led growth...
```

### Email Campaign

```
You: Ask Emma to draft a cold email for launching our new feature

Bot: ✉️ Emma completed the task:

     Subject: Quick question about [Company]'s workflow

     Hi [Name],

     I noticed [Company] is doing X. We just shipped something that might help...
```

### Audience Research

```
You: Ask Radar to find where DevOps engineers discuss uptime monitoring

Bot: 🎯 Radar completed the task:

     ## Communities Found
     
     **High Activity:**
     - r/devops (2.1M members) - frequent "what monitoring tool" threads
     - r/sysadmin (850K) - lots of complaints about existing tools
     - DevOps Discord (45K) - #monitoring channel active daily
     
     **Key Pain Points (verbatim quotes):**
     - "PagerDuty pricing is insane once you scale"
     - "I just want something that works without 30 integrations"
     - "Why do all these tools require a PhD to configure?"
     
     **Persona Draft:**
     - Role: SRE / DevOps Engineer at 50-200 person startup
     - Trigger: Gets woken up by false alarm, decides to switch tools
     - Language: "uptime monitoring", "alerting", "on-call rotation"
     
     **Quick Wins:**
     1. Answer questions in r/devops weekly "what tools" thread
     2. Join DevOps Discord, lurk for a week, then engage
     3. Search "alternative to PagerDuty" for warm leads
```
