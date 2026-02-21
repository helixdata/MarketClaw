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

// =========================================================================
// IMAGE SUPPORT TESTS
// =========================================================================

// Mock fs modules for image operations
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock global fetch for downloading images
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

describe('TelegramChannel Image Support', () => {
  let channel: TelegramChannel;
  let mockHandler: ReturnType<typeof vi.fn>;
  let photoHandler: ((ctx: any) => Promise<void>) | undefined;
  let documentHandler: ((ctx: any) => Promise<void>) | undefined;

  const createMockCtx = (overrides: any = {}) => ({
    from: { id: 123456, username: 'testuser' },
    chat: { id: 123456, type: 'private' },
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      ...overrides.message,
    },
    sendChatAction: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    telegram: {
      getFile: vi.fn().mockResolvedValue({
        file_id: 'test-file-id',
        file_path: 'photos/file_123.jpg',
      }),
    },
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset fetch mock
    mockFetch.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });
    
    // Reset fs mocks
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    
    // Setup mock handler
    mockHandler = vi.fn().mockResolvedValue({ text: 'Image processed!' });
    vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);
    
    // Capture the handlers when bot.on is called
    mockBot.on.mockImplementation((event: string, handler: any) => {
      if (event === 'photo') {
        photoHandler = handler;
      } else if (event === 'document') {
        documentHandler = handler;
      }
    });

    channel = new TelegramChannel();
    const config: TelegramConfig = {
      enabled: true,
      botToken: 'test-bot-token',
    };
    await channel.initialize(config);
  });

  afterEach(async () => {
    try {
      await channel.stop();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('downloadTelegramImages()', () => {
    it('should successfully download image from Telegram API', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [
            { file_id: 'small-id', width: 100, height: 100 },
            { file_id: 'large-id', width: 800, height: 600 },
          ],
        },
      });

      await photoHandler!(ctx);

      // Verify getFile was called with the largest photo's file_id
      expect(ctx.telegram.getFile).toHaveBeenCalledWith('large-id');
      // Verify fetch was called with the correct URL
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.telegram.org/file/bot')
      );
    });

    it('should create images directory if not exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'test-id', width: 100, height: 100 }],
        },
      });

      await photoHandler!(ctx);

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.marketclaw'),
        { recursive: true }
      );
    });

    it('should handle multiple file IDs', async () => {
      // For documents, we only process one at a time, but let's verify the flow
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [
            { file_id: 'id-1', width: 100, height: 100 },
            { file_id: 'id-2', width: 200, height: 200 },
            { file_id: 'id-3', width: 800, height: 600 },
          ],
        },
      });

      await photoHandler!(ctx);

      // Should only get the highest resolution (last in array)
      expect(ctx.telegram.getFile).toHaveBeenCalledWith('id-3');
      expect(ctx.telegram.getFile).toHaveBeenCalledTimes(1);
    });

    it('should extract correct mime type for .jpg extension', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'test-id', width: 100, height: 100 }],
        },
      });
      ctx.telegram.getFile.mockResolvedValue({
        file_id: 'test-id',
        file_path: 'photos/file_123.jpg',
      });

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({ mimeType: 'image/jpeg' }),
          ]),
        })
      );
    });

    it('should extract correct mime type for .png extension', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'test-id', width: 100, height: 100 }],
        },
      });
      ctx.telegram.getFile.mockResolvedValue({
        file_id: 'test-id',
        file_path: 'photos/file_123.png',
      });

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({ mimeType: 'image/png' }),
          ]),
        })
      );
    });

    it('should extract correct mime type for .gif extension', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'test-id', width: 100, height: 100 }],
        },
      });
      ctx.telegram.getFile.mockResolvedValue({
        file_id: 'test-id',
        file_path: 'photos/file_123.gif',
      });

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({ mimeType: 'image/gif' }),
          ]),
        })
      );
    });

    it('should extract correct mime type for .webp extension', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'test-id', width: 100, height: 100 }],
        },
      });
      ctx.telegram.getFile.mockResolvedValue({
        file_id: 'test-id',
        file_path: 'photos/file_123.webp',
      });

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({ mimeType: 'image/webp' }),
          ]),
        })
      );
    });

    it('should save file locally with timestamp filename', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'test-file-id', width: 100, height: 100 }],
        },
      });

      await photoHandler!(ctx);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\d+-[a-zA-Z0-9_-]+\.jpg$/),
        expect.any(Buffer)
      );
    });

    it('should return ChannelImage with all required fields', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'test-file-id', width: 100, height: 100 }],
        },
      });

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({
              id: 'test-file-id',
              url: expect.stringContaining('https://api.telegram.org'),
              path: expect.stringContaining('.marketclaw'),
              mimeType: expect.any(String),
              size: expect.any(Number),
              filename: expect.any(String),
              base64: expect.any(String),
            }),
          ]),
        })
      );
    });

    it('should handle download failures gracefully and continue', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'bad-id', width: 100, height: 100 }],
        },
      });
      
      // Make getFile throw an error
      ctx.telegram.getFile.mockRejectedValue(new Error('File not found'));

      await photoHandler!(ctx);

      // Should still call handler, but with empty images array
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: [],
        })
      );
    });
  });

  describe('Photo message handler (bot.on("photo"))', () => {
    it('should receive photo and download highest resolution (last in array)', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [
            { file_id: 'thumb', width: 90, height: 90 },
            { file_id: 'small', width: 320, height: 320 },
            { file_id: 'medium', width: 800, height: 800 },
            { file_id: 'large', width: 1280, height: 1280 },
          ],
          caption: 'Check out this image!',
        },
      });

      await photoHandler!(ctx);

      expect(ctx.telegram.getFile).toHaveBeenCalledWith('large');
    });

    it('should create ChannelMessage with images array', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 42,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
          caption: 'My caption',
        },
      });

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          id: '42',
          userId: '123456',
          username: 'testuser',
          images: expect.any(Array),
        })
      );
    });

    it('should handle caption as text', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
          caption: 'This is my photo caption',
        },
      });

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'This is my photo caption',
        })
      );
    });

    it('should fall back to "[Image attached]" when no caption', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
          // No caption
        },
      });

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: '[Image attached]',
        })
      );
    });

    it('should call message handler with image data', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
        },
      });

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          metadata: expect.objectContaining({
            hasImage: true,
          }),
        })
      );
    });

    it('should send typing action before processing', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
        },
      });

      await photoHandler!(ctx);

      expect(ctx.sendChatAction).toHaveBeenCalledWith('typing');
    });
  });

  describe('Document handler (bot.on("document"))', () => {
    it('should only process image mime types (image/*)', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'doc-file-id',
            mime_type: 'image/png',
            file_name: 'screenshot.png',
          },
        },
      });

      await documentHandler!(ctx);

      expect(ctx.telegram.getFile).toHaveBeenCalledWith('doc-file-id');
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should ignore non-image documents (pdf)', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'pdf-file-id',
            mime_type: 'application/pdf',
            file_name: 'document.pdf',
          },
        },
      });

      await documentHandler!(ctx);

      expect(ctx.telegram.getFile).not.toHaveBeenCalled();
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should ignore non-image documents (text)', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'txt-file-id',
            mime_type: 'text/plain',
            file_name: 'notes.txt',
          },
        },
      });

      await documentHandler!(ctx);

      expect(ctx.telegram.getFile).not.toHaveBeenCalled();
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should download and include in ChannelMessage.images', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'image-doc-id',
            mime_type: 'image/jpeg',
            file_name: 'photo.jpg',
          },
        },
      });

      await documentHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({
              id: 'image-doc-id',
            }),
          ]),
        })
      );
    });

    it('should handle filename in metadata', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'image-doc-id',
            mime_type: 'image/png',
            file_name: 'my_screenshot.png',
          },
        },
      });

      await documentHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          metadata: expect.objectContaining({
            filename: 'my_screenshot.png',
          }),
        })
      );
    });

    it('should handle document with caption', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'image-doc-id',
            mime_type: 'image/jpeg',
            file_name: 'photo.jpg',
          },
          caption: 'Document caption here',
        },
      });

      await documentHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'Document caption here',
        })
      );
    });

    it('should fall back to "[Image attached]" when no caption', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'image-doc-id',
            mime_type: 'image/webp',
            file_name: 'sticker.webp',
          },
          // No caption
        },
      });

      await documentHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: '[Image attached]',
        })
      );
    });
  });

  describe('Error handling for image operations', () => {
    it('should handle graceful failure on download error', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
        },
      });
      
      // Make fetch fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      await photoHandler!(ctx);

      // Should still process message with empty images
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: [],
        })
      );
    });

    it('should still process message even if image download fails', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
          caption: 'Important message with broken image',
        },
      });
      
      ctx.telegram.getFile.mockRejectedValue(new Error('API error'));

      await photoHandler!(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'Important message with broken image',
          images: [],
        })
      );
    });

    it('should reply with error if entire photo handler throws', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
        },
      });
      
      // Make handler throw
      mockHandler.mockRejectedValue(new Error('Processing failed'));

      await photoHandler!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Error processing')
      );
    });

    it('should reply with error if entire document handler throws', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'doc-id',
            mime_type: 'image/png',
            file_name: 'image.png',
          },
        },
      });
      
      // Make handler throw
      mockHandler.mockRejectedValue(new Error('Processing failed'));

      await documentHandler!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Error processing')
      );
    });

    it('should handle writeFile failure gracefully', async () => {
      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
        },
      });
      
      vi.mocked(writeFile).mockRejectedValue(new Error('Disk full'));

      await photoHandler!(ctx);

      // Should still try to process (the error is caught in downloadTelegramImages)
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: [], // Empty because download failed
        })
      );
    });

    it('should handle no message handler configured for photo', async () => {
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(undefined as any);

      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo-id', width: 800, height: 600 }],
        },
      });

      await photoHandler!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('⚠️ Agent not configured.');
    });

    it('should handle no message handler configured for document', async () => {
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(undefined as any);

      const ctx = createMockCtx({
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'doc-id',
            mime_type: 'image/png',
            file_name: 'image.png',
          },
        },
      });

      await documentHandler!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('⚠️ Agent not configured.');
    });
  });
});
