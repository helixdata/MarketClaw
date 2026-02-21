# Approval Workflow

MarketClaw includes a content approval system for teams. Creators draft content, and managers/admins approve before posting.

## Overview

```
Creator drafts → Request approval → Approvers notified → Approve/Reject → Post
```

This ensures quality control and prevents accidental posts.

## Quick Start

### As a Creator

```
You: Draft a tweet about our launch

Bot: Here's a draft:
     "We just shipped the biggest update yet..."

You: Request approval for this

Bot: 📝 Approval requested! Notifying: Brett, Jane
```

### As an Approver

```
Bot: 🔔 Approval Needed

     Type: tweet
     From: Mike
     Product: ProofPing

     Content:
     "We just shipped the biggest update yet..."

     Reply with "approve approval_123" or "reject approval_123 [reason]"

You: approve approval_123

Bot: ✅ Approved by Brett!
```

## Content Types

| Type | Description |
|------|-------------|
| `tweet` | Twitter/X posts |
| `linkedin_post` | LinkedIn posts |
| `email` | Outbound emails |
| `producthunt` | Product Hunt launches |
| `other` | Any other content |

## Tools

### `request_approval`
Submit content for approval.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `contentType` | Yes | Type: tweet, linkedin_post, email, etc. |
| `content` | Yes | The content text |
| `productId` | No | Associated product |
| `metadata` | No | Extra info as JSON (subject, recipients, etc.) |

### `list_pending_approvals`
View content waiting for approval.

```
You: What's pending approval?

Bot: 2 pending approvals:
     • approval_123 - tweet by Mike (2h ago)
     • approval_456 - email by Jane (1d ago)
```

### `approve_content`
Approve pending content.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `approvalId` | Yes | Approval ID |
| `autoPost` | No | Post immediately after approval |

### `reject_content`
Reject pending content with optional feedback.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `approvalId` | Yes | Approval ID |
| `reason` | No | Why it was rejected |

### `get_approval`
Get details of a specific approval.

### `list_approvers`
See who can approve content (optionally for a specific product).

### `my_pending_approvals`
List your own pending submissions.

## Approval Notifications

When content is submitted for approval, team members with `approve_content` permission are notified via DM:

```
🔔 Approval Needed

Type: tweet
From: Mike
Product: ProofPing

Content:
"We just shipped the biggest update yet. Here's what's new..."

Reply with "approve approval_123" or "reject approval_123 [reason]"
```

## Approval Data

Approvals are stored in `~/.marketclaw/workspace/approvals.json`:

```json
{
  "requests": [
    {
      "id": "approval_1234_abc",
      "contentType": "tweet",
      "content": "We just shipped...",
      "productId": "proofping",
      "requestedBy": "user_456",
      "requestedByName": "Mike",
      "requestedAt": "2024-02-21T10:00:00.000Z",
      "status": "pending"
    }
  ]
}
```

## Status Flow

```
pending → approved → posted
       ↘ rejected
       ↘ expired (if expiresAt passed)
```

## Who Can Approve?

Members with the `approve_content` permission:
- **Admin** — Always
- **Manager** — Always
- **Creator** — No (can only request)
- **Viewer** — No

### Product-Specific Approvers

If a member has `manager` role for a specific product, they can approve content for that product:

```
Jane (manager for ProofPing, viewer for LaunchCrew):
  - Can approve ProofPing content ✓
  - Cannot approve LaunchCrew content ✗
```

## Example Workflows

### Tweet Approval

```
# Mike (creator) drafts
Mike: Write a tweet about our new pricing

Bot: "We just made our pricing simpler. Here's what changed..."

# Mike requests approval
Mike: Request approval

Bot: 📝 Approval requested! Notifying: Brett

# Brett (manager) gets notified and approves
Brett: approve approval_xyz

Bot: ✅ Approved!

# Brett posts
Brett: Post the approved tweet

Bot: ✅ Tweet posted!
```

### Email with Rejection

```
# Jane drafts an email
Jane: Draft an email to investors about our progress

Bot: Subject: Q4 Progress Update
     Hi [Name], ...

# Jane requests approval
Jane: Request approval for this email

Bot: 📝 Approval requested! Notifying: Brett

# Brett reviews and rejects
Brett: reject approval_abc Tone is too casual for investors

Bot: ❌ Rejected: Tone is too casual for investors

# Jane gets notified
Jane: (receives notification)
      Your email was rejected by Brett.
      Reason: Tone is too casual for investors
```

### Auto-Post After Approval

```
Mike: Request approval for this tweet, and post it automatically when approved

Bot: 📝 Approval requested with auto-post enabled

# When approved, it posts immediately
Brett: approve approval_xyz

Bot: ✅ Approved and posted!
```

## Expiration

Approvals can have an expiration time:

```
Mike: Request approval, expires in 24 hours

Bot: 📝 Approval requested! Expires in 24 hours.
```

After expiration, the request status becomes `expired` and must be resubmitted.

## Best Practices

1. **Clear Descriptions** — Include context with your approval requests
2. **Timely Reviews** — Don't let approvals sit too long
3. **Constructive Feedback** — When rejecting, explain why
4. **Check Pending** — Reviewers should check pending approvals regularly
5. **Product Tags** — Tag with product ID for proper routing

## Integration with Scheduling

You can schedule approved content:

```
Brett: Schedule the approved tweet for tomorrow at 9am

Bot: ✅ Scheduled for tomorrow 9:00 AM
```

Or request approval for scheduled content:

```
Mike: Schedule a tweet for tomorrow, pending approval

Bot: 📝 Scheduled content awaiting approval. Will post at 9:00 AM if approved.
```
