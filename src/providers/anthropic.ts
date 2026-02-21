/**
 * Anthropic Provider
 * Supports: API key, Claude Code CLI OAuth/setup-token
 */

import Anthropic from '@anthropic-ai/sdk';
import { Provider, ProviderConfig, CompletionRequest, CompletionResponse } from './types.js';

export class AnthropicProvider implements Provider {
  name = 'anthropic';
  private client: Anthropic | null = null;
  private model: string = 'claude-opus-4-5';
  private maxTokens: number = 8192;

  async init(config: ProviderConfig): Promise<void> {
    // Priority: OAuth token > API key > env var
    const token = config.oauthToken || config.authToken || config.apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!token) {
      throw new Error('Anthropic: No API key or auth token provided');
    }

    // Detect token type (like pi-ai/Clawdbot does)
    // OAuth tokens start with "sk-ant-oat"
    const isOAuthToken = token.includes('sk-ant-oat');

    if (isOAuthToken) {
      // OAuth token: use authToken, not apiKey (per pi-ai)
      // Mimic Claude Code's headers for stealth mode
      this.client = new Anthropic({
        apiKey: null as any,  // Must be null for OAuth
        authToken: token,     // Use authToken instead
        baseURL: config.baseUrl,
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          'accept': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
          'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20',
          'user-agent': 'claude-cli/2.1.44 (external, cli)',
          'x-app': 'cli',
        },
      });
    } else {
      // Standard API key
      this.client = new Anthropic({
        apiKey: token,
        baseURL: config.baseUrl,
      });
    }

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
      throw new Error('Anthropic provider not initialized');
    }

    const model = request.model || this.model;
    const maxTokens = request.maxTokens || this.maxTokens;

    // Build messages array with tool result support
    const messages: any[] = [];
    for (const m of request.messages) {
      if (m.role === 'system') continue;
      
      if (m.role === 'tool' && m.toolCallId) {
        // Tool result
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: m.toolCallId,
            content: m.content,
          }],
        });
      } else if (m.role === 'assistant' && m.toolCalls?.length) {
        // Assistant with tool calls
        const content: any[] = [];
        if (m.content) {
          content.push({ type: 'text', text: m.content });
        }
        for (const tc of m.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        messages.push({ role: 'assistant', content });
      } else {
        messages.push({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        });
      }
    }

    // Extract system prompt
    const systemMessage = request.messages.find(m => m.role === 'system');
    const system = request.systemPrompt || systemMessage?.content;

    // Build tools array
    const tools = request.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const createParams: any = {
      model,
      max_tokens: maxTokens,
      system,
      messages,
    };

    if (tools && tools.length > 0) {
      createParams.tools = tools;
    }

    const response = await this.client.messages.create(createParams);

    // Parse response content
    let textContent = '';
    const toolCalls: { id: string; name: string; arguments: Record<string, any> }[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, any>,
        });
      }
    }

    return {
      content: textContent,
      model: response.model,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: (response.usage as any).cache_read_input_tokens,
        cacheWriteTokens: (response.usage as any).cache_creation_input_tokens,
      },
      stopReason: response.stop_reason || undefined,
    };
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-3-5',
    ];
  }

  currentModel(): string {
    return this.model;
  }
}
