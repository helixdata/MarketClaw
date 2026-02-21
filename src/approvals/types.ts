/**
 * Approval Types
 * Content approval workflow
 */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ContentType = 'tweet' | 'linkedin_post' | 'email' | 'producthunt' | 'other';

/**
 * Approval request
 */
export interface ApprovalRequest {
  id: string;
  
  // Content
  contentType: ContentType;
  content: string;
  metadata?: Record<string, unknown>;  // Extra data (subject line, recipients, etc.)
  
  // Context
  productId?: string;
  campaignId?: string;
  
  // Requester
  requestedBy: string;           // Member ID
  requestedByName: string;
  requestedAt: string;
  
  // Status
  status: ApprovalStatus;
  
  // Resolution
  resolvedBy?: string;           // Member ID
  resolvedByName?: string;
  resolvedAt?: string;
  rejectionReason?: string;
  
  // If approved, was it posted?
  postedAt?: string;
  postResult?: string;
  
  // Expiry
  expiresAt?: string;
}

/**
 * Approval notification
 */
export interface ApprovalNotification {
  approvalId: string;
  notifiedMembers: string[];     // Member IDs
  notifiedAt: string;
}
