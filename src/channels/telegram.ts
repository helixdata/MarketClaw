/**
 * Telegram Channel
 * Primary interaction channel for MarketClaw
 */

import { Telegraf, Context } from 'telegraf';
import { Message } from '../providers/types.js';
import { memory } from '../memory/index.js';
import { knowledge } from '../knowledge/index.js';
import { providers } from '../providers/index.js';
import { toolRegistry } from '../tools/index.js';
import pino from 'pino';

const logger = pino({ name: 'telegram' });

export interface TelegramConfig {
  botToken: string;
  allowedUsers?: number[];
  adminUsers?: number[];
}

export class TelegramChannel {
  private bot: Telegraf;
  private config: TelegramConfig;
  private conversationHistory: Map<number, Message[]> = new Map();
  private systemPrompt: string = '';

  constructor(config: TelegramConfig) {
    this.config = config;
    this.bot = new Telegraf(config.botToken);
  }

  /**
   * Set the system prompt for the agent
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Initialize and start the bot
   */
  async start(): Promise<void> {
    // Auth middleware
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      // If allowedUsers is set, enforce it
      if (this.config.allowedUsers && this.config.allowedUsers.length > 0) {
        if (!this.config.allowedUsers.includes(userId)) {
          logger.warn({ userId }, 'Unauthorized user attempted access');
          await ctx.reply('🚫 Unauthorized. Contact admin for access.');
          return;
        }
      }

      await next();
    });

    // Handle text messages
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const text = ctx.message.text;
      const messageId = ctx.message.message_id;

      logger.info({ userId, text: text.slice(0, 50) }, 'Received message');

      try {
        // Get or create conversation history
        const history = this.conversationHistory.get(userId) || [];
        
        // Add user message
        history.push({ role: 'user', content: text });

        // Keep history manageable (last 20 messages)
        if (history.length > 20) {
          history.splice(0, history.length - 20);
        }

        // Build context from memory
        const memoryContext = await memory.buildContext();
        
        // Build knowledge context if we have an active product
        let knowledgeContext = '';
        const state = await memory.getState();
        if (state.activeProduct) {
          try {
            // Initialize knowledge with OpenAI key if available
            if (process.env.OPENAI_API_KEY) {
              await knowledge.init(process.env.OPENAI_API_KEY);
              knowledgeContext = await knowledge.buildContext(state.activeProduct, text, 3000);
            }
          } catch (err) {
            logger.warn({ err, productId: state.activeProduct }, 'Failed to build knowledge context');
          }
        }
        
        // Build full system prompt
        const fullSystemPrompt = knowledgeContext 
          ? `${this.systemPrompt}\n\n# Memory Context\n${memoryContext}\n\n# Product Knowledge\n${knowledgeContext}`
          : `${this.systemPrompt}\n\n# Memory Context\n${memoryContext}`;

        // Get active provider
        const provider = providers.getActive();
        if (!provider) {
          await ctx.reply('⚠️ No AI provider configured. Run setup first.');
          return;
        }

        // Show typing indicator
        await ctx.sendChatAction('typing');

        // Get tool definitions
        const tools = toolRegistry.getDefinitions();

        // Tool loop - keep going until we get a final response
        let finalResponse = '';
        let iterations = 0;
        const maxIterations = 10;

        while (iterations < maxIterations) {
          iterations++;

          const response = await provider.complete({
            messages: history,
            systemPrompt: fullSystemPrompt,
            tools: tools.length > 0 ? tools : undefined,
          });

          // If no tool calls, we have our final response
          if (!response.toolCalls || response.toolCalls.length === 0) {
            finalResponse = response.content;
            history.push({ role: 'assistant', content: response.content });
            break;
          }

          // Handle tool calls
          logger.info({ toolCalls: response.toolCalls.map(t => t.name) }, 'Executing tools');

          // Add assistant message with tool calls
          history.push({
            role: 'assistant',
            content: response.content || '',
            toolCalls: response.toolCalls,
          });

          // Execute each tool and add results
          for (const toolCall of response.toolCalls) {
            await ctx.sendChatAction('typing');
            
            const result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
            logger.info({ tool: toolCall.name, success: result.success }, 'Tool executed');

            // Check for SEND_IMAGE directive
            if (result.message?.startsWith('SEND_IMAGE:')) {
              const imagePath = result.message.replace('SEND_IMAGE:', '');
              try {
                await ctx.sendChatAction('upload_photo');
                await ctx.replyWithPhoto({ source: imagePath });
                result.message = `Image sent: ${imagePath}`;
              } catch (imgErr) {
                logger.error({ err: imgErr, imagePath }, 'Failed to send image');
                result.message = `Image generated at ${imagePath} but failed to send: ${imgErr}`;
              }
            }

            history.push({
              role: 'tool',
              content: JSON.stringify(result),
              toolCallId: toolCall.id,
            });
          }
        }

        if (!finalResponse && iterations >= maxIterations) {
          finalResponse = '⚠️ Reached maximum tool iterations. Please try a simpler request.';
        }

        this.conversationHistory.set(userId, history);

        // Log to session
        await memory.appendToSession(`telegram-${userId}`, {
          role: 'user',
          content: text,
          messageId,
        });
        await memory.appendToSession(`telegram-${userId}`, {
          role: 'assistant',
          content: finalResponse,
        });

        // Send response with fallback for Markdown errors
        if (finalResponse) {
          try {
            await ctx.reply(finalResponse, {
              reply_parameters: { message_id: messageId },
              parse_mode: 'Markdown',
            });
          } catch (sendErr: any) {
            // If Markdown parsing fails, try without parse_mode
            if (sendErr?.response?.description?.includes("parse entities")) {
              logger.warn('Markdown parse failed, retrying without formatting');
              await ctx.reply(finalResponse, {
                reply_parameters: { message_id: messageId },
              });
            } else {
              throw sendErr;
            }
          }
        }

        logger.info({ userId, iterations }, 'Sent response');
      } catch (error) {
        logger.error({ error, userId }, 'Error processing message');
        await ctx.reply('❌ Error processing your message. Please try again.');
      }
    });

    // Handle /start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '🦀 **MarketClaw** — Your AI Marketing Agent\n\n' +
        'I help you:\n' +
        '• Create marketing content\n' +
        '• Manage campaigns\n' +
        '• Post to social media\n' +
        '• Track performance\n\n' +
        'Commands:\n' +
        '/products — List products\n' +
        '/campaigns — List campaigns\n' +
        '/post — Create a post\n' +
        '/help — Show help',
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /products command
    this.bot.command('products', async (ctx) => {
      const products = await memory.listProducts();
      if (products.length === 0) {
        await ctx.reply('No products configured yet. Tell me about a product to add it!');
        return;
      }

      const list = products.map(p => `• **${p.name}**: ${p.tagline || p.description.slice(0, 50)}`).join('\n');
      await ctx.reply(`📦 **Products**\n\n${list}`, { parse_mode: 'Markdown' });
    });

    // Handle /campaigns command
    this.bot.command('campaigns', async (ctx) => {
      const campaigns = await memory.listCampaigns();
      if (campaigns.length === 0) {
        await ctx.reply('No campaigns yet. Say "start a campaign for [product]" to begin!');
        return;
      }

      const list = campaigns.map(c => {
        const status = { draft: '📝', active: '🚀', paused: '⏸️', completed: '✅' }[c.status];
        return `${status} **${c.name}**: ${c.posts.length} posts`;
      }).join('\n');
      await ctx.reply(`📊 **Campaigns**\n\n${list}`, { parse_mode: 'Markdown' });
    });

    // Handle /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '🦀 **MarketClaw Help**\n\n' +
        '**Commands:**\n' +
        '/start — Welcome message\n' +
        '/products — List products\n' +
        '/campaigns — List campaigns\n' +
        '/post — Create a post\n' +
        '/status — Check bot status\n\n' +
        '**Natural Language:**\n' +
        '• "Add product: [name] - [description]"\n' +
        '• "Create a Twitter post for [product]"\n' +
        '• "Start a launch campaign for [product]"\n' +
        '• "What posts are scheduled?"\n' +
        '• "Show me analytics for [campaign]"',
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /status command
    this.bot.command('status', async (ctx) => {
      const provider = providers.getActive();
      const state = await memory.getState();
      const products = await memory.listProducts();
      const campaigns = await memory.listCampaigns();

      await ctx.reply(
        '🦀 **MarketClaw Status**\n\n' +
        `**Provider:** ${provider?.name || 'None'} (${provider?.currentModel() || 'N/A'})\n` +
        `**Products:** ${products.length}\n` +
        `**Campaigns:** ${campaigns.length}\n` +
        `**Active Product:** ${state.activeProduct || 'None'}\n` +
        `**Active Campaign:** ${state.activeCampaign || 'None'}`,
        { parse_mode: 'Markdown' }
      );
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error({ err, updateType: ctx.updateType }, 'Bot error');
    });

    // Start polling
    await this.bot.launch();
    logger.info('Telegram bot started');

    // Graceful shutdown
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  /**
   * Stop the bot
   */
  stop(): void {
    this.bot.stop();
  }

  /**
   * Send a message to a user
   */
  async sendMessage(userId: number, message: string): Promise<void> {
    await this.bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
  }
}
