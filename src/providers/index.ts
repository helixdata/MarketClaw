/**
 * Provider Registry
 * Manages all AI providers with swappable architecture
 */

import { Provider, ProviderConfig } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GroqProvider } from './groq.js';
import { GeminiProvider } from './gemini.js';
import { OllamaProvider } from './ollama.js';
import { OpenRouterProvider } from './openrouter.js';

export * from './types.js';

// Re-export individual providers for direct import
export { AnthropicProvider } from './anthropic.js';
export { OpenAIProvider } from './openai.js';
export { GroqProvider } from './groq.js';
export { GeminiProvider } from './gemini.js';
export { OllamaProvider } from './ollama.js';
export { OpenRouterProvider } from './openrouter.js';

/**
 * Provider metadata for setup wizard
 */
export interface ProviderInfo {
  name: string;
  displayName: string;
  description: string;
  envVar: string;
  defaultModel: string;
  requiresApiKey: boolean;
  setupUrl?: string;
}

export const PROVIDER_INFO: Record<string, ProviderInfo> = {
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic (Claude)',
    description: 'Claude models - best for reasoning and tool use',
    envVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-5-20250514',
    requiresApiKey: true,
    setupUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    name: 'openai',
    displayName: 'OpenAI (GPT)',
    description: 'GPT-4o and other OpenAI models',
    envVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    requiresApiKey: true,
    setupUrl: 'https://platform.openai.com/api-keys',
  },
  groq: {
    name: 'groq',
    displayName: 'Groq',
    description: 'Ultra-fast inference for open models (Llama, Mixtral)',
    envVar: 'GROQ_API_KEY',
    defaultModel: 'llama-3.1-70b-versatile',
    requiresApiKey: true,
    setupUrl: 'https://console.groq.com/keys',
  },
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    description: 'Google\'s Gemini models',
    envVar: 'GOOGLE_API_KEY',
    defaultModel: 'gemini-1.5-pro',
    requiresApiKey: true,
    setupUrl: 'https://aistudio.google.com/apikey',
  },
  ollama: {
    name: 'ollama',
    displayName: 'Ollama (Local)',
    description: 'Run models locally via Ollama',
    envVar: 'OLLAMA_HOST',
    defaultModel: 'llama3.1',
    requiresApiKey: false,
    setupUrl: 'https://ollama.ai',
  },
  openrouter: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    description: 'Access multiple providers through one API',
    envVar: 'OPENROUTER_API_KEY',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresApiKey: true,
    setupUrl: 'https://openrouter.ai/keys',
  },
};

const providerFactories: Record<string, () => Provider> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
  groq: () => new GroqProvider(),
  gemini: () => new GeminiProvider(),
  ollama: () => new OllamaProvider(),
  openrouter: () => new OpenRouterProvider(),
};

export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();
  private activeProvider: string | null = null;

  /**
   * Register a new provider type
   */
  registerProviderType(name: string, factory: () => Provider): void {
    providerFactories[name] = factory;
  }

  /**
   * Initialize a provider with config
   */
  async initProvider(name: string, config: ProviderConfig): Promise<void> {
    const factory = providerFactories[name];
    if (!factory) {
      throw new Error(`Unknown provider: ${name}. Available: ${Object.keys(providerFactories).join(', ')}`);
    }

    const provider = factory();
    await provider.init(config);
    this.providers.set(name, provider);

    // Set as active if first provider
    if (!this.activeProvider) {
      this.activeProvider = name;
    }
  }

  /**
   * Get a specific provider
   */
  getProvider(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get the active provider
   */
  getActive(): Provider | null {
    if (!this.activeProvider) return null;
    return this.providers.get(this.activeProvider) || null;
  }

  /**
   * Set the active provider
   */
  setActive(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider not initialized: ${name}`);
    }
    this.activeProvider = name;
  }

  /**
   * List all initialized providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * List all available provider types
   */
  listAvailableTypes(): string[] {
    return Object.keys(providerFactories);
  }

  /**
   * Get provider info for all available types
   */
  getProviderInfo(): ProviderInfo[] {
    return Object.values(PROVIDER_INFO);
  }

  /**
   * Check if a provider type exists
   */
  hasProviderType(name: string): boolean {
    return name in providerFactories;
  }
}

// Singleton instance
export const providers = new ProviderRegistry();
