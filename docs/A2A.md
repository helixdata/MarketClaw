# A2A (Agent-to-Agent) Protocol

MarketClaw supports the A2A protocol for communicating with other AI agents. This enables multi-agent collaboration where specialized agents can work together on complex tasks.

## Overview

The A2A channel allows MarketClaw to:
- **Receive messages** from other agents and respond
- **Send messages** to other agents and await responses
- **Connect to an A2A Bridge** for centralized agent discovery and routing

## Configuration

Add to your `config.yaml`:

```yaml
channels:
  a2a:
    enabled: true
    bridgeUrl: ws://localhost:8081/ws    # A2A bridge WebSocket URL
    # Or connect directly to specific agents:
    # agents:
    #   - id: nova
    #     url: ws://localhost:9000/a2a
    #     name: Nova
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable/disable the A2A channel |
| `bridgeUrl` | string | WebSocket URL of the A2A bridge |
| `agents` | array | Direct agent connections (alternative to bridge) |
| `agents[].id` | string | Agent identifier |
| `agents[].url` | string | Agent WebSocket URL |
| `agents[].name` | string | Display name (optional) |

## Protocol

### Message Format

All messages follow the A2A protocol format:

```typescript
interface A2AMessage {
  type: 'message' | 'response' | 'chunk' | 'status';
  taskId: string;        // UUID for request/response correlation
  contextId?: string;    // Optional conversation thread ID
  from?: string;         // Sender agent ID
  content?: {
    parts: Array<{ kind: string; text?: string }>;
  };
  status?: 'working' | 'completed' | 'failed' | 'canceled';
  error?: string;
}
```

### Message Types

| Type | Description |
|------|-------------|
| `message` | Incoming request from another agent |
| `response` | Final response to a request |
| `chunk` | Streaming partial response |
| `status` | Status update for long-running tasks |

### Agent Announcement

When connecting to a bridge or agent, MarketClaw sends an announcement:

```json
{
  "type": "announce",
  "agent": {
    "id": "marketclaw",
    "name": "MarketClaw",
    "description": "AI Marketing Agent",
    "skills": ["marketing", "social", "content"]
  }
}
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Nova     │────▶│  A2A Bridge │◀────│ MarketClaw  │
│  (Clawdbot) │     │   (Hub)     │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                   WebSocket connections
```

### Connection Flow

1. Agent connects to bridge via WebSocket
2. Agent sends `announce` message with its identity
3. Bridge registers agent and confirms with `registered` message
4. Agent can now send/receive messages through the bridge

### Message Routing

1. External agent sends message via bridge HTTP API or WebSocket
2. Bridge routes message to MarketClaw
3. MarketClaw processes message through its agent pipeline
4. Response is sent back through the bridge

## Usage Examples

### Receiving Messages from Other Agents

When another agent sends a message to MarketClaw:

```
Nova → Bridge → MarketClaw: "What products do we have?"
MarketClaw → Bridge → Nova: "Here are our 11 products..."
```

MarketClaw processes the message just like any other channel (Telegram, Discord, etc.) and responds with the same capabilities.

### Sending Messages to Other Agents

```typescript
// Using the A2A channel programmatically
const a2aChannel = channelRegistry.get('a2a') as A2AChannel;
const response = await a2aChannel.sendToAgent('nova', 'Please review this content');
console.log(response.text);
```

## Bridge API

When using an A2A bridge, these HTTP endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agents` | GET | List connected agents |
| `/agents/:id` | GET | Get agent details |
| `/agents/:id/message` | POST | Send message to agent |
| `/a2a/jsonrpc` | POST | A2A JSON-RPC endpoint |
| `/.well-known/agent-card.json` | GET | Bridge agent card |

### Example: Send Message via Bridge API

```bash
curl -X POST http://localhost:8080/agents/marketclaw/message \
  -H "Content-Type: application/json" \
  -d '{"message": "What products do we have?", "from": "nova"}'
```

Response:
```json
{
  "taskId": "8f6987ef-98ca-479e-85b0-24778d9a3964",
  "status": "completed",
  "response": {
    "parts": [{"kind": "text", "text": "Here are our products..."}]
  }
}
```

## Error Handling

### Connection Errors

The A2A channel automatically reconnects with exponential backoff:
- Initial delay: 5 seconds
- Max delay: 60 seconds
- Unlimited retry attempts

### Message Errors

Failed messages return with `status: 'failed'` and an `error` field:

```json
{
  "type": "response",
  "taskId": "...",
  "status": "failed",
  "error": "Agent timeout"
}
```

## Security Considerations

1. **Authentication**: Configure bridge authentication tokens for production
2. **Agent Verification**: Validate agent IDs before processing sensitive requests
3. **Rate Limiting**: Implement rate limiting at the bridge level
4. **Message Validation**: Validate all incoming message formats

## Troubleshooting

### "No message handler set"

The A2A channel must be started after the main message handler is configured. Ensure channels are started in the correct order.

### "Agent not connected"

Check that:
1. The bridge is running (`curl http://localhost:8080/agents`)
2. WebSocket URL is correct in config
3. No firewall blocking the connection

### Messages not being received

Enable debug logging:
```yaml
logging:
  level: debug
```

Check for:
- WebSocket connection status
- Message parsing errors
- Handler registration

## Related Documentation

- [Channels Overview](./CHANNELS.md)
- [Architecture](./ARCHITECTURE.md)
- [API Reference](./API.md)
