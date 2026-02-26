/**
 * Telegram Channel
 * Primary interaction channel for MarketClaw
 */

import { Telegraf } from 'telegraf';
import { Channel, ChannelConfig, ChannelMessage, ChannelResponse, ChannelImage, ChannelDocument, MessageHandler } from './types.js';
import { channelRegistry } from './registry.js';
import { documentParser } from '../documents/index.js';
import { teamManager } from '../team/index.js';
import pino from 'pino';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

import { UserMessageQueue } from '../utils/index.js';

const logger = pino({ name: 'telegram' });

const userMessageQueue = new UserMessageQueue();

// Telegram typing indicator expires after ~5 seconds
// Refresh every 2.5 seconds for more reliable coverage during heavy processing
// (event loop delays during tool execution can cause 4s intervals to slip)
const TYPING_REFRESH_INTERVAL = 2500;

/**
 * Keep typing indicator alive during long operations
 * Uses bot.telegram directly instead of ctx to avoid stale context issues
 * Returns a stop function to call when done
 */
function startTypingIndicator(bot: Telegraf, chatId: number | string): () => void {
  let stopped = false;
  let refreshCount = 0;
  
  const sendTyping = async () => {
    if (stopped) return;
    try {
      await bot.telegram.sendChatAction(chatId, 'typing');
      refreshCount++;
      logger.debug({ chatId, refreshCount }, 'Typing indicator refreshed');
    } catch (err) {
      // Log but don't stop - might be transient
      logger.warn({ chatId, err, refreshCount }, 'Failed to refresh typing indicator');
    }
  };
  
  // Send immediately
  sendTyping();
  
  // Use recursive setTimeout instead of setInterval for more reliable timing
  let timeoutId: NodeJS.Timeout | null = null;
  
  const scheduleNext = () => {
    if (stopped) return;
    timeoutId = setTimeout(() => {
      sendTyping();
      scheduleNext();
    }, TYPING_REFRESH_INTERVAL);
  };
  
  scheduleNext();
  
  // Return stop function
  return () => {
    stopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    logger.debug({ chatId, totalRefreshes: refreshCount }, 'Typing indicator stopped');
  };
}

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
      const result = await this.bot.telegram.sendMessage(numericUserId, response.text, extra);
      logger.info({ chatId: numericUserId, messageId: result.message_id }, 'Message sent successfully');
    } catch (err: any) {
      logger.error({ 
        chatId: numericUserId, 
        error: err?.message || String(err),
        description: err?.response?.description,
        errorCode: err?.response?.error_code,
      }, 'Failed to send message');
      
      // Retry without Markdown if parsing fails
      if (err?.response?.description?.includes("parse entities")) {
        logger.warn('Markdown parse failed, retrying without formatting');
        delete extra.parse_mode;
        const result = await this.bot.telegram.sendMessage(numericUserId, response.text, extra);
        logger.info({ chatId: numericUserId, messageId: result.message_id }, 'Message sent (without markdown)');
      } else {
        throw err;
      }
    }

    // Send any file attachments
    if (response.attachments && response.attachments.length > 0) {
      for (const attachment of response.attachments) {
        try {
          const replyParams = response.replyToId 
            ? { message_id: parseInt(response.replyToId, 10) } 
            : undefined;
          
          // Check if this is an image - use sendPhoto for inline display
          const isImage = attachment.mimeType?.startsWith('image/') || 
            /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.filename);
          
          if (isImage) {
            await this.bot.telegram.sendPhoto(
              numericUserId,
              { source: attachment.buffer },
              {
                caption: attachment.caption,
                reply_parameters: replyParams,
              }
            );
            logger.info({ filename: attachment.filename, userId }, 'Sent image');
          } else {
            await this.bot.telegram.sendDocument(
              numericUserId,
              {
                source: attachment.buffer,
                filename: attachment.filename,
              },
              {
                caption: attachment.caption,
                reply_parameters: replyParams,
              }
            );
            logger.info({ filename: attachment.filename, userId }, 'Sent attachment');
          }
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
      await testBot.telegram.getMe();
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

    // Auth middleware - team membership is required
    // allowedUsers config acts as a pre-filter (if configured)
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      // Check 1: If allowedUsers configured, user must be in it
      const hasAllowedUsersConfig = this.config!.allowedUsers && this.config!.allowedUsers.length > 0;
      if (hasAllowedUsersConfig && !this.config!.allowedUsers!.includes(userId)) {
        logger.warn({ userId }, 'User not in allowedUsers');
        await ctx.reply('🚫 Unauthorized. Contact admin for access.');
        return;
      }

      // Check 2: User must be a team member
      const isTeamMember = teamManager.findMember({ telegramId: userId }) !== undefined;
      if (!isTeamMember) {
        logger.warn({ userId, inAllowedUsers: hasAllowedUsersConfig }, 'User not a team member');
        await ctx.reply(
          '👋 Hi! You\'re not set up as a team member yet.\n\n' +
          'Ask an admin to add you with:\n' +
          `"Add [your name] as viewer with telegram ID ${userId}"`
        );
        return;
      }

      await next();
    });

    // Handle text messages
    this.bot.on('text', async (ctx) => {
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const chatId = String(ctx.chat.id);
      
      const message: ChannelMessage = {
        id: String(ctx.message.message_id),
        userId: String(ctx.from.id),
        username: ctx.from.username,
        text: ctx.message.text,
        timestamp: new Date(ctx.message.date * 1000),
        chatId,
        isGroup,
        metadata: {
          chatId: ctx.chat.id,
          chatType: ctx.chat.type,
        },
      };

      logger.info({ userId: message.userId, chatId, isGroup, text: message.text.slice(0, 50) }, 'Received message');

      // Keep typing indicator alive during processing (bot is always initialized in handlers)
      const stopTyping = startTypingIndicator(this.bot!, ctx.chat.id);

      try {
        // Get message handler from registry
        const handler = channelRegistry.getMessageHandler();
        if (!handler) {
          stopTyping();
          await ctx.reply('⚠️ Agent not configured.');
          return;
        }

        const response = await handler(this, message);
        
        stopTyping();
        
        if (response) {
          // Reply to the chat (group or DM) where the message came from
          await this.send(chatId, {
            ...response,
            replyToId: message.id,
          });
        }
      } catch (error) {
        stopTyping();
        logger.error({ error, userId: message.userId }, 'Error processing message');
        await ctx.reply('❌ Error processing your message. Please try again.');
      }
    });

    // Handle photo messages
    // Uses per-user queue to prevent race conditions when multiple images arrive simultaneously
    this.bot.on('photo', async (ctx) => {
      const photos = ctx.message.photo;
      // Get highest resolution photo (last in array)
      const photo = photos[photos.length - 1];
      const caption = ctx.message.caption || '';
      const userId = String(ctx.from.id);

      // Keep typing indicator alive during processing
      const stopTyping = startTypingIndicator(this.bot!, ctx.chat.id);

      try {
        // Queue this message to process sequentially per-user
        // This prevents conversation history corruption when media groups arrive
        await userMessageQueue.enqueue(userId, async () => {
          // Download the image
          const images = await this.downloadTelegramImages(ctx, [photo.file_id]);

          const message: ChannelMessage = {
            id: String(ctx.message.message_id),
            userId,
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
            stopTyping();
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
        });
        
        stopTyping();
      } catch (error) {
        stopTyping();
        logger.error({ error, userId: ctx.from.id }, 'Error processing photo message');
        await ctx.reply('❌ Error processing your image. Please try again.');
      }
    });

    // Handle document/file messages (images or documents)
    // Uses per-user queue to prevent race conditions when multiple files arrive simultaneously
    this.bot.on('document', async (ctx) => {
      const doc = ctx.message.document;
      const mimeType = doc.mime_type || '';
      const filename = doc.file_name || 'document';
      const caption = ctx.message.caption || '';
      const userId = String(ctx.from.id);

      // Keep typing indicator alive during processing
      const stopTyping = startTypingIndicator(this.bot!, ctx.chat.id);

      try {
        // Queue this message to process sequentially per-user
        await userMessageQueue.enqueue(userId, async () => {
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
            userId,
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
        });
        
        stopTyping();
      } catch (error) {
        stopTyping();
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
        '/status — Current product & campaign',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('status', async (ctx) => {
      try {
        const { memory } = await import('../memory/index.js');
        const { costTracker } = await import('../costs/tracker.js');
        
        const state = await memory.getState();
        const lines: string[] = ['🦀 **MarketClaw Status**\n'];
        
        // Active product
        if (state.activeProduct) {
          const product = await memory.getProduct(state.activeProduct);
          if (product) {
            lines.push(`📦 **Product:** ${product.name}`);
            if (product.tagline) {
              lines.push(`   _"${product.tagline}"_`);
            }
            lines.push('');
          }
        } else {
          const products = await memory.listProducts();
          if (products.length > 0) {
            lines.push(`📦 **Products:** ${products.length} configured`);
            lines.push(`   No active product set`);
            lines.push('');
          } else {
            lines.push('📦 No products configured yet');
            lines.push('');
          }
        }
        
        // Active campaign
        if (state.activeCampaign) {
          const campaign = await memory.getCampaign(state.activeCampaign);
          if (campaign) {
            const postCount = campaign.posts?.length || 0;
            const scheduledCount = campaign.posts?.filter(p => p.status === 'scheduled').length || 0;
            lines.push(`📣 **Campaign:** ${campaign.name}`);
            lines.push(`   Status: ${campaign.status} | ${postCount} posts${scheduledCount > 0 ? ` (${scheduledCount} scheduled)` : ''}`);
            lines.push('');
          }
        } else {
          const campaigns = state.activeProduct 
            ? await memory.listCampaigns(state.activeProduct)
            : [];
          if (campaigns.length > 0) {
            lines.push(`📣 **Campaigns:** ${campaigns.length} for this product`);
            lines.push('');
          }
        }
        
        // Cost summary (this week)
        try {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const costs = await costTracker.summarize({ from: weekAgo.toISOString() });
          if (costs.totalUsd > 0) {
            lines.push(`💰 **Costs:** $${costs.totalUsd.toFixed(2)} this week (${costs.count} ops)`);
          }
        } catch {
          // Cost tracking might not be set up
        }
        
        // Tip
        lines.push('');
        lines.push('_Ask me anything or say "switch to [product]"_');
        
        await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
      } catch (err) {
        logger.error({ err }, 'Error in /status command');
        await ctx.reply('❌ Error fetching status. Try again.');
      }
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
