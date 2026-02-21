/**
 * MarketClaw — AI Marketing Agent
 * Telegram-first, multi-provider, persistent memory
 */

import { loadConfig, DEFAULT_SYSTEM_PROMPT } from './config/index.js';
import { providers } from './providers/index.js';
import { getCredentials } from './auth/index.js';
import { TelegramChannel } from './channels/telegram.js';
import { memory } from './memory/index.js';
import { scheduler } from './scheduler/index.js';
import { initializeTools, toolRegistry } from './tools/index.js';
import { initializeSkills } from './skills/index.js';
import pino from 'pino';

const logger = pino({
  name: 'marketclaw',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

export async function startAgent(): Promise<void> {
  logger.info('🦀 Starting MarketClaw...');

  // Load config
  const config = await loadConfig();
  logger.info({ configLoaded: true }, 'Configuration loaded');

  // Initialize providers
  const defaultProvider = config.providers?.default || 'anthropic';
  
  // Try to get credentials
  const credentials = await getCredentials(defaultProvider);

  if (credentials) {
    await providers.initProvider(defaultProvider, {
      apiKey: credentials.apiKey,
      oauthToken: credentials.accessToken,
      model: config.providers?.anthropic?.model || config.providers?.openai?.model,
    });
    logger.info({ provider: defaultProvider }, 'Provider initialized');
  } else {
    logger.warn('No provider credentials found. Run: marketclaw setup');
  }

  // Initialize tools
  await initializeTools();
  logger.info({ tools: toolRegistry.count }, 'Core tools initialized');

  // Initialize skills system
  await initializeSkills(config as any);
  logger.info({ tools: toolRegistry.count }, 'Skills initialized');

  // Check Telegram config
  if (!config.telegram?.botToken) {
    logger.error('No Telegram bot token configured. Set TELEGRAM_BOT_TOKEN or add to config.');
    process.exit(1);
  }

  // Initialize Telegram channel
  const telegram = new TelegramChannel({
    botToken: config.telegram.botToken,
    allowedUsers: config.telegram.allowedUsers,
    adminUsers: config.telegram.adminUsers,
  });

  // Set system prompt
  telegram.setSystemPrompt(config.agent?.systemPrompt || DEFAULT_SYSTEM_PROMPT);

  // Initialize scheduler
  scheduler.on('job:execute', async (job) => {
    logger.info({ jobId: job.id, type: job.type }, 'Executing scheduled job');
    
    // Handle different job types
    if (job.type === 'reminder' && job.payload.content) {
      // Send reminder to admin users
      for (const userId of config.telegram?.adminUsers || config.telegram?.allowedUsers || []) {
        try {
          await telegram.sendMessage(userId, `⏰ **Reminder**\n\n${job.payload.content}`);
        } catch (err) {
          logger.error({ err, userId }, 'Failed to send reminder');
        }
      }
    } else if (job.type === 'post') {
      // TODO: Integrate with actual posting APIs (Twitter, LinkedIn)
      // For now, notify that a post is due
      for (const userId of config.telegram?.adminUsers || config.telegram?.allowedUsers || []) {
        try {
          await telegram.sendMessage(
            userId,
            `📤 **Scheduled Post Due**\n\nChannel: ${job.payload.channel}\nContent:\n${job.payload.content}`
          );
        } catch (err) {
          logger.error({ err, userId }, 'Failed to send post notification');
        }
      }
    }
  });

  await scheduler.load();
  logger.info({ jobs: scheduler.listJobs().length }, 'Scheduler loaded');

  // Start the bot
  await telegram.start();
  logger.info('🦀 MarketClaw is running!');
  logger.info('Press Ctrl+C to stop');

  // Graceful shutdown
  process.on('SIGINT', () => {
    scheduler.stopAll();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    scheduler.stopAll();
    process.exit(0);
  });
}

// Export for CLI use - don't auto-run
