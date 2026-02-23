## Raw Concept
**Task:**
Document multi-user management and content approval workflow

**Files:**
- src/team/manager.ts
- src/approvals/manager.ts

**Flow:**
Creator -> Request Approval -> Manager/Admin -> Approve/Reject -> Post

**Timestamp:** 2026-02-23

## Narrative
### Structure
Team management in src/team/ handles roles. Approval logic in src/approvals/ ensures quality control.

### Features
Roles: Admin (full access), Manager (approve/post), Creator (draft only), Viewer (read-only).

### Rules
1. Content drafted by Creators requires Manager or Admin approval.
2. Approvers are notified upon request.
