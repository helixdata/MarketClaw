/**
 * Groq Provider
 * Fast inference for open models (Llama, Mixtral, etc.)
 * https://groq.com
 */

import { Provider, ProviderConfig, CompletionRequest, CompletionResponse } from './types.js';

export class GroqProvider implements Provider {
  name = 'groq';
  private apiKey: string | null = null;
  private baseUrl = 'https://api.groq.com/openai/v1';
  private model: string = 'llama-3.1-70b-versatile';
  private maxTokens: number = 4096;

  async init(config: ProviderConfig): Promise<void> {
    const apiKey = config.apiKey || process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      throw new Error('Groq: No API key provided. Set GROQ_API_KEY or pass apiKey in config.');
    }

    this.apiKey = apiKey;
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (config.model) this.model = config.model;
    if (config.maxTokens) this.maxTokens = config.maxTokens;
  }

  isReady(): boolean {
    return this.apiKey !== null;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error('Groq provider not initialized');
    }

    const model = request.model || this.model;
    const maxTokens = request.maxTokens || this.maxTokens;

    // Build messages (OpenAI-compatible format)
    const messages: any[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const m of request.messages) {
      if (m.role === 'system') continue;
      
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
            type: 'function',
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
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const body: any = {
      model,
      max_tokens: maxTokens,
      temperature: request.temperature ?? 0.7,
      messages,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('Groq: No response choice returned');
    }

    // Parse tool calls
    const toolCalls = choice.message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    }));

    return {
      content: choice.message?.content || '',
      model: data.model || model,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      } : undefined,
      stopReason: choice.finish_reason || undefined,
    };
  }

  async listModels(): Promise<string[]> {
    return [
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.2-90b-text-preview',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ];
  }

  currentModel(): string {
    return this.model;
  }
}
