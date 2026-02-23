## Raw Concept
**Task:**
Document background process management and daemonization strategies

**Files:**
- docs/DAEMON.md

**Timestamp:** 2026-02-23

## Narrative
### Structure
MarketClaw supports multiple daemonization strategies for background execution across different platforms (macOS, Linux, Docker, PM2).

### Features
Auto-restart on failure, boot-time startup, log rotation, and memory-based restarts.

### Rules
Recommended Setup by Environment:
| Environment | Recommendation |
|-------------|----------------|
| Development | nohup or foreground |
| macOS Production | launchd |
| Linux Production | systemd |
| Multi-platform / VPS | PM2 |
| Containers / Cloud | Docker |

PM2 Quick Start:
1. `npm install -g pm2`
2. `pm2 start "npx tsx src/cli.ts start" --name marketclaw`
3. `pm2 save` to persist across reboots.

### Examples
PM2 Ecosystem Config Example:
```javascript
module.exports = {
  apps: [{
    name: 'marketclaw',
    script: 'npx',
    args: 'tsx src/cli.ts start',
    env: {
      NODE_ENV: 'production',
      ANTHROPIC_API_KEY: 'your-api-key',
      TELEGRAM_BOT_TOKEN: 'your-bot-token',
    },
    autorestart: true,
    max_memory_restart: '500M',
  }]
};
```
