## Raw Concept
**Task:**
Document the web search, content extraction, and research tools

**Files:**
- src/tools/web-tools.ts
- docs/WEB-SEARCH.md

**Flow:**
Agent -> web_search -> Brave Search API -> Results -> web_fetch -> extractContent -> Clean Text -> Agent

**Timestamp:** 2026-02-23

## Narrative
### Structure
The Web Search system (src/tools/web-tools.ts) integrates with the Brave Search API. It includes custom logic for stripping HTML/CSS/JS and extracting readable text content from web pages.

### Features
Keyword searching with localization and freshness filters, full-page content extraction (web_fetch), and an automated research workflow (research_topic).

### Rules
1. Requires `BRAVE_SEARCH_API_KEY` in environment or config.
2. `web_search` returns a maximum of 10 results per query.
3. `web_fetch` extracts text from `<main>`, `<article>`, or specific content divs, falling back to body text.
4. `research_topic` aggregates multiple search results into a formatted summary with source citations.

### Examples
Web Tool Suite:
| Tool Name | Action | Description |
| :--- | :--- | :--- |
| `web_search` | Search | Find relevant URLs using keywords (supports `country` and `freshness`) |
| `web_fetch` | Extract | Fetch and clean text from a specific URL (strips scripts/styling) |
| `research_topic` | Research | Perform a quick (3 sources) or thorough (8 sources) topic deep-dive |

Content Extraction Logic:
- Removes `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>` tags.
- Decodes HTML entities (e.g., `&amp;` -> `&`).
- Replaces block elements (`<p>`, `<div>`, `<br>`) with newlines for readability.
