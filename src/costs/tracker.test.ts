/**
 * Cost Tracker Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CostTracker } from './tracker.js';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

describe('CostTracker', () => {
  let tracker: CostTracker;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'marketclaw-test-'));
    tracker = new CostTracker(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('log', () => {
    it('should log a cost record', async () => {
      const record = await tracker.log({
        tool: 'generate_image',
        cost: {
          usd: 0.02,
          provider: 'gemini',
          units: 1,
          unitType: 'images',
        },
        agent: 'Pixel',
        productId: 'testprod',
      });

      expect(record.id).toBeDefined();
      expect(record.tool).toBe('generate_image');
      expect(record.cost.usd).toBe(0.02);
      expect(record.agent).toBe('Pixel');
    });

    it('should persist records to file', async () => {
      await tracker.log({
        tool: 'send_email',
        cost: { usd: 0.001, provider: 'resend' },
      });

      const records = await tracker.query({});
      expect(records.length).toBe(1);
      expect(records[0].tool).toBe('send_email');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Log some test records
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        agent: 'Pixel',
      });
      await tracker.log({
        tool: 'send_email',
        cost: { usd: 0.001, provider: 'resend' },
        agent: 'Emma',
      });
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        agent: 'Pixel',
        productId: 'prod1',
      });
    });

    it('should return all records without filters', async () => {
      const records = await tracker.query({});
      expect(records.length).toBe(3);
    });

    it('should filter by tool', async () => {
      const records = await tracker.query({ tool: 'generate_image' });
      expect(records.length).toBe(2);
    });

    it('should filter by agent', async () => {
      const records = await tracker.query({ agent: 'Pixel' });
      expect(records.length).toBe(2);
    });

    it('should filter by productId', async () => {
      const records = await tracker.query({ productId: 'prod1' });
      expect(records.length).toBe(1);
    });

    it('should filter by provider', async () => {
      const records = await tracker.query({ provider: 'resend' });
      expect(records.length).toBe(1);
    });

    it('should respect limit', async () => {
      const records = await tracker.query({ limit: 2 });
      expect(records.length).toBe(2);
    });
  });

  describe('summarize', () => {
    beforeEach(async () => {
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        agent: 'Pixel',
      });
      await tracker.log({
        tool: 'send_email',
        cost: { usd: 0.005, provider: 'resend' },
        agent: 'Emma',
      });
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        agent: 'Pixel',
      });
    });

    it('should calculate total USD', async () => {
      const summary = await tracker.summarize({});
      expect(summary.totalUsd).toBe(0.045);
      expect(summary.count).toBe(3);
    });

    it('should breakdown by tool', async () => {
      const summary = await tracker.summarize({});
      expect(summary.byTool!['generate_image']).toBe(0.04);
      expect(summary.byTool!['send_email']).toBe(0.005);
    });

    it('should breakdown by agent', async () => {
      const summary = await tracker.summarize({});
      expect(summary.byAgent!['Pixel']).toBe(0.04);
      expect(summary.byAgent!['Emma']).toBe(0.005);
    });

    it('should breakdown by provider', async () => {
      const summary = await tracker.summarize({});
      expect(summary.byProvider!['gemini']).toBe(0.04);
      expect(summary.byProvider!['resend']).toBe(0.005);
    });
  });

  describe('budgets', () => {
    it('should create a budget', async () => {
      const budget = await tracker.setBudget({
        name: 'Test Budget',
        scope: 'global',
        period: 'monthly',
        limitUsd: 100,
        action: 'warn',
        enabled: true,
      });

      expect(budget.id).toBeDefined();
      expect(budget.name).toBe('Test Budget');
      expect(budget.limitUsd).toBe(100);
    });

    it('should list budgets', async () => {
      await tracker.setBudget({
        name: 'Budget 1',
        scope: 'global',
        period: 'monthly',
        limitUsd: 100,
        action: 'warn',
        enabled: true,
      });
      await tracker.setBudget({
        name: 'Budget 2',
        scope: 'product',
        scopeId: 'prod1',
        period: 'daily',
        limitUsd: 10,
        action: 'block',
        enabled: true,
      });

      const budgets = await tracker.getBudgets();
      expect(budgets.length).toBe(2);
    });

    it('should update existing budget', async () => {
      const budget = await tracker.setBudget({
        name: 'Test Budget',
        scope: 'global',
        period: 'monthly',
        limitUsd: 100,
        action: 'warn',
        enabled: true,
      });

      const updated = await tracker.setBudget({
        id: budget.id,
        name: 'Updated Budget',
        scope: 'global',
        period: 'monthly',
        limitUsd: 200,
        action: 'block',
        enabled: true,
      });

      expect(updated.id).toBe(budget.id);
      expect(updated.name).toBe('Updated Budget');
      expect(updated.limitUsd).toBe(200);
    });

    it('should delete budget', async () => {
      const budget = await tracker.setBudget({
        name: 'Test Budget',
        scope: 'global',
        period: 'monthly',
        limitUsd: 100,
        action: 'warn',
        enabled: true,
      });

      const deleted = await tracker.deleteBudget(budget.id);
      expect(deleted).toBe(true);

      const budgets = await tracker.getBudgets();
      expect(budgets.length).toBe(0);
    });

    it('should check budget status', async () => {
      const budget = await tracker.setBudget({
        name: 'Daily Budget',
        scope: 'global',
        period: 'daily',
        limitUsd: 1,
        action: 'warn',
        enabled: true,
      });

      // Log some costs
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.5, provider: 'gemini' },
      });

      const status = await tracker.checkBudget(budget);
      expect(status.spent).toBe(0.5);
      expect(status.remaining).toBe(0.5);
      expect(status.percentUsed).toBe(50);
      expect(status.isExceeded).toBe(false);
    });

    it('should block when budget exceeded', async () => {
      await tracker.setBudget({
        name: 'Low Budget',
        scope: 'global',
        period: 'daily',
        limitUsd: 0.01,
        action: 'block',
        enabled: true,
      });

      // Log costs exceeding budget
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
      });

      const check = await tracker.shouldBlock({ tool: 'generate_image' });
      expect(check.blocked).toBe(true);
      expect(check.reason).toContain('exceeded');
    });

    it('should not block when budget not exceeded', async () => {
      await tracker.setBudget({
        name: 'High Budget',
        scope: 'global',
        period: 'daily',
        limitUsd: 100,
        action: 'block',
        enabled: true,
      });

      const check = await tracker.shouldBlock({ tool: 'generate_image' });
      expect(check.blocked).toBe(false);
    });

    it('should not delete budget if not found', async () => {
      const deleted = await tracker.deleteBudget('nonexistent-budget-id');
      expect(deleted).toBe(false);
    });

    it('should check budget for weekly period', async () => {
      const budget = await tracker.setBudget({
        name: 'Weekly Budget',
        scope: 'global',
        period: 'weekly',
        limitUsd: 50,
        action: 'warn',
        enabled: true,
      });

      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 10, provider: 'gemini' },
      });

      const status = await tracker.checkBudget(budget);
      expect(status.spent).toBe(10);
      expect(status.remaining).toBe(40);
      expect(status.percentUsed).toBe(20);
    });

    it('should block for product-scoped budget', async () => {
      await tracker.setBudget({
        name: 'Product Budget',
        scope: 'product',
        scopeId: 'prod1',
        period: 'daily',
        limitUsd: 0.01,
        action: 'block',
        enabled: true,
      });

      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        productId: 'prod1',
      });

      const check = await tracker.shouldBlock({ tool: 'generate_image', productId: 'prod1' });
      expect(check.blocked).toBe(true);
    });

    it('should block for agent-scoped budget', async () => {
      await tracker.setBudget({
        name: 'Agent Budget',
        scope: 'agent',
        scopeId: 'Pixel',
        period: 'daily',
        limitUsd: 0.01,
        action: 'block',
        enabled: true,
      });

      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        agent: 'Pixel',
      });

      const check = await tracker.shouldBlock({ tool: 'generate_image', agent: 'Pixel' });
      expect(check.blocked).toBe(true);
    });

    it('should block for user-scoped budget', async () => {
      await tracker.setBudget({
        name: 'User Budget',
        scope: 'user',
        scopeId: 'user123',
        period: 'daily',
        limitUsd: 0.01,
        action: 'block',
        enabled: true,
      });

      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        userId: 'user123',
      });

      const check = await tracker.shouldBlock({ tool: 'generate_image', userId: 'user123' });
      expect(check.blocked).toBe(true);
    });

    it('should not block when action is warn only', async () => {
      await tracker.setBudget({
        name: 'Warn Only Budget',
        scope: 'global',
        period: 'daily',
        limitUsd: 0.01,
        action: 'warn',  // Not block
        enabled: true,
      });

      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
      });

      const check = await tracker.shouldBlock({ tool: 'generate_image' });
      expect(check.blocked).toBe(false);
    });

    it('should not block when budget is disabled', async () => {
      await tracker.setBudget({
        name: 'Disabled Budget',
        scope: 'global',
        period: 'daily',
        limitUsd: 0.01,
        action: 'block',
        enabled: false,  // Disabled
      });

      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
      });

      const check = await tracker.shouldBlock({ tool: 'generate_image' });
      expect(check.blocked).toBe(false);
    });
  });

  describe('groupByTime', () => {
    it('should group costs by day', async () => {
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.01, provider: 'gemini' },
      });
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
      });

      const grouped = await tracker.groupByTime({ groupBy: 'day' });
      const today = new Date().toISOString().split('T')[0];
      expect(grouped[today]).toBe(0.03);
    });

    it('should group costs by hour', async () => {
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.01, provider: 'gemini' },
      });
      await tracker.log({
        tool: 'send_email',
        cost: { usd: 0.005, provider: 'resend' },
      });

      const grouped = await tracker.groupByTime({ groupBy: 'hour' });
      // Should have entries grouped by hour
      const keys = Object.keys(grouped);
      expect(keys.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('checkAllBudgets', () => {
    it('should return budgets at or above warning threshold', async () => {
      await tracker.setBudget({
        name: 'Budget Near Limit',
        scope: 'global',
        period: 'daily',
        limitUsd: 0.01,
        action: 'warn',
        enabled: true,
      });

      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.009, provider: 'gemini' }, // 90% of limit
      });

      const alerts = await tracker.checkAllBudgets(80);
      expect(alerts.length).toBe(1);
      expect(alerts[0].percentUsed).toBeGreaterThanOrEqual(80);
    });

    it('should skip disabled budgets', async () => {
      await tracker.setBudget({
        name: 'Disabled Budget',
        scope: 'global',
        period: 'daily',
        limitUsd: 0.001,
        action: 'warn',
        enabled: false,
      });

      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.01, provider: 'gemini' },
      });

      const alerts = await tracker.checkAllBudgets(50);
      expect(alerts.length).toBe(0);
    });

    it('should not return budgets below threshold', async () => {
      await tracker.setBudget({
        name: 'High Limit Budget',
        scope: 'global',
        period: 'daily',
        limitUsd: 100,
        action: 'warn',
        enabled: true,
      });

      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.01, provider: 'gemini' },
      });

      const alerts = await tracker.checkAllBudgets(80);
      expect(alerts.length).toBe(0);
    });
  });

  describe('parseDateRange', () => {
    it('should handle "yesterday" date range', async () => {
      // Log a cost (will be today)
      await tracker.log({
        tool: 'test',
        cost: { usd: 0.01, provider: 'test' },
      });

      // Query for yesterday - should not find today's record
      const records = await tracker.query({ from: 'yesterday' });
      // The record is today, so querying yesterday should not include it
      expect(records.length).toBe(0);
    });

    it('should handle "today" date range', async () => {
      await tracker.log({
        tool: 'test',
        cost: { usd: 0.01, provider: 'test' },
      });

      const records = await tracker.query({ from: 'today' });
      expect(records.length).toBe(1);
    });

    it('should handle "this-week" date range', async () => {
      await tracker.log({
        tool: 'test',
        cost: { usd: 0.01, provider: 'test' },
      });

      const records = await tracker.query({ from: 'this-week' });
      expect(records.length).toBe(1);
    });

    it('should handle "this-month" date range', async () => {
      await tracker.log({
        tool: 'test',
        cost: { usd: 0.01, provider: 'test' },
      });

      const records = await tracker.query({ from: 'this-month' });
      expect(records.length).toBe(1);
    });

    it('should handle custom ISO date range', async () => {
      await tracker.log({
        tool: 'test',
        cost: { usd: 0.01, provider: 'test' },
      });

      const now = new Date();
      const from = new Date(now.getTime() - 86400000).toISOString(); // Yesterday
      const to = new Date(now.getTime() + 86400000).toISOString(); // Tomorrow

      const records = await tracker.query({ from, to });
      expect(records.length).toBe(1);
    });
  });

  describe('query filters', () => {
    it('should filter by campaignId', async () => {
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.01, provider: 'gemini' },
        campaignId: 'campaign1',
      });
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        campaignId: 'campaign2',
      });

      const records = await tracker.query({ campaignId: 'campaign1' });
      expect(records.length).toBe(1);
      expect(records[0].campaignId).toBe('campaign1');
    });

    it('should filter by userId', async () => {
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.01, provider: 'gemini' },
        userId: 'user1',
      });
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        userId: 'user2',
      });

      const records = await tracker.query({ userId: 'user1' });
      expect(records.length).toBe(1);
      expect(records[0].userId).toBe('user1');
    });
  });

  describe('summarize aggregations', () => {
    it('should aggregate by product', async () => {
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.01, provider: 'gemini' },
        productId: 'prod1',
      });
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        productId: 'prod1',
      });
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.03, provider: 'gemini' },
        productId: 'prod2',
      });

      const summary = await tracker.summarize({});
      expect(summary.byProduct!['prod1']).toBe(0.03);
      expect(summary.byProduct!['prod2']).toBe(0.03);
    });

    it('should aggregate by campaign', async () => {
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.01, provider: 'gemini' },
        campaignId: 'camp1',
      });
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        campaignId: 'camp1',
      });

      const summary = await tracker.summarize({});
      expect(summary.byCampaign!['camp1']).toBe(0.03);
    });

    it('should aggregate by user', async () => {
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.01, provider: 'gemini' },
        userId: 'user1',
      });
      await tracker.log({
        tool: 'generate_image',
        cost: { usd: 0.02, provider: 'gemini' },
        userId: 'user2',
      });

      const summary = await tracker.summarize({});
      expect(summary.byUser!['user1']).toBe(0.01);
      expect(summary.byUser!['user2']).toBe(0.02);
    });
  });
});
