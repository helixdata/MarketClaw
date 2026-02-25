/**
 * Discord Channel
 * Interact with MarketClaw via Discord bot
 */

import { Client, GatewayIntentBits, Events, Message as DiscordMessage, TextChannel, Attachment, ActivityType } from 'discord.js';
import { Channel, ChannelConfig, ChannelMessage, ChannelResponse, ChannelImage, ChannelDocument } from './types.js';
import { channelRegistry } from './registry.js';
import { documentParser } from '../documents/index.js';
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
  allowedGuilds?: string[];      // Alias for guildIds
  allowedChannels?: string[];    // Alias for channelIds
  allowedRoles?: string[];       // Roles that can interact
  commandPrefix?: string;        // e.g., "!" for "!help"
  requireMention?: boolean;      // If false, respond to all messages in allowed channels
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

  /**
   * Get the Discord.js client for direct API access
   */
  getClient(): Client | null {
    return this.client;
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

  /**
   * Download and parse document from Discord attachment
   */
  private async downloadDiscordDocument(attachment: Attachment): Promise<ChannelDocument | null> {
    try {
      const response = await fetch(attachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      const mimeType = attachment.contentType || 'application/octet-stream';
      const filename = attachment.name || 'document';
      
      // Parse the document
      const parsed = await documentParser.parseDocument(buffer, filename, mimeType);
      
      logger.info({ attachmentId: attachment.id, filename, wordCount: parsed.wordCount }, 'Parsed Discord document');
      
      return {
        id: parsed.id,
        filename: parsed.filename,
        mimeType: parsed.mimeType,
        text: parsed.text,
        pageCount: parsed.pageCount,
        wordCount: parsed.wordCount,
      };
    } catch (err) {
      logger.error({ err, attachmentId: attachment.id }, 'Failed to download/parse Discord document');
      return null;
    }
  }

  private setupHandlers(): void {
    if (!this.client || !this.config) return;

    this.client.once(Events.ClientReady, (c) => {
      logger.info({ user: c.user.tag }, 'Discord bot ready');
      // Set bot presence to online with activity
      c.user.setPresence({
        status: 'online',
        activities: [{ name: 'for messages', type: ActivityType.Watching }],
      });
    });

    this.client.on(Events.MessageCreate, async (msg: DiscordMessage) => {
      // Ignore bot messages
      if (msg.author.bot) return;

      // Check guild restrictions (support both guildIds and allowedGuilds)
      const guildIds = this.config!.guildIds || this.config!.allowedGuilds;
      if (guildIds && guildIds.length > 0) {
        if (!msg.guild || !guildIds.includes(msg.guild.id)) {
          logger.debug({ msgGuildId: msg.guild?.id, allowedGuilds: guildIds }, 'Message rejected: guild not in allowlist');
          return;
        }
      }

      // Check channel restrictions (support both channelIds and allowedChannels)
      const channelIds = this.config!.channelIds || this.config!.allowedChannels;
      if (channelIds && channelIds.length > 0) {
        if (!channelIds.includes(msg.channel.id)) {
          logger.debug({ msgChannelId: msg.channel.id, allowedChannels: channelIds }, 'Message rejected: channel not in allowlist');
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
      const requireMention = this.config!.requireMention !== false; // Default true
      
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
      // Respond to all messages if requireMention is false
      else if (!requireMention) {
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

      // Download any document attachments
      const documents: ChannelDocument[] = [];
      const documentAttachments = msg.attachments.filter(a => {
        const mimeType = a.contentType || '';
        const filename = a.name || '';
        return documentParser.isSupportedDocumentByFilename(mimeType, filename);
      });

      if (documentAttachments.size > 0) {
        for (const [, attachment] of documentAttachments) {
          try {
            const doc = await this.downloadDiscordDocument(attachment);
            if (doc) documents.push(doc);
          } catch (err) {
            logger.error({ err, attachmentId: attachment.id }, 'Failed to download Discord document');
          }
        }
      }

      // Build text content including document text
      let messageText = content;
      if (documents.length > 0) {
        const docInfo = documents.map(d => 
          `[Document: ${d.filename}${d.pageCount ? ` (${d.pageCount} pages)` : ''}, ${d.wordCount} words]\n\n${d.text}`
        ).join('\n\n---\n\n');
        messageText = messageText ? `${messageText}\n\n${docInfo}` : docInfo;
      }
      if (!messageText && images.length > 0) {
        messageText = '[Image attached]';
      }

      const message: ChannelMessage = {
        id: msg.id,
        userId: msg.author.id,
        username: msg.author.username,
        text: messageText || '',
        timestamp: msg.createdAt,
        images: images.length > 0 ? images : undefined,
        documents: documents.length > 0 ? documents : undefined,
        metadata: {
          guildId: msg.guild?.id,
          guildName: msg.guild?.name,
          channelId: msg.channel.id,
          isDM: !msg.guild,
          hasImage: images.length > 0,
          hasDocument: documents.length > 0,
        },
      };

      logger.info({ userId: message.userId, text: message.text.slice(0, 50), imageCount: images.length, documentCount: documents.length }, 'Received Discord message');

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
          
          // Build reply options with optional attachments
          const replyOptions: any = { content: text };
          
          if (response.attachments && response.attachments.length > 0) {
            replyOptions.files = response.attachments.map(attachment => ({
              attachment: attachment.buffer,
              name: attachment.filename,
              description: attachment.caption,
            }));
          }
          
          await msg.reply(replyOptions);
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
