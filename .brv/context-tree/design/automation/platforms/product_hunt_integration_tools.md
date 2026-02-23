## Raw Concept
**Task:**
Document Product Hunt integration and launch management tools

**Files:**
- src/tools/producthunt-tools.ts

**Flow:**
Agent -> Tool.execute -> phQuery(GraphQL) -> Product Hunt API -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
Product Hunt integration uses the Product Hunt V2 GraphQL API. The `productHuntTools` module (src/tools/producthunt-tools.ts) provides tools for searching products, tracking trends, and planning launches.

### Features
Product search, trending product retrieval (daily/weekly/monthly), detailed product data extraction, topic/category discovery, and launch plan drafting.

### Rules
1. Requires `PRODUCTHUNT_DEV_TOKEN` or `PH_TOKEN` in environment variables.
2. GraphQL queries are executed via the `phQuery` helper with Bearer token authentication.
3. `search_producthunt` is capped at 20 results per query.
4. `get_trending_producthunt` filters posts by `postedAfter` date based on the requested period.

### Examples
Product Hunt Tool Suite:
| Tool Name | Action | Description |
| :--- | :--- | :--- |
| `search_producthunt` | `posts` | Search for products by keyword (competitor research) |
| `get_trending_producthunt` | `posts` | Get top products for a specific period (daily, weekly, monthly) |
| `get_producthunt_product` | `post(slug)` | Fetch detailed info for a specific product by its URL slug |
| `get_producthunt_topics` | `topics` | Search for and list Product Hunt categories/topics |
| `draft_producthunt_launch` | N/A | Generate a comprehensive launch checklist and strategy |
| `check_producthunt_auth` | `viewer` | Verify API token and return current user info |
