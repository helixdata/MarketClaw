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
import { 
  createStructuredLogger, 
  createToolLogger, 
  createToolLoopLogger,
  generateCorrelationId,
  setSessionLogLevel,
  resetSessionLogLevel,
  type LogLevel,
} from './logging/index.js';

const logger = createStructuredLogger('main');

// Conversation history per user
const conversationHistory: Map<string, Message[]> = new Map();

// System prompt (set during init)
let systemPrompt = DEFAULT_SYSTEM_PROMPT;

/**
 * Repair conversation history by removing orphaned tool_use blocks
 * This can happen if a request times out mid-tool-loop
 */
function repairConversationHistory(history: Message[]): { repaired: boolean; removed: number } {
  if (history.length === 0) return { repaired: false, removed: 0 };
  
  let removed = 0;
  
  // Scan from the end to find the last assistant message with tool calls
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      // Found an assistant message with tool calls
      // Check if ALL tool calls have corresponding tool results after it
      const toolCallIds = new Set(msg.toolCalls.map((tc: any) => tc.id));
      
      // Collect tool result IDs that follow this assistant message
      const foundResultIds = new Set<string>();
      for (let j = i + 1; j < history.length; j++) {
        const resultMsg = history[j];
        if (resultMsg.role === 'tool' && resultMsg.toolCallId) {
          foundResultIds.add(resultMsg.toolCallId);
        } else if (resultMsg.role === 'assistant' || resultMsg.role === 'user') {
          // Hit another turn - stop looking
          break;
        }
      }
      
      // Check if any tool calls are missing results
      const missingResults = [...toolCallIds].filter(id => !foundResultIds.has(id));
      
      if (missingResults.length > 0) {
        // Remove the broken assistant message and any partial tool results
        const removeCount = history.length - i;
        history.splice(i, removeCount);
        removed = removeCount;
        logger.warn('Repaired corrupted conversation history', { 
          removedMessages: removeCount, 
          missingToolResults: missingResults.length 
        });
        break;
      }
    }
    
    // If we hit a user message, history before this point should be fine
    if (msg.role === 'user') {
      break;
    }
  }
  
  return { repaired: removed > 0, removed };
}

/**
 * Message handler - processes incoming messages from any channel
 */
async function handleMessage(channel: Channel, message: ChannelMessage): Promise<ChannelResponse | null> {
  const userId = `${channel.name}:${message.userId}`;
  const correlationId = generateCorrelationId();
  const msgLogger = createStructuredLogger('message', correlationId);
  
  // Handle /debug and /verbose commands
  if (message.text.startsWith('/debug') || message.text.startsWith('/verbose')) {
    const parts = message.text.split(' ');
    const level = parts[1] as LogLevel | undefined;
    
    if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
      setSessionLogLevel(userId, level);
      return { text: `🔧 Log level set to ${level.toUpperCase()} for this session.` };
    } else if (parts[1] === 'off' || parts[1] === 'reset') {
      resetSessionLogLevel(userId);
      return { text: `🔧 Log level reset to default.` };
    } else {
      setSessionLogLevel(userId, 'debug');
      return { text: `🔧 Debug mode enabled for this session. Use "/debug off" to disable.` };
    }
  }
  
  msgLogger.info('Processing message', { 
    channel: channel.name, 
    userId: message.userId, 
    text: message.text.slice(0, 50),
    hasImages: !!(message.images && message.images.length > 0),
  });

  // Get or create conversation history
  const history = conversationHistory.get(userId) || [];
  
  // Repair any corrupted history (e.g., from timeouts leaving orphaned tool_use blocks)
  const repair = repairConversationHistory(history);
  if (repair.repaired) {
    msgLogger.info('Repaired conversation history before processing', { removedMessages: repair.removed });
  }
  
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
    msgLogger.info('Processing message with images', { imageCount: message.images.length });
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
      msgLogger.warn('Failed to build knowledge context', { 
        error: err instanceof Error ? err.message : String(err), 
        productId: state.activeProduct 
      });
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
  const toolLoopLogger = createToolLoopLogger(correlationId);
  const toolLogger = createToolLogger(correlationId);
  const loopStartTime = Date.now();

  while (iterations < maxIterations) {
    iterations++;
    toolLoopLogger.iterationStart(iterations, maxIterations);

    const response = await provider.complete({
      messages: history,
      systemPrompt: fullSystemPrompt,
      tools: tools.length > 0 ? tools : undefined,
    });

    // If no tool calls, we have our final response
    if (!response.toolCalls || response.toolCalls.length === 0) {
      finalResponse = response.content;
      history.push({ role: 'assistant', content: response.content });
      toolLoopLogger.iterationEnd(iterations, 0);
      break;
    }

    // Handle tool calls
    toolLoopLogger.iterationEnd(iterations, response.toolCalls.length);
    msgLogger.debug('Executing tools', { 
      toolCalls: response.toolCalls.map(t => ({ name: t.name, argsPreview: JSON.stringify(t.arguments).slice(0, 200) })) 
    });

    // Add assistant message with tool calls
    history.push({
      role: 'assistant',
      content: response.content || '',
      toolCalls: response.toolCalls,
    });

    // Execute each tool and add results
    for (const toolCall of response.toolCalls) {
      const toolStartTime = Date.now();
      
      // Check permission for this tool
      const requiredPerm = getToolPermission(toolCall.name);
      let result;
      
      toolLogger.toolStart(toolCall.name, toolCall.arguments);
      
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
          toolLogger.warn('Permission denied', { 
            tool: toolCall.name, 
            userId: message.userId, 
            channel: channel.name, 
            requiredPerm 
          });
        } else {
          result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
        }
      } else {
        // No permission required
        result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
      }
      
      const toolDurationMs = Date.now() - toolStartTime;
      
      if (result.success) {
        toolLogger.toolEnd(toolCall.name, result, toolDurationMs);
      } else {
        toolLogger.toolError(toolCall.name, result.message || 'Unknown error', toolDurationMs);
      }

      // Check for SEND_IMAGE directive in tool result
      if (result.message && typeof result.message === 'string' && result.message.startsWith('SEND_IMAGE:')) {
        const imagePath = result.message.replace('SEND_IMAGE:', '');
        if (existsSync(imagePath)) {
          pendingImages.push(imagePath);
          msgLogger.debug('Image queued for sending', { imagePath });
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
    toolLoopLogger.maxIterationsReached(iterations);
    finalResponse = '⚠️ Reached maximum tool iterations. Please try a simpler request.';
  }
  
  toolLoopLogger.loopComplete(iterations, Date.now() - loopStartTime);

  conversationHistory.set(userId, history);

  // Log to session
  await memory.appendToSession(userId, { role: 'user', content: message.text });
  await memory.appendToSession(userId, { role: 'assistant', content: finalResponse });

  msgLogger.info('Response ready', { 
    channel: channel.name, 
    userId: message.userId, 
    iterations, 
    pendingImages: pendingImages.length,
    responseLengthChars: finalResponse.length,
  });

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
        msgLogger.debug('Image attached to response', { filename });
      } catch (err) {
        msgLogger.error('Failed to read image for attachment', { 
          error: err instanceof Error ? err.message : String(err), 
          imagePath 
        });
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
  logger.info('Configuration loaded');

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
    logger.info('Provider initialized', { provider: defaultProvider });
  } else {
    logger.warn('No provider credentials found. Run: marketclaw setup');
  }

  // Initialize tools
  await initializeTools();
  logger.info('Tools initialized', { count: toolRegistry.count });

  // Initialize skills system
  await initializeSkills(config as any);
  logger.info('Skills initialized', { totalTools: toolRegistry.count });

  // Initialize sub-agents
  await initializeAgents(config.agents as any);
  toolRegistry.registerAll(agentTools, { category: 'utility' });
  const enabledAgents = subAgentRegistry.listEnabled();
  logger.info('Sub-agents initialized', { count: enabledAgents.length });

  // Initialize team management
  const adminUsers = config.channels?.telegram?.adminUsers || config.channels?.telegram?.allowedUsers || config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
  await teamManager.init(adminUsers[0]);
  toolRegistry.registerAll(teamTools, { category: 'utility' });
  const teamMembers = teamManager.listMembers();
  logger.info('Team initialized', { members: teamMembers.length });

  // Initialize approval workflow
  await approvalManager.init();
  toolRegistry.registerAll(approvalTools, { category: 'utility' });

  // Initialize browser extension bridge
  toolRegistry.registerAll(browserTools, { category: 'utility' });
  
  // Add error listener BEFORE starting to prevent unhandled error crashes
  extensionBridge.on('error', (err: any) => {
    logger.warn('Browser extension bridge error (non-fatal)', { error: err.message || err });
  });
  extensionBridge.on('connect', (client) => {
    logger.info('Browser extension connected', { version: client.version, capabilities: client.capabilities });
  });
  extensionBridge.on('disconnect', () => {
    logger.info('Browser extension disconnected');
  });
  
  try {
    await extensionBridge.start();
    logger.info('Browser extension bridge started', { port: 7890 });
  } catch (err: any) {
    logger.warn('Browser extension bridge failed to start (non-fatal, browser automation disabled)', { error: err.message || err });
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
            logger.error('Failed to notify approver', { 
              error: err instanceof Error ? err.message : String(err), 
              approverId: approver.id 
            });
          }
        }
      }
    }
  });
  
  logger.info('Approvals initialized', { pending: approvalManager.listPending().length });

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
          logger.info('Channel configured', { channel: name });
        }
      } catch (err) {
        logger.error('Failed to configure channel', { 
          error: err instanceof Error ? err.message : String(err), 
          channel: name 
        });
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
    const jobLogger = createStructuredLogger('scheduler');
    jobLogger.info('Executing scheduled job', { jobId: job.id, type: job.type });
    
    // Get first enabled channel for notifications
    const notifyChannel = enabledChannels[0];
    
    // Handle different job types
    if (job.type === 'reminder' && job.payload.content) {
      // Send reminder to configured users
      const adminUsers = config.channels?.telegram?.adminUsers || config.channels?.telegram?.allowedUsers || config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
      for (const userId of adminUsers) {
        try {
          await notifyChannel.send(String(userId), { 
            text: `⏰ **Reminder**\n\n${job.payload.content}` 
          });
        } catch (err) {
          jobLogger.error('Failed to send reminder', { 
            error: err instanceof Error ? err.message : String(err), 
            userId 
          });
        }
      }
    } else if (job.type === 'post') {
      const adminUsers = config.channels?.telegram?.adminUsers || config.channels?.telegram?.allowedUsers || config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
      for (const userId of adminUsers) {
        try {
          await notifyChannel.send(String(userId), {
            text: `📤 **Scheduled Post Due**\n\nChannel: ${job.payload.channel}\nContent:\n${job.payload.content}`,
          });
        } catch (err) {
          jobLogger.error('Failed to send post notification', { 
            error: err instanceof Error ? err.message : String(err), 
            userId 
          });
        }
      }
    } else if (job.type === 'task' && job.payload.content) {
      // Execute automated task with AI
      const taskStartTime = Date.now();
      jobLogger.info('Executing automated task', { 
        jobId: job.id, 
        taskPreview: job.payload.content.slice(0, 50) 
      });
      
      try {
        const result = await executeTask(job.payload.content, {
          productId: job.payload.productId,
          campaignId: job.payload.campaignId,
        });
        
        // Notify user of task completion
        const adminUsers = config.channels?.telegram?.adminUsers || config.channels?.telegram?.allowedUsers || config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
        const notify = job.payload.metadata?.notify !== false; // Default to notifying
        
        if (notify && result) {
          for (const userId of adminUsers) {
            try {
              await notifyChannel.send(String(userId), {
                text: `🤖 **Automated Task Completed**\n\n**Task:** ${job.name}\n\n**Result:**\n${result.slice(0, 1500)}${result.length > 1500 ? '...' : ''}`,
              });
            } catch (err) {
              jobLogger.error('Failed to send task notification', { 
                error: err instanceof Error ? err.message : String(err), 
                userId 
              });
            }
          }
        }
        
        jobLogger.info('Task completed', { 
          jobId: job.id, 
          resultLength: result.length,
          durationMs: Date.now() - taskStartTime,
        });
      } catch (err) {
        jobLogger.error('Task execution failed', { 
          error: err instanceof Error ? err.message : String(err), 
          jobId: job.id,
          durationMs: Date.now() - taskStartTime,
        });
        
        // Notify user of failure
        const adminUsers = config.channels?.telegram?.adminUsers || config.channels?.telegram?.allowedUsers || config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
        for (const userId of adminUsers) {
          try {
            await notifyChannel.send(String(userId), {
              text: `⚠️ **Automated Task Failed**\n\n**Task:** ${job.name}\n**Error:** ${err}`,
            });
          } catch (notifyErr) {
            jobLogger.error('Failed to send error notification', { 
              error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr), 
              userId 
            });
          }
        }
      }
    }
  });

  await scheduler.load();
  logger.info('Scheduler loaded', { jobs: scheduler.listJobs().length });

  // Handle async sub-agent task completion notifications
  subAgentRegistry.on('task:complete', async (task) => {
    // Only notify for tasks that requested notification (async tasks)
    if (!task.notifyOnComplete) return;
    
    const agent = subAgentRegistry.get(task.agentId);
    if (!agent) return;
    
    const { identity } = agent.config;
    const notifyChannel = enabledChannels[0];
    const adminUsers = config.channels?.telegram?.adminUsers || config.channels?.telegram?.allowedUsers || config.telegram?.adminUsers || config.telegram?.allowedUsers || [];
    
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
        logger.error('Failed to send task completion notification', { 
          error: err instanceof Error ? err.message : String(err), 
          userId, 
          taskId: task.id 
        });
      }
    }
    
    logger.info('Sent task completion notification', { 
      taskId: task.id, 
      agentId: task.agentId, 
      status: task.status 
    });
  });

  // Start all enabled channels
  await channelRegistry.startAll();
  
  logger.info('🦀 MarketClaw is running!', { channels: enabledChannels.map(c => c.name) });
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
