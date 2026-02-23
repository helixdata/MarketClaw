/**
 * Cost Tools Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCostsTool,
  getCostSummaryTool,
  getCostTrendTool,
  setBudgetTool,
  listBudgetsTool,
  deleteBudgetTool,
  checkBudgetsTool,
} from './tools.js';
import { costTracker } from './tracker.js';
import type { CostRecord, Budget, BudgetStatus, CostSummary } from './types.js';

// Mock the costTracker
vi.mock('./tracker.js', () => ({
  costTracker: {
    query: vi.fn(),
    summarize: vi.fn(),
    groupByTime: vi.fn(),
    setBudget: vi.fn(),
    getBudgets: vi.fn(),
    deleteBudget: vi.fn(),
    checkBudget: vi.fn(),
    checkAllBudgets: vi.fn(),
  },
}));

const mockTracker = vi.mocked(costTracker);

describe('getCostsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(getCostsTool.name).toBe('get_costs');
    expect(getCostsTool.description).toContain('Query cost records');
  });

  it('should return empty result when no records found', async () => {
    mockTracker.query.mockResolvedValue([]);

    const result = await getCostsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('No cost records found');
    expect(result.data).toEqual([]);
  });

  it('should return records with total', async () => {
    const mockRecords: CostRecord[] = [
      {
        id: 'rec1',
        timestamp: '2024-01-15T10:00:00Z',
        ts: Date.now(),
        tool: 'generate_image',
        agent: 'Pixel',
        productId: 'prod1',
        cost: { usd: 0.02, provider: 'gemini', units: 1, unitType: 'images' },
      },
      {
        id: 'rec2',
        timestamp: '2024-01-15T11:00:00Z',
        ts: Date.now(),
        tool: 'send_email',
        cost: { usd: 0.001, provider: 'resend', units: 1, unitType: 'emails' },
      },
    ];
    mockTracker.query.mockResolvedValue(mockRecords);

    const result = await getCostsTool.execute({ from: 'today' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('2 cost record(s)');
    expect(result.message).toContain('$0.0210');
    expect(result.data.totalUsd).toBe(0.021);
    expect(result.data.count).toBe(2);
    expect(result.data.records).toHaveLength(2);
  });

  it('should pass query parameters correctly', async () => {
    mockTracker.query.mockResolvedValue([]);

    await getCostsTool.execute({
      from: 'this-week',
      to: '2024-01-20',
      tool: 'generate_image',
      agent: 'Pixel',
      productId: 'prod1',
      userId: 'user1',
      provider: 'gemini',
      limit: 50,
    });

    expect(mockTracker.query).toHaveBeenCalledWith({
      from: 'this-week',
      to: '2024-01-20',
      tool: 'generate_image',
      agent: 'Pixel',
      productId: 'prod1',
      userId: 'user1',
      provider: 'gemini',
      limit: 50,
    });
  });

  it('should use default limit of 100', async () => {
    mockTracker.query.mockResolvedValue([]);

    await getCostsTool.execute({});

    expect(mockTracker.query).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
  });

  it('should handle errors gracefully', async () => {
    mockTracker.query.mockRejectedValue(new Error('Database error'));

    const result = await getCostsTool.execute({});

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to query costs');
    expect(result.message).toContain('Database error');
  });
});

describe('getCostSummaryTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(getCostSummaryTool.name).toBe('get_cost_summary');
    expect(getCostSummaryTool.description).toContain('aggregated cost summary');
  });

  it('should return empty summary message when no costs', async () => {
    const mockSummary: CostSummary = {
      totalUsd: 0,
      count: 0,
      byTool: {},
      byAgent: {},
      byProvider: {},
      byProduct: {},
      from: '2024-01-01',
      to: '2024-01-31',
    };
    mockTracker.summarize.mockResolvedValue(mockSummary);

    const result = await getCostSummaryTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('No costs recorded');
  });

  it('should return formatted summary with breakdowns', async () => {
    const mockSummary: CostSummary = {
      totalUsd: 0.045,
      count: 3,
      byTool: { generate_image: 0.04, send_email: 0.005 },
      byAgent: { Pixel: 0.04, Emma: 0.005 },
      byProvider: { gemini: 0.04, resend: 0.005 },
      byProduct: { prod1: 0.02 },
      from: '2024-01-01',
      to: '2024-01-31',
    };
    mockTracker.summarize.mockResolvedValue(mockSummary);

    const result = await getCostSummaryTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('💰 Total: $0.0450');
    expect(result.message).toContain('3 operations');
    expect(result.message).toContain('By Tool:');
    expect(result.message).toContain('By Agent:');
    expect(result.message).toContain('By Provider:');
    expect(result.message).toContain('By Product:');
    expect(result.data).toEqual(mockSummary);
  });

  it('should include byUser breakdown when present', async () => {
    const mockSummary: CostSummary = {
      totalUsd: 0.03,
      count: 2,
      byTool: { generate_image: 0.03 },
      byUser: { user1: 0.02, user2: 0.01 },
      from: '2024-01-01',
      to: '2024-01-31',
    };
    mockTracker.summarize.mockResolvedValue(mockSummary);

    const result = await getCostSummaryTool.execute({});

    expect(result.success).toBe(true);
    expect(result.data.byUser).toEqual({ user1: 0.02, user2: 0.01 });
  });

  it('should handle summary with empty breakdowns', async () => {
    const mockSummary: CostSummary = {
      totalUsd: 0.01,
      count: 1,
      byTool: {},
      byAgent: {},
      byProvider: {},
      byProduct: {},
      from: '2024-01-01',
      to: '2024-01-31',
    };
    mockTracker.summarize.mockResolvedValue(mockSummary);

    const result = await getCostSummaryTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('💰 Total: $0.0100');
    // Should not include breakdown sections when empty
    expect(result.message).not.toContain('By Tool:');
  });

  it('should pass filters to summarize', async () => {
    mockTracker.summarize.mockResolvedValue({
      totalUsd: 0,
      count: 0,
      from: '2024-01-01',
      to: '2024-01-31',
    });

    await getCostSummaryTool.execute({
      from: 'this-month',
      to: '2024-01-31',
      productId: 'prod1',
      agent: 'Pixel',
    });

    expect(mockTracker.summarize).toHaveBeenCalledWith({
      from: 'this-month',
      to: '2024-01-31',
      productId: 'prod1',
      agent: 'Pixel',
    });
  });

  it('should handle errors gracefully', async () => {
    mockTracker.summarize.mockRejectedValue(new Error('Summarize failed'));

    const result = await getCostSummaryTool.execute({});

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to get cost summary');
    expect(result.message).toContain('Summarize failed');
  });
});

describe('getCostTrendTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(getCostTrendTool.name).toBe('get_cost_trend');
    expect(getCostTrendTool.description).toContain('spending trends');
  });

  it('should return empty result when no data', async () => {
    mockTracker.groupByTime.mockResolvedValue({});

    const result = await getCostTrendTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('No cost data');
    expect(result.data).toEqual({});
  });

  it('should return grouped costs by day', async () => {
    const mockGrouped = {
      '2024-01-13': 0.01,
      '2024-01-14': 0.02,
      '2024-01-15': 0.015,
    };
    mockTracker.groupByTime.mockResolvedValue(mockGrouped);

    const result = await getCostTrendTool.execute({ groupBy: 'day' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('📈 Cost trend');
    expect(result.message).toContain('3 periods');
    expect(result.message).toContain('$0.0450');
    expect(result.data).toEqual(mockGrouped);
  });

  it('should default to groupBy day', async () => {
    mockTracker.groupByTime.mockResolvedValue({});

    await getCostTrendTool.execute({});

    expect(mockTracker.groupByTime).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: 'day' })
    );
  });

  it('should pass all parameters correctly', async () => {
    mockTracker.groupByTime.mockResolvedValue({});

    await getCostTrendTool.execute({
      from: 'this-week',
      to: '2024-01-20',
      groupBy: 'hour',
      productId: 'prod1',
    });

    expect(mockTracker.groupByTime).toHaveBeenCalledWith({
      from: 'this-week',
      to: '2024-01-20',
      groupBy: 'hour',
      productId: 'prod1',
    });
  });

  it('should handle errors gracefully', async () => {
    mockTracker.groupByTime.mockRejectedValue(new Error('Group failed'));

    const result = await getCostTrendTool.execute({});

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to get cost trend');
    expect(result.message).toContain('Group failed');
  });
});

describe('setBudgetTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(setBudgetTool.name).toBe('set_budget');
    expect(setBudgetTool.description).toContain('Create or update');
    expect(setBudgetTool.parameters.required).toContain('name');
    expect(setBudgetTool.parameters.required).toContain('scope');
    expect(setBudgetTool.parameters.required).toContain('period');
    expect(setBudgetTool.parameters.required).toContain('limitUsd');
  });

  it('should create a new global budget', async () => {
    const mockBudget: Budget = {
      id: 'budget-123',
      name: 'Monthly Global',
      scope: 'global',
      period: 'monthly',
      limitUsd: 100,
      action: 'warn',
      enabled: true,
      createdAt: Date.now(),
    };
    mockTracker.setBudget.mockResolvedValue(mockBudget);

    const result = await setBudgetTool.execute({
      name: 'Monthly Global',
      scope: 'global',
      period: 'monthly',
      limitUsd: 100,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('✅ Budget "Monthly Global" created');
    expect(result.message).toContain('$100/monthly');
    expect(result.message).toContain('global');
    expect(result.data).toEqual(mockBudget);
  });

  it('should update existing budget', async () => {
    const mockBudget: Budget = {
      id: 'budget-123',
      name: 'Updated Budget',
      scope: 'global',
      period: 'monthly',
      limitUsd: 200,
      action: 'block',
      enabled: true,
      createdAt: Date.now(),
    };
    mockTracker.setBudget.mockResolvedValue(mockBudget);

    const result = await setBudgetTool.execute({
      id: 'budget-123',
      name: 'Updated Budget',
      scope: 'global',
      period: 'monthly',
      limitUsd: 200,
      action: 'block',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('updated');
  });

  it('should require scopeId for non-global scopes', async () => {
    const result = await setBudgetTool.execute({
      name: 'Product Budget',
      scope: 'product',
      period: 'daily',
      limitUsd: 10,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('scopeId is required');
    expect(mockTracker.setBudget).not.toHaveBeenCalled();
  });

  it('should accept scopeId for product scope', async () => {
    const mockBudget: Budget = {
      id: 'budget-456',
      name: 'Product Budget',
      scope: 'product',
      scopeId: 'prod1',
      period: 'daily',
      limitUsd: 10,
      action: 'warn',
      enabled: true,
      createdAt: Date.now(),
    };
    mockTracker.setBudget.mockResolvedValue(mockBudget);

    const result = await setBudgetTool.execute({
      name: 'Product Budget',
      scope: 'product',
      scopeId: 'prod1',
      period: 'daily',
      limitUsd: 10,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('product: prod1');
  });

  it('should use default action and enabled values', async () => {
    const mockBudget: Budget = {
      id: 'budget-789',
      name: 'Test',
      scope: 'global',
      period: 'daily',
      limitUsd: 50,
      action: 'warn',
      enabled: true,
      createdAt: Date.now(),
    };
    mockTracker.setBudget.mockResolvedValue(mockBudget);

    await setBudgetTool.execute({
      name: 'Test',
      scope: 'global',
      period: 'daily',
      limitUsd: 50,
    });

    expect(mockTracker.setBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'warn',
        enabled: true,
      })
    );
  });

  it('should handle errors gracefully', async () => {
    mockTracker.setBudget.mockRejectedValue(new Error('Budget save failed'));

    const result = await setBudgetTool.execute({
      name: 'Test',
      scope: 'global',
      period: 'daily',
      limitUsd: 50,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to set budget');
    expect(result.message).toContain('Budget save failed');
  });
});

describe('listBudgetsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(listBudgetsTool.name).toBe('list_budgets');
    expect(listBudgetsTool.description).toContain('List all configured budgets');
  });

  it('should return empty message when no budgets', async () => {
    mockTracker.getBudgets.mockResolvedValue([]);

    const result = await listBudgetsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('No budgets configured');
    expect(result.data).toEqual([]);
  });

  it('should list budgets with status by default', async () => {
    const mockBudgets: Budget[] = [
      {
        id: 'budget-1',
        name: 'Global Budget',
        scope: 'global',
        period: 'monthly',
        limitUsd: 100,
        action: 'warn',
        enabled: true,
        createdAt: Date.now(),
      },
    ];
    const mockStatus: BudgetStatus = {
      budget: mockBudgets[0],
      spent: 25,
      remaining: 75,
      percentUsed: 25,
      isExceeded: false,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
    };
    mockTracker.getBudgets.mockResolvedValue(mockBudgets);
    mockTracker.checkBudget.mockResolvedValue(mockStatus);

    const result = await listBudgetsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('1 budget(s)');
    expect(result.data[0].status.spent).toBe(25);
    expect(result.data[0].status.percentUsed).toBe(25);
    expect(mockTracker.checkBudget).toHaveBeenCalledWith(mockBudgets[0]);
  });

  it('should skip status when includeStatus is false', async () => {
    const mockBudgets: Budget[] = [
      {
        id: 'budget-1',
        name: 'Test Budget',
        scope: 'global',
        period: 'daily',
        limitUsd: 50,
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      },
    ];
    mockTracker.getBudgets.mockResolvedValue(mockBudgets);

    const result = await listBudgetsTool.execute({ includeStatus: false });

    expect(result.success).toBe(true);
    expect(mockTracker.checkBudget).not.toHaveBeenCalled();
    expect(result.data[0].status).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    mockTracker.getBudgets.mockRejectedValue(new Error('List failed'));

    const result = await listBudgetsTool.execute({});

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to list budgets');
    expect(result.message).toContain('List failed');
  });
});

describe('deleteBudgetTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(deleteBudgetTool.name).toBe('delete_budget');
    expect(deleteBudgetTool.description).toContain('Delete a budget');
    expect(deleteBudgetTool.parameters.required).toContain('id');
  });

  it('should delete budget successfully', async () => {
    mockTracker.deleteBudget.mockResolvedValue(true);

    const result = await deleteBudgetTool.execute({ id: 'budget-123' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('🗑️ Budget deleted');
    expect(result.message).toContain('budget-123');
    expect(mockTracker.deleteBudget).toHaveBeenCalledWith('budget-123');
  });

  it('should return error when budget not found', async () => {
    mockTracker.deleteBudget.mockResolvedValue(false);

    const result = await deleteBudgetTool.execute({ id: 'nonexistent' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Budget not found');
    expect(result.message).toContain('nonexistent');
  });

  it('should handle errors gracefully', async () => {
    mockTracker.deleteBudget.mockRejectedValue(new Error('Delete failed'));

    const result = await deleteBudgetTool.execute({ id: 'budget-123' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to delete budget');
    expect(result.message).toContain('Delete failed');
  });
});

describe('checkBudgetsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(checkBudgetsTool.name).toBe('check_budgets');
    expect(checkBudgetsTool.description).toContain('Check all budgets');
  });

  it('should return all clear when no alerts', async () => {
    mockTracker.checkAllBudgets.mockResolvedValue([]);

    const result = await checkBudgetsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('✅ All budgets are within limits');
    expect(result.message).toContain('80%');
    expect(result.data).toEqual([]);
  });

  it('should use custom warning threshold', async () => {
    mockTracker.checkAllBudgets.mockResolvedValue([]);

    const result = await checkBudgetsTool.execute({ warningThreshold: 90 });

    expect(mockTracker.checkAllBudgets).toHaveBeenCalledWith(90);
    expect(result.message).toContain('90%');
  });

  it('should return warning alerts', async () => {
    const mockAlerts: BudgetStatus[] = [
      {
        budget: {
          id: 'budget-1',
          name: 'Daily Budget',
          scope: 'global',
          period: 'daily',
          limitUsd: 10,
          action: 'warn',
          enabled: true,
          createdAt: Date.now(),
        },
        spent: 8.5,
        remaining: 1.5,
        percentUsed: 85,
        isExceeded: false,
        periodStart: '2024-01-15',
        periodEnd: '2024-01-15',
      },
    ];
    mockTracker.checkAllBudgets.mockResolvedValue(mockAlerts);

    const result = await checkBudgetsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('⚠️ Daily Budget');
    expect(result.message).toContain('85.0% used');
    expect(result.message).toContain('$8.50 / $10.00');
    expect(result.data).toEqual(mockAlerts);
  });

  it('should return exceeded alerts with different icon', async () => {
    const mockAlerts: BudgetStatus[] = [
      {
        budget: {
          id: 'budget-1',
          name: 'Exceeded Budget',
          scope: 'global',
          period: 'daily',
          limitUsd: 5,
          action: 'block',
          enabled: true,
          createdAt: Date.now(),
        },
        spent: 7.25,
        remaining: -2.25,
        percentUsed: 145,
        isExceeded: true,
        periodStart: '2024-01-15',
        periodEnd: '2024-01-15',
      },
    ];
    mockTracker.checkAllBudgets.mockResolvedValue(mockAlerts);

    const result = await checkBudgetsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('🚨 Exceeded Budget');
    expect(result.message).toContain('145.0% used');
  });

  it('should handle multiple alerts', async () => {
    const mockAlerts: BudgetStatus[] = [
      {
        budget: {
          id: 'budget-1',
          name: 'Budget A',
          scope: 'global',
          period: 'daily',
          limitUsd: 10,
          action: 'warn',
          enabled: true,
          createdAt: Date.now(),
        },
        spent: 8,
        remaining: 2,
        percentUsed: 80,
        isExceeded: false,
        periodStart: '2024-01-15',
        periodEnd: '2024-01-15',
      },
      {
        budget: {
          id: 'budget-2',
          name: 'Budget B',
          scope: 'product',
          scopeId: 'prod1',
          period: 'daily',
          limitUsd: 5,
          action: 'block',
          enabled: true,
          createdAt: Date.now(),
        },
        spent: 6,
        remaining: -1,
        percentUsed: 120,
        isExceeded: true,
        periodStart: '2024-01-15',
        periodEnd: '2024-01-15',
      },
    ];
    mockTracker.checkAllBudgets.mockResolvedValue(mockAlerts);

    const result = await checkBudgetsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('Budget A');
    expect(result.message).toContain('Budget B');
    expect(result.data).toHaveLength(2);
  });

  it('should handle errors gracefully', async () => {
    mockTracker.checkAllBudgets.mockRejectedValue(new Error('Check failed'));

    const result = await checkBudgetsTool.execute({});

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to check budgets');
    expect(result.message).toContain('Check failed');
  });
});
