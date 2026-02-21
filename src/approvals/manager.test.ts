/**
 * Approval Manager Tests
 * Tests the approval workflow with mocked dependencies
 */

import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

// Mock pino before imports
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock teamManager for getApprovers
vi.mock('../team/index.js', () => ({
  teamManager: {
    listMembers: vi.fn().mockReturnValue([
      { id: 'user_admin', name: 'Admin', telegramId: 12345 },
      { id: 'user_viewer', name: 'Viewer', telegramId: 67890 },
    ]),
    hasPermission: vi.fn().mockImplementation((member, permission) => {
      if (member.id === 'user_admin') return true;
      return false;
    }),
  },
}));

// We'll use a real temp directory instead of mocking fs
// This gives us better isolation and realistic behavior

describe('ApprovalManager', () => {
  let tempDir: string;
  let approvalManager: any;
  
  beforeEach(async () => {
    // Create a fresh temp directory for each test
    tempDir = await mkdtemp(path.join(tmpdir(), 'approvals-test-'));
    
    // Mock homedir to use our temp directory
    vi.doMock('os', async () => {
      const actual = await vi.importActual('os');
      return {
        ...actual,
        homedir: () => tempDir,
      };
    });
    
    // Reset module cache and reimport
    vi.resetModules();
    const module = await import('./manager.js');
    approvalManager = module.approvalManager;
    
    // Initialize with fresh state
    await approvalManager.init();
  });

  afterEach(async () => {
    vi.resetAllMocks();
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('init', () => {
    it('should initialize with empty requests', async () => {
      const pending = approvalManager.listPending();
      expect(pending).toEqual([]);
    });

    it('should create workspace directory', async () => {
      const workspacePath = path.join(tempDir, '.marketclaw', 'workspace');
      const { existsSync } = await import('fs');
      expect(existsSync(workspacePath)).toBe(true);
    });
  });

  describe('requestApproval', () => {
    it('should create a new approval request', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Hello world!',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      expect(request.id).toMatch(/^approval_\d+_[a-z0-9]+$/);
      expect(request.contentType).toBe('tweet');
      expect(request.content).toBe('Hello world!');
      expect(request.requestedBy).toBe('user_123');
      expect(request.requestedByName).toBe('Test User');
      expect(request.status).toBe('pending');
      expect(request.requestedAt).toBeDefined();
    });

    it('should include optional metadata', async () => {
      const metadata = { subject: 'Newsletter', recipients: ['user@example.com'] };
      const request = await approvalManager.requestApproval({
        contentType: 'email',
        content: 'Email body here',
        metadata,
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      expect(request.metadata).toEqual(metadata);
    });

    it('should set productId and campaignId', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'linkedin_post',
        content: 'LinkedIn post content',
        productId: 'product_abc',
        campaignId: 'campaign_xyz',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      expect(request.productId).toBe('product_abc');
      expect(request.campaignId).toBe('campaign_xyz');
    });

    it('should calculate expiry time when expiresInHours provided', async () => {
      const before = Date.now();
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Expiring tweet',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
        expiresInHours: 24,
      });

      expect(request.expiresAt).toBeDefined();
      const expiresAt = new Date(request.expiresAt!).getTime();
      // Should be approximately 24 hours from now
      expect(expiresAt).toBeGreaterThan(before + 23 * 60 * 60 * 1000);
      expect(expiresAt).toBeLessThan(before + 25 * 60 * 60 * 1000);
    });

    it('should persist to disk', async () => {
      await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Persisted tweet',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const filePath = path.join(tempDir, '.marketclaw', 'workspace', 'approvals.json');
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.requests).toHaveLength(1);
      expect(data.requests[0].content).toBe('Persisted tweet');
    });

    it('should emit approval:requested event', async () => {
      const handler = vi.fn();
      approvalManager.on('approval:requested', handler);

      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Event test',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      expect(handler).toHaveBeenCalledWith(request);
    });
  });

  describe('get', () => {
    it('should return approval by ID', async () => {
      const created = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Test content',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const found = approvalManager.get(created.id);
      expect(found).toEqual(created);
    });

    it('should return undefined for non-existent ID', () => {
      const found = approvalManager.get('approval_nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('listPending', () => {
    it('should return only pending approvals', async () => {
      const pending = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Pending tweet',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const approved = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'To be approved',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });
      await approvalManager.approve(approved.id, 'admin_1', 'Admin');

      const list = approvalManager.listPending();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(pending.id);
    });

    it('should filter by productId', async () => {
      await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Product A tweet',
        productId: 'product_a',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Product B tweet',
        productId: 'product_b',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const listA = approvalManager.listPending('product_a');
      expect(listA).toHaveLength(1);
      expect(listA[0].productId).toBe('product_a');
    });

    it('should exclude expired approvals', async () => {
      // Create an approval that's already expired
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Expired tweet',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      // Manually set expiresAt to the past
      request.expiresAt = new Date(Date.now() - 1000).toISOString();

      const pending = approvalManager.listPending();
      expect(pending.find(r => r.id === request.id)).toBeUndefined();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create various approvals for filtering
      const req1 = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Tweet 1',
        productId: 'product_a',
        requestedBy: 'user_1',
        requestedByName: 'User 1',
      });

      const req2 = await approvalManager.requestApproval({
        contentType: 'linkedin_post',
        content: 'LinkedIn 1',
        productId: 'product_b',
        requestedBy: 'user_2',
        requestedByName: 'User 2',
      });
      await approvalManager.approve(req2.id, 'admin', 'Admin');

      await approvalManager.requestApproval({
        contentType: 'email',
        content: 'Email 1',
        productId: 'product_a',
        requestedBy: 'user_1',
        requestedByName: 'User 1',
      });
    });

    it('should filter by status', () => {
      const approved = approvalManager.list({ status: 'approved' });
      expect(approved).toHaveLength(1);
      expect(approved[0].contentType).toBe('linkedin_post');
    });

    it('should filter by productId', () => {
      const productA = approvalManager.list({ productId: 'product_a' });
      expect(productA).toHaveLength(2);
    });

    it('should filter by requestedBy', () => {
      const user1 = approvalManager.list({ requestedBy: 'user_1' });
      expect(user1).toHaveLength(2);
    });

    it('should limit results', () => {
      const limited = approvalManager.list({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('should sort by most recent first', () => {
      const all = approvalManager.list();
      for (let i = 1; i < all.length; i++) {
        const prev = new Date(all[i - 1].requestedAt).getTime();
        const curr = new Date(all[i].requestedAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });
  });

  describe('approve', () => {
    it('should approve pending content', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Approve me',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const approved = await approvalManager.approve(request.id, 'admin_1', 'Admin User');

      expect(approved).toBeDefined();
      expect(approved!.status).toBe('approved');
      expect(approved!.resolvedBy).toBe('admin_1');
      expect(approved!.resolvedByName).toBe('Admin User');
      expect(approved!.resolvedAt).toBeDefined();
    });

    it('should return undefined for non-existent approval', async () => {
      const result = await approvalManager.approve('nonexistent', 'admin', 'Admin');
      expect(result).toBeUndefined();
    });

    it('should return unchanged request if already resolved', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Already approved',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      await approvalManager.approve(request.id, 'admin_1', 'Admin 1');
      const secondAttempt = await approvalManager.approve(request.id, 'admin_2', 'Admin 2');

      expect(secondAttempt!.resolvedBy).toBe('admin_1');
    });

    it('should emit approval:approved event', async () => {
      const handler = vi.fn();
      approvalManager.on('approval:approved', handler);

      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Event test',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const approved = await approvalManager.approve(request.id, 'admin', 'Admin');
      expect(handler).toHaveBeenCalledWith(approved);
    });
  });

  describe('reject', () => {
    it('should reject pending content', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Reject me',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const rejected = await approvalManager.reject(
        request.id,
        'admin_1',
        'Admin User',
        'Content needs revision'
      );

      expect(rejected).toBeDefined();
      expect(rejected!.status).toBe('rejected');
      expect(rejected!.resolvedBy).toBe('admin_1');
      expect(rejected!.resolvedByName).toBe('Admin User');
      expect(rejected!.rejectionReason).toBe('Content needs revision');
      expect(rejected!.resolvedAt).toBeDefined();
    });

    it('should reject without reason', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Reject without reason',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const rejected = await approvalManager.reject(request.id, 'admin_1', 'Admin User');

      expect(rejected!.status).toBe('rejected');
      expect(rejected!.rejectionReason).toBeUndefined();
    });

    it('should return undefined for non-existent approval', async () => {
      const result = await approvalManager.reject('nonexistent', 'admin', 'Admin');
      expect(result).toBeUndefined();
    });

    it('should return unchanged request if already resolved', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Already rejected',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      await approvalManager.reject(request.id, 'admin_1', 'Admin 1', 'First reason');
      const secondAttempt = await approvalManager.reject(
        request.id,
        'admin_2',
        'Admin 2',
        'Second reason'
      );

      expect(secondAttempt!.resolvedBy).toBe('admin_1');
      expect(secondAttempt!.rejectionReason).toBe('First reason');
    });

    it('should emit approval:rejected event', async () => {
      const handler = vi.fn();
      approvalManager.on('approval:rejected', handler);

      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Event test',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const rejected = await approvalManager.reject(request.id, 'admin', 'Admin', 'Reason');
      expect(handler).toHaveBeenCalledWith(rejected);
    });
  });

  describe('markPosted', () => {
    it('should mark approved content as posted', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Post me',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });
      await approvalManager.approve(request.id, 'admin', 'Admin');

      await approvalManager.markPosted(request.id, 'https://twitter.com/status/123');

      const updated = approvalManager.get(request.id);
      expect(updated!.postedAt).toBeDefined();
      expect(updated!.postResult).toBe('https://twitter.com/status/123');
    });

    it('should handle non-existent approval gracefully', async () => {
      // Should not throw
      await approvalManager.markPosted('nonexistent', 'result');
    });
  });

  describe('getApprovers', () => {
    it('should return members with approve_content permission', async () => {
      // Import the mock to set it up properly for this test
      const { teamManager } = await import('../team/index.js');
      (teamManager.listMembers as Mock).mockReturnValue([
        { id: 'user_admin', name: 'Admin', telegramId: 12345 },
        { id: 'user_viewer', name: 'Viewer', telegramId: 67890 },
      ]);
      (teamManager.hasPermission as Mock).mockImplementation((member) => {
        return member.id === 'user_admin';
      });

      const approvers = approvalManager.getApprovers();

      expect(approvers).toHaveLength(1);
      expect(approvers[0].id).toBe('user_admin');
      expect(approvers[0].name).toBe('Admin');
      expect(approvers[0].telegramId).toBe(12345);
    });

    it('should filter by productId', async () => {
      const { teamManager } = await import('../team/index.js');
      (teamManager.listMembers as Mock).mockReturnValue([
        { id: 'user_admin', name: 'Admin', telegramId: 12345 },
      ]);
      (teamManager.hasPermission as Mock).mockReturnValue(true);

      const approvers = approvalManager.getApprovers('product_abc');
      expect(approvers).toBeDefined();
      expect(teamManager.hasPermission).toHaveBeenCalledWith(
        expect.anything(),
        'approve_content',
        'product_abc'
      );
    });
  });

  describe('cleanupExpired', () => {
    it('should mark expired approvals as expired status', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Will expire',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      // Manually set expiresAt to the past
      request.expiresAt = new Date(Date.now() - 1000).toISOString();

      const cleaned = await approvalManager.cleanupExpired();
      
      expect(cleaned).toBe(1);
      const updated = approvalManager.get(request.id);
      expect(updated!.status).toBe('expired');
    });

    it('should not affect non-expired approvals', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Not expired',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
        expiresInHours: 24,
      });

      await approvalManager.cleanupExpired();

      const updated = approvalManager.get(request.id);
      expect(updated!.status).toBe('pending');
    });

    it('should not affect already resolved approvals', async () => {
      const request = await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Already approved',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });
      await approvalManager.approve(request.id, 'admin', 'Admin');

      // Set expired (shouldn't matter since already approved)
      request.expiresAt = new Date(Date.now() - 1000).toISOString();

      const cleaned = await approvalManager.cleanupExpired();
      
      expect(cleaned).toBe(0);
      const updated = approvalManager.get(request.id);
      expect(updated!.status).toBe('approved');
    });

    it('should return 0 when nothing to clean', async () => {
      await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'No expiry',
        requestedBy: 'user_123',
        requestedByName: 'Test User',
      });

      const cleaned = await approvalManager.cleanupExpired();
      expect(cleaned).toBe(0);
    });
  });

  describe('persistence', () => {
    it('should load existing approvals on init', async () => {
      // Create some approvals
      await approvalManager.requestApproval({
        contentType: 'tweet',
        content: 'Persisted 1',
        requestedBy: 'user_1',
        requestedByName: 'User 1',
      });
      await approvalManager.requestApproval({
        contentType: 'email',
        content: 'Persisted 2',
        requestedBy: 'user_2',
        requestedByName: 'User 2',
      });

      // Re-init (simulating restart)
      vi.resetModules();
      
      // Re-mock with same temp dir
      vi.doMock('os', async () => {
        const actual = await vi.importActual('os');
        return {
          ...actual,
          homedir: () => tempDir,
        };
      });
      
      const module = await import('./manager.js');
      const newManager = module.approvalManager;
      await newManager.init();

      const pending = newManager.listPending();
      expect(pending).toHaveLength(2);
    });
  });
});
