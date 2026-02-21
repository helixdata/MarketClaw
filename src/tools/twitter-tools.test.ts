/**
 * Twitter Tools Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import {
  postTweetTool,
  replyTweetTool,
  searchTweetsTool,
  readTweetTool,
  getMentionsTool,
  getHomeTimelineTool,
  getUserTweetsTool,
  draftTweetTool,
  checkTwitterAuthTool,
} from './twitter-tools.js';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('Twitter Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============ postTweetTool ============
  describe('postTweetTool', () => {
    it('should have correct metadata', () => {
      expect(postTweetTool.name).toBe('post_tweet');
      expect(postTweetTool.parameters.required).toContain('text');
    });

    it('should reject tweets over 280 characters', async () => {
      const longText = 'a'.repeat(281);
      const result = await postTweetTool.execute({ text: longText });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Tweet too long');
      expect(result.data?.characterCount).toBe(281);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should accept tweets at exactly 280 characters', async () => {
      const exactText = 'a'.repeat(280);
      mockExecSync.mockReturnValue('Tweet posted successfully');

      const result = await postTweetTool.execute({ text: exactText });

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalled();
    });

    it('should return preview in dry run mode', async () => {
      const result = await postTweetTool.execute({
        text: 'Test tweet',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Preview');
      expect(result.data?.text).toBe('Test tweet');
      expect(result.data?.characterCount).toBe(10);
      expect(result.data?.hasImage).toBe(false);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should show image in dry run preview', async () => {
      const result = await postTweetTool.execute({
        text: 'Tweet with image',
        imagePath: '/path/to/image.png',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.hasImage).toBe(true);
    });

    it('should post a simple tweet successfully', async () => {
      mockExecSync.mockReturnValue('Tweet posted! ID: 123456789');

      const result = await postTweetTool.execute({ text: 'Hello world!' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Tweet posted');
      expect(result.data?.text).toBe('Hello world!');
      expect(mockExecSync).toHaveBeenCalledWith(
        'bird tweet "Hello world!"',
        expect.objectContaining({ encoding: 'utf-8', timeout: 30000 })
      );
    });

    it('should escape quotes in tweet text', async () => {
      mockExecSync.mockReturnValue('Tweet posted');

      await postTweetTool.execute({ text: 'She said "hello"' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('She said \\"hello\\"'),
        expect.any(Object)
      );
    });

    it('should include media flags when image provided', async () => {
      mockExecSync.mockReturnValue('Tweet posted');

      await postTweetTool.execute({
        text: 'Check this out!',
        imagePath: '/path/to/image.png',
        imageAlt: 'A cool image',
      });

      const call = mockExecSync.mock.calls[0][0] as string;
      expect(call).toContain('--media "/path/to/image.png"');
      expect(call).toContain('--alt "A cool image"');
    });

    it('should handle posting errors', async () => {
      mockExecSync.mockImplementation(() => {
        const err = new Error('Rate limit exceeded') as any;
        err.stderr = 'Rate limit exceeded';
        throw err;
      });

      const result = await postTweetTool.execute({ text: 'Test tweet' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to post tweet');
      expect(result.message).toContain('Rate limit');
    });
  });

  // ============ replyTweetTool ============
  describe('replyTweetTool', () => {
    it('should have correct metadata', () => {
      expect(replyTweetTool.name).toBe('reply_tweet');
      expect(replyTweetTool.parameters.required).toContain('tweetUrl');
      expect(replyTweetTool.parameters.required).toContain('text');
    });

    it('should reject replies over 280 characters', async () => {
      const longText = 'b'.repeat(281);
      const result = await replyTweetTool.execute({
        tweetUrl: 'https://twitter.com/user/status/123',
        text: longText,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Reply too long');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should post a reply successfully', async () => {
      mockExecSync.mockReturnValue('Reply posted');

      const result = await replyTweetTool.execute({
        tweetUrl: 'https://twitter.com/user/status/123456',
        text: 'Great point!',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Reply posted');
      expect(mockExecSync).toHaveBeenCalledWith(
        'bird reply "https://twitter.com/user/status/123456" "Great point!"',
        expect.any(Object)
      );
    });

    it('should handle reply errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Tweet not found');
      });

      const result = await replyTweetTool.execute({
        tweetUrl: '999999999',
        text: 'Reply text',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to reply');
    });
  });

  // ============ searchTweetsTool ============
  describe('searchTweetsTool', () => {
    it('should have correct metadata', () => {
      expect(searchTweetsTool.name).toBe('search_tweets');
      expect(searchTweetsTool.parameters.required).toContain('query');
    });

    it('should search with default count', async () => {
      mockExecSync.mockReturnValue(JSON.stringify([
        { id: '1', text: 'Tweet about AI' },
        { id: '2', text: 'Another AI tweet' },
      ]));

      const result = await searchTweetsTool.execute({ query: 'AI' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Found tweets');
      expect(mockExecSync).toHaveBeenCalledWith(
        'bird search "AI" -n 10 --json',
        expect.any(Object)
      );
    });

    it('should search with custom count', async () => {
      mockExecSync.mockReturnValue(JSON.stringify([]));

      await searchTweetsTool.execute({ query: 'from:elonmusk', count: 5 });

      expect(mockExecSync).toHaveBeenCalledWith(
        'bird search "from:elonmusk" -n 5 --json',
        expect.any(Object)
      );
    });

    it('should escape quotes in search query', async () => {
      mockExecSync.mockReturnValue('[]');

      await searchTweetsTool.execute({ query: 'he said "yes"' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('he said \\"yes\\"'),
        expect.any(Object)
      );
    });

    it('should handle search errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('API error');
      });

      const result = await searchTweetsTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Search failed');
    });
  });

  // ============ readTweetTool ============
  describe('readTweetTool', () => {
    it('should have correct metadata', () => {
      expect(readTweetTool.name).toBe('read_tweet');
      expect(readTweetTool.parameters.required).toContain('tweetUrl');
    });

    it('should read a tweet by URL', async () => {
      const tweetData = {
        id: '123456789',
        text: 'Original tweet content',
        author: '@user',
      };
      mockExecSync.mockReturnValue(JSON.stringify(tweetData));

      const result = await readTweetTool.execute({
        tweetUrl: 'https://twitter.com/user/status/123456789',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Tweet retrieved');
      expect(result.data).toEqual(tweetData);
    });

    it('should handle non-existent tweets', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Tweet not found');
      });

      const result = await readTweetTool.execute({ tweetUrl: '999' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to read tweet');
    });
  });

  // ============ getMentionsTool ============
  describe('getMentionsTool', () => {
    it('should have correct metadata', () => {
      expect(getMentionsTool.name).toBe('get_mentions');
    });

    it('should get mentions with default count', async () => {
      mockExecSync.mockReturnValue(JSON.stringify([
        { id: '1', text: '@me hello!' },
      ]));

      const result = await getMentionsTool.execute({});

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'bird mentions -n 10 --json',
        expect.any(Object)
      );
    });

    it('should get mentions with custom count', async () => {
      mockExecSync.mockReturnValue('[]');

      await getMentionsTool.execute({ count: 25 });

      expect(mockExecSync).toHaveBeenCalledWith(
        'bird mentions -n 25 --json',
        expect.any(Object)
      );
    });

    it('should handle errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Auth required');
      });

      const result = await getMentionsTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to get mentions');
    });
  });

  // ============ getHomeTimelineTool ============
  describe('getHomeTimelineTool', () => {
    it('should have correct metadata', () => {
      expect(getHomeTimelineTool.name).toBe('get_home_timeline');
    });

    it('should get "For You" timeline by default', async () => {
      mockExecSync.mockReturnValue(JSON.stringify([]));

      await getHomeTimelineTool.execute({});

      expect(mockExecSync).toHaveBeenCalledWith(
        'bird home -n 10 --json',
        expect.any(Object)
      );
    });

    it('should get "Following" timeline when specified', async () => {
      mockExecSync.mockReturnValue('[]');

      await getHomeTimelineTool.execute({ following: true, count: 15 });

      expect(mockExecSync).toHaveBeenCalledWith(
        'bird home --following -n 15 --json',
        expect.any(Object)
      );
    });

    it('should handle errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await getHomeTimelineTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to get timeline');
    });
  });

  // ============ getUserTweetsTool ============
  describe('getUserTweetsTool', () => {
    it('should have correct metadata', () => {
      expect(getUserTweetsTool.name).toBe('get_user_tweets');
      expect(getUserTweetsTool.parameters.required).toContain('username');
    });

    it('should add @ prefix if missing', async () => {
      mockExecSync.mockReturnValue('[]');

      await getUserTweetsTool.execute({ username: 'elonmusk' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'bird user-tweets @elonmusk -n 10 --json',
        expect.any(Object)
      );
    });

    it('should not double-add @ prefix', async () => {
      mockExecSync.mockReturnValue('[]');

      await getUserTweetsTool.execute({ username: '@elonmusk' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'bird user-tweets @elonmusk -n 10 --json',
        expect.any(Object)
      );
    });

    it('should respect custom count', async () => {
      mockExecSync.mockReturnValue('[]');

      await getUserTweetsTool.execute({ username: 'user', count: 50 });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-n 50'),
        expect.any(Object)
      );
    });

    it('should handle user not found', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('User not found');
      });

      const result = await getUserTweetsTool.execute({ username: 'nonexistent12345' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to get user tweets');
    });
  });

  // ============ draftTweetTool ============
  describe('draftTweetTool', () => {
    it('should have correct metadata', () => {
      expect(draftTweetTool.name).toBe('draft_tweet');
      expect(draftTweetTool.parameters.required).toContain('topic');
    });

    it('should return draft guidelines with defaults', async () => {
      const result = await draftTweetTool.execute({ topic: 'AI agents' });

      expect(result.success).toBe(true);
      expect(result.data.topic).toBe('AI agents');
      expect(result.data.style).toBe('insight'); // default
      expect(result.data.guidelines).toContain('Max 280 characters');
      expect(result.data.guidelines).toContain('Hook in first line');
      expect(mockExecSync).not.toHaveBeenCalled(); // Draft doesn't post
    });

    it('should use specified style', async () => {
      const result = await draftTweetTool.execute({
        topic: 'Product launch',
        style: 'announcement',
      });

      expect(result.data.style).toBe('announcement');
    });

    it('should include hashtags guideline by default', async () => {
      const result = await draftTweetTool.execute({ topic: 'test' });

      const hashtagGuideline = result.data.guidelines.find((g: string) =>
        g.includes('hashtag')
      );
      expect(hashtagGuideline).toContain('Include');
    });

    it('should exclude hashtags when specified', async () => {
      const result = await draftTweetTool.execute({
        topic: 'test',
        includeHashtags: false,
      });

      const hashtagGuideline = result.data.guidelines.find((g: string) =>
        g.toLowerCase().includes('hashtag')
      );
      expect(hashtagGuideline).toContain('No hashtags');
    });

    it('should include CTA guideline by default', async () => {
      const result = await draftTweetTool.execute({ topic: 'test' });

      const ctaGuideline = result.data.guidelines.find((g: string) =>
        g.includes('CTA') || g.includes('engagement')
      );
      expect(ctaGuideline).toBeDefined();
    });

    it('should exclude CTA when specified', async () => {
      const result = await draftTweetTool.execute({
        topic: 'test',
        includeCTA: false,
      });

      const ctaGuideline = result.data.guidelines.find((g: string) =>
        g.includes('No CTA')
      );
      expect(ctaGuideline).toBeDefined();
    });
  });

  // ============ checkTwitterAuthTool ============
  describe('checkTwitterAuthTool', () => {
    it('should have correct metadata', () => {
      expect(checkTwitterAuthTool.name).toBe('check_twitter_auth');
    });

    it('should report authenticated status', async () => {
      mockExecSync.mockReturnValue('Logged in as @novabot9000 (Nova Bot)');

      const result = await checkTwitterAuthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('authenticated');
      expect(result.data.authenticated).toBe(true);
      expect(result.data.handle).toBe('novabot9000');
      expect(result.data.name).toBe('Nova Bot');
    });

    it('should handle different whoami formats', async () => {
      mockExecSync.mockReturnValue('@testuser');

      const result = await checkTwitterAuthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data.authenticated).toBe(true);
      expect(result.data.handle).toBe('testuser');
    });

    it('should report not authenticated when no cookies', async () => {
      mockExecSync.mockReturnValue('No Twitter cookies found');

      const result = await checkTwitterAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('not authenticated');
      expect(result.data.authenticated).toBe(false);
    });

    it('should report not authenticated on error', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('bird: command not found');
      });

      const result = await checkTwitterAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.data.authenticated).toBe(false);
    });
  });

  // ============ execBird error handling ============
  describe('execBird error handling', () => {
    it('should handle stderr errors', async () => {
      mockExecSync.mockImplementation(() => {
        const err = new Error() as any;
        err.stderr = 'Specific error message from stderr';
        throw err;
      });

      const result = await postTweetTool.execute({ text: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Specific error message from stderr');
    });

    it('should handle error.message fallback', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Generic error message');
      });

      const result = await postTweetTool.execute({ text: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Generic error message');
    });

    it('should handle non-JSON response gracefully', async () => {
      // When JSON parsing fails, should still return success with raw output
      mockExecSync.mockReturnValue('Not valid JSON output');

      const result = await searchTweetsTool.execute({ query: 'test' });

      expect(result.success).toBe(true);
      // data might be undefined when JSON parse fails
    });

    it('should parse valid JSON responses', async () => {
      const tweets = [{ id: '1', text: 'Hello' }];
      mockExecSync.mockReturnValue(JSON.stringify(tweets));

      const result = await searchTweetsTool.execute({ query: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(tweets);
    });
  });
});
