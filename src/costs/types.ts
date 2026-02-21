/**
 * Cost Tracking Types
 * Unified cost reporting across all tools and providers
 */

/**
 * Cost breakdown from a single tool execution
 */
export interface ToolCost {
  /** Normalized cost in USD */
  usd: number;
  
  /** Provider name (openai, anthropic, gemini, resend, etc.) */
  provider: string;
  
  /** Number of units consumed */
  units?: number;
  
  /** Type of units (tokens, emails, images, characters, api_calls) */
  unitType?: 'tokens' | 'emails' | 'images' | 'characters' | 'api_calls' | 'minutes';
  
  /** Breakdown of unit costs (e.g., input vs output tokens) */
  breakdown?: Record<string, number>;
}

/**
 * Full cost record stored in the log
 */
export interface CostRecord {
  /** Unique record ID */
  id: string;
  
  /** ISO timestamp */
  timestamp: string;
  
  /** Unix timestamp for efficient querying */
  ts: number;
  
  /** Tool name that incurred the cost */
  tool: string;
  
  /** Sub-agent that executed (if any) */
  agent?: string;
  
  /** Product context (if any) */
  productId?: string;
  
  /** User who triggered the action */
  userId?: string;
  
  /** Cost details */
  cost: ToolCost;
  
  /** Optional metadata */
  meta?: Record<string, any>;
}

/**
 * Aggregated cost summary
 */
export interface CostSummary {
  /** Total USD spent */
  totalUsd: number;
  
  /** Number of cost records */
  count: number;
  
  /** Breakdown by dimension */
  byTool?: Record<string, number>;
  byAgent?: Record<string, number>;
  byProduct?: Record<string, number>;
  byProvider?: Record<string, number>;
  byUser?: Record<string, number>;
  
  /** Date range */
  from: string;
  to: string;
}

/**
 * Budget configuration
 */
export interface Budget {
  /** Budget ID */
  id: string;
  
  /** Budget name */
  name: string;
  
  /** Scope: global, product, agent, or user */
  scope: 'global' | 'product' | 'agent' | 'user';
  
  /** Scope ID (e.g., product ID if scope is 'product') */
  scopeId?: string;
  
  /** Period: daily, weekly, monthly */
  period: 'daily' | 'weekly' | 'monthly';
  
  /** Limit in USD */
  limitUsd: number;
  
  /** Action when exceeded: warn, block, or both */
  action: 'warn' | 'block' | 'warn_then_block';
  
  /** Whether budget is active */
  enabled: boolean;
  
  /** Created timestamp */
  createdAt: number;
}

/**
 * Budget status check result
 */
export interface BudgetStatus {
  budget: Budget;
  spent: number;
  remaining: number;
  percentUsed: number;
  isExceeded: boolean;
  periodStart: string;
  periodEnd: string;
}

/**
 * Query options for cost retrieval
 */
export interface CostQuery {
  /** Start date (ISO or 'today', 'yesterday', 'this-week', 'this-month') */
  from?: string;
  
  /** End date (ISO) */
  to?: string;
  
  /** Filter by tool name */
  tool?: string;
  
  /** Filter by agent */
  agent?: string;
  
  /** Filter by product */
  productId?: string;
  
  /** Filter by user */
  userId?: string;
  
  /** Filter by provider */
  provider?: string;
  
  /** Group results by dimension */
  groupBy?: 'tool' | 'agent' | 'product' | 'provider' | 'user' | 'day' | 'hour';
  
  /** Limit number of records */
  limit?: number;
}

/**
 * Known provider pricing (approximate, for estimation)
 * These are used when tools don't report exact costs
 */
export const PROVIDER_PRICING = {
  // LLM providers (per 1M tokens)
  openai: {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
  },
  anthropic: {
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
  },
  gemini: {
    'gemini-pro': { input: 0.50, output: 1.50 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  },
  
  // Image generation (per image)
  'openai-image': {
    'dall-e-3-1024': 0.04,
    'dall-e-3-1792': 0.08,
  },
  'gemini-image': {
    'imagen-3': 0.02,
  },
  
  // Email (per email)
  resend: {
    'email': 0.001, // ~$1 per 1000 emails
  },
  
  // TTS (per 1000 characters)
  elevenlabs: {
    'standard': 0.30,
    'turbo': 0.18,
  },
} as const;
