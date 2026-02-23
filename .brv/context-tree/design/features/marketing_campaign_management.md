## Raw Concept
**Task:**
Document the marketing campaign management system and tools

**Files:**
- src/tools/campaign-tools.ts
- src/memory/index.ts

**Flow:**
Agent Core -> create_campaign -> memory.saveCampaign -> add_campaign_post -> update_campaign_post (scheduled/published) -> get_campaign_metrics -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
The Campaign Management system (src/tools/campaign-tools.ts) provides a complete CRUD interface for organizing marketing efforts. Campaigns are stored as JSON files in the workspace and link together products, posts, metrics, and costs.

### Features
Multi-channel campaign organization, post scheduling and status tracking, aggregated performance metrics (impressions, clicks, engagement), and detailed cost attribution per campaign.

### Rules
1. Campaigns follow a status lifecycle: `draft` -> `active` -> `paused` -> `completed`.
2. Posts within a campaign track their own status: `draft`, `scheduled`, `published`, or `failed`.
3. `add_campaign_post` automatically resolves the active campaign or creates a default one if none exists.
4. `set_active_campaign` allows users to set a persistent context for subsequent marketing actions.

### Examples
Campaign Tool Suite:
| Tool Name | Description |
| :--- | :--- |
| `create_campaign` | Initialize a new campaign with target channels and dates |
| `list_campaigns` | Show all campaigns with post counts and status summaries |
| `get_campaign` | Retrieve full campaign details including all posts and notes |
| `add_campaign_post` | Append a new content piece to a campaign (handles auto-creation) |
| `update_campaign_post` | Modify post content, status, or schedule within a campaign |
| `get_campaign_metrics` | Fetch aggregated engagement data across all campaign posts |
| `get_campaign_costs` | Retrieve total USD spend for a specific campaign from the cost tracker |
| `set_active_campaign` | Set the current campaign context for the user |
