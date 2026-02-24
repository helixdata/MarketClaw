/**
 * Extension Bridge
 * 
 * WebSocket server that communicates with the MarketClaw browser extension
 * for automated social media posting.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { createServer } from 'http';
import { createBrowserLogger, type BrowserLogger } from '../logging/index.js';

const DEFAULT_PORT = 7890;

interface ExtensionClient {
  ws: WebSocket;
  version: string;
  profile: string;
  capabilities: any;
  connectedAt: Date;
}

interface BridgeMessage {
  id?: string;
  type?: string;
  action?: string;
  [key: string]: any;
}

interface BridgeResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  result?: any;
}

export class ExtensionBridge extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ExtensionClient> = new Map();
  private port: number;
  private pendingRequests: Map<string, {
    resolve: (value: BridgeResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    startTime: number;
    action: string;
  }> = new Map();
  private logger: BrowserLogger;

  constructor(port: number = DEFAULT_PORT) {
    super();
    this.port = port;
    this.logger = createBrowserLogger();
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = createServer();
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws) => {
          this.handleConnection(ws);
        });

        this.wss.on('error', (err) => {
          this.logger.error('WebSocket server error', { error: err.message });
          this.emit('error', err);
        });

        server.listen(this.port, () => {
          this.logger.info('WebSocket server started', { port: this.port });
          this.emit('ready');
          resolve();
        });

        server.on('error', reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (this.wss) {
      // Close all client connections
      for (const client of this.clients.keys()) {
        client.close();
      }
      this.clients.clear();

      // Close the server
      return new Promise((resolve) => {
        this.wss?.close(() => {
          this.wss = null;
          resolve();
        });
      });
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    this.logger.info('Client connected');

    ws.on('message', (data) => {
      try {
        const message: BridgeMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (err) {
        this.logger.error('Invalid message received', { 
          error: err instanceof Error ? err.message : String(err) 
        });
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      this.logger.info('Client disconnected');
      this.emit('disconnect');
    });

    ws.on('error', (err) => {
      this.logger.error('Client error', { error: err.message });
    });
  }

  /**
   * Handle incoming message from extension
   */
  private handleMessage(ws: WebSocket, message: BridgeMessage): void {
    // Handle handshake
    if (message.type === 'handshake') {
      const profile = message.profile || 'Default';
      this.clients.set(ws, {
        ws,
        version: message.version || 'unknown',
        profile,
        capabilities: message.capabilities || {},
        connectedAt: new Date(),
      });
      this.logger.info('Client registered', { 
        profile, 
        version: message.version,
        capabilities: message.capabilities,
      });
      this.emit('connect', this.clients.get(ws));
      return;
    }

    // Handle response to pending request
    if (message.type === 'response' && message.id) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        const durationMs = Date.now() - pending.startTime;
        
        const success = message.success ?? false;
        this.logger.commandResponse(pending.action, success, durationMs, {
          requestId: message.id,
          error: message.error,
        });
        
        pending.resolve({
          success,
          message: message.message,
          error: message.error,
          data: message.data,
          result: message.result,
        });
      }
      return;
    }

    // Emit other messages as events
    this.emit('message', message);
  }

  /**
   * Send a command to the extension and wait for response
   * @param command - The command to send
   * @param timeoutMs - Timeout in milliseconds
   * @param profile - Optional profile name to target a specific browser profile
   */
  async send(command: BridgeMessage, timeoutMs: number = 30000, profile?: string): Promise<BridgeResponse> {
    const client = profile ? this.getClientByProfile(profile) : this.getActiveClient();
    if (!client) {
      const error = profile 
        ? `No extension connected for profile "${profile}". Connected profiles: ${this.getConnectedProfiles().join(', ') || 'none'}`
        : 'No extension connected';
      this.logger.warn('Cannot send command - no client', { action: command.action, profile, error });
      return { success: false, error };
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message = { ...command, id };
    const action = command.action || 'unknown';
    const startTime = Date.now();

    this.logger.commandSent(action, { 
      requestId: id, 
      profile: client.profile,
      platform: command.platform,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.logger.commandResponse(action, false, Date.now() - startTime, { 
          requestId: id, 
          error: 'Request timeout' 
        });
        resolve({ success: false, error: 'Request timeout' });
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout, startTime, action });
      client.ws.send(JSON.stringify(message));
    });
  }
  
  /**
   * Get client by profile name
   */
  private getClientByProfile(profile: string): ExtensionClient | null {
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN && client.profile === profile) {
        return client;
      }
    }
    return null;
  }
  
  /**
   * Get list of connected profile names
   */
  getConnectedProfiles(): string[] {
    const profiles: string[] = [];
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        profiles.push(client.profile);
      }
    }
    return profiles;
  }

  /**
   * Post content to a social platform
   */
  async post(platform: string, content: string, mediaUrls?: string[]): Promise<BridgeResponse> {
    return this.send({
      action: 'post',
      platform,
      content,
      mediaUrls,
    });
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<BridgeResponse> {
    return this.send({
      action: 'navigate',
      url,
    });
  }

  /**
   * Get open tabs for a platform
   */
  async getTabs(platform?: string): Promise<BridgeResponse> {
    return this.send({
      action: 'getTabs',
      platform,
    });
  }

  /**
   * Check if extension is connected
   */
  isConnected(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Get the first active client
   */
  private getActiveClient(): ExtensionClient | null {
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        return client;
      }
    }
    return null;
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; clients: number; profiles: string[]; capabilities: any } {
    const client = this.getActiveClient();
    return {
      connected: this.isConnected(),
      clients: this.clients.size,
      profiles: this.getConnectedProfiles(),
      capabilities: client?.capabilities || {},
    };
  }

  /**
   * Send a generic command to the extension
   * @param command - The command to send
   * @param profile - Optional profile name to target a specific browser profile
   */
  async sendCommand(command: BridgeMessage, profile?: string): Promise<BridgeResponse> {
    return this.send(command, 30000, profile);
  }
}

// Singleton instance
export const extensionBridge = new ExtensionBridge();
