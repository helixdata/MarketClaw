/**
 * Gemini Provider Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from './gemini.js';
import type { CompletionRequest, Message, ToolDefinition } from './types.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    provider = new GeminiProvider();
    mockFetch.mockReset();
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // Helper to create mock response
  function mockGeminiResponse(content: string, options: {
    functionCalls?: Array<{ name: string; args: Record<string, any> }>;
    usage?: { promptTokenCount: number; candidatesTokenCount: number };
    finishReason?: string;
  } = {}) {
    const parts: any[] = [];
    if (content) {
      parts.push({ text: content });
    }
    if (options.functionCalls) {
      for (const fc of options.functionCalls) {
        parts.push({ functionCall: { name: fc.name, args: fc.args } });
      }
    }

    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts },
          finishReason: options.finishReason || 'STOP',
        }],
        usageMetadata: options.usage,
      }),
      text: async () => '',
    };
  }

  // ============================================
  // init() tests
  // ============================================

  describe('init()', () => {
    it('should initialize with API key from config', async () => {
      await provider.init({ apiKey: 'config-api-key' });
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with GOOGLE_API_KEY env var', async () => {
      process.env.GOOGLE_API_KEY = 'google-env-key';
      await provider.init({});
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with GEMINI_API_KEY env var', async () => {
      process.env.GEMINI_API_KEY = 'gemini-env-key';
      await provider.init({});
      expect(provider.isReady()).toBe(true);
    });

    it('should prefer config apiKey over env vars', async () => {
      process.env.GOOGLE_API_KEY = 'google-env-key';
      process.env.GEMINI_API_KEY = 'gemini-env-key';
      
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.init({ apiKey: 'config-key' });
      await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=config-key'),
        expect.any(Object)
      );
    });

    it('should prefer GOOGLE_API_KEY over GEMINI_API_KEY', async () => {
      process.env.GOOGLE_API_KEY = 'google-env-key';
      process.env.GEMINI_API_KEY = 'gemini-env-key';
      
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.init({});
      await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=google-env-key'),
        expect.any(Object)
      );
    });

    it('should throw error if no API key provided', async () => {
      await expect(provider.init({})).rejects.toThrow(
        'Gemini: No API key provided. Set GOOGLE_API_KEY or GEMINI_API_KEY.'
      );
    });

    it('should set custom baseUrl from config', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.init({ 
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.example.com/v1'
      });
      await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://custom.api.example.com/v1'),
        expect.any(Object)
      );
    });

    it('should set custom model from config', async () => {
      await provider.init({ apiKey: 'test-key', model: 'gemini-custom-model' });
      expect(provider.currentModel()).toBe('gemini-custom-model');
    });

    it('should set maxTokens from config', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.init({ apiKey: 'test-key', maxTokens: 4096 });
      await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.generationConfig.maxOutputTokens).toBe(4096);
    });
  });

  // ============================================
  // isReady() tests
  // ============================================

  describe('isReady()', () => {
    it('should return false before initialization', () => {
      expect(provider.isReady()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      await provider.init({ apiKey: 'test-key' });
      expect(provider.isReady()).toBe(true);
    });

    it('should still be false after failed initialization', async () => {
      try {
        await provider.init({});
      } catch {
        // Expected
      }
      expect(provider.isReady()).toBe(false);
    });
  });

  // ============================================
  // complete() - Basic tests
  // ============================================

  describe('complete() - basic', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should throw if provider not initialized', async () => {
      const uninitProvider = new GeminiProvider();
      await expect(uninitProvider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      })).rejects.toThrow('Gemini provider not initialized');
    });

    it('should complete simple text message', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('Hello there!'));
      
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      expect(response.content).toBe('Hello there!');
      expect(response.model).toBe('gemini-1.5-pro');
    });

    it('should use custom model from request', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gemini-1.5-flash'
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/models/gemini-1.5-flash:generateContent'),
        expect.any(Object)
      );
    });

    it('should use default model if not specified', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/models/gemini-1.5-pro:generateContent'),
        expect.any(Object)
      );
    });

    it('should include usage metadata when present', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test', {
        usage: { promptTokenCount: 10, candidatesTokenCount: 20 }
      }));
      
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      });
      
      expect(response.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20
      });
    });

    it('should include stopReason from finishReason', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test', {
        finishReason: 'MAX_TOKENS'
      }));
      
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      });
      
      expect(response.stopReason).toBe('MAX_TOKENS');
    });
  });

  // ============================================
  // complete() - System instruction
  // ============================================

  describe('complete() - system instruction', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should send systemPrompt as separate systemInstruction', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }],
        systemPrompt: 'You are a helpful assistant.'
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.systemInstruction).toEqual({
        parts: [{ text: 'You are a helpful assistant.' }]
      });
    });

    it('should not include systemInstruction if no systemPrompt', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.systemInstruction).toBeUndefined();
    });

    it('should skip system role messages in contents array', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [
          { role: 'system', content: 'System message' },
          { role: 'user', content: 'hi' }
        ]
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents).toHaveLength(1);
      expect(callBody.contents[0].role).toBe('user');
    });
  });

  // ============================================
  // complete() - Temperature and maxTokens
  // ============================================

  describe('complete() - temperature and maxTokens', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should use default temperature of 0.7', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.generationConfig.temperature).toBe(0.7);
    });

    it('should use custom temperature from request', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.2
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.generationConfig.temperature).toBe(0.2);
    });

    it('should handle temperature of 0', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.generationConfig.temperature).toBe(0);
    });

    it('should use default maxTokens of 8192', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.init({ apiKey: 'test-key' });
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.generationConfig.maxOutputTokens).toBe(8192);
    });

    it('should use custom maxTokens from request', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 2048
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.generationConfig.maxOutputTokens).toBe(2048);
    });
  });

  // ============================================
  // complete() - Tools / Function calling
  // ============================================

  describe('complete() - tools', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    const sampleTools: ToolDefinition[] = [
      {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
          },
          required: ['location']
        }
      }
    ];

    it('should format tools as functionDeclarations', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
        tools: sampleTools
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.tools).toEqual([{
        functionDeclarations: [{
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
            },
            required: ['location']
          }
        }]
      }]);
    });

    it('should not include tools if empty array', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }],
        tools: []
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.tools).toBeUndefined();
    });

    it('should parse function call response', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('', {
        functionCalls: [{
          name: 'get_weather',
          args: { location: 'Tokyo', unit: 'celsius' }
        }]
      }));
      
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: sampleTools
      });
      
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0].name).toBe('get_weather');
      expect(response.toolCalls![0].arguments).toEqual({ location: 'Tokyo', unit: 'celsius' });
      expect(response.toolCalls![0].id).toMatch(/^call_\d+_0$/);
    });

    it('should parse multiple function calls', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('', {
        functionCalls: [
          { name: 'get_weather', args: { location: 'Tokyo' } },
          { name: 'get_weather', args: { location: 'London' } }
        ]
      }));
      
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Weather in Tokyo and London?' }],
        tools: sampleTools
      });
      
      expect(response.toolCalls).toHaveLength(2);
      expect(response.toolCalls![0].arguments.location).toBe('Tokyo');
      expect(response.toolCalls![1].arguments.location).toBe('London');
    });

    it('should handle function call with text content', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('Let me check the weather.', {
        functionCalls: [{ name: 'get_weather', args: { location: 'Tokyo' } }]
      }));
      
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Weather?' }],
        tools: sampleTools
      });
      
      expect(response.content).toBe('Let me check the weather.');
      expect(response.toolCalls).toHaveLength(1);
    });

    it('should handle function call with empty args', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('', {
        functionCalls: [{ name: 'get_current_time', args: {} }]
      }));
      
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'What time is it?' }],
        tools: [{ name: 'get_current_time', description: 'Get time', parameters: { type: 'object', properties: {} } }]
      });
      
      expect(response.toolCalls![0].arguments).toEqual({});
    });
  });

  // ============================================
  // complete() - Tool/function responses
  // ============================================

  describe('complete() - tool responses', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should format tool response as functionResponse', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('The weather in Tokyo is sunny, 22°C.'));
      
      const messages: Message[] = [
        { role: 'user', content: 'What is the weather in Tokyo?' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'get_weather', name: 'get_weather', arguments: { location: 'Tokyo' } }]
        },
        {
          role: 'tool',
          content: '{"temperature": 22, "condition": "sunny"}',
          toolCallId: 'get_weather'
        }
      ];
      
      await provider.complete({ messages });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const toolResponseMsg = callBody.contents.find((c: any) => c.role === 'function');
      
      expect(toolResponseMsg).toBeDefined();
      expect(toolResponseMsg.parts[0].functionResponse).toEqual({
        name: 'get_weather',
        response: { result: '{"temperature": 22, "condition": "sunny"}' }
      });
    });

    it('should format assistant with toolCalls as model with functionCall parts', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('Done.'));
      
      const messages: Message[] = [
        { role: 'user', content: 'Weather?' },
        {
          role: 'assistant',
          content: 'Checking...',
          toolCalls: [{ id: 'call_1', name: 'get_weather', arguments: { location: 'Tokyo' } }]
        },
        { role: 'tool', content: 'sunny', toolCallId: 'get_weather' }
      ];
      
      await provider.complete({ messages });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const modelMsg = callBody.contents.find((c: any) => c.role === 'model');
      
      expect(modelMsg.parts).toHaveLength(2);
      expect(modelMsg.parts[0]).toEqual({ text: 'Checking...' });
      expect(modelMsg.parts[1]).toEqual({
        functionCall: { name: 'get_weather', args: { location: 'Tokyo' } }
      });
    });

    it('should handle assistant with only toolCalls (no content)', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('Done.'));
      
      const messages: Message[] = [
        { role: 'user', content: 'Weather?' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'get_weather', arguments: { location: 'Paris' } }]
        },
        { role: 'tool', content: 'rainy', toolCallId: 'get_weather' }
      ];
      
      await provider.complete({ messages });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const modelMsg = callBody.contents.find((c: any) => c.role === 'model');
      
      expect(modelMsg.parts).toHaveLength(1);
      expect(modelMsg.parts[0].functionCall).toBeDefined();
    });
  });

  // ============================================
  // complete() - Image support
  // ============================================

  describe('complete() - image support', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should convert base64 image to Gemini inline_data format', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('I see a cat in the image.'));
      
      const messages: Message[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          {
            type: 'image',
            source: {
              type: 'base64',
              mediaType: 'image/jpeg',
              data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            }
          }
        ]
      }];
      
      await provider.complete({ messages });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = callBody.contents[0];
      
      expect(userMsg.parts).toHaveLength(2);
      expect(userMsg.parts[0]).toEqual({ text: 'What is in this image?' });
      expect(userMsg.parts[1]).toEqual({
        inline_data: {
          mime_type: 'image/jpeg',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        }
      });
    });

    it('should use default mime_type image/jpeg if not specified', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      const messages: Message[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this.' },
          {
            type: 'image',
            source: {
              type: 'base64',
              data: 'base64imagedata'
            }
          }
        ]
      }];
      
      await provider.complete({ messages });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents[0].parts[1].inline_data.mime_type).toBe('image/jpeg');
    });

    it('should handle image/png mime type', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      const messages: Message[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          {
            type: 'image',
            source: {
              type: 'base64',
              mediaType: 'image/png',
              data: 'pngbase64data'
            }
          }
        ]
      }];
      
      await provider.complete({ messages });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents[0].parts[1].inline_data.mime_type).toBe('image/png');
    });

    it('should handle multiple images in one message', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('I see two images.'));
      
      const messages: Message[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Compare these images.' },
          { type: 'image', source: { type: 'base64', mediaType: 'image/jpeg', data: 'img1data' } },
          { type: 'image', source: { type: 'base64', mediaType: 'image/jpeg', data: 'img2data' } }
        ]
      }];
      
      await provider.complete({ messages });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents[0].parts).toHaveLength(3);
      expect(callBody.contents[0].parts[1].inline_data.data).toBe('img1data');
      expect(callBody.contents[0].parts[2].inline_data.data).toBe('img2data');
    });

    it('should handle image-only message (no text)', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('A beautiful sunset.'));
      
      const messages: Message[] = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', mediaType: 'image/jpeg', data: 'sunsetdata' } }
        ]
      }];
      
      await provider.complete({ messages });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents[0].parts).toHaveLength(1);
      expect(callBody.contents[0].parts[0].inline_data).toBeDefined();
    });

    it('should skip URL images (not supported by Gemini directly)', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      const messages: Message[] = [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          {
            type: 'image',
            source: {
              type: 'url',
              url: 'https://example.com/image.jpg'
            }
          }
        ]
      }];
      
      await provider.complete({ messages });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      // URL images should be skipped, only text part should be present
      expect(callBody.contents[0].parts).toHaveLength(1);
      expect(callBody.contents[0].parts[0]).toEqual({ text: 'What is this?' });
    });
  });

  // ============================================
  // complete() - Message role handling
  // ============================================

  describe('complete() - message roles', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should convert user role to user', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents[0].role).toBe('user');
    });

    it('should convert assistant role to model', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
          { role: 'user', content: 'How are you?' }
        ]
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents[1].role).toBe('model');
    });

    it('should handle string content for user messages', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [{ role: 'user', content: 'Simple string' }]
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents[0].parts).toEqual([{ text: 'Simple string' }]);
    });

    it('should convert non-string content to string', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      // Using any to bypass type checking for edge case test
      await provider.complete({
        messages: [{ role: 'user', content: 12345 as any }]
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents[0].parts).toEqual([{ text: '12345' }]);
    });

    it('should handle assistant with object content', async () => {
      mockFetch.mockResolvedValueOnce(mockGeminiResponse('test'));
      
      await provider.complete({
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: { key: 'value' } as any },
          { role: 'user', content: 'Continue' }
        ]
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.contents[1].parts[0].text).toBe('{"key":"value"}');
    });
  });

  // ============================================
  // Error handling
  // ============================================

  describe('error handling', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'test-key' });
    });

    it('should throw on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request: Invalid API key'
      });
      
      await expect(provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      })).rejects.toThrow('Gemini API error: 400 - Bad Request: Invalid API key');
    });

    it('should throw on 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });
      
      await expect(provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      })).rejects.toThrow('Gemini API error: 401 - Unauthorized');
    });

    it('should throw on 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      });
      
      await expect(provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      })).rejects.toThrow('Gemini API error: 429 - Rate limit exceeded');
    });

    it('should throw on 500 server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });
      
      await expect(provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      })).rejects.toThrow('Gemini API error: 500 - Internal Server Error');
    });

    it('should throw when no candidate returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [] })
      });
      
      await expect(provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      })).rejects.toThrow('Gemini: No response candidate returned');
    });

    it('should throw when candidates is undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });
      
      await expect(provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      })).rejects.toThrow('Gemini: No response candidate returned');
    });

    it('should handle empty parts gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [] },
            finishReason: 'STOP'
          }]
        })
      });
      
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      });
      
      expect(response.content).toBe('');
      expect(response.toolCalls).toBeUndefined();
    });

    it('should handle undefined content.parts gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {},
            finishReason: 'STOP'
          }]
        })
      });
      
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'hi' }]
      });
      
      expect(response.content).toBe('');
    });
  });

  // ============================================
  // listModels()
  // ============================================

  describe('listModels()', () => {
    it('should return list of available models', async () => {
      const models = await provider.listModels();
      
      expect(models).toContain('gemini-1.5-pro');
      expect(models).toContain('gemini-1.5-flash');
      expect(models).toContain('gemini-1.5-flash-8b');
      expect(models).toContain('gemini-2.0-flash-exp');
      expect(models).toHaveLength(4);
    });

    it('should return same models regardless of initialization', async () => {
      const modelsBefore = await provider.listModels();
      await provider.init({ apiKey: 'test-key' });
      const modelsAfter = await provider.listModels();
      
      expect(modelsBefore).toEqual(modelsAfter);
    });
  });

  // ============================================
  // currentModel()
  // ============================================

  describe('currentModel()', () => {
    it('should return default model before initialization', () => {
      expect(provider.currentModel()).toBe('gemini-1.5-pro');
    });

    it('should return default model after initialization without model config', async () => {
      await provider.init({ apiKey: 'test-key' });
      expect(provider.currentModel()).toBe('gemini-1.5-pro');
    });

    it('should return configured model after initialization', async () => {
      await provider.init({ apiKey: 'test-key', model: 'gemini-1.5-flash' });
      expect(provider.currentModel()).toBe('gemini-1.5-flash');
    });
  });

  // ============================================
  // Provider name
  // ============================================

  describe('provider name', () => {
    it('should have name set to gemini', () => {
      expect(provider.name).toBe('gemini');
    });
  });
});
