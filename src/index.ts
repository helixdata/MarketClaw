/**
 * MarketClaw — AI Marketing Agent
 * Telegram-first, multi-provider, persistent memory
 */

import { loadConfig, buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } from './config/index.js';
import { providers } from './providers/index.js';
import { getCredentials } from './auth/index.js';
import { channelRegistry, ChannelMessage, ChannelResponse, Channel } from './channels/index.js';
import { memory } from './memory/index.js';
import { knowledge } from './knowledge/index.js';
import { scheduler } from './scheduler/index.js';
import { initializeTools, toolRegistry } from './tools/index.js';
import { initializeSkills } from './skills/index.js';
import { initializeAgents, agentTools, subAgentRegistry } from './agents/index.js';
import { teamManager, teamTools, getToolPermission } from './team/index.js';
import { approvalManager, approvalTools } from './approvals/index.js';
import { Message, MessageContent, TextContent, ImageContent } from './providers/types.js';
import pino from 'pino';

const logger = pino({
  name: 'marketclaw',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// Conversation history per user
const conversationHistory: Map<string, Message[]> = new Map();

// System prompt (set during init)
let systemPrompt = DEFAULT_SYSTEM_PROMPT;

/**
 * Message handler - processes incoming messages from any channel
 */
async function handleMessage(channel: Channel, message: ChannelMessage): Promise<ChannelResponse | null> {
  const userId = `${channel.name}:${message.userId}`;
  
  logger.info({ channel: channel.name, userId: message.userId, text: message.text.slice(0, 50) }, 'Processing message');

  // Get or create conversation history
  const history = conversationHistory.get(userId) || [];
  
  // Build message content (may include images)
  let messageContent: MessageContent;
  
  if (message.images && message.images.length > 0) {
    // Message with images - use mixed content format
    const contentParts: (TextContent | ImageContent)[] = [];
    
    // Add images first
    for (const img of message.images) {
      if (img.base64) {
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            mediaType: img.mimeType || 'image/jpeg',
            data: img.base64,
          },
        });
      } else if (img.url) {
        contentParts.push({
          type: 'image',
          source: {
            type: 'url',
            url: img.url,
          },
        });
      }
    }
    
    // Add text content
    if (message.text && message.text !== '[Image attached]') {
      contentParts.push({ type: 'text', text: message.text });
    } else {
      contentParts.push({ type: 'text', text: 'What do you see in this image?' });
    }
    
    messageContent = contentParts;
    logger.info({ userId: message.userId, imageCount: message.images.length }, 'Processing message with images');
  } else {
    // Text-only message
    messageContent = message.text;
  }
  
  // Add user message
  history.push({ role: 'user', content: messageContent });

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
      if (process.env.OPENAI_API_KEY) {
        await knowledge.init(process.env.OPENAI_API_KEY);
        knowledgeContext = await knowledge.buildContext(state.activeProduct, message.text, 3000);
      }
    } catch (err) {
      logger.warn({ err, productId: state.activeProduct }, 'Failed to build knowledge context');
    }
  }
  
  // Build full system prompt
  const fullSystemPrompt = knowledgeContext 
    ? `${systemPrompt}\n\n# Memory Context\n${memoryContext}\n\n# Product Knowledge\n${knowledgeContext}`
    : `${systemPrompt}\n\n# Memory Context\n${memoryContext}`;

  // Get active provider
  const provider = providers.getActive();
  if (!provider) {
    return { text: '⚠️ No AI provider configured. Run setup first.' };
  }

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
      // Check permission for this tool
      const requiredPerm = getToolPermission(toolCall.name);
      let result;
      
      if (requiredPerm) {
        // Build lookup based on channel type
        const lookupOpts: { telegramId?: number; discordId?: string; slackId?: string } = {};
        
        if (channel.name === 'telegram') {
          lookupOpts.telegramId = parseInt(message.userId, 10);
        } else if (channel.name === 'discord') {
          lookupOpts.discordId = message.userId;
        } else if (channel.name === 'slack') {
          lookupOpts.slackId = message.userId;
        }
        
        const hasPermission = teamManager.checkPermission(lookupOpts, requiredPerm);
        
        if (!hasPermission) {
          result = {
            success: false,
            message: `🚫 Permission denied. You need '${requiredPerm}' permission to use ${toolCall.name}.`,
          };
          logger.warn({ tool: toolCall.name, userId: message.userId, channel: channel.name, requiredPerm }, 'Permission denied');
        } else {
          result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
        }
      } else {
        // No permission required
        result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
      }
      
      logger.info({ tool: toolCall.name, success: result.success }, 'Tool executed');

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

  conversationHistory.set(userId, history);

  // Log to session
  await memory.appendToSession(userId, { role: 'user', content: message.text });
  await memory.appendToSession(userId, { role: 'assistant', content: finalResponse });

  logger.info({ channel: channel.name, userId: message.userId, iterations }, 'Response ready');

  return { text: finalResponse };
}

export async function startAgent(): Promise<void> {
  logger.info('🦀 Starting MarketClaw...');

  // Load config
  const config = await loadConfig();
  logger.info({ configLoaded: true }, 'Configuration loaded');

  // Set system prompt (use custom if provided, otherwise build from agent config)
  systemPrompt = config.agent?.systemPrompt || buildSystemPrompt(config.agent);

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
  logger.info({ tools: toolRegistry.count }, 'Tools initialized');

  // Initialize skills system
  await initializeSkills(config as any);
  logger.info({ tools: toolRegistry.count }, 'Skills initialized');

  // Initialize sub-agents
  await initializeAgents(config.agents as any);
  toolRegistry.registerAll(agentTools, { category: 'utility' });
  const enabledAgents = subAgentRegistry.listEnabled();
  logger.info({ agents: enabledAgents.length }, 'Sub-agents initialized');

  // Initialize team management
  const adminUsers = config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
  await teamManager.init(adminUsers[0]);
  toolRegistry.registerAll(teamTools, { category: 'utility' });
  const teamMembers = teamManager.listMembers();
  logger.info({ members: teamMembers.length }, 'Team initialized');

  // Initialize approval workflow
  await approvalManager.init();
  toolRegistry.registerAll(approvalTools, { category: 'utility' });
  
  // Set up approval notifications
  approvalManager.on('approval:requested', async (request) => {
    const approvers = approvalManager.getApprovers(request.productId);
    const channel = channelRegistry.enabled()[0];
    
    if (channel && approvers.length > 0) {
      const message = `🔔 **Approval Needed**\n\n` +
        `**Type:** ${request.contentType}\n` +
        `**From:** ${request.requestedByName}\n` +
        `**Product:** ${request.productId || 'N/A'}\n\n` +
        `**Content:**\n${request.content.slice(0, 300)}${request.content.length > 300 ? '...' : ''}\n\n` +
        `Reply: "approve ${request.id}" or "reject ${request.id} [reason]"`;

      for (const approver of approvers) {
        if (approver.telegramId) {
          try {
            await channel.send(String(approver.telegramId), { text: message });
          } catch (err) {
            logger.error({ err, approverId: approver.id }, 'Failed to notify approver');
          }
        }
      }
    }
  });
  
  logger.info({ pending: approvalManager.listPending().length }, 'Approvals initialized');

  // Set up message handler
  channelRegistry.setMessageHandler(handleMessage);

  // Configure channels from config
  const channelConfigs = config.channels || {};
  
  // Default: enable Telegram if token is available
  if (config.telegram?.botToken && !channelConfigs.telegram) {
    channelConfigs.telegram = {
      enabled: true,
      botToken: config.telegram.botToken,
      allowedUsers: config.telegram.allowedUsers,
      adminUsers: config.telegram.adminUsers,
    };
  }

  // Configure each channel
  for (const [name, channelConfig] of Object.entries(channelConfigs)) {
    if (channelConfig && typeof channelConfig === 'object') {
      try {
        await channelRegistry.configure(name, channelConfig as any);
        if ((channelConfig as any).enabled) {
          logger.info({ channel: name }, 'Channel configured');
        }
      } catch (err) {
        logger.error({ err, channel: name }, 'Failed to configure channel');
      }
    }
  }

  // Check if any channel is enabled
  const enabledChannels = channelRegistry.enabled();
  if (enabledChannels.length === 0) {
    logger.error('No channels enabled. Configure at least one channel in config or set TELEGRAM_BOT_TOKEN.');
    process.exit(1);
  }

  // Initialize scheduler
  scheduler.on('job:execute', async (job) => {
    logger.info({ jobId: job.id, type: job.type }, 'Executing scheduled job');
    
    // Get first enabled channel for notifications
    const notifyChannel = enabledChannels[0];
    
    // Handle different job types
    if (job.type === 'reminder' && job.payload.content) {
      // Send reminder to configured users
      const adminUsers = config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
      for (const userId of adminUsers) {
        try {
          await notifyChannel.send(String(userId), { 
            text: `⏰ **Reminder**\n\n${job.payload.content}` 
          });
        } catch (err) {
          logger.error({ err, userId }, 'Failed to send reminder');
        }
      }
    } else if (job.type === 'post') {
      const adminUsers = config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
      for (const userId of adminUsers) {
        try {
          await notifyChannel.send(String(userId), {
            text: `📤 **Scheduled Post Due**\n\nChannel: ${job.payload.channel}\nContent:\n${job.payload.content}`,
          });
        } catch (err) {
          logger.error({ err, userId }, 'Failed to send post notification');
        }
      }
    }
  });

  await scheduler.load();
  logger.info({ jobs: scheduler.listJobs().length }, 'Scheduler loaded');

  // Start all enabled channels
  await channelRegistry.startAll();
  
  logger.info({ channels: enabledChannels.map(c => c.name) }, '🦀 MarketClaw is running!');
  logger.info('Press Ctrl+C to stop');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    scheduler.stopAll();
    await channelRegistry.stopAll();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Export for CLI use - don't auto-run
