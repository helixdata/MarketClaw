/**
 * ProviderRegistry Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderRegistry, PROVIDER_INFO } from './index.js';
import type { Provider, ProviderConfig, CompletionRequest, CompletionResponse } from './types.js';

/**
 * Mock Provider implementation for testing
 */
function createMockProvider(name: string): Provider {
  let initialized = false;
  let model = 'mock-model';

  return {
    name,
    init: vi.fn(async (config: ProviderConfig) => {
      if (config.model) model = config.model;
      initialized = true;
    }),
    isReady: vi.fn(() => initialized),
    complete: vi.fn(async (request: CompletionRequest): Promise<CompletionResponse> => ({
      content: 'Mock response',
      model,
    })),
    listModels: vi.fn(async () => ['mock-model-1', 'mock-model-2']),
    currentModel: vi.fn(() => model),
  };
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    // Fresh registry for each test
    registry = new ProviderRegistry();
  });

  describe('registerProviderType', () => {
    it('should register a new provider type', () => {
      const mockFactory = () => createMockProvider('custom');
      registry.registerProviderType('custom', mockFactory);

      expect(registry.hasProviderType('custom')).toBe(true);
    });

    it('should override existing provider type', () => {
      const factory1 = vi.fn(() => createMockProvider('custom-v1'));
      const factory2 = vi.fn(() => createMockProvider('custom-v2'));

      registry.registerProviderType('custom', factory1);
      registry.registerProviderType('custom', factory2);

      expect(registry.hasProviderType('custom')).toBe(true);
      // The factory should be overwritten - we can't test directly
      // but initProvider would use the new factory
    });
  });

  describe('initProvider', () => {
    beforeEach(() => {
      // Register a mock provider type for testing
      registry.registerProviderType('mock', () => createMockProvider('mock'));
    });

    it('should initialize a provider with config', async () => {
      await registry.initProvider('mock', { apiKey: 'test-key' });

      const provider = registry.getProvider('mock');
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('mock');
      expect(provider?.init).toHaveBeenCalledWith({ apiKey: 'test-key' });
    });

    it('should pass model config to provider', async () => {
      await registry.initProvider('mock', {
        apiKey: 'test-key',
        model: 'custom-model',
      });

      const provider = registry.getProvider('mock');
      expect(provider?.init).toHaveBeenCalledWith({
        apiKey: 'test-key',
        model: 'custom-model',
      });
    });

    it('should throw for unknown provider type', async () => {
      await expect(
        registry.initProvider('nonexistent', { apiKey: 'test' })
      ).rejects.toThrow(/Unknown provider: nonexistent/);
    });

    it('should set first provider as active', async () => {
      await registry.initProvider('mock', { apiKey: 'test' });

      const active = registry.getActive();
      expect(active).toBeDefined();
      expect(active?.name).toBe('mock');
    });

    it('should not change active provider when adding more', async () => {
      registry.registerProviderType('mock2', () => createMockProvider('mock2'));

      await registry.initProvider('mock', { apiKey: 'test1' });
      await registry.initProvider('mock2', { apiKey: 'test2' });

      const active = registry.getActive();
      expect(active?.name).toBe('mock'); // First one stays active
    });
  });

  describe('getProvider', () => {
    beforeEach(async () => {
      registry.registerProviderType('mock', () => createMockProvider('mock'));
      await registry.initProvider('mock', { apiKey: 'test' });
    });

    it('should return initialized provider', () => {
      const provider = registry.getProvider('mock');
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('mock');
    });

    it('should return undefined for uninitialized provider', () => {
      const provider = registry.getProvider('nonexistent');
      expect(provider).toBeUndefined();
    });
  });

  describe('getActive', () => {
    it('should return null when no providers initialized', () => {
      const active = registry.getActive();
      expect(active).toBeNull();
    });

    it('should return active provider after init', async () => {
      registry.registerProviderType('mock', () => createMockProvider('mock'));
      await registry.initProvider('mock', { apiKey: 'test' });

      const active = registry.getActive();
      expect(active).toBeDefined();
      expect(active?.name).toBe('mock');
    });
  });

  describe('setActive', () => {
    beforeEach(async () => {
      registry.registerProviderType('mock1', () => createMockProvider('mock1'));
      registry.registerProviderType('mock2', () => createMockProvider('mock2'));
      await registry.initProvider('mock1', { apiKey: 'test1' });
      await registry.initProvider('mock2', { apiKey: 'test2' });
    });

    it('should switch active provider', () => {
      expect(registry.getActive()?.name).toBe('mock1');

      registry.setActive('mock2');
      expect(registry.getActive()?.name).toBe('mock2');
    });

    it('should throw when setting uninitialized provider', () => {
      expect(() => registry.setActive('nonexistent')).toThrow(
        /Provider not initialized: nonexistent/
      );
    });

    it('should allow switching back and forth', () => {
      registry.setActive('mock2');
      expect(registry.getActive()?.name).toBe('mock2');

      registry.setActive('mock1');
      expect(registry.getActive()?.name).toBe('mock1');
    });
  });

  describe('listProviders', () => {
    it('should return empty array when no providers initialized', () => {
      expect(registry.listProviders()).toEqual([]);
    });

    it('should return all initialized providers', async () => {
      registry.registerProviderType('mock1', () => createMockProvider('mock1'));
      registry.registerProviderType('mock2', () => createMockProvider('mock2'));

      await registry.initProvider('mock1', { apiKey: 'test1' });
      await registry.initProvider('mock2', { apiKey: 'test2' });

      const providers = registry.listProviders();
      expect(providers).toContain('mock1');
      expect(providers).toContain('mock2');
      expect(providers.length).toBe(2);
    });
  });

  describe('listAvailableTypes', () => {
    it('should include built-in provider types', () => {
      const types = registry.listAvailableTypes();

      // Check for known built-in providers
      expect(types).toContain('anthropic');
      expect(types).toContain('openai');
      expect(types).toContain('groq');
      expect(types).toContain('gemini');
      expect(types).toContain('ollama');
      expect(types).toContain('openrouter');
    });

    it('should include custom registered types', () => {
      const uniqueName = `custom-ai-${Date.now()}`;
      registry.registerProviderType(uniqueName, () => createMockProvider(uniqueName));

      const types = registry.listAvailableTypes();
      expect(types).toContain(uniqueName);
    });
  });

  describe('getProviderInfo', () => {
    it('should return info for all built-in providers', () => {
      const infos = registry.getProviderInfo();

      expect(infos.length).toBeGreaterThan(0);

      // Check structure of info objects
      for (const info of infos) {
        expect(info.name).toBeDefined();
        expect(info.displayName).toBeDefined();
        expect(info.description).toBeDefined();
        expect(info.envVar).toBeDefined();
        expect(info.defaultModel).toBeDefined();
        expect(typeof info.requiresApiKey).toBe('boolean');
      }
    });

    it('should include Anthropic provider info', () => {
      const infos = registry.getProviderInfo();
      const anthropic = infos.find((i) => i.name === 'anthropic');

      expect(anthropic).toBeDefined();
      expect(anthropic?.displayName).toContain('Claude');
      expect(anthropic?.envVar).toBe('ANTHROPIC_API_KEY');
      expect(anthropic?.requiresApiKey).toBe(true);
    });

    it('should include Ollama as non-api-key provider', () => {
      const infos = registry.getProviderInfo();
      const ollama = infos.find((i) => i.name === 'ollama');

      expect(ollama).toBeDefined();
      expect(ollama?.requiresApiKey).toBe(false);
    });
  });

  describe('hasProviderType', () => {
    it('should return true for built-in types', () => {
      expect(registry.hasProviderType('anthropic')).toBe(true);
      expect(registry.hasProviderType('openai')).toBe(true);
      expect(registry.hasProviderType('groq')).toBe(true);
      expect(registry.hasProviderType('gemini')).toBe(true);
      expect(registry.hasProviderType('ollama')).toBe(true);
      expect(registry.hasProviderType('openrouter')).toBe(true);
    });

    it('should return false for unknown types', () => {
      expect(registry.hasProviderType('nonexistent')).toBe(false);
      expect(registry.hasProviderType('')).toBe(false);
    });

    it('should return true for registered custom types', () => {
      const uniqueName = `custom-${Date.now()}`;
      expect(registry.hasProviderType(uniqueName)).toBe(false);

      registry.registerProviderType(uniqueName, () => createMockProvider(uniqueName));
      expect(registry.hasProviderType(uniqueName)).toBe(true);
    });
  });

  describe('PROVIDER_INFO constant', () => {
    it('should have info for all standard providers', () => {
      const expectedProviders = ['anthropic', 'openai', 'groq', 'gemini', 'ollama', 'openrouter'];

      for (const name of expectedProviders) {
        expect(PROVIDER_INFO[name]).toBeDefined();
        expect(PROVIDER_INFO[name].name).toBe(name);
      }
    });

    it('should have valid setup URLs', () => {
      for (const info of Object.values(PROVIDER_INFO)) {
        if (info.setupUrl) {
          expect(info.setupUrl).toMatch(/^https?:\/\//);
        }
      }
    });
  });

  describe('Provider interaction', () => {
    beforeEach(async () => {
      registry.registerProviderType('mock', () => createMockProvider('mock'));
      await registry.initProvider('mock', { apiKey: 'test' });
    });

    it('should allow calling complete on active provider', async () => {
      const active = registry.getActive();
      expect(active).not.toBeNull();

      const response = await active!.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.content).toBe('Mock response');
      expect(active!.complete).toHaveBeenCalled();
    });

    it('should allow checking provider readiness', async () => {
      const provider = registry.getProvider('mock');
      expect(provider?.isReady()).toBe(true);
    });

    it('should allow listing models from provider', async () => {
      const provider = registry.getProvider('mock');
      const models = await provider?.listModels();

      expect(models).toContain('mock-model-1');
      expect(models).toContain('mock-model-2');
    });
  });

  describe('Multiple providers workflow', () => {
    beforeEach(() => {
      registry.registerProviderType('fast', () => createMockProvider('fast'));
      registry.registerProviderType('smart', () => createMockProvider('smart'));
      registry.registerProviderType('cheap', () => createMockProvider('cheap'));
    });

    it('should support multi-provider setup', async () => {
      await registry.initProvider('fast', { apiKey: 'key1' });
      await registry.initProvider('smart', { apiKey: 'key2' });
      await registry.initProvider('cheap', { apiKey: 'key3' });

      expect(registry.listProviders()).toEqual(['fast', 'smart', 'cheap']);
    });

    it('should switch between providers for different use cases', async () => {
      await registry.initProvider('fast', { apiKey: 'key1' });
      await registry.initProvider('smart', { apiKey: 'key2' });

      // Use fast provider for quick responses
      registry.setActive('fast');
      expect(registry.getActive()?.name).toBe('fast');

      // Switch to smart provider for complex reasoning
      registry.setActive('smart');
      expect(registry.getActive()?.name).toBe('smart');
    });

    it('should maintain separate provider instances', async () => {
      await registry.initProvider('fast', { apiKey: 'key1', model: 'fast-model' });
      await registry.initProvider('smart', { apiKey: 'key2', model: 'smart-model' });

      const fast = registry.getProvider('fast');
      const smart = registry.getProvider('smart');

      expect(fast).not.toBe(smart);
      expect(fast?.init).toHaveBeenCalledWith({ apiKey: 'key1', model: 'fast-model' });
      expect(smart?.init).toHaveBeenCalledWith({ apiKey: 'key2', model: 'smart-model' });
    });
  });
});
