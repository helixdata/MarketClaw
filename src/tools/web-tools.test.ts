/**
 * Web Tools Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  webSearchTool,
  webFetchTool,
  researchTopicTool,
  webTools,
  braveSearch,
  fetchAndExtract,
  extractContent,
} from './web-tools.js';

// Store original fetch and env
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
  process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
});

// Helper to create mock fetch response
function mockResponse(data: any, options: { status?: number; headers?: Record<string, string> } = {}) {
  const { status = 200, headers = {} } = options;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
  };
}

describe('Web Tools', () => {
  // ============ webSearchTool ============
  describe('webSearchTool', () => {
    it('should have correct metadata', () => {
      expect(webSearchTool.name).toBe('web_search');
      expect(webSearchTool.parameters.required).toContain('query');
      expect(webSearchTool.description).toContain('Brave Search');
    });

    it('should search with minimal params', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        web: {
          results: [
            { title: 'Result 1', url: 'https://example.com/1', description: 'Description 1', age: '1 day ago' },
            { title: 'Result 2', url: 'https://example.com/2', description: 'Description 2', age: '2 days ago' },
          ],
        },
      }));

      const result = await webSearchTool.execute({ query: 'test query' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].title).toBe('Result 1');
      expect(result.data[0].url).toBe('https://example.com/1');
      expect(result.data[0].publishedDate).toBe('1 day ago');
      expect(result.message).toContain('2 result(s)');
    });

    it('should search with all params', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        web: {
          results: [
            { title: 'Recent Result', url: 'https://example.com/recent', description: 'Just published', published_date: '2024-01-15' },
          ],
        },
      }));

      const result = await webSearchTool.execute({
        query: 'breaking news',
        count: 10,
        country: 'GB',
        freshness: 'day',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=breaking+news'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('count=10'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('country=GB'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('freshness=day'),
        expect.any(Object)
      );
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        web: { results: [] },
      }));

      const result = await webSearchTool.execute({ query: 'nonexistent obscure query' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.message).toContain('No results found');
    });

    it('should handle missing web.results', async () => {
      mockFetch.mockResolvedValue(mockResponse({ query: { original: 'test' } }));

      const result = await webSearchTool.execute({ query: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should cap count at 10', async () => {
      mockFetch.mockResolvedValue(mockResponse({ web: { results: [] } }));

      await webSearchTool.execute({ query: 'test', count: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('count=10'),
        expect.any(Object)
      );
    });

    it('should fail without query', async () => {
      const result = await webSearchTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Query is required');
    });

    it('should fail with empty query', async () => {
      const result = await webSearchTool.execute({ query: '' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Query is required');
    });

    it('should fail without API key', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;

      const result = await webSearchTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('BRAVE_SEARCH_API_KEY not configured');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue(mockResponse(
        { error: { message: 'Rate limit exceeded' } },
        { status: 429 }
      ));

      const result = await webSearchTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('429');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      const result = await webSearchTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network timeout');
    });

    it('should send correct headers', async () => {
      mockFetch.mockResolvedValue(mockResponse({ web: { results: [] } }));

      await webSearchTool.execute({ query: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'X-Subscription-Token': 'test-api-key',
          }),
        })
      );
    });

    it('should handle freshness week filter', async () => {
      mockFetch.mockResolvedValue(mockResponse({ web: { results: [] } }));

      await webSearchTool.execute({ query: 'news', freshness: 'week' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('freshness=week'),
        expect.any(Object)
      );
    });

    it('should handle freshness month filter', async () => {
      mockFetch.mockResolvedValue(mockResponse({ web: { results: [] } }));

      await webSearchTool.execute({ query: 'news', freshness: 'month' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('freshness=month'),
        expect.any(Object)
      );
    });

    it('should use published_date when available', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        web: {
          results: [
            { title: 'Article', url: 'https://example.com', description: 'Test', published_date: '2024-01-20' },
          ],
        },
      }));

      const result = await webSearchTool.execute({ query: 'test' });

      expect(result.data[0].publishedDate).toBe('2024-01-20');
    });
  });

  // ============ webFetchTool ============
  describe('webFetchTool', () => {
    it('should have correct metadata', () => {
      expect(webFetchTool.name).toBe('web_fetch');
      expect(webFetchTool.parameters.required).toContain('url');
      expect(webFetchTool.description).toContain('extract');
    });

    it('should fetch and extract HTML content', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test Page</title></head>
        <body>
          <nav>Navigation</nav>
          <main>
            <h1>Main Title</h1>
            <p>This is the main content of the page.</p>
            <p>Another paragraph here.</p>
          </main>
          <footer>Footer content</footer>
        </body>
        </html>
      `;
      mockFetch.mockResolvedValue(mockResponse(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }));

      const result = await webFetchTool.execute({ url: 'https://example.com/article' });

      expect(result.success).toBe(true);
      expect(result.data.url).toBe('https://example.com/article');
      expect(result.data.title).toBe('Test Page');
      expect(result.data.content).toContain('Main Title');
      expect(result.data.content).toContain('main content');
      expect(result.data.truncated).toBe(false);
    });

    it('should truncate long content', async () => {
      const longContent = 'X'.repeat(10000);
      const html = `<html><head><title>Long</title></head><body><p>${longContent}</p></body></html>`;
      mockFetch.mockResolvedValue(mockResponse(html, {
        headers: { 'content-type': 'text/html' },
      }));

      const result = await webFetchTool.execute({ url: 'https://example.com', maxLength: 1000 });

      expect(result.success).toBe(true);
      expect(result.data.content.length).toBeLessThanOrEqual(1000);
      expect(result.data.truncated).toBe(true);
      expect(result.message).toContain('truncated');
    });

    it('should handle plain text content', async () => {
      mockFetch.mockResolvedValue(mockResponse('Plain text content here', {
        headers: { 'content-type': 'text/plain' },
      }));

      const result = await webFetchTool.execute({ url: 'https://example.com/file.txt' });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Plain text content here');
    });

    it('should fail for binary content', async () => {
      mockFetch.mockResolvedValue(mockResponse('binary data', {
        headers: { 'content-type': 'application/pdf' },
      }));

      const result = await webFetchTool.execute({ url: 'https://example.com/file.pdf' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot extract content');
    });

    it('should fail without url', async () => {
      const result = await webFetchTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('URL is required');
    });

    it('should fail with invalid URL', async () => {
      const result = await webFetchTool.execute({ url: 'not-a-url' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid URL');
    });

    it('should fail with non-http URL', async () => {
      const result = await webFetchTool.execute({ url: 'ftp://example.com/file' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid URL');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue(mockResponse('Not Found', { status: 404 }));

      const result = await webFetchTool.execute({ url: 'https://example.com/missing' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('404');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await webFetchTool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
    });

    it('should use default maxLength of 5000', async () => {
      const content = 'Y'.repeat(6000);
      const html = `<html><body>${content}</body></html>`;
      mockFetch.mockResolvedValue(mockResponse(html, {
        headers: { 'content-type': 'text/html' },
      }));

      const result = await webFetchTool.execute({ url: 'https://example.com' });

      expect(result.data.content.length).toBeLessThanOrEqual(5000);
      expect(result.data.truncated).toBe(true);
    });

    it('should send appropriate User-Agent', async () => {
      mockFetch.mockResolvedValue(mockResponse('<html></html>', {
        headers: { 'content-type': 'text/html' },
      }));

      await webFetchTool.execute({ url: 'https://example.com' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('MarketClaw'),
          }),
        })
      );
    });

    it('should extract content from article tags', async () => {
      const html = `
        <html>
        <body>
          <div>Header stuff</div>
          <article>
            <h2>Article Title</h2>
            <p>Article content here.</p>
          </article>
          <div>Footer stuff</div>
        </body>
        </html>
      `;
      mockFetch.mockResolvedValue(mockResponse(html, {
        headers: { 'content-type': 'text/html' },
      }));

      const result = await webFetchTool.execute({ url: 'https://example.com' });

      expect(result.data.content).toContain('Article Title');
      expect(result.data.content).toContain('Article content');
    });

    it('should strip script and style tags', async () => {
      const html = `
        <html>
        <head>
          <style>body { color: red; }</style>
        </head>
        <body>
          <script>alert('evil');</script>
          <p>Safe content</p>
          <script type="text/javascript">more script</script>
        </body>
        </html>
      `;
      mockFetch.mockResolvedValue(mockResponse(html, {
        headers: { 'content-type': 'text/html' },
      }));

      const result = await webFetchTool.execute({ url: 'https://example.com' });

      expect(result.data.content).toContain('Safe content');
      expect(result.data.content).not.toContain('alert');
      expect(result.data.content).not.toContain('color: red');
    });
  });

  // ============ researchTopicTool ============
  describe('researchTopicTool', () => {
    it('should have correct metadata', () => {
      expect(researchTopicTool.name).toBe('research_topic');
      expect(researchTopicTool.parameters.required).toContain('topic');
      expect(researchTopicTool.description).toContain('Research');
    });

    it('should research with quick depth (3 results)', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        web: {
          results: [
            { title: 'Source 1', url: 'https://a.com', description: 'Info about topic A' },
            { title: 'Source 2', url: 'https://b.com', description: 'Info about topic B' },
            { title: 'Source 3', url: 'https://c.com', description: 'Info about topic C' },
          ],
        },
      }));

      const result = await researchTopicTool.execute({ topic: 'AI trends', depth: 'quick' });

      expect(result.success).toBe(true);
      expect(result.data.topic).toBe('AI trends');
      expect(result.data.depth).toBe('quick');
      expect(result.data.sources).toHaveLength(3);
      expect(result.data.summary).toContain('AI trends');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('count=3'),
        expect.any(Object)
      );
    });

    it('should research with thorough depth (8 results)', async () => {
      const results = Array.from({ length: 8 }, (_, i) => ({
        title: `Source ${i + 1}`,
        url: `https://source${i + 1}.com`,
        description: `Description ${i + 1}`,
      }));
      mockFetch.mockResolvedValue(mockResponse({ web: { results } }));

      const result = await researchTopicTool.execute({ topic: 'Climate change', depth: 'thorough' });

      expect(result.success).toBe(true);
      expect(result.data.depth).toBe('thorough');
      expect(result.data.sources).toHaveLength(8);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('count=8'),
        expect.any(Object)
      );
    });

    it('should default to quick depth', async () => {
      mockFetch.mockResolvedValue(mockResponse({ web: { results: [] } }));

      const result = await researchTopicTool.execute({ topic: 'Something' });

      expect(result.data.depth).toBe('quick');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('count=3'),
        expect.any(Object)
      );
    });

    it('should handle no results', async () => {
      mockFetch.mockResolvedValue(mockResponse({ web: { results: [] } }));

      const result = await researchTopicTool.execute({ topic: 'xyznonexistent123' });

      expect(result.success).toBe(true);
      expect(result.data.sources).toEqual([]);
      expect(result.data.summary).toContain('Unable to find information');
    });

    it('should fail without topic', async () => {
      const result = await researchTopicTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Topic is required');
    });

    it('should fail with empty topic', async () => {
      const result = await researchTopicTool.execute({ topic: '' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Topic is required');
    });

    it('should fail without API key', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;

      const result = await researchTopicTool.execute({ topic: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('BRAVE_SEARCH_API_KEY');
    });

    it('should include source links in summary', async () => {
      mockFetch.mockResolvedValue(mockResponse({
        web: {
          results: [
            { title: 'Best Practices', url: 'https://example.com/best', description: 'Learn best practices' },
          ],
        },
      }));

      const result = await researchTopicTool.execute({ topic: 'coding' });

      expect(result.data.summary).toContain('[Best Practices](https://example.com/best)');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue(mockResponse('Server Error', { status: 500 }));

      const result = await researchTopicTool.execute({ topic: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Research failed');
    });
  });

  // ============ extractContent helper ============
  describe('extractContent', () => {
    it('should extract title from HTML', () => {
      const html = '<html><head><title>Page Title</title></head><body></body></html>';
      const { title } = extractContent(html);
      expect(title).toBe('Page Title');
    });

    it('should handle missing title', () => {
      const html = '<html><body><p>Content</p></body></html>';
      const { title } = extractContent(html);
      expect(title).toBeUndefined();
    });

    it('should decode HTML entities', () => {
      const html = '<html><body><p>Tom &amp; Jerry&apos;s &quot;Show&quot; &lt;2024&gt;</p></body></html>';
      const { content } = extractContent(html);
      expect(content).toContain('Tom & Jerry\'s "Show" <2024>');
    });

    it('should remove navigation elements', () => {
      const html = '<html><body><nav>Menu</nav><p>Content</p></body></html>';
      const { content } = extractContent(html);
      expect(content).not.toContain('Menu');
      expect(content).toContain('Content');
    });

    it('should remove header and footer', () => {
      const html = '<html><body><header>Header</header><p>Main</p><footer>Footer</footer></body></html>';
      const { content } = extractContent(html);
      expect(content).not.toContain('Header');
      expect(content).not.toContain('Footer');
      expect(content).toContain('Main');
    });

    it('should collapse whitespace', () => {
      const html = '<html><body><p>  Multiple    spaces   </p></body></html>';
      const { content } = extractContent(html);
      expect(content).not.toContain('  ');
    });
  });

  // ============ webTools export ============
  describe('webTools export', () => {
    it('should export all three tools', () => {
      expect(webTools).toHaveLength(3);
      const names = webTools.map(t => t.name);
      expect(names).toContain('web_search');
      expect(names).toContain('web_fetch');
      expect(names).toContain('research_topic');
    });

    it('should have unique tool names', () => {
      const names = webTools.map(t => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should all have execute functions', () => {
      for (const tool of webTools) {
        expect(typeof tool.execute).toBe('function');
      }
    });

    it('should all have required parameters arrays', () => {
      for (const tool of webTools) {
        expect(Array.isArray(tool.parameters.required)).toBe(true);
        expect(tool.parameters.required!.length).toBeGreaterThan(0);
      }
    });
  });
});
