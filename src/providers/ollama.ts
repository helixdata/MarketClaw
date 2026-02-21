/**
 * Ollama Provider
 * Local model inference via Ollama
 * https://ollama.ai
 */

import { Provider, ProviderConfig, CompletionRequest, CompletionResponse } from './types.js';

export class OllamaProvider implements Provider {
  name = 'ollama';
  private baseUrl = 'http://localhost:11434';
  private model: string = 'llama3.1';
  private maxTokens: number = 4096;
  private ready = false;

  async init(config: ProviderConfig): Promise<void> {
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (config.model) this.model = config.model;
    if (config.maxTokens) this.maxTokens = config.maxTokens;

    // Check if Ollama is running
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error('Ollama not responding');
      }
      this.ready = true;
    } catch (error) {
      throw new Error(`Ollama: Cannot connect to ${this.baseUrl}. Is Ollama running?`);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.ready) {
      throw new Error('Ollama provider not initialized');
    }

    const model = request.model || this.model;
    const maxTokens = request.maxTokens || this.maxTokens;

    // Build messages (OpenAI-compatible format, Ollama supports this)
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

    // Build tools (Ollama supports OpenAI-style tools for some models)
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
      messages,
      stream: false,
      options: {
        num_predict: maxTokens,
        temperature: request.temperature ?? 0.7,
      },
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;

    // Parse tool calls if present
    const toolCalls = data.message?.tool_calls?.map((tc: any) => ({
      id: tc.id || `call_${Date.now()}`,
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string' 
        ? JSON.parse(tc.function.arguments) 
        : tc.function.arguments,
    }));

    return {
      content: data.message?.content || '',
      model: data.model || model,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0,
      },
      stopReason: data.done_reason || (data.done ? 'stop' : undefined),
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json() as any;
      return data.models?.map((m: any) => m.name) || [];
    } catch {
      return ['llama3.1', 'llama3.1:70b', 'mixtral', 'codellama', 'phi3'];
    }
  }

  currentModel(): string {
    return this.model;
  }
}
