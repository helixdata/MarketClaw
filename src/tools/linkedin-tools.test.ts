/**
 * LinkedIn Tools Tests
 * Tests for post_to_linkedin, draft_linkedin_post, get_linkedin_profile, check_linkedin_auth
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  postToLinkedInTool,
  draftLinkedInPostTool,
  getLinkedInProfileTool,
  checkLinkedInAuthTool,
  linkedInTools,
} from './linkedin-tools.js';

// Mock child_process.execSync for keychain access
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';

// Store original fetch
const originalFetch = global.fetch;

describe('LinkedIn Tools', () => {
  let mockFetch: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Default: keychain returns valid token
    (execSync as Mock).mockReturnValue(JSON.stringify({
      accessToken: 'test-linkedin-token',
      expiresAt: Date.now() + 3600000,
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.LINKEDIN_ACCESS_TOKEN;
  });

  describe('linkedInTools array', () => {
    it('should export all LinkedIn tools', () => {
      expect(linkedInTools).toHaveLength(4);
      const names = linkedInTools.map(t => t.name);
      expect(names).toContain('post_to_linkedin');
      expect(names).toContain('draft_linkedin_post');
      expect(names).toContain('get_linkedin_profile');
      expect(names).toContain('check_linkedin_auth');
    });
  });

  describe('postToLinkedInTool', () => {
    it('should have correct definition', () => {
      expect(postToLinkedInTool.name).toBe('post_to_linkedin');
      expect(postToLinkedInTool.description).toContain('LinkedIn');
      expect(postToLinkedInTool.parameters.required).toContain('text');
    });

    describe('with valid token', () => {
      it('should post text-only content successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'urn:li:ugcPost:123456' }),
        });

        const result = await postToLinkedInTool.execute({
          text: 'Hello LinkedIn!',
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('Posted to LinkedIn');
        expect(result.data?.postId).toBe('urn:li:ugcPost:123456');
        expect(result.data?.postUrl).toContain('urn:li:ugcPost:123456');

        // Verify API call
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.linkedin.com/v2/ugcPosts',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-linkedin-token',
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            }),
          })
        );

        // Check payload structure
        const callArgs = mockFetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.author).toBe('urn:li:person:vuzryA4D9-');
        expect(body.lifecycleState).toBe('PUBLISHED');
        expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text).toBe('Hello LinkedIn!');
        expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory).toBe('NONE');
      });

      it('should post with link successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'urn:li:ugcPost:789' }),
        });

        const result = await postToLinkedInTool.execute({
          text: 'Check out this article!',
          linkUrl: 'https://example.com/article',
          linkTitle: 'Amazing Article',
          linkDescription: 'You should read this',
        });

        expect(result.success).toBe(true);

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory).toBe('ARTICLE');
        expect(body.specificContent['com.linkedin.ugc.ShareContent'].media[0].originalUrl).toBe('https://example.com/article');
        expect(body.specificContent['com.linkedin.ugc.ShareContent'].media[0].title.text).toBe('Amazing Article');
        expect(body.specificContent['com.linkedin.ugc.ShareContent'].media[0].description.text).toBe('You should read this');
      });

      it('should respect visibility setting', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'urn:li:ugcPost:999' }),
        });

        await postToLinkedInTool.execute({
          text: 'Connections only post',
          visibility: 'CONNECTIONS',
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.visibility['com.linkedin.ugc.MemberNetworkVisibility']).toBe('CONNECTIONS');
      });

      it('should default visibility to PUBLIC', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'urn:li:ugcPost:111' }),
        });

        await postToLinkedInTool.execute({
          text: 'Public post',
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.visibility['com.linkedin.ugc.MemberNetworkVisibility']).toBe('PUBLIC');
      });

      it('should handle dryRun without posting', async () => {
        const result = await postToLinkedInTool.execute({
          text: 'Test post content',
          linkUrl: 'https://example.com',
          dryRun: true,
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('Preview');
        expect(result.data?.text).toBe('Test post content');
        expect(result.data?.linkUrl).toBe('https://example.com');
        expect(result.data?.characterCount).toBe(17);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should return error when no token available', async () => {
        (execSync as Mock).mockImplementation(() => {
          throw new Error('keychain not found');
        });
        delete process.env.LINKEDIN_ACCESS_TOKEN;

        const result = await postToLinkedInTool.execute({
          text: 'This will fail',
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('token not found');
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should handle API error responses', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized - token expired',
        });

        const result = await postToLinkedInTool.execute({
          text: 'Will fail',
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('LinkedIn API error');
        expect(result.message).toContain('401');
        expect(result.message).toContain('Unauthorized');
      });

      it('should handle API rate limiting', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded',
        });

        const result = await postToLinkedInTool.execute({
          text: 'Too many posts',
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('429');
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

        const result = await postToLinkedInTool.execute({
          text: 'Network test',
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Failed to post');
        expect(result.message).toContain('Network timeout');
      });

      it('should handle non-Error exceptions', async () => {
        mockFetch.mockRejectedValueOnce('String error');

        const result = await postToLinkedInTool.execute({
          text: 'Test',
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('String error');
      });
    });

    describe('token retrieval', () => {
      it('should use keychain token first', async () => {
        (execSync as Mock).mockReturnValue(JSON.stringify({
          accessToken: 'keychain-token',
        }));
        process.env.LINKEDIN_ACCESS_TOKEN = 'env-token';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'test' }),
        });

        await postToLinkedInTool.execute({ text: 'Test' });

        const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
        expect(authHeader).toBe('Bearer keychain-token');
      });

      it('should fall back to env var when keychain fails', async () => {
        (execSync as Mock).mockImplementation(() => {
          throw new Error('not found');
        });
        process.env.LINKEDIN_ACCESS_TOKEN = 'env-token';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'test' }),
        });

        await postToLinkedInTool.execute({ text: 'Test' });

        const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
        expect(authHeader).toBe('Bearer env-token');
      });

      it('should parse plain string token from keychain', async () => {
        (execSync as Mock).mockReturnValue('plain-string-token');

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'test' }),
        });

        await postToLinkedInTool.execute({ text: 'Test' });

        const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
        expect(authHeader).toBe('Bearer plain-string-token');
      });

      it('should handle access_token key in JSON', async () => {
        (execSync as Mock).mockReturnValue(JSON.stringify({
          access_token: 'snake-case-token',
        }));

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'test' }),
        });

        await postToLinkedInTool.execute({ text: 'Test' });

        const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
        expect(authHeader).toBe('Bearer snake-case-token');
      });
    });
  });

  describe('draftLinkedInPostTool', () => {
    it('should have correct definition', () => {
      expect(draftLinkedInPostTool.name).toBe('draft_linkedin_post');
      expect(draftLinkedInPostTool.description).toContain('draft');
      expect(draftLinkedInPostTool.parameters.required).toContain('topic');
    });

    it('should return draft parameters with guidelines', async () => {
      const result = await draftLinkedInPostTool.execute({
        topic: 'AI in Marketing',
      });

      expect(result.success).toBe(true);
      expect(result.data?.topic).toBe('AI in Marketing');
      expect(result.data?.style).toBe('insight'); // default
      expect(result.data?.guidelines).toBeInstanceOf(Array);
      expect(result.data?.guidelines.length).toBeGreaterThan(0);
    });

    it('should respect custom style', async () => {
      const result = await draftLinkedInPostTool.execute({
        topic: 'New Product Launch',
        style: 'announcement',
      });

      expect(result.data?.style).toBe('announcement');
    });

    it('should include CTA guideline by default', async () => {
      const result = await draftLinkedInPostTool.execute({
        topic: 'Tips for success',
      });

      const guidelines = result.data?.guidelines.join(' ');
      expect(guidelines).toContain('CTA');
    });

    it('should exclude CTA guideline when includeCTA is false', async () => {
      const result = await draftLinkedInPostTool.execute({
        topic: 'Just sharing',
        includeCTA: false,
      });

      const guidelines = result.data?.guidelines as string[];
      expect(guidelines.some(g => g.includes('No CTA'))).toBe(true);
    });

    it('should not make any API calls', async () => {
      await draftLinkedInPostTool.execute({
        topic: 'Test topic',
        style: 'story',
        includeEmojis: true,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getLinkedInProfileTool', () => {
    it('should have correct definition', () => {
      expect(getLinkedInProfileTool.name).toBe('get_linkedin_profile');
      expect(getLinkedInProfileTool.description).toContain('profile');
    });

    it('should return profile information', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'vuzryA4D9-',
          name: 'Brett Waterson',
          given_name: 'Brett',
          family_name: 'Waterson',
          picture: 'https://linkedin.com/photo.jpg',
        }),
      });

      const result = await getLinkedInProfileTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('profile retrieved');
      expect(result.data?.id).toBe('vuzryA4D9-');
      expect(result.data?.name).toBe('Brett Waterson');
      expect(result.data?.firstName).toBe('Brett');
      expect(result.data?.lastName).toBe('Waterson');
      expect(result.data?.picture).toBe('https://linkedin.com/photo.jpg');
      expect(result.data?.urn).toBe('urn:li:person:vuzryA4D9-');
    });

    it('should call userinfo endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'test',
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
        }),
      });

      await getLinkedInProfileTool.execute({});

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.linkedin.com/v2/userinfo',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-linkedin-token',
          }),
        })
      );
    });

    it('should return error when no token', async () => {
      (execSync as Mock).mockImplementation(() => {
        throw new Error('not found');
      });

      const result = await getLinkedInProfileTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('token not found');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const result = await getLinkedInProfileTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('403');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await getLinkedInProfileTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
    });
  });

  describe('checkLinkedInAuthTool', () => {
    it('should have correct definition', () => {
      expect(checkLinkedInAuthTool.name).toBe('check_linkedin_auth');
      expect(checkLinkedInAuthTool.description).toContain('authentication');
    });

    it('should return success for valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'abc123',
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
        }),
      });

      const result = await checkLinkedInAuthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('authenticated');
      expect(result.message).toContain('Test User');
      expect(result.data?.authenticated).toBe(true);
      expect(result.data?.name).toBe('Test User');
      expect(result.data?.urn).toBe('urn:li:person:abc123');
    });

    it('should return error for expired token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await checkLinkedInAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('expired');
      expect(result.data?.authenticated).toBe(false);
      expect(result.data?.expired).toBe(true);
    });

    it('should return error when no token found', async () => {
      (execSync as Mock).mockImplementation(() => {
        throw new Error('not found');
      });

      const result = await checkLinkedInAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('No LinkedIn token');
      expect(result.data?.authenticated).toBe(false);
    });

    it('should handle non-401 API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await checkLinkedInAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('500');
      expect(result.data?.authenticated).toBe(false);
      expect(result.data?.expired).toBeUndefined();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('DNS lookup failed'));

      const result = await checkLinkedInAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to verify token');
      expect(result.message).toContain('DNS lookup failed');
      expect(result.data?.authenticated).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string token from keychain', async () => {
      (execSync as Mock).mockReturnValue('');

      const result = await postToLinkedInTool.execute({
        text: 'Test',
      });

      // Empty string is falsy, should fall back to env var or fail
      expect(result.success).toBe(false);
    });

    it('should handle malformed JSON from keychain', async () => {
      (execSync as Mock).mockReturnValue('not-json-but-has-{-brace');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test' }),
      });

      // Should use the raw string as token since JSON.parse will fail
      const result = await postToLinkedInTool.execute({
        text: 'Test',
      });

      expect(result.success).toBe(true);
      const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
      expect(authHeader).toBe('Bearer not-json-but-has-{-brace');
    });

    it('should handle very long post text', async () => {
      const longText = 'x'.repeat(3000);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'long-post' }),
      });

      const result = await postToLinkedInTool.execute({
        text: longText,
      });

      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text).toBe(longText);
    });

    it('should handle special characters in post text', async () => {
      const specialText = 'Hello 👋 "Quotes" & <brackets> \n\nNew line!';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'special' }),
      });

      const result = await postToLinkedInTool.execute({
        text: specialText,
      });

      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text).toBe(specialText);
    });

    it('should handle link with no title/description', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'link-only' }),
      });

      const result = await postToLinkedInTool.execute({
        text: 'Check this out',
        linkUrl: 'https://example.com',
      });

      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const media = body.specificContent['com.linkedin.ugc.ShareContent'].media[0];
      expect(media.originalUrl).toBe('https://example.com');
      expect(media.title).toBeUndefined();
      expect(media.description).toBeUndefined();
    });
  });
});
