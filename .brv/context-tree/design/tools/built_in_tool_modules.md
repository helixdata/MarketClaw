## Raw Concept
**Task:**
List and categorize all built-in agent tools

**Files:**
- src/tools/index.ts

**Timestamp:** 2026-02-23

## Narrative
### Structure
Tools are grouped by module and registered during the `initializeTools()` call in src/tools/index.ts.

### Features
Marketing suite (Email, LinkedIn, Twitter, Product Hunt), Research (Web Search, Knowledge Base), Utility (Config, Costs, Products), and Scheduling (Calendar, Cron).

### Rules
Built-in Tool Registration Table:
| Tool Module | Category | Description |
|-------------|----------|-------------|
| schedulerTools | scheduling | Task scheduling and reminders |
| knowledgeTools | knowledge | RAG and document search |
| linkedInTools | social | LinkedIn post management |
| twitterTools | social | Twitter/X post management |
| productHuntTools | marketing | Product Hunt launch tools |
| imageTools | marketing | Image generation (DALL-E, etc.) |
| emailTools | marketing | Outbound email via Resend |
| imapTools | marketing | Inbound email monitoring |
| configTools | utility | Per-product settings management |
| leadsTools | marketing | Simple CRM/Lead tracking |
| costTools | utility | Budget and spending management |
| brandTools | marketing | Brand voice and guidelines |
| imageLibraryTools | marketing | Product image storage/search |
| webTools | research | Web search and extraction |
| campaignTools | marketing | Marketing campaign management |
| calendarTools | scheduling | Google Calendar integration |
| productTools | utility | Product CRUD operations |
