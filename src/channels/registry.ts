/**
 * Channel Registry
 * Manages all interaction channels
 */

import { Channel, ChannelConfig, RegisteredChannel, MessageHandler } from './types.js';

class ChannelRegistry {
  private channels: Map<string, RegisteredChannel> = new Map();
  private messageHandler: MessageHandler | null = null;

  /**
   * Register a channel
   */
  register(channel: Channel): void {
    this.channels.set(channel.name, {
      channel,
      enabled: false,
    });
  }

  /**
   * Get a channel by name
   */
  get(name: string): Channel | undefined {
    return this.channels.get(name)?.channel;
  }

  /**
   * List all registered channels
   */
  list(): RegisteredChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * List available (registered) channel names
   */
  available(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * List enabled channels
   */
  enabled(): Channel[] {
    return Array.from(this.channels.values())
      .filter(rc => rc.enabled)
      .map(rc => rc.channel);
  }

  /**
   * Configure and enable a channel
   */
  async configure(name: string, config: ChannelConfig): Promise<void> {
    const registered = this.channels.get(name);
    if (!registered) {
      throw new Error(`Channel not found: ${name}`);
    }

    if (config.enabled) {
      await registered.channel.initialize(config);
      registered.enabled = true;
      registered.config = config;
    } else {
      registered.enabled = false;
    }
  }

  /**
   * Set the message handler (called by agent)
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Get the message handler
   */
  getMessageHandler(): MessageHandler | null {
    return this.messageHandler;
  }

  /**
   * Start all enabled channels
   */
  async startAll(): Promise<void> {
    const enabledChannels = this.enabled();
    await Promise.all(enabledChannels.map(ch => ch.start()));
  }

  /**
   * Stop all channels
   */
  async stopAll(): Promise<void> {
    const enabledChannels = this.enabled();
    await Promise.all(enabledChannels.map(ch => ch.stop()));
  }

  /**
   * Get channel info for setup wizard
   */
  getSetupInfo(): Array<{
    name: string;
    displayName: string;
    description: string;
    requiredConfig: string[];
    optionalConfig?: string[];
    requiredEnv?: string[];
  }> {
    return Array.from(this.channels.values()).map(rc => ({
      name: rc.channel.name,
      displayName: rc.channel.displayName,
      description: rc.channel.description,
      requiredConfig: rc.channel.requiredConfig,
      optionalConfig: rc.channel.optionalConfig,
      requiredEnv: rc.channel.requiredEnv,
    }));
  }
}

export const channelRegistry = new ChannelRegistry();
