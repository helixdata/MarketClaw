/**
 * OpenAI Provider
 * Supports: API key, OAuth
 */

import OpenAI from 'openai';
import { Provider, ProviderConfig, CompletionRequest, CompletionResponse } from './types.js';

export class OpenAIProvider implements Provider {
  name = 'openai';
  private client: OpenAI | null = null;
  private model: string = 'gpt-4o';
  private maxTokens: number = 4096;

  async init(config: ProviderConfig): Promise<void> {
    const apiKey = config.oauthToken || config.authToken || config.apiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI: No API key or auth token provided');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl,
    });

    if (config.model) {
      this.model = config.model;
    }
    if (config.maxTokens) {
      this.maxTokens = config.maxTokens;
    }
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.client) {
      throw new Error('OpenAI provider not initialized');
    }

    const model = request.model || this.model;
    const maxTokens = request.maxTokens || this.maxTokens;

    // Build messages with tool support
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system prompt if provided
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const m of request.messages) {
      if (m.role === 'system') continue; // Already handled
      
      if (m.role === 'tool' && m.toolCallId) {
        messages.push({
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId,
        });
      } else if (m.role === 'assistant' && m.toolCalls?.length) {
        messages.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        });
      } else if (m.role === 'user' || m.role === 'assistant') {
        messages.push({
          role: m.role,
          content: m.content,
        });
      }
    }

    // Build tools
    const tools = request.tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const createParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      max_tokens: maxTokens,
      temperature: request.temperature ?? 0.7,
      messages,
    };

    if (tools && tools.length > 0) {
      createParams.tools = tools;
    }

    const response = await this.client.chat.completions.create(createParams);
    const choice = response.choices[0];

    // Parse tool calls
    const toolCalls = choice.message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    }));

    return {
      content: choice.message.content || '',
      model: response.model,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: response.usage ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
      } : undefined,
      stopReason: choice.finish_reason || undefined,
    };
  }

  async listModels(): Promise<string[]> {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'o1-preview',
      'o1-mini',
    ];
  }

  currentModel(): string {
    return this.model;
  }
}
