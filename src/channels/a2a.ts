/**
 * A2A Channel
 * Enables MarketClaw to communicate with other agents via the A2A protocol
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { Channel, ChannelConfig, ChannelMessage, ChannelResponse, MessageHandler } from './types.js';
import { channelRegistry } from './registry.js';

const logger = pino({ name: 'a2a-channel' });

export interface A2AChannelConfig extends ChannelConfig {
  bridgeUrl?: string;  // URL of A2A bridge (ws://...)
  agents?: Array<{     // Direct agent connections (no bridge)
    id: string;
    url: string;
    name?: string;
  }>;
  auth?: {
    token?: string;
  };
}

interface PendingRequest {
  resolve: (response: AgentResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface AgentConnection {
  id: string;
  name: string;
  url: string;
  ws: WebSocket | null;
  connected: boolean;
}

interface AgentMessage {
  type: 'message' | 'response' | 'chunk' | 'status';
  taskId: string;
  contextId?: string;
  from?: string;
  content?: {
    parts: Array<{ kind: string; text?: string }>;
  };
  status?: string;
  error?: string;
}

interface AgentResponse {
  text: string;
  status: string;
}

export class A2AChannel implements Channel {
  readonly name = 'a2a';
  readonly displayName = 'A2A Protocol';
  readonly description = 'Communicate with other AI agents via A2A';
  readonly requiredConfig: string[] = [];
  readonly optionalConfig = ['bridgeUrl', 'agents', 'auth'];
  readonly requiredEnv: string[] = [];

  private config: A2AChannelConfig | null = null;
  private agents: Map<string, AgentConnection> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageHandler: MessageHandler | null = null;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config as A2AChannelConfig;
    logger.info('A2A channel initialized');
  }

  async start(): Promise<void> {
    if (!this.config) {
      throw new Error('Channel not initialized');
    }

    // Get the message handler from registry
    const { channelRegistry } = await import('./registry.js');
    const handler = channelRegistry.getMessageHandler();
    if (handler) {
      this.setMessageHandler(handler);
      logger.info('Message handler set from registry');
    } else {
      logger.warn('No message handler available from registry');
    }

    // Connect to configured agents
    if (this.config.agents) {
      for (const agentConfig of this.config.agents) {
        await this.connectToAgent(agentConfig.id, agentConfig.url, agentConfig.name);
      }
    }

    // Connect to bridge if configured
    if (this.config.bridgeUrl) {
      await this.connectToBridge(this.config.bridgeUrl);
    }

    logger.info({ agents: this.agents.size, hasHandler: !!this.messageHandler }, 'A2A channel started');
  }

  async stop(): Promise<void> {
    // Clear reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Disconnect all agents
    for (const agent of this.agents.values()) {
      if (agent.ws) {
        agent.ws.close();
      }
    }
    this.agents.clear();

    logger.info('A2A channel stopped');
  }

  private async connectToAgent(id: string, url: string, name?: string): Promise<void> {
    const agent: AgentConnection = {
      id,
      name: name ?? id,
      url,
      ws: null,
      connected: false,
    };

    try {
      await this.establishConnection(agent);
      this.agents.set(id, agent);
      logger.info({ agentId: id, url }, 'Connected to agent');
    } catch (err) {
      logger.error({ agentId: id, error: (err as Error).message }, 'Failed to connect to agent');
      this.agents.set(id, agent);
      this.scheduleReconnect(id);
    }
  }

  private async connectToBridge(url: string): Promise<void> {
    // Bridge connection - treats bridge as a special agent that routes to others
    await this.connectToAgent('bridge', url, 'A2A Bridge');
  }

  private async establishConnection(agent: AgentConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(agent.url);

      ws.on('open', () => {
        agent.ws = ws;
        agent.connected = true;
        
        // Announce ourselves to the bridge/agent
        const announce = {
          type: 'announce',
          agent: {
            id: 'marketclaw',
            name: 'MarketClaw',
            description: 'AI Marketing Agent',
            skills: ['marketing', 'social', 'content'],
          },
        };
        ws.send(JSON.stringify(announce));
        
        resolve();
      });

      ws.on('message', (data) => {
        logger.info({ agentId: agent.id, dataLength: data.toString().length }, 'WebSocket message received');
        try {
          const message = JSON.parse(data.toString()) as AgentMessage;
          logger.info({ agentId: agent.id, type: message.type }, 'Parsed message');
          this.handleAgentMessage(agent.id, message);
        } catch (err) {
          logger.error({ agentId: agent.id, error: err, raw: data.toString().slice(0, 200) }, 'Failed to parse message');
        }
      });

      ws.on('close', () => {
        agent.connected = false;
        agent.ws = null;
        logger.info({ agentId: agent.id }, 'Agent disconnected');
        this.scheduleReconnect(agent.id);
      });

      ws.on('error', (err) => {
        logger.error({ agentId: agent.id, error: err.message }, 'WebSocket error');
        reject(err);
      });
    });
  }

  private scheduleReconnect(agentId: string): void {
    if (this.reconnectTimers.has(agentId)) return;

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(agentId);
      const agent = this.agents.get(agentId);
      if (agent && !agent.connected) {
        try {
          await this.establishConnection(agent);
          logger.info({ agentId }, 'Reconnected to agent');
        } catch {
          this.scheduleReconnect(agentId);
        }
      }
    }, 5000);

    this.reconnectTimers.set(agentId, timer);
  }

  private handleAgentMessage(agentId: string, message: AgentMessage): void {
    logger.info({ agentId, type: message.type, taskId: message.taskId, from: message.from }, 'handleAgentMessage called');
    
    // Handle responses to our requests
    if (message.type === 'response' || message.status === 'completed' || message.status === 'failed') {
      const pending = this.pendingRequests.get(message.taskId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.taskId);

        if (message.status === 'failed' || message.error) {
          pending.reject(new Error(message.error ?? 'Task failed'));
        } else {
          const text = message.content?.parts
            ?.filter((p) => p.kind === 'text')
            .map((p) => p.text)
            .join('\n') ?? '';
          pending.resolve({ text, status: message.status ?? 'completed' });
        }
      }
      return;
    }

    // Handle incoming messages from other agents (they initiated)
    if (message.type === 'message' && message.from) {
      const channelMessage: ChannelMessage = {
        id: message.taskId,
        userId: message.from,
        username: message.from,
        text: message.content?.parts
          ?.filter((p) => p.kind === 'text')
          .map((p) => p.text)
          .join('\n') ?? '',
        timestamp: new Date(),
        chatId: agentId,
        isGroup: false,
        metadata: {
          a2a: true,
          contextId: message.contextId,
        },
      };

      // Route to message handler
      logger.info({ hasHandler: !!this.messageHandler, text: channelMessage.text }, 'Routing to message handler');
      if (this.messageHandler) {
        this.messageHandler(this, channelMessage).then((response) => {
          logger.info({ hasResponse: !!response, responseText: response?.text?.slice(0, 100) }, 'Handler returned');
          if (response) {
            this.sendResponse(agentId, message.taskId, response.text, message.contextId);
          }
        }).catch((err) => {
          logger.error({ error: err }, 'Message handler error');
        });
      } else {
        logger.warn('No message handler set - cannot process A2A message');
      }
    }
  }

  private sendResponse(agentId: string, taskId: string, text: string, contextId?: string): void {
    const agent = this.agents.get(agentId);
    if (!agent?.ws || !agent.connected) {
      logger.warn({ agentId }, 'Cannot send response - agent not connected');
      return;
    }

    const response: AgentMessage = {
      type: 'response',
      taskId,
      contextId,
      content: {
        parts: [{ kind: 'text', text }],
      },
      status: 'completed',
    };

    agent.ws.send(JSON.stringify(response));
  }

  /**
   * Send a message to another agent
   */
  async sendToAgent(agentId: string, message: string, contextId?: string): Promise<AgentResponse> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    if (!agent.connected || !agent.ws) {
      throw new Error(`Agent ${agentId} not connected`);
    }

    const taskId = uuidv4();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(taskId);
        reject(new Error('Request timeout'));
      }, 300000); // 5 minute timeout

      this.pendingRequests.set(taskId, { resolve, reject, timeout });

      const msg: AgentMessage = {
        type: 'message',
        taskId,
        contextId,
        from: 'marketclaw',
        content: {
          parts: [{ kind: 'text', text: message }],
        },
      };

      agent.ws!.send(JSON.stringify(msg));
      logger.debug({ agentId, taskId }, 'Sent message to agent');
    });
  }

  /**
   * List available agents
   */
  listAgents(): Array<{ id: string; name: string; connected: boolean }> {
    return Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      name: a.name,
      connected: a.connected,
    }));
  }

  /**
   * Discover agents (from bridge)
   */
  async discoverAgents(): Promise<Array<{ id: string; name: string; skills: string[] }>> {
    // TODO: Implement discovery via bridge or direct A2A protocol
    return [];
  }

  // Channel interface methods
  async send(userId: string, response: ChannelResponse): Promise<void> {
    // userId is the agentId in A2A context
    const agent = this.agents.get(userId);
    if (!agent?.connected) {
      logger.warn({ agentId: userId }, 'Cannot send - agent not connected');
      return;
    }

    // For A2A, we need a taskId context - this is for unsolicited messages
    const taskId = uuidv4();
    const msg: AgentMessage = {
      type: 'message',
      taskId,
      from: 'marketclaw',
      content: {
        parts: [{ kind: 'text', text: response.text }],
      },
    };

    agent.ws!.send(JSON.stringify(msg));
  }

  isConfigured(): boolean {
    return !!(this.config?.bridgeUrl || (this.config?.agents && this.config.agents.length > 0));
  }

  async validateConfig(config: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const c = config as A2AChannelConfig;
    if (!c.bridgeUrl && (!c.agents || c.agents.length === 0)) {
      return { valid: false, error: 'Either bridgeUrl or agents must be configured' };
    }
    return { valid: true };
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }
}

// Create and register the channel
export const a2aChannel = new A2AChannel();
channelRegistry.register(a2aChannel);
