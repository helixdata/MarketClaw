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
  description: 'Post content to social media via browser automation. Uses the MarketClaw browser extension to post as if you were manually posting. Supports Twitter/X and LinkedIn.',
  parameters: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['twitter', 'linkedin'],
        description: 'Platform to post to',
      },
      content: {
        type: 'string',
        description: 'Content to post',
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

    const { platform, content } = params;

    // Validate content length
    if (platform === 'twitter' && content.length > 280) {
      return {
        success: false,
        message: `Tweet too long: ${content.length}/280 characters`,
      };
    }

    const result = await extensionBridge.post(platform, content);

    if (result.success) {
      return {
        success: true,
        message: `Posted to ${platform} successfully`,
        data: result.data,
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
  description: 'Check if the browser extension is connected and ready for automation.',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const status = extensionBridge.getStatus();

    if (status.connected) {
      return {
        success: true,
        message: `Browser extension connected. Capabilities: ${status.capabilities.join(', ') || 'all'}`,
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

// ============ Export All ============
export const browserTools: Tool[] = [
  browserPostTool,
  browserStatusTool,
  browserNavigateTool,
];
