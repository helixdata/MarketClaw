/**
 * Browser Automation Tools
 * 
 * Tools for posting to social media via the browser extension.
 */

import { Tool, ToolResult } from '../tools/types.js';
import { extensionBridge } from './extension-bridge.js';

// ============ Browser Post ============
export const browserPostTool: Tool = {
  name: 'browser_post',
  description: 'Post content to social media via browser automation. Uses the MarketClaw browser extension to post as if you were manually posting. Supports Twitter/X, LinkedIn, Reddit, Instagram, Hacker News, and Product Hunt.',
  parameters: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['twitter', 'linkedin', 'reddit', 'instagram', 'hackernews', 'producthunt', 'facebook', 'threads', 'bluesky', 'youtube'],
        description: 'Platform to post to',
      },
      content: {
        type: 'string',
        description: 'Content to post',
      },
      action: {
        type: 'string',
        enum: ['post', 'comment', 'submit', 'upvote', 'dm', 'reply'],
        description: 'Action type (default: post). Reddit/HN/PH support comment, HN supports submit, PH supports upvote.',
      },
      title: {
        type: 'string',
        description: 'Title for Reddit posts or HN submissions',
      },
      subreddit: {
        type: 'string',
        description: 'Subreddit name for Reddit posts (without r/)',
      },
      url: {
        type: 'string',
        description: 'URL for HN link submissions',
      },
      username: {
        type: 'string',
        description: 'Username for Instagram DMs',
      },
      profile: {
        type: 'string',
        description: 'Target a specific browser profile (e.g., "Work", "Personal")',
      },
    },
    required: ['platform', 'content'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return {
        success: false,
        message: 'Browser extension not connected. Make sure the MarketClaw extension is installed and the browser is open.',
      };
    }

    const { platform, content, action, title, subreddit, url, username, profile } = params;

    // Validate content length for Twitter
    if (platform === 'twitter' && content.length > 280) {
      return {
        success: false,
        message: `Tweet too long: ${content.length}/280 characters`,
      };
    }

    // LinkedIn image posts are not supported via browser - use API instead
    if (platform === 'linkedin' && params.mediaUrls?.length > 0) {
      return {
        success: false,
        message: `❌ LinkedIn image posts are not supported via browser automation (file picker limitation).

✅ **Use the LinkedIn API instead:**
The \`post_to_linkedin\` tool supports images via the API.

Example:
\`post_to_linkedin(text="...", imagePath="/path/to/image.png")\`

This requires a LinkedIn App to be configured. See docs/PROVIDERS.md for setup.`,
      };
    }

    // Build the command with platform-specific options
    const command: any = {
      action: 'post',
      platform,
      content,
    };

    // Add optional params
    if (action) command.action = action;
    if (title) command.title = title;
    if (subreddit) command.subreddit = subreddit;
    if (url) command.url = url;
    if (username) command.username = username;

    const result = await extensionBridge.sendCommand(command, profile);

    if (result.success) {
      return {
        success: true,
        message: `Posted to ${platform} successfully`,
        data: result.result || result.data,
      };
    } else {
      return {
        success: false,
        message: `Failed to post to ${platform}: ${result.error}`,
      };
    }
  },
};

// ============ Browser Status ============
export const browserStatusTool: Tool = {
  name: 'browser_status',
  description: 'Check if the browser extension is connected and ready for automation. Shows connected profiles.',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const status = extensionBridge.getStatus();

    if (status.connected) {
      const profileList = status.profiles.length > 0 
        ? status.profiles.join(', ') 
        : 'Default';
      return {
        success: true,
        message: `Browser extension connected. Profiles: ${profileList}. Clients: ${status.clients}`,
        data: status,
      };
    } else {
      return {
        success: false,
        message: 'Browser extension not connected. Install the extension and open Chrome.',
        data: status,
      };
    }
  },
};

// ============ Browser Navigate ============
export const browserNavigateTool: Tool = {
  name: 'browser_navigate',
  description: 'Open a URL in the browser via the extension.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to open',
      },
    },
    required: ['url'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return {
        success: false,
        message: 'Browser extension not connected.',
      };
    }

    const result = await extensionBridge.navigate(params.url);

    return {
      success: result.success,
      message: result.success ? `Opened ${params.url}` : `Failed: ${result.error}`,
      data: result.data,
    };
  },
};

// ============ Browser Click ============
export const browserClickTool: Tool = {
  name: 'browser_click',
  description: 'Click an element in the browser by CSS selector.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the element to click (e.g., "#submit", "[data-testid=\\"btn\\"]")',
      },
      tabId: {
        type: 'number',
        description: 'Target tab ID (optional, defaults to active tab)',
      },
    },
    required: ['selector'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    const result = await extensionBridge.sendCommand({
      action: 'click',
      selector: params.selector,
      tabId: params.tabId,
    });
    return {
      success: result.success,
      message: result.success ? `Clicked ${params.selector}` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Browser Type ============
export const browserTypeTool: Tool = {
  name: 'browser_type',
  description: 'Type text into an element in the browser.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the input element',
      },
      text: {
        type: 'string',
        description: 'Text to type',
      },
      clear: {
        type: 'boolean',
        description: 'Clear existing content first (default: true)',
      },
      tabId: {
        type: 'number',
        description: 'Target tab ID (optional)',
      },
    },
    required: ['selector', 'text'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    const result = await extensionBridge.sendCommand({
      action: 'type',
      selector: params.selector,
      text: params.text,
      tabId: params.tabId,
      options: { clear: params.clear ?? true },
    });
    return {
      success: result.success,
      message: result.success ? `Typed "${params.text.substring(0, 20)}..." into ${params.selector}` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Browser Find ============
export const browserFindTool: Tool = {
  name: 'browser_find',
  description: 'Find elements matching a CSS selector in the browser.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector to search for',
      },
      limit: {
        type: 'number',
        description: 'Max elements to return (default: 10)',
      },
      tabId: {
        type: 'number',
        description: 'Target tab ID (optional)',
      },
    },
    required: ['selector'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    const result = await extensionBridge.sendCommand({
      action: 'find',
      selector: params.selector,
      tabId: params.tabId,
      options: { limit: params.limit ?? 10 },
    });
    return {
      success: result.success,
      message: result.success ? `Found ${result.result?.count || 0} elements` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Browser Wait ============
export const browserWaitTool: Tool = {
  name: 'browser_wait',
  description: 'Wait for an element to appear in the browser.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector to wait for',
      },
      timeout: {
        type: 'number',
        description: 'Max wait time in ms (default: 10000)',
      },
      tabId: {
        type: 'number',
        description: 'Target tab ID (optional)',
      },
    },
    required: ['selector'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    const result = await extensionBridge.sendCommand({
      action: 'wait',
      selector: params.selector,
      tabId: params.tabId,
      timeout: params.timeout ?? 10000,
    });
    return {
      success: result.success,
      message: result.success ? `Element ${params.selector} found` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Browser Page Info ============
export const browserPageInfoTool: Tool = {
  name: 'browser_page_info',
  description: 'Get information about the current page (URL, title, dimensions).',
  parameters: {
    type: 'object',
    properties: {
      tabId: {
        type: 'number',
        description: 'Target tab ID (optional)',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    const result = await extensionBridge.sendCommand({
      action: 'pageInfo',
      tabId: params.tabId,
    });
    return {
      success: result.success,
      message: result.success ? `Page: ${result.result?.title}` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Browser Scroll ============
export const browserScrollTool: Tool = {
  name: 'browser_scroll',
  description: 'Scroll the page in the browser.',
  parameters: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        enum: ['up', 'down', 'top', 'bottom'],
        description: 'Scroll direction',
      },
      amount: {
        type: 'number',
        description: 'Pixels to scroll (for up/down)',
      },
      tabId: {
        type: 'number',
        description: 'Target tab ID (optional)',
      },
    },
    required: ['direction'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    const result = await extensionBridge.sendCommand({
      action: 'scroll',
      tabId: params.tabId,
      options: {
        direction: params.direction,
        amount: params.amount ?? 300,
      },
    });
    return {
      success: result.success,
      message: result.success ? `Scrolled ${params.direction}` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Browser Get Text ============
export const browserGetTextTool: Tool = {
  name: 'browser_get_text',
  description: 'Get the text content of an element.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the element',
      },
      tabId: {
        type: 'number',
        description: 'Target tab ID (optional)',
      },
    },
    required: ['selector'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    const result = await extensionBridge.sendCommand({
      action: 'getText',
      selector: params.selector,
      tabId: params.tabId,
    });
    return {
      success: result.success,
      message: result.success ? `Text: "${result.result?.text?.substring(0, 50)}..."` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Reddit Post ============
export const redditPostTool: Tool = {
  name: 'reddit_post',
  description: 'Post to Reddit via browser automation. Can create posts or comments.',
  parameters: {
    type: 'object',
    properties: {
      subreddit: {
        type: 'string',
        description: 'Subreddit to post to (without r/)',
      },
      title: {
        type: 'string',
        description: 'Post title (required for new posts)',
      },
      content: {
        type: 'string',
        description: 'Post body or comment text',
      },
      action: {
        type: 'string',
        enum: ['post', 'comment'],
        description: 'Action type (default: post)',
      },
    },
    required: ['content'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    const result = await extensionBridge.sendCommand({
      action: params.action || 'post',
      platform: 'reddit',
      content: params.content,
      subreddit: params.subreddit,
      title: params.title,
    });
    return {
      success: result.success,
      message: result.success ? `Posted to Reddit${params.subreddit ? ` (r/${params.subreddit})` : ''} successfully` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Hacker News Submit ============
export const hnSubmitTool: Tool = {
  name: 'hn_submit',
  description: 'Submit to Hacker News via browser automation. Can submit links, text posts, or comments.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Submission title (required for new posts)',
      },
      url: {
        type: 'string',
        description: 'URL for link submissions',
      },
      content: {
        type: 'string',
        description: 'Text content for text posts or comments',
      },
      action: {
        type: 'string',
        enum: ['submit', 'comment', 'upvote'],
        description: 'Action type (default: submit)',
      },
    },
    required: [],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    
    const action = params.action || 'submit';
    if (action === 'submit' && !params.title) {
      return { success: false, message: 'Title is required for HN submissions' };
    }
    
    const result = await extensionBridge.sendCommand({
      action,
      platform: 'hackernews',
      content: params.content || '',
      title: params.title,
      url: params.url,
    });
    return {
      success: result.success,
      message: result.success ? `HN ${action} successful` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Product Hunt Interact ============
export const phInteractTool: Tool = {
  name: 'ph_interact',
  description: 'Interact with Product Hunt via browser automation. Upvote products or post comments.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['upvote', 'comment', 'reply'],
        description: 'Action type',
      },
      content: {
        type: 'string',
        description: 'Comment text (for comment/reply actions)',
      },
    },
    required: ['action'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    
    if ((params.action === 'comment' || params.action === 'reply') && !params.content) {
      return { success: false, message: 'Content is required for comments' };
    }
    
    const result = await extensionBridge.sendCommand({
      action: params.action,
      platform: 'producthunt',
      content: params.content || '',
    });
    return {
      success: result.success,
      message: result.success ? `Product Hunt ${params.action} successful` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Instagram Interact ============
export const instagramInteractTool: Tool = {
  name: 'instagram_interact',
  description: 'Interact with Instagram via browser automation. Post comments or send DMs.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['comment', 'dm'],
        description: 'Action type',
      },
      content: {
        type: 'string',
        description: 'Comment or message text',
      },
      username: {
        type: 'string',
        description: 'Username for DMs',
      },
    },
    required: ['action', 'content'],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    
    if (params.action === 'dm' && !params.username) {
      return { success: false, message: 'Username is required for DMs' };
    }
    
    const result = await extensionBridge.sendCommand({
      action: params.action,
      platform: 'instagram',
      content: params.content,
      username: params.username,
    });
    return {
      success: result.success,
      message: result.success ? `Instagram ${params.action} successful` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Facebook Post ============
export const facebookPostTool: Tool = {
  name: 'facebook_post',
  description: 'Post to Facebook via browser automation. Create posts, comments, or likes.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['post', 'comment', 'like'],
        description: 'Action type (default: post)',
      },
      content: {
        type: 'string',
        description: 'Post or comment text',
      },
      profile: {
        type: 'string',
        description: 'Target browser profile',
      },
    },
    required: [],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    
    const action = params.action || 'post';
    if ((action === 'post' || action === 'comment') && !params.content) {
      return { success: false, message: 'Content is required for posts/comments' };
    }
    
    const result = await extensionBridge.sendCommand({
      action,
      platform: 'facebook',
      content: params.content || '',
    }, params.profile);
    return {
      success: result.success,
      message: result.success ? `Facebook ${action} successful` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Threads Post ============
export const threadsPostTool: Tool = {
  name: 'threads_post',
  description: 'Post to Threads via browser automation. Create threads, replies, or likes.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['post', 'reply', 'like'],
        description: 'Action type (default: post)',
      },
      content: {
        type: 'string',
        description: 'Thread or reply text',
      },
      profile: {
        type: 'string',
        description: 'Target browser profile',
      },
    },
    required: [],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    
    const action = params.action || 'post';
    if ((action === 'post' || action === 'reply') && !params.content) {
      return { success: false, message: 'Content is required for posts/replies' };
    }
    
    const result = await extensionBridge.sendCommand({
      action,
      platform: 'threads',
      content: params.content || '',
    }, params.profile);
    return {
      success: result.success,
      message: result.success ? `Threads ${action} successful` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Bluesky Post ============
export const blueskyPostTool: Tool = {
  name: 'bluesky_post',
  description: 'Post to Bluesky via browser automation. Create posts, replies, likes, or reposts.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['post', 'reply', 'like', 'repost'],
        description: 'Action type (default: post)',
      },
      content: {
        type: 'string',
        description: 'Post or reply text',
      },
      profile: {
        type: 'string',
        description: 'Target browser profile',
      },
    },
    required: [],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    
    const action = params.action || 'post';
    if ((action === 'post' || action === 'reply') && !params.content) {
      return { success: false, message: 'Content is required for posts/replies' };
    }
    
    const result = await extensionBridge.sendCommand({
      action,
      platform: 'bluesky',
      content: params.content || '',
    }, params.profile);
    return {
      success: result.success,
      message: result.success ? `Bluesky ${action} successful` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ YouTube Interact ============
export const youtubeInteractTool: Tool = {
  name: 'youtube_interact',
  description: 'Interact with YouTube via browser automation. Comment, reply, like, or subscribe.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['comment', 'reply', 'like', 'subscribe', 'info'],
        description: 'Action type (default: comment)',
      },
      content: {
        type: 'string',
        description: 'Comment or reply text',
      },
      profile: {
        type: 'string',
        description: 'Target browser profile',
      },
    },
    required: [],
  },

  async execute(params): Promise<ToolResult> {
    if (!extensionBridge.isConnected()) {
      return { success: false, message: 'Browser extension not connected.' };
    }
    
    const action = params.action || 'comment';
    if ((action === 'comment' || action === 'reply') && !params.content) {
      return { success: false, message: 'Content is required for comments/replies' };
    }
    
    const result = await extensionBridge.sendCommand({
      action,
      platform: 'youtube',
      content: params.content || '',
    }, params.profile);
    return {
      success: result.success,
      message: result.success ? `YouTube ${action} successful` : `Failed: ${result.error}`,
      data: result.result,
    };
  },
};

// ============ Export All ============
export const browserTools: Tool[] = [
  browserPostTool,
  browserStatusTool,
  browserNavigateTool,
  browserClickTool,
  browserTypeTool,
  browserFindTool,
  browserWaitTool,
  browserPageInfoTool,
  browserScrollTool,
  browserGetTextTool,
  // Platform-specific tools (Tier 1)
  redditPostTool,
  hnSubmitTool,
  phInteractTool,
  instagramInteractTool,
  // Platform-specific tools (Tier 2)
  facebookPostTool,
  threadsPostTool,
  blueskyPostTool,
  youtubeInteractTool,
];
