/**
 * Approval Tools
 * Tools for requesting and managing content approvals
 */

import { Tool, ToolResult } from '../tools/types.js';
import { approvalManager } from './manager.js';
import { ContentType } from './types.js';

// ============ Request Approval ============
export const requestApprovalTool: Tool = {
  name: 'request_approval',
  description: 'Submit content for approval before posting. Notifies team members who can approve.',
  parameters: {
    type: 'object',
    properties: {
      contentType: {
        type: 'string',
        enum: ['tweet', 'linkedin_post', 'email', 'producthunt', 'other'],
        description: 'Type of content',
      },
      content: {
        type: 'string',
        description: 'The content to be approved',
      },
      productId: {
        type: 'string',
        description: 'Product this content is for',
      },
      metadata: {
        type: 'string',
        description: 'Additional info as JSON (e.g., email subject, recipients)',
      },
      requesterId: {
        type: 'string',
        description: 'Member ID of requester (usually the current user)',
      },
      requesterName: {
        type: 'string',
        description: 'Name of requester',
      },
    },
    required: ['contentType', 'content', 'requesterId', 'requesterName'],
  },

  async execute(params): Promise<ToolResult> {
    let metadata: Record<string, unknown> | undefined;
    if (params.metadata) {
      try {
        metadata = JSON.parse(params.metadata);
      } catch {
        return { success: false, message: 'Invalid metadata JSON' };
      }
    }

    const request = await approvalManager.requestApproval({
      contentType: params.contentType as ContentType,
      content: params.content,
      metadata,
      productId: params.productId,
      requestedBy: params.requesterId,
      requestedByName: params.requesterName,
    });

    // Get approvers to notify
    const approvers = approvalManager.getApprovers(params.productId);
    const approverNames = approvers.map(a => a.name).join(', ');

    return {
      success: true,
      message: `📝 Approval requested! Notifying: ${approverNames || 'no approvers found'}`,
      data: {
        approvalId: request.id,
        status: 'pending',
        approvers: approvers.map(a => ({ name: a.name, telegramId: a.telegramId })),
        notifyMessage: `🔔 **Approval Needed**\n\n` +
          `**Type:** ${params.contentType}\n` +
          `**From:** ${params.requesterName}\n` +
          `**Product:** ${params.productId || 'N/A'}\n\n` +
          `**Content:**\n${params.content.slice(0, 500)}${params.content.length > 500 ? '...' : ''}\n\n` +
          `Reply with "approve ${request.id}" or "reject ${request.id} [reason]"`,
      },
    };
  },
};

// ============ List Pending Approvals ============
export const listPendingApprovalsTool: Tool = {
  name: 'list_pending_approvals',
  description: 'List content waiting for approval',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Filter by product',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const pending = approvalManager.listPending(params?.productId);

    const list = pending.map(r => ({
      id: r.id,
      type: r.contentType,
      preview: r.content.slice(0, 100) + (r.content.length > 100 ? '...' : ''),
      requestedBy: r.requestedByName,
      requestedAt: r.requestedAt,
      productId: r.productId,
    }));

    return {
      success: true,
      message: `${list.length} pending approval(s)`,
      data: { pending: list },
    };
  },
};

// ============ Approve Content ============
export const approveContentTool: Tool = {
  name: 'approve_content',
  description: 'Approve pending content (requires approve_content permission)',
  parameters: {
    type: 'object',
    properties: {
      approvalId: {
        type: 'string',
        description: 'Approval request ID',
      },
      approverId: {
        type: 'string',
        description: 'Member ID of approver',
      },
      approverName: {
        type: 'string',
        description: 'Name of approver',
      },
      autoPost: {
        type: 'boolean',
        description: 'Automatically post after approval (default: false)',
      },
    },
    required: ['approvalId', 'approverId', 'approverName'],
  },

  async execute(params): Promise<ToolResult> {
    const request = approvalManager.get(params.approvalId);
    if (!request) {
      return { success: false, message: `Approval not found: ${params.approvalId}` };
    }
    if (request.status !== 'pending') {
      return { success: false, message: `Already ${request.status}` };
    }

    const approved = await approvalManager.approve(
      params.approvalId,
      params.approverId,
      params.approverName
    );

    return {
      success: true,
      message: `✅ Approved by ${params.approverName}!`,
      data: {
        approval: approved,
        nextStep: params.autoPost 
          ? 'Content will be posted automatically'
          : `Content ready to post. Use the appropriate post tool with this content.`,
      },
    };
  },
};

// ============ Reject Content ============
export const rejectContentTool: Tool = {
  name: 'reject_content',
  description: 'Reject pending content with optional reason',
  parameters: {
    type: 'object',
    properties: {
      approvalId: {
        type: 'string',
        description: 'Approval request ID',
      },
      rejecterId: {
        type: 'string',
        description: 'Member ID of rejecter',
      },
      rejecterName: {
        type: 'string',
        description: 'Name of rejecter',
      },
      reason: {
        type: 'string',
        description: 'Reason for rejection (helpful for creator)',
      },
    },
    required: ['approvalId', 'rejecterId', 'rejecterName'],
  },

  async execute(params): Promise<ToolResult> {
    const request = approvalManager.get(params.approvalId);
    if (!request) {
      return { success: false, message: `Approval not found: ${params.approvalId}` };
    }
    if (request.status !== 'pending') {
      return { success: false, message: `Already ${request.status}` };
    }

    const rejected = await approvalManager.reject(
      params.approvalId,
      params.rejecterId,
      params.rejecterName,
      params.reason
    );

    return {
      success: true,
      message: `❌ Rejected by ${params.rejecterName}${params.reason ? `: ${params.reason}` : ''}`,
      data: {
        approval: rejected,
        notifyCreator: `Your ${rejected?.contentType} was rejected by ${params.rejecterName}.\n` +
          (params.reason ? `Reason: ${params.reason}` : 'No reason provided.'),
      },
    };
  },
};

// ============ Get Approval Details ============
export const getApprovalTool: Tool = {
  name: 'get_approval',
  description: 'Get details of an approval request',
  parameters: {
    type: 'object',
    properties: {
      approvalId: {
        type: 'string',
        description: 'Approval request ID',
      },
    },
    required: ['approvalId'],
  },

  async execute(params): Promise<ToolResult> {
    const request = approvalManager.get(params.approvalId);
    if (!request) {
      return { success: false, message: `Approval not found: ${params.approvalId}` };
    }

    return {
      success: true,
      message: `Approval ${request.id}: ${request.status}`,
      data: { approval: request },
    };
  },
};

// ============ List Approvers ============
export const listApproversTool: Tool = {
  name: 'list_approvers',
  description: 'List team members who can approve content, optionally for a specific product',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID to check approvers for',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const approvers = approvalManager.getApprovers(params?.productId);

    return {
      success: true,
      message: `${approvers.length} approver(s)${params?.productId ? ` for ${params.productId}` : ''}`,
      data: { approvers },
    };
  },
};

// ============ My Pending Approvals ============
export const myPendingApprovalsTool: Tool = {
  name: 'my_pending_approvals',
  description: 'List approvals I submitted that are still pending',
  parameters: {
    type: 'object',
    properties: {
      requesterId: {
        type: 'string',
        description: 'Member ID to check',
      },
    },
    required: ['requesterId'],
  },

  async execute(params): Promise<ToolResult> {
    const all = approvalManager.list({ 
      status: 'pending',
      requestedBy: params.requesterId,
    });

    const list = all.map(r => ({
      id: r.id,
      type: r.contentType,
      preview: r.content.slice(0, 100),
      requestedAt: r.requestedAt,
      productId: r.productId,
    }));

    return {
      success: true,
      message: `${list.length} pending approval(s)`,
      data: { pending: list },
    };
  },
};

// ============ Export All ============
export const approvalTools: Tool[] = [
  requestApprovalTool,
  listPendingApprovalsTool,
  approveContentTool,
  rejectContentTool,
  getApprovalTool,
  listApproversTool,
  myPendingApprovalsTool,
];
