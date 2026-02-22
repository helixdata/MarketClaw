/**
 * Campaign Tools
 * CRUD operations for managing marketing campaigns
 */

import { Tool, ToolResult } from './types.js';
import { memory, Campaign, CampaignPost } from '../memory/index.js';
import { costTracker } from '../costs/tracker.js';

function generateId(): string {
  return `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generatePostId(): string {
  return `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get or create a campaign for operations
 * - Uses provided campaignId if given
 * - Falls back to active campaign
 * - Auto-creates default campaign if none exists
 */
async function getOrCreateCampaign(campaignId?: string, productId?: string): Promise<{ campaign: Campaign; created: boolean } | { error: string }> {
  // If campaignId provided, use it
  if (campaignId) {
    const campaign = await memory.getCampaign(campaignId);
    if (!campaign) {
      return { error: `Campaign not found: ${campaignId}` };
    }
    return { campaign, created: false };
  }

  // Check for active campaign
  const state = await memory.getState();
  if (state.activeCampaign) {
    const campaign = await memory.getCampaign(state.activeCampaign);
    if (campaign) {
      return { campaign, created: false };
    }
  }

  // Need a product to auto-create
  const targetProductId = productId || state.activeProduct;
  if (!targetProductId) {
    return { error: 'No campaign specified and no active product. Create a campaign first or set an active product.' };
  }

  // Check if product exists
  const product = await memory.getProduct(targetProductId);
  if (!product) {
    return { error: `Product not found: ${targetProductId}` };
  }

  // Check for existing campaigns for this product
  const existingCampaigns = await memory.listCampaigns(targetProductId);
  if (existingCampaigns.length > 0) {
    // Use the most recent active one, or the most recent overall
    const activeCampaign = existingCampaigns.find(c => c.status === 'active');
    if (activeCampaign) {
      return { campaign: activeCampaign, created: false };
    }
    // Use most recently updated
    const sorted = existingCampaigns.sort((a, b) => b.updatedAt - a.updatedAt);
    return { campaign: sorted[0], created: false };
  }

  // Auto-create default campaign
  const newCampaign: Campaign = {
    id: generateId(),
    productId: targetProductId,
    name: `${product.name} — General`,
    status: 'active',
    channels: [],
    posts: [],
    notes: 'Auto-created default campaign',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await memory.saveCampaign(newCampaign);

  // Set as active
  state.activeCampaign = newCampaign.id;
  await memory.saveState(state);

  return { campaign: newCampaign, created: true };
}

// ========== Tools ==========

const createCampaign: Tool = {
  name: 'create_campaign',
  description: 'Create a new marketing campaign for a product. Campaigns help organize posts, track metrics, and manage multi-channel launches.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Campaign name (e.g., "Product Hunt Launch", "Summer Sale")' },
      productId: { type: 'string', description: 'Product ID this campaign is for' },
      channels: { 
        type: 'array', 
        items: { type: 'string' },
        description: 'Target channels (e.g., ["twitter", "linkedin", "producthunt"])'
      },
      startDate: { type: 'string', description: 'Campaign start date (ISO 8601, optional)' },
      endDate: { type: 'string', description: 'Campaign end date (ISO 8601, optional)' },
      notes: { type: 'string', description: 'Campaign notes or goals (optional)' },
    },
    required: ['name', 'productId'],
  },
  execute: async (params: {
    name: string;
    productId: string;
    channels?: string[];
    startDate?: string;
    endDate?: string;
    notes?: string;
  }): Promise<ToolResult> => {
    // Verify product exists
    const product = await memory.getProduct(params.productId);
    if (!product) {
      return {
        success: false,
        message: `Product not found: ${params.productId}`,
      };
    }

    const campaign: Campaign = {
      id: generateId(),
      productId: params.productId,
      name: params.name,
      status: 'draft',
      channels: params.channels || [],
      startDate: params.startDate ? new Date(params.startDate).getTime() : undefined,
      endDate: params.endDate ? new Date(params.endDate).getTime() : undefined,
      posts: [],
      notes: params.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await memory.saveCampaign(campaign);

    return {
      success: true,
      message: `Campaign "${params.name}" created for ${product.name}`,
      data: {
        id: campaign.id,
        name: campaign.name,
        productId: campaign.productId,
        productName: product.name,
        status: campaign.status,
        channels: campaign.channels,
      },
    };
  },
};

const listCampaigns: Tool = {
  name: 'list_campaigns',
  description: 'List all campaigns, optionally filtered by product. Shows campaign status, channels, and post counts.',
  parameters: {
    type: 'object',
    properties: {
      productId: { type: 'string', description: 'Filter by product ID (optional)' },
      status: { 
        type: 'string', 
        enum: ['draft', 'active', 'paused', 'completed'],
        description: 'Filter by status (optional)'
      },
    },
  },
  execute: async (params: {
    productId?: string;
    status?: 'draft' | 'active' | 'paused' | 'completed';
  }): Promise<ToolResult> => {
    let campaigns = await memory.listCampaigns(params.productId);

    if (params.status) {
      campaigns = campaigns.filter(c => c.status === params.status);
    }

    if (campaigns.length === 0) {
      return {
        success: true,
        message: 'No campaigns found',
        data: { campaigns: [] },
      };
    }

    const campaignList = await Promise.all(campaigns.map(async c => {
      const product = await memory.getProduct(c.productId);
      return {
        id: c.id,
        name: c.name,
        productId: c.productId,
        productName: product?.name || 'Unknown',
        status: c.status,
        channels: c.channels,
        postCount: c.posts.length,
        publishedPosts: c.posts.filter(p => p.status === 'published').length,
        scheduledPosts: c.posts.filter(p => p.status === 'scheduled').length,
        startDate: c.startDate ? new Date(c.startDate).toISOString() : null,
        endDate: c.endDate ? new Date(c.endDate).toISOString() : null,
      };
    }));

    return {
      success: true,
      message: `Found ${campaigns.length} campaign(s)`,
      data: { campaigns: campaignList },
    };
  },
};

const getCampaign: Tool = {
  name: 'get_campaign',
  description: 'Get detailed information about a specific campaign including all posts and metrics.',
  parameters: {
    type: 'object',
    properties: {
      campaignId: { type: 'string', description: 'Campaign ID' },
    },
    required: ['campaignId'],
  },
  execute: async (params: { campaignId: string }): Promise<ToolResult> => {
    const campaign = await memory.getCampaign(params.campaignId);
    
    if (!campaign) {
      return {
        success: false,
        message: `Campaign not found: ${params.campaignId}`,
      };
    }

    const product = await memory.getProduct(campaign.productId);

    return {
      success: true,
      message: `Campaign: ${campaign.name}`,
      data: {
        id: campaign.id,
        name: campaign.name,
        productId: campaign.productId,
        productName: product?.name || 'Unknown',
        status: campaign.status,
        channels: campaign.channels,
        startDate: campaign.startDate ? new Date(campaign.startDate).toISOString() : null,
        endDate: campaign.endDate ? new Date(campaign.endDate).toISOString() : null,
        notes: campaign.notes,
        posts: campaign.posts.map(p => ({
          id: p.id,
          channel: p.channel,
          content: p.content.slice(0, 100) + (p.content.length > 100 ? '...' : ''),
          status: p.status,
          scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).toISOString() : null,
          publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
          metrics: p.metrics,
        })),
        metrics: campaign.metrics,
        createdAt: new Date(campaign.createdAt).toISOString(),
        updatedAt: new Date(campaign.updatedAt).toISOString(),
      },
    };
  },
};

const updateCampaign: Tool = {
  name: 'update_campaign',
  description: 'Update campaign details like name, status, channels, dates, or notes.',
  parameters: {
    type: 'object',
    properties: {
      campaignId: { type: 'string', description: 'Campaign ID' },
      name: { type: 'string', description: 'New campaign name (optional)' },
      status: { 
        type: 'string', 
        enum: ['draft', 'active', 'paused', 'completed'],
        description: 'Campaign status'
      },
      channels: { 
        type: 'array', 
        items: { type: 'string' },
        description: 'Target channels'
      },
      startDate: { type: 'string', description: 'Campaign start date (ISO 8601)' },
      endDate: { type: 'string', description: 'Campaign end date (ISO 8601)' },
      notes: { type: 'string', description: 'Campaign notes' },
    },
    required: ['campaignId'],
  },
  execute: async (params: {
    campaignId: string;
    name?: string;
    status?: 'draft' | 'active' | 'paused' | 'completed';
    channels?: string[];
    startDate?: string;
    endDate?: string;
    notes?: string;
  }): Promise<ToolResult> => {
    const campaign = await memory.getCampaign(params.campaignId);
    
    if (!campaign) {
      return {
        success: false,
        message: `Campaign not found: ${params.campaignId}`,
      };
    }

    // Apply updates
    if (params.name) campaign.name = params.name;
    if (params.status) campaign.status = params.status;
    if (params.channels) campaign.channels = params.channels;
    if (params.startDate) campaign.startDate = new Date(params.startDate).getTime();
    if (params.endDate) campaign.endDate = new Date(params.endDate).getTime();
    if (params.notes !== undefined) campaign.notes = params.notes;
    
    campaign.updatedAt = Date.now();

    await memory.saveCampaign(campaign);

    return {
      success: true,
      message: `Campaign "${campaign.name}" updated`,
      data: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        channels: campaign.channels,
      },
    };
  },
};

const deleteCampaign: Tool = {
  name: 'delete_campaign',
  description: 'Delete a campaign. This cannot be undone.',
  parameters: {
    type: 'object',
    properties: {
      campaignId: { type: 'string', description: 'Campaign ID to delete' },
      confirm: { type: 'boolean', description: 'Must be true to confirm deletion' },
    },
    required: ['campaignId', 'confirm'],
  },
  execute: async (params: { campaignId: string; confirm: boolean }): Promise<ToolResult> => {
    if (!params.confirm) {
      return {
        success: false,
        message: 'Deletion not confirmed. Set confirm=true to delete.',
      };
    }

    const campaign = await memory.getCampaign(params.campaignId);
    
    if (!campaign) {
      return {
        success: false,
        message: `Campaign not found: ${params.campaignId}`,
      };
    }

    // Delete the campaign file
    const fs = await import('fs/promises');
    const path = await import('path');
    const { homedir } = await import('os');
    
    const campaignPath = path.join(homedir(), '.marketclaw', 'workspace', 'campaigns', `${params.campaignId}.json`);
    
    try {
      await fs.unlink(campaignPath);
    } catch (err) {
      return {
        success: false,
        message: `Failed to delete campaign file: ${err}`,
      };
    }

    return {
      success: true,
      message: `Campaign "${campaign.name}" deleted`,
    };
  },
};

const addCampaignPost: Tool = {
  name: 'add_campaign_post',
  description: 'Add a post/content piece to a campaign. If no campaign specified, uses active campaign or auto-creates one.',
  parameters: {
    type: 'object',
    properties: {
      campaignId: { type: 'string', description: 'Campaign ID (optional — uses active campaign or auto-creates)' },
      productId: { type: 'string', description: 'Product ID (used if auto-creating campaign)' },
      channel: { type: 'string', description: 'Target channel (e.g., "twitter", "linkedin")' },
      content: { type: 'string', description: 'Post content' },
      scheduledAt: { type: 'string', description: 'When to publish (ISO 8601, optional)' },
    },
    required: ['channel', 'content'],
  },
  execute: async (params: {
    campaignId?: string;
    productId?: string;
    channel: string;
    content: string;
    scheduledAt?: string;
  }): Promise<ToolResult> => {
    const result = await getOrCreateCampaign(params.campaignId, params.productId);
    
    if ('error' in result) {
      return {
        success: false,
        message: result.error,
      };
    }

    const { campaign, created } = result;

    const post: CampaignPost = {
      id: generatePostId(),
      channel: params.channel,
      content: params.content,
      status: params.scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: params.scheduledAt ? new Date(params.scheduledAt).getTime() : undefined,
    };

    campaign.posts.push(post);
    campaign.updatedAt = Date.now();

    // Add channel to campaign if not already there
    if (!campaign.channels.includes(params.channel)) {
      campaign.channels.push(params.channel);
    }

    await memory.saveCampaign(campaign);

    const message = created 
      ? `Auto-created campaign "${campaign.name}" and added post`
      : `Post added to campaign "${campaign.name}"`;

    return {
      success: true,
      message,
      data: {
        postId: post.id,
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignCreated: created,
        channel: post.channel,
        status: post.status,
        contentPreview: post.content.slice(0, 100),
        scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString() : null,
      },
    };
  },
};

const updateCampaignPost: Tool = {
  name: 'update_campaign_post',
  description: 'Update a post within a campaign (content, status, schedule).',
  parameters: {
    type: 'object',
    properties: {
      campaignId: { type: 'string', description: 'Campaign ID (optional — uses active campaign)' },
      postId: { type: 'string', description: 'Post ID' },
      content: { type: 'string', description: 'New content (optional)' },
      status: { 
        type: 'string', 
        enum: ['draft', 'scheduled', 'published', 'failed'],
        description: 'Post status'
      },
      scheduledAt: { type: 'string', description: 'New schedule time (ISO 8601)' },
    },
    required: ['postId'],
  },
  execute: async (params: {
    campaignId?: string;
    postId: string;
    content?: string;
    status?: 'draft' | 'scheduled' | 'published' | 'failed';
    scheduledAt?: string;
  }): Promise<ToolResult> => {
    // For updates, we need an existing campaign (don't auto-create)
    let campaign: Campaign | null = null;
    
    if (params.campaignId) {
      campaign = await memory.getCampaign(params.campaignId);
    } else {
      // Check active campaign
      const state = await memory.getState();
      if (state.activeCampaign) {
        campaign = await memory.getCampaign(state.activeCampaign);
      }
    }
    
    if (!campaign) {
      return {
        success: false,
        message: 'No campaign specified and no active campaign set.',
      };
    }

    const post = campaign.posts.find(p => p.id === params.postId);
    
    if (!post) {
      return {
        success: false,
        message: `Post not found: ${params.postId}`,
      };
    }

    // Apply updates
    if (params.content) post.content = params.content;
    if (params.status) {
      post.status = params.status;
      if (params.status === 'published') {
        post.publishedAt = Date.now();
      }
    }
    if (params.scheduledAt) {
      post.scheduledAt = new Date(params.scheduledAt).getTime();
      if (post.status === 'draft') {
        post.status = 'scheduled';
      }
    }

    campaign.updatedAt = Date.now();
    await memory.saveCampaign(campaign);

    return {
      success: true,
      message: `Post updated`,
      data: {
        postId: post.id,
        channel: post.channel,
        status: post.status,
        contentPreview: post.content.slice(0, 100),
      },
    };
  },
};

const setActiveCampaign: Tool = {
  name: 'set_active_campaign',
  description: 'Set the active campaign context. Subsequent operations will default to this campaign.',
  parameters: {
    type: 'object',
    properties: {
      campaignId: { type: 'string', description: 'Campaign ID to set as active (or null to clear)' },
    },
    required: ['campaignId'],
  },
  execute: async (params: { campaignId: string | null }): Promise<ToolResult> => {
    const state = await memory.getState();

    if (params.campaignId) {
      const campaign = await memory.getCampaign(params.campaignId);
      
      if (!campaign) {
        return {
          success: false,
          message: `Campaign not found: ${params.campaignId}`,
        };
      }

      state.activeCampaign = params.campaignId;
      await memory.saveState(state);

      return {
        success: true,
        message: `Active campaign set to "${campaign.name}"`,
        data: {
          campaignId: campaign.id,
          campaignName: campaign.name,
        },
      };
    } else {
      state.activeCampaign = undefined;
      await memory.saveState(state);

      return {
        success: true,
        message: 'Active campaign cleared',
      };
    }
  },
};

const getCampaignMetrics: Tool = {
  name: 'get_campaign_metrics',
  description: 'Get aggregated metrics for a campaign across all posts and channels.',
  parameters: {
    type: 'object',
    properties: {
      campaignId: { type: 'string', description: 'Campaign ID' },
    },
    required: ['campaignId'],
  },
  execute: async (params: { campaignId: string }): Promise<ToolResult> => {
    const campaign = await memory.getCampaign(params.campaignId);
    
    if (!campaign) {
      return {
        success: false,
        message: `Campaign not found: ${params.campaignId}`,
      };
    }

    // Aggregate metrics from posts
    const totals = {
      impressions: 0,
      clicks: 0,
      likes: 0,
      shares: 0,
      comments: 0,
    };

    const byChannel: Record<string, typeof totals> = {};

    for (const post of campaign.posts) {
      if (post.metrics) {
        totals.impressions += post.metrics.impressions || 0;
        totals.clicks += post.metrics.clicks || 0;
        totals.likes += post.metrics.likes || 0;
        totals.shares += post.metrics.shares || 0;
        totals.comments += post.metrics.comments || 0;

        if (!byChannel[post.channel]) {
          byChannel[post.channel] = { impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0 };
        }
        byChannel[post.channel].impressions += post.metrics.impressions || 0;
        byChannel[post.channel].clicks += post.metrics.clicks || 0;
        byChannel[post.channel].likes += post.metrics.likes || 0;
        byChannel[post.channel].shares += post.metrics.shares || 0;
        byChannel[post.channel].comments += post.metrics.comments || 0;
      }
    }

    const postStats = {
      total: campaign.posts.length,
      draft: campaign.posts.filter(p => p.status === 'draft').length,
      scheduled: campaign.posts.filter(p => p.status === 'scheduled').length,
      published: campaign.posts.filter(p => p.status === 'published').length,
      failed: campaign.posts.filter(p => p.status === 'failed').length,
    };

    // Get cost data for this campaign
    let costData = null;
    try {
      const costSummary = await costTracker.summarize({ campaignId: params.campaignId });
      if (costSummary.totalUsd > 0) {
        costData = {
          totalUsd: costSummary.totalUsd,
          count: costSummary.count,
          byTool: costSummary.byTool,
          byProvider: costSummary.byProvider,
        };
      }
    } catch {
      // Cost tracking may not be initialized
    }

    return {
      success: true,
      message: `Metrics for "${campaign.name}"`,
      data: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        posts: postStats,
        totals,
        byChannel,
        engagementRate: totals.impressions > 0 
          ? ((totals.likes + totals.shares + totals.comments) / totals.impressions * 100).toFixed(2) + '%'
          : 'N/A',
        costs: costData,
      },
    };
  },
};

const getCampaignCosts: Tool = {
  name: 'get_campaign_costs',
  description: 'Get detailed cost breakdown for a campaign (API calls, image generation, emails, etc.).',
  parameters: {
    type: 'object',
    properties: {
      campaignId: { type: 'string', description: 'Campaign ID' },
      from: { type: 'string', description: 'Start date (ISO 8601 or "today", "this-week", "this-month")' },
      to: { type: 'string', description: 'End date (ISO 8601)' },
    },
    required: ['campaignId'],
  },
  execute: async (params: { 
    campaignId: string;
    from?: string;
    to?: string;
  }): Promise<ToolResult> => {
    const campaign = await memory.getCampaign(params.campaignId);
    
    if (!campaign) {
      return {
        success: false,
        message: `Campaign not found: ${params.campaignId}`,
      };
    }

    try {
      const summary = await costTracker.summarize({
        campaignId: params.campaignId,
        from: params.from,
        to: params.to,
      });

      if (summary.count === 0) {
        return {
          success: true,
          message: `No costs recorded for campaign "${campaign.name}"`,
          data: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            totalUsd: 0,
            count: 0,
          },
        };
      }

      return {
        success: true,
        message: `Costs for "${campaign.name}": $${summary.totalUsd.toFixed(4)}`,
        data: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          totalUsd: summary.totalUsd,
          count: summary.count,
          byTool: summary.byTool,
          byProvider: summary.byProvider,
          period: {
            from: summary.from,
            to: summary.to,
          },
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to get costs: ${err}`,
      };
    }
  },
};

// ========== Export ==========

export const campaignTools: Tool[] = [
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  addCampaignPost,
  updateCampaignPost,
  setActiveCampaign,
  getCampaignMetrics,
  getCampaignCosts,
];
