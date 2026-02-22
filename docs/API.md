# API Reference

Complete reference for all MarketClaw tools and their parameters.

## Table of Contents

- [Scheduling](#scheduling)
- [Knowledge](#knowledge)
- [Social Media](#social-media)
- [Email](#email)
- [Leads](#leads)
- [Sub-Agents](#sub-agents)
- [Team Management](#team-management)
- [Approvals](#approvals)
- [Costs](#costs)
- [Configuration](#configuration)

---

## Scheduling

### `schedule_task`

Schedule any automated task for the AI to execute. Use this for everything: social posts, emails, reports, inbox monitoring, etc.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name for the task (e.g., "Daily Twitter Post") |
| `task` | string | Yes | What the AI should do (e.g., "Post to Twitter: [content]") |
| `when` | string | Yes | When to run (e.g., "every day at 9am", "in 2 hours") |
| `productId` | string | No | Product context |
| `campaignId` | string | No | Campaign context |
| `notify` | boolean | No | Send notification on completion (default: true) |

### `schedule_reminder`

Set a reminder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | Reminder message |
| `schedule` | string | Yes | When to remind |
| `recurring` | boolean | No | Repeat on schedule |

### `list_scheduled_jobs`

List all scheduled jobs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | Filter by type (post, reminder) |
| `productId` | string | No | Filter by product |

### `cancel_scheduled_job`

Cancel a scheduled job.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `jobId` | string | Yes | Job ID to cancel |

### `pause_scheduled_job` / `resume_scheduled_job`

Pause or resume a job.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `jobId` | string | Yes | Job ID |

---

## Knowledge

### `store_knowledge`

Add information to the knowledge base.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | Yes | Product to store under |
| `content` | string | Yes | Knowledge content |
| `type` | string | No | Type: voice, research, learning, asset |

### `query_knowledge`

Search the knowledge base.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `productId` | string | No | Filter by product |
| `limit` | number | No | Max results (default: 5) |

### `set_active_product`

Set the current working product.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | Yes | Product ID |

### `list_products`

List all products.

*No parameters.*

---

## Social Media

### `post_tweet`

Post to Twitter/X.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Tweet content (max 280 chars) |
| `image` | string | No | Image path to attach |
| `dryRun` | boolean | No | Preview without posting |

### `draft_tweet`

Generate a tweet draft.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | string | Yes | Topic to write about |
| `style` | string | No | Style: hook, insight, story, thread |

### `post_linkedin`

Post to LinkedIn.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Post content |
| `link` | string | No | Link to include |
| `visibility` | string | No | PUBLIC, CONNECTIONS |
| `dryRun` | boolean | No | Preview without posting |

### `search_tweets`

Search Twitter.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `count` | number | No | Number of results |

### `get_mentions`

Get Twitter mentions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `count` | number | No | Number of results |

---

## Email

### `send_email`

Send an email via Resend.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string | Yes | Recipient email(s), comma-separated |
| `subject` | string | Yes | Email subject |
| `body` | string | Yes | Email body (text or HTML) |
| `from` | string | No | Sender address |
| `replyTo` | string | No | Reply-to address |
| `dryRun` | boolean | No | Preview without sending |

### `send_launch_announcement`

Send a product launch email.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string | Yes | Recipients |
| `productName` | string | Yes | Product name |
| `launchUrl` | string | Yes | Product URL |
| `tagline` | string | No | Product tagline |
| `offer` | string | No | Launch offer |

### `check_email_auth`

Check Resend configuration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | No | Check product-specific config |

### `check_inbox`

Check Gmail inbox (via gog CLI).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max emails to return |
| `unread` | boolean | No | Only unread |
| `from` | string | No | Filter by sender |

---

## Leads

### `add_lead`

Add a lead to the CRM.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | Lead email |
| `name` | string | No | Lead name |
| `company` | string | No | Company name |
| `source` | string | No | Lead source |
| `notes` | string | No | Notes |
| `tags` | string | No | Comma-separated tags |

### `list_leads`

List all leads.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status |
| `source` | string | No | Filter by source |
| `tag` | string | No | Filter by tag |
| `limit` | number | No | Max results |

### `update_lead`

Update a lead.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | Lead email |
| `status` | string | No | New status |
| `notes` | string | No | Notes to append |
| `tags` | string | No | Tags to add |

### `search_leads`

Search leads.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |

### `import_leads`

Bulk import leads.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | string | Yes | JSON array of leads |

---

## Sub-Agents

### `list_agents`

List available sub-agents.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `showDisabled` | boolean | No | Include disabled agents |

### `delegate_task`

Assign a task to a sub-agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentId` | string | Yes | Agent ID (twitter, email, etc.) |
| `task` | string | Yes | Task description |
| `context` | string | No | Additional context (JSON) |
| `wait` | boolean | No | Wait for completion (default: true) |

### `agent_info`

Get agent details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentId` | string | Yes | Agent ID |

### `set_agent_model`

Change an agent's AI model.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentId` | string | Yes | Agent ID |
| `model` | string | Yes | Model name or "default" |

### `list_agent_models`

Show all agent model configurations.

*No parameters.*

### `create_agent`

Create a custom agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Unique agent ID |
| `name` | string | Yes | Display name |
| `emoji` | string | Yes | Agent emoji |
| `specialtyName` | string | Yes | Specialty name |
| `specialtyDescription` | string | Yes | What they do |
| `systemPrompt` | string | Yes | Expertise prompt |
| `voice` | string | No | professional, casual, friendly, playful |
| `tools` | string | No | Comma-separated tool names |
| `model` | string | No | AI model to use |

---

## Team Management

### `list_team`

List team members.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeInactive` | boolean | No | Include inactive members |
| `productId` | string | No | Filter by product role |

### `add_team_member`

Add a team member.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Member name |
| `role` | string | Yes | admin, manager, creator, viewer |
| `telegramId` | string | No | Telegram user ID |
| `discordId` | string | No | Discord user ID |
| `slackId` | string | No | Slack user ID |
| `email` | string | No | Email address |
| `productRoles` | string | No | Product-specific roles (JSON) |

### `remove_team_member`

Remove a team member.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memberId` | string | Yes | Member ID or platform ID |

### `assign_role`

Assign a role.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memberId` | string | Yes | Member ID |
| `role` | string | Yes | Role to assign |
| `productId` | string | No | Product-specific role |

### `who_has_permission`

Find who has a permission.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `permission` | string | Yes | Permission name |
| `productId` | string | No | Product context |

---

## Approvals

### `request_approval`

Submit content for approval.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Content to approve |
| `contentType` | string | Yes | tweet, linkedin, email |
| `productId` | string | No | Associated product |
| `metadata` | string | No | Additional data (JSON) |

### `list_pending_approvals`

List pending approvals.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | No | Filter by product |

### `approve_content`

Approve content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `approvalId` | string | Yes | Approval ID |
| `notes` | string | No | Approval notes |

### `reject_content`

Reject content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `approvalId` | string | Yes | Approval ID |
| `reason` | string | No | Rejection reason |

---

## Costs

### `get_costs`

Query cost records.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | No | Start date (ISO, today, this-week, this-month) |
| `to` | string | No | End date |
| `tool` | string | No | Filter by tool |
| `agent` | string | No | Filter by agent |
| `productId` | string | No | Filter by product |
| `provider` | string | No | Filter by provider |
| `limit` | number | No | Max records |

### `get_cost_summary`

Get aggregated costs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | No | Start date |
| `to` | string | No | End date |
| `productId` | string | No | Filter by product |

### `get_cost_trend`

Get costs by time period.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | No | Start date |
| `to` | string | No | End date |
| `groupBy` | string | No | day or hour |

### `set_budget`

Create or update a budget.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Budget name |
| `scope` | string | Yes | global, product, agent, user |
| `scopeId` | string | Conditional | Required if scope != global |
| `period` | string | Yes | daily, weekly, monthly |
| `limitUsd` | number | Yes | USD limit |
| `action` | string | No | warn, block, warn_then_block |

### `list_budgets`

List all budgets.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeStatus` | boolean | No | Include current spend |

### `check_budgets`

Check for budget alerts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `warningThreshold` | number | No | Percent threshold (default: 80) |

---

## Configuration

### `get_tool_config`

Get tool configuration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | Yes | Config category |
| `productId` | string | No | Product-specific config |

### `set_tool_config`

Set tool configuration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | Yes | Config category |
| `config` | string | Yes | Configuration (JSON) |
| `productId` | string | No | Product-specific |

### `list_product_configs`

List product configurations.

*No parameters.*

---

## Tool Result Format

All tools return:

```typescript
interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  cost?: {
    usd: number;
    provider: string;
    units?: number;
    unitType?: string;
  };
}
```
