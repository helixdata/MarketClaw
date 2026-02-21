/**
 * Approval Types Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  ApprovalRequest, 
  ApprovalStatus, 
  ContentType, 
  ApprovalNotification 
} from './types.js';

describe('ApprovalStatus', () => {
  it('should support all status values', () => {
    const statuses: ApprovalStatus[] = ['pending', 'approved', 'rejected', 'expired'];
    
    const request: ApprovalRequest = {
      id: 'test',
      contentType: 'tweet',
      content: 'Test content',
      requestedBy: 'user1',
      requestedByName: 'User',
      requestedAt: '2024-01-01T00:00:00Z',
      status: 'pending',
    };

    for (const status of statuses) {
      request.status = status;
      expect(request.status).toBe(status);
    }
  });
});

describe('ContentType', () => {
  it('should support all content types', () => {
    const contentTypes: ContentType[] = ['tweet', 'linkedin_post', 'email', 'producthunt', 'other'];
    
    for (const contentType of contentTypes) {
      const request: ApprovalRequest = {
        id: 'test',
        contentType,
        content: 'Test content',
        requestedBy: 'user1',
        requestedByName: 'User',
        requestedAt: '2024-01-01T00:00:00Z',
        status: 'pending',
      };
      
      expect(request.contentType).toBe(contentType);
    }
  });
});

describe('ApprovalRequest', () => {
  it('should create valid request with minimal fields', () => {
    const request: ApprovalRequest = {
      id: 'approval_123',
      contentType: 'tweet',
      content: 'This is a test tweet',
      requestedBy: 'user_1',
      requestedByName: 'Test User',
      requestedAt: '2024-01-01T00:00:00Z',
      status: 'pending',
    };

    expect(request.id).toBe('approval_123');
    expect(request.contentType).toBe('tweet');
    expect(request.content).toBe('This is a test tweet');
    expect(request.requestedBy).toBe('user_1');
    expect(request.requestedByName).toBe('Test User');
    expect(request.requestedAt).toBe('2024-01-01T00:00:00Z');
    expect(request.status).toBe('pending');
  });

  it('should create valid request with all optional fields', () => {
    const request: ApprovalRequest = {
      id: 'approval_456',
      contentType: 'email',
      content: 'Email body content',
      metadata: { 
        subject: 'Test Subject', 
        recipients: ['a@b.com', 'c@d.com'],
        cc: ['e@f.com'],
      },
      productId: 'product_1',
      campaignId: 'campaign_1',
      requestedBy: 'user_2',
      requestedByName: 'Another User',
      requestedAt: '2024-01-01T00:00:00Z',
      status: 'approved',
      resolvedBy: 'admin_1',
      resolvedByName: 'Admin User',
      resolvedAt: '2024-01-01T01:00:00Z',
      rejectionReason: undefined,
      postedAt: '2024-01-01T02:00:00Z',
      postResult: 'email_id_123',
      expiresAt: '2024-01-08T00:00:00Z',
    };

    expect(request.metadata).toEqual({ 
      subject: 'Test Subject', 
      recipients: ['a@b.com', 'c@d.com'],
      cc: ['e@f.com'],
    });
    expect(request.productId).toBe('product_1');
    expect(request.campaignId).toBe('campaign_1');
    expect(request.resolvedBy).toBe('admin_1');
    expect(request.resolvedByName).toBe('Admin User');
    expect(request.resolvedAt).toBe('2024-01-01T01:00:00Z');
    expect(request.postedAt).toBe('2024-01-01T02:00:00Z');
    expect(request.postResult).toBe('email_id_123');
    expect(request.expiresAt).toBe('2024-01-08T00:00:00Z');
  });

  it('should handle rejected request with reason', () => {
    const request: ApprovalRequest = {
      id: 'approval_789',
      contentType: 'linkedin_post',
      content: 'LinkedIn post content',
      requestedBy: 'user_3',
      requestedByName: 'Third User',
      requestedAt: '2024-01-01T00:00:00Z',
      status: 'rejected',
      resolvedBy: 'admin_2',
      resolvedByName: 'Admin Two',
      resolvedAt: '2024-01-01T01:00:00Z',
      rejectionReason: 'Content not appropriate for this audience',
    };

    expect(request.status).toBe('rejected');
    expect(request.rejectionReason).toBe('Content not appropriate for this audience');
  });

  it('should handle expired request', () => {
    const request: ApprovalRequest = {
      id: 'approval_expired',
      contentType: 'producthunt',
      content: 'Product Hunt launch content',
      requestedBy: 'user_4',
      requestedByName: 'Fourth User',
      requestedAt: '2024-01-01T00:00:00Z',
      status: 'expired',
      expiresAt: '2024-01-02T00:00:00Z',
    };

    expect(request.status).toBe('expired');
    expect(request.expiresAt).toBeDefined();
  });

  it('should support various metadata structures', () => {
    // Tweet metadata
    const tweetRequest: ApprovalRequest = {
      id: 'tweet_1',
      contentType: 'tweet',
      content: 'Tweet text',
      metadata: { hashtags: ['#marketing', '#ai'] },
      requestedBy: 'user',
      requestedByName: 'User',
      requestedAt: '2024-01-01T00:00:00Z',
      status: 'pending',
    };
    expect(tweetRequest.metadata?.hashtags).toEqual(['#marketing', '#ai']);

    // Email metadata
    const emailRequest: ApprovalRequest = {
      id: 'email_1',
      contentType: 'email',
      content: 'Email body',
      metadata: { 
        subject: 'Subject line',
        recipients: ['a@b.com'],
        template: 'launch',
      },
      requestedBy: 'user',
      requestedByName: 'User',
      requestedAt: '2024-01-01T00:00:00Z',
      status: 'pending',
    };
    expect(emailRequest.metadata?.subject).toBe('Subject line');

    // Product Hunt metadata
    const phRequest: ApprovalRequest = {
      id: 'ph_1',
      contentType: 'producthunt',
      content: 'Product description',
      metadata: { 
        tagline: 'The best product ever',
        topics: ['productivity', 'ai'],
        thumbnail: 'https://example.com/thumb.png',
      },
      requestedBy: 'user',
      requestedByName: 'User',
      requestedAt: '2024-01-01T00:00:00Z',
      status: 'pending',
    };
    expect(phRequest.metadata?.tagline).toBe('The best product ever');
  });
});

describe('ApprovalNotification', () => {
  it('should create valid notification', () => {
    const notification: ApprovalNotification = {
      approvalId: 'approval_123',
      notifiedMembers: ['user_1', 'user_2', 'user_3'],
      notifiedAt: '2024-01-01T00:00:00Z',
    };

    expect(notification.approvalId).toBe('approval_123');
    expect(notification.notifiedMembers).toEqual(['user_1', 'user_2', 'user_3']);
    expect(notification.notifiedAt).toBe('2024-01-01T00:00:00Z');
  });

  it('should handle single notified member', () => {
    const notification: ApprovalNotification = {
      approvalId: 'approval_456',
      notifiedMembers: ['admin_1'],
      notifiedAt: '2024-01-01T00:00:00Z',
    };

    expect(notification.notifiedMembers).toHaveLength(1);
  });

  it('should handle empty notified members', () => {
    const notification: ApprovalNotification = {
      approvalId: 'approval_789',
      notifiedMembers: [],
      notifiedAt: '2024-01-01T00:00:00Z',
    };

    expect(notification.notifiedMembers).toHaveLength(0);
  });
});

describe('Approval workflow scenarios', () => {
  it('should represent complete approval flow', () => {
    // 1. Request created
    const request: ApprovalRequest = {
      id: 'workflow_1',
      contentType: 'tweet',
      content: 'A great tweet',
      requestedBy: 'creator_1',
      requestedByName: 'Creator',
      requestedAt: '2024-01-01T10:00:00Z',
      status: 'pending',
      expiresAt: '2024-01-02T10:00:00Z',
    };

    expect(request.status).toBe('pending');
    expect(request.resolvedBy).toBeUndefined();

    // 2. Request approved
    request.status = 'approved';
    request.resolvedBy = 'manager_1';
    request.resolvedByName = 'Manager';
    request.resolvedAt = '2024-01-01T11:00:00Z';

    expect(request.status).toBe('approved');
    expect(request.resolvedBy).toBe('manager_1');

    // 3. Content posted
    request.postedAt = '2024-01-01T12:00:00Z';
    request.postResult = 'tweet_id_987654321';

    expect(request.postedAt).toBeDefined();
    expect(request.postResult).toBe('tweet_id_987654321');
  });

  it('should represent rejection flow', () => {
    const request: ApprovalRequest = {
      id: 'workflow_2',
      contentType: 'linkedin_post',
      content: 'Rejected content',
      requestedBy: 'creator_2',
      requestedByName: 'Creator Two',
      requestedAt: '2024-01-01T10:00:00Z',
      status: 'pending',
    };

    // Rejection
    request.status = 'rejected';
    request.resolvedBy = 'manager_2';
    request.resolvedByName = 'Manager Two';
    request.resolvedAt = '2024-01-01T11:00:00Z';
    request.rejectionReason = 'Off brand messaging';

    expect(request.status).toBe('rejected');
    expect(request.rejectionReason).toBe('Off brand messaging');
    expect(request.postedAt).toBeUndefined();
  });

  it('should represent expiration flow', () => {
    const request: ApprovalRequest = {
      id: 'workflow_3',
      contentType: 'email',
      content: 'Expiring content',
      requestedBy: 'creator_3',
      requestedByName: 'Creator Three',
      requestedAt: '2024-01-01T10:00:00Z',
      status: 'pending',
      expiresAt: '2024-01-01T12:00:00Z',
    };

    // Time passes, content expires
    request.status = 'expired';

    expect(request.status).toBe('expired');
    expect(request.resolvedBy).toBeUndefined();
    expect(request.postedAt).toBeUndefined();
  });
});
