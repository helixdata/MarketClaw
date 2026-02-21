# Cost Tracking

MarketClaw includes a comprehensive cost tracking system that monitors API usage across all tools and providers. This helps admins understand spending patterns, set budgets, and control costs.

## Overview

Every tool that incurs costs (image generation, email sends, etc.) automatically reports its cost back to the system. Costs are:

- **Logged** per execution with full context (tool, agent, product, user)
- **Aggregated** for reporting by any dimension
- **Controlled** via budgets that can warn or block when limits are exceeded

## Quick Start

```bash
# Check today's spending
marketclaw> get_cost_summary from=today

# See costs by tool and agent
marketclaw> get_cost_summary from=this-week

# Set a monthly budget
marketclaw> set_budget name="Monthly Limit" scope=global period=monthly limitUsd=100

# Check if any budgets are near limit
marketclaw> check_budgets
```

## Tools

### `get_costs`

Query detailed cost records with filters.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `from` | string | Start date (ISO, or: `today`, `yesterday`, `this-week`, `this-month`) |
| `to` | string | End date (ISO format) |
| `tool` | string | Filter by tool name |
| `agent` | string | Filter by sub-agent |
| `productId` | string | Filter by product |
| `userId` | string | Filter by user |
| `provider` | string | Filter by provider (openai, gemini, resend, etc.) |
| `limit` | number | Max records to return (default: 100) |

**Example:**
```
get_costs from=today tool=generate_image
```

### `get_cost_summary`

Get aggregated cost summary with breakdowns.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `from` | string | Start date |
| `to` | string | End date |
| `productId` | string | Filter by product |
| `agent` | string | Filter by agent |

**Example output:**
```
💰 Total: $12.4500 (156 operations)
  By Tool: generate_image: $8.00, send_email: $2.15, ...
  By Agent: Pixel: $8.00, Emma: $2.15, ...
  By Provider: gemini: $8.00, resend: $2.15, anthropic: $2.30
```

### `get_cost_trend`

Get costs grouped by time period for trend analysis.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `from` | string | Start date |
| `to` | string | End date |
| `groupBy` | string | `day` or `hour` |
| `productId` | string | Filter by product |

**Example:**
```
get_cost_trend from=this-week groupBy=day
```

### `set_budget`

Create or update a spending budget.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string | Budget ID (omit to create new) |
| `name` | string | Human-readable name |
| `scope` | string | `global`, `product`, `agent`, or `user` |
| `scopeId` | string | ID if scope is not global |
| `period` | string | `daily`, `weekly`, or `monthly` |
| `limitUsd` | number | Spending limit in USD |
| `action` | string | `warn`, `block`, or `warn_then_block` |
| `enabled` | boolean | Whether budget is active |

**Examples:**
```bash
# Global monthly budget
set_budget name="Monthly Limit" scope=global period=monthly limitUsd=100 action=warn

# Per-product daily budget
set_budget name="Product X Daily" scope=product scopeId=productx period=daily limitUsd=5 action=block

# Per-agent weekly budget
set_budget name="Pixel Weekly" scope=agent scopeId=Pixel period=weekly limitUsd=20
```

### `list_budgets`

List all configured budgets with current status.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `includeStatus` | boolean | Include current spend (default: true) |

### `delete_budget`

Delete a budget by ID.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string | Budget ID to delete |

### `check_budgets`

Check all budgets for alerts.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `warningThreshold` | number | Percent threshold (default: 80) |

**Example output:**
```
⚠️ Monthly Limit: 85.2% used ($85.20 / $100.00)
🚨 Pixel Weekly: 100.0% used ($20.00 / $20.00)
```

## Budget Actions

When a budget is exceeded:

- **`warn`**: Log a warning but allow execution
- **`block`**: Block tool execution with error message
- **`warn_then_block`**: Warn at threshold, block at 100%

## Tool Cost Reporting

Tools report costs via the `cost` field in their result:

```typescript
return {
  success: true,
  message: 'Image generated!',
  data: { path: imagePath },
  cost: {
    usd: 0.02,
    provider: 'gemini',
    units: 1,
    unitType: 'images',
  },
};
```

### Cost Fields

| Field | Type | Description |
|-------|------|-------------|
| `usd` | number | Cost in USD |
| `provider` | string | Provider name |
| `units` | number | Number of units consumed |
| `unitType` | string | `tokens`, `emails`, `images`, `characters`, `api_calls`, `minutes` |
| `breakdown` | object | Optional detailed breakdown |

## Storage

Costs are stored in `~/.marketclaw/workspace/costs/`:

- `costs-YYYY-MM-DD.jsonl` — Daily append-only log files
- `budgets.json` — Budget configurations

## Adding Cost Tracking to Tools

When creating a new tool that incurs costs:

```typescript
export const myTool: Tool = {
  name: 'my_tool',
  // ...
  async execute(params): Promise<ToolResult> {
    // Do the work
    const result = await doExpensiveThing();
    
    return {
      success: true,
      message: 'Done!',
      data: result,
      cost: {
        usd: calculateCost(result),
        provider: 'my-provider',
        units: result.unitCount,
        unitType: 'api_calls',
      },
    };
  },
};
```

The registry automatically logs costs when tools return them.

## Context Attribution

Costs are attributed based on execution context:

- **`agent`**: Which sub-agent ran the tool (Tweety, Quinn, Pixel, etc.)
- **`productId`**: Which product the action was for
- **`userId`**: Which team member triggered it

This enables reporting like "How much did Pixel spend on Product X this month?"

## Provider Pricing Reference

Approximate costs used for estimation:

| Provider | Resource | Cost |
|----------|----------|------|
| Gemini (Imagen) | Image | $0.02/image |
| Resend | Email | $0.001/email |
| OpenAI GPT-4o | Tokens | $2.50/1M input, $10/1M output |
| Anthropic Claude | Tokens | $3-15/1M input (varies by model) |
| ElevenLabs | Characters | $0.30/1K chars |

## Best Practices

1. **Start with warnings**: Use `action=warn` initially to understand patterns
2. **Set per-product budgets**: Different products may have different cost profiles
3. **Monitor weekly**: Run `check_budgets` regularly (or automate it)
4. **Review trends**: Use `get_cost_trend` to spot anomalies
5. **Attribution matters**: Pass `productId` and `userId` to tools for accurate reporting
