/**
 * OpenAI Provider Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { OpenAIProvider } from './openai.js';

// Create the mock function outside the mock factory
const mockCompletionsCreate = vi.fn();

// Track constructor calls
let constructorCalls: any[] = [];

// Mock the OpenAI module
vi.mock('openai', () => {
  // Return a class that can be instantiated with `new`
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCompletionsCreate,
        },
      };

      constructor(config: any) {
        constructorCalls.push(config);
      }
    },
  };
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    vi.clearAllMocks();
    constructorCalls = [];
    // Clear environment variable
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('name', () => {
    it('should be "openai"', () => {
      expect(provider.name).toBe('openai');
    });
  });

  describe('init()', () => {
    it('should initialize with apiKey', async () => {
      await provider.init({ apiKey: 'sk-test-key' });

      expect(constructorCalls).toHaveLength(1);
      expect(constructorCalls[0]).toEqual({
        apiKey: 'sk-test-key',
        baseURL: undefined,
      });
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with oauthToken (highest priority)', async () => {
      await provider.init({
        oauthToken: 'oauth-token',
        authToken: 'auth-token',
        apiKey: 'api-key',
      });

      expect(constructorCalls[0].apiKey).toBe('oauth-token');
    });

    it('should initialize with authToken (second priority)', async () => {
      await provider.init({
        authToken: 'auth-token',
        apiKey: 'api-key',
      });

      expect(constructorCalls[0].apiKey).toBe('auth-token');
    });

    it('should fall back to OPENAI_API_KEY environment variable', async () => {
      process.env.OPENAI_API_KEY = 'sk-env-key';
      await provider.init({});

      expect(constructorCalls[0].apiKey).toBe('sk-env-key');
    });

    it('should throw error when no API key is provided', async () => {
      await expect(provider.init({})).rejects.toThrow(
        'OpenAI: No API key or auth token provided'
      );
    });

    it('should use custom baseUrl when provided', async () => {
      await provider.init({
        apiKey: 'sk-test',
        baseUrl: 'https://custom.openai.azure.com',
      });

      expect(constructorCalls[0]).toEqual({
        apiKey: 'sk-test',
        baseURL: 'https://custom.openai.azure.com',
      });
    });

    it('should set custom model when provided', async () => {
      await provider.init({
        apiKey: 'sk-test',
        model: 'gpt-4-turbo',
      });

      expect(provider.currentModel()).toBe('gpt-4-turbo');
    });

    it('should use default model gpt-4o when not specified', async () => {
      await provider.init({ apiKey: 'sk-test' });

      expect(provider.currentModel()).toBe('gpt-4o');
    });

    it('should set custom maxTokens when provided', async () => {
      await provider.init({
        apiKey: 'sk-test',
        maxTokens: 8192,
      });

      // maxTokens is private, verify through complete behavior
      expect(provider.isReady()).toBe(true);
    });
  });

  describe('isReady()', () => {
    it('should return false before initialization', () => {
      expect(provider.isReady()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      await provider.init({ apiKey: 'sk-test' });
      expect(provider.isReady()).toBe(true);
    });
  });

  describe('currentModel()', () => {
    it('should return default model before init', () => {
      expect(provider.currentModel()).toBe('gpt-4o');
    });

    it('should return configured model after init', async () => {
      await provider.init({ apiKey: 'sk-test', model: 'gpt-4o-mini' });
      expect(provider.currentModel()).toBe('gpt-4o-mini');
    });
  });

  describe('listModels()', () => {
    it('should return list of available models', async () => {
      const models = await provider.listModels();

      expect(models).toContain('gpt-4o');
      expect(models).toContain('gpt-4o-mini');
      expect(models).toContain('gpt-4-turbo');
      expect(models).toContain('o1-preview');
      expect(models).toContain('o1-mini');
    });

    it('should return models without requiring initialization', async () => {
      const models = await provider.listModels();
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('complete()', () => {
    beforeEach(async () => {
      await provider.init({ apiKey: 'sk-test' });
    });

    describe('basic completions', () => {
      it('should throw error when not initialized', async () => {
        const uninitializedProvider = new OpenAIProvider();

        await expect(
          uninitializedProvider.complete({
            messages: [{ role: 'user', content: 'Hello' }],
          })
        ).rejects.toThrow('OpenAI provider not initialized');
      });

      it('should complete simple text message', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [
            {
              message: { content: 'Hello! How can I help?' },
              finish_reason: 'stop',
            },
          ],
          model: 'gpt-4o',
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Hello' }],
        });

        expect(response.content).toBe('Hello! How can I help?');
        expect(response.model).toBe('gpt-4o');
        expect(response.stopReason).toBe('stop');
      });

      it('should include usage information', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
          usage: { prompt_tokens: 15, completion_tokens: 10 },
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.usage).toEqual({
          inputTokens: 15,
          outputTokens: 10,
        });
      });

      it('should handle missing usage gracefully', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.usage).toBeUndefined();
      });
    });

    describe('system prompt handling', () => {
      it('should add system prompt as separate message', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'Hello' }],
          systemPrompt: 'You are a helpful assistant.',
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: 'Hello' },
            ],
          })
        );
      });

      it('should skip system messages from input when systemPrompt provided', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            { role: 'system', content: 'Old system prompt' },
            { role: 'user', content: 'Hello' },
          ],
          systemPrompt: 'New system prompt',
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [
              { role: 'system', content: 'New system prompt' },
              { role: 'user', content: 'Hello' },
            ],
          })
        );
      });
    });

    describe('model and parameters', () => {
      it('should use request model over default', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4-turbo',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'gpt-4-turbo',
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({ model: 'gpt-4-turbo' })
        );
      });

      it('should use default temperature of 0.7', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({ temperature: 0.7 })
        );
      });

      it('should use custom temperature when provided', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 0.2,
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({ temperature: 0.2 })
        );
      });

      it('should handle temperature of 0', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 0,
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({ temperature: 0 })
        );
      });

      it('should use custom maxTokens when provided', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
          maxTokens: 2048,
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({ max_tokens: 2048 })
        );
      });

      it('should use default maxTokens of 4096', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({ max_tokens: 4096 })
        );
      });

      it('should use configured maxTokens from init', async () => {
        // Create a new provider with custom maxTokens
        const customProvider = new OpenAIProvider();
        await customProvider.init({ apiKey: 'sk-test', maxTokens: 8192 });

        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await customProvider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({ max_tokens: 8192 })
        );
      });
    });

    describe('tool/function calling', () => {
      it('should pass tools to OpenAI in correct format', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'What is the weather?' }],
          tools: [
            {
              name: 'get_weather',
              description: 'Get current weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'City name' },
                },
                required: ['location'],
              },
            },
          ],
        });

        expect(mockCompletionsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [
              {
                type: 'function',
                function: {
                  name: 'get_weather',
                  description: 'Get current weather',
                  parameters: {
                    type: 'object',
                    properties: {
                      location: { type: 'string', description: 'City name' },
                    },
                    required: ['location'],
                  },
                },
              },
            ],
          })
        );
      });

      it('should handle multiple tools', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
          tools: [
            {
              name: 'tool_a',
              description: 'Tool A',
              parameters: { type: 'object', properties: {} },
            },
            {
              name: 'tool_b',
              description: 'Tool B',
              parameters: { type: 'object', properties: {} },
            },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.tools).toHaveLength(2);
        expect(callArgs.tools[0].function.name).toBe('tool_a');
        expect(callArgs.tools[1].function.name).toBe('tool_b');
      });

      it('should not include tools when empty array', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
          tools: [],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.tools).toBeUndefined();
      });

      it('should parse tool calls from response', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_abc123',
                    type: 'function',
                    function: {
                      name: 'get_weather',
                      arguments: '{"location":"Tokyo"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          model: 'gpt-4o',
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Weather in Tokyo?' }],
          tools: [
            {
              name: 'get_weather',
              description: 'Get weather',
              parameters: { type: 'object', properties: {} },
            },
          ],
        });

        expect(response.toolCalls).toEqual([
          {
            id: 'call_abc123',
            name: 'get_weather',
            arguments: { location: 'Tokyo' },
          },
        ]);
        expect(response.stopReason).toBe('tool_calls');
      });

      it('should handle multiple tool calls in response', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'tool_a', arguments: '{"x":1}' },
                  },
                  {
                    id: 'call_2',
                    type: 'function',
                    function: { name: 'tool_b', arguments: '{"y":2}' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          model: 'gpt-4o',
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.toolCalls).toHaveLength(2);
        expect(response.toolCalls?.[0].name).toBe('tool_a');
        expect(response.toolCalls?.[0].arguments).toEqual({ x: 1 });
        expect(response.toolCalls?.[1].name).toBe('tool_b');
        expect(response.toolCalls?.[1].arguments).toEqual({ y: 2 });
      });

      it('should handle empty tool call arguments', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'no_args_tool', arguments: '' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          model: 'gpt-4o',
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.toolCalls?.[0].arguments).toEqual({});
      });
    });

    describe('tool results handling', () => {
      it('should convert tool result messages to OpenAI format', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'The weather is sunny.' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            { role: 'user', content: 'Weather?' },
            {
              role: 'assistant',
              content: '',
              toolCalls: [
                { id: 'call_123', name: 'get_weather', arguments: { location: 'Tokyo' } },
              ],
            },
            { role: 'tool', content: '{"temp": 25, "condition": "sunny"}', toolCallId: 'call_123' },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages).toEqual([
          { role: 'user', content: 'Weather?' },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: { name: 'get_weather', arguments: '{"location":"Tokyo"}' },
              },
            ],
          },
          {
            role: 'tool',
            content: '{"temp": 25, "condition": "sunny"}',
            tool_call_id: 'call_123',
          },
        ]);
      });

      it('should handle assistant message with content and tool calls', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Done!' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            {
              role: 'assistant',
              content: 'Let me check that.',
              toolCalls: [{ id: 'call_1', name: 'search', arguments: { q: 'test' } }],
            },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages[0]).toEqual({
          role: 'assistant',
          content: 'Let me check that.',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'search', arguments: '{"q":"test"}' },
            },
          ],
        });
      });

      it('should handle multiple tool results in sequence', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Summary' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            { role: 'user', content: 'Query' },
            {
              role: 'assistant',
              content: '',
              toolCalls: [
                { id: 'call_1', name: 'tool_a', arguments: {} },
                { id: 'call_2', name: 'tool_b', arguments: {} },
              ],
            },
            { role: 'tool', content: 'result_a', toolCallId: 'call_1' },
            { role: 'tool', content: 'result_b', toolCallId: 'call_2' },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages).toHaveLength(4);
        expect(callArgs.messages[2].tool_call_id).toBe('call_1');
        expect(callArgs.messages[3].tool_call_id).toBe('call_2');
      });
    });

    describe('image content handling', () => {
      it('should convert base64 image to OpenAI format', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'I see a cat.' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'What is in this image?' },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    mediaType: 'image/jpeg',
                    data: 'abc123base64data',
                  },
                },
              ],
            },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages[0]).toEqual({
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/jpeg;base64,abc123base64data' },
            },
          ],
        });
      });

      it('should convert URL image to OpenAI format', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'A landscape.' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this.' },
                {
                  type: 'image',
                  source: {
                    type: 'url',
                    url: 'https://example.com/image.jpg',
                  },
                },
              ],
            },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages[0]).toEqual({
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this.' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/image.jpg' },
            },
          ],
        });
      });

      it('should use default mediaType image/jpeg for base64 without mediaType', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    data: 'somedata',
                  },
                },
              ],
            },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content[0]).toEqual({
          type: 'image_url',
          image_url: { url: 'data:image/jpeg;base64,somedata' },
        });
      });

      it('should handle multiple images in one message', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Comparing images...' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Compare these images' },
                {
                  type: 'image',
                  source: { type: 'base64', mediaType: 'image/png', data: 'img1data' },
                },
                {
                  type: 'image',
                  source: { type: 'url', url: 'https://example.com/img2.jpg' },
                },
              ],
            },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toHaveLength(3);
        expect(callArgs.messages[0].content[1].image_url.url).toBe(
          'data:image/png;base64,img1data'
        );
        expect(callArgs.messages[0].content[2].image_url.url).toBe(
          'https://example.com/img2.jpg'
        );
      });

      it('should handle image in assistant message', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            {
              role: 'assistant',
              content: [
                { type: 'text', text: 'Here is an image I generated:' },
                {
                  type: 'image',
                  source: { type: 'url', url: 'https://dalle.example.com/output.png' },
                },
              ],
            },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages[0].role).toBe('assistant');
        expect(callArgs.messages[0].content[1]).toEqual({
          type: 'image_url',
          image_url: { url: 'https://dalle.example.com/output.png' },
        });
      });

      it('should handle image-only message without text', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'A photo' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        await provider.complete({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', mediaType: 'image/webp', data: 'webpdata' },
                },
              ],
            },
          ],
        });

        const callArgs = mockCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toHaveLength(1);
        expect(callArgs.messages[0].content[0].image_url.url).toBe(
          'data:image/webp;base64,webpdata'
        );
      });
    });

    describe('error handling', () => {
      it('should propagate API errors', async () => {
        const apiError = new Error('Rate limit exceeded');
        mockCompletionsCreate.mockRejectedValueOnce(apiError);

        await expect(
          provider.complete({
            messages: [{ role: 'user', content: 'Test' }],
          })
        ).rejects.toThrow('Rate limit exceeded');
      });

      it('should handle null content in response', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: null }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.content).toBe('');
      });

      it('should handle missing finish_reason', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response' } }],
          model: 'gpt-4o',
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.stopReason).toBeUndefined();
      });

      it('should return undefined toolCalls when none present', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Just text' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.toolCalls).toBeUndefined();
      });

      it('should handle empty tool_calls array', async () => {
        mockCompletionsCreate.mockResolvedValueOnce({
          choices: [{ message: { content: 'Response', tool_calls: [] }, finish_reason: 'stop' }],
          model: 'gpt-4o',
        });

        const response = await provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        });

        expect(response.toolCalls).toBeUndefined();
      });

      it('should handle network errors', async () => {
        const networkError = new Error('Network error: ECONNREFUSED');
        mockCompletionsCreate.mockRejectedValueOnce(networkError);

        await expect(
          provider.complete({
            messages: [{ role: 'user', content: 'Test' }],
          })
        ).rejects.toThrow('Network error: ECONNREFUSED');
      });
    });
  });
});
