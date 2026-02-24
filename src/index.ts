/**
 * MarketClaw — AI Marketing Agent
 * Telegram-first, multi-provider, persistent memory
 */

import { loadConfig, buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } from './config/index.js';
import { providers } from './providers/index.js';
import { getCredentials } from './auth/index.js';
import { channelRegistry, ChannelMessage, ChannelResponse, Channel, ChannelAttachment } from './channels/index.js';
import { memory } from './memory/index.js';
import { knowledge } from './knowledge/index.js';
import { scheduler } from './scheduler/index.js';
import { initializeTools, toolRegistry } from './tools/index.js';
import { initializeSkills } from './skills/index.js';
import { initializeAgents, agentTools, subAgentRegistry } from './agents/index.js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { teamManager, teamTools, getToolPermission } from './team/index.js';
import { approvalManager, approvalTools } from './approvals/index.js';
import { Message, MessageContent, TextContent, ImageContent } from './providers/types.js';
import { extensionBridge, browserTools } from './browser/index.js';
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
    
    // Add text content with local paths so AI knows where images are saved
    const imagePaths = message.images
      .filter(img => img.path)
      .map(img => img.path)
      .join(', ');
    const pathInfo = imagePaths ? `\n\n[Images saved locally at: ${imagePaths}]` : '';
    
    if (message.text && message.text !== '[Image attached]') {
      contentParts.push({ type: 'text', text: message.text + pathInfo });
    } else {
      contentParts.push({ type: 'text', text: 'What do you see in this image?' + pathInfo });
    }
    
    messageContent = contentParts;
    logger.info({ userId: message.userId, imageCount: message.images.length }, 'Processing message with images');
  } else {
    // Text-only message
    messageContent = message.text;
  }
  
  // Add user message
  history.push({ role: 'user', content: messageContent });

  // Keep history manageable - but truncate safely at conversation boundaries
  // Never cut in the middle of a tool call sequence (assistant+tool_use → tool_result)
  if (history.length > 20) {
    // Find a safe truncation point - must be at a user message
    // to avoid orphaning tool_result messages
    let truncateAt = history.length - 20;
    
    // Scan forward to find the next user message (safe boundary)
    while (truncateAt < history.length) {
      const msg = history[truncateAt];
      if (msg.role === 'user' && typeof msg.content === 'string') {
        // Found a user message - safe to truncate here
        break;
      }
      truncateAt++;
    }
    
    // Only truncate if we found a safe point
    if (truncateAt < history.length && truncateAt > 0) {
      history.splice(0, truncateAt);
    }
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
  
  // Build caller context (so AI knows who's calling for permission-gated tools)
  const callerContext = `# Current Caller
- Channel: ${channel.name}
- User ID: ${message.userId}
${channel.name === 'telegram' ? `- Telegram ID: ${message.userId} (use this for callerTelegramId in admin tools)` : ''}`;

  // Build full system prompt
  const fullSystemPrompt = knowledgeContext 
    ? `${systemPrompt}\n\n${callerContext}\n\n# Memory Context\n${memoryContext}\n\n# Product Knowledge\n${knowledgeContext}`
    : `${systemPrompt}\n\n${callerContext}\n\n# Memory Context\n${memoryContext}`;

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
  const maxIterations = 25; // Increased for browser automation tasks
  const pendingImages: string[] = []; // Track images to send from tool results

  while (iterations < maxIterations) {
    iterations++;
    logger.info({ iteration: iterations, maxIterations }, '🔄 Tool loop iteration');

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
    logger.info({ 
      toolCalls: response.toolCalls.map(t => ({ name: t.name, args: JSON.stringify(t.arguments).slice(0, 200) })) 
    }, '🔧 Executing tools');

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
      
      logger.info({ 
        tool: toolCall.name, 
        success: result.success,
        message: result.message?.slice(0, 100)
      }, '✅ Tool executed');

      // Check for SEND_IMAGE directive in tool result
      if (result.message && typeof result.message === 'string' && result.message.startsWith('SEND_IMAGE:')) {
        const imagePath = result.message.replace('SEND_IMAGE:', '');
        if (existsSync(imagePath)) {
          pendingImages.push(imagePath);
          logger.info({ imagePath }, 'Image queued for sending');
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

  conversationHistory.set(userId, history);

  // Log to session
  await memory.appendToSession(userId, { role: 'user', content: message.text });
  await memory.appendToSession(userId, { role: 'assistant', content: finalResponse });

  logger.info({ channel: channel.name, userId: message.userId, iterations, pendingImages: pendingImages.length }, 'Response ready');

  // Build response with any pending images as attachments
  const response: ChannelResponse = { text: finalResponse };
  
  if (pendingImages.length > 0) {
    response.attachments = [];
    for (const imagePath of pendingImages) {
      try {
        const buffer = readFileSync(imagePath);
        const filename = path.basename(imagePath);
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
        };
        response.attachments.push({
          buffer,
          filename,
          mimeType: mimeTypes[ext] || 'image/png',
        });
        logger.info({ filename }, 'Image attached to response');
      } catch (err) {
        logger.error({ err, imagePath }, 'Failed to read image for attachment');
      }
    }
  }

  return response;
}

/**
 * Execute an automated task (used by scheduler for 'task' type jobs)
 * This invokes the AI with a task prompt and lets it use tools
 */
async function executeTask(taskPrompt: string, context?: { productId?: string; campaignId?: string }): Promise<string> {
  const provider = providers.getActive();
  if (!provider) {
    return '⚠️ No AI provider available for task execution';
  }

  // Build context
  const memoryContext = await memory.buildContext();
  let contextInfo = '';
  
  if (context?.productId) {
    const product = await memory.getProduct(context.productId);
    if (product) {
      contextInfo += `\n\nActive Product: ${product.name}`;
    }
  }
  
  if (context?.campaignId) {
    const campaign = await memory.getCampaign(context.campaignId);
    if (campaign) {
      contextInfo += `\nActive Campaign: ${campaign.name}`;
    }
  }

  const fullSystemPrompt = `${systemPrompt}\n\n# Memory Context\n${memoryContext}${contextInfo}\n\n# Task Mode\nYou are executing an automated task. Complete it using available tools, then summarize what you did.`;

  // Start with task as user message
  const history: Message[] = [
    { role: 'user', content: `[Automated Task]\n\n${taskPrompt}` }
  ];

  // Get tool definitions
  const tools = toolRegistry.getDefinitions();

  // Tool loop
  let finalResponse = '';
  let iterations = 0;
  const maxIterations = 25; // Increased for browser automation tasks

  while (iterations < maxIterations) {
    iterations++;

    const response = await provider.complete({
      messages: history,
      systemPrompt: fullSystemPrompt,
      tools: tools.length > 0 ? tools : undefined,
    });

    if (!response.toolCalls || response.toolCalls.length === 0) {
      finalResponse = response.content;
      break;
    }

    // Handle tool calls
    history.push({
      role: 'assistant',
      content: response.content || '',
      toolCalls: response.toolCalls,
    });

    for (const toolCall of response.toolCalls) {
      const result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
      history.push({
        role: 'tool',
        content: JSON.stringify(result),
        toolCallId: toolCall.id,
      });
    }
  }

  return finalResponse || 'Task completed (no response generated)';
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

  // Initialize browser extension bridge
  toolRegistry.registerAll(browserTools, { category: 'utility' });
  
  // Add error listener BEFORE starting to prevent unhandled error crashes
  extensionBridge.on('error', (err: any) => {
    logger.warn({ err: err.message || err }, 'Browser extension bridge error (non-fatal)');
  });
  extensionBridge.on('connect', (client) => {
    logger.info({ version: client.version, capabilities: client.capabilities }, 'Browser extension connected');
  });
  extensionBridge.on('disconnect', () => {
    logger.info('Browser extension disconnected');
  });
  
  try {
    await extensionBridge.start();
    logger.info({ port: 7890 }, 'Browser extension bridge started');
  } catch (err: any) {
    logger.warn({ err: err.message || err }, 'Browser extension bridge failed to start (non-fatal, browser automation disabled)');
  }
  
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
    } else if (job.type === 'task' && job.payload.content) {
      // Execute automated task with AI
      logger.info({ jobId: job.id, task: job.payload.content.slice(0, 50) }, 'Executing automated task');
      
      try {
        const result = await executeTask(job.payload.content, {
          productId: job.payload.productId,
          campaignId: job.payload.campaignId,
        });
        
        // Notify user of task completion
        const adminUsers = config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
        const notify = job.payload.metadata?.notify !== false; // Default to notifying
        
        if (notify && result) {
          for (const userId of adminUsers) {
            try {
              await notifyChannel.send(String(userId), {
                text: `🤖 **Automated Task Completed**\n\n**Task:** ${job.name}\n\n**Result:**\n${result.slice(0, 1500)}${result.length > 1500 ? '...' : ''}`,
              });
            } catch (err) {
              logger.error({ err, userId }, 'Failed to send task notification');
            }
          }
        }
        
        logger.info({ jobId: job.id, resultLength: result.length }, 'Task completed');
      } catch (err) {
        logger.error({ err, jobId: job.id }, 'Task execution failed');
        
        // Notify user of failure
        const adminUsers = config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
        for (const userId of adminUsers) {
          try {
            await notifyChannel.send(String(userId), {
              text: `⚠️ **Automated Task Failed**\n\n**Task:** ${job.name}\n**Error:** ${err}`,
            });
          } catch (notifyErr) {
            logger.error({ err: notifyErr, userId }, 'Failed to send error notification');
          }
        }
      }
    }
  });

  await scheduler.load();
  logger.info({ jobs: scheduler.listJobs().length }, 'Scheduler loaded');

  // Handle async sub-agent task completion notifications
  subAgentRegistry.on('task:complete', async (task) => {
    // Only notify for tasks that requested notification (async tasks)
    if (!task.notifyOnComplete) return;
    
    const agent = subAgentRegistry.get(task.agentId);
    if (!agent) return;
    
    const { identity } = agent.config;
    const notifyChannel = enabledChannels[0];
    const adminUsers = config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
    
    const resultPreview = task.result 
      ? task.result.slice(0, 2000) + (task.result.length > 2000 ? '...' : '')
      : 'No result';
    
    const statusEmoji = task.status === 'completed' ? '✅' : '❌';
    const message = task.status === 'completed'
      ? `${statusEmoji} ${identity.emoji} **${identity.name}** finished!\n\n${resultPreview}`
      : `${statusEmoji} ${identity.emoji} **${identity.name}** failed: ${task.error || 'Unknown error'}`;
    
    for (const userId of adminUsers) {
      try {
        await notifyChannel.send(String(userId), { text: message });
      } catch (err) {
        logger.error({ err, userId, taskId: task.id }, 'Failed to send task completion notification');
      }
    }
    
    logger.info({ taskId: task.id, agentId: task.agentId, status: task.status }, 'Sent task completion notification');
  });

  // Start all enabled channels
  await channelRegistry.startAll();
  
  logger.info({ channels: enabledChannels.map(c => c.name) }, '🦀 MarketClaw is running!');
  logger.info('Press Ctrl+C to stop');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    scheduler.stopAll();
    await extensionBridge.stop();
    await channelRegistry.stopAll();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Export for CLI use - don't auto-run
