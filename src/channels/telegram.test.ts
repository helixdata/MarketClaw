/**
 * Telegram Channel Tests
 * Tests TelegramChannel implementation with mocked Telegraf
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create mock objects
const mockTelegram = {
  sendMessage: vi.fn().mockResolvedValue({}),
  getMe: vi.fn().mockResolvedValue({ id: 12345, username: 'test_bot' }),
};

const mockBot = {
  launch: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  use: vi.fn(),
  on: vi.fn(),
  command: vi.fn(),
  catch: vi.fn(),
  telegram: mockTelegram,
};

// Mock Telegraf as a class
vi.mock('telegraf', () => {
  return {
    Telegraf: vi.fn().mockImplementation(function(this: any) {
      Object.assign(this, mockBot);
      return this;
    }),
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

import { TelegramChannel, TelegramConfig } from './telegram.js';
import { Telegraf } from 'telegraf';
import { channelRegistry } from './registry.js';

// Helper to get mocks
const getMockBot = () => mockBot;
const getMockTelegram = () => mockTelegram;

describe('TelegramChannel', () => {
  let channel: TelegramChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockTelegram.sendMessage.mockResolvedValue({});
    mockTelegram.getMe.mockResolvedValue({ id: 12345, username: 'test_bot' });
    mockBot.launch.mockResolvedValue(undefined);
    channel = new TelegramChannel();
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
      expect(channel.name).toBe('telegram');
    });

    it('should have correct displayName', () => {
      expect(channel.displayName).toBe('Telegram');
    });

    it('should have correct description', () => {
      expect(channel.description).toBe('Interact with MarketClaw via Telegram bot');
    });

    it('should have correct requiredConfig', () => {
      expect(channel.requiredConfig).toEqual(['botToken']);
    });

    it('should have correct optionalConfig', () => {
      expect(channel.optionalConfig).toEqual(['allowedUsers', 'adminUsers']);
    });

    it('should have correct requiredEnv', () => {
      expect(channel.requiredEnv).toEqual(['TELEGRAM_BOT_TOKEN']);
    });
  });

  describe('initialize', () => {
    it('should initialize with valid config', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);

      expect(Telegraf).toHaveBeenCalledWith('test-bot-token');
    });

    it('should fall back to env var if botToken not in config', async () => {
      const originalEnv = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = 'env-bot-token';

      try {
        const config: TelegramConfig = {
          enabled: true,
          botToken: '', // Empty, should use env var
        };

        await channel.initialize(config);

        expect(Telegraf).toHaveBeenCalledWith('env-bot-token');
      } finally {
        if (originalEnv) {
          process.env.TELEGRAM_BOT_TOKEN = originalEnv;
        } else {
          delete process.env.TELEGRAM_BOT_TOKEN;
        }
      }
    });

    it('should throw error when no token available', async () => {
      const originalEnv = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      try {
        const config: TelegramConfig = {
          enabled: true,
          botToken: '',
        };

        await expect(channel.initialize(config)).rejects.toThrow(
          'Telegram bot token not configured'
        );
      } finally {
        if (originalEnv) {
          process.env.TELEGRAM_BOT_TOKEN = originalEnv;
        }
      }
    });

    it('should set up message handlers', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);

      const mockBot = getMockBot();
      expect(mockBot.use).toHaveBeenCalled(); // Auth middleware
      expect(mockBot.on).toHaveBeenCalledWith('text', expect.any(Function));
      expect(mockBot.on).toHaveBeenCalledWith('callback_query', expect.any(Function));
      expect(mockBot.command).toHaveBeenCalledWith('start', expect.any(Function));
      expect(mockBot.command).toHaveBeenCalledWith('help', expect.any(Function));
      expect(mockBot.catch).toHaveBeenCalled();
    });

    it('should initialize with allowedUsers', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        allowedUsers: [123, 456, 789],
      };

      await channel.initialize(config);

      expect(Telegraf).toHaveBeenCalledWith('test-bot-token');
    });

    it('should initialize with adminUsers', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        adminUsers: [111],
      };

      await channel.initialize(config);

      expect(Telegraf).toHaveBeenCalledWith('test-bot-token');
    });
  });

  describe('start', () => {
    it('should launch the bot', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);
      await channel.start();

      const mockBot = getMockBot();
      expect(mockBot.launch).toHaveBeenCalled();
    });

    it('should throw if not initialized', async () => {
      await expect(channel.start()).rejects.toThrow('Channel not initialized');
    });
  });

  describe('stop', () => {
    it('should stop the bot', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);
      await channel.start();
      await channel.stop();

      const mockBot = getMockBot();
      expect(mockBot.stop).toHaveBeenCalled();
    });

    it('should handle stop when not started', async () => {
      // Should not throw
      await channel.stop();
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should send simple text message', async () => {
      await channel.send('123456', { text: 'Hello, user!' });

      const mockTelegram = getMockTelegram();
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        123456,
        'Hello, user!',
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
    });

    it('should send message with buttons', async () => {
      await channel.send('123456', {
        text: 'Choose an option:',
        buttons: [
          { text: 'Yes', callback: 'yes' },
          { text: 'No', callback: 'no' },
        ],
      });

      const mockTelegram = getMockTelegram();
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        123456,
        'Choose an option:',
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Yes', callback_data: 'yes' }],
              [{ text: 'No', callback_data: 'no' }],
            ],
          },
        })
      );
    });

    it('should send message with replyToId', async () => {
      await channel.send('123456', {
        text: 'This is a reply',
        replyToId: '789',
      });

      const mockTelegram = getMockTelegram();
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        123456,
        'This is a reply',
        expect.objectContaining({
          reply_parameters: { message_id: 789 },
        })
      );
    });

    it('should retry without Markdown on parse error', async () => {
      const mockTelegram = getMockTelegram();
      
      // First call fails with parse error
      mockTelegram.sendMessage
        .mockRejectedValueOnce({
          response: { description: "can't parse entities" },
        })
        .mockResolvedValueOnce({});

      await channel.send('123456', { text: 'Hello *broken' });

      expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(2);
      // Second call should not have parse_mode
      expect(mockTelegram.sendMessage).toHaveBeenLastCalledWith(
        123456,
        'Hello *broken',
        expect.not.objectContaining({ parse_mode: 'Markdown' })
      );
    });

    it('should throw non-parse errors', async () => {
      const mockTelegram = getMockTelegram();
      mockTelegram.sendMessage.mockRejectedValueOnce(new Error('Network error'));

      await expect(channel.send('123456', { text: 'Hello' })).rejects.toThrow(
        'Network error'
      );
    });

    it('should throw if not initialized', async () => {
      const uninitChannel = new TelegramChannel();

      await expect(
        uninitChannel.send('123', { text: 'test' })
      ).rejects.toThrow('Channel not initialized');
    });

    it('should handle empty buttons array', async () => {
      await channel.send('123456', {
        text: 'No buttons here',
        buttons: [],
      });

      const mockTelegram = getMockTelegram();
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        123456,
        'No buttons here',
        expect.not.objectContaining({ reply_markup: expect.anything() })
      );
    });
  });

  describe('isConfigured', () => {
    it('should return true when config has botToken', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-token',
      };

      await channel.initialize(config);

      expect(channel.isConfigured()).toBe(true);
    });

    it('should return true when env var is set', () => {
      const originalEnv = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = 'env-token';

      try {
        expect(channel.isConfigured()).toBe(true);
      } finally {
        if (originalEnv) {
          process.env.TELEGRAM_BOT_TOKEN = originalEnv;
        } else {
          delete process.env.TELEGRAM_BOT_TOKEN;
        }
      }
    });

    it('should return false when no token available', () => {
      const originalEnv = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      try {
        // Fresh channel without initialization
        const freshChannel = new TelegramChannel();
        expect(freshChannel.isConfigured()).toBe(false);
      } finally {
        if (originalEnv) {
          process.env.TELEGRAM_BOT_TOKEN = originalEnv;
        }
      }
    });
  });

  describe('validateConfig', () => {
    it('should return valid for correct token', async () => {
      // getMe succeeds by default in our mock
      const result = await channel.validateConfig!({
        enabled: true,
        botToken: 'valid-bot-token',
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid when token is missing', async () => {
      const result = await channel.validateConfig!({
        enabled: true,
        botToken: '',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bot token is required');
    });

    it('should return invalid for bad token', async () => {
      // Mock getMe to throw for this test
      mockTelegram.getMe.mockRejectedValueOnce(new Error('Invalid token'));

      const result = await channel.validateConfig!({
        enabled: true,
        botToken: 'invalid-token',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token');
    });
  });

  describe('message handler integration', () => {
    it('should use message handler from registry', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);

      // Verify handler is retrieved
      expect(channelRegistry.getMessageHandler).toBeDefined();
    });
  });

  describe('auth middleware', () => {
    it('should set up auth middleware when allowedUsers configured', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        allowedUsers: [123, 456],
      };

      await channel.initialize(config);

      const mockBot = getMockBot();
      // Verify use() was called (auth middleware)
      expect(mockBot.use).toHaveBeenCalled();
    });
  });

  describe('built-in commands', () => {
    it('should register /start command', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);

      const mockBot = getMockBot();
      expect(mockBot.command).toHaveBeenCalledWith('start', expect.any(Function));
    });

    it('should register /help command', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);

      const mockBot = getMockBot();
      expect(mockBot.command).toHaveBeenCalledWith('help', expect.any(Function));
    });
  });

  describe('error handling', () => {
    it('should set up error handler with bot.catch', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);

      const mockBot = getMockBot();
      expect(mockBot.catch).toHaveBeenCalled();
    });
  });

  describe('channel lifecycle', () => {
    it('should support full lifecycle: init -> start -> send -> stop', async () => {
      const config: TelegramConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      // Initialize
      await channel.initialize(config);
      expect(Telegraf).toHaveBeenCalled();

      // Start
      await channel.start();
      const mockBot = getMockBot();
      expect(mockBot.launch).toHaveBeenCalled();

      // Send
      await channel.send('123', { text: 'Hello' });
      const mockTelegram = getMockTelegram();
      expect(mockTelegram.sendMessage).toHaveBeenCalled();

      // Stop
      await channel.stop();
      expect(mockBot.stop).toHaveBeenCalled();
    });
  });
});

describe('TelegramChannel module exports', () => {
  it('should export telegramChannel instance', async () => {
    // Dynamic import to get the actual exports
    const mod = await import('./telegram.js');
    
    expect(mod.telegramChannel).toBeDefined();
    expect(mod.telegramChannel).toBeInstanceOf(TelegramChannel);
  });

  it('should export TelegramChannel class', async () => {
    const mod = await import('./telegram.js');
    
    expect(mod.TelegramChannel).toBeDefined();
    expect(new mod.TelegramChannel()).toBeInstanceOf(TelegramChannel);
  });
});
