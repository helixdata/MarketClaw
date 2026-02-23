/**
 * Campaign Tools Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Use vi.hoisted for mocks that need to be available before module loading
const { mockMemory, mockCostTracker, mockTeamManager, mockFs } = vi.hoisted(() => ({
  mockMemory: {
    getCampaign: vi.fn(),
    saveCampaign: vi.fn(),
    listCampaigns: vi.fn(),
    getProduct: vi.fn(),
    getState: vi.fn(),
    saveState: vi.fn(),
  },
  mockCostTracker: {
    summarize: vi.fn(),
  },
  mockTeamManager: {
    findMember: vi.fn(),
    updateMember: vi.fn(),
  },
  mockFs: {
    unlink: vi.fn(),
  },
}));

vi.mock('../memory/index.js', () => ({
  memory: mockMemory,
}));

vi.mock('../costs/tracker.js', () => ({
  costTracker: mockCostTracker,
}));

vi.mock('../team/index.js', () => ({
  teamManager: mockTeamManager,
}));

vi.mock('fs/promises', () => ({
  unlink: mockFs.unlink,
}));

// Import after mocks
import { campaignTools } from './campaign-tools.js';
import { Campaign, CampaignPost } from '../memory/index.js';

// Helper to get tool by name
function getTool(name: string) {
  const tool = campaignTools.find(t => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool;
}

describe('Campaign Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMemory.getState.mockResolvedValue({ preferences: {} });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create_campaign', () => {
    it('should create a campaign for an existing product', async () => {
      mockMemory.getProduct.mockResolvedValue({
        id: 'product-1',
        name: 'Test Product',
      });
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('create_campaign');
      const result = await tool.execute({
        name: 'Launch Campaign',
        productId: 'product-1',
        channels: ['twitter', 'linkedin'],
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Launch Campaign');
      expect(result.data?.name).toBe('Launch Campaign');
      expect(mockMemory.saveCampaign).toHaveBeenCalled();
    });

    it('should fail if product does not exist', async () => {
      mockMemory.getProduct.mockResolvedValue(null);

      const tool = getTool('create_campaign');
      const result = await tool.execute({
        name: 'Launch Campaign',
        productId: 'nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Product not found');
    });

    it('should handle optional fields', async () => {
      mockMemory.getProduct.mockResolvedValue({ id: 'p1', name: 'Product' });
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('create_campaign');
      const result = await tool.execute({
        name: 'Simple Campaign',
        productId: 'p1',
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-31T00:00:00Z',
        notes: 'Test notes',
      });

      expect(result.success).toBe(true);
      const savedCampaign = mockMemory.saveCampaign.mock.calls[0][0];
      expect(savedCampaign.startDate).toBeDefined();
      expect(savedCampaign.notes).toBe('Test notes');
    });
  });

  describe('list_campaigns', () => {
    it('should list all campaigns', async () => {
      const campaigns: Campaign[] = [
        {
          id: 'c1',
          productId: 'p1',
          name: 'Campaign 1',
          status: 'active',
          channels: ['twitter'],
          posts: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'c2',
          productId: 'p1',
          name: 'Campaign 2',
          status: 'draft',
          channels: [],
          posts: [{ id: 'post1', channel: 'twitter', content: 'test', status: 'published' } as CampaignPost],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      mockMemory.listCampaigns.mockResolvedValue(campaigns);
      mockMemory.getProduct.mockResolvedValue({ id: 'p1', name: 'Product' });

      const tool = getTool('list_campaigns');
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.campaigns).toHaveLength(2);
      expect(result.data?.campaigns[1].publishedPosts).toBe(1);
    });

    it('should filter by status', async () => {
      const campaigns: Campaign[] = [
        { id: 'c1', productId: 'p1', name: 'Active', status: 'active', channels: [], posts: [], createdAt: 0, updatedAt: 0 },
        { id: 'c2', productId: 'p1', name: 'Draft', status: 'draft', channels: [], posts: [], createdAt: 0, updatedAt: 0 },
      ];
      mockMemory.listCampaigns.mockResolvedValue(campaigns);
      mockMemory.getProduct.mockResolvedValue({ id: 'p1', name: 'Product' });

      const tool = getTool('list_campaigns');
      const result = await tool.execute({ status: 'active' });

      expect(result.success).toBe(true);
      expect(result.data?.campaigns).toHaveLength(1);
      expect(result.data?.campaigns[0].name).toBe('Active');
    });

    it('should return empty list when no campaigns', async () => {
      mockMemory.listCampaigns.mockResolvedValue([]);

      const tool = getTool('list_campaigns');
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No campaigns found');
    });
  });

  describe('get_campaign', () => {
    it('should get campaign details', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Test Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { id: 'post1', channel: 'twitter', content: 'Hello world', status: 'published', publishedAt: Date.now() } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.getProduct.mockResolvedValue({ id: 'p1', name: 'Product' });

      const tool = getTool('get_campaign');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Test Campaign');
      expect(result.data?.posts).toHaveLength(1);
    });

    it('should fail if campaign not found', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);

      const tool = getTool('get_campaign');
      const result = await tool.execute({ campaignId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Campaign not found');
    });

    it('should truncate long post content in preview', async () => {
      const longContent = 'A'.repeat(200);
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Test Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { id: 'post1', channel: 'twitter', content: longContent, status: 'draft' } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.getProduct.mockResolvedValue({ id: 'p1', name: 'Product' });

      const tool = getTool('get_campaign');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.posts[0].content.length).toBe(103); // 100 + '...'
      expect(result.data?.posts[0].content).toContain('...');
    });

    it('should handle campaign with dates and metrics', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Test Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { id: 'post1', channel: 'twitter', content: 'Short', status: 'scheduled', scheduledAt: Date.now() + 86400000, metrics: { impressions: 100 } } as CampaignPost,
        ],
        startDate: Date.now(),
        endDate: Date.now() + 86400000 * 30,
        metrics: { totalReach: 500 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.getProduct.mockResolvedValue({ id: 'p1', name: 'Product' });

      const tool = getTool('get_campaign');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.startDate).toBeDefined();
      expect(result.data?.endDate).toBeDefined();
      expect(result.data?.metrics).toBeDefined();
      expect(result.data?.posts[0].scheduledAt).toBeDefined();
    });
  });

  describe('get_campaign_post', () => {
    it('should get full post content', async () => {
      const fullContent = 'A'.repeat(500);
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Test Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { 
            id: 'post1', 
            channel: 'twitter', 
            content: fullContent, 
            status: 'published',
            publishedAt: Date.now(),
            externalId: 'ext-123',
            externalUrl: 'https://twitter.com/post/123',
            metrics: { impressions: 1000, likes: 50 },
          } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);

      const tool = getTool('get_campaign_post');
      const result = await tool.execute({ campaignId: 'c1', postId: 'post1' });

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe(fullContent); // Full content, not truncated
      expect(result.data?.content.length).toBe(500);
      expect(result.data?.externalId).toBe('ext-123');
      expect(result.data?.externalUrl).toBe('https://twitter.com/post/123');
      expect(result.data?.metrics).toEqual({ impressions: 1000, likes: 50 });
    });

    it('should fail if campaign not found', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);

      const tool = getTool('get_campaign_post');
      const result = await tool.execute({ campaignId: 'nonexistent', postId: 'post1' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Campaign not found');
    });

    it('should fail if post not found', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Test Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);

      const tool = getTool('get_campaign_post');
      const result = await tool.execute({ campaignId: 'c1', postId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Post not found');
    });

    it('should handle scheduled post without publishedAt', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Test Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { 
            id: 'post1', 
            channel: 'twitter', 
            content: 'Scheduled content', 
            status: 'scheduled',
            scheduledAt: Date.now() + 86400000,
          } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);

      const tool = getTool('get_campaign_post');
      const result = await tool.execute({ campaignId: 'c1', postId: 'post1' });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('scheduled');
      expect(result.data?.scheduledAt).toBeDefined();
      expect(result.data?.publishedAt).toBeNull();
    });
  });

  describe('update_campaign', () => {
    it('should update campaign fields', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Old Name',
        status: 'draft',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('update_campaign');
      const result = await tool.execute({
        campaignId: 'c1',
        name: 'New Name',
        status: 'active',
        channels: ['twitter', 'linkedin'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('New Name');
      expect(result.data?.status).toBe('active');
    });

    it('should fail if campaign not found', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);

      const tool = getTool('update_campaign');
      const result = await tool.execute({ campaignId: 'nonexistent', name: 'New' });

      expect(result.success).toBe(false);
    });

    it('should update campaign dates', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'draft',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('update_campaign');
      const result = await tool.execute({
        campaignId: 'c1',
        startDate: '2026-04-01T00:00:00Z',
        endDate: '2026-04-30T00:00:00Z',
      });

      expect(result.success).toBe(true);
      const savedCampaign = mockMemory.saveCampaign.mock.calls[0][0];
      expect(savedCampaign.startDate).toBe(new Date('2026-04-01T00:00:00Z').getTime());
      expect(savedCampaign.endDate).toBe(new Date('2026-04-30T00:00:00Z').getTime());
    });

    it('should update campaign notes including empty string', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'draft',
        channels: [],
        posts: [],
        notes: 'Old notes',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('update_campaign');
      const result = await tool.execute({
        campaignId: 'c1',
        notes: '', // Empty string should clear notes
      });

      expect(result.success).toBe(true);
      const savedCampaign = mockMemory.saveCampaign.mock.calls[0][0];
      expect(savedCampaign.notes).toBe('');
    });
  });

  describe('delete_campaign', () => {
    it('should require confirmation', async () => {
      const tool = getTool('delete_campaign');
      const result = await tool.execute({ campaignId: 'c1', confirm: false });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not confirmed');
    });

    it('should fail if campaign not found', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);

      const tool = getTool('delete_campaign');
      const result = await tool.execute({ campaignId: 'nonexistent', confirm: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Campaign not found');
    });

    it('should delete campaign successfully', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign to Delete',
        status: 'draft',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockFs.unlink.mockResolvedValue(undefined);

      const tool = getTool('delete_campaign');
      const result = await tool.execute({ campaignId: 'c1', confirm: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted');
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should handle file deletion error', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'draft',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockFs.unlink.mockRejectedValue(new Error('ENOENT: file not found'));

      const tool = getTool('delete_campaign');
      const result = await tool.execute({ campaignId: 'c1', confirm: true });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to delete');
    });
  });

  describe('add_campaign_post', () => {
    it('should add post to existing campaign', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('add_campaign_post');
      const result = await tool.execute({
        campaignId: 'c1',
        channel: 'twitter',
        content: 'Hello world!',
      });

      expect(result.success).toBe(true);
      expect(result.data?.channel).toBe('twitter');
      expect(result.data?.status).toBe('draft');
      expect(campaign.posts).toHaveLength(1);
      expect(campaign.channels).toContain('twitter');
    });

    it('should auto-create campaign if none exists', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);
      mockMemory.getState.mockResolvedValue({ activeProduct: 'p1', preferences: {} });
      mockMemory.getProduct.mockResolvedValue({ id: 'p1', name: 'Product' });
      mockMemory.listCampaigns.mockResolvedValue([]);
      mockMemory.saveCampaign.mockResolvedValue(undefined);
      mockMemory.saveState.mockResolvedValue(undefined);

      const tool = getTool('add_campaign_post');
      const result = await tool.execute({
        channel: 'twitter',
        content: 'Hello world!',
      });

      expect(result.success).toBe(true);
      expect(result.data?.campaignCreated).toBe(true);
      expect(result.message).toContain('Auto-created campaign');
    });

    it('should use active campaign when campaignId not provided', async () => {
      const campaign: Campaign = {
        id: 'active-campaign',
        productId: 'p1',
        name: 'Active Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getState.mockResolvedValue({ activeCampaign: 'active-campaign', preferences: {} });
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('add_campaign_post');
      const result = await tool.execute({
        channel: 'linkedin',
        content: 'Professional post',
      });

      expect(result.success).toBe(true);
      expect(result.data?.campaignId).toBe('active-campaign');
    });

    it('should set post as scheduled if scheduledAt provided', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('add_campaign_post');
      const result = await tool.execute({
        campaignId: 'c1',
        channel: 'twitter',
        content: 'Scheduled tweet',
        scheduledAt: '2026-03-01T10:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('scheduled');
    });

    it('should fail when no product specified and no active product', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);
      mockMemory.getState.mockResolvedValue({ preferences: {} }); // No activeProduct

      const tool = getTool('add_campaign_post');
      const result = await tool.execute({
        channel: 'twitter',
        content: 'Hello world!',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No campaign specified and no active product');
    });

    it('should fail when product not found', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);
      mockMemory.getState.mockResolvedValue({ activeProduct: 'p1', preferences: {} });
      mockMemory.getProduct.mockResolvedValue(null);

      const tool = getTool('add_campaign_post');
      const result = await tool.execute({
        channel: 'twitter',
        content: 'Hello world!',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Product not found');
    });

    it('should use member active campaign when callerTelegramId provided', async () => {
      const campaign: Campaign = {
        id: 'member-campaign',
        productId: 'p1',
        name: 'Member Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockTeamManager.findMember.mockReturnValue({
        id: 'member-1',
        name: 'Test User',
        preferences: { activeCampaign: 'member-campaign' },
      });
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('add_campaign_post');
      const result = await tool.execute({
        channel: 'twitter',
        content: 'Member post',
        callerTelegramId: 123456,
      });

      expect(result.success).toBe(true);
      expect(result.data?.campaignId).toBe('member-campaign');
    });

    it('should use existing active campaign for product instead of creating new', async () => {
      const existingCampaign: Campaign = {
        id: 'existing-active',
        productId: 'p1',
        name: 'Existing Active',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(null);
      mockMemory.getState.mockResolvedValue({ activeProduct: 'p1', preferences: {} });
      mockMemory.getProduct.mockResolvedValue({ id: 'p1', name: 'Product' });
      mockMemory.listCampaigns.mockResolvedValue([existingCampaign]);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('add_campaign_post');
      const result = await tool.execute({
        channel: 'twitter',
        content: 'Post to existing',
      });

      expect(result.success).toBe(true);
      expect(result.data?.campaignId).toBe('existing-active');
      expect(result.data?.campaignCreated).toBe(false);
    });

    it('should use most recently updated campaign when no active campaign exists', async () => {
      const olderCampaign: Campaign = {
        id: 'older',
        productId: 'p1',
        name: 'Older',
        status: 'draft',
        channels: [],
        posts: [],
        createdAt: Date.now() - 200000,
        updatedAt: Date.now() - 200000,
      };
      const newerCampaign: Campaign = {
        id: 'newer',
        productId: 'p1',
        name: 'Newer',
        status: 'paused',
        channels: [],
        posts: [],
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 100000,
      };
      mockMemory.getCampaign.mockResolvedValue(null);
      mockMemory.getState.mockResolvedValue({ activeProduct: 'p1', preferences: {} });
      mockMemory.getProduct.mockResolvedValue({ id: 'p1', name: 'Product' });
      mockMemory.listCampaigns.mockResolvedValue([olderCampaign, newerCampaign]); // No active ones
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('add_campaign_post');
      const result = await tool.execute({
        channel: 'twitter',
        content: 'Post to most recent',
      });

      expect(result.success).toBe(true);
      expect(result.data?.campaignId).toBe('newer');
    });
  });

  describe('update_campaign_post', () => {
    it('should update post content', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { id: 'post1', channel: 'twitter', content: 'Old content', status: 'draft' } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('update_campaign_post');
      const result = await tool.execute({
        campaignId: 'c1',
        postId: 'post1',
        content: 'New content',
      });

      expect(result.success).toBe(true);
      expect(campaign.posts[0].content).toBe('New content');
    });

    it('should fail if post not found', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);

      const tool = getTool('update_campaign_post');
      const result = await tool.execute({
        campaignId: 'c1',
        postId: 'nonexistent',
        content: 'New',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Post not found');
    });

    it('should set publishedAt when status changed to published', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { id: 'post1', channel: 'twitter', content: 'Content', status: 'draft' } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('update_campaign_post');
      const result = await tool.execute({
        campaignId: 'c1',
        postId: 'post1',
        status: 'published',
      });

      expect(result.success).toBe(true);
      expect(campaign.posts[0].publishedAt).toBeDefined();
    });

    it('should change status to scheduled when scheduledAt is set on draft post', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { id: 'post1', channel: 'twitter', content: 'Content', status: 'draft' } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('update_campaign_post');
      const result = await tool.execute({
        campaignId: 'c1',
        postId: 'post1',
        scheduledAt: '2026-04-01T10:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(campaign.posts[0].status).toBe('scheduled');
      expect(campaign.posts[0].scheduledAt).toBeDefined();
    });

    it('should use active campaign when campaignId not provided', async () => {
      const campaign: Campaign = {
        id: 'active-campaign',
        productId: 'p1',
        name: 'Active Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { id: 'post1', channel: 'twitter', content: 'Content', status: 'draft' } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getState.mockResolvedValue({ activeCampaign: 'active-campaign', preferences: {} });
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.saveCampaign.mockResolvedValue(undefined);

      const tool = getTool('update_campaign_post');
      const result = await tool.execute({
        postId: 'post1',
        content: 'Updated via active campaign',
      });

      expect(result.success).toBe(true);
      expect(campaign.posts[0].content).toBe('Updated via active campaign');
    });

    it('should fail if no campaign specified and no active campaign', async () => {
      mockMemory.getState.mockResolvedValue({ preferences: {} });
      mockMemory.getCampaign.mockResolvedValue(null);

      const tool = getTool('update_campaign_post');
      const result = await tool.execute({
        postId: 'post1',
        content: 'Update',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No campaign specified');
    });
  });

  describe('set_active_campaign', () => {
    it('should set active campaign', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockMemory.getState.mockResolvedValue({ preferences: {} });
      mockMemory.saveState.mockResolvedValue(undefined);

      const tool = getTool('set_active_campaign');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(mockMemory.saveState).toHaveBeenCalledWith(
        expect.objectContaining({ activeCampaign: 'c1' })
      );
    });

    it('should fail if campaign not found', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);

      const tool = getTool('set_active_campaign');
      const result = await tool.execute({ campaignId: 'nonexistent' });

      expect(result.success).toBe(false);
    });

    it('should set active campaign per-member when callerTelegramId provided', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockTeamManager.findMember.mockReturnValue({
        id: 'member-1',
        name: 'Test User',
        preferences: { theme: 'dark' },
      });
      mockTeamManager.updateMember.mockResolvedValue(undefined);

      const tool = getTool('set_active_campaign');
      const result = await tool.execute({ campaignId: 'c1', callerTelegramId: 123456 });

      expect(result.success).toBe(true);
      expect(result.message).toContain('for Test User');
      expect(mockTeamManager.updateMember).toHaveBeenCalledWith(
        'member-1',
        { preferences: { theme: 'dark', activeCampaign: 'c1' } }
      );
    });

    it('should clear active campaign globally', async () => {
      mockMemory.getState.mockResolvedValue({ activeCampaign: 'c1', preferences: {} });
      mockMemory.saveState.mockResolvedValue(undefined);

      const tool = getTool('set_active_campaign');
      const result = await tool.execute({ campaignId: null as any });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Active campaign cleared');
      expect(mockMemory.saveState).toHaveBeenCalledWith(
        expect.objectContaining({ activeCampaign: undefined })
      );
    });

    it('should clear active campaign per-member', async () => {
      mockTeamManager.findMember.mockReturnValue({
        id: 'member-1',
        name: 'Test User',
        preferences: { activeCampaign: 'c1' },
      });
      mockTeamManager.updateMember.mockResolvedValue(undefined);

      const tool = getTool('set_active_campaign');
      const result = await tool.execute({ campaignId: null as any, callerTelegramId: 123456 });

      expect(result.success).toBe(true);
      expect(mockTeamManager.updateMember).toHaveBeenCalledWith(
        'member-1',
        { preferences: { activeCampaign: undefined } }
      );
    });
  });

  describe('get_campaign_metrics', () => {
    it('should aggregate metrics from posts', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: ['twitter', 'linkedin'],
        posts: [
          { id: 'p1', channel: 'twitter', content: 'Tweet', status: 'published', metrics: { impressions: 100, likes: 10 } } as CampaignPost,
          { id: 'p2', channel: 'linkedin', content: 'Post', status: 'published', metrics: { impressions: 200, likes: 20 } } as CampaignPost,
          { id: 'p3', channel: 'twitter', content: 'Draft', status: 'draft' } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockResolvedValue({ totalUsd: 0, count: 0 });

      const tool = getTool('get_campaign_metrics');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.posts.total).toBe(3);
      expect(result.data?.posts.published).toBe(2);
      expect(result.data?.posts.draft).toBe(1);
      expect(result.data?.totals.impressions).toBe(300);
      expect(result.data?.totals.likes).toBe(30);
    });

    it('should include cost data when available', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockResolvedValue({
        totalUsd: 0.05,
        count: 3,
        byTool: { generate_image: 0.04, send_email: 0.01 },
        byProvider: { openai: 0.04, resend: 0.01 },
      });

      const tool = getTool('get_campaign_metrics');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.costs).toBeDefined();
      expect(result.data?.costs.totalUsd).toBe(0.05);
    });

    it('should fail if campaign not found', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);

      const tool = getTool('get_campaign_metrics');
      const result = await tool.execute({ campaignId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Campaign not found');
    });

    it('should handle cost tracker errors gracefully', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockRejectedValue(new Error('Cost tracker not initialized'));

      const tool = getTool('get_campaign_metrics');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.costs).toBeNull(); // Should gracefully handle error
    });

    it('should aggregate all metric types including shares and comments', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { 
            id: 'p1', 
            channel: 'twitter', 
            content: 'Tweet', 
            status: 'published', 
            metrics: { impressions: 100, clicks: 20, likes: 10, shares: 5, comments: 3 } 
          } as CampaignPost,
          { 
            id: 'p2', 
            channel: 'twitter', 
            content: 'Tweet 2', 
            status: 'published', 
            metrics: { impressions: 50, clicks: 10, likes: 5, shares: 2, comments: 1 } 
          } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockResolvedValue({ totalUsd: 0, count: 0 });

      const tool = getTool('get_campaign_metrics');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.totals.impressions).toBe(150);
      expect(result.data?.totals.clicks).toBe(30);
      expect(result.data?.totals.shares).toBe(7);
      expect(result.data?.totals.comments).toBe(4);
      expect(result.data?.byChannel.twitter.impressions).toBe(150);
    });

    it('should calculate engagement rate', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { 
            id: 'p1', 
            channel: 'twitter', 
            content: 'Tweet', 
            status: 'published', 
            metrics: { impressions: 1000, likes: 50, shares: 20, comments: 30 } 
          } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockResolvedValue({ totalUsd: 0, count: 0 });

      const tool = getTool('get_campaign_metrics');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.engagementRate).toBe('10.00%'); // (50+20+30)/1000 * 100
    });

    it('should count failed and scheduled posts', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [
          { id: 'p1', channel: 'twitter', content: 'Failed', status: 'failed' } as CampaignPost,
          { id: 'p2', channel: 'twitter', content: 'Scheduled', status: 'scheduled' } as CampaignPost,
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockResolvedValue({ totalUsd: 0, count: 0 });

      const tool = getTool('get_campaign_metrics');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.posts.failed).toBe(1);
      expect(result.data?.posts.scheduled).toBe(1);
    });
  });

  describe('get_campaign_costs', () => {
    it('should return cost breakdown', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockResolvedValue({
        totalUsd: 0.10,
        count: 5,
        byTool: { generate_image: 0.08, ai_completion: 0.02 },
        byProvider: { openai: 0.10 },
        from: '2026-02-01T00:00:00Z',
        to: '2026-02-22T00:00:00Z',
      });

      const tool = getTool('get_campaign_costs');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.data?.totalUsd).toBe(0.10);
      expect(result.data?.count).toBe(5);
      expect(result.data?.byTool).toBeDefined();
    });

    it('should handle no costs', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockResolvedValue({ totalUsd: 0, count: 0 });

      const tool = getTool('get_campaign_costs');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('No costs recorded');
    });

    it('should fail if campaign not found', async () => {
      mockMemory.getCampaign.mockResolvedValue(null);

      const tool = getTool('get_campaign_costs');
      const result = await tool.execute({ campaignId: 'nonexistent' });

      expect(result.success).toBe(false);
    });

    it('should handle cost tracker errors', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockRejectedValue(new Error('Database connection error'));

      const tool = getTool('get_campaign_costs');
      const result = await tool.execute({ campaignId: 'c1' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to get costs');
    });

    it('should pass date range parameters to cost tracker', async () => {
      const campaign: Campaign = {
        id: 'c1',
        productId: 'p1',
        name: 'Campaign',
        status: 'active',
        channels: [],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockMemory.getCampaign.mockResolvedValue(campaign);
      mockCostTracker.summarize.mockResolvedValue({
        totalUsd: 0.05,
        count: 2,
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-31T00:00:00Z',
      });

      const tool = getTool('get_campaign_costs');
      const result = await tool.execute({
        campaignId: 'c1',
        from: 'this-month',
        to: '2026-01-31T00:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(mockCostTracker.summarize).toHaveBeenCalledWith({
        campaignId: 'c1',
        from: 'this-month',
        to: '2026-01-31T00:00:00Z',
      });
    });
  });

  describe('tool definitions', () => {
    it('should have 11 campaign tools', () => {
      expect(campaignTools).toHaveLength(11);
    });

    it('should have valid tool definitions', () => {
      for (const tool of campaignTools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.parameters).toBeDefined();
        expect(tool.execute).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      }
    });
  });
});
