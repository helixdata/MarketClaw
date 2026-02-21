/**
 * Approval Tools Tests
 * Tests the tool wrappers for the approval workflow
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock pino before imports
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the approvalManager - use inline object to avoid hoisting issues
vi.mock('./manager.js', () => ({
  approvalManager: {
    requestApproval: vi.fn(),
    get: vi.fn(),
    listPending: vi.fn(),
    list: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    getApprovers: vi.fn(),
  },
}));

// Mock teamManager
vi.mock('../team/index.js', () => ({
  teamManager: {
    listMembers: vi.fn().mockReturnValue([]),
    hasPermission: vi.fn().mockReturnValue(false),
  },
}));

// Import tools and the mocked manager after mocks
import {
  requestApprovalTool,
  listPendingApprovalsTool,
  approveContentTool,
  rejectContentTool,
  getApprovalTool,
  listApproversTool,
  myPendingApprovalsTool,
} from './tools.js';
import { approvalManager } from './manager.js';

// Cast to get access to mock functions
const mockApprovalManager = approvalManager as unknown as {
  requestApproval: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  listPending: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  approve: ReturnType<typeof vi.fn>;
  reject: ReturnType<typeof vi.fn>;
  getApprovers: ReturnType<typeof vi.fn>;
};

describe('Approval Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('request_approval', () => {
    it('should have correct metadata', () => {
      expect(requestApprovalTool.name).toBe('request_approval');
      expect(requestApprovalTool.parameters.required).toContain('contentType');
      expect(requestApprovalTool.parameters.required).toContain('content');
      expect(requestApprovalTool.parameters.required).toContain('requesterId');
      expect(requestApprovalTool.parameters.required).toContain('requesterName');
    });

    it('should create approval request', async () => {
      const mockRequest = {
        id: 'approval_123',
        contentType: 'tweet',
        content: 'Hello world!',
        requestedBy: 'user_1',
        requestedByName: 'Test User',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      mockApprovalManager.requestApproval.mockResolvedValue(mockRequest);
      mockApprovalManager.getApprovers.mockReturnValue([
        { id: 'admin_1', name: 'Admin', telegramId: 12345 },
      ]);

      const result = await requestApprovalTool.execute({
        contentType: 'tweet',
        content: 'Hello world!',
        requesterId: 'user_1',
        requesterName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.data.approvalId).toBe('approval_123');
      expect(result.data.status).toBe('pending');
      expect(result.data.approvers).toHaveLength(1);
      expect(result.message).toContain('Admin');
    });

    it('should include productId in request', async () => {
      const mockRequest = {
        id: 'approval_456',
        contentType: 'linkedin_post',
        content: 'Product launch!',
        productId: 'product_abc',
        requestedBy: 'user_1',
        requestedByName: 'Test User',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      mockApprovalManager.requestApproval.mockResolvedValue(mockRequest);
      mockApprovalManager.getApprovers.mockReturnValue([]);

      const result = await requestApprovalTool.execute({
        contentType: 'linkedin_post',
        content: 'Product launch!',
        productId: 'product_abc',
        requesterId: 'user_1',
        requesterName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(mockApprovalManager.requestApproval).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'product_abc' })
      );
    });

    it('should parse valid metadata JSON', async () => {
      const mockRequest = {
        id: 'approval_789',
        contentType: 'email',
        content: 'Email body',
        metadata: { subject: 'Hello', to: ['user@example.com'] },
        requestedBy: 'user_1',
        requestedByName: 'Test User',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      mockApprovalManager.requestApproval.mockResolvedValue(mockRequest);
      mockApprovalManager.getApprovers.mockReturnValue([]);

      const result = await requestApprovalTool.execute({
        contentType: 'email',
        content: 'Email body',
        metadata: '{"subject":"Hello","to":["user@example.com"]}',
        requesterId: 'user_1',
        requesterName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(mockApprovalManager.requestApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { subject: 'Hello', to: ['user@example.com'] },
        })
      );
    });

    it('should fail on invalid metadata JSON', async () => {
      const result = await requestApprovalTool.execute({
        contentType: 'email',
        content: 'Email body',
        metadata: 'not valid json {{{',
        requesterId: 'user_1',
        requesterName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid metadata JSON');
    });

    it('should handle no approvers found', async () => {
      const mockRequest = {
        id: 'approval_no_approvers',
        contentType: 'tweet',
        content: 'No approvers',
        requestedBy: 'user_1',
        requestedByName: 'Test User',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      mockApprovalManager.requestApproval.mockResolvedValue(mockRequest);
      mockApprovalManager.getApprovers.mockReturnValue([]);

      const result = await requestApprovalTool.execute({
        contentType: 'tweet',
        content: 'No approvers',
        requesterId: 'user_1',
        requesterName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('no approvers found');
    });

    it('should include notify message in response', async () => {
      const mockRequest = {
        id: 'approval_notify',
        contentType: 'tweet',
        content: 'This is a tweet that should be notified about',
        requestedBy: 'user_1',
        requestedByName: 'Test User',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      mockApprovalManager.requestApproval.mockResolvedValue(mockRequest);
      mockApprovalManager.getApprovers.mockReturnValue([]);

      const result = await requestApprovalTool.execute({
        contentType: 'tweet',
        content: 'This is a tweet that should be notified about',
        requesterId: 'user_1',
        requesterName: 'Test User',
      });

      expect(result.data.notifyMessage).toContain('Approval Needed');
      expect(result.data.notifyMessage).toContain('tweet');
      expect(result.data.notifyMessage).toContain('Test User');
      expect(result.data.notifyMessage).toContain('approval_notify');
    });
  });

  describe('list_pending_approvals', () => {
    it('should have correct metadata', () => {
      expect(listPendingApprovalsTool.name).toBe('list_pending_approvals');
    });

    it('should list pending approvals', async () => {
      mockApprovalManager.listPending.mockReturnValue([
        {
          id: 'approval_1',
          contentType: 'tweet',
          content: 'This is a long tweet that should be truncated in the preview...',
          requestedByName: 'User 1',
          requestedAt: new Date().toISOString(),
          productId: 'product_a',
        },
        {
          id: 'approval_2',
          contentType: 'email',
          content: 'Short email',
          requestedByName: 'User 2',
          requestedAt: new Date().toISOString(),
        },
      ]);

      const result = await listPendingApprovalsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('2 pending approval(s)');
      expect(result.data.pending).toHaveLength(2);
      expect(result.data.pending[0].id).toBe('approval_1');
      expect(result.data.pending[0].preview.length).toBeLessThanOrEqual(103); // 100 + "..."
    });

    it('should filter by productId', async () => {
      mockApprovalManager.listPending.mockReturnValue([
        {
          id: 'approval_product',
          contentType: 'tweet',
          content: 'Product tweet',
          requestedByName: 'User',
          requestedAt: new Date().toISOString(),
          productId: 'product_x',
        },
      ]);

      const result = await listPendingApprovalsTool.execute({ productId: 'product_x' });

      expect(result.success).toBe(true);
      expect(mockApprovalManager.listPending).toHaveBeenCalledWith('product_x');
    });

    it('should handle empty list', async () => {
      mockApprovalManager.listPending.mockReturnValue([]);

      const result = await listPendingApprovalsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('0 pending approval(s)');
      expect(result.data.pending).toEqual([]);
    });
  });

  describe('approve_content', () => {
    it('should have correct metadata', () => {
      expect(approveContentTool.name).toBe('approve_content');
      expect(approveContentTool.parameters.required).toContain('approvalId');
      expect(approveContentTool.parameters.required).toContain('approverId');
      expect(approveContentTool.parameters.required).toContain('approverName');
    });

    it('should approve pending content', async () => {
      const mockApproval = {
        id: 'approval_to_approve',
        status: 'pending',
        contentType: 'tweet',
        content: 'Approve me',
      };
      mockApprovalManager.get.mockReturnValue(mockApproval);
      mockApprovalManager.approve.mockResolvedValue({
        ...mockApproval,
        status: 'approved',
        resolvedBy: 'admin_1',
        resolvedByName: 'Admin',
      });

      const result = await approveContentTool.execute({
        approvalId: 'approval_to_approve',
        approverId: 'admin_1',
        approverName: 'Admin',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Approved by Admin');
      expect(result.data.approval.status).toBe('approved');
    });

    it('should fail if approval not found', async () => {
      mockApprovalManager.get.mockReturnValue(undefined);

      const result = await approveContentTool.execute({
        approvalId: 'nonexistent',
        approverId: 'admin_1',
        approverName: 'Admin',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should fail if already resolved', async () => {
      mockApprovalManager.get.mockReturnValue({
        id: 'approval_already_done',
        status: 'rejected',
      });

      const result = await approveContentTool.execute({
        approvalId: 'approval_already_done',
        approverId: 'admin_1',
        approverName: 'Admin',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Already rejected');
    });

    it('should indicate auto-post when requested', async () => {
      const mockApproval = {
        id: 'approval_autopost',
        status: 'pending',
      };
      mockApprovalManager.get.mockReturnValue(mockApproval);
      mockApprovalManager.approve.mockResolvedValue({
        ...mockApproval,
        status: 'approved',
      });

      const result = await approveContentTool.execute({
        approvalId: 'approval_autopost',
        approverId: 'admin_1',
        approverName: 'Admin',
        autoPost: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.nextStep).toContain('automatically');
    });
  });

  describe('reject_content', () => {
    it('should have correct metadata', () => {
      expect(rejectContentTool.name).toBe('reject_content');
      expect(rejectContentTool.parameters.required).toContain('approvalId');
      expect(rejectContentTool.parameters.required).toContain('rejecterId');
      expect(rejectContentTool.parameters.required).toContain('rejecterName');
    });

    it('should reject pending content', async () => {
      const mockApproval = {
        id: 'approval_to_reject',
        status: 'pending',
        contentType: 'tweet',
        content: 'Reject me',
      };
      mockApprovalManager.get.mockReturnValue(mockApproval);
      mockApprovalManager.reject.mockResolvedValue({
        ...mockApproval,
        status: 'rejected',
        resolvedBy: 'admin_1',
        resolvedByName: 'Admin',
        rejectionReason: 'Too informal',
      });

      const result = await rejectContentTool.execute({
        approvalId: 'approval_to_reject',
        rejecterId: 'admin_1',
        rejecterName: 'Admin',
        reason: 'Too informal',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Rejected by Admin');
      expect(result.message).toContain('Too informal');
      expect(result.data.approval.status).toBe('rejected');
    });

    it('should reject without reason', async () => {
      const mockApproval = {
        id: 'approval_no_reason',
        status: 'pending',
        contentType: 'tweet',
      };
      mockApprovalManager.get.mockReturnValue(mockApproval);
      mockApprovalManager.reject.mockResolvedValue({
        ...mockApproval,
        status: 'rejected',
      });

      const result = await rejectContentTool.execute({
        approvalId: 'approval_no_reason',
        rejecterId: 'admin_1',
        rejecterName: 'Admin',
      });

      expect(result.success).toBe(true);
      expect(result.message).not.toContain(':');
    });

    it('should fail if approval not found', async () => {
      mockApprovalManager.get.mockReturnValue(undefined);

      const result = await rejectContentTool.execute({
        approvalId: 'nonexistent',
        rejecterId: 'admin_1',
        rejecterName: 'Admin',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should fail if already resolved', async () => {
      mockApprovalManager.get.mockReturnValue({
        id: 'approval_already_approved',
        status: 'approved',
      });

      const result = await rejectContentTool.execute({
        approvalId: 'approval_already_approved',
        rejecterId: 'admin_1',
        rejecterName: 'Admin',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Already approved');
    });

    it('should include notification message for creator', async () => {
      const mockApproval = {
        id: 'approval_notify_creator',
        status: 'pending',
        contentType: 'tweet',
      };
      mockApprovalManager.get.mockReturnValue(mockApproval);
      mockApprovalManager.reject.mockResolvedValue({
        ...mockApproval,
        status: 'rejected',
        contentType: 'tweet',
      });

      const result = await rejectContentTool.execute({
        approvalId: 'approval_notify_creator',
        rejecterId: 'admin_1',
        rejecterName: 'Admin',
        reason: 'Needs more detail',
      });

      expect(result.data.notifyCreator).toContain('rejected');
      expect(result.data.notifyCreator).toContain('Admin');
      expect(result.data.notifyCreator).toContain('Needs more detail');
    });
  });

  describe('get_approval', () => {
    it('should have correct metadata', () => {
      expect(getApprovalTool.name).toBe('get_approval');
      expect(getApprovalTool.parameters.required).toContain('approvalId');
    });

    it('should return approval details', async () => {
      const mockApproval = {
        id: 'approval_details',
        contentType: 'linkedin_post',
        content: 'Full content here',
        status: 'pending',
        requestedBy: 'user_1',
        requestedByName: 'User 1',
        requestedAt: new Date().toISOString(),
      };
      mockApprovalManager.get.mockReturnValue(mockApproval);

      const result = await getApprovalTool.execute({ approvalId: 'approval_details' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('approval_details');
      expect(result.message).toContain('pending');
      expect(result.data.approval).toEqual(mockApproval);
    });

    it('should fail if not found', async () => {
      mockApprovalManager.get.mockReturnValue(undefined);

      const result = await getApprovalTool.execute({ approvalId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('list_approvers', () => {
    it('should have correct metadata', () => {
      expect(listApproversTool.name).toBe('list_approvers');
    });

    it('should list all approvers', async () => {
      mockApprovalManager.getApprovers.mockReturnValue([
        { id: 'admin_1', name: 'Admin 1', telegramId: 12345 },
        { id: 'manager_1', name: 'Manager 1', telegramId: 67890 },
      ]);

      const result = await listApproversTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('2 approver(s)');
      expect(result.data.approvers).toHaveLength(2);
    });

    it('should filter by productId', async () => {
      mockApprovalManager.getApprovers.mockReturnValue([
        { id: 'product_manager', name: 'Product Manager', telegramId: 11111 },
      ]);

      const result = await listApproversTool.execute({ productId: 'product_x' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('for product_x');
      expect(mockApprovalManager.getApprovers).toHaveBeenCalledWith('product_x');
    });

    it('should handle no approvers', async () => {
      mockApprovalManager.getApprovers.mockReturnValue([]);

      const result = await listApproversTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('0 approver(s)');
    });
  });

  describe('my_pending_approvals', () => {
    it('should have correct metadata', () => {
      expect(myPendingApprovalsTool.name).toBe('my_pending_approvals');
      expect(myPendingApprovalsTool.parameters.required).toContain('requesterId');
    });

    it('should list user pending approvals', async () => {
      mockApprovalManager.list.mockReturnValue([
        {
          id: 'my_approval_1',
          contentType: 'tweet',
          content: 'My tweet content',
          requestedAt: new Date().toISOString(),
          productId: 'product_a',
        },
      ]);

      const result = await myPendingApprovalsTool.execute({ requesterId: 'user_123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('1 pending approval(s)');
      expect(result.data.pending[0].id).toBe('my_approval_1');
      expect(mockApprovalManager.list).toHaveBeenCalledWith({
        status: 'pending',
        requestedBy: 'user_123',
      });
    });

    it('should handle no pending approvals', async () => {
      mockApprovalManager.list.mockReturnValue([]);

      const result = await myPendingApprovalsTool.execute({ requesterId: 'user_456' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('0 pending approval(s)');
      expect(result.data.pending).toEqual([]);
    });

    it('should truncate long content in preview', async () => {
      const longContent = 'x'.repeat(200);
      mockApprovalManager.list.mockReturnValue([
        {
          id: 'long_content',
          contentType: 'email',
          content: longContent,
          requestedAt: new Date().toISOString(),
        },
      ]);

      const result = await myPendingApprovalsTool.execute({ requesterId: 'user_123' });

      expect(result.data.pending[0].preview.length).toBe(100);
    });
  });
});
