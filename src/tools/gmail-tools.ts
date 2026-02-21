/**
 * Gmail Tools
 * Read and manage incoming emails via gog CLI
 */

import { Tool, ToolResult } from './types.js';
import { execSync } from 'child_process';

// Execute gog command
function execGog(args: string): { success: boolean; output: string; data?: any } {
  try {
    const cmd = `gog gmail ${args} --json`;
    const output = execSync(cmd, { 
      encoding: 'utf-8',
      timeout: 30000,
    });
    
    try {
      return { success: true, output, data: JSON.parse(output) };
    } catch {
      return { success: true, output };
    }
  } catch (err: any) {
    return { 
      success: false, 
      output: err.stderr || err.message || String(err) 
    };
  }
}

// ============ Check Inbox ============
export const checkInboxTool: Tool = {
  name: 'check_inbox',
  description: 'Check Gmail inbox for new/unread emails',
  parameters: {
    type: 'object',
    properties: {
      unreadOnly: { 
        type: 'boolean', 
        description: 'Only show unread emails (default: true)' 
      },
      limit: { 
        type: 'number', 
        description: 'Number of emails to fetch (default: 10)' 
      },
      from: { 
        type: 'string', 
        description: 'Filter by sender email/name' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const limit = params.limit || 10;
    const unread = params.unreadOnly !== false;
    
    let query = unread ? 'is:unread' : 'in:inbox';
    if (params.from) {
      query += ` from:${params.from}`;
    }

    const result = execGog(`search "${query}" --limit ${limit}`);
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to check inbox: ${result.output}`,
      };
    }

    const threads = result.data?.threads || [];
    
    if (threads.length === 0) {
      return {
        success: true,
        message: unread ? 'No unread emails' : 'Inbox is empty',
        data: [],
      };
    }

    return {
      success: true,
      message: `Found ${threads.length} email(s)`,
      data: threads.map((t: any) => ({
        id: t.id,
        date: t.date,
        from: t.from,
        subject: t.subject,
        labels: t.labels,
        messages: t.messageCount,
      })),
    };
  },
};

// ============ Search Emails ============
export const searchEmailsTool: Tool = {
  name: 'search_emails',
  description: 'Search Gmail with advanced queries',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'Gmail search query (supports from:, to:, subject:, after:, before:, has:attachment, etc.)' 
      },
      limit: { 
        type: 'number', 
        description: 'Max results (default: 10)' 
      },
    },
    required: ['query'],
  },

  async execute(params): Promise<ToolResult> {
    const limit = params.limit || 10;
    const result = execGog(`search "${params.query}" --limit ${limit}`);
    
    if (!result.success) {
      return {
        success: false,
        message: `Search failed: ${result.output}`,
      };
    }

    const threads = result.data?.threads || [];
    
    return {
      success: true,
      message: `Found ${threads.length} result(s) for "${params.query}"`,
      data: threads.map((t: any) => ({
        id: t.id,
        date: t.date,
        from: t.from,
        subject: t.subject,
        labels: t.labels,
      })),
    };
  },
};

// ============ Read Email Thread ============
export const readEmailThreadTool: Tool = {
  name: 'read_email_thread',
  description: 'Read a full email thread/conversation',
  parameters: {
    type: 'object',
    properties: {
      threadId: { 
        type: 'string', 
        description: 'Thread ID from search/inbox results' 
      },
    },
    required: ['threadId'],
  },

  async execute(params): Promise<ToolResult> {
    const result = execGog(`thread ${params.threadId}`);
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to read thread: ${result.output}`,
      };
    }

    const thread = result.data;
    
    return {
      success: true,
      message: `Thread: ${thread?.subject || 'No subject'}`,
      data: {
        id: thread?.id,
        subject: thread?.subject,
        messages: thread?.messages?.map((m: any) => ({
          id: m.id,
          date: m.date,
          from: m.from,
          to: m.to,
          snippet: m.snippet,
          body: m.body?.slice(0, 1000), // Truncate long bodies
        })) || [],
      },
    };
  },
};

// ============ Get Single Email ============
export const getEmailTool: Tool = {
  name: 'get_email',
  description: 'Get a single email message',
  parameters: {
    type: 'object',
    properties: {
      messageId: { 
        type: 'string', 
        description: 'Message ID' 
      },
    },
    required: ['messageId'],
  },

  async execute(params): Promise<ToolResult> {
    const result = execGog(`get ${params.messageId}`);
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to get email: ${result.output}`,
      };
    }

    const msg = result.data;
    
    return {
      success: true,
      message: `Email: ${msg?.subject || 'No subject'}`,
      data: {
        id: msg?.id,
        threadId: msg?.threadId,
        date: msg?.date,
        from: msg?.from,
        to: msg?.to,
        cc: msg?.cc,
        subject: msg?.subject,
        body: msg?.body,
        labels: msg?.labels,
        hasAttachments: msg?.attachments?.length > 0,
      },
    };
  },
};

// ============ Check for Replies ============
export const checkRepliesTool: Tool = {
  name: 'check_email_replies',
  description: 'Check for replies to sent emails (useful for outreach tracking)',
  parameters: {
    type: 'object',
    properties: {
      since: { 
        type: 'string', 
        description: 'Check replies since date (e.g., "2024-01-01" or "7d" for 7 days ago)' 
      },
      limit: { 
        type: 'number', 
        description: 'Max results (default: 20)' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const limit = params.limit || 20;
    let query = 'in:inbox -from:me';
    
    if (params.since) {
      if (params.since.match(/^\d+d$/)) {
        // Parse "7d" format
        const days = parseInt(params.since);
        const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query += ` after:${date.toISOString().split('T')[0]}`;
      } else {
        query += ` after:${params.since}`;
      }
    }

    const result = execGog(`search "${query}" --limit ${limit}`);
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to check replies: ${result.output}`,
      };
    }

    const threads = result.data?.threads || [];
    
    // Filter to threads with multiple messages (likely replies)
    const replies = threads.filter((t: any) => t.messageCount > 1);
    
    return {
      success: true,
      message: `Found ${replies.length} conversation(s) with replies`,
      data: replies.map((t: any) => ({
        id: t.id,
        date: t.date,
        from: t.from,
        subject: t.subject,
        replyCount: t.messageCount - 1,
      })),
    };
  },
};

// ============ Monitor Marketing Inbox ============
export const monitorMarketingInboxTool: Tool = {
  name: 'monitor_marketing_inbox',
  description: 'Check for marketing-relevant emails (inquiries, partnership requests, press mentions)',
  parameters: {
    type: 'object',
    properties: {
      keywords: { 
        type: 'string', 
        description: 'Keywords to search for (comma-separated)' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const keywords = params.keywords || 'partnership,collaboration,press,review,feature,interview,podcast';
    const keywordList = keywords.split(',').map((k: string) => k.trim());
    
    // Build OR query
    const query = `is:unread (${keywordList.map((k: string) => `"${k}"`).join(' OR ')})`;
    
    const result = execGog(`search "${query}" --limit 20`);
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to search: ${result.output}`,
      };
    }

    const threads = result.data?.threads || [];
    
    return {
      success: true,
      message: threads.length > 0 
        ? `Found ${threads.length} potentially relevant email(s)` 
        : 'No matching emails found',
      data: threads.map((t: any) => ({
        id: t.id,
        date: t.date,
        from: t.from,
        subject: t.subject,
      })),
    };
  },
};

// ============ Export All ============
export const gmailTools: Tool[] = [
  checkInboxTool,
  searchEmailsTool,
  readEmailThreadTool,
  getEmailTool,
  checkRepliesTool,
  monitorMarketingInboxTool,
];
