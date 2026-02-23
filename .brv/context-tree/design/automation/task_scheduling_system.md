## Raw Concept
**Task:**
Document the automated task scheduling and management system

**Files:**
- src/tools/scheduler-tools.ts
- src/scheduler/index.ts

**Flow:**
Tool.execute(params) -> Scheduler.parseToCron(when) -> scheduler.addJob(config) -> Cron Job -> AI Execution/Notification

**Timestamp:** 2026-02-23

## Narrative
### Structure
The Task Scheduling System (src/tools/scheduler-tools.ts) allows the agent to schedule future actions. It utilizes a central `scheduler` instance to manage jobs, which are persisted and executed based on cron expressions.

### Features
General task scheduling (`schedule_task`), reminder management (`schedule_reminder`), job listing, pausing/resuming, and immediate execution (`run_job_now`).

### Rules
1. `schedule_task` is the primary tool for all automated actions (posts, emails, checks).
2. `schedule_post` was removed to save tokens and consolidate logic into `schedule_task`.
3. Schedules can be provided in natural language (e.g., "every day at 9am") and are parsed into cron expressions.
4. Tasks can be associated with specific products or campaigns for context.

### Examples
Available Scheduler Tools:
| Tool Name | Description |
| :--- | :--- |
| `schedule_task` | Schedule any AI-driven automated task (posts, emails, reports) |
| `schedule_reminder` | Set a Telegram reminder |
| `list_scheduled_jobs` | List all active/paused jobs with filters |
| `cancel_scheduled_job` | Permanently delete a job |
| `pause_scheduled_job` | Temporarily disable a job |
| `resume_scheduled_job` | Re-enable a paused job |
| `run_job_now` | Execute a job immediately regardless of schedule |
