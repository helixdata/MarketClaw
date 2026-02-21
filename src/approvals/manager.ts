/**
 * Approval Manager
 * Handles content approval workflow
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { ApprovalRequest, ApprovalStatus, ContentType } from './types.js';
import { teamManager } from '../team/index.js';
import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ name: 'approvals' });

const WORKSPACE = path.join(homedir(), '.marketclaw', 'workspace');
const APPROVALS_FILE = path.join(WORKSPACE, 'approvals.json');

function generateId(): string {
  return `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface ApprovalsData {
  requests: ApprovalRequest[];
}

class ApprovalManager extends EventEmitter {
  private data: ApprovalsData = { requests: [] };

  /**
   * Initialize
   */
  async init(): Promise<void> {
    await mkdir(WORKSPACE, { recursive: true });

    if (existsSync(APPROVALS_FILE)) {
      const content = await readFile(APPROVALS_FILE, 'utf-8');
      this.data = JSON.parse(content);
      logger.info({ pending: this.listPending().length }, 'Approvals loaded');
    }
  }

  /**
   * Save to disk
   */
  private async save(): Promise<void> {
    await writeFile(APPROVALS_FILE, JSON.stringify(this.data, null, 2));
  }

  /**
   * Request approval for content
   */
  async requestApproval(opts: {
    contentType: ContentType;
    content: string;
    metadata?: Record<string, unknown>;
    productId?: string;
    campaignId?: string;
    requestedBy: string;         // Member ID
    requestedByName: string;
    expiresInHours?: number;
  }): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: generateId(),
      contentType: opts.contentType,
      content: opts.content,
      metadata: opts.metadata,
      productId: opts.productId,
      campaignId: opts.campaignId,
      requestedBy: opts.requestedBy,
      requestedByName: opts.requestedByName,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      expiresAt: opts.expiresInHours 
        ? new Date(Date.now() + opts.expiresInHours * 60 * 60 * 1000).toISOString()
        : undefined,
    };

    this.data.requests.push(request);
    await this.save();

    logger.info({ approvalId: request.id, type: opts.contentType }, 'Approval requested');

    // Emit event for notification
    this.emit('approval:requested', request);

    return request;
  }

  /**
   * Get approval by ID
   */
  get(id: string): ApprovalRequest | undefined {
    return this.data.requests.find(r => r.id === id);
  }

  /**
   * List pending approvals
   */
  listPending(productId?: string): ApprovalRequest[] {
    const now = new Date();
    return this.data.requests.filter(r => {
      if (r.status !== 'pending') return false;
      if (r.expiresAt && new Date(r.expiresAt) < now) return false;
      if (productId && r.productId !== productId) return false;
      return true;
    });
  }

  /**
   * List all approvals with optional filters
   */
  list(opts?: { 
    status?: ApprovalStatus; 
    productId?: string;
    requestedBy?: string;
    limit?: number;
  }): ApprovalRequest[] {
    let results = [...this.data.requests];

    if (opts?.status) {
      results = results.filter(r => r.status === opts.status);
    }
    if (opts?.productId) {
      results = results.filter(r => r.productId === opts.productId);
    }
    if (opts?.requestedBy) {
      results = results.filter(r => r.requestedBy === opts.requestedBy);
    }

    // Sort by most recent first
    results.sort((a, b) => 
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );

    if (opts?.limit) {
      results = results.slice(0, opts.limit);
    }

    return results;
  }

  /**
   * Approve content
   */
  async approve(id: string, approvedBy: string, approvedByName: string): Promise<ApprovalRequest | undefined> {
    const request = this.get(id);
    if (!request) return undefined;
    if (request.status !== 'pending') return request;

    request.status = 'approved';
    request.resolvedBy = approvedBy;
    request.resolvedByName = approvedByName;
    request.resolvedAt = new Date().toISOString();

    await this.save();

    logger.info({ approvalId: id, approvedBy: approvedByName }, 'Content approved');

    this.emit('approval:approved', request);

    return request;
  }

  /**
   * Reject content
   */
  async reject(id: string, rejectedBy: string, rejectedByName: string, reason?: string): Promise<ApprovalRequest | undefined> {
    const request = this.get(id);
    if (!request) return undefined;
    if (request.status !== 'pending') return request;

    request.status = 'rejected';
    request.resolvedBy = rejectedBy;
    request.resolvedByName = rejectedByName;
    request.resolvedAt = new Date().toISOString();
    request.rejectionReason = reason;

    await this.save();

    logger.info({ approvalId: id, rejectedBy: rejectedByName, reason }, 'Content rejected');

    this.emit('approval:rejected', request);

    return request;
  }

  /**
   * Mark as posted
   */
  async markPosted(id: string, result?: string): Promise<void> {
    const request = this.get(id);
    if (!request) return;

    request.postedAt = new Date().toISOString();
    request.postResult = result;
    await this.save();
  }

  /**
   * Get approvers for a product
   */
  getApprovers(productId?: string): Array<{ id: string; name: string; telegramId?: number }> {
    const members = teamManager.listMembers();
    
    return members
      .filter(m => teamManager.hasPermission(m, 'approve_content', productId))
      .map(m => ({
        id: m.id,
        name: m.name,
        telegramId: m.telegramId,
      }));
  }

  /**
   * Clean up expired requests
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const request of this.data.requests) {
      if (request.status === 'pending' && request.expiresAt && new Date(request.expiresAt) < now) {
        request.status = 'expired';
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.save();
      logger.info({ cleaned }, 'Expired approvals cleaned up');
    }

    return cleaned;
  }
}

export const approvalManager = new ApprovalManager();
