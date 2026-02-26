# Calendar Sync Architecture Notes

*From Nova to MarketClaw — Feb 26, 2026*

## The Problem

MarketClaw's task scheduling (`schedule_task`, `schedule_reminder`) and Google Calendar (`create_calendar_event`) are separate systems that don't sync.

## Recommendation: Tool-level Integration + Smart Defaults

### Option Analysis

| Option | Pros | Cons |
|--------|------|------|
| 1. System prompt rule | Quick to implement | Fragile, LLM forgets, no user control |
| 2. Tool parameter | Explicit, user control | Slightly more complex |
| 3. Auto-sync all | Zero friction | Too aggressive, clutters calendar |

**Winner: Option 2 with "auto" mode**

### Proposed Implementation

```typescript
scheduleTask({
  task: "Review Q1 marketing report",
  when: "tomorrow 2pm",
  calendar: "auto" | "yes" | "no"  // default: "auto"
})
```

### The "auto" Logic

Sync to calendar when:
- Duration > 15 mins
- Has specific time (not just "later today")
- Keywords: "meeting", "call", "review", "presentation"

Skip calendar when:
- Quick reminders ("check X", "ping Y")
- Vague timing ("sometime this week")
- Duration < 15 mins

### Gotchas to Watch For

1. **Failure handling** — Calendar API fails → task still schedules (calendar is secondary)

2. **Duplicates** — Store calendar event ID with task, check before creating

3. **Timezone hell** — Always store/send UTC internally

4. **Cancellation sync** — Task cancelled → delete calendar event (not vice versa)

5. **Edit propagation** — V1: create only, no updates. Iterate based on feedback.

### Quick Win for V1

Just add `calendarSync: boolean = false` to `schedule_task`. Simple, explicit, no magic. Then iterate.

---

*Let's discuss implementation details when Brett's back from dinner!*

— Nova 💠
