/**
 * IMAP Email Tools
 * Read and manage incoming emails via Himalaya CLI
 */

import { Tool, ToolResult } from './types.js';
import { execSync } from 'child_process';

// Execute himalaya command
function execHimalaya(args: string): { success: boolean; output: string; data?: any } {
  try {
    const cmd = `himalaya ${args} --output json`;
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
    const stderr = err.stderr || err.message || String(err);
    // Check for config error
    if (stderr.includes('cannot find configuration') || stderr.includes('config.toml')) {
      return { 
        success: false, 
        output: 'Himalaya not configured. Run: himalaya account configure' 
      };
    }
    return { success: false, output: stderr };
  }
}

// ============ Check Inbox ============
export const checkImapInboxTool: Tool = {
  name: 'check_imap_inbox',
  description: 'Check email inbox via IMAP (Himalaya). Works with any email provider.',
  parameters: {
    type: 'object',
    properties: {
      folder: { 
        type: 'string', 
        description: 'Folder to check (default: INBOX)' 
      },
      limit: { 
        type: 'number', 
        description: 'Number of emails to fetch (default: 10)' 
      },
      account: { 
        type: 'string', 
        description: 'Account name if multiple configured' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const limit = params.limit || 10;
    const folder = params.folder || 'INBOX';
    const account = params.account ? `--account ${params.account}` : '';
    
    const result = execHimalaya(`envelope list --folder "${folder}" --page-size ${limit} ${account}`);
    
    if (!result.success) {
      return {
        success: false,
        message: result.output,
      };
    }

    const envelopes = result.data || [];
    
    if (envelopes.length === 0) {
      return {
        success: true,
        message: `No emails in ${folder}`,
        data: [],
      };
    }

    return {
      success: true,
      message: `Found ${envelopes.length} email(s) in ${folder}`,
      data: envelopes.map((e: any) => ({
        id: e.id,
        date: e.date,
        from: e.from?.addr || e.from,
        subject: e.subject,
        flags: e.flags,
      })),
    };
  },
};

// ============ Search Emails ============
export const searchImapEmailsTool: Tool = {
  name: 'search_imap_emails',
  description: 'Search emails via IMAP',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'Search query (subject, from, body content)' 
      },
      folder: { 
        type: 'string', 
        description: 'Folder to search (default: INBOX)' 
      },
      limit: { 
        type: 'number', 
        description: 'Max results (default: 20)' 
      },
    },
    required: ['query'],
  },

  async execute(params): Promise<ToolResult> {
    const limit = params.limit || 20;
    const folder = params.folder || 'INBOX';
    
    // Himalaya uses IMAP search syntax
    const result = execHimalaya(`envelope list --folder "${folder}" --page-size ${limit} --query "SUBJECT ${params.query} OR FROM ${params.query} OR BODY ${params.query}"`);
    
    if (!result.success) {
      return {
        success: false,
        message: result.output,
      };
    }

    const envelopes = result.data || [];
    
    return {
      success: true,
      message: `Found ${envelopes.length} result(s)`,
      data: envelopes.map((e: any) => ({
        id: e.id,
        date: e.date,
        from: e.from?.addr || e.from,
        subject: e.subject,
      })),
    };
  },
};

// ============ Read Email ============
export const readImapEmailTool: Tool = {
  name: 'read_imap_email',
  description: 'Read a single email message',
  parameters: {
    type: 'object',
    properties: {
      id: { 
        type: 'string', 
        description: 'Email ID from inbox/search results' 
      },
      folder: { 
        type: 'string', 
        description: 'Folder (default: INBOX)' 
      },
    },
    required: ['id'],
  },

  async execute(params): Promise<ToolResult> {
    const folder = params.folder || 'INBOX';
    
    const result = execHimalaya(`message read --folder "${folder}" ${params.id}`);
    
    if (!result.success) {
      return {
        success: false,
        message: result.output,
      };
    }

    return {
      success: true,
      message: 'Email retrieved',
      data: result.data,
    };
  },
};

// ============ List Folders ============
export const listImapFoldersTool: Tool = {
  name: 'list_imap_folders',
  description: 'List email folders/mailboxes',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const result = execHimalaya('folder list');
    
    if (!result.success) {
      return {
        success: false,
        message: result.output,
      };
    }

    const folders = result.data || [];
    
    return {
      success: true,
      message: `Found ${folders.length} folder(s)`,
      data: folders.map((f: any) => ({
        name: f.name,
        delimiter: f.delim,
      })),
    };
  },
};

// ============ Check Unread Count ============
export const checkUnreadCountTool: Tool = {
  name: 'check_unread_count',
  description: 'Get count of unread emails',
  parameters: {
    type: 'object',
    properties: {
      folder: { 
        type: 'string', 
        description: 'Folder to check (default: INBOX)' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const folder = params.folder || 'INBOX';
    
    // Get envelopes and count unseen
    const result = execHimalaya(`envelope list --folder "${folder}" --page-size 100 --query "UNSEEN"`);
    
    if (!result.success) {
      return {
        success: false,
        message: result.output,
      };
    }

    const count = (result.data || []).length;
    
    return {
      success: true,
      message: count > 0 ? `${count} unread email(s)` : 'No unread emails',
      data: { unread: count, folder },
    };
  },
};

// ============ Reply to Email ============
export const replyImapEmailTool: Tool = {
  name: 'reply_imap_email',
  description: 'Reply to an email',
  parameters: {
    type: 'object',
    properties: {
      id: { 
        type: 'string', 
        description: 'Email ID to reply to' 
      },
      body: { 
        type: 'string', 
        description: 'Reply message body' 
      },
      folder: { 
        type: 'string', 
        description: 'Folder (default: INBOX)' 
      },
    },
    required: ['id', 'body'],
  },

  async execute(params): Promise<ToolResult> {
    const folder = params.folder || 'INBOX';
    
    // Create MML (MIME Meta Language) for the reply
    const mml = params.body;
    
    try {
      // Himalaya reply command
      execSync(`echo "${mml.replace(/"/g, '\\"')}" | himalaya message reply --folder "${folder}" ${params.id}`, {
        encoding: 'utf-8',
        timeout: 30000,
      });
      
      return {
        success: true,
        message: '✅ Reply sent',
        data: { repliedTo: params.id },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to send reply: ${err.stderr || err.message}`,
      };
    }
  },
};

// ============ Send Email via SMTP ============
export const sendImapEmailTool: Tool = {
  name: 'send_imap_email',
  description: 'Send an email via SMTP (Himalaya)',
  parameters: {
    type: 'object',
    properties: {
      to: { 
        type: 'string', 
        description: 'Recipient email address' 
      },
      subject: { 
        type: 'string', 
        description: 'Email subject' 
      },
      body: { 
        type: 'string', 
        description: 'Email body' 
      },
      cc: { 
        type: 'string', 
        description: 'CC recipients (optional)' 
      },
    },
    required: ['to', 'subject', 'body'],
  },

  async execute(params): Promise<ToolResult> {
    // Build MML format
    const mml = `To: ${params.to}
${params.cc ? `Cc: ${params.cc}\n` : ''}Subject: ${params.subject}

${params.body}`;

    try {
      execSync(`echo "${mml.replace(/"/g, '\\"')}" | himalaya message write`, {
        encoding: 'utf-8',
        timeout: 30000,
      });
      
      return {
        success: true,
        message: `✅ Email sent to ${params.to}`,
        data: { to: params.to, subject: params.subject },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to send: ${err.stderr || err.message}`,
      };
    }
  },
};

// ============ Check Himalaya Config ============
export const checkImapAuthTool: Tool = {
  name: 'check_imap_auth',
  description: 'Check if IMAP email (Himalaya) is configured',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const result = execHimalaya('account list');
    
    if (!result.success) {
      return {
        success: false,
        message: result.output.includes('cannot find configuration') 
          ? 'Himalaya not configured. Run: himalaya account configure'
          : result.output,
        data: { authenticated: false },
      };
    }

    const accounts = result.data || [];
    
    if (accounts.length === 0) {
      return {
        success: false,
        message: 'No accounts configured. Run: himalaya account configure',
        data: { authenticated: false },
      };
    }

    return {
      success: true,
      message: `✅ IMAP configured with ${accounts.length} account(s)`,
      data: { 
        authenticated: true,
        accounts: accounts.map((a: any) => a.name || a),
      },
    };
  },
};

// ============ Export All ============
export const imapTools: Tool[] = [
  checkImapInboxTool,
  searchImapEmailsTool,
  readImapEmailTool,
  listImapFoldersTool,
  checkUnreadCountTool,
  replyImapEmailTool,
  sendImapEmailTool,
  checkImapAuthTool,
];
