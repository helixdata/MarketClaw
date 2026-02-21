/**
 * Email Tools
 * Send transactional and marketing emails via Resend
 */

import { Tool, ToolResult } from './types.js';
import { getResendConfig, getGlobalToolConfig } from './config.js';

// Resend API
const RESEND_API = 'https://api.resend.com';

async function getApiKey(productId?: string): Promise<string | null> {
  const config = await getResendConfig(productId);
  return config?.apiKey || process.env.RESEND_API_KEY || null;
}

async function getDefaultFrom(productId?: string): Promise<string> {
  const config = await getResendConfig(productId);
  if (config?.from) return config.from;
  return process.env.RESEND_FROM_EMAIL || 'MarketClaw <noreply@resend.dev>';
}

interface EmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  tags?: { name: string; value: string }[];
}

async function sendEmail(params: EmailParams, productId?: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = await getApiKey(productId);
  if (!apiKey) {
    return { success: false, error: 'Resend API key not configured. Set RESEND_API_KEY env var or configure in ~/.marketclaw/workspace/tools.json' };
  }

  try {
    const response = await fetch(`${RESEND_API}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const result = await response.json() as { id?: string; message?: string; statusCode?: number };

    if (!response.ok) {
      return { success: false, error: result.message || `API error: ${response.status}` };
    }

    return { success: true, id: result.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============ Send Email ============
export const sendEmailTool: Tool = {
  name: 'send_email',
  description: 'Send an email via Resend. Great for outreach, updates, and marketing.',
  parameters: {
    type: 'object',
    properties: {
      to: { 
        type: 'string', 
        description: 'Recipient email address (or comma-separated list)' 
      },
      subject: { 
        type: 'string', 
        description: 'Email subject line' 
      },
      body: { 
        type: 'string', 
        description: 'Email body (plain text or HTML)' 
      },
      from: { 
        type: 'string', 
        description: 'Sender email (default: configured sender from tools.json or RESEND_FROM_EMAIL)' 
      },
      productId: {
        type: 'string',
        description: 'Product ID for per-product config overrides'
      },
      replyTo: { 
        type: 'string', 
        description: 'Reply-to address (optional)' 
      },
      isHtml: {
        type: 'boolean',
        description: 'Whether body is HTML (default: auto-detect)'
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview without sending'
      },
    },
    required: ['to', 'subject', 'body'],
  },

  async execute(params): Promise<ToolResult> {
    // Dry run
    if (params.dryRun) {
      return {
        success: true,
        message: 'Email preview (not sent):',
        data: {
          to: params.to,
          subject: params.subject,
          bodyPreview: params.body.slice(0, 200) + (params.body.length > 200 ? '...' : ''),
          isHtml: params.isHtml ?? params.body.includes('<'),
        },
      };
    }

    const isHtml = params.isHtml ?? params.body.includes('<');
    const toList = params.to.split(',').map((e: string) => e.trim());
    const defaultFrom = await getDefaultFrom(params.productId);
    
    const emailParams: EmailParams = {
      from: params.from || defaultFrom,
      to: toList,
      subject: params.subject,
      replyTo: params.replyTo,
    };

    if (isHtml) {
      emailParams.html = params.body;
    } else {
      emailParams.text = params.body;
    }

    const result = await sendEmail(emailParams, params.productId);

    if (!result.success) {
      return {
        success: false,
        message: `Failed to send email: ${result.error}`,
      };
    }

    return {
      success: true,
      message: `✅ Email sent to ${toList.length} recipient(s)`,
      data: {
        id: result.id,
        to: toList,
        subject: params.subject,
      },
      cost: {
        usd: 0.001 * toList.length, // ~$1 per 1000 emails
        provider: 'resend',
        units: toList.length,
        unitType: 'emails',
      },
    };
  },
};

// ============ Draft Email ============
export const draftEmailTool: Tool = {
  name: 'draft_email',
  description: 'Create a draft email with proper formatting. Does NOT send - just creates the draft.',
  parameters: {
    type: 'object',
    properties: {
      purpose: { 
        type: 'string', 
        description: 'Purpose of the email (e.g., "outreach to blogger", "launch announcement", "follow-up")' 
      },
      recipient: { 
        type: 'string', 
        description: 'Who is receiving this (for context)' 
      },
      productId: { 
        type: 'string', 
        description: 'Product ID for context' 
      },
      tone: {
        type: 'string',
        enum: ['formal', 'friendly', 'casual', 'professional'],
        description: 'Email tone (default: professional)'
      },
    },
    required: ['purpose'],
  },

  async execute(params): Promise<ToolResult> {
    return {
      success: true,
      message: 'Draft email parameters:',
      data: {
        purpose: params.purpose,
        recipient: params.recipient || 'unknown',
        tone: params.tone || 'professional',
        guidelines: [
          'Subject line: Clear, specific, under 50 chars',
          'Opening: Personal, relevant hook',
          'Body: Value-first, concise paragraphs',
          'CTA: Single, clear call-to-action',
          'Sign-off: Appropriate to tone',
          'PS: Optional but effective for key point',
        ],
        templates: {
          outreach: 'Subject → Hook → Why them → Value prop → Soft CTA',
          announcement: 'Subject → News → Benefits → Details → CTA',
          followUp: 'Subject → Reference → New value → Question',
        },
      },
    };
  },
};

// ============ Send Launch Announcement ============
export const sendLaunchAnnouncementTool: Tool = {
  name: 'send_launch_announcement',
  description: 'Send a product launch announcement email',
  parameters: {
    type: 'object',
    properties: {
      to: { 
        type: 'string', 
        description: 'Recipient(s) - comma separated' 
      },
      productName: { 
        type: 'string', 
        description: 'Product being launched' 
      },
      tagline: { 
        type: 'string', 
        description: 'Product tagline' 
      },
      launchUrl: { 
        type: 'string', 
        description: 'URL to the product/launch page' 
      },
      offer: { 
        type: 'string', 
        description: 'Launch offer (e.g., "50% off first month")' 
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview without sending'
      },
      productId: {
        type: 'string',
        description: 'Product ID for per-product config overrides'
      },
    },
    required: ['to', 'productName', 'launchUrl'],
  },

  async execute(params): Promise<ToolResult> {
    const defaultFrom = await getDefaultFrom(params.productId);
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .cta { display: inline-block; background: #0066ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 14px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 ${params.productName} is Live!</h1>
      ${params.tagline ? `<p><em>${params.tagline}</em></p>` : ''}
    </div>
    
    <p>Hey there,</p>
    
    <p>I'm excited to share that <strong>${params.productName}</strong> is now available!</p>
    
    ${params.offer ? `<p>🎁 <strong>Launch offer:</strong> ${params.offer}</p>` : ''}
    
    <p style="text-align: center;">
      <a href="${params.launchUrl}" class="cta">Check it out →</a>
    </p>
    
    <p>Would love to hear what you think!</p>
    
    <p>Best,<br>Brett</p>
    
    <div class="footer">
      <p>You're receiving this because you expressed interest in ${params.productName}.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    if (params.dryRun) {
      return {
        success: true,
        message: 'Launch email preview:',
        data: {
          to: params.to,
          subject: `🚀 ${params.productName} is Live!`,
          htmlPreview: html.slice(0, 500) + '...',
        },
      };
    }

    const result = await sendEmail({
      from: defaultFrom,
      to: params.to.split(',').map((e: string) => e.trim()),
      subject: `🚀 ${params.productName} is Live!`,
      html,
    }, params.productId);

    if (!result.success) {
      return {
        success: false,
        message: `Failed to send: ${result.error}`,
      };
    }

    const recipientCount = params.to.split(',').length;
    return {
      success: true,
      message: `✅ Launch announcement sent!`,
      data: { id: result.id, to: params.to },
      cost: {
        usd: 0.001 * recipientCount,
        provider: 'resend',
        units: recipientCount,
        unitType: 'emails',
      },
    };
  },
};

// ============ Check Auth ============
export const checkEmailAuthTool: Tool = {
  name: 'check_email_auth',
  description: 'Check if email (Resend) is configured and show default sender',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID to check product-specific config'
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const apiKey = await getApiKey(params?.productId);
    const defaultFrom = await getDefaultFrom(params?.productId);
    
    if (!apiKey) {
      return {
        success: false,
        message: 'Resend API key not configured. Get one at: https://resend.com',
        data: { authenticated: false },
      };
    }

    // Test with domains endpoint
    try {
      const response = await fetch(`${RESEND_API}/domains`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (response.ok) {
        const data = await response.json() as { data?: { name: string }[] };
        const domains = data.data?.map(d => d.name) || [];
        return {
          success: true,
          message: `✅ Resend connected${domains.length > 0 ? ` (domains: ${domains.join(', ')})` : ''}`,
          data: { authenticated: true, domains, defaultFrom },
        };
      } else {
        return {
          success: false,
          message: 'Resend API key invalid',
          data: { authenticated: false },
        };
      }
    } catch (err) {
      return {
        success: false,
        message: `Failed to verify: ${err instanceof Error ? err.message : String(err)}`,
        data: { authenticated: false },
      };
    }
  },
};

// ============ Export All ============
export const emailTools: Tool[] = [
  sendEmailTool,
  draftEmailTool,
  sendLaunchAnnouncementTool,
  checkEmailAuthTool,
];
