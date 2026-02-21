/**
 * Provider Traits — Swappable AI providers
 * Inspired by ZeroClaw's trait-driven architecture
 */

/**
 * Image content for vision-capable models
 */
export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    mediaType?: string;  // e.g., 'image/jpeg', 'image/png'
    data?: string;       // base64 data if type is 'base64'
    url?: string;        // URL if type is 'url'
  };
}

/**
 * Text content
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Message content can be text, image, or mixed
 */
export type MessageContent = string | (TextContent | ImageContent)[];

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: MessageContent;
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
