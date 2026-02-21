# Web Search Tools

MarketClaw includes powerful web search and content extraction tools powered by the Brave Search API. These tools enable research, competitive analysis, and content gathering.

## Setup

### Get a Brave Search API Key

1. Sign up at [Brave Search API](https://api.search.brave.com/)
2. Create an application to get your API key
3. The free tier includes 2,000 queries/month

### Configuration

Set the environment variable:

```bash
export BRAVE_SEARCH_API_KEY=your-api-key-here
```

Or add to your `~/.marketclaw/config.yaml`:

```yaml
web:
  braveApiKey: your-api-key-here
```

## Tools

### web_search

Search the web using Brave Search API. Returns titles, URLs, and descriptions.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | ✅ | - | Search query |
| count | number | ❌ | 5 | Number of results (max: 10) |
| country | string | ❌ | "US" | Country code for localized results |
| freshness | string | ❌ | - | Filter by time: "day", "week", or "month" |

**Example:**

```
You: Search for "AI marketing tools 2024"

MarketClaw: Found 5 results for "AI marketing tools 2024":

1. **Top 10 AI Marketing Tools in 2024**
   https://marketing.example.com/ai-tools
   Comprehensive guide to the best AI-powered marketing platforms...

2. **AI Marketing Revolution**
   https://techblog.com/ai-marketing
   How artificial intelligence is transforming digital marketing...
```

### web_fetch

Fetch and extract readable content from a URL. Strips HTML, scripts, and styling to return clean text.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | ✅ | - | URL to fetch |
| maxLength | number | ❌ | 5000 | Maximum characters to return |

**Example:**

```
You: Fetch the content from https://example.com/article

MarketClaw: Fetched content from https://example.com/article:

**Title:** How to Launch a Product

**Content:**
Launching a product successfully requires careful planning...
(5000 characters, truncated)
```

### research_topic

Research a topic by searching the web and aggregating results. Returns a formatted summary with sources.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| topic | string | ✅ | - | Topic to research |
| depth | string | ❌ | "quick" | "quick" (3 results) or "thorough" (8 results) |

**Example:**

```
You: Research "indie hacker marketing strategies" thoroughly

MarketClaw: # Research: indie hacker marketing strategies

Found 8 sources:

1. **The Indie Hacker's Guide to Marketing**
   How solo founders can effectively market their products without a budget...

2. **Twitter Marketing for Indie Hackers**
   Building in public and leveraging social proof...

[... more sources ...]

---
Sources:
- [The Indie Hacker's Guide to Marketing](https://indiehackers.com/guide)
- [Twitter Marketing for Indie Hackers](https://twitter-marketing.dev)
```

## Use Cases

### Competitive Analysis

```
You: Research our competitors in the email marketing space

MarketClaw: I'll research email marketing competitors for you...
[Uses research_topic with depth: thorough]
```

### Content Research

```
You: Find recent articles about product launches on Product Hunt

MarketClaw: Searching for recent Product Hunt launch articles...
[Uses web_search with freshness: week]
```

### Article Extraction

```
You: What does this competitor's landing page say? https://competitor.com

MarketClaw: Let me fetch and analyze that page...
[Uses web_fetch to extract content]
```

### Market Research

```
You: What are people saying about AI writing tools?

MarketClaw: I'll research opinions on AI writing tools...
[Uses research_topic]
```

## Tips

### Localized Search

Use the `country` parameter for region-specific results:

```
You: Search for "local marketing" in Germany

MarketClaw: [Uses country: "DE"]
```

Country codes follow ISO 3166-1 alpha-2 (US, GB, DE, FR, etc.)

### Time-Filtered Search

Use `freshness` for recent content:

- `day` - Past 24 hours
- `week` - Past 7 days  
- `month` - Past 30 days

```
You: Find news about AI from the last week

MarketClaw: [Uses freshness: "week"]
```

### Combining Tools

The research workflow often combines tools:

1. `web_search` to find relevant URLs
2. `web_fetch` to extract detailed content
3. Knowledge tools to store insights

```
You: Research SaaS pricing strategies and save the key insights

MarketClaw: 
1. Searching for SaaS pricing strategies...
2. Fetching top articles for detailed analysis...
3. Saving insights to knowledge base...
```

## Limitations

- **Rate limits:** Free tier is 2,000 queries/month
- **Content extraction:** Works best on article-style pages; may struggle with SPAs or heavily dynamic content
- **No authentication:** Cannot access paywalled or login-protected content
- **Text only:** Images and media are not extracted

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "BRAVE_SEARCH_API_KEY not configured" | Missing API key | Set the environment variable |
| "Rate limit exceeded" | Too many requests | Wait or upgrade plan |
| "Invalid URL" | Malformed URL | Check URL format |
| "Cannot extract content" | Binary/non-text content | Only works with HTML/text |

## Cost

Brave Search API pricing:
- **Free tier:** 2,000 queries/month
- **Basic:** $5/month for 20,000 queries
- **Pro:** Custom pricing for higher volume

MarketClaw does not track costs for web search (it's external API).
