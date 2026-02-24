# Logging System

MarketClaw includes a structured logging system for debugging, monitoring, and troubleshooting.

## Overview

The logging system provides:
- **Structured JSON output** for easy parsing and searching
- **Correlation IDs** for tracking requests across components
- **Component-based logging** (tool, browser, api, agent)
- **Daily log rotation** with configurable retention
- **Session-level debug mode** for temporary verbose logging

## Log Levels

| Level | When to Use |
|-------|-------------|
| `debug` | Detailed diagnostic information (disabled by default) |
| `info` | General operational information |
| `warn` | Unexpected but recoverable situations |
| `error` | Failures that need attention |

### Setting Log Level

**Environment variable:**
```bash
LOG_LEVEL=debug marketclaw start
```

**Session debug mode:**
```
/debug on   # Enable debug logging for this session
/debug off  # Disable debug logging
/debug      # Toggle debug mode
```

## Log File Locations

All logs are stored in `~/.marketclaw/logs/`:

```
~/.marketclaw/logs/
├── marketclaw-2024-02-24.log
├── marketclaw-2024-02-23.log
└── marketclaw-2024-02-22.log
```

- Files are named by date: `marketclaw-YYYY-MM-DD.log`
- Default retention: 7 days
- Format: JSON lines (one JSON object per line)

## Correlation IDs

Each user session gets a unique correlation ID (8-character hex string). This ID is included in all log entries for that session, making it easy to trace a request through multiple components.

Example:
```json
{"level":"INFO","time":"2024-02-24T10:30:45.123Z","component":"tool","correlationId":"a1b2c3d4","tool":"generate_image","msg":"Tool execution started"}
{"level":"INFO","time":"2024-02-24T10:30:46.456Z","component":"api","correlationId":"a1b2c3d4","method":"POST","url":"https://api.openai.com/...","msg":"API request"}
{"level":"INFO","time":"2024-02-24T10:30:47.789Z","component":"tool","correlationId":"a1b2c3d4","tool":"generate_image","success":true,"msg":"Tool execution completed"}
```

To find all logs for a session:
```bash
marketclaw logs search "a1b2c3d4"
```

## CLI Commands

### List Log Files

```bash
marketclaw logs list
```

Output:
```
Log Directory: /Users/you/.marketclaw/logs

Log Files:

  marketclaw-2024-02-24.log
    Size: 45.2 KB, Modified: 2/24/2024, 10:30:00 AM
  marketclaw-2024-02-23.log
    Size: 123.4 KB, Modified: 2/23/2024, 11:45:00 PM
```

### Tail Logs

View recent log entries:

```bash
# Show last 50 lines (default)
marketclaw logs tail

# Show last 100 lines
marketclaw logs tail -n 100

# Tail a specific log file
marketclaw logs tail -f marketclaw-2024-02-23.log

# Output raw JSON (no formatting)
marketclaw logs tail --json
```

### Search Logs

Search across all log files:

```bash
# Basic search
marketclaw logs search "error"

# Filter by level
marketclaw logs search "api" -l error

# Filter by component
marketclaw logs search "timeout" -c browser

# Limit results
marketclaw logs search "generate_image" -n 20

# Output raw JSON
marketclaw logs search "correlation" --json
```

### Rotate Logs

Delete old log files:

```bash
# Delete logs older than 7 days (default)
marketclaw logs rotate

# Delete logs older than 3 days
marketclaw logs rotate -d 3

# Skip confirmation prompt
marketclaw logs rotate -d 7 -y
```

## Log Format Reference

Each log entry is a JSON object with these fields:

```json
{
  "level": "INFO",           // DEBUG, INFO, WARN, ERROR
  "time": "2024-02-24T10:30:45.123Z",
  "component": "tool",       // main, tool, browser, api, agent, toolLoop
  "correlationId": "a1b2c3d4", // Optional, session tracking
  "msg": "Human-readable message",
  
  // Additional fields vary by log type:
  "tool": "generate_image",  // Tool name
  "success": true,           // Operation result
  "durationMs": 1234,        // Execution time
  "error": "message",        // Error details
  // ... context-specific fields
}
```

### Component-Specific Fields

**Tool logs:**
- `tool`: Tool name
- `args`: Truncated arguments
- `success`: Boolean result
- `durationMs`: Execution time

**Browser logs:**
- `action`: Browser action (click, navigate, etc.)
- `url`: Page URL
- `selector`: CSS selector used
- `status`: start, complete, error

**API logs:**
- `method`: HTTP method
- `url`: Request URL
- `status`: HTTP status code
- `durationMs`: Request time
- `rateLimit`: Rate limit headers

**Agent logs:**
- `agentId`: Sub-agent ID
- `taskId`: Task identifier
- `taskSummary`: Task description

## Troubleshooting Tips

### Finding Errors

```bash
# Show all errors from today
marketclaw logs search "" -l error

# Show recent errors
marketclaw logs tail -n 100 | grep ERROR
```

### Tracing a Request

1. Get the correlation ID from the user's session
2. Search for all related logs:
   ```bash
   marketclaw logs search "a1b2c3d4"
   ```

### Debugging Tool Failures

```bash
# Find tool execution logs
marketclaw logs search "Tool execution" -c tool

# Find failed tools
marketclaw logs search "failed" -c tool -l error
```

### API Issues

```bash
# Find slow API calls
marketclaw logs search "durationMs" -c api

# Find rate limit issues
marketclaw logs search "rateLimit" -c api
```

### Browser Automation Issues

```bash
# Find navigation errors
marketclaw logs search "navigation" -c browser -l error

# Find selector issues
marketclaw logs search "selector" -c browser
```

## Common Log Queries

**Find all activity for a user session:**
```bash
marketclaw logs search "CORRELATION_ID"
```

**Find tool usage:**
```bash
marketclaw logs search "Tool execution started"
```

**Find API errors:**
```bash
marketclaw logs search "" -c api -l error
```

**Find slow operations (>5 seconds):**
```bash
marketclaw logs search "durationMs" | jq 'select(.durationMs > 5000)'
```

**Find browser navigation:**
```bash
marketclaw logs search "navigation" -c browser
```

**Count errors by component:**
```bash
cat ~/.marketclaw/logs/marketclaw-$(date +%Y-%m-%d).log | \
  jq -r 'select(.level == "ERROR") | .component' | \
  sort | uniq -c | sort -rn
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Global log level | `info` |
| `LOG_TO_FILE` | Force file logging in dev | `false` |
| `NODE_ENV` | Set to `production` for file logging | - |

## Programmatic Usage

For skill/tool developers:

```typescript
import { 
  createStructuredLogger,
  createToolLogger,
  createApiLogger,
  generateCorrelationId,
} from 'marketclaw/logging';

// Basic structured logger
const logger = createStructuredLogger('my-component');
logger.info('Operation started', { key: 'value' });
logger.error('Operation failed', { error: 'details' });

// Tool logger with specialized methods
const toolLog = createToolLogger(correlationId);
toolLog.toolStart('my_tool', args);
toolLog.toolEnd('my_tool', { success: true }, durationMs);
toolLog.toolError('my_tool', error, durationMs);

// API logger
const apiLog = createApiLogger(correlationId);
apiLog.request('POST', url, headers);
apiLog.response('POST', url, 200, durationMs);
apiLog.requestError('POST', url, error, durationMs);
```

## See Also

- [FAQ](./FAQ.md) — How do I debug issues?
- [Tools](./TOOLS.md) — Available tools
- [Architecture](./ARCHITECTURE.md) — System design
