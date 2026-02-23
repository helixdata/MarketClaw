/**
 * Sub-Agent Registry
 * Manages sub-agents and their execution
 */

import { SubAgentConfig, SubAgentState, AgentTask, SubAgentManifest } from './types.js';
import { providers } from '../providers/index.js';
import { toolRegistry } from '../tools/index.js';
import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ name: 'agents' });

function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Options for spawning a task
 */
interface SpawnOptions {
  context?: Record<string, unknown>;
  notifyOnComplete?: boolean;
  notifyTarget?: string;
}

class SubAgentRegistry extends EventEmitter {
  private agents: Map<string, SubAgentState> = new Map();
  private taskQueue: AgentTask[] = [];
  private isProcessing = false;

  /**
   * Register a sub-agent
   */
  register(id: string, config: SubAgentConfig): void {
    if (this.agents.has(id)) {
      logger.warn({ agentId: id }, 'Agent already registered, updating');
    }

    this.agents.set(id, {
      config,
      activeTasks: [],
      completedTasks: [],
      isRunning: config.enabled,
    });

    logger.info({ 
      agentId: id, 
      name: config.identity.name,
      specialty: config.specialty.displayName 
    }, 'Sub-agent registered');
  }

  /**
   * Register from manifest (modular agents)
   */
  registerFromManifest(manifest: SubAgentManifest, overrides?: Partial<SubAgentConfig>): void {
    const config: SubAgentConfig = {
      identity: manifest.identity,
      specialty: {
        id: manifest.id,
        ...manifest.specialty,
      },
      model: manifest.defaultModel,
      enabled: true,
      ...overrides,
    };

    this.register(manifest.id, config);
  }

  /**
   * Get a sub-agent by ID
   */
  get(id: string): SubAgentState | undefined {
    return this.agents.get(id);
  }

  /**
   * List all registered sub-agents
   */
  list(): SubAgentState[] {
    return Array.from(this.agents.values());
  }

  /**
   * List enabled sub-agents
   */
  listEnabled(): SubAgentState[] {
    return this.list().filter(a => a.config.enabled);
  }

  /**
   * Enable/disable a sub-agent
   */
  setEnabled(id: string, enabled: boolean): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.config.enabled = enabled;
      agent.isRunning = enabled;
    }
  }

  /**
   * Set the model for a sub-agent
   */
  setModel(id: string, model: string | undefined): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    
    agent.config.model = model;
    logger.info({ agentId: id, model: model || 'default' }, 'Agent model updated');
    return true;
  }

  /**
   * Get the model for a sub-agent
   */
  getModel(id: string): string | undefined {
    const agent = this.agents.get(id);
    return agent?.config.model;
  }

  /**
   * Update agent config
   */
  updateConfig(id: string, updates: Partial<SubAgentConfig>): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    
    Object.assign(agent.config, updates);
    return true;
  }

  /**
   * Spawn a task for a sub-agent
   */
  async spawn(agentId: string, prompt: string, contextOrOptions?: Record<string, unknown> | SpawnOptions): Promise<AgentTask> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Sub-agent not found: ${agentId}`);
    }
    if (!agent.config.enabled) {
      throw new Error(`Sub-agent is disabled: ${agentId}`);
    }

    // Handle both old (context only) and new (options object) signatures
    let context: Record<string, unknown> | undefined;
    let notifyOnComplete: boolean | undefined;
    let notifyTarget: string | undefined;
    
    if (contextOrOptions && ('notifyOnComplete' in contextOrOptions || 'notifyTarget' in contextOrOptions)) {
      const opts = contextOrOptions as SpawnOptions;
      context = opts.context;
      notifyOnComplete = opts.notifyOnComplete;
      notifyTarget = opts.notifyTarget;
    } else {
      context = contextOrOptions as Record<string, unknown> | undefined;
    }

    const task: AgentTask = {
      id: generateTaskId(),
      agentId,
      prompt,
      context,
      status: 'pending',
      createdAt: new Date(),
      notifyOnComplete,
      notifyTarget,
    };

    agent.activeTasks.push(task);
    this.taskQueue.push(task);

    logger.info({ taskId: task.id, agentId, prompt: prompt.slice(0, 50) }, 'Task spawned');

    // Start processing if not already
    this.processQueue();

    return task;
  }

  /**
   * Get task status
   */
  getTask(taskId: string): AgentTask | undefined {
    for (const agent of this.agents.values()) {
      const task = agent.activeTasks.find(t => t.id === taskId) ||
                   agent.completedTasks.find(t => t.id === taskId);
      if (task) return task;
    }
    return undefined;
  }

  /**
   * Wait for a task to complete
   */
  async waitForTask(taskId: string, timeoutMs: number = 300000): Promise<AgentTask> {
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
      const task = this.getTask(taskId);
      if (task && (task.status === 'completed' || task.status === 'failed')) {
        return task;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Task timeout: ${taskId}`);
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) continue;

      try {
        await this.executeTask(task);
      } catch (error) {
        logger.error({ error, taskId: task.id }, 'Task execution failed');
      }
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: AgentTask): Promise<void> {
    const agent = this.agents.get(task.agentId);
    if (!agent) {
      task.status = 'failed';
      task.error = 'Agent not found';
      return;
    }

    task.status = 'running';
    task.startedAt = new Date();

    this.emit('task:start', task);

    try {
      const provider = providers.getActive();
      if (!provider) {
        throw new Error('No AI provider configured');
      }

      // Build system prompt for this agent
      const { identity, specialty } = agent.config;
      const systemPrompt = this.buildAgentPrompt(identity, specialty);

      // Get tools (filtered if agent has specific tools)
      let tools = toolRegistry.getDefinitions();
      if (specialty.tools && specialty.tools.length > 0) {
        tools = tools.filter(t => specialty.tools!.includes(t.name));
      }

      // Build messages
      const messages = [{ role: 'user' as const, content: task.prompt }];

      // Add context if provided
      let fullPrompt = systemPrompt;
      if (task.context) {
        fullPrompt += `\n\n# Task Context\n${JSON.stringify(task.context, null, 2)}`;
      }

      // Execute with tool loop
      let finalResponse = '';
      let iterations = 0;
      const maxIterations = agent.config.maxIterations || 10;
      const taskTimeout = agent.config.taskTimeoutMs || 120000; // 2 min default
      const taskStart = Date.now();
      const history: any[] = [...messages];

      while (iterations < maxIterations) {
        // Check timeout
        if (Date.now() - taskStart > taskTimeout) {
          throw new Error(`Task timed out after ${taskTimeout / 1000}s`);
        }
        
        iterations++;

        const response = await provider.complete({
          messages: history as any,
          systemPrompt: fullPrompt,
          tools: tools.length > 0 ? tools : undefined,
          model: agent.config.model, // Use agent-specific model if configured
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

      task.status = 'completed';
      task.result = finalResponse;
      task.completedAt = new Date();

      // Move to completed
      const idx = agent.activeTasks.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        agent.activeTasks.splice(idx, 1);
        agent.completedTasks.push(task);
        
        // Keep only last 50 completed tasks
        if (agent.completedTasks.length > 50) {
          agent.completedTasks.shift();
        }
      }

      this.emit('task:complete', task);
      logger.info({ taskId: task.id, agentId: task.agentId }, 'Task completed');

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.completedAt = new Date();

      this.emit('task:error', task);
      logger.error({ error, taskId: task.id }, 'Task failed');
    }
  }

  /**
   * Build system prompt for a sub-agent
   */
  private buildAgentPrompt(identity: SubAgentConfig['identity'], specialty: SubAgentConfig['specialty']): string {
    const voiceStyles: Record<string, string> = {
      professional: 'Be professional and polished. Use formal language.',
      casual: 'Be casual and relaxed. Use conversational language.',
      friendly: 'Be warm and approachable. Balance professionalism with friendliness.',
      playful: 'Be fun and energetic. Use humor where appropriate.',
    };

    const voice = voiceStyles[identity.voice || 'friendly'];

    return `You are ${identity.name} ${identity.emoji}, ${identity.persona || specialty.description}.

## Identity
- Your name is **${identity.name}**
- You are a specialist in: ${specialty.displayName}
- ${specialty.description}

## Voice & Tone
${voice}

## Your Specialty
${specialty.systemPrompt}

## Guidelines
- Stay focused on your specialty
- Be concise and actionable
- If a task is outside your expertise, say so
- Return structured output when appropriate`;
  }
}

export const subAgentRegistry = new SubAgentRegistry();
