/**
 * Cost Management Tools
 * Admin tools for querying costs and managing budgets
 */

import { Tool, ToolResult } from '../tools/types.js';
import { costTracker } from './tracker.js';
import { CostQuery, Budget } from './types.js';

// ============ Get Costs ============
export const getCostsTool: Tool = {
  name: 'get_costs',
  description: 'Query cost records with optional filters. Returns detailed cost data for analysis. Use for expense reports, debugging, or auditing.',
  parameters: {
    type: 'object',
    properties: {
      from: {
        type: 'string',
        description: 'Start date (ISO format, or: today, yesterday, this-week, this-month)',
      },
      to: {
        type: 'string',
        description: 'End date (ISO format)',
      },
      tool: {
        type: 'string',
        description: 'Filter by tool name',
      },
      agent: {
        type: 'string',
        description: 'Filter by sub-agent name',
      },
      productId: {
        type: 'string',
        description: 'Filter by product ID',
      },
      userId: {
        type: 'string',
        description: 'Filter by user ID',
      },
      provider: {
        type: 'string',
        description: 'Filter by provider (openai, anthropic, gemini, resend, etc.)',
      },
      limit: {
        type: 'number',
        description: 'Max records to return (default: 100)',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    try {
      const query: CostQuery = {
        from: params.from,
        to: params.to,
        tool: params.tool,
        agent: params.agent,
        productId: params.productId,
        userId: params.userId,
        provider: params.provider,
        limit: params.limit || 100,
      };

      const records = await costTracker.query(query);

      if (records.length === 0) {
        return {
          success: true,
          message: 'No cost records found for the specified filters.',
          data: [],
        };
      }

      const totalUsd = records.reduce((sum, r) => sum + r.cost.usd, 0);

      return {
        success: true,
        message: `Found ${records.length} cost record(s) totaling $${totalUsd.toFixed(4)}.`,
        data: {
          totalUsd: Math.round(totalUsd * 10000) / 10000,
          count: records.length,
          records: records.map(r => ({
            timestamp: r.timestamp,
            tool: r.tool,
            agent: r.agent,
            productId: r.productId,
            usd: r.cost.usd,
            provider: r.cost.provider,
            units: r.cost.units,
            unitType: r.cost.unitType,
          })),
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to query costs: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Cost Summary ============
export const getCostSummaryTool: Tool = {
  name: 'get_cost_summary',
  description: 'Get aggregated cost summary with breakdowns by tool, agent, product, provider, and user. Perfect for dashboards and reports.',
  parameters: {
    type: 'object',
    properties: {
      from: {
        type: 'string',
        description: 'Start date (ISO format, or: today, yesterday, this-week, this-month)',
      },
      to: {
        type: 'string',
        description: 'End date (ISO format)',
      },
      productId: {
        type: 'string',
        description: 'Filter by product ID',
      },
      agent: {
        type: 'string',
        description: 'Filter by sub-agent',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    try {
      const summary = await costTracker.summarize({
        from: params.from,
        to: params.to,
        productId: params.productId,
        agent: params.agent,
      });

      if (summary.count === 0) {
        return {
          success: true,
          message: 'No costs recorded for this period.',
          data: summary,
        };
      }

      // Format breakdown strings
      const formatBreakdown = (obj: Record<string, number>) => {
        return Object.entries(obj)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k}: $${v.toFixed(4)}`)
          .join(', ');
      };

      let breakdown = '';
      if (summary.byTool && Object.keys(summary.byTool).length > 0) {
        breakdown += `\n  By Tool: ${formatBreakdown(summary.byTool)}`;
      }
      if (summary.byAgent && Object.keys(summary.byAgent).length > 0) {
        breakdown += `\n  By Agent: ${formatBreakdown(summary.byAgent)}`;
      }
      if (summary.byProvider && Object.keys(summary.byProvider).length > 0) {
        breakdown += `\n  By Provider: ${formatBreakdown(summary.byProvider)}`;
      }
      if (summary.byProduct && Object.keys(summary.byProduct).length > 0) {
        breakdown += `\n  By Product: ${formatBreakdown(summary.byProduct)}`;
      }

      return {
        success: true,
        message: `💰 Total: $${summary.totalUsd.toFixed(4)} (${summary.count} operations)${breakdown}`,
        data: summary,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to get cost summary: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Cost Trend ============
export const getCostTrendTool: Tool = {
  name: 'get_cost_trend',
  description: 'Get costs grouped by day or hour to see spending trends over time.',
  parameters: {
    type: 'object',
    properties: {
      from: {
        type: 'string',
        description: 'Start date (ISO format, or: today, yesterday, this-week, this-month)',
      },
      to: {
        type: 'string',
        description: 'End date (ISO format)',
      },
      groupBy: {
        type: 'string',
        enum: ['day', 'hour'],
        description: 'Group by day or hour (default: day)',
      },
      productId: {
        type: 'string',
        description: 'Filter by product ID',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    try {
      const grouped = await costTracker.groupByTime({
        from: params.from,
        to: params.to,
        productId: params.productId,
        groupBy: params.groupBy || 'day',
      });

      if (Object.keys(grouped).length === 0) {
        return {
          success: true,
          message: 'No cost data for this period.',
          data: {},
        };
      }

      const total = Object.values(grouped).reduce((a, b) => a + b, 0);
      const periods = Object.keys(grouped).sort();

      return {
        success: true,
        message: `📈 Cost trend (${periods.length} periods, total: $${total.toFixed(4)})`,
        data: grouped,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to get cost trend: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Set Budget ============
export const setBudgetTool: Tool = {
  name: 'set_budget',
  description: 'Create or update a spending budget. Budgets can warn or block when limits are exceeded.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Budget ID (omit to create new)',
      },
      name: {
        type: 'string',
        description: 'Human-readable budget name',
      },
      scope: {
        type: 'string',
        enum: ['global', 'product', 'agent', 'user'],
        description: 'What the budget applies to',
      },
      scopeId: {
        type: 'string',
        description: 'ID of product/agent/user if scope is not global',
      },
      period: {
        type: 'string',
        enum: ['daily', 'weekly', 'monthly'],
        description: 'Budget reset period',
      },
      limitUsd: {
        type: 'number',
        description: 'Spending limit in USD',
      },
      action: {
        type: 'string',
        enum: ['warn', 'block', 'warn_then_block'],
        description: 'What to do when exceeded (default: warn)',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether budget is active (default: true)',
      },
    },
    required: ['name', 'scope', 'period', 'limitUsd'],
  },

  async execute(params): Promise<ToolResult> {
    try {
      // Validate scope + scopeId
      if (params.scope !== 'global' && !params.scopeId) {
        return {
          success: false,
          message: `scopeId is required when scope is "${params.scope}"`,
        };
      }

      const budget = await costTracker.setBudget({
        id: params.id,
        name: params.name,
        scope: params.scope,
        scopeId: params.scopeId,
        period: params.period,
        limitUsd: params.limitUsd,
        action: params.action || 'warn',
        enabled: params.enabled !== false,
      });

      return {
        success: true,
        message: `✅ Budget "${budget.name}" ${params.id ? 'updated' : 'created'}: $${budget.limitUsd}/${budget.period} (${budget.scope}${budget.scopeId ? `: ${budget.scopeId}` : ''})`,
        data: budget,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to set budget: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ List Budgets ============
export const listBudgetsTool: Tool = {
  name: 'list_budgets',
  description: 'List all configured budgets with their current status.',
  parameters: {
    type: 'object',
    properties: {
      includeStatus: {
        type: 'boolean',
        description: 'Include current spend status for each budget (default: true)',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    try {
      const budgets = await costTracker.getBudgets();

      if (budgets.length === 0) {
        return {
          success: true,
          message: 'No budgets configured. Use set_budget to create one.',
          data: [],
        };
      }

      const includeStatus = params.includeStatus !== false;
      const results: any[] = [];

      for (const budget of budgets) {
        const result: any = { ...budget };
        
        if (includeStatus) {
          const status = await costTracker.checkBudget(budget);
          result.status = {
            spent: status.spent,
            remaining: status.remaining,
            percentUsed: status.percentUsed,
            isExceeded: status.isExceeded,
            periodStart: status.periodStart,
            periodEnd: status.periodEnd,
          };
        }
        
        results.push(result);
      }

      return {
        success: true,
        message: `Found ${budgets.length} budget(s).`,
        data: results,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to list budgets: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Delete Budget ============
export const deleteBudgetTool: Tool = {
  name: 'delete_budget',
  description: 'Delete a budget by ID.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Budget ID to delete',
      },
    },
    required: ['id'],
  },

  async execute(params): Promise<ToolResult> {
    try {
      const deleted = await costTracker.deleteBudget(params.id);

      if (!deleted) {
        return {
          success: false,
          message: `Budget not found: ${params.id}`,
        };
      }

      return {
        success: true,
        message: `🗑️ Budget deleted: ${params.id}`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to delete budget: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Check Budgets ============
export const checkBudgetsTool: Tool = {
  name: 'check_budgets',
  description: 'Check all budgets for alerts (exceeded or near limit). Returns budgets above the warning threshold.',
  parameters: {
    type: 'object',
    properties: {
      warningThreshold: {
        type: 'number',
        description: 'Percent threshold to trigger warning (default: 80)',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    try {
      const threshold = params.warningThreshold || 80;
      const alerts = await costTracker.checkAllBudgets(threshold);

      if (alerts.length === 0) {
        return {
          success: true,
          message: `✅ All budgets are within limits (threshold: ${threshold}%).`,
          data: [],
        };
      }

      const messages = alerts.map(a => {
        const icon = a.isExceeded ? '🚨' : '⚠️';
        return `${icon} ${a.budget.name}: ${a.percentUsed.toFixed(1)}% used ($${a.spent.toFixed(2)} / $${a.budget.limitUsd.toFixed(2)})`;
      });

      return {
        success: true,
        message: messages.join('\n'),
        data: alerts,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to check budgets: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Export All ============
export const costTools: Tool[] = [
  getCostsTool,
  getCostSummaryTool,
  getCostTrendTool,
  setBudgetTool,
  listBudgetsTool,
  deleteBudgetTool,
  checkBudgetsTool,
];
