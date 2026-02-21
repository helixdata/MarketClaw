/**
 * Discord Channel
 * Interact with MarketClaw via Discord bot
 */

import { Client, GatewayIntentBits, Events, Message as DiscordMessage, TextChannel, Attachment } from 'discord.js';
import { Channel, ChannelConfig, ChannelMessage, ChannelResponse, ChannelImage } from './types.js';
import { channelRegistry } from './registry.js';
import pino from 'pino';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

const logger = pino({ name: 'discord' });

export interface DiscordConfig extends ChannelConfig {
  botToken: string;
  guildIds?: string[];           // Limit to specific servers
  channelIds?: string[];         // Limit to specific channels
  allowedRoles?: string[];       // Roles that can interact
  commandPrefix?: string;        // e.g., "!" for "!help"
}

export class DiscordChannel implements Channel {
  readonly name = 'discord';
  readonly displayName = 'Discord';
  readonly description = 'Interact with MarketClaw via Discord bot';
  readonly requiredConfig = ['botToken'];
  readonly optionalConfig = ['guildIds', 'channelIds', 'allowedRoles', 'commandPrefix'];
  readonly requiredEnv = ['DISCORD_BOT_TOKEN'];

  private client: Client | null = null;
  private config: DiscordConfig | null = null;

  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config as DiscordConfig;
    
    const token = this.config.botToken || process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('Discord bot token not configured');
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.setupHandlers();
    
    logger.info('Discord channel initialized');
  }

  async start(): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('Channel not initialized');
    }

    const token = this.config.botToken || process.env.DISCORD_BOT_TOKEN;
    await this.client.login(token);
    
    logger.info('Discord bot started');
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      logger.info('Discord bot stopped');
    }
  }

  async send(userId: string, response: ChannelResponse): Promise<void> {
    if (!this.client) {
      throw new Error('Channel not initialized');
    }

    try {
      const user = await this.client.users.fetch(userId);
      const dm = await user.createDM();
      await dm.send(response.text);
    } catch (err) {
      logger.error({ err, userId }, 'Failed to send Discord DM');
      throw err;
    }
  }

  /**
   * Send to a channel (not DM)
   */
  async sendToChannel(channelId: string, response: ChannelResponse): Promise<void> {
    if (!this.client) {
      throw new Error('Channel not initialized');
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send(response.text);
      }
    } catch (err) {
      logger.error({ err, channelId }, 'Failed to send to Discord channel');
      throw err;
    }
  }

  isConfigured(): boolean {
    return !!(this.config?.botToken || process.env.DISCORD_BOT_TOKEN);
  }

  async validateConfig(config: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const token = (config as DiscordConfig).botToken;
    if (!token) {
      return { valid: false, error: 'Bot token is required' };
    }

    try {
      const testClient = new Client({ intents: [GatewayIntentBits.Guilds] });
      await testClient.login(token);
      testClient.destroy();
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: `Invalid token: ${err.message}` };
    }
  }

  /**
   * Download image from Discord attachment
   */
  private async downloadDiscordImage(attachment: Attachment): Promise<ChannelImage | null> {
    const imagesDir = path.join(homedir(), '.marketclaw', 'images');
    
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true });
    }

    try {
      const response = await fetch(attachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString('base64');
      
      const ext = path.extname(attachment.name || '.jpg').toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      const mimeType = attachment.contentType || mimeTypes[ext] || 'image/jpeg';
      
      const filename = `${Date.now()}-${attachment.id}${ext}`;
      const localPath = path.join(imagesDir, filename);
      await writeFile(localPath, buffer);
      
      logger.info({ attachmentId: attachment.id, path: localPath, size: buffer.length }, 'Downloaded Discord image');
      
      return {
        id: attachment.id,
        url: attachment.url,
        path: localPath,
        mimeType,
        size: buffer.length,
        filename,
        base64,
      };
    } catch (err) {
      logger.error({ err, attachmentId: attachment.id }, 'Failed to download Discord image');
      return null;
    }
  }

  private setupHandlers(): void {
    if (!this.client || !this.config) return;

    this.client.once(Events.ClientReady, (c) => {
      logger.info({ user: c.user.tag }, 'Discord bot ready');
    });

    this.client.on(Events.MessageCreate, async (msg: DiscordMessage) => {
      // Ignore bot messages
      if (msg.author.bot) return;

      // Check guild restrictions
      if (this.config!.guildIds && this.config!.guildIds.length > 0) {
        if (!msg.guild || !this.config!.guildIds.includes(msg.guild.id)) {
          return;
        }
      }

      // Check channel restrictions
      if (this.config!.channelIds && this.config!.channelIds.length > 0) {
        if (!this.config!.channelIds.includes(msg.channel.id)) {
          return;
        }
      }

      // Check role restrictions
      if (this.config!.allowedRoles && this.config!.allowedRoles.length > 0 && msg.member) {
        const hasRole = msg.member.roles.cache.some(r => 
          this.config!.allowedRoles!.includes(r.id) || this.config!.allowedRoles!.includes(r.name)
        );
        if (!hasRole) {
          return;
        }
      }

      // Check for command prefix or bot mention
      const prefix = this.config!.commandPrefix || '';
      const botMention = `<@${this.client!.user?.id}>`;
      
      let content = msg.content;
      let shouldRespond = false;

      // Respond to DMs always
      if (!msg.guild) {
        shouldRespond = true;
      }
      // Respond to mentions
      else if (content.includes(botMention)) {
        content = content.replace(botMention, '').trim();
        shouldRespond = true;
      }
      // Respond to prefix
      else if (prefix && content.startsWith(prefix)) {
        content = content.slice(prefix.length).trim();
        shouldRespond = true;
      }

      if (!shouldRespond || !content) return;

      // Download any image attachments
      const images: ChannelImage[] = [];
      const imageAttachments = msg.attachments.filter(a => 
        a.contentType?.startsWith('image/') || 
        a.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );

      if (imageAttachments.size > 0) {
        for (const [, attachment] of imageAttachments) {
          try {
            const image = await this.downloadDiscordImage(attachment);
            if (image) images.push(image);
          } catch (err) {
            logger.error({ err, attachmentId: attachment.id }, 'Failed to download Discord image');
          }
        }
      }

      const message: ChannelMessage = {
        id: msg.id,
        userId: msg.author.id,
        username: msg.author.username,
        text: content || (images.length > 0 ? '[Image attached]' : ''),
        timestamp: msg.createdAt,
        images: images.length > 0 ? images : undefined,
        metadata: {
          guildId: msg.guild?.id,
          guildName: msg.guild?.name,
          channelId: msg.channel.id,
          isDM: !msg.guild,
          hasImage: images.length > 0,
        },
      };

      logger.info({ userId: message.userId, text: message.text.slice(0, 50), imageCount: images.length }, 'Received Discord message');

      try {
        if ('sendTyping' in msg.channel) {
          await (msg.channel as TextChannel).sendTyping();
        }

        const handler = channelRegistry.getMessageHandler();
        if (!handler) {
          await msg.reply('⚠️ Agent not configured.');
          return;
        }

        const response = await handler(this, message);
        
        if (response) {
          // Discord has 2000 char limit
          const text = response.text.length > 1900 
            ? response.text.slice(0, 1900) + '...'
            : response.text;
          
          await msg.reply(text);
        }
      } catch (error) {
        logger.error({ error, userId: message.userId }, 'Error processing Discord message');
        await msg.reply('❌ Error processing your message.');
      }
    });

    this.client.on(Events.Error, (err) => {
      logger.error({ err }, 'Discord client error');
    });
  }
}

// Create and register the channel
export const discordChannel = new DiscordChannel();
channelRegistry.register(discordChannel);
