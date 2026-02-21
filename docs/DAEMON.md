# Running MarketClaw as a Daemon

This guide covers running MarketClaw as a background service that starts automatically and stays running.

## Quick Start (Development)

```bash
# Simple background run with nohup
cd /path/to/marketclaw
nohup npx tsx src/cli.ts start > /tmp/marketclaw.log 2>&1 &

# Check if running
ps aux | grep marketclaw

# View logs
tail -f /tmp/marketclaw.log

# Stop
pkill -f "tsx src/cli.ts start"
```

---

## macOS (launchd)

### 1. Create the plist file

```bash
nano ~/Library/LaunchAgents/com.marketclaw.agent.plist
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.marketclaw.agent</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npx</string>
        <string>tsx</string>
        <string>src/cli.ts</string>
        <string>start</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/path/to/marketclaw</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
        <key>ANTHROPIC_API_KEY</key>
        <string>your-api-key</string>
        <key>TELEGRAM_BOT_TOKEN</key>
        <string>your-bot-token</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/tmp/marketclaw.log</string>
    
    <key>StandardErrorPath</key>
    <string>/tmp/marketclaw.error.log</string>
</dict>
</plist>
```

### 2. Load and start

```bash
# Load the service
launchctl load ~/Library/LaunchAgents/com.marketclaw.agent.plist

# Start immediately
launchctl start com.marketclaw.agent

# Check status
launchctl list | grep marketclaw

# View logs
tail -f /tmp/marketclaw.log
```

### 3. Management commands

```bash
# Stop
launchctl stop com.marketclaw.agent

# Unload (disable)
launchctl unload ~/Library/LaunchAgents/com.marketclaw.agent.plist

# Reload after changes
launchctl unload ~/Library/LaunchAgents/com.marketclaw.agent.plist
launchctl load ~/Library/LaunchAgents/com.marketclaw.agent.plist
```

---

## Linux (systemd)

### 1. Create the service file

```bash
sudo nano /etc/systemd/system/marketclaw.service
```

```ini
[Unit]
Description=MarketClaw AI Marketing Agent
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/marketclaw
ExecStart=/usr/bin/npx tsx src/cli.ts start
Restart=always
RestartSec=10

# Environment variables
Environment=NODE_ENV=production
Environment=ANTHROPIC_API_KEY=your-api-key
Environment=TELEGRAM_BOT_TOKEN=your-bot-token

# Or use an env file
# EnvironmentFile=/path/to/marketclaw/.env

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 2. Enable and start

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable marketclaw

# Start
sudo systemctl start marketclaw

# Check status
sudo systemctl status marketclaw
```

### 3. Management commands

```bash
# Stop
sudo systemctl stop marketclaw

# Restart
sudo systemctl restart marketclaw

# View logs
journalctl -u marketclaw -f

# View recent logs
journalctl -u marketclaw --since "1 hour ago"
```

---

## PM2 (Cross-Platform)

PM2 is a process manager that works on macOS, Linux, and Windows.

### 1. Install PM2

```bash
npm install -g pm2
```

### 2. Create ecosystem file

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'marketclaw',
    script: 'npx',
    args: 'tsx src/cli.ts start',
    cwd: '/path/to/marketclaw',
    
    // Environment
    env: {
      NODE_ENV: 'production',
      ANTHROPIC_API_KEY: 'your-api-key',
      TELEGRAM_BOT_TOKEN: 'your-bot-token',
    },
    
    // Restart policy
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    
    // Logging
    log_file: '/tmp/marketclaw-combined.log',
    out_file: '/tmp/marketclaw-out.log',
    error_file: '/tmp/marketclaw-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    
    // Memory management
    max_memory_restart: '500M',
  }]
};
```

### 3. Start with PM2

```bash
# Start
pm2 start ecosystem.config.js

# Or quick start without config
pm2 start "npx tsx src/cli.ts start" --name marketclaw

# Check status
pm2 status

# View logs
pm2 logs marketclaw
```

### 4. Auto-start on boot

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

### 5. Management commands

```bash
# Stop
pm2 stop marketclaw

# Restart
pm2 restart marketclaw

# Delete from PM2
pm2 delete marketclaw

# Monitor (live dashboard)
pm2 monit
```

---

## Docker

### 1. Create Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build if needed
# RUN npm run build

# Run
CMD ["npx", "tsx", "src/cli.ts", "start"]
```

### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  marketclaw:
    build: .
    container_name: marketclaw
    restart: unless-stopped
    
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    
    volumes:
      # Persist workspace data
      - marketclaw-data:/root/.marketclaw
    
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  marketclaw-data:
```

### 3. Run with Docker Compose

```bash
# Start (detached)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart
```

---

## Environment Variables

All methods require these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key |
| `OPENAI_API_KEY` | Yes* | OpenAI API key |
| `RESEND_API_KEY` | No | For email features |
| `TWITTER_COOKIES` | No | For Twitter features |

*At least one AI provider key required.

### Using .env files

Create a `.env` file:

```bash
TELEGRAM_BOT_TOKEN=your-token
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
```

Then source it or use `dotenv`:

```bash
# Bash
source .env && npx tsx src/cli.ts start

# Or install dotenv-cli
npx dotenv-cli -e .env -- npx tsx src/cli.ts start
```

---

## Health Checks

### Simple check

```bash
# Check if process is running
pgrep -f "marketclaw" && echo "Running" || echo "Not running"
```

### HTTP health endpoint (if implemented)

```bash
curl http://localhost:3000/health
```

### Watchdog script

```bash
#!/bin/bash
# Save as /usr/local/bin/marketclaw-watchdog.sh

if ! pgrep -f "tsx src/cli.ts start" > /dev/null; then
    echo "$(date) - MarketClaw not running, restarting..."
    cd /path/to/marketclaw
    nohup npx tsx src/cli.ts start >> /tmp/marketclaw.log 2>&1 &
fi
```

Add to crontab:

```bash
# Check every 5 minutes
*/5 * * * * /usr/local/bin/marketclaw-watchdog.sh
```

---

## Troubleshooting

### Process keeps dying

1. Check logs for errors:
   ```bash
   tail -100 /tmp/marketclaw.log
   ```

2. Check memory usage:
   ```bash
   ps aux | grep marketclaw
   ```

3. Run in foreground to see errors:
   ```bash
   npx tsx src/cli.ts start
   ```

### Can't connect to Telegram

1. Verify bot token is correct
2. Check network/firewall
3. Ensure only one instance is running (Telegram allows one connection per token)

### Permission denied

```bash
# Fix file permissions
chmod +x src/cli.ts
chmod 600 .env  # Protect secrets
```

### Node version issues

```bash
# Check Node version (requires 20+)
node --version

# Use nvm to switch
nvm use 20
```

---

## Recommended Setup

| Environment | Recommendation |
|-------------|----------------|
| **Development** | `nohup` or foreground |
| **macOS Production** | launchd |
| **Linux Production** | systemd |
| **Multi-platform / VPS** | PM2 |
| **Containers / Cloud** | Docker |

For most users, **PM2** offers the best balance of simplicity and features.
