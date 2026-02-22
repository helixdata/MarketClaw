/**
 * Cost Tracker
 * Logs, aggregates, and manages cost data
 */

import { readFile, writeFile, mkdir, appendFile } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import {
  ToolCost,
  CostRecord,
  CostSummary,
  CostQuery,
  Budget,
  BudgetStatus,
} from './types.js';

export class CostTracker {
  private workspacePath: string;
  private costsDir: string;
  private budgetsPath: string;
  private currentLogPath: string;

  constructor(workspace?: string) {
    this.workspacePath = workspace || path.join(homedir(), '.marketclaw', 'workspace');
    this.costsDir = path.join(this.workspacePath, 'costs');
    this.budgetsPath = path.join(this.costsDir, 'budgets.json');
    
    // Daily log file for append-only writes
    const today = new Date().toISOString().split('T')[0];
    this.currentLogPath = path.join(this.costsDir, `costs-${today}.jsonl`);
  }

  private async ensureDirs(): Promise<void> {
    if (!existsSync(this.costsDir)) {
      await mkdir(this.costsDir, { recursive: true });
    }
  }

  // ========== Logging ==========

  /**
   * Log a cost record from a tool execution
   */
  async log(params: {
    tool: string;
    cost: ToolCost;
    agent?: string;
    productId?: string;
    campaignId?: string;
    userId?: string;
    meta?: Record<string, any>;
  }): Promise<CostRecord> {
    await this.ensureDirs();

    const now = new Date();
    const record: CostRecord = {
      id: randomUUID(),
      timestamp: now.toISOString(),
      ts: now.getTime(),
      tool: params.tool,
      agent: params.agent,
      productId: params.productId,
      campaignId: params.campaignId,
      userId: params.userId,
      cost: params.cost,
      meta: params.meta,
    };

    // Append to daily log (fast, no read required)
    const line = JSON.stringify(record) + '\n';
    await appendFile(this.currentLogPath, line);

    return record;
  }

  // ========== Querying ==========

  /**
   * Parse date string to timestamp range
   */
  private parseDateRange(from?: string, to?: string): { fromTs: number; toTs: number } {
    const now = new Date();
    let fromTs: number;
    let toTs: number = to ? new Date(to).getTime() : now.getTime();

    if (!from) {
      // Default: last 30 days
      fromTs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    } else if (from === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      fromTs = start.getTime();
    } else if (from === 'yesterday') {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      fromTs = start.getTime();
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      toTs = end.getTime();
    } else if (from === 'this-week') {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      fromTs = start.getTime();
    } else if (from === 'this-month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      fromTs = start.getTime();
    } else {
      fromTs = new Date(from).getTime();
    }

    return { fromTs, toTs };
  }

  /**
   * Get list of log files in date range
   */
  private async getLogFiles(fromTs: number, toTs: number): Promise<string[]> {
    await this.ensureDirs();
    
    const { readdir } = await import('fs/promises');
    const files = await readdir(this.costsDir);
    
    return files
      .filter(f => f.startsWith('costs-') && f.endsWith('.jsonl'))
      .map(f => {
        const dateStr = f.replace('costs-', '').replace('.jsonl', '');
        return { file: f, date: new Date(dateStr).getTime() };
      })
      .filter(({ date }) => {
        // Include file if its date falls within range (rough filter)
        const dayStart = date;
        const dayEnd = date + 24 * 60 * 60 * 1000;
        return dayEnd >= fromTs && dayStart <= toTs;
      })
      .map(({ file }) => path.join(this.costsDir, file));
  }

  /**
   * Stream records from log files with filters
   */
  private async *streamRecords(query: CostQuery): AsyncGenerator<CostRecord> {
    const { fromTs, toTs } = this.parseDateRange(query.from, query.to);
    const logFiles = await this.getLogFiles(fromTs, toTs);

    for (const logFile of logFiles) {
      if (!existsSync(logFile)) continue;

      const stream = createReadStream(logFile);
      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line.trim()) continue;
        
        try {
          const record: CostRecord = JSON.parse(line);
          
          // Apply filters
          if (record.ts < fromTs || record.ts > toTs) continue;
          if (query.tool && record.tool !== query.tool) continue;
          if (query.agent && record.agent !== query.agent) continue;
          if (query.productId && record.productId !== query.productId) continue;
          if (query.campaignId && record.campaignId !== query.campaignId) continue;
          if (query.userId && record.userId !== query.userId) continue;
          if (query.provider && record.cost.provider !== query.provider) continue;

          yield record;
        } catch {
          // Skip malformed lines
        }
      }
    }
  }

  /**
   * Query cost records
   */
  async query(query: CostQuery = {}): Promise<CostRecord[]> {
    const records: CostRecord[] = [];
    const limit = query.limit || 1000;

    for await (const record of this.streamRecords(query)) {
      records.push(record);
      if (records.length >= limit) break;
    }

    return records;
  }

  /**
   * Get aggregated cost summary
   */
  async summarize(query: CostQuery = {}): Promise<CostSummary> {
    const { fromTs, toTs } = this.parseDateRange(query.from, query.to);
    
    const summary: CostSummary = {
      totalUsd: 0,
      count: 0,
      byTool: {},
      byAgent: {},
      byProduct: {},
      byCampaign: {},
      byProvider: {},
      byUser: {},
      from: new Date(fromTs).toISOString(),
      to: new Date(toTs).toISOString(),
    };

    for await (const record of this.streamRecords(query)) {
      summary.totalUsd += record.cost.usd;
      summary.count++;

      // Aggregate by dimensions
      summary.byTool![record.tool] = (summary.byTool![record.tool] || 0) + record.cost.usd;
      summary.byProvider![record.cost.provider] = (summary.byProvider![record.cost.provider] || 0) + record.cost.usd;
      
      if (record.agent) {
        summary.byAgent![record.agent] = (summary.byAgent![record.agent] || 0) + record.cost.usd;
      }
      if (record.productId) {
        summary.byProduct![record.productId] = (summary.byProduct![record.productId] || 0) + record.cost.usd;
      }
      if (record.campaignId) {
        summary.byCampaign![record.campaignId] = (summary.byCampaign![record.campaignId] || 0) + record.cost.usd;
      }
      if (record.userId) {
        summary.byUser![record.userId] = (summary.byUser![record.userId] || 0) + record.cost.usd;
      }
    }

    // Round totals
    summary.totalUsd = Math.round(summary.totalUsd * 10000) / 10000;
    
    return summary;
  }

  /**
   * Get costs grouped by time period
   */
  async groupByTime(query: CostQuery & { groupBy: 'day' | 'hour' }): Promise<Record<string, number>> {
    const grouped: Record<string, number> = {};

    for await (const record of this.streamRecords(query)) {
      const date = new Date(record.timestamp);
      let key: string;
      
      if (query.groupBy === 'hour') {
        key = `${date.toISOString().split('T')[0]}T${date.getHours().toString().padStart(2, '0')}:00`;
      } else {
        key = date.toISOString().split('T')[0];
      }

      grouped[key] = (grouped[key] || 0) + record.cost.usd;
    }

    return grouped;
  }

  // ========== Budgets ==========

  /**
   * Load all budgets
   */
  async getBudgets(): Promise<Budget[]> {
    await this.ensureDirs();
    
    if (!existsSync(this.budgetsPath)) {
      return [];
    }

    const data = await readFile(this.budgetsPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Save all budgets
   */
  private async saveBudgets(budgets: Budget[]): Promise<void> {
    await this.ensureDirs();
    await writeFile(this.budgetsPath, JSON.stringify(budgets, null, 2));
  }

  /**
   * Create or update a budget
   */
  async setBudget(budget: Omit<Budget, 'id' | 'createdAt'> & { id?: string }): Promise<Budget> {
    const budgets = await this.getBudgets();
    
    const existing = budget.id ? budgets.find(b => b.id === budget.id) : null;
    
    if (existing) {
      // Update existing
      Object.assign(existing, budget);
      await this.saveBudgets(budgets);
      return existing;
    } else {
      // Create new
      const newBudget: Budget = {
        ...budget,
        id: budget.id || randomUUID(),
        createdAt: Date.now(),
      };
      budgets.push(newBudget);
      await this.saveBudgets(budgets);
      return newBudget;
    }
  }

  /**
   * Delete a budget
   */
  async deleteBudget(id: string): Promise<boolean> {
    const budgets = await this.getBudgets();
    const index = budgets.findIndex(b => b.id === id);
    
    if (index === -1) return false;
    
    budgets.splice(index, 1);
    await this.saveBudgets(budgets);
    return true;
  }

  /**
   * Get budget period date range
   */
  private getBudgetPeriod(budget: Budget): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (budget.period) {
      case 'daily':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      case 'weekly':
        start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 7);
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
    }

    return { start, end };
  }

  /**
   * Check budget status
   */
  async checkBudget(budget: Budget): Promise<BudgetStatus> {
    const { start, end } = this.getBudgetPeriod(budget);
    
    // Build query based on budget scope
    const query: CostQuery = {
      from: start.toISOString(),
      to: end.toISOString(),
    };

    if (budget.scope === 'product' && budget.scopeId) {
      query.productId = budget.scopeId;
    } else if (budget.scope === 'agent' && budget.scopeId) {
      query.agent = budget.scopeId;
    } else if (budget.scope === 'user' && budget.scopeId) {
      query.userId = budget.scopeId;
    }

    const summary = await this.summarize(query);
    const spent = summary.totalUsd;
    const remaining = Math.max(0, budget.limitUsd - spent);
    const percentUsed = (spent / budget.limitUsd) * 100;

    return {
      budget,
      spent: Math.round(spent * 10000) / 10000,
      remaining: Math.round(remaining * 10000) / 10000,
      percentUsed: Math.round(percentUsed * 100) / 100,
      isExceeded: spent >= budget.limitUsd,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }

  /**
   * Check all budgets and return any that are exceeded or near limit
   */
  async checkAllBudgets(warningThreshold = 80): Promise<BudgetStatus[]> {
    const budgets = await this.getBudgets();
    const alerts: BudgetStatus[] = [];

    for (const budget of budgets) {
      if (!budget.enabled) continue;
      
      const status = await this.checkBudget(budget);
      if (status.percentUsed >= warningThreshold) {
        alerts.push(status);
      }
    }

    return alerts;
  }

  /**
   * Check if an action should be blocked by budget
   */
  async shouldBlock(params: {
    tool: string;
    agent?: string;
    productId?: string;
    userId?: string;
    estimatedCost?: number;
  }): Promise<{ blocked: boolean; reason?: string; budget?: Budget }> {
    const budgets = await this.getBudgets();

    for (const budget of budgets) {
      if (!budget.enabled) continue;
      if (budget.action !== 'block' && budget.action !== 'warn_then_block') continue;

      // Check if this budget applies
      let applies = budget.scope === 'global';
      if (budget.scope === 'product' && budget.scopeId === params.productId) applies = true;
      if (budget.scope === 'agent' && budget.scopeId === params.agent) applies = true;
      if (budget.scope === 'user' && budget.scopeId === params.userId) applies = true;

      if (!applies) continue;

      const status = await this.checkBudget(budget);
      
      if (status.isExceeded) {
        return {
          blocked: true,
          reason: `Budget "${budget.name}" exceeded: $${status.spent.toFixed(2)} / $${budget.limitUsd.toFixed(2)} (${budget.period})`,
          budget,
        };
      }
    }

    return { blocked: false };
  }
}

// Singleton instance
export const costTracker = new CostTracker();
