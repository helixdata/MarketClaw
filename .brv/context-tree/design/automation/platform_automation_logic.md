## Raw Concept
**Task:**
Document how specific social media platforms are automated

**Files:**
- extension/background.js
- extension/content-scripts/twitter.js
- extension/content-scripts/linkedin.js

**Timestamp:** 2026-02-23

## Narrative
### Structure
`background.js` manages tab lifecycle (finding or creating tabs). It then dispatches a `marketclaw:post` custom event which the specific content scripts listen for.

### Features
Automatic tab navigation to platform compose URLs (e.g., `twitter.com/compose/tweet`), wait-for-load logic, and script injection.

### Rules
Platform Patterns:
- Twitter/X: `twitter.com`, `x.com`
- LinkedIn: `linkedin.com`
- Instagram: `instagram.com` (planned)

### Examples
Handshake Capability Report:
```json
{
  "type": "handshake",
  "client": "marketclaw-extension",
  "version": "0.1.0",
  "capabilities": ["twitter", "linkedin", "instagram"]
}
```
