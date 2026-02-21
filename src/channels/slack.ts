/**
 * Slack Channel
 * Interact with MarketClaw via Slack bot
 */

import { App, LogLevel } from '@slack/bolt';
import { Channel, ChannelConfig, ChannelMessage, ChannelResponse, ChannelImage, ChannelDocument } from './types.js';
import { channelRegistry } from './registry.js';
import { documentParser } from '../documents/index.js';
import pino from 'pino';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

const logger = pino({ name: 'slack' });

export interface SlackConfig extends ChannelConfig {
  botToken: string;              // xoxb-...
  appToken: string;              // xapp-... (for socket mode)
  signingSecret?: string;        // For HTTP mode
  allowedChannels?: string[];    // Channel IDs to respond in
  allowedUsers?: string[];       // User IDs allowed to interact
}

export class SlackChannel implements Channel {
  readonly name = 'slack';
  readonly displayName = 'Slack';
  readonly description = 'Interact with MarketClaw via Slack bot';
  readonly requiredConfig = ['botToken', 'appToken'];
  readonly optionalConfig = ['signingSecret', 'allowedChannels', 'allowedUsers'];
  readonly requiredEnv = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'];

  private app: App | null = null;
  private config: SlackConfig | null = null;

  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config as SlackConfig;
    
    const botToken = this.config.botToken || process.env.SLACK_BOT_TOKEN;
    const appToken = this.config.appToken || process.env.SLACK_APP_TOKEN;
    
    if (!botToken) {
      throw new Error('Slack bot token not configured');
    }
    if (!appToken) {
      throw new Error('Slack app token not configured (needed for socket mode)');
    }

    this.app = new App({
      token: botToken,
      appToken: appToken,
      socketMode: true,
      logLevel: LogLevel.WARN,
    });

    this.setupHandlers();
    
    logger.info('Slack channel initialized');
  }

  async start(): Promise<void> {
    if (!this.app) {
      throw new Error('Channel not initialized');
    }

    await this.app.start();
    logger.info('Slack bot started (socket mode)');
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      logger.info('Slack bot stopped');
    }
  }

  async send(userId: string, response: ChannelResponse): Promise<void> {
    if (!this.app) {
      throw new Error('Channel not initialized');
    }

    try {
      await this.app.client.chat.postMessage({
        channel: userId,  // DM channel or user ID
        text: response.text,
      });
    } catch (err) {
      logger.error({ err, userId }, 'Failed to send Slack message');
      throw err;
    }
  }

  /**
   * Send to a channel
   */
  async sendToChannel(channelId: string, response: ChannelResponse, threadTs?: string): Promise<void> {
    if (!this.app) {
      throw new Error('Channel not initialized');
    }

    try {
      await this.app.client.chat.postMessage({
        channel: channelId,
        text: response.text,
        thread_ts: threadTs,
      });
    } catch (err) {
      logger.error({ err, channelId }, 'Failed to send to Slack channel');
      throw err;
    }
  }

  isConfigured(): boolean {
    return !!(
      (this.config?.botToken || process.env.SLACK_BOT_TOKEN) &&
      (this.config?.appToken || process.env.SLACK_APP_TOKEN)
    );
  }

  async validateConfig(config: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const slackConfig = config as SlackConfig;
    if (!slackConfig.botToken) {
      return { valid: false, error: 'Bot token is required' };
    }
    if (!slackConfig.appToken) {
      return { valid: false, error: 'App token is required for socket mode' };
    }

    try {
      const testApp = new App({
        token: slackConfig.botToken,
        appToken: slackConfig.appToken,
        socketMode: true,
        logLevel: LogLevel.ERROR,
      });
      await testApp.client.auth.test();
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: `Invalid tokens: ${err.message}` };
    }
  }

  private setupHandlers(): void {
    if (!this.app || !this.config) return;

    // Handle app mentions (@bot)
    this.app.event('app_mention', async ({ event, say }) => {
      await this.handleMessage(event as any, say);
    });

    // Handle direct messages
    this.app.event('message', async ({ event, say }) => {
      // Only handle DMs (im) not channel messages (handled by app_mention)
      if ((event as any).channel_type !== 'im') return;
      await this.handleMessage(event as any, say);
    });

    // Handle slash commands (optional)
    this.app.command('/marketclaw', async ({ command, ack, respond }) => {
      await ack();
      
      const message: ChannelMessage = {
        id: command.trigger_id,
        userId: command.user_id,
        username: command.user_name,
        text: command.text,
        timestamp: new Date(),
        metadata: {
          channelId: command.channel_id,
          channelName: command.channel_name,
          isSlashCommand: true,
        },
      };

      logger.info({ userId: message.userId, text: message.text.slice(0, 50) }, 'Received Slack command');

      try {
        const handler = channelRegistry.getMessageHandler();
        if (!handler) {
          await respond('⚠️ Agent not configured.');
          return;
        }

        const response = await handler(this, message);
        
        if (response) {
          await respond(response.text);
        }
      } catch (error) {
        logger.error({ error, userId: message.userId }, 'Error processing Slack command');
        await respond('❌ Error processing your command.');
      }
    });
  }

  /**
   * Download image from Slack file
   */
  private async downloadSlackImage(file: any): Promise<ChannelImage | null> {
    const imagesDir = path.join(homedir(), '.marketclaw', 'images');
    
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true });
    }

    try {
      const botToken = this.config?.botToken || process.env.SLACK_BOT_TOKEN;
      
      // Slack requires auth header to download files
      const response = await fetch(file.url_private_download || file.url_private, {
        headers: {
          'Authorization': `Bearer ${botToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString('base64');
      
      const ext = path.extname(file.name || '.jpg').toLowerCase();
      const mimeType = file.mimetype || 'image/jpeg';
      
      const filename = `${Date.now()}-${file.id}${ext}`;
      const localPath = path.join(imagesDir, filename);
      await writeFile(localPath, buffer);
      
      logger.info({ fileId: file.id, path: localPath, size: buffer.length }, 'Downloaded Slack image');
      
      return {
        id: file.id,
        url: file.url_private,
        path: localPath,
        mimeType,
        size: buffer.length,
        filename,
        base64,
      };
    } catch (err) {
      logger.error({ err, fileId: file.id }, 'Failed to download Slack image');
      return null;
    }
  }

  /**
   * Download and parse document from Slack file
   */
  private async downloadSlackDocument(file: any): Promise<ChannelDocument | null> {
    try {
      const botToken = this.config?.botToken || process.env.SLACK_BOT_TOKEN;
      
      // Slack requires auth header to download files
      const response = await fetch(file.url_private_download || file.url_private, {
        headers: {
          'Authorization': `Bearer ${botToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType = file.mimetype || 'application/octet-stream';
      const filename = file.name || 'document';
      
      // Parse the document
      const parsed = await documentParser.parseDocument(buffer, filename, mimeType);
      
      logger.info({ fileId: file.id, filename, wordCount: parsed.wordCount }, 'Parsed Slack document');
      
      return {
        id: parsed.id,
        filename: parsed.filename,
        mimeType: parsed.mimeType,
        text: parsed.text,
        pageCount: parsed.pageCount,
        wordCount: parsed.wordCount,
      };
    } catch (err) {
      logger.error({ err, fileId: file.id }, 'Failed to download/parse Slack document');
      return null;
    }
  }

  private async handleMessage(
    event: { user: string; text: string; ts: string; channel: string; thread_ts?: string; files?: any[] },
    say: (msg: string | { text: string; thread_ts?: string }) => Promise<any>
  ): Promise<void> {
    // Check user restrictions
    if (this.config!.allowedUsers && this.config!.allowedUsers.length > 0) {
      if (!this.config!.allowedUsers.includes(event.user)) {
        return;
      }
    }

    // Check channel restrictions
    if (this.config!.allowedChannels && this.config!.allowedChannels.length > 0) {
      if (!this.config!.allowedChannels.includes(event.channel)) {
        return;
      }
    }

    // Remove bot mention from text if present
    const rawText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    // Download any image files
    const images: ChannelImage[] = [];
    const documents: ChannelDocument[] = [];
    
    if (event.files && event.files.length > 0) {
      for (const file of event.files) {
        if (file.mimetype?.startsWith('image/')) {
          try {
            const image = await this.downloadSlackImage(file);
            if (image) images.push(image);
          } catch (err) {
            logger.error({ err, fileId: file.id }, 'Failed to download Slack image');
          }
        } else if (documentParser.isSupportedDocumentByFilename(file.mimetype || '', file.name || '')) {
          try {
            const doc = await this.downloadSlackDocument(file);
            if (doc) documents.push(doc);
          } catch (err) {
            logger.error({ err, fileId: file.id }, 'Failed to download Slack document');
          }
        }
      }
    }
    
    // Build text content including document text
    let text = rawText;
    if (documents.length > 0) {
      const docInfo = documents.map(d => 
        `[Document: ${d.filename}${d.pageCount ? ` (${d.pageCount} pages)` : ''}, ${d.wordCount} words]\n\n${d.text}`
      ).join('\n\n---\n\n');
      text = text ? `${text}\n\n${docInfo}` : docInfo;
    }
    if (!text && images.length > 0) {
      text = '[Image attached]';
    }
    
    // Need either text, images, or documents to process
    if (!text && images.length === 0 && documents.length === 0) return;

    const message: ChannelMessage = {
      id: event.ts,
      userId: event.user,
      text: text || '',
      timestamp: new Date(parseFloat(event.ts) * 1000),
      images: images.length > 0 ? images : undefined,
      documents: documents.length > 0 ? documents : undefined,
      metadata: {
        channelId: event.channel,
        threadTs: event.thread_ts,
        hasImage: images.length > 0,
        hasDocument: documents.length > 0,
      },
    };

    logger.info({ userId: message.userId, text: message.text.slice(0, 50), imageCount: images.length, documentCount: documents.length }, 'Received Slack message');

    try {
      const handler = channelRegistry.getMessageHandler();
      if (!handler) {
        await say({ text: '⚠️ Agent not configured.', thread_ts: event.thread_ts });
        return;
      }

      const response = await handler(this, message);
      
      if (response) {
        // Reply in thread if original was in thread
        await say({ 
          text: response.text,
          thread_ts: event.thread_ts || event.ts,
        });
      }
    } catch (error) {
      logger.error({ error, userId: message.userId }, 'Error processing Slack message');
      await say({ text: '❌ Error processing your message.', thread_ts: event.thread_ts });
    }
  }
}

// Create and register the channel
export const slackChannel = new SlackChannel();
channelRegistry.register(slackChannel);
