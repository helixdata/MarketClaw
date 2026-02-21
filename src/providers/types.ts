/**
 * Provider Traits — Swappable AI providers
 * Inspired by ZeroClaw's trait-driven architecture
 */

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface CompletionRequest {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  tools?: ToolDefinition[];
}

export interface CompletionResponse {
  content: string;
  model: string;
  toolCalls?: ToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  stopReason?: string;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  authToken?: string;
  oauthToken?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Provider trait — all AI providers implement this interface
 */
export interface Provider {
  name: string;
  
  /** Initialize the provider with config */
  init(config: ProviderConfig): Promise<void>;
  
  /** Check if provider is ready */
  isReady(): boolean;
  
  /** Generate a completion */
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  
  /** List available models */
  listModels(): Promise<string[]>;
  
  /** Get current model */
  currentModel(): string;
}

export type ProviderFactory = (config: ProviderConfig) => Provider;
