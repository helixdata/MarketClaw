/**
 * LinkedIn Tools
 * Post to LinkedIn, check analytics, manage presence
 */

import { Tool, ToolResult } from './types.js';
import { execSync } from 'child_process';

// LinkedIn API base
const LINKEDIN_API = 'https://api.linkedin.com/v2';

// Get token from Keychain (LaunchCrew's stored token)
async function getLinkedInToken(): Promise<string | null> {
  try {
    // Try LaunchCrew's keychain entry first
    const token = execSync(
      'security find-generic-password -s "com.launchcrew.linkedin.FA38CDFD-C368-4CD0-8935-21031CE37C6A" -a "linkedin-credentials" -w 2>/dev/null',
      { encoding: 'utf-8' }
    ).trim();
    
    if (token) {
      // Parse JSON if stored as JSON
      try {
        const parsed = JSON.parse(token);
        return parsed.accessToken || parsed.access_token || token;
      } catch {
        return token;
      }
    }
  } catch {
    // Keychain entry not found
  }
  
  // Fallback to env var
  return process.env.LINKEDIN_ACCESS_TOKEN || null;
}

// LinkedIn user URN (from TOOLS.md)
const USER_URN = 'urn:li:person:vuzryA4D9-';

// Reserved for future typed post creation
interface _LinkedInPost {
  text: string;
  linkUrl?: string;
  linkTitle?: string;
  linkDescription?: string;
  imageUrl?: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}

// ============ Post to LinkedIn ============
export const postToLinkedInTool: Tool = {
  name: 'post_to_linkedin',
  description: 'Publish a post to LinkedIn. Supports text posts, link shares, and images.',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'Post content (supports mentions with @[Name](urn:li:person:xxx))' 
      },
      linkUrl: { 
        type: 'string', 
        description: 'URL to share (optional)' 
      },
      linkTitle: { 
        type: 'string', 
        description: 'Title for link preview (optional)' 
      },
      linkDescription: { 
        type: 'string', 
        description: 'Description for link preview (optional)' 
      },
      visibility: { 
        type: 'string', 
        enum: ['PUBLIC', 'CONNECTIONS'],
        description: 'Who can see the post (default: PUBLIC)' 
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, just preview without posting'
      },
    },
    required: ['text'],
  },

  async execute(params): Promise<ToolResult> {
    const token = await getLinkedInToken();
    if (!token) {
      return {
        success: false,
        message: 'LinkedIn access token not found. Set LINKEDIN_ACCESS_TOKEN or configure in Keychain.',
      };
    }

    // Dry run - just return preview
    if (params.dryRun) {
      return {
        success: true,
        message: 'Preview (not posted):',
        data: {
          text: params.text,
          linkUrl: params.linkUrl,
          visibility: params.visibility || 'PUBLIC',
          characterCount: params.text.length,
        },
      };
    }

    try {
      // Build UGC Post payload
      const payload: any = {
        author: USER_URN,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: params.text,
            },
            shareMediaCategory: params.linkUrl ? 'ARTICLE' : 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': params.visibility || 'PUBLIC',
        },
      };

      // Add link if provided
      if (params.linkUrl) {
        payload.specificContent['com.linkedin.ugc.ShareContent'].media = [{
          status: 'READY',
          originalUrl: params.linkUrl,
          title: params.linkTitle ? { text: params.linkTitle } : undefined,
          description: params.linkDescription ? { text: params.linkDescription } : undefined,
        }];
      }

      const response = await fetch(`${LINKEDIN_API}/ugcPosts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `LinkedIn API error: ${response.status} - ${error}`,
        };
      }

      const result = await response.json() as { id: string };
      
      return {
        success: true,
        message: '✅ Posted to LinkedIn!',
        data: {
          postId: result.id,
          postUrl: `https://www.linkedin.com/feed/update/${result.id}`,
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to post: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Draft LinkedIn Post ============
export const draftLinkedInPostTool: Tool = {
  name: 'draft_linkedin_post',
  description: 'Create a draft LinkedIn post with proper formatting. Does NOT post - just creates the draft.',
  parameters: {
    type: 'object',
    properties: {
      topic: { 
        type: 'string', 
        description: 'What the post should be about' 
      },
      style: { 
        type: 'string', 
        enum: ['story', 'tips', 'announcement', 'question', 'insight'],
        description: 'Post style/format' 
      },
      productId: { 
        type: 'string', 
        description: 'Product to promote (uses active product if not specified)' 
      },
      includeEmojis: { 
        type: 'boolean', 
        description: 'Include emojis (default: true)' 
      },
      includeCTA: { 
        type: 'boolean', 
        description: 'Include call-to-action (default: true)' 
      },
    },
    required: ['topic'],
  },

  async execute(params): Promise<ToolResult> {
    // This tool just returns structured data for the AI to use
    // The AI will generate the actual post content
    return {
      success: true,
      message: 'Draft parameters received. Generate post content based on:',
      data: {
        topic: params.topic,
        style: params.style || 'insight',
        guidelines: [
          'LinkedIn posts perform best at 1200-1500 characters',
          'Use line breaks for readability (short paragraphs)',
          'Start with a hook (first line is crucial)',
          'Use emojis sparingly but strategically',
          params.includeCTA !== false ? 'End with a question or CTA' : 'No CTA needed',
          'Hashtags: 3-5 relevant ones at the end',
        ],
      },
    };
  },
};

// ============ Get LinkedIn Profile ============
export const getLinkedInProfileTool: Tool = {
  name: 'get_linkedin_profile',
  description: 'Get your LinkedIn profile information',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const token = await getLinkedInToken();
    if (!token) {
      return {
        success: false,
        message: 'LinkedIn access token not found.',
      };
    }

    try {
      // Use userinfo endpoint (OpenID Connect) - works with most token scopes
      const response = await fetch(`${LINKEDIN_API}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `LinkedIn API error: ${response.status}`,
        };
      }

      const profile = await response.json() as { sub: string; name: string; given_name: string; family_name: string; picture?: string };
      
      return {
        success: true,
        message: 'LinkedIn profile retrieved.',
        data: {
          id: profile.sub,
          name: profile.name,
          firstName: profile.given_name,
          lastName: profile.family_name,
          picture: profile.picture,
          urn: `urn:li:person:${profile.sub}`,
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to get profile: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Check LinkedIn Token ============
export const checkLinkedInAuthTool: Tool = {
  name: 'check_linkedin_auth',
  description: 'Check if LinkedIn authentication is configured and valid',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const token = await getLinkedInToken();
    
    if (!token) {
      return {
        success: false,
        message: 'No LinkedIn token found. Set LINKEDIN_ACCESS_TOKEN or configure in Keychain.',
        data: { authenticated: false },
      };
    }

    // Test the token using userinfo endpoint
    try {
      const response = await fetch(`${LINKEDIN_API}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const profile = await response.json() as { sub: string; name: string; given_name: string; family_name: string };
        return {
          success: true,
          message: `✅ LinkedIn authenticated as ${profile.name}`,
          data: { 
            authenticated: true,
            name: profile.name,
            urn: `urn:li:person:${profile.sub}`,
          },
        };
      } else if (response.status === 401) {
        return {
          success: false,
          message: 'LinkedIn token expired or invalid. Need to re-authenticate.',
          data: { authenticated: false, expired: true },
        };
      } else {
        return {
          success: false,
          message: `LinkedIn API error: ${response.status}`,
          data: { authenticated: false },
        };
      }
    } catch (err) {
      return {
        success: false,
        message: `Failed to verify token: ${err instanceof Error ? err.message : String(err)}`,
        data: { authenticated: false },
      };
    }
  },
};

// ============ Export All ============
export const linkedInTools: Tool[] = [
  postToLinkedInTool,
  draftLinkedInPostTool,
  getLinkedInProfileTool,
  checkLinkedInAuthTool,
];
