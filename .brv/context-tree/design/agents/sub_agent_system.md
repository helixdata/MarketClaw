## Raw Concept
**Task:**
Document the specialized sub-agent system

**Files:**
- src/agents/specialists.ts
- src/agents/registry.ts
- src/agents/tools.ts

**Flow:**
User -> Main Agent -> delegate_task -> Specialist Agent -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
Specialists are defined in src/agents/specialists.ts and managed via a registry in src/agents/registry.ts.

### Features
Specialized agents for Twitter, LinkedIn, Email, Images, Analytics, Research, and Product Hunt.

### Examples
Table of Specialists:
| Agent | Name | Specialty |
|-------|------|-----------|
| 🐦 | Tweety | Twitter threads, viral hooks |
| 💼 | Quinn | LinkedIn, B2B content |
| ✉️ | Emma | Email marketing, outreach |
| 🎨 | Pixel | Visual content, images |
| 📊 | Dash | Analytics, metrics |
| 🔍 | Scout | Research, competitor intel |
| 🚀 | Hunter | Product Hunt launches |
