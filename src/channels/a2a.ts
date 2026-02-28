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

    // Connect to GopherHole if configured
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

  private async connectToGopherHole(): Promise<void> {
    const gphConfig = this.config!.gopherhole!;
    const hubUrl = gphConfig.hubUrl || 'wss://gopherhole.helixdata.workers.dev/ws';
    
    const agent: AgentConnection = {
      id: 'gopherhole',
      name: 'GopherHole Hub',
      url: hubUrl,
      ws: null,
      connected: false,
    };

    try {
      await this.establishGopherHoleConnection(agent, gphConfig.apiKey!);
      this.agents.set('gopherhole', agent);
      logger.info('Connected to GopherHole Hub');
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Failed to connect to GopherHole');
      this.agents.set('gopherhole', agent);
      this.scheduleReconnect('gopherhole');
    }
  }

  private async establishGopherHoleConnection(agent: AgentConnection, apiKey: string): Promise<void> {
    const gphConfig = this.config?.gopherhole;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(agent.url);

      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('GopherHole connection timeout'));
      }, 10000);

      ws.on('open', () => {
        logger.info('GopherHole connected, authenticating...');
        
        // Build agent card from config or use defaults
        const agentCard: A2AAgentCard = gphConfig?.agentCard ?? {
          name: gphConfig?.agentName ?? 'MarketClaw',
          description: gphConfig?.description ?? 'AI Marketing Agent for social media, content creation, and campaign management',
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
        
        // Send auth with full agent card
        ws.send(JSON.stringify({
          type: 'auth',
          token: apiKey,
          agentCard,
        }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          if (msg.type === 'welcome') {
            clearTimeout(timeout);
            agent.ws = ws;
            agent.connected = true;
            logger.info({ agentId: msg.agentId }, 'GopherHole authenticated');
            resolve();
          } else if (msg.type === 'auth_error') {
            clearTimeout(timeout);
            reject(new Error(msg.error || 'GopherHole auth failed'));
          } else if (msg.type === 'message') {
            // Incoming message from another agent via GopherHole
            const a2aMsg: AgentMessage = {
              type: 'message',
              taskId: msg.taskId || msg.id || `gph-${Date.now()}`,
              from: msg.from,
              content: msg.payload,
              contextId: msg.payload?.contextId,
            };
            this.handleAgentMessage('gopherhole', a2aMsg);
          } else if (msg.type === 'response') {
            // Response to our request from another agent
            const a2aMsg: AgentMessage = {
              type: 'response',
              taskId: msg.taskId || msg.id,
              from: msg.from,
              content: msg.content,
              status: msg.status || 'completed',
            };
            this.handleAgentMessage('gopherhole', a2aMsg);
          } else if (msg.type === 'ack') {
            // Message acknowledged
            logger.debug({ taskId: msg.id }, 'GopherHole message acknowledged');
          } else if (msg.type === 'error') {
            logger.error({ error: msg.error }, 'GopherHole error');
          }
        } catch (err) {
          logger.error({ error: err, raw: data.toString().slice(0, 200) }, 'Failed to parse GopherHole message');
        }
      });

      ws.on('close', (code, reason) => {
        agent.connected = false;
        agent.ws = null;
        logger.info({ code, reason: reason?.toString() }, 'Disconnected from GopherHole');
        this.scheduleReconnect('gopherhole');
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        logger.error({ error: err.message }, 'GopherHole WebSocket error');
        if (!agent.connected) {
          reject(err);
        }
      });
    });
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
  async discoverAgents(): Promise<Array<{ id: string; name: string; description?: string; skills: string[] }>> {
    // Discover agents via GopherHole API
    const gphConfig = this.config?.gopherhole;
    if (!gphConfig?.enabled) {
      return [];
    }

    try {
      const hubUrl = gphConfig.hubUrl || 'wss://gopherhole.ai/ws';
      // Convert ws:// to https:// for API calls
      const apiBase = hubUrl.replace('wss://', 'https://').replace('ws://', 'http://').replace('/ws', '');
      
      const response = await fetch(`${apiBase}/api/discover/agents`);
      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to discover agents from GopherHole');
        return [];
      }

      const data = await response.json() as { agents: Array<{
        id: string;
        name: string;
        description?: string;
        category?: string;
        tags?: string[];
      }> };

      return data.agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        skills: agent.tags || [],
      }));
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Error discovering agents');
      return [];
    }
  }

  /**
   * Check if GopherHole is connected
   */
  isGopherHoleConnected(): boolean {
    return this.agents.get('gopherhole')?.connected ?? false;
  }

  /**
   * Send a message to a remote agent via GopherHole
   */
  async sendViaGopherHole(targetAgentId: string, text: string, contextId?: string): Promise<AgentResponse> {
    const gphConn = this.agents.get('gopherhole');
    if (!gphConn?.connected || !gphConn.ws) {
      throw new Error('GopherHole not connected');
    }

    const taskId = uuidv4();
    const timeoutMs = this.config?.reconnectIntervalMs ? this.config.reconnectIntervalMs * 60 : 300000;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(taskId);
        reject(new Error('GopherHole request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(taskId, { resolve, reject, timeout });

      // GopherHole message format
      const msg = {
        type: 'message',
        id: taskId,
        to: targetAgentId,
        payload: {
          parts: [{ kind: 'text', text }],
          contextId,
        },
      };

      gphConn.ws!.send(JSON.stringify(msg));
      logger.debug({ targetAgentId, taskId }, 'Sent message via GopherHole');
    });
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
}

// Create and register the channel
export const a2aChannel = new A2AChannel();
channelRegistry.register(a2aChannel);
