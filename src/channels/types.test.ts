/**
 * Channel Types Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  ChannelConfig, 
  ChannelMessage, 
  ChannelResponse, 
  Channel, 
  MessageHandler,
  RegisteredChannel 
} from './types.js';

describe('ChannelConfig', () => {
  it('should create config with enabled flag', () => {
    const config: ChannelConfig = {
      enabled: true,
    };

    expect(config.enabled).toBe(true);
  });

  it('should allow additional properties', () => {
    const config: ChannelConfig = {
      enabled: true,
      token: 'abc123',
      chatId: '456789',
      webhook: 'https://example.com/webhook',
    };

    expect(config.token).toBe('abc123');
    expect(config.chatId).toBe('456789');
    expect(config.webhook).toBe('https://example.com/webhook');
  });
});

describe('ChannelMessage', () => {
  it('should create message with required fields', () => {
    const message: ChannelMessage = {
      id: 'msg_123',
      userId: 'user_456',
      text: 'Hello, world!',
      timestamp: new Date('2024-01-01T12:00:00Z'),
    };

    expect(message.id).toBe('msg_123');
    expect(message.userId).toBe('user_456');
    expect(message.text).toBe('Hello, world!');
    expect(message.timestamp).toEqual(new Date('2024-01-01T12:00:00Z'));
  });

  it('should create message with all fields', () => {
    const message: ChannelMessage = {
      id: 'msg_789',
      userId: 'user_111',
      username: 'testuser',
      text: 'Reply to something',
      timestamp: new Date(),
      replyToId: 'msg_original',
      metadata: {
        chatType: 'private',
        hasMedia: true,
      },
    };

    expect(message.username).toBe('testuser');
    expect(message.replyToId).toBe('msg_original');
    expect(message.metadata?.chatType).toBe('private');
    expect(message.metadata?.hasMedia).toBe(true);
  });
});

describe('ChannelResponse', () => {
  it('should create simple text response', () => {
    const response: ChannelResponse = {
      text: 'Hello back!',
    };

    expect(response.text).toBe('Hello back!');
  });

  it('should create response with reply reference', () => {
    const response: ChannelResponse = {
      text: 'This is a reply',
      replyToId: 'msg_123',
    };

    expect(response.replyToId).toBe('msg_123');
  });

  it('should create response with buttons', () => {
    const response: ChannelResponse = {
      text: 'Choose an option:',
      buttons: [
        { text: 'Option A', callback: 'callback_a' },
        { text: 'Option B', callback: 'callback_b' },
        { text: 'Cancel', callback: 'callback_cancel' },
      ],
    };

    expect(response.buttons).toHaveLength(3);
    expect(response.buttons![0].text).toBe('Option A');
    expect(response.buttons![0].callback).toBe('callback_a');
  });

  it('should create response with metadata', () => {
    const response: ChannelResponse = {
      text: 'Response with metadata',
      metadata: {
        parseMode: 'Markdown',
        disablePreview: true,
      },
    };

    expect(response.metadata?.parseMode).toBe('Markdown');
  });
});

describe('Channel interface', () => {
  it('should create valid channel implementation', () => {
    const channel: Channel = {
      name: 'test',
      displayName: 'Test Channel',
      description: 'A test channel for testing',
      requiredConfig: ['token'],
      optionalConfig: ['webhook', 'timeout'],
      requiredEnv: ['TEST_TOKEN'],
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      isConfigured: vi.fn().mockReturnValue(true),
    };

    expect(channel.name).toBe('test');
    expect(channel.displayName).toBe('Test Channel');
    expect(channel.requiredConfig).toEqual(['token']);
    expect(channel.optionalConfig).toEqual(['webhook', 'timeout']);
    expect(channel.requiredEnv).toEqual(['TEST_TOKEN']);
  });

  it('should support optional validateConfig method', () => {
    const channel: Channel = {
      name: 'validated',
      displayName: 'Validated Channel',
      description: 'Channel with validation',
      requiredConfig: ['apiKey'],
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      isConfigured: vi.fn().mockReturnValue(true),
      validateConfig: vi.fn().mockResolvedValue({ valid: true }),
    };

    expect(channel.validateConfig).toBeDefined();
  });

  it('should handle channel without optional fields', () => {
    const minimalChannel: Channel = {
      name: 'minimal',
      displayName: 'Minimal Channel',
      description: 'Minimal channel',
      requiredConfig: [],
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      isConfigured: vi.fn().mockReturnValue(false),
    };

    expect(minimalChannel.optionalConfig).toBeUndefined();
    expect(minimalChannel.requiredEnv).toBeUndefined();
    expect(minimalChannel.validateConfig).toBeUndefined();
  });
});

describe('MessageHandler', () => {
  it('should be a valid function type', () => {
    const handler: MessageHandler = vi.fn().mockResolvedValue({
      text: 'Response',
    });

    expect(typeof handler).toBe('function');
  });

  it('should handle returning null', async () => {
    const handler: MessageHandler = vi.fn().mockResolvedValue(null);

    const channel: Channel = {
      name: 'test',
      displayName: 'Test',
      description: 'Test',
      requiredConfig: [],
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      isConfigured: vi.fn().mockReturnValue(true),
    };

    const message: ChannelMessage = {
      id: 'msg_1',
      userId: 'user_1',
      text: 'Hello',
      timestamp: new Date(),
    };

    const result = await handler(channel, message);
    expect(result).toBeNull();
  });
});

describe('RegisteredChannel', () => {
  it('should create registered channel record', () => {
    const channel: Channel = {
      name: 'telegram',
      displayName: 'Telegram',
      description: 'Telegram bot',
      requiredConfig: ['token'],
      initialize: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      send: vi.fn(),
      isConfigured: vi.fn(),
    };

    const registered: RegisteredChannel = {
      channel,
      enabled: true,
      config: {
        enabled: true,
        token: 'bot123:abc',
      },
    };

    expect(registered.channel.name).toBe('telegram');
    expect(registered.enabled).toBe(true);
    expect(registered.config?.token).toBe('bot123:abc');
  });

  it('should handle disabled channel', () => {
    const channel: Channel = {
      name: 'disabled',
      displayName: 'Disabled',
      description: 'Disabled channel',
      requiredConfig: [],
      initialize: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      send: vi.fn(),
      isConfigured: vi.fn(),
    };

    const registered: RegisteredChannel = {
      channel,
      enabled: false,
    };

    expect(registered.enabled).toBe(false);
    expect(registered.config).toBeUndefined();
  });
});

describe('Channel workflow scenarios', () => {
  it('should represent typical channel lifecycle', async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    const startFn = vi.fn().mockResolvedValue(undefined);
    const stopFn = vi.fn().mockResolvedValue(undefined);
    const sendFn = vi.fn().mockResolvedValue(undefined);

    const channel: Channel = {
      name: 'lifecycle',
      displayName: 'Lifecycle Channel',
      description: 'Testing lifecycle',
      requiredConfig: ['token'],
      initialize: initFn,
      start: startFn,
      stop: stopFn,
      send: sendFn,
      isConfigured: () => true,
    };

    // 1. Initialize
    await channel.initialize({ enabled: true, token: 'test' });
    expect(initFn).toHaveBeenCalled();

    // 2. Start
    await channel.start();
    expect(startFn).toHaveBeenCalled();

    // 3. Send messages
    await channel.send('user_1', { text: 'Hello!' });
    expect(sendFn).toHaveBeenCalledWith('user_1', { text: 'Hello!' });

    // 4. Stop
    await channel.stop();
    expect(stopFn).toHaveBeenCalled();
  });

  it('should represent message handling flow', async () => {
    const channel: Channel = {
      name: 'handler-test',
      displayName: 'Handler Test',
      description: 'Testing message handling',
      requiredConfig: [],
      initialize: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      send: vi.fn(),
      isConfigured: () => true,
    };

    const handler: MessageHandler = async (ch, msg) => {
      if (msg.text.toLowerCase().includes('hello')) {
        return { text: `Hi ${msg.username || 'there'}!` };
      }
      return null;
    };

    const message1: ChannelMessage = {
      id: 'msg_1',
      userId: 'user_1',
      username: 'john',
      text: 'Hello bot!',
      timestamp: new Date(),
    };

    const message2: ChannelMessage = {
      id: 'msg_2',
      userId: 'user_2',
      text: 'Goodbye',
      timestamp: new Date(),
    };

    const response1 = await handler(channel, message1);
    const response2 = await handler(channel, message2);

    expect(response1?.text).toBe('Hi john!');
    expect(response2).toBeNull();
  });
});
