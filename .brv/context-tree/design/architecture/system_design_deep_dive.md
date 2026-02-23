## Raw Concept
**Task:**
Document detailed system design and data flow

**Files:**
- docs/ARCHITECTURE.md

**Flow:**
User -> Channel -> Agent Core -> Provider/Tools -> Response

**Timestamp:** 2026-02-23

## Narrative
### Structure
MarketClaw uses a centralized Agent Core that coordinates between Channels (UI), Providers (AI), and Tools (Actions). Memory and state are persisted in a local workspace directory.

### Features
Modular channel support (Telegram, Discord, Slack, CLI), swappable AI providers with a common interface, extensible tool registry, and specialized sub-agents.

### Rules
Message Processing Sequence:
1. User sends message via Channel
2. Channel authenticates user
3. Message routed to Agent Core
4. Agent builds context (brand, persona, history)
5. Provider generates response with tool calls
6. Tool Registry executes tools (permission & budget checks)
7. Loop until no more tool calls
8. Final response sent via Channel

### Diagrams
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
