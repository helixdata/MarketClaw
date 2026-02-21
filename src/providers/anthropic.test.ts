/**
 * Anthropic Provider Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from './anthropic.js';

// Mock create function that will be shared
const mockCreate = vi.fn();

// Mock Anthropic SDK with a class
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      static lastConfig: any = null;
      messages = { create: mockCreate };
      _config: any;
      
      constructor(config: any) {
        this._config = config;
        MockAnthropic.lastConfig = config;
      }
    },
  };
});

// Import after mock is set up
import Anthropic from '@anthropic-ai/sdk';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider();
    (Anthropic as any).lastConfig = null;
    
    // Default mock response
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-opus-4-5',
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: 'end_turn',
    });
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  // ============================================
  // init() Tests
  // ============================================

  describe('init()', () => {
    it('should initialize with API key from config', async () => {
      await provider.init({ apiKey: 'sk-ant-api-test123' });
      
      expect((Anthropic as any).lastConfig).toEqual({
        apiKey: 'sk-ant-api-test123',
        baseURL: undefined,
      });
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with authToken from config', async () => {
      await provider.init({ authToken: 'sk-ant-api-auth456' });
      
      expect((Anthropic as any).lastConfig).toEqual({
        apiKey: 'sk-ant-api-auth456',
        baseURL: undefined,
      });
    });

    it('should fall back to ANTHROPIC_API_KEY env var', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-env-key';
      
      await provider.init({});
      
      expect((Anthropic as any).lastConfig).toEqual({
        apiKey: 'sk-ant-env-key',
        baseURL: undefined,
      });
    });

    it('should throw error when no API key provided', async () => {
      await expect(provider.init({})).rejects.toThrow(
        'Anthropic: No API key or auth token provided'
      );
    });

    it('should prioritize oauthToken over apiKey', async () => {
      await provider.init({
        oauthToken: 'sk-ant-api-oauth',
        apiKey: 'sk-ant-api-regular',
      });
      
      expect((Anthropic as any).lastConfig.apiKey).toBe('sk-ant-api-oauth');
    });

    it('should set custom model from config', async () => {
      await provider.init({
        apiKey: 'test-key',
        model: 'claude-sonnet-4-5',
      });
      
      expect(provider.currentModel()).toBe('claude-sonnet-4-5');
    });

    it('should set custom maxTokens from config', async () => {
      await provider.init({
        apiKey: 'test-key',
        maxTokens: 4096,
      });
      
      // Verify by making a completion request
      await provider.complete({ messages: [{ role: 'user', content: 'Hi' }] });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 4096 })
      );
    });

    it('should pass baseUrl to client', async () => {
      await provider.init({
        apiKey: 'test-key',
        baseUrl: 'https://custom.anthropic.com',
      });
      
      expect((Anthropic as any).lastConfig).toEqual({
        apiKey: 'test-key',
        baseURL: 'https://custom.anthropic.com',
      });
    });
  });

  // ============================================
  // OAuth Token Detection Tests
  // ============================================

  describe('OAuth token detection', () => {
    it('should detect sk-ant-oat prefix as OAuth token', async () => {
      await provider.init({ apiKey: 'sk-ant-oat01-abc123xyz' });
      
      const config = (Anthropic as any).lastConfig;
      expect(config.apiKey).toBeNull();
      expect(config.authToken).toBe('sk-ant-oat01-abc123xyz');
      expect(config.dangerouslyAllowBrowser).toBe(true);
    });

    it('should set OAuth-specific headers', async () => {
      await provider.init({ apiKey: 'sk-ant-oat02-token' });
      
      const config = (Anthropic as any).lastConfig;
      expect(config.defaultHeaders).toEqual({
        'accept': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
        'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20',
        'user-agent': 'claude-cli/2.1.44 (external, cli)',
        'x-app': 'cli',
      });
    });

    it('should use standard config for regular API key', async () => {
      await provider.init({ apiKey: 'sk-ant-api03-regular' });
      
      const config = (Anthropic as any).lastConfig;
      expect(config.apiKey).toBe('sk-ant-api03-regular');
      expect(config.dangerouslyAllowBrowser).toBeUndefined();
      expect(config.authToken).toBeUndefined();
    });

    it('should detect OAuth token in the middle of string', async () => {
      // Unlikely but test edge case
      await provider.init({ authToken: 'prefix-sk-ant-oat-suffix' });
      
      const config = (Anthropic as any).lastConfig;
      expect(config.apiKey).toBeNull();
      expect(config.authToken).toBe('prefix-sk-ant-oat-suffix');
    });
  });

  // ============================================
  // isReady() Tests
  // ============================================

  describe('isReady()', () => {
    it('should return false before init', () => {
      expect(provider.isReady()).toBe(false);
    });

    it('should return true after successful init', async () => {
      await provider.init({ apiKey: 'test-key' });
      expect(provider.isReady()).toBe(true);
    });

    it('should remain false after failed init', async () => {
      try {
        await provider.init({});
      } catch {
        // Expected to throw
      }
      expect(provider.isReady()).toBe(false);
    });
  });

  // ============================================
  // complete() - Basic Tests
  // ============================================

  describe('complete() - basic', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should throw when not initialized', async () => {
      const uninitProvider = new AnthropicProvider();
      
      await expect(
        uninitProvider.complete({ messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('Anthropic provider not initialized');
    });

    it('should complete simple text request', async () => {
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      
      expect(result.content).toBe('Hello!');
      expect(result.model).toBe('claude-opus-4-5');
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      });
    });

    it('should use default model', async () => {
      await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-opus-4-5' })
      );
    });

    it('should use request model over default', async () => {
      await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'claude-haiku-3-5',
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-haiku-3-5' })
      );
    });

    it('should use default maxTokens', async () => {
      await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 8192 })
      );
    });

    it('should use request maxTokens over default', async () => {
      await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 1000,
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 1000 })
      );
    });

    it('should return stopReason', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        model: 'claude-opus-4-5',
        usage: { input_tokens: 5, output_tokens: 3 },
        stop_reason: 'end_turn',
      });
      
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      expect(result.stopReason).toBe('end_turn');
    });

    it('should handle null stop_reason', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        model: 'claude-opus-4-5',
        usage: { input_tokens: 5, output_tokens: 3 },
        stop_reason: null,
      });
      
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      expect(result.stopReason).toBeUndefined();
    });
  });

  // ============================================
  // complete() - System Prompt Tests
  // ============================================

  describe('complete() - system prompt', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should pass systemPrompt to API', async () => {
      await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
        systemPrompt: 'You are a helpful assistant.',
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant.',
        })
      );
    });

    it('should extract system from messages array', async () => {
      await provider.complete({
        messages: [
          { role: 'system', content: 'You are a pirate.' },
          { role: 'user', content: 'Hello' },
        ],
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a pirate.',
        })
      );
      
      // System message should NOT be in messages array
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      );
    });

    it('should prioritize systemPrompt over system message', async () => {
      await provider.complete({
        messages: [
          { role: 'system', content: 'From messages' },
          { role: 'user', content: 'Hi' },
        ],
        systemPrompt: 'From systemPrompt',
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'From systemPrompt',
        })
      );
    });
  });

  // ============================================
  // complete() - Image Support Tests
  // ============================================

  describe('complete() - image support', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should handle text + image content array', async () => {
      await provider.complete({
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'image',
              source: {
                type: 'base64',
                mediaType: 'image/jpeg',
                data: 'iVBORw0KGgoAAAANSUhEUg...',
              },
            },
          ],
        }],
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',  // Note: underscore format
                  data: 'iVBORw0KGgoAAAANSUhEUg...',
                },
              },
            ],
          }],
        })
      );
    });

    it('should convert mediaType to media_type (underscore format)', async () => {
      await provider.complete({
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                mediaType: 'image/png',
                data: 'base64data',
              },
            },
          ],
        }],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.messages[0].content[0].source.media_type).toBe('image/png');
      expect(callArg.messages[0].content[0].source.mediaType).toBeUndefined();
    });

    it('should default media_type to image/jpeg when not specified', async () => {
      await provider.complete({
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                data: 'base64data',
              },
            },
          ],
        }],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.messages[0].content[0].source.media_type).toBe('image/jpeg');
    });

    it('should handle multiple images in one message', async () => {
      await provider.complete({
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these images' },
            {
              type: 'image',
              source: { type: 'base64', mediaType: 'image/png', data: 'img1data' },
            },
            {
              type: 'image',
              source: { type: 'base64', mediaType: 'image/jpeg', data: 'img2data' },
            },
          ],
        }],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.messages[0].content).toHaveLength(3);
      expect(callArg.messages[0].content[1].type).toBe('image');
      expect(callArg.messages[0].content[2].type).toBe('image');
    });

    it('should handle image/gif media type', async () => {
      await provider.complete({
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', mediaType: 'image/gif', data: 'gifdata' },
            },
          ],
        }],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.messages[0].content[0].source.media_type).toBe('image/gif');
    });

    it('should handle image/webp media type', async () => {
      await provider.complete({
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', mediaType: 'image/webp', data: 'webpdata' },
            },
          ],
        }],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.messages[0].content[0].source.media_type).toBe('image/webp');
    });

    it('should handle plain string content alongside image messages', async () => {
      await provider.complete({
        messages: [
          { role: 'user', content: 'First message' },
          {
            role: 'assistant',
            content: 'I understand',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Now look at this' },
              { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'data' } },
            ],
          },
        ],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.messages[0].content).toBe('First message');
      expect(callArg.messages[1].content).toBe('I understand');
      expect(Array.isArray(callArg.messages[2].content)).toBe(true);
    });
  });

  // ============================================
  // complete() - Tool Calling Tests
  // ============================================

  describe('complete() - tools', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should pass tools to API in correct format', async () => {
      await provider.complete({
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [{
          name: 'get_weather',
          description: 'Get current weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        }],
      });
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [{
            name: 'get_weather',
            description: 'Get current weather',
            input_schema: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
            },
          }],
        })
      );
    });

    it('should not include tools key when tools array is empty', async () => {
      await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
        tools: [],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.tools).toBeUndefined();
    });

    it('should parse tool_use response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'Let me check the weather.' },
          {
            type: 'tool_use',
            id: 'toolu_01ABC',
            name: 'get_weather',
            input: { location: 'San Francisco' },
          },
        ],
        model: 'claude-opus-4-5',
        usage: { input_tokens: 20, output_tokens: 15 },
        stop_reason: 'tool_use',
      });
      
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Weather in SF?' }],
        tools: [{ name: 'get_weather', description: 'Get weather', parameters: {} }],
      });
      
      expect(result.content).toBe('Let me check the weather.');
      expect(result.toolCalls).toEqual([{
        id: 'toolu_01ABC',
        name: 'get_weather',
        arguments: { location: 'San Francisco' },
      }]);
      expect(result.stopReason).toBe('tool_use');
    });

    it('should handle multiple tool calls', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01',
            name: 'get_weather',
            input: { location: 'NYC' },
          },
          {
            type: 'tool_use',
            id: 'toolu_02',
            name: 'get_time',
            input: { timezone: 'America/New_York' },
          },
        ],
        model: 'claude-opus-4-5',
        usage: { input_tokens: 25, output_tokens: 20 },
        stop_reason: 'tool_use',
      });
      
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Weather and time in NYC?' }],
        tools: [
          { name: 'get_weather', description: 'Weather', parameters: {} },
          { name: 'get_time', description: 'Time', parameters: {} },
        ],
      });
      
      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls![0].name).toBe('get_weather');
      expect(result.toolCalls![1].name).toBe('get_time');
    });

    it('should return undefined toolCalls when no tools used', async () => {
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      expect(result.toolCalls).toBeUndefined();
    });
  });

  // ============================================
  // complete() - Tool Results Handling
  // ============================================

  describe('complete() - tool results', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should format tool result message correctly', async () => {
      await provider.complete({
        messages: [
          { role: 'user', content: 'Weather in SF?' },
          {
            role: 'assistant',
            content: 'Let me check.',
            toolCalls: [{ id: 'toolu_01', name: 'get_weather', arguments: { location: 'SF' } }],
          },
          {
            role: 'tool',
            content: 'Sunny, 72°F',
            toolCallId: 'toolu_01',
          },
        ],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      
      // Messages: [0] user, [1] assistant with tool_use, [2] tool_result (as user)
      expect(callArg.messages[2]).toEqual({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'toolu_01',
          content: 'Sunny, 72°F',
        }],
      });
    });

    it('should format assistant message with tool calls', async () => {
      await provider.complete({
        messages: [
          { role: 'user', content: 'Weather?' },
          {
            role: 'assistant',
            content: 'Checking now.',
            toolCalls: [
              { id: 'toolu_01', name: 'get_weather', arguments: { loc: 'NYC' } },
            ],
          },
        ],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      
      expect(callArg.messages[1]).toEqual({
        role: 'assistant',
        content: [
          { type: 'text', text: 'Checking now.' },
          {
            type: 'tool_use',
            id: 'toolu_01',
            name: 'get_weather',
            input: { loc: 'NYC' },
          },
        ],
      });
    });

    it('should handle assistant tool calls without text content', async () => {
      await provider.complete({
        messages: [
          { role: 'user', content: 'Weather?' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'toolu_01', name: 'get_weather', arguments: {} }],
          },
        ],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      
      // Should only have tool_use, no empty text block
      expect(callArg.messages[1].content).toEqual([
        { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: {} },
      ]);
    });

    it('should handle multiple tool results', async () => {
      await provider.complete({
        messages: [
          { role: 'user', content: 'Weather and time?' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              { id: 'toolu_01', name: 'get_weather', arguments: {} },
              { id: 'toolu_02', name: 'get_time', arguments: {} },
            ],
          },
          { role: 'tool', content: 'Sunny', toolCallId: 'toolu_01' },
          { role: 'tool', content: '3:00 PM', toolCallId: 'toolu_02' },
        ],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      
      // Messages: [0] user, [1] assistant with tool_use, [2] tool_result 1, [3] tool_result 2
      expect(callArg.messages[2]).toEqual({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: 'Sunny' }],
      });
      expect(callArg.messages[3]).toEqual({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'toolu_02', content: '3:00 PM' }],
      });
    });
  });

  // ============================================
  // complete() - Usage & Cache Tokens
  // ============================================

  describe('complete() - usage tracking', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should return cache tokens when present', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-opus-4-5',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 80,
          cache_creation_input_tokens: 20,
        },
        stop_reason: 'end_turn',
      });
      
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 80,
        cacheWriteTokens: 20,
      });
    });

    it('should handle missing cache tokens', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-opus-4-5',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });
      
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      expect(result.usage.cacheReadTokens).toBeUndefined();
      expect(result.usage.cacheWriteTokens).toBeUndefined();
    });
  });

  // ============================================
  // complete() - Error Handling
  // ============================================

  describe('complete() - error handling', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should propagate API errors', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));
      
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should propagate authentication errors', async () => {
      mockCreate.mockRejectedValue(new Error('Invalid API key'));
      
      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('Invalid API key');
    });
  });

  // ============================================
  // listModels() Tests
  // ============================================

  describe('listModels()', () => {
    it('should return available models', async () => {
      const models = await provider.listModels();
      
      expect(models).toEqual([
        'claude-opus-4-5',
        'claude-sonnet-4-5',
        'claude-haiku-3-5',
      ]);
    });

    it('should work without initialization', async () => {
      // listModels doesn't require init
      const models = await provider.listModels();
      expect(models.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // currentModel() Tests
  // ============================================

  describe('currentModel()', () => {
    it('should return default model before init', () => {
      expect(provider.currentModel()).toBe('claude-opus-4-5');
    });

    it('should return configured model after init', async () => {
      await provider.init({ apiKey: 'test', model: 'claude-sonnet-4-5' });
      expect(provider.currentModel()).toBe('claude-sonnet-4-5');
    });

    it('should keep default if no model in config', async () => {
      await provider.init({ apiKey: 'test' });
      expect(provider.currentModel()).toBe('claude-opus-4-5');
    });
  });

  // ============================================
  // Provider Properties
  // ============================================

  describe('provider properties', () => {
    it('should have name "anthropic"', () => {
      expect(provider.name).toBe('anthropic');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('edge cases', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should handle empty content response', async () => {
      mockCreate.mockResolvedValue({
        content: [],
        model: 'claude-opus-4-5',
        usage: { input_tokens: 5, output_tokens: 0 },
        stop_reason: 'end_turn',
      });
      
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      expect(result.content).toBe('');
      expect(result.toolCalls).toBeUndefined();
    });

    it('should concatenate multiple text blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'World!' },
        ],
        model: 'claude-opus-4-5',
        usage: { input_tokens: 5, output_tokens: 10 },
        stop_reason: 'end_turn',
      });
      
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      expect(result.content).toBe('Hello World!');
    });

    it('should handle conversation with multiple turns', async () => {
      await provider.complete({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
      });
      
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.messages).toHaveLength(3);
      expect(callArg.messages[0].role).toBe('user');
      expect(callArg.messages[1].role).toBe('assistant');
      expect(callArg.messages[2].role).toBe('user');
    });

    it('should handle text and tool_use mixed response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'I will help you. ' },
          { type: 'tool_use', id: 'tool1', name: 'search', input: { query: 'test' } },
          { type: 'text', text: 'Searching now.' },
        ],
        model: 'claude-opus-4-5',
        usage: { input_tokens: 10, output_tokens: 20 },
        stop_reason: 'tool_use',
      });
      
      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Search for test' }],
        tools: [{ name: 'search', description: 'Search', parameters: {} }],
      });
      
      expect(result.content).toBe('I will help you. Searching now.');
      expect(result.toolCalls).toHaveLength(1);
    });
  });
});
