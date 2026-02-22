# Team Management

MarketClaw supports multiple users with role-based permissions. Perfect for teams where different people handle content creation, approvals, and publishing.

## Overview

- **Members** — Team members identified by Telegram ID
- **Roles** — Permission bundles (admin, manager, creator, viewer)
- **Product Roles** — Different permissions per product
- **Permissions** — Fine-grained access control on tools

## Quick Start

The first user (set up during `marketclaw setup`) is automatically an admin. Add team members via:

```
You: Add @jane (telegram: 123456789) as a creator

Bot: ✅ Added Jane to the team (creator)
```

## Built-in Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Admin** | Full access | Everything, including team management |
| **Manager** | Approve & post | Approve content, post, manage campaigns |
| **Creator** | Draft content | Create content, use agents (needs approval to post) |
| **Viewer** | Read-only | View analytics only |

### Permission Details

| Permission | Admin | Manager | Creator | Viewer |
|------------|:-----:|:-------:|:-------:|:------:|
| `manage_team` | ✓ | | | |
| `manage_products` | ✓ | ✓ | | |
| `manage_campaigns` | ✓ | ✓ | | |
| `create_content` | ✓ | ✓ | ✓ | |
| `approve_content` | ✓ | ✓ | | |
| `post` | ✓ | ✓ | | |
| `send_email` | ✓ | ✓ | | |
| `view_analytics` | ✓ | ✓ | ✓ | ✓ |
| `manage_leads` | ✓ | ✓ | ✓ | |
| `use_agents` | ✓ | ✓ | ✓ | |

## Product-Based Roles

Members can have different roles for different products:

```yaml
# Example: Jane is a manager for ProofPing but just a viewer for LaunchCrew
members:
  - name: Jane
    telegramId: 123456789
    defaultRole: viewer           # Fallback for unlisted products
    productRoles:
      proofping: manager          # Manager for ProofPing
      launchcrew: viewer          # Viewer for LaunchCrew
```

### Setting Product Roles

```
You: Make Jane a manager for ProofPing

Bot: ✅ Jane is now a manager for ProofPing
```

## Team Data

Team data is stored in `~/.marketclaw/workspace/team.json`:

```json
{
  "id": "default",
  "name": "My Team",
  "roles": [...],
  "members": [
    {
      "id": "user_1234_abc",
      "telegramId": 123456789,
      "name": "Jane",
      "defaultRole": "creator",
      "productRoles": {
        "proofping": "manager"
      },
      "status": "active",
      "joinedAt": "2024-02-21T10:00:00.000Z"
    }
  ],
  "settings": {
    "defaultRole": "viewer",
    "requireApproval": true,
    "allowSelfRegister": false
  }
}
```

## Tools

### `list_team`
List all team members and their roles.

```
You: Who's on the team?

Bot: 3 team members:
     • Brett (admin) - last active 2h ago
     • Jane (creator) - last active 1d ago
     • Mike (viewer) - never
```

### `add_team_member`
Add a new member (admin only).

| Parameter | Required | Description |
|-----------|----------|-------------|
| `telegramId` | Yes | Telegram user ID |
| `name` | Yes | Member name |
| `defaultRole` | No | Default role (admin/manager/creator/viewer) |
| `productRoles` | No | Product-specific roles as JSON |

### `update_team_member`
Update an existing member's details (admin only).

| Parameter | Required | Description |
|-----------|----------|-------------|
| `memberId` or `telegramId` | Yes | Member identifier |
| `name` | No | New name |
| `email` | No | New email address |
| `newTelegramId` | No | New Telegram ID |
| `newDiscordId` | No | New Discord ID |
| `newSlackId` | No | New Slack ID |

### `remove_team_member`
Remove a member from the team.

### `assign_roles`
Change a member's roles.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `memberId` | Yes | Member ID |
| `defaultRole` | No | New default role |
| `productId` | No | Product to set role for |
| `role` | No | Role for that product |

### `suspend_member` / `activate_member`
Temporarily disable or re-enable a member's access.

### `list_roles`
Show all available roles and their permissions.

### `list_permissions`
Show what permissions a member has.

## Permission Enforcement

Permissions are checked at tool execution time:

```typescript
// Tool → Permission mapping
TOOL_PERMISSIONS = {
  'post_tweet': 'post',
  'send_email': 'send_email',
  'draft_email': 'create_content',
  'add_team_member': 'manage_team',
  // ...
}
```

### Public Tools

Some tools don't require permissions:

- `list_team`, `list_roles`, `list_products`
- `list_agents`, `agent_info`
- `list_scheduled_jobs` (view only)
- `list_pending_approvals` (view only)
- Auth check tools (`check_email_auth`, etc.)

## Workflows

### Creator → Approval → Post

1. **Creator drafts content**
   ```
   Jane: Draft a tweet about our new feature
   Bot: Here's a draft: "..."
   ```

2. **Creator requests approval**
   ```
   Jane: Request approval for this tweet
   Bot: 📝 Approval requested! Notifying: Brett
   ```

3. **Manager/Admin approves**
   ```
   Brett: Approve that tweet
   Bot: ✅ Approved! Ready to post.
   ```

4. **Manager/Admin posts**
   ```
   Brett: Post it
   Bot: ✅ Tweet posted!
   ```

### Per-Product Permissions

```
Jane (viewer for LaunchCrew): Create a tweet for LaunchCrew
Bot: ❌ You don't have permission to create content for LaunchCrew

Jane (manager for ProofPing): Create a tweet for ProofPing
Bot: Here's a draft: "..."
```

## Member Preferences

Each team member can have personal preferences stored:

| Preference | Description |
|------------|-------------|
| `voice` | Communication style (professional/casual/friendly/playful) |
| `defaultProduct` | Default product context for this member |
| `activeCampaign` | Active campaign for this member |
| `timezone` | Member's timezone |
| `notifyOn` | Events to notify about |

### Per-Member Active Campaign

Active campaign is stored **per team member**, not globally. This means:

- Each member can work on different campaigns simultaneously
- Setting active campaign only affects your own context
- Falls back to global setting if no member preference set

```
Jane: Set active campaign to product-launch
Bot: ✅ Active campaign set to "Product Launch" for Jane

Brett: What's my active campaign?
Bot: Your active campaign is "Q1 Marketing" (Brett's context)
```

### Update Preferences

```
You: Set my voice to casual
Bot: ✅ Updated your preference: voice → casual

You: Set my timezone to America/New_York
Bot: ✅ Updated your preference: timezone → America/New_York
```

## Custom Roles

Create roles beyond the built-ins:

```
You: Create a role called "social_manager" with post and create_content permissions

Bot: ✅ Created role: social_manager
```

## Best Practices

1. **Least Privilege** — Give people only the permissions they need
2. **Use Product Roles** — Different products may need different access levels
3. **Require Approvals** — Creators draft, managers approve and post
4. **Audit Regularly** — Check who has access periodically

## Security Notes

- Telegram IDs are the primary identifier (hard to spoof in-chat)
- Suspended members cannot use any tools
- Admins can see everything; be careful who gets admin
- Permission checks happen server-side, not client-side
