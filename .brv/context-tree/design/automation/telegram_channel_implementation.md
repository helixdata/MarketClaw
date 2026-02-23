## Raw Concept
**Task:**
Document the Telegram channel implementation and UX improvements

**Files:**
- src/channels/telegram.ts

**Flow:**
User Message -> Telegram Webhook -> Middleware (Auth/Team) -> startTypingIndicator -> Message Handler -> Provider/Tools -> stopTyping -> Channel.send

**Timestamp:** 2026-02-23

## Narrative
### Structure
The `TelegramChannel` (src/channels/telegram.ts) is the primary interaction interface. It uses the `Telegraf` library and includes custom middleware for team-based authentication and UX enhancements like persistent typing indicators.

### Features
Support for text, photos (vision), and documents (PDF/Word), inline button keyboards, automatic Markdown fallback, and persistent typing indicators for long-running AI operations.

### Rules
1. Users must be in the `allowedUsers` config (if set) AND registered as team members in `teamManager`.
2. The typing indicator expires after ~5 seconds; `startTypingIndicator()` refreshes it every 4 seconds via `setInterval`.
3. Photo messages automatically download the highest resolution version for processing.
4. Document messages support PDF, Word (.docx/.doc), and text files via `documentParser`.

### Examples
Typing Indicator Helper:
```typescript
function startTypingIndicator(ctx: any): () => void {
  const sendTyping = async () => {
    await ctx.sendChatAction('typing');
  };
  sendTyping();
  const interval = setInterval(sendTyping, 4000);
  return () => clearInterval(interval);
}
```
