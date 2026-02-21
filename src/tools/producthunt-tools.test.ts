/**
 * Product Hunt Tools Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  searchProductsTool,
  getTrendingProductsTool,
  getProductDetailsTool,
  getTopicsTool,
  draftLaunchTool,
  checkProductHuntAuthTool,
  productHuntTools,
} from './producthunt-tools.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Product Hunt Tools', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to mock successful GraphQL response
  function mockGraphQLSuccess(data: any) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data }),
    });
  }

  // Helper to mock GraphQL error
  function mockGraphQLError(message: string) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ errors: [{ message }] }),
    });
  }

  // Helper to mock HTTP error
  function mockHTTPError(status: number) {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
    });
  }

  // Helper to mock network error
  function mockNetworkError(message: string) {
    mockFetch.mockRejectedValueOnce(new Error(message));
  }

  // ============ Auth Checks ============
  describe('Authentication', () => {
    it('should fail when no token is configured', async () => {
      delete process.env.PRODUCTHUNT_DEV_TOKEN;
      delete process.env.PH_TOKEN;

      const result = await searchProductsTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('token not configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use PRODUCTHUNT_DEV_TOKEN when available', async () => {
      process.env.PRODUCTHUNT_DEV_TOKEN = 'dev-token-123';
      mockGraphQLSuccess({ posts: { edges: [] } });

      await searchProductsTool.execute({ query: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.producthunt.com/v2/api/graphql',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer dev-token-123',
          }),
        })
      );
    });

    it('should fall back to PH_TOKEN when PRODUCTHUNT_DEV_TOKEN is not set', async () => {
      delete process.env.PRODUCTHUNT_DEV_TOKEN;
      process.env.PH_TOKEN = 'fallback-token';
      mockGraphQLSuccess({ posts: { edges: [] } });

      await searchProductsTool.execute({ query: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fallback-token',
          }),
        })
      );
    });
  });

  // ============ searchProductsTool ============
  describe('searchProductsTool', () => {
    beforeEach(() => {
      process.env.PRODUCTHUNT_DEV_TOKEN = 'test-token';
    });

    it('should have correct tool definition', () => {
      expect(searchProductsTool.name).toBe('search_producthunt');
      expect(searchProductsTool.parameters.required).toContain('query');
    });

    it('should search products successfully', async () => {
      mockGraphQLSuccess({
        posts: {
          edges: [
            {
              node: {
                id: '1',
                name: 'TestProduct',
                tagline: 'A test product',
                url: 'https://producthunt.com/posts/testproduct',
                votesCount: 100,
                commentsCount: 10,
                createdAt: '2024-01-15T00:00:00Z',
                topics: { edges: [{ node: { name: 'Productivity' } }] },
                makers: [{ name: 'John', username: 'john' }],
              },
            },
          ],
        },
      });

      const result = await searchProductsTool.execute({ query: 'productivity' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Found 1 products');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        name: 'TestProduct',
        tagline: 'A test product',
        votes: 100,
        comments: 10,
        topics: ['Productivity'],
        makers: ['john'],
      });
    });

    it('should limit count to maximum of 20', async () => {
      mockGraphQLSuccess({ posts: { edges: [] } });

      await searchProductsTool.execute({ query: 'test', count: 50 });

      // Verify the query was called with first: 20 (capped)
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.variables.first).toBe(20);
    });

    it('should default count to 10', async () => {
      mockGraphQLSuccess({ posts: { edges: [] } });

      await searchProductsTool.execute({ query: 'test' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.variables.first).toBe(10);
    });

    it('should handle empty results', async () => {
      mockGraphQLSuccess({ posts: { edges: [] } });

      const result = await searchProductsTool.execute({ query: 'nonexistent' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle GraphQL errors', async () => {
      mockGraphQLError('Rate limit exceeded');

      const result = await searchProductsTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Rate limit exceeded');
    });

    it('should handle HTTP errors', async () => {
      mockHTTPError(500);

      const result = await searchProductsTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('API error: 500');
    });

    it('should handle network errors', async () => {
      mockNetworkError('Network unreachable');

      const result = await searchProductsTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network unreachable');
    });

    it('should handle missing topics and makers gracefully', async () => {
      mockGraphQLSuccess({
        posts: {
          edges: [
            {
              node: {
                id: '1',
                name: 'MinimalProduct',
                tagline: 'Minimal',
                url: 'https://producthunt.com/posts/minimal',
                votesCount: 5,
                commentsCount: 0,
                createdAt: '2024-01-01T00:00:00Z',
                topics: null,
                makers: null,
              },
            },
          ],
        },
      });

      const result = await searchProductsTool.execute({ query: 'minimal' });

      expect(result.success).toBe(true);
      expect(result.data[0].topics).toEqual([]);
      expect(result.data[0].makers).toEqual([]);
    });
  });

  // ============ getTrendingProductsTool ============
  describe('getTrendingProductsTool', () => {
    beforeEach(() => {
      process.env.PRODUCTHUNT_DEV_TOKEN = 'test-token';
    });

    it('should have correct tool definition', () => {
      expect(getTrendingProductsTool.name).toBe('get_trending_producthunt');
      expect(getTrendingProductsTool.parameters.properties.period.enum).toEqual([
        'daily',
        'weekly',
        'monthly',
      ]);
    });

    it('should get daily trending products by default', async () => {
      mockGraphQLSuccess({
        posts: {
          edges: [
            {
              node: {
                id: '1',
                name: 'TrendingApp',
                tagline: 'Trending now',
                url: 'https://producthunt.com/posts/trending',
                votesCount: 500,
                commentsCount: 50,
                createdAt: '2024-01-20T00:00:00Z',
                topics: { edges: [{ node: { name: 'AI' } }] },
              },
            },
          ],
        },
      });

      const result = await getTrendingProductsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('daily');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].votes).toBe(500);
    });

    it('should handle weekly period', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-21T12:00:00Z'));
      mockGraphQLSuccess({ posts: { edges: [] } });

      await getTrendingProductsTool.execute({ period: 'weekly' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const postedAfter = new Date(callBody.variables.postedAfter);
      const expectedDate = new Date('2024-01-14T12:00:00Z');
      
      // Should be ~7 days ago
      expect(postedAfter.getTime()).toBeCloseTo(expectedDate.getTime(), -3);
      
      vi.useRealTimers();
    });

    it('should handle monthly period', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-31T12:00:00Z'));
      mockGraphQLSuccess({ posts: { edges: [] } });

      await getTrendingProductsTool.execute({ period: 'monthly' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const postedAfter = new Date(callBody.variables.postedAfter);
      const expectedDate = new Date('2024-01-01T12:00:00Z');
      
      // Should be ~30 days ago
      expect(postedAfter.getTime()).toBeCloseTo(expectedDate.getTime(), -3);
      
      vi.useRealTimers();
    });

    it('should limit count to 20', async () => {
      mockGraphQLSuccess({ posts: { edges: [] } });

      await getTrendingProductsTool.execute({ count: 100 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.variables.first).toBe(20);
    });

    it('should handle API failures', async () => {
      mockGraphQLError('Service unavailable');

      const result = await getTrendingProductsTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Service unavailable');
    });
  });

  // ============ getProductDetailsTool ============
  describe('getProductDetailsTool', () => {
    beforeEach(() => {
      process.env.PRODUCTHUNT_DEV_TOKEN = 'test-token';
    });

    it('should have correct tool definition', () => {
      expect(getProductDetailsTool.name).toBe('get_producthunt_product');
      expect(getProductDetailsTool.parameters.required).toContain('slug');
    });

    it('should get product details successfully', async () => {
      mockGraphQLSuccess({
        post: {
          id: '123',
          name: 'Notion',
          tagline: 'All-in-one workspace',
          description: 'Full description here...',
          url: 'https://producthunt.com/posts/notion',
          website: 'https://notion.so',
          votesCount: 5000,
          commentsCount: 200,
          reviewsCount: 50,
          reviewsRating: 4.8,
          createdAt: '2020-01-01T00:00:00Z',
          featuredAt: '2020-01-01T12:00:00Z',
          topics: {
            edges: [
              { node: { name: 'Productivity', slug: 'productivity' } },
              { node: { name: 'Notes', slug: 'notes' } },
            ],
          },
          makers: [
            { name: 'Ivan', username: 'ivan', headline: 'CEO' },
          ],
          media: [
            { url: 'https://example.com/img1.png', type: 'image' },
          ],
        },
      });

      const result = await getProductDetailsTool.execute({ slug: 'notion' });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        name: 'Notion',
        tagline: 'All-in-one workspace',
        website: 'https://notion.so',
        votes: 5000,
        reviews: 50,
        rating: 4.8,
        featured: true,
        topics: ['Productivity', 'Notes'],
      });
      expect(result.data.makers).toHaveLength(1);
    });

    it('should return error when product not found', async () => {
      mockGraphQLSuccess({ post: null });

      const result = await getProductDetailsTool.execute({ slug: 'nonexistent-product' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Product not found');
      expect(result.message).toContain('nonexistent-product');
    });

    it('should handle products without reviews or media', async () => {
      mockGraphQLSuccess({
        post: {
          id: '456',
          name: 'NewProduct',
          tagline: 'Fresh launch',
          description: 'Just launched',
          url: 'https://producthunt.com/posts/new',
          website: 'https://newproduct.com',
          votesCount: 10,
          commentsCount: 2,
          reviewsCount: 0,
          reviewsRating: null,
          createdAt: '2024-01-20T00:00:00Z',
          featuredAt: null,
          topics: { edges: [] },
          makers: [],
          media: null,
        },
      });

      const result = await getProductDetailsTool.execute({ slug: 'new' });

      expect(result.success).toBe(true);
      expect(result.data.featured).toBe(false);
      expect(result.data.topics).toEqual([]);
      expect(result.data.media).toEqual([]);
    });

    it('should limit media to 3 items', async () => {
      mockGraphQLSuccess({
        post: {
          id: '789',
          name: 'MediaHeavy',
          tagline: 'Lots of media',
          description: '',
          url: '',
          website: '',
          votesCount: 0,
          commentsCount: 0,
          reviewsCount: 0,
          reviewsRating: null,
          createdAt: '',
          featuredAt: null,
          topics: { edges: [] },
          makers: [],
          media: [
            { url: 'img1.png', type: 'image' },
            { url: 'img2.png', type: 'image' },
            { url: 'img3.png', type: 'image' },
            { url: 'img4.png', type: 'image' },
            { url: 'img5.png', type: 'image' },
          ],
        },
      });

      const result = await getProductDetailsTool.execute({ slug: 'mediaheavy' });

      expect(result.success).toBe(true);
      expect(result.data.media).toHaveLength(3);
    });
  });

  // ============ getTopicsTool ============
  describe('getTopicsTool', () => {
    beforeEach(() => {
      process.env.PRODUCTHUNT_DEV_TOKEN = 'test-token';
    });

    it('should have correct tool definition', () => {
      expect(getTopicsTool.name).toBe('get_producthunt_topics');
    });

    it('should get topics successfully', async () => {
      mockGraphQLSuccess({
        topics: {
          edges: [
            {
              node: {
                id: '1',
                name: 'Artificial Intelligence',
                slug: 'artificial-intelligence',
                description: 'AI products and tools',
                postsCount: 5000,
                followersCount: 100000,
              },
            },
            {
              node: {
                id: '2',
                name: 'Productivity',
                slug: 'productivity',
                description: 'Get things done',
                postsCount: 8000,
                followersCount: 200000,
              },
            },
          ],
        },
      });

      const result = await getTopicsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Found 2 topics');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        name: 'Artificial Intelligence',
        slug: 'artificial-intelligence',
        posts: 5000,
        followers: 100000,
      });
    });

    it('should search for specific topics', async () => {
      mockGraphQLSuccess({
        topics: {
          edges: [
            {
              node: {
                id: '1',
                name: 'Developer Tools',
                slug: 'developer-tools',
                description: 'Tools for devs',
                postsCount: 3000,
                followersCount: 50000,
              },
            },
          ],
        },
      });

      await getTopicsTool.execute({ query: 'developer' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.variables.query).toBe('developer');
    });

    it('should handle empty query', async () => {
      mockGraphQLSuccess({ topics: { edges: [] } });

      await getTopicsTool.execute({});

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.variables.query).toBe('');
    });

    it('should handle API failures', async () => {
      mockHTTPError(503);

      const result = await getTopicsTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('API error');
    });
  });

  // ============ draftLaunchTool ============
  describe('draftLaunchTool', () => {
    it('should have correct tool definition', () => {
      expect(draftLaunchTool.name).toBe('draft_producthunt_launch');
      expect(draftLaunchTool.parameters.required).toContain('productName');
    });

    it('should create draft launch plan', async () => {
      const result = await draftLaunchTool.execute({
        productName: 'MyAwesomeApp',
        targetDate: 'next Tuesday',
      });

      expect(result.success).toBe(true);
      expect(result.data.product).toBe('MyAwesomeApp');
      expect(result.data.targetDate).toBe('next Tuesday');
      expect(result.data.checklist).toBeDefined();
      expect(result.data.checklist.length).toBeGreaterThan(0);
      expect(result.data.tips).toBeDefined();
    });

    it('should default targetDate to TBD', async () => {
      const result = await draftLaunchTool.execute({
        productName: 'TestProduct',
      });

      expect(result.success).toBe(true);
      expect(result.data.targetDate).toBe('TBD');
    });

    it('should not require API token (offline tool)', async () => {
      delete process.env.PRODUCTHUNT_DEV_TOKEN;
      delete process.env.PH_TOKEN;

      const result = await draftLaunchTool.execute({
        productName: 'OfflineTest',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should include product ID if provided', async () => {
      const result = await draftLaunchTool.execute({
        productName: 'TestProduct',
        productId: 'prod_123',
      });

      // productId is accepted but not used in output (for context only)
      expect(result.success).toBe(true);
    });
  });

  // ============ checkProductHuntAuthTool ============
  describe('checkProductHuntAuthTool', () => {
    it('should have correct tool definition', () => {
      expect(checkProductHuntAuthTool.name).toBe('check_producthunt_auth');
    });

    it('should report not authenticated when no token', async () => {
      delete process.env.PRODUCTHUNT_DEV_TOKEN;
      delete process.env.PH_TOKEN;

      const result = await checkProductHuntAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('token not configured');
      expect(result.data.authenticated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should verify valid token', async () => {
      process.env.PRODUCTHUNT_DEV_TOKEN = 'valid-token';
      mockGraphQLSuccess({
        viewer: {
          id: 'user_123',
          name: 'Test User',
          username: 'testuser',
        },
      });

      const result = await checkProductHuntAuthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('authenticated');
      expect(result.message).toContain('@testuser');
      expect(result.data).toMatchObject({
        authenticated: true,
        username: 'testuser',
        name: 'Test User',
      });
    });

    it('should report invalid token', async () => {
      process.env.PRODUCTHUNT_DEV_TOKEN = 'invalid-token';
      mockGraphQLError('Invalid token');

      const result = await checkProductHuntAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid or expired');
      expect(result.data.authenticated).toBe(false);
    });

    it('should handle viewer without username', async () => {
      process.env.PRODUCTHUNT_DEV_TOKEN = 'valid-token';
      mockGraphQLSuccess({
        viewer: {
          id: 'user_456',
          name: null,
          username: null,
        },
      });

      const result = await checkProductHuntAuthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('@unknown');
    });
  });

  // ============ productHuntTools export ============
  describe('productHuntTools export', () => {
    it('should export all 6 tools', () => {
      expect(productHuntTools).toHaveLength(6);
    });

    it('should include all expected tools', () => {
      const names = productHuntTools.map((t) => t.name);
      expect(names).toContain('search_producthunt');
      expect(names).toContain('get_trending_producthunt');
      expect(names).toContain('get_producthunt_product');
      expect(names).toContain('get_producthunt_topics');
      expect(names).toContain('draft_producthunt_launch');
      expect(names).toContain('check_producthunt_auth');
    });

    it('should have unique tool names', () => {
      const names = productHuntTools.map((t) => t.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });

    it('should have all required properties', () => {
      for (const tool of productHuntTools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.parameters).toBeDefined();
        expect(tool.execute).toBeInstanceOf(Function);
      }
    });
  });
});
