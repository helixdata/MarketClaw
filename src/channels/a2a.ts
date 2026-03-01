/**
 * A2A Channel
 * Enables MarketClaw to communicate with other agents via the A2A protocol
 * Uses @gopherhole/sdk for GopherHole hub connectivity
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { GopherHole, AgentCardConfig, MessagePayload, Task } from '@gopherhole/sdk';
import { Channel, ChannelConfig, ChannelMessage, ChannelResponse, MessageHandler } from './types.js';
import { channelRegistry } from './registry.js';

const logger = pino({ name: 'a2a-channel' });

/** A2A Skill schema */
export interface A2ASkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

/** A2A Agent Card */
export interface A2AAgentCard {
  name: string;
  description?: string;
  url?: string;
  version?: string;
  skills?: A2ASkill[];
}

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
  gopherhole?: {       // GopherHole hub integration
    enabled?: boolean;
    apiKey?: string;
    hubUrl?: string;   // Default: wss://hub.gopherhole.ai/ws
    agentCard?: A2AAgentCard;  // Full agent card with skills
    // Legacy fields (deprecated, use agentCard instead)
    agentId?: string;
    agentName?: string;
    description?: string;
    skills?: string[];
  };
  reconnectIntervalMs?: number;  // Base reconnect interval (default: 5000)
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
  
  // GopherHole SDK client
  private gopherholeClient: GopherHole | null = null;

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

    // Connect to GopherHole using SDK
    if (this.config.gopherhole?.enabled && this.config.gopherhole?.apiKey) {
      await this.connectToGopherHole();
    }

    logger.info({ agents: this.agents.size, hasHandler: !!this.messageHandler, gopherhole: this.isGopherHoleConnected() }, 'A2A channel started');
  }

  async stop(): Promise<void> {
    // Clear reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Disconnect GopherHole SDK
    if (this.gopherholeClient) {
      this.gopherholeClient.disconnect();
      this.gopherholeClient = null;
    }

    // Disconnect all direct agents
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

  /**
   * Connect to GopherHole using the SDK
   */
  private async connectToGopherHole(): Promise<void> {
    const gphConfig = this.config!.gopherhole!;
    const hubUrl = gphConfig.hubUrl || 'wss://hub.gopherhole.ai/ws';
    
    // Build agent card from config
    const agentCard: AgentCardConfig = gphConfig.agentCard ?? {
      name: gphConfig.agentName ?? 'MarketClaw',
      description: gphConfig.description ?? 'AI Marketing Agent for social media, content creation, and campaign management',
      version: '1.0.0',
      skills: [
        {
          id: 'marketing',
          name: 'Marketing Strategy',
          description: 'Create marketing strategies and campaign plans',
          tags: ['marketing', 'strategy', 'campaigns'],
          examples: ['Create a marketing plan for my product launch'],
          inputModes: ['text/plain'],
          outputModes: ['text/plain', 'text/markdown'],
        },
        {
          id: 'social',
          name: 'Social Media',
          description: 'Create and schedule social media content',
          tags: ['social', 'twitter', 'linkedin', 'content'],
          examples: ['Write a tweet about our new feature', 'Create a LinkedIn post'],
          inputModes: ['text/plain'],
          outputModes: ['text/plain'],
        },
        {
          id: 'content',
          name: 'Content Creation',
          description: 'Generate blog posts, articles, and marketing copy',
          tags: ['content', 'writing', 'copywriting', 'blog'],
          examples: ['Write a blog post about AI trends'],
          inputModes: ['text/plain'],
          outputModes: ['text/plain', 'text/markdown'],
        },
        {
          id: 'analytics',
          name: 'Analytics',
          description: 'Analyze marketing performance and provide insights',
          tags: ['analytics', 'metrics', 'reporting'],
          examples: ['Analyze my campaign performance'],
          inputModes: ['text/plain'],
          outputModes: ['text/plain', 'text/markdown'],
        },
      ],
    };

    // Create SDK client
    this.gopherholeClient = new GopherHole({
      apiKey: gphConfig.apiKey!,
      hubUrl,
      agentCard,
      autoReconnect: true,
      reconnectDelay: this.config?.reconnectIntervalMs ?? 5000,
    });

    // Set up event handlers
    this.gopherholeClient.on('connect', () => {
      logger.info({ agentId: this.gopherholeClient?.id }, 'Connected to GopherHole via SDK');
    });

    this.gopherholeClient.on('disconnect', (reason) => {
      logger.info({ reason }, 'Disconnected from GopherHole');
    });

    this.gopherholeClient.on('error', (error) => {
      logger.error({ error: error.message }, 'GopherHole SDK error');
    });

    this.gopherholeClient.on('message', (message) => {
      // Handle incoming message from another agent
      logger.info({ from: message.from, taskId: message.taskId }, 'Received message via GopherHole');
      
      const text = message.payload.parts
        ?.filter((p) => p.kind === 'text')
        .map((p) => p.text)
        .join('\n') ?? '';

      const channelMessage: ChannelMessage = {
        id: message.taskId || `gph-${Date.now()}`,
        userId: message.from,
        username: message.from,
        text,
        timestamp: new Date(message.timestamp),
        chatId: 'gopherhole',
        isGroup: false,
        metadata: {
          a2a: true,
          gopherhole: true,
        },
      };

      // Route to message handler
      if (this.messageHandler) {
        this.messageHandler(this, channelMessage).then((response) => {
          if (response && message.taskId) {
            // Reply via SDK
            this.gopherholeClient?.replyText(message.taskId, response.text).catch((err) => {
              logger.error({ error: err.message }, 'Failed to reply via GopherHole');
            });
          }
        }).catch((err) => {
          logger.error({ error: err }, 'Message handler error');
        });
      }
    });

    this.gopherholeClient.on('taskUpdate', (task) => {
      // Handle task status updates (for our outgoing requests)
      logger.debug({ taskId: task.id, status: task.status.state }, 'Task update received');
      
      const pending = this.pendingRequests.get(task.id);
      if (pending && (task.status.state === 'completed' || task.status.state === 'failed')) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(task.id);

        if (task.status.state === 'failed') {
          pending.reject(new Error(task.status.message ?? 'Task failed'));
        } else {
          const text = task.history
            ?.slice(-1)[0]?.parts
            ?.filter((p) => p.kind === 'text')
            .map((p) => p.text)
            .join('\n') ?? '';
          pending.resolve({ text, status: task.status.state });
        }
      }
    });

    // Connect
    try {
      await this.gopherholeClient.connect();
      logger.info('GopherHole SDK connected');
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Failed to connect to GopherHole via SDK');
      throw err;
    }
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
    // Don't schedule reconnect for gopherhole - SDK handles it
    if (agentId === 'gopherhole') return;
    
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
   * Send a message to another agent (direct connection)
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
    const result = Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      name: a.name,
      connected: a.connected,
    }));
    
    // Add gopherhole if SDK is connected
    if (this.gopherholeClient?.connected) {
      result.push({
        id: 'gopherhole',
        name: 'GopherHole Hub',
        connected: true,
      });
    }
    
    return result;
  }

  /**
   * Discover agents via GopherHole SDK
   */
  async discoverAgents(): Promise<Array<{ id: string; name: string; description?: string; skills: string[] }>> {
    if (!this.gopherholeClient) {
      return [];
    }

    try {
      const result = await this.gopherholeClient.discover({ limit: 50 });
      return result.agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description ?? undefined,
        skills: agent.tags || [],
      }));
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Error discovering agents via SDK');
      return [];
    }
  }

  /**
   * Check if GopherHole is connected
   */
  isGopherHoleConnected(): boolean {
    return this.gopherholeClient?.connected ?? false;
  }

  /**
   * Send a message to a remote agent via GopherHole SDK
   */
  async sendViaGopherHole(targetAgentId: string, text: string, contextId?: string): Promise<AgentResponse> {
    if (!this.gopherholeClient?.connected) {
      throw new Error('GopherHole not connected');
    }

    const task = await this.gopherholeClient.sendText(targetAgentId, text, { contextId });
    
    // If task already completed (synchronous response)
    if (task.status.state === 'completed' || task.status.state === 'failed') {
      if (task.status.state === 'failed') {
        throw new Error(task.status.message ?? 'Task failed');
      }
      const responseText = task.history
        ?.slice(-1)[0]?.parts
        ?.filter((p) => p.kind === 'text')
        .map((p) => p.text)
        .join('\n') ?? '';
      return { text: responseText, status: task.status.state };
    }

    // Wait for async response
    const timeoutMs = this.config?.reconnectIntervalMs ? this.config.reconnectIntervalMs * 60 : 300000;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(task.id);
        reject(new Error('GopherHole request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(task.id, { resolve, reject, timeout });
    });
  }

  // Channel interface methods
  async send(userId: string, response: ChannelResponse): Promise<void> {
    // Check if sending via GopherHole
    if (userId.includes('@') || this.gopherholeClient?.connected) {
      // userId might be an agent ID for GopherHole
      try {
        await this.gopherholeClient?.sendText(userId, response.text);
        return;
      } catch (err) {
        logger.warn({ error: (err as Error).message }, 'Failed to send via GopherHole, trying direct');
      }
    }

    // Direct agent connection
    const agent = this.agents.get(userId);
    if (!agent?.connected) {
      logger.warn({ agentId: userId }, 'Cannot send - agent not connected');
      return;
    }

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
    return !!(
      this.config?.bridgeUrl || 
      (this.config?.agents && this.config.agents.length > 0) ||
      (this.config?.gopherhole?.enabled && this.config.gopherhole?.apiKey)
    );
  }

  async validateConfig(config: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const c = config as A2AChannelConfig;
    if (!c.bridgeUrl && (!c.agents || c.agents.length === 0) && !c.gopherhole?.enabled) {
      return { valid: false, error: 'Either bridgeUrl, agents, or gopherhole must be configured' };
    }
    if (c.gopherhole?.enabled && !c.gopherhole.apiKey) {
      return { valid: false, error: 'GopherHole requires an API key' };
    }
    return { valid: true };
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }
  
  /**
   * Get the GopherHole SDK client (for direct SDK access if needed)
   */
  getGopherHoleClient(): GopherHole | null {
    return this.gopherholeClient;
  }
}

// Create and register the channel
export const a2aChannel = new A2AChannel();
channelRegistry.register(a2aChannel);
