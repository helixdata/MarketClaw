/**
 * Telegram Channel
 * Primary interaction channel for MarketClaw
 */

import { Telegraf } from 'telegraf';
import { Channel, ChannelConfig, ChannelMessage, ChannelResponse, ChannelImage, ChannelDocument, MessageHandler } from './types.js';
import { channelRegistry } from './registry.js';
import { documentParser } from '../documents/index.js';
import pino from 'pino';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

const logger = pino({ name: 'telegram' });

export interface TelegramConfig extends ChannelConfig {
  botToken: string;
  allowedUsers?: number[];
  adminUsers?: number[];
}

export class TelegramChannel implements Channel {
  readonly name = 'telegram';
  readonly displayName = 'Telegram';
  readonly description = 'Interact with MarketClaw via Telegram bot';
  readonly requiredConfig = ['botToken'];
  readonly optionalConfig = ['allowedUsers', 'adminUsers'];
  readonly requiredEnv = ['TELEGRAM_BOT_TOKEN'];

  private bot: Telegraf | null = null;
  private config: TelegramConfig | null = null;
  private messageHandler: MessageHandler | null = null;

  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config as TelegramConfig;
    
    const token = this.config.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('Telegram bot token not configured');
    }
    
    this.bot = new Telegraf(token);
    this.setupHandlers();
    
    logger.info('Telegram channel initialized');
  }

  async start(): Promise<void> {
    if (!this.bot) {
      throw new Error('Channel not initialized');
    }

    await this.bot.launch();
    logger.info('Telegram bot started');

    // Graceful shutdown
    process.once('SIGINT', () => this.stop());
    process.once('SIGTERM', () => this.stop());
  }

  async stop(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
      logger.info('Telegram bot stopped');
    }
  }

  async send(userId: string, response: ChannelResponse): Promise<void> {
    if (!this.bot) {
      throw new Error('Channel not initialized');
    }

    const numericUserId = parseInt(userId, 10);
    
    // Build keyboard if buttons provided
    const extra: any = { parse_mode: 'Markdown' as const };
    
    if (response.buttons && response.buttons.length > 0) {
      extra.reply_markup = {
        inline_keyboard: response.buttons.map(btn => [{
          text: btn.text,
          callback_data: btn.callback,
        }]),
      };
    }

    if (response.replyToId) {
      extra.reply_parameters = { message_id: parseInt(response.replyToId, 10) };
    }

    try {
      await this.bot.telegram.sendMessage(numericUserId, response.text, extra);
    } catch (err: any) {
      // Retry without Markdown if parsing fails
      if (err?.response?.description?.includes("parse entities")) {
        logger.warn('Markdown parse failed, retrying without formatting');
        delete extra.parse_mode;
        await this.bot.telegram.sendMessage(numericUserId, response.text, extra);
      } else {
        throw err;
      }
    }

    // Send any file attachments
    if (response.attachments && response.attachments.length > 0) {
      for (const attachment of response.attachments) {
        try {
          await this.bot.telegram.sendDocument(
            numericUserId,
            {
              source: attachment.buffer,
              filename: attachment.filename,
            },
            {
              caption: attachment.caption,
              reply_parameters: response.replyToId 
                ? { message_id: parseInt(response.replyToId, 10) } 
                : undefined,
            }
          );
          logger.info({ filename: attachment.filename, userId }, 'Sent attachment');
        } catch (err) {
          logger.error({ err, filename: attachment.filename, userId }, 'Failed to send attachment');
        }
      }
    }
  }

  isConfigured(): boolean {
    return !!(this.config?.botToken || process.env.TELEGRAM_BOT_TOKEN);
  }

  async validateConfig(config: ChannelConfig): Promise<{ valid: boolean; error?: string }> {
    const token = (config as TelegramConfig).botToken;
    if (!token) {
      return { valid: false, error: 'Bot token is required' };
    }

    try {
      const testBot = new Telegraf(token);
      const me = await testBot.telegram.getMe();
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: `Invalid token: ${err.message}` };
    }
  }

  /**
   * Download images from Telegram and save locally
   */
  private async downloadTelegramImages(ctx: any, fileIds: string[]): Promise<ChannelImage[]> {
    const images: ChannelImage[] = [];
    const imagesDir = path.join(homedir(), '.marketclaw', 'images');
    
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true });
    }

    for (const fileId of fileIds) {
      try {
        // Get file info from Telegram
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${this.config!.botToken || process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        
        // Download the file
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const base64 = buffer.toString('base64');
        
        // Determine mime type from file path
        const ext = path.extname(file.file_path || '').toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
        };
        const mimeType = mimeTypes[ext] || 'image/jpeg';
        
        // Save locally
        const filename = `${Date.now()}-${fileId.slice(-8)}${ext || '.jpg'}`;
        const localPath = path.join(imagesDir, filename);
        await writeFile(localPath, buffer);
        
        images.push({
          id: fileId,
          url: fileUrl,
          path: localPath,
          mimeType,
          size: buffer.length,
          filename,
          base64,
        });
        
        logger.info({ fileId, path: localPath, size: buffer.length }, 'Downloaded image');
      } catch (err) {
        logger.error({ err, fileId }, 'Failed to download image');
      }
    }

    return images;
  }

  /**
   * Download and parse documents from Telegram
   */
  private async downloadTelegramDocument(ctx: any, fileId: string, filename: string, mimeType: string): Promise<ChannelDocument | null> {
    try {
      // Get file info from Telegram
      const file = await ctx.telegram.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${this.config!.botToken || process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      
      // Download the file
      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Parse the document
      const parsed = await documentParser.parseDocument(buffer, filename, mimeType);
      
      logger.info({ fileId, filename, wordCount: parsed.wordCount }, 'Parsed document');
      
      return {
        id: parsed.id,
        filename: parsed.filename,
        mimeType: parsed.mimeType,
        text: parsed.text,
        pageCount: parsed.pageCount,
        wordCount: parsed.wordCount,
      };
    } catch (err) {
      logger.error({ err, fileId, filename }, 'Failed to download/parse document');
      return null;
    }
  }

  private setupHandlers(): void {
    if (!this.bot || !this.config) return;

    // Auth middleware
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      if (this.config!.allowedUsers && this.config!.allowedUsers.length > 0) {
        if (!this.config!.allowedUsers.includes(userId)) {
          logger.warn({ userId }, 'Unauthorized user attempted access');
          await ctx.reply('🚫 Unauthorized. Contact admin for access.');
          return;
        }
      }

      await next();
    });

    // Handle text messages
    this.bot.on('text', async (ctx) => {
      const message: ChannelMessage = {
        id: String(ctx.message.message_id),
        userId: String(ctx.from.id),
        username: ctx.from.username,
        text: ctx.message.text,
        timestamp: new Date(ctx.message.date * 1000),
        metadata: {
          chatId: ctx.chat.id,
          chatType: ctx.chat.type,
        },
      };

      logger.info({ userId: message.userId, text: message.text.slice(0, 50) }, 'Received message');

      try {
        await ctx.sendChatAction('typing');

        // Get message handler from registry
        const handler = channelRegistry.getMessageHandler();
        if (!handler) {
          await ctx.reply('⚠️ Agent not configured.');
          return;
        }

        const response = await handler(this, message);
        
        if (response) {
          await this.send(message.userId, {
            ...response,
            replyToId: message.id,
          });
        }
      } catch (error) {
        logger.error({ error, userId: message.userId }, 'Error processing message');
        await ctx.reply('❌ Error processing your message. Please try again.');
      }
    });

    // Handle photo messages
    this.bot.on('photo', async (ctx) => {
      const photos = ctx.message.photo;
      // Get highest resolution photo (last in array)
      const photo = photos[photos.length - 1];
      const caption = ctx.message.caption || '';

      try {
        await ctx.sendChatAction('typing');

        // Download the image
        const images = await this.downloadTelegramImages(ctx, [photo.file_id]);

        const message: ChannelMessage = {
          id: String(ctx.message.message_id),
          userId: String(ctx.from.id),
          username: ctx.from.username,
          text: caption || '[Image attached]',
          timestamp: new Date(ctx.message.date * 1000),
          images,
          metadata: {
            chatId: ctx.chat.id,
            chatType: ctx.chat.type,
            hasImage: true,
          },
        };

        logger.info({ userId: message.userId, hasImage: true, caption: caption.slice(0, 50) }, 'Received photo message');

        const handler = channelRegistry.getMessageHandler();
        if (!handler) {
          await ctx.reply('⚠️ Agent not configured.');
          return;
        }

        const response = await handler(this, message);
        if (response) {
          await this.send(message.userId, {
            ...response,
            replyToId: message.id,
          });
        }
      } catch (error) {
        logger.error({ error, userId: ctx.from.id }, 'Error processing photo message');
        await ctx.reply('❌ Error processing your image. Please try again.');
      }
    });

    // Handle document/file messages (images or documents)
    this.bot.on('document', async (ctx) => {
      const doc = ctx.message.document;
      const mimeType = doc.mime_type || '';
      const filename = doc.file_name || 'document';
      const caption = ctx.message.caption || '';

      try {
        await ctx.sendChatAction('typing');

        let images: ChannelImage[] = [];
        const documents: ChannelDocument[] = [];

        // Handle image documents
        if (mimeType.startsWith('image/')) {
          images = await this.downloadTelegramImages(ctx, [doc.file_id]);
        }
        // Handle supported document types (PDF, Word, etc.)
        else if (documentParser.isSupportedDocumentByFilename(mimeType, filename)) {
          const parsed = await this.downloadTelegramDocument(ctx, doc.file_id, filename, mimeType);
          if (parsed) {
            documents.push(parsed);
          }
        }
        else {
          // Unsupported file type
          await ctx.reply(`⚠️ Unsupported file type: ${mimeType || 'unknown'}. I can read PDF, Word (.docx/.doc), and text files.`);
          return;
        }

        // Build text content including document text
        let text = caption;
        if (documents.length > 0) {
          const docInfo = documents.map(d => 
            `[Document: ${d.filename}${d.pageCount ? ` (${d.pageCount} pages)` : ''}, ${d.wordCount} words]\n\n${d.text}`
          ).join('\n\n---\n\n');
          text = text ? `${text}\n\n${docInfo}` : docInfo;
        }
        if (!text && images.length > 0) {
          text = '[Image attached]';
        }

        const message: ChannelMessage = {
          id: String(ctx.message.message_id),
          userId: String(ctx.from.id),
          username: ctx.from.username,
          text,
          timestamp: new Date(ctx.message.date * 1000),
          images: images.length > 0 ? images : undefined,
          documents: documents.length > 0 ? documents : undefined,
          metadata: {
            chatId: ctx.chat.id,
            chatType: ctx.chat.type,
            hasImage: images.length > 0,
            hasDocument: documents.length > 0,
            filename,
          },
        };

        logger.info({ 
          userId: message.userId, 
          hasImage: images.length > 0, 
          hasDocument: documents.length > 0,
          filename 
        }, 'Received document');

        const handler = channelRegistry.getMessageHandler();
        if (!handler) {
          await ctx.reply('⚠️ Agent not configured.');
          return;
        }

        const response = await handler(this, message);
        if (response) {
          await this.send(message.userId, {
            ...response,
            replyToId: message.id,
          });
        }
      } catch (error) {
        logger.error({ error, userId: ctx.from.id }, 'Error processing document');
        await ctx.reply('❌ Error processing your file. Please try again.');
      }
    });

    // Handle callback queries (button clicks)
    this.bot.on('callback_query', async (ctx) => {
      if (!('data' in ctx.callbackQuery)) return;
      
      const message: ChannelMessage = {
        id: String(ctx.callbackQuery.id),
        userId: String(ctx.from.id),
        username: ctx.from.username,
        text: ctx.callbackQuery.data,
        timestamp: new Date(),
        metadata: {
          isCallback: true,
        },
      };

      await ctx.answerCbQuery();

      const handler = channelRegistry.getMessageHandler();
      if (handler) {
        const response = await handler(this, message);
        if (response) {
          await this.send(message.userId, response);
        }
      }
    });

    // Built-in commands
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '🦀 **MarketClaw** — Your AI Marketing Agent\n\n' +
        'I help you:\n' +
        '• Create marketing content\n' +
        '• Manage campaigns\n' +
        '• Post to social media\n' +
        '• Track performance\n\n' +
        'Just chat with me naturally!',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '🦀 **MarketClaw Help**\n\n' +
        '**Just talk to me:**\n' +
        '• "Add product: [name] - [description]"\n' +
        '• "Create a Twitter post for [product]"\n' +
        '• "Start a launch campaign"\n' +
        '• "Show me my leads"\n' +
        '• "Send an email to [contact]"\n\n' +
        '**Commands:**\n' +
        '/start — Welcome\n' +
        '/help — This message\n' +
        '/status — Bot status',
        { parse_mode: 'Markdown' }
      );
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error({ err, updateType: ctx.updateType }, 'Bot error');
    });
  }
}

// Create and register the channel
export const telegramChannel = new TelegramChannel();
channelRegistry.register(telegramChannel);
