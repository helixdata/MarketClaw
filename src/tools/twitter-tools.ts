/**
 * Twitter/X Tools
 * Post, search, read, and engage via bird CLI
 */

import { Tool, ToolResult } from './types.js';
import { execSync } from 'child_process';

// Execute bird command and return result
function execBird(args: string, options?: { json?: boolean }): { success: boolean; output: string; data?: any } {
  try {
    const jsonFlag = options?.json ? ' --json' : '';
    const cmd = `bird ${args}${jsonFlag}`;
    const output = execSync(cmd, { 
      encoding: 'utf-8',
      timeout: 30000,
    });
    
    if (options?.json) {
      try {
        return { success: true, output, data: JSON.parse(output) };
      } catch {
        return { success: true, output };
      }
    }
    return { success: true, output };
  } catch (err: any) {
    return { 
      success: false, 
      output: err.stderr || err.message || String(err) 
    };
  }
}

// ============ Post Tweet ============
export const postTweetTool: Tool = {
  name: 'post_tweet',
  description: 'Post a tweet to Twitter/X. Supports text and images. Use with caution - rate limits apply.',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'Tweet text (max 280 characters)' 
      },
      imagePath: { 
        type: 'string', 
        description: 'Path to image to attach (optional)' 
      },
      imageAlt: { 
        type: 'string', 
        description: 'Alt text for image (optional)' 
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, just preview without posting'
      },
    },
    required: ['text'],
  },

  async execute(params): Promise<ToolResult> {
    // Character count check
    if (params.text.length > 280) {
      return {
        success: false,
        message: `Tweet too long: ${params.text.length} characters (max 280)`,
        data: { characterCount: params.text.length },
      };
    }

    // Dry run
    if (params.dryRun) {
      return {
        success: true,
        message: 'Preview (not posted):',
        data: {
          text: params.text,
          characterCount: params.text.length,
          hasImage: !!params.imagePath,
        },
      };
    }

    // Build command (no --json for tweet command)
    let cmd = `tweet "${params.text.replace(/"/g, '\\"')}"`;
    if (params.imagePath) {
      cmd += ` --media "${params.imagePath}"`;
      if (params.imageAlt) {
        cmd += ` --alt "${params.imageAlt.replace(/"/g, '\\"')}"`;
      }
    }

    const result = execBird(cmd); // No JSON flag for posting
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to post tweet: ${result.output}`,
      };
    }

    return {
      success: true,
      message: '✅ Tweet posted!',
      data: { text: params.text, response: result.output },
    };
  },
};

// ============ Reply to Tweet ============
export const replyTweetTool: Tool = {
  name: 'reply_tweet',
  description: 'Reply to a tweet',
  parameters: {
    type: 'object',
    properties: {
      tweetUrl: { 
        type: 'string', 
        description: 'URL or ID of tweet to reply to' 
      },
      text: { 
        type: 'string', 
        description: 'Reply text' 
      },
    },
    required: ['tweetUrl', 'text'],
  },

  async execute(params): Promise<ToolResult> {
    if (params.text.length > 280) {
      return {
        success: false,
        message: `Reply too long: ${params.text.length} characters (max 280)`,
      };
    }

    const cmd = `reply "${params.tweetUrl}" "${params.text.replace(/"/g, '\\"')}"`;
    const result = execBird(cmd); // No JSON flag for posting
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to reply: ${result.output}`,
      };
    }

    return {
      success: true,
      message: '✅ Reply posted!',
      data: { text: params.text, response: result.output },
    };
  },
};

// ============ Search Tweets ============
export const searchTweetsTool: Tool = {
  name: 'search_tweets',
  description: 'Search for tweets on Twitter/X',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'Search query (supports Twitter search operators like from:, to:, etc.)' 
      },
      count: { 
        type: 'number', 
        description: 'Number of results (default: 10)' 
      },
    },
    required: ['query'],
  },

  async execute(params): Promise<ToolResult> {
    const count = params.count || 10;
    const cmd = `search "${params.query.replace(/"/g, '\\"')}" -n ${count}`;
    const result = execBird(cmd, { json: true });
    
    if (!result.success) {
      return {
        success: false,
        message: `Search failed: ${result.output}`,
      };
    }

    return {
      success: true,
      message: `Found tweets for "${params.query}"`,
      data: result.data,
    };
  },
};

// ============ Read Tweet ============
export const readTweetTool: Tool = {
  name: 'read_tweet',
  description: 'Read a specific tweet by URL or ID',
  parameters: {
    type: 'object',
    properties: {
      tweetUrl: { 
        type: 'string', 
        description: 'Tweet URL or ID' 
      },
    },
    required: ['tweetUrl'],
  },

  async execute(params): Promise<ToolResult> {
    const cmd = `read "${params.tweetUrl}"`;
    const result = execBird(cmd, { json: true });
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to read tweet: ${result.output}`,
      };
    }

    return {
      success: true,
      message: 'Tweet retrieved',
      data: result.data,
    };
  },
};

// ============ Get Mentions ============
export const getMentionsTool: Tool = {
  name: 'get_mentions',
  description: 'Get tweets mentioning you (notifications)',
  parameters: {
    type: 'object',
    properties: {
      count: { 
        type: 'number', 
        description: 'Number of mentions (default: 10)' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const count = params.count || 10;
    const cmd = `mentions -n ${count}`;
    const result = execBird(cmd, { json: true });
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to get mentions: ${result.output}`,
      };
    }

    return {
      success: true,
      message: 'Mentions retrieved',
      data: result.data,
    };
  },
};

// ============ Get Home Timeline ============
export const getHomeTimelineTool: Tool = {
  name: 'get_home_timeline',
  description: 'Get your Twitter home timeline',
  parameters: {
    type: 'object',
    properties: {
      following: { 
        type: 'boolean', 
        description: 'Use "Following" tab instead of "For You" (default: false)' 
      },
      count: { 
        type: 'number', 
        description: 'Number of tweets (default: 10)' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const count = params.count || 10;
    const following = params.following ? ' --following' : '';
    const cmd = `home${following} -n ${count}`;
    const result = execBird(cmd, { json: true });
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to get timeline: ${result.output}`,
      };
    }

    return {
      success: true,
      message: 'Home timeline retrieved',
      data: result.data,
    };
  },
};

// ============ Get User Tweets ============
export const getUserTweetsTool: Tool = {
  name: 'get_user_tweets',
  description: 'Get tweets from a specific user',
  parameters: {
    type: 'object',
    properties: {
      username: { 
        type: 'string', 
        description: 'Twitter username (with or without @)' 
      },
      count: { 
        type: 'number', 
        description: 'Number of tweets (default: 10)' 
      },
    },
    required: ['username'],
  },

  async execute(params): Promise<ToolResult> {
    const count = params.count || 10;
    const username = params.username.startsWith('@') ? params.username : `@${params.username}`;
    const cmd = `user-tweets ${username} -n ${count}`;
    const result = execBird(cmd, { json: true });
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to get user tweets: ${result.output}`,
      };
    }

    return {
      success: true,
      message: `Tweets from ${username}`,
      data: result.data,
    };
  },
};

// ============ Draft Tweet ============
export const draftTweetTool: Tool = {
  name: 'draft_tweet',
  description: 'Create a draft tweet with proper formatting. Does NOT post - just creates the draft for review.',
  parameters: {
    type: 'object',
    properties: {
      topic: { 
        type: 'string', 
        description: 'What the tweet should be about' 
      },
      style: { 
        type: 'string', 
        enum: ['announcement', 'insight', 'question', 'thread-starter', 'engagement'],
        description: 'Tweet style' 
      },
      productId: { 
        type: 'string', 
        description: 'Product to promote (uses active product if not specified)' 
      },
      includeHashtags: { 
        type: 'boolean', 
        description: 'Include hashtags (default: true, max 2-3)' 
      },
      includeCTA: { 
        type: 'boolean', 
        description: 'Include call-to-action (default: true)' 
      },
    },
    required: ['topic'],
  },

  async execute(params): Promise<ToolResult> {
    return {
      success: true,
      message: 'Draft parameters received. Generate tweet content based on:',
      data: {
        topic: params.topic,
        style: params.style || 'insight',
        guidelines: [
          'Max 280 characters',
          'Hook in first line',
          'Use line breaks for readability',
          params.includeHashtags !== false ? 'Include 1-3 relevant hashtags' : 'No hashtags',
          params.includeCTA !== false ? 'End with question or CTA for engagement' : 'No CTA needed',
          'Emojis: 1-2 max, strategic placement',
        ],
      },
    };
  },
};

// ============ Check Twitter Auth ============
export const checkTwitterAuthTool: Tool = {
  name: 'check_twitter_auth',
  description: 'Check Twitter authentication status',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const result = execBird('whoami');
    
    if (!result.success || result.output.includes('No Twitter cookies')) {
      return {
        success: false,
        message: 'Twitter not authenticated. Check browser cookies.',
        data: { authenticated: false },
      };
    }

    // Parse whoami output
    const handleMatch = result.output.match(/@(\w+)/);
    const nameMatch = result.output.match(/\(([^)]+)\)/);

    return {
      success: true,
      message: `✅ Twitter authenticated as @${handleMatch?.[1] || 'unknown'}`,
      data: {
        authenticated: true,
        handle: handleMatch?.[1],
        name: nameMatch?.[1],
      },
    };
  },
};

// ============ Export All ============
export const twitterTools: Tool[] = [
  postTweetTool,
  replyTweetTool,
  searchTweetsTool,
  readTweetTool,
  getMentionsTool,
  getHomeTimelineTool,
  getUserTweetsTool,
  draftTweetTool,
  checkTwitterAuthTool,
];
