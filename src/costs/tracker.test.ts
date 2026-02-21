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
  });
});
