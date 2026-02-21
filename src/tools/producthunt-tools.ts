/**
 * Product Hunt Tools
 * Search, research, and prepare launches via Product Hunt API
 */

import { Tool, ToolResult } from './types.js';

// Product Hunt GraphQL API
const PH_API = 'https://api.producthunt.com/v2/api/graphql';

// Get token from env
function getToken(): string | null {
  return process.env.PRODUCTHUNT_DEV_TOKEN || process.env.PH_TOKEN || null;
}

// Execute GraphQL query
async function phQuery(query: string, variables?: Record<string, any>): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = getToken();
  if (!token) {
    return { success: false, error: 'Product Hunt token not configured. Set PRODUCTHUNT_DEV_TOKEN env var.' };
  }

  try {
    const response = await fetch(PH_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const result = await response.json() as { data?: any; errors?: any[] };
    
    if (result.errors) {
      return { success: false, error: result.errors[0]?.message || 'GraphQL error' };
    }

    return { success: true, data: result.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============ Search Products ============
export const searchProductsTool: Tool = {
  name: 'search_producthunt',
  description: 'Search for products on Product Hunt. Great for competitor research and market analysis.',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'Search query' 
      },
      count: { 
        type: 'number', 
        description: 'Number of results (default: 10, max: 20)' 
      },
    },
    required: ['query'],
  },

  async execute(params): Promise<ToolResult> {
    const count = Math.min(params.count || 10, 20);
    
    const query = `
      query SearchPosts($query: String!, $first: Int!) {
        posts(search: $query, first: $first) {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              commentsCount
              createdAt
              topics(first: 3) {
                edges {
                  node {
                    name
                  }
                }
              }
              makers {
                name
                username
              }
            }
          }
        }
      }
    `;

    const result = await phQuery(query, { query: params.query, first: count });
    
    if (!result.success) {
      return { success: false, message: result.error || 'Search failed' };
    }

    const posts = result.data?.posts?.edges?.map((e: any) => ({
      name: e.node.name,
      tagline: e.node.tagline,
      url: e.node.url,
      votes: e.node.votesCount,
      comments: e.node.commentsCount,
      topics: e.node.topics?.edges?.map((t: any) => t.node.name) || [],
      makers: e.node.makers?.map((m: any) => m.username) || [],
      launchDate: e.node.createdAt,
    })) || [];

    return {
      success: true,
      message: `Found ${posts.length} products for "${params.query}"`,
      data: posts,
    };
  },
};

// ============ Get Trending Products ============
export const getTrendingProductsTool: Tool = {
  name: 'get_trending_producthunt',
  description: 'Get trending/top products on Product Hunt today or this week',
  parameters: {
    type: 'object',
    properties: {
      period: { 
        type: 'string', 
        enum: ['daily', 'weekly', 'monthly'],
        description: 'Time period (default: daily)' 
      },
      count: { 
        type: 'number', 
        description: 'Number of products (default: 10)' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const count = Math.min(params.count || 10, 20);
    const period = params.period || 'daily';
    
    // Get posts sorted by votes
    const query = `
      query TrendingPosts($first: Int!, $postedAfter: DateTime) {
        posts(first: $first, postedAfter: $postedAfter, order: VOTES) {
          edges {
            node {
              id
              name
              tagline
              url
              votesCount
              commentsCount
              createdAt
              topics(first: 3) {
                edges {
                  node {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    // Calculate date based on period
    const now = new Date();
    let postedAfter: string;
    if (period === 'weekly') {
      postedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === 'monthly') {
      postedAfter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      postedAfter = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    }

    const result = await phQuery(query, { first: count, postedAfter });
    
    if (!result.success) {
      return { success: false, message: result.error || 'Failed to get trending' };
    }

    const posts = result.data?.posts?.edges?.map((e: any) => ({
      name: e.node.name,
      tagline: e.node.tagline,
      url: e.node.url,
      votes: e.node.votesCount,
      comments: e.node.commentsCount,
      topics: e.node.topics?.edges?.map((t: any) => t.node.name) || [],
    })) || [];

    return {
      success: true,
      message: `Top ${posts.length} products (${period})`,
      data: posts,
    };
  },
};

// ============ Get Product Details ============
export const getProductDetailsTool: Tool = {
  name: 'get_producthunt_product',
  description: 'Get detailed information about a specific Product Hunt product',
  parameters: {
    type: 'object',
    properties: {
      slug: { 
        type: 'string', 
        description: 'Product slug (from URL, e.g., "notion" from producthunt.com/posts/notion)' 
      },
    },
    required: ['slug'],
  },

  async execute(params): Promise<ToolResult> {
    const query = `
      query GetPost($slug: String!) {
        post(slug: $slug) {
          id
          name
          tagline
          description
          url
          website
          votesCount
          commentsCount
          reviewsCount
          reviewsRating
          createdAt
          featuredAt
          topics(first: 5) {
            edges {
              node {
                name
                slug
              }
            }
          }
          makers {
            name
            username
            headline
          }
          media {
            url
            type
          }
        }
      }
    `;

    const result = await phQuery(query, { slug: params.slug });
    
    if (!result.success) {
      return { success: false, message: result.error || 'Failed to get product' };
    }

    const post = result.data?.post;
    if (!post) {
      return { success: false, message: `Product not found: ${params.slug}` };
    }

    return {
      success: true,
      message: `Product: ${post.name}`,
      data: {
        name: post.name,
        tagline: post.tagline,
        description: post.description,
        url: post.url,
        website: post.website,
        votes: post.votesCount,
        comments: post.commentsCount,
        reviews: post.reviewsCount,
        rating: post.reviewsRating,
        launchDate: post.createdAt,
        featured: !!post.featuredAt,
        topics: post.topics?.edges?.map((t: any) => t.node.name) || [],
        makers: post.makers || [],
        media: post.media?.slice(0, 3) || [],
      },
    };
  },
};

// ============ Get Topics ============
export const getTopicsTool: Tool = {
  name: 'get_producthunt_topics',
  description: 'Get Product Hunt topics/categories. Useful for planning launch strategy.',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'Search for specific topic (optional)' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const query = `
      query GetTopics($query: String, $first: Int!) {
        topics(search: $query, first: $first) {
          edges {
            node {
              id
              name
              slug
              description
              postsCount
              followersCount
            }
          }
        }
      }
    `;

    const result = await phQuery(query, { query: params.query || '', first: 20 });
    
    if (!result.success) {
      return { success: false, message: result.error || 'Failed to get topics' };
    }

    const topics = result.data?.topics?.edges?.map((e: any) => ({
      name: e.node.name,
      slug: e.node.slug,
      description: e.node.description,
      posts: e.node.postsCount,
      followers: e.node.followersCount,
    })) || [];

    return {
      success: true,
      message: `Found ${topics.length} topics`,
      data: topics,
    };
  },
};

// ============ Draft Launch ============
export const draftLaunchTool: Tool = {
  name: 'draft_producthunt_launch',
  description: 'Create a draft Product Hunt launch plan with all the key elements',
  parameters: {
    type: 'object',
    properties: {
      productName: { 
        type: 'string', 
        description: 'Product name' 
      },
      productId: { 
        type: 'string', 
        description: 'Product ID from memory (for context)' 
      },
      targetDate: { 
        type: 'string', 
        description: 'Target launch date (e.g., "next Tuesday")' 
      },
    },
    required: ['productName'],
  },

  async execute(params): Promise<ToolResult> {
    return {
      success: true,
      message: 'Draft launch plan template:',
      data: {
        product: params.productName,
        targetDate: params.targetDate || 'TBD',
        checklist: [
          '**Pre-launch (1-2 weeks before)**',
          '- [ ] Finalize tagline (max 60 chars, benefit-focused)',
          '- [ ] Write description (problem → solution → benefits)',
          '- [ ] Create thumbnail (240x240 GIF or PNG)',
          '- [ ] Record demo video or GIF',
          '- [ ] Prepare 4-6 gallery images',
          '- [ ] Choose 3-5 relevant topics',
          '- [ ] Line up hunter (optional but helps)',
          '- [ ] Prepare maker comment (first comment strategy)',
          '',
          '**Launch day**',
          '- [ ] Launch at 12:01 AM PT (best visibility)',
          '- [ ] Post maker comment immediately',
          '- [ ] Share on Twitter, LinkedIn, communities',
          '- [ ] Respond to ALL comments quickly',
          '- [ ] Update with launch day offer if applicable',
          '',
          '**Post-launch**',
          '- [ ] Thank supporters',
          '- [ ] Share results on social',
          '- [ ] Follow up with interested users',
        ],
        tips: [
          'Tuesday-Thursday launches typically perform best',
          'Avoid major holidays and competing launches',
          'Engage authentically - PH community values genuine interaction',
          'A hunter with followers helps but isn\'t required',
        ],
      },
    };
  },
};

// ============ Check Auth ============
export const checkProductHuntAuthTool: Tool = {
  name: 'check_producthunt_auth',
  description: 'Check if Product Hunt API is configured',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const token = getToken();
    
    if (!token) {
      return {
        success: false,
        message: 'Product Hunt token not configured. Get one at: https://www.producthunt.com/v2/oauth/applications',
        data: { authenticated: false },
      };
    }

    // Test with a simple query
    const result = await phQuery(`query { viewer { id name username } }`);
    
    if (!result.success) {
      return {
        success: false,
        message: `Token invalid or expired: ${result.error}`,
        data: { authenticated: false },
      };
    }

    const viewer = result.data?.viewer;
    return {
      success: true,
      message: `✅ Product Hunt authenticated as @${viewer?.username || 'unknown'}`,
      data: { 
        authenticated: true,
        username: viewer?.username,
        name: viewer?.name,
      },
    };
  },
};

// ============ Export All ============
export const productHuntTools: Tool[] = [
  searchProductsTool,
  getTrendingProductsTool,
  getProductDetailsTool,
  getTopicsTool,
  draftLaunchTool,
  checkProductHuntAuthTool,
];
