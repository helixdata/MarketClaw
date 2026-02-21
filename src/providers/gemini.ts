/**
 * Google Gemini Provider
 * https://ai.google.dev
 */

import { Provider, ProviderConfig, CompletionRequest, CompletionResponse } from './types.js';

export class GeminiProvider implements Provider {
  name = 'gemini';
  private apiKey: string | null = null;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private model: string = 'gemini-1.5-pro';
  private maxTokens: number = 8192;

  async init(config: ProviderConfig): Promise<void> {
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Gemini: No API key provided. Set GOOGLE_API_KEY or GEMINI_API_KEY.');
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
      throw new Error('Gemini provider not initialized');
    }

    const model = request.model || this.model;
    const maxTokens = request.maxTokens || this.maxTokens;

    // Build contents array (Gemini format)
    const contents: any[] = [];
    
    // System instruction is separate in Gemini
    let systemInstruction: any = undefined;
    if (request.systemPrompt) {
      systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    for (const m of request.messages) {
      if (m.role === 'system') continue;

      if (m.role === 'tool' && m.toolCallId) {
        // Tool response
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: m.toolCallId,
              response: { result: m.content },
            },
          }],
        });
      } else if (m.role === 'assistant' && m.toolCalls?.length) {
        // Assistant with function calls
        const parts: any[] = [];
        if (m.content) {
          parts.push({ text: m.content });
        }
        for (const tc of m.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.arguments,
            },
          });
        }
        contents.push({ role: 'model', parts });
      } else if (m.role === 'user') {
        // Handle content that may include images
        const parts: any[] = [];
        
        if (typeof m.content === 'string') {
          parts.push({ text: m.content });
        } else if (Array.isArray(m.content)) {
          // Mixed content (text + images) - convert to Gemini format
          for (const part of m.content) {
            if (part.type === 'text') {
              parts.push({ text: part.text });
            } else if (part.type === 'image') {
              // Gemini inline_data format
              if (part.source.type === 'base64') {
                parts.push({
                  inline_data: {
                    mime_type: part.source.mediaType || 'image/jpeg',
                    data: part.source.data,
                  },
                });
              }
              // Note: Gemini doesn't support URL images directly, would need to download first
            }
          }
        } else {
          parts.push({ text: String(m.content) });
        }
        
        contents.push({ role: 'user', parts });
      } else if (m.role === 'assistant') {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        contents.push({
          role: 'model',
          parts: [{ text: content }],
        });
      }
    }

    // Build tools
    const tools = request.tools?.length ? [{
      functionDeclarations: request.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    }] : undefined;

    const body: any = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: request.temperature ?? 0.7,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    if (tools) {
      body.tools = tools;
    }

    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    const candidate = data.candidates?.[0];

    if (!candidate) {
      throw new Error('Gemini: No response candidate returned');
    }

    // Parse response content
    let textContent = '';
    const toolCalls: { id: string; name: string; arguments: Record<string, any> }[] = [];

    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        textContent += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${toolCalls.length}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }

    return {
      content: textContent,
      model,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: data.usageMetadata ? {
        inputTokens: data.usageMetadata.promptTokenCount,
        outputTokens: data.usageMetadata.candidatesTokenCount,
      } : undefined,
      stopReason: candidate.finishReason || undefined,
    };
  }

  async listModels(): Promise<string[]> {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-2.0-flash-exp',
    ];
  }

  currentModel(): string {
    return this.model;
  }
}
