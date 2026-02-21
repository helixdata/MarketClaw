/**
 * Slack Channel Tests
 * Tests SlackChannel implementation with mocked @slack/bolt
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create mock objects
const mockClient = {
  chat: {
    postMessage: vi.fn().mockResolvedValue({}),
  },
  auth: {
    test: vi.fn().mockResolvedValue({ ok: true }),
  },
};

const mockApp = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  event: vi.fn(),
  command: vi.fn(),
  client: mockClient,
};

// Mock @slack/bolt
vi.mock('@slack/bolt', () => {
  return {
    App: vi.fn().mockImplementation(function(this: any) {
      Object.assign(this, mockApp);
      return this;
    }),
    LogLevel: {
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
    },
  };
});

// Mock pino
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock the registry to avoid side effects
vi.mock('./registry.js', () => ({
  channelRegistry: {
    register: vi.fn(),
    getMessageHandler: vi.fn(),
  },
}));

// Mock fs/promises for image download tests
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock fs for existsSync
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { SlackChannel, SlackConfig } from './slack.js';
import { App, LogLevel } from '@slack/bolt';
import { channelRegistry } from './registry.js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Helper to get mocks
const getMockApp = () => mockApp;
const getMockClient = () => mockClient;

describe('SlackChannel', () => {
  let channel: SlackChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockClient.chat.postMessage.mockResolvedValue({});
    mockClient.auth.test.mockResolvedValue({ ok: true });
    mockApp.start.mockResolvedValue(undefined);
    mockApp.stop.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });
    channel = new SlackChannel();
  });

  afterEach(async () => {
    try {
      await channel.stop();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('static properties', () => {
    it('should have correct name', () => {
      expect(channel.name).toBe('slack');
    });

    it('should have correct displayName', () => {
      expect(channel.displayName).toBe('Slack');
    });

    it('should have correct description', () => {
      expect(channel.description).toBe('Interact with MarketClaw via Slack bot');
    });

    it('should have correct requiredConfig', () => {
      expect(channel.requiredConfig).toEqual(['botToken', 'appToken']);
    });

    it('should have correct optionalConfig', () => {
      expect(channel.optionalConfig).toEqual(['signingSecret', 'allowedChannels', 'allowedUsers']);
    });

    it('should have correct requiredEnv', () => {
      expect(channel.requiredEnv).toEqual(['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN']);
    });
  });

  describe('initialize', () => {
    it('should initialize with valid config', async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };

      await channel.initialize(config);

      expect(App).toHaveBeenCalledWith({
        token: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
        socketMode: true,
        logLevel: LogLevel.WARN,
      });
    });

    it('should fall back to env var for botToken if not in config', async () => {
      const originalBotToken = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = 'xoxb-env-bot-token';

      try {
        const config: SlackConfig = {
          enabled: true,
          botToken: '', // Empty, should use env var
          appToken: 'xapp-test-app-token',
        };

        await channel.initialize(config);

        expect(App).toHaveBeenCalledWith(
          expect.objectContaining({
            token: 'xoxb-env-bot-token',
          })
        );
      } finally {
        if (originalBotToken) {
          process.env.SLACK_BOT_TOKEN = originalBotToken;
        } else {
          delete process.env.SLACK_BOT_TOKEN;
        }
      }
    });

    it('should fall back to env var for appToken if not in config', async () => {
      const originalAppToken = process.env.SLACK_APP_TOKEN;
      process.env.SLACK_APP_TOKEN = 'xapp-env-app-token';

      try {
        const config: SlackConfig = {
          enabled: true,
          botToken: 'xoxb-test-bot-token',
          appToken: '', // Empty, should use env var
        };

        await channel.initialize(config);

        expect(App).toHaveBeenCalledWith(
          expect.objectContaining({
            appToken: 'xapp-env-app-token',
          })
        );
      } finally {
        if (originalAppToken) {
          process.env.SLACK_APP_TOKEN = originalAppToken;
        } else {
          delete process.env.SLACK_APP_TOKEN;
        }
      }
    });

    it('should throw error when no botToken available', async () => {
      const originalBotToken = process.env.SLACK_BOT_TOKEN;
      delete process.env.SLACK_BOT_TOKEN;

      try {
        const config: SlackConfig = {
          enabled: true,
          botToken: '',
          appToken: 'xapp-test-app-token',
        };

        await expect(channel.initialize(config)).rejects.toThrow(
          'Slack bot token not configured'
        );
      } finally {
        if (originalBotToken) {
          process.env.SLACK_BOT_TOKEN = originalBotToken;
        }
      }
    });

    it('should throw error when no appToken available', async () => {
      const originalAppToken = process.env.SLACK_APP_TOKEN;
      delete process.env.SLACK_APP_TOKEN;

      try {
        const config: SlackConfig = {
          enabled: true,
          botToken: 'xoxb-test-bot-token',
          appToken: '',
        };

        await expect(channel.initialize(config)).rejects.toThrow(
          'Slack app token not configured (needed for socket mode)'
        );
      } finally {
        if (originalAppToken) {
          process.env.SLACK_APP_TOKEN = originalAppToken;
        }
      }
    });

    it('should set up message handlers', async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };

      await channel.initialize(config);

      const app = getMockApp();
      expect(app.event).toHaveBeenCalledWith('app_mention', expect.any(Function));
      expect(app.event).toHaveBeenCalledWith('message', expect.any(Function));
      expect(app.command).toHaveBeenCalledWith('/marketclaw', expect.any(Function));
    });

    it('should initialize with allowedChannels', async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
        allowedChannels: ['C123', 'C456'],
      };

      await channel.initialize(config);

      expect(App).toHaveBeenCalled();
    });

    it('should initialize with allowedUsers', async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
        allowedUsers: ['U123', 'U456'],
      };

      await channel.initialize(config);

      expect(App).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should start the bot in socket mode', async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };

      await channel.initialize(config);
      await channel.start();

      const app = getMockApp();
      expect(app.start).toHaveBeenCalled();
    });

    it('should throw if not initialized', async () => {
      await expect(channel.start()).rejects.toThrow('Channel not initialized');
    });
  });

  describe('stop', () => {
    it('should stop the bot', async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };

      await channel.initialize(config);
      await channel.start();
      await channel.stop();

      const app = getMockApp();
      expect(app.stop).toHaveBeenCalled();
    });

    it('should handle stop when not started', async () => {
      // Should not throw
      await channel.stop();
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };
      await channel.initialize(config);
    });

    it('should send message to user', async () => {
      await channel.send('U123456', { text: 'Hello, user!' });

      const client = getMockClient();
      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'U123456',
        text: 'Hello, user!',
      });
    });

    it('should send message to DM channel', async () => {
      await channel.send('D123456', { text: 'Hello in DM!' });

      const client = getMockClient();
      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'D123456',
        text: 'Hello in DM!',
      });
    });

    it('should throw if not initialized', async () => {
      const uninitChannel = new SlackChannel();

      await expect(
        uninitChannel.send('U123', { text: 'test' })
      ).rejects.toThrow('Channel not initialized');
    });

    it('should throw on API error', async () => {
      const client = getMockClient();
      client.chat.postMessage.mockRejectedValueOnce(new Error('API error'));

      await expect(
        channel.send('U123456', { text: 'Hello' })
      ).rejects.toThrow('API error');
    });
  });

  describe('sendToChannel', () => {
    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };
      await channel.initialize(config);
    });

    it('should send message to channel', async () => {
      await channel.sendToChannel('C123456', { text: 'Hello, channel!' });

      const client = getMockClient();
      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123456',
        text: 'Hello, channel!',
        thread_ts: undefined,
      });
    });

    it('should send message to channel with thread_ts', async () => {
      await channel.sendToChannel('C123456', { text: 'Reply in thread!' }, '1234567890.123456');

      const client = getMockClient();
      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123456',
        text: 'Reply in thread!',
        thread_ts: '1234567890.123456',
      });
    });

    it('should throw if not initialized', async () => {
      const uninitChannel = new SlackChannel();

      await expect(
        uninitChannel.sendToChannel('C123', { text: 'test' })
      ).rejects.toThrow('Channel not initialized');
    });

    it('should throw on API error', async () => {
      const client = getMockClient();
      client.chat.postMessage.mockRejectedValueOnce(new Error('Channel not found'));

      await expect(
        channel.sendToChannel('C123456', { text: 'Hello' })
      ).rejects.toThrow('Channel not found');
    });
  });

  describe('isConfigured', () => {
    it('should return true when config has both tokens', async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-token',
        appToken: 'xapp-test-token',
      };

      await channel.initialize(config);

      expect(channel.isConfigured()).toBe(true);
    });

    it('should return true when env vars are set', () => {
      const originalBotToken = process.env.SLACK_BOT_TOKEN;
      const originalAppToken = process.env.SLACK_APP_TOKEN;
      process.env.SLACK_BOT_TOKEN = 'xoxb-env-token';
      process.env.SLACK_APP_TOKEN = 'xapp-env-token';

      try {
        expect(channel.isConfigured()).toBe(true);
      } finally {
        if (originalBotToken) {
          process.env.SLACK_BOT_TOKEN = originalBotToken;
        } else {
          delete process.env.SLACK_BOT_TOKEN;
        }
        if (originalAppToken) {
          process.env.SLACK_APP_TOKEN = originalAppToken;
        } else {
          delete process.env.SLACK_APP_TOKEN;
        }
      }
    });

    it('should return false when no botToken available', () => {
      const originalBotToken = process.env.SLACK_BOT_TOKEN;
      const originalAppToken = process.env.SLACK_APP_TOKEN;
      delete process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_APP_TOKEN = 'xapp-env-token';

      try {
        const freshChannel = new SlackChannel();
        expect(freshChannel.isConfigured()).toBe(false);
      } finally {
        if (originalBotToken) {
          process.env.SLACK_BOT_TOKEN = originalBotToken;
        }
        if (originalAppToken) {
          process.env.SLACK_APP_TOKEN = originalAppToken;
        } else {
          delete process.env.SLACK_APP_TOKEN;
        }
      }
    });

    it('should return false when no appToken available', () => {
      const originalBotToken = process.env.SLACK_BOT_TOKEN;
      const originalAppToken = process.env.SLACK_APP_TOKEN;
      process.env.SLACK_BOT_TOKEN = 'xoxb-env-token';
      delete process.env.SLACK_APP_TOKEN;

      try {
        const freshChannel = new SlackChannel();
        expect(freshChannel.isConfigured()).toBe(false);
      } finally {
        if (originalBotToken) {
          process.env.SLACK_BOT_TOKEN = originalBotToken;
        } else {
          delete process.env.SLACK_BOT_TOKEN;
        }
        if (originalAppToken) {
          process.env.SLACK_APP_TOKEN = originalAppToken;
        }
      }
    });
  });

  describe('validateConfig', () => {
    it('should return valid for correct tokens', async () => {
      const result = await channel.validateConfig!({
        enabled: true,
        botToken: 'xoxb-valid-token',
        appToken: 'xapp-valid-token',
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid when botToken is missing', async () => {
      const result = await channel.validateConfig!({
        enabled: true,
        botToken: '',
        appToken: 'xapp-valid-token',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bot token is required');
    });

    it('should return invalid when appToken is missing', async () => {
      const result = await channel.validateConfig!({
        enabled: true,
        botToken: 'xoxb-valid-token',
        appToken: '',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('App token is required for socket mode');
    });

    it('should return invalid for bad tokens', async () => {
      mockClient.auth.test.mockRejectedValueOnce(new Error('invalid_auth'));

      const result = await channel.validateConfig!({
        enabled: true,
        botToken: 'xoxb-invalid-token',
        appToken: 'xapp-invalid-token',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid tokens');
    });
  });

  describe('app_mention handler', () => {
    let appMentionHandler: Function;

    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };
      await channel.initialize(config);

      // Capture the app_mention handler
      const app = getMockApp();
      const call = app.event.mock.calls.find((c: any) => c[0] === 'app_mention');
      appMentionHandler = call[1];
    });

    it('should handle app mention event', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> hello bot',
        ts: '1234567890.123456',
        channel: 'C789',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          userId: 'U123',
          text: 'hello bot',
        })
      );
      expect(mockSay).toHaveBeenCalledWith({
        text: 'Response',
        thread_ts: '1234567890.123456',
      });
    });

    it('should reply in thread when original was in thread', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Thread response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> reply in thread',
        ts: '1234567890.123456',
        channel: 'C789',
        thread_ts: '1234567880.000000',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockSay).toHaveBeenCalledWith({
        text: 'Thread response',
        thread_ts: '1234567880.000000',
      });
    });

    it('should send warning when no handler configured', async () => {
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(null);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> hello',
        ts: '1234567890.123456',
        channel: 'C789',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockSay).toHaveBeenCalledWith({
        text: '⚠️ Agent not configured.',
        thread_ts: undefined,
      });
    });

    it('should send error message on handler failure', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> cause error',
        ts: '1234567890.123456',
        channel: 'C789',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockSay).toHaveBeenCalledWith({
        text: '❌ Error processing your message.',
        thread_ts: undefined,
      });
    });
  });

  describe('direct message handler', () => {
    let messageHandler: Function;

    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };
      await channel.initialize(config);

      // Capture the message handler
      const app = getMockApp();
      const call = app.event.mock.calls.find((c: any) => c[0] === 'message');
      messageHandler = call[1];
    });

    it('should handle DM messages', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'DM Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: 'Hello in DM',
        ts: '1234567890.123456',
        channel: 'D789',
        channel_type: 'im',
      };

      await messageHandler({ event, say: mockSay });

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          userId: 'U123',
          text: 'Hello in DM',
        })
      );
    });

    it('should ignore non-DM messages', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: 'Channel message',
        ts: '1234567890.123456',
        channel: 'C789',
        channel_type: 'channel', // Not a DM
      };

      await messageHandler({ event, say: mockSay });

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockSay).not.toHaveBeenCalled();
    });
  });

  describe('slash command handler', () => {
    let commandHandler: Function;

    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };
      await channel.initialize(config);

      // Capture the command handler
      const app = getMockApp();
      const call = app.command.mock.calls.find((c: any) => c[0] === '/marketclaw');
      commandHandler = call[1];
    });

    it('should handle /marketclaw command', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Command response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockAck = vi.fn().mockResolvedValue({});
      const mockRespond = vi.fn().mockResolvedValue({});
      const command = {
        trigger_id: 'trigger123',
        user_id: 'U123',
        user_name: 'testuser',
        text: 'analyze AAPL',
        channel_id: 'C789',
        channel_name: 'general',
      };

      await commandHandler({ command, ack: mockAck, respond: mockRespond });

      expect(mockAck).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          id: 'trigger123',
          userId: 'U123',
          username: 'testuser',
          text: 'analyze AAPL',
          metadata: expect.objectContaining({
            channelId: 'C789',
            channelName: 'general',
            isSlashCommand: true,
          }),
        })
      );
      expect(mockRespond).toHaveBeenCalledWith('Command response');
    });

    it('should respond with warning when no handler configured', async () => {
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(null);

      const mockAck = vi.fn().mockResolvedValue({});
      const mockRespond = vi.fn().mockResolvedValue({});
      const command = {
        trigger_id: 'trigger123',
        user_id: 'U123',
        user_name: 'testuser',
        text: 'test',
        channel_id: 'C789',
        channel_name: 'general',
      };

      await commandHandler({ command, ack: mockAck, respond: mockRespond });

      expect(mockRespond).toHaveBeenCalledWith('⚠️ Agent not configured.');
    });

    it('should respond with error on handler failure', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Command error'));
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockAck = vi.fn().mockResolvedValue({});
      const mockRespond = vi.fn().mockResolvedValue({});
      const command = {
        trigger_id: 'trigger123',
        user_id: 'U123',
        user_name: 'testuser',
        text: 'cause error',
        channel_id: 'C789',
        channel_name: 'general',
      };

      await commandHandler({ command, ack: mockAck, respond: mockRespond });

      expect(mockRespond).toHaveBeenCalledWith('❌ Error processing your command.');
    });
  });

  describe('user restrictions', () => {
    let appMentionHandler: Function;

    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
        allowedUsers: ['U123', 'U456'],
      };
      await channel.initialize(config);

      const app = getMockApp();
      const call = app.event.mock.calls.find((c: any) => c[0] === 'app_mention');
      appMentionHandler = call[1];
    });

    it('should allow messages from allowed users', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123', // Allowed user
        text: '<@B456> hello',
        ts: '1234567890.123456',
        channel: 'C789',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should ignore messages from non-allowed users', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U999', // Not allowed
        text: '<@B456> hello',
        ts: '1234567890.123456',
        channel: 'C789',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockSay).not.toHaveBeenCalled();
    });
  });

  describe('channel restrictions', () => {
    let appMentionHandler: Function;

    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
        allowedChannels: ['C123', 'C456'],
      };
      await channel.initialize(config);

      const app = getMockApp();
      const call = app.event.mock.calls.find((c: any) => c[0] === 'app_mention');
      appMentionHandler = call[1];
    });

    it('should allow messages in allowed channels', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> hello',
        ts: '1234567890.123456',
        channel: 'C123', // Allowed channel
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should ignore messages in non-allowed channels', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> hello',
        ts: '1234567890.123456',
        channel: 'C999', // Not allowed
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockSay).not.toHaveBeenCalled();
    });
  });

  describe('image download support', () => {
    let appMentionHandler: Function;

    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };
      await channel.initialize(config);

      const app = getMockApp();
      const call = app.event.mock.calls.find((c: any) => c[0] === 'app_mention');
      appMentionHandler = call[1];
    });

    it('should download image with auth header', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Got image!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> check this image',
        ts: '1234567890.123456',
        channel: 'C789',
        files: [{
          id: 'F123',
          name: 'test.jpg',
          mimetype: 'image/jpeg',
          url_private: 'https://files.slack.com/files/test.jpg',
          url_private_download: 'https://files.slack.com/files/test.jpg?download=true',
        }],
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://files.slack.com/files/test.jpg?download=true',
        {
          headers: {
            'Authorization': 'Bearer xoxb-test-bot-token',
          },
        }
      );
    });

    it('should include image in message when downloaded', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Got image!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> check this',
        ts: '1234567890.123456',
        channel: 'C789',
        files: [{
          id: 'F123',
          name: 'test.png',
          mimetype: 'image/png',
          url_private: 'https://files.slack.com/files/test.png',
        }],
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({
              id: 'F123',
              mimeType: 'image/png',
            }),
          ]),
          metadata: expect.objectContaining({
            hasImage: true,
          }),
        })
      );
    });

    it('should save image to local filesystem', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Saved!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> save this',
        ts: '1234567890.123456',
        channel: 'C789',
        files: [{
          id: 'F123',
          name: 'photo.jpg',
          mimetype: 'image/jpeg',
          url_private: 'https://files.slack.com/files/photo.jpg',
        }],
      };

      await appMentionHandler({ event, say: mockSay });

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('F123'),
        expect.any(Buffer)
      );
    });

    it('should create images directory if not exists', async () => {
      vi.mocked(existsSync).mockReturnValueOnce(false);

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Created!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> save',
        ts: '1234567890.123456',
        channel: 'C789',
        files: [{
          id: 'F123',
          name: 'test.jpg',
          mimetype: 'image/jpeg',
          url_private: 'https://files.slack.com/files/test.jpg',
        }],
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.marketclaw'),
        { recursive: true }
      );
    });

    it('should handle download failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const mockHandler = vi.fn().mockResolvedValue({ text: 'No image' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> check this',
        ts: '1234567890.123456',
        channel: 'C789',
        files: [{
          id: 'F123',
          name: 'test.jpg',
          mimetype: 'image/jpeg',
          url_private: 'https://files.slack.com/files/test.jpg',
        }],
      };

      await appMentionHandler({ event, say: mockSay });

      // Should still process message, just without image
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: undefined, // No images due to download failure
        })
      );
    });

    it('should skip non-image files', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Text only' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> check this file',
        ts: '1234567890.123456',
        channel: 'C789',
        files: [{
          id: 'F123',
          name: 'document.pdf',
          mimetype: 'application/pdf',
          url_private: 'https://files.slack.com/files/document.pdf',
        }],
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use url_private as fallback when url_private_download missing', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Got it!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> check',
        ts: '1234567890.123456',
        channel: 'C789',
        files: [{
          id: 'F123',
          name: 'test.jpg',
          mimetype: 'image/jpeg',
          url_private: 'https://files.slack.com/files/test.jpg',
          // No url_private_download
        }],
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://files.slack.com/files/test.jpg',
        expect.any(Object)
      );
    });

    it('should use env token for download when config token empty', async () => {
      const originalBotToken = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = 'xoxb-env-token-for-download';

      try {
        // Clear previous mock calls and create fresh channel
        vi.clearAllMocks();
        mockApp.event.mockClear();
        
        // Create channel with env-only config
        const envChannel = new SlackChannel();
        const config: SlackConfig = {
          enabled: true,
          botToken: '', // Empty - should use env var
          appToken: 'xapp-test-app-token',
        };
        await envChannel.initialize(config);

        // Get the LATEST app_mention handler (from envChannel)
        const app = getMockApp();
        const calls = app.event.mock.calls.filter((c: any) => c[0] === 'app_mention');
        const handler = calls[calls.length - 1][1]; // Get the last one

        const mockHandler = vi.fn().mockResolvedValue({ text: 'Got it!' });
        vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

        const mockSay = vi.fn().mockResolvedValue({});
        const event = {
          user: 'U123',
          text: '<@B456> check',
          ts: '1234567890.123456',
          channel: 'C789',
          files: [{
            id: 'F123',
            name: 'test.jpg',
            mimetype: 'image/jpeg',
            url_private: 'https://files.slack.com/files/test.jpg',
          }],
        };

        await handler({ event, say: mockSay });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          {
            headers: {
              'Authorization': 'Bearer xoxb-env-token-for-download',
            },
          }
        );
      } finally {
        if (originalBotToken) {
          process.env.SLACK_BOT_TOKEN = originalBotToken;
        } else {
          delete process.env.SLACK_BOT_TOKEN;
        }
      }
    });
  });

  describe('message text handling', () => {
    let appMentionHandler: Function;

    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };
      await channel.initialize(config);

      const app = getMockApp();
      const call = app.event.mock.calls.find((c: any) => c[0] === 'app_mention');
      appMentionHandler = call[1];
    });

    it('should remove bot mention from text', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@BOTID123> please analyze this',
        ts: '1234567890.123456',
        channel: 'C789',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'please analyze this',
        })
      );
    });

    it('should handle multiple mentions in text', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@BOTID123> hello <@USERID456> how are you',
        ts: '1234567890.123456',
        channel: 'C789',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'hello  how are you',
        })
      );
    });

    it('should ignore empty text without files', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@BOTID123>', // Just the mention, no actual text
        ts: '1234567890.123456',
        channel: 'C789',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should process image-only messages', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Got image!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@BOTID123>', // Just mention
        ts: '1234567890.123456',
        channel: 'C789',
        files: [{
          id: 'F123',
          name: 'photo.jpg',
          mimetype: 'image/jpeg',
          url_private: 'https://files.slack.com/files/photo.jpg',
        }],
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: '[Image attached]',
        })
      );
    });
  });

  describe('channel lifecycle', () => {
    it('should support full lifecycle: init -> start -> send -> stop', async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };

      // Initialize
      await channel.initialize(config);
      expect(App).toHaveBeenCalled();

      // Start
      await channel.start();
      const app = getMockApp();
      expect(app.start).toHaveBeenCalled();

      // Send
      await channel.send('U123', { text: 'Hello' });
      const client = getMockClient();
      expect(client.chat.postMessage).toHaveBeenCalled();

      // Stop
      await channel.stop();
      expect(app.stop).toHaveBeenCalled();
    });
  });

  describe('timestamp parsing', () => {
    let appMentionHandler: Function;

    beforeEach(async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };
      await channel.initialize(config);

      const app = getMockApp();
      const call = app.event.mock.calls.find((c: any) => c[0] === 'app_mention');
      appMentionHandler = call[1];
    });

    it('should parse Slack timestamp to Date object', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const mockSay = vi.fn().mockResolvedValue({});
      const event = {
        user: 'U123',
        text: '<@B456> test',
        ts: '1609459200.123456', // 2021-01-01 00:00:00 UTC
        channel: 'C789',
      };

      await appMentionHandler({ event, say: mockSay });

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );

      const calledMessage = mockHandler.mock.calls[0][1];
      expect(calledMessage.timestamp.getTime()).toBe(1609459200123);
    });
  });

  describe('error handling', () => {
    it('should handle errors during initialize', async () => {
      // Mock App constructor to throw
      vi.mocked(App).mockImplementationOnce(() => {
        throw new Error('App creation failed');
      });

      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };

      await expect(channel.initialize(config)).rejects.toThrow('App creation failed');
    });

    it('should handle errors during start', async () => {
      const config: SlackConfig = {
        enabled: true,
        botToken: 'xoxb-test-bot-token',
        appToken: 'xapp-test-app-token',
      };

      await channel.initialize(config);

      mockApp.start.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(channel.start()).rejects.toThrow('Connection failed');
    });
  });
});

describe('SlackChannel module exports', () => {
  it('should export slackChannel instance', async () => {
    const mod = await import('./slack.js');

    expect(mod.slackChannel).toBeDefined();
    expect(mod.slackChannel).toBeInstanceOf(SlackChannel);
  });

  it('should export SlackChannel class', async () => {
    const mod = await import('./slack.js');

    expect(mod.SlackChannel).toBeDefined();
    expect(new mod.SlackChannel()).toBeInstanceOf(SlackChannel);
  });
});
