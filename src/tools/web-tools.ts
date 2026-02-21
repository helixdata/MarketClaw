/**
 * Web Search Tools
 * Tools for searching the web and extracting content using Brave Search API
 */

import { Tool, ToolResult } from './types.js';

// ============ Config Helpers ============

function getBraveApiKey(): string | undefined {
  return process.env.BRAVE_SEARCH_API_KEY;
}

// ============ Types ============

export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  publishedDate?: string;
}

export interface WebFetchResult {
  url: string;
  title?: string;
  content: string;
  truncated: boolean;
}

export interface ResearchResult {
  topic: string;
  depth: 'quick' | 'thorough';
  summary: string;
  sources: WebSearchResult[];
}

// ============ Brave Search API ============

const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

interface BraveSearchResponse {
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      age?: string;
      published_date?: string;
    }>;
  };
  query?: {
    original: string;
  };
}

async function braveSearch(
  query: string,
  options: {
    count?: number;
    country?: string;
    freshness?: 'day' | 'week' | 'month';
  } = {}
): Promise<WebSearchResult[]> {
  const apiKey = getBraveApiKey();
  if (!apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY not configured. Set it in environment variables.');
  }

  const { count = 5, country = 'US', freshness } = options;
  
  // Build URL with params
  const url = new URL(BRAVE_SEARCH_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(count, 10)));
  url.searchParams.set('country', country);
  if (freshness) {
    url.searchParams.set('freshness', freshness);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Brave Search API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as BraveSearchResponse;
  
  if (!data.web?.results) {
    return [];
  }

  return data.web.results.map(r => ({
    title: r.title,
    url: r.url,
    description: r.description,
    publishedDate: r.published_date || r.age,
  }));
}

// ============ Content Extraction ============

/**
 * Extract readable text content from HTML
 * Simple extraction without external dependencies
 */
function extractContent(html: string): { title?: string; content: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : undefined;

  // Remove script and style tags
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

  // Try to find main content areas
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                    content.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                    content.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  
  if (mainMatch) {
    content = mainMatch[1];
  }

  // Replace common block elements with newlines
  content = content
    .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '') // Remove remaining tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Decode HTML entities
  content = decodeHtmlEntities(content);

  return { title, content };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function fetchAndExtract(
  url: string,
  maxLength: number = 5000
): Promise<WebFetchResult> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MarketClaw/1.0; +https://marketclaw.dev)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status}): ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  
  // Handle non-HTML content
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    if (contentType.includes('text/')) {
      // Plain text
      let text = await response.text();
      const truncated = text.length > maxLength;
      if (truncated) {
        text = text.slice(0, maxLength);
      }
      return { url, content: text, truncated };
    } else {
      // Binary or other non-text content
      throw new Error(`Cannot extract content from ${contentType}`);
    }
  }

  const html = await response.text();
  const { title, content } = extractContent(html);

  const truncated = content.length > maxLength;
  const finalContent = truncated ? content.slice(0, maxLength) : content;

  return {
    url,
    title,
    content: finalContent,
    truncated,
  };
}

// ============ Web Search Tool ============

export const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web using Brave Search API. Returns titles, URLs, and descriptions.',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'Search query' 
      },
      count: { 
        type: 'number', 
        description: 'Number of results to return (default: 5, max: 10)' 
      },
      country: { 
        type: 'string', 
        description: 'Country code for localized results (default: "US")' 
      },
      freshness: { 
        type: 'string', 
        enum: ['day', 'week', 'month'],
        description: 'Filter results by time: day, week, or month' 
      },
    },
    required: ['query'],
  },

  async execute(params): Promise<ToolResult> {
    const { query, count = 5, country = 'US', freshness } = params;

    if (!query || typeof query !== 'string') {
      return {
        success: false,
        message: 'Query is required',
      };
    }

    try {
      const results = await braveSearch(query, { 
        count: Math.min(count, 10), 
        country,
        freshness,
      });

      if (results.length === 0) {
        return {
          success: true,
          message: `No results found for "${query}"`,
          data: [],
        };
      }

      return {
        success: true,
        message: `Found ${results.length} result(s) for "${query}"`,
        data: results,
      };
    } catch (err) {
      return {
        success: false,
        message: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Web Fetch Tool ============

export const webFetchTool: Tool = {
  name: 'web_fetch',
  description: 'Fetch and extract readable content from a URL. Returns clean text without HTML.',
  parameters: {
    type: 'object',
    properties: {
      url: { 
        type: 'string', 
        description: 'URL to fetch' 
      },
      maxLength: { 
        type: 'number', 
        description: 'Maximum characters to return (default: 5000)' 
      },
    },
    required: ['url'],
  },

  async execute(params): Promise<ToolResult> {
    const { url, maxLength = 5000 } = params;

    if (!url || typeof url !== 'string') {
      return {
        success: false,
        message: 'URL is required',
      };
    }

    try {
      const result = await fetchAndExtract(url, maxLength);

      return {
        success: true,
        message: result.truncated 
          ? `Fetched content from ${url} (truncated to ${maxLength} chars)`
          : `Fetched content from ${url}`,
        data: result,
      };
    } catch (err) {
      return {
        success: false,
        message: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Research Topic Tool ============

export const researchTopicTool: Tool = {
  name: 'research_topic',
  description: 'Research a topic by searching the web and aggregating results. Returns a summary with sources.',
  parameters: {
    type: 'object',
    properties: {
      topic: { 
        type: 'string', 
        description: 'Topic to research' 
      },
      depth: { 
        type: 'string', 
        enum: ['quick', 'thorough'],
        description: 'Research depth: quick (3 results) or thorough (8 results)' 
      },
    },
    required: ['topic'],
  },

  async execute(params): Promise<ToolResult> {
    const { topic, depth = 'quick' } = params;

    if (!topic || typeof topic !== 'string') {
      return {
        success: false,
        message: 'Topic is required',
      };
    }

    const resultCount = depth === 'thorough' ? 8 : 3;

    try {
      // Search for the topic
      const searchResults = await braveSearch(topic, { count: resultCount });

      if (searchResults.length === 0) {
        return {
          success: true,
          message: `No results found for topic "${topic}"`,
          data: {
            topic,
            depth,
            summary: `Unable to find information about "${topic}".`,
            sources: [],
          } as ResearchResult,
        };
      }

      // Build summary from descriptions
      const summaryParts = searchResults.map((r, i) => 
        `${i + 1}. **${r.title}**\n   ${r.description}`
      );

      const summary = [
        `# Research: ${topic}`,
        ``,
        `Found ${searchResults.length} sources:`,
        ``,
        ...summaryParts,
        ``,
        `---`,
        `Sources:`,
        ...searchResults.map(r => `- [${r.title}](${r.url})`)
      ].join('\n');

      return {
        success: true,
        message: `Researched "${topic}" with ${searchResults.length} sources (${depth} depth)`,
        data: {
          topic,
          depth,
          summary,
          sources: searchResults,
        } as ResearchResult,
      };
    } catch (err) {
      return {
        success: false,
        message: `Research failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Export All ============

export const webTools: Tool[] = [
  webSearchTool,
  webFetchTool,
  researchTopicTool,
];

// Export individual functions for testing
export { braveSearch, fetchAndExtract, extractContent };
