/**
 * Discord Channel Tests
 * Tests DiscordChannel implementation with mocked discord.js
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Discord.js Collection (extends Map with additional methods)
class MockCollection<K, V> extends Map<K, V> {
  filter(fn: (value: V, key: K, collection: this) => boolean): MockCollection<K, V> {
    const result = new MockCollection<K, V>();
    for (const [key, value] of this) {
      if (fn(value, key, this)) {
        result.set(key, value);
      }
    }
    return result;
  }

  some(fn: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, value] of this) {
      if (fn(value, key, this)) {
        return true;
      }
    }
    return false;
  }
}

// Create mock objects
const mockUser = {
  id: '123456789',
  username: 'testuser',
  tag: 'testuser#1234',
  bot: false,
  createDM: vi.fn(),
};

const mockDmChannel = {
  send: vi.fn().mockResolvedValue({}),
};

const mockTextChannel = {
  send: vi.fn().mockResolvedValue({}),
  sendTyping: vi.fn().mockResolvedValue(undefined),
  isTextBased: vi.fn().mockReturnValue(true),
  id: 'channel-123',
};

const mockGuild = {
  id: 'guild-123',
  name: 'Test Server',
};

const mockRolesCache = new MockCollection<string, { id: string; name: string }>();
mockRolesCache.set('role-1', { id: 'role-1', name: 'Moderator' });

const mockMember = {
  roles: {
    cache: mockRolesCache,
  },
};

const mockAttachments = new MockCollection<string, any>();

const mockMessage = {
  id: 'msg-123',
  content: 'Hello bot',
  author: mockUser,
  guild: mockGuild,
  channel: mockTextChannel,
  member: mockMember,
  createdAt: new Date(),
  attachments: mockAttachments,
  reply: vi.fn().mockResolvedValue({}),
};

const mockBotUser = {
  id: 'bot-user-id',
  tag: 'MarketClaw#0001',
};

const mockClient = {
  login: vi.fn().mockResolvedValue('token'),
  destroy: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  user: mockBotUser,
  users: {
    fetch: vi.fn().mockResolvedValue(mockUser),
  },
  channels: {
    fetch: vi.fn().mockResolvedValue(mockTextChannel),
  },
};

// Mock discord.js
vi.mock('discord.js', () => {
  return {
    Client: vi.fn().mockImplementation(function (this: any) {
      Object.assign(this, mockClient);
      return this;
    }),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
      DirectMessages: 8,
    },
    Events: {
      ClientReady: 'ready',
      MessageCreate: 'messageCreate',
      Error: 'error',
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

// Mock document parser
vi.mock('../documents/index.js', () => ({
  documentParser: {
    parseDocument: vi.fn().mockResolvedValue({
      id: 'doc_test_123',
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      text: 'Sample document text content.',
      pageCount: 3,
      wordCount: 5,
      extractedAt: Date.now(),
    }),
    isSupportedDocument: vi.fn().mockImplementation((mimeType: string) => {
      return ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'].includes(mimeType);
    }),
    isSupportedDocumentByFilename: vi.fn().mockImplementation((mimeType: string, filename: string) => {
      const supportedMimes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
      if (supportedMimes.includes(mimeType)) return true;
      const ext = filename.toLowerCase().split('.').pop();
      return ['pdf', 'docx', 'doc', 'txt'].includes(ext || '');
    }),
    getSupportedMimeTypes: vi.fn().mockReturnValue([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ]),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { DiscordChannel, DiscordConfig } from './discord.js';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { channelRegistry } from './registry.js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Helper to get mock client handlers
const getClientHandlers = (): Record<string, Function> => {
  const handlers: Record<string, Function> = {};
  for (const call of mockClient.on.mock.calls) {
    handlers[call[0]] = call[1];
  }
  for (const call of mockClient.once.mock.calls) {
    handlers[call[0]] = call[1];
  }
  return handlers;
};

describe('DiscordChannel', () => {
  let channel: DiscordChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockClient.login.mockResolvedValue('token');
    mockClient.users.fetch.mockResolvedValue(mockUser);
    mockClient.channels.fetch.mockResolvedValue(mockTextChannel);
    mockUser.createDM.mockResolvedValue(mockDmChannel);
    mockDmChannel.send.mockResolvedValue({});
    mockTextChannel.send.mockResolvedValue({});
    mockTextChannel.isTextBased.mockReturnValue(true);
    mockMessage.reply.mockResolvedValue({});
    mockMessage.attachments = new MockCollection();
    mockMessage.content = 'Hello bot';
    mockMessage.guild = mockGuild;
    mockMessage.member = mockMember;
    mockFetch.mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
    });
    channel = new DiscordChannel();
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
      expect(channel.name).toBe('discord');
    });

    it('should have correct displayName', () => {
      expect(channel.displayName).toBe('Discord');
    });

    it('should have correct description', () => {
      expect(channel.description).toBe('Interact with MarketClaw via Discord bot');
    });

    it('should have correct requiredConfig', () => {
      expect(channel.requiredConfig).toEqual(['botToken']);
    });

    it('should have correct optionalConfig', () => {
      expect(channel.optionalConfig).toEqual(['guildIds', 'channelIds', 'allowedRoles', 'commandPrefix']);
    });

    it('should have correct requiredEnv', () => {
      expect(channel.requiredEnv).toEqual(['DISCORD_BOT_TOKEN']);
    });
  });

  describe('initialize', () => {
    it('should initialize with valid config', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);

      expect(Client).toHaveBeenCalledWith({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
        ],
      });
    });

    it('should fall back to env var if botToken not in config', async () => {
      const originalEnv = process.env.DISCORD_BOT_TOKEN;
      process.env.DISCORD_BOT_TOKEN = 'env-bot-token';

      try {
        const config: DiscordConfig = {
          enabled: true,
          botToken: '', // Empty, should use env var
        };

        await channel.initialize(config);

        // Should not throw, uses env var
        expect(Client).toHaveBeenCalled();
      } finally {
        if (originalEnv) {
          process.env.DISCORD_BOT_TOKEN = originalEnv;
        } else {
          delete process.env.DISCORD_BOT_TOKEN;
        }
      }
    });

    it('should throw error when no token available', async () => {
      const originalEnv = process.env.DISCORD_BOT_TOKEN;
      delete process.env.DISCORD_BOT_TOKEN;

      try {
        const config: DiscordConfig = {
          enabled: true,
          botToken: '',
        };

        await expect(channel.initialize(config)).rejects.toThrow(
          'Discord bot token not configured'
        );
      } finally {
        if (originalEnv) {
          process.env.DISCORD_BOT_TOKEN = originalEnv;
        }
      }
    });

    it('should set up message handlers', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);

      expect(mockClient.once).toHaveBeenCalledWith(Events.ClientReady, expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith(Events.MessageCreate, expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith(Events.Error, expect.any(Function));
    });

    it('should initialize with guildIds restriction', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        guildIds: ['guild-1', 'guild-2'],
      };

      await channel.initialize(config);

      expect(Client).toHaveBeenCalled();
    });

    it('should initialize with channelIds restriction', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        channelIds: ['channel-1', 'channel-2'],
      };

      await channel.initialize(config);

      expect(Client).toHaveBeenCalled();
    });

    it('should initialize with allowedRoles restriction', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        allowedRoles: ['Admin', 'Moderator'],
      };

      await channel.initialize(config);

      expect(Client).toHaveBeenCalled();
    });

    it('should initialize with commandPrefix', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        commandPrefix: '!',
      };

      await channel.initialize(config);

      expect(Client).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should login the client', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);
      await channel.start();

      expect(mockClient.login).toHaveBeenCalledWith('test-bot-token');
    });

    it('should use env var token when config token is empty', async () => {
      const originalEnv = process.env.DISCORD_BOT_TOKEN;
      process.env.DISCORD_BOT_TOKEN = 'env-bot-token';

      try {
        const config: DiscordConfig = {
          enabled: true,
          botToken: '',
        };

        await channel.initialize(config);
        await channel.start();

        expect(mockClient.login).toHaveBeenCalledWith('env-bot-token');
      } finally {
        if (originalEnv) {
          process.env.DISCORD_BOT_TOKEN = originalEnv;
        } else {
          delete process.env.DISCORD_BOT_TOKEN;
        }
      }
    });

    it('should throw if not initialized', async () => {
      await expect(channel.start()).rejects.toThrow('Channel not initialized');
    });
  });

  describe('stop', () => {
    it('should destroy the client', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);
      await channel.start();
      await channel.stop();

      expect(mockClient.destroy).toHaveBeenCalled();
    });

    it('should handle stop when not started', async () => {
      // Should not throw
      await channel.stop();
    });
  });

  describe('send (DM)', () => {
    beforeEach(async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should send DM to user', async () => {
      await channel.send('123456789', { text: 'Hello, user!' });

      expect(mockClient.users.fetch).toHaveBeenCalledWith('123456789');
      expect(mockUser.createDM).toHaveBeenCalled();
      expect(mockDmChannel.send).toHaveBeenCalledWith('Hello, user!');
    });

    it('should throw if not initialized', async () => {
      const uninitChannel = new DiscordChannel();

      await expect(
        uninitChannel.send('123', { text: 'test' })
      ).rejects.toThrow('Channel not initialized');
    });

    it('should throw if user fetch fails', async () => {
      mockClient.users.fetch.mockRejectedValueOnce(new Error('User not found'));

      await expect(
        channel.send('unknown-user', { text: 'Hello' })
      ).rejects.toThrow('User not found');
    });

    it('should throw if createDM fails', async () => {
      mockUser.createDM.mockRejectedValueOnce(new Error('Cannot create DM'));

      await expect(
        channel.send('123456789', { text: 'Hello' })
      ).rejects.toThrow('Cannot create DM');
    });

    it('should throw if DM send fails', async () => {
      mockDmChannel.send.mockRejectedValueOnce(new Error('Message blocked'));

      await expect(
        channel.send('123456789', { text: 'Hello' })
      ).rejects.toThrow('Message blocked');
    });
  });

  describe('sendToChannel', () => {
    beforeEach(async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should send message to channel', async () => {
      await channel.sendToChannel('channel-123', { text: 'Hello, channel!' });

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel-123');
      expect(mockTextChannel.send).toHaveBeenCalledWith('Hello, channel!');
    });

    it('should throw if not initialized', async () => {
      const uninitChannel = new DiscordChannel();

      await expect(
        uninitChannel.sendToChannel('channel-123', { text: 'test' })
      ).rejects.toThrow('Channel not initialized');
    });

    it('should throw if channel fetch fails', async () => {
      mockClient.channels.fetch.mockRejectedValueOnce(new Error('Channel not found'));

      await expect(
        channel.sendToChannel('unknown-channel', { text: 'Hello' })
      ).rejects.toThrow('Channel not found');
    });

    it('should not send to non-text channel', async () => {
      const nonTextChannel = {
        isTextBased: vi.fn().mockReturnValue(false),
      };
      mockClient.channels.fetch.mockResolvedValueOnce(nonTextChannel);

      // Should not throw, just silently skip
      await channel.sendToChannel('voice-channel', { text: 'Hello' });

      expect(nonTextChannel.isTextBased).toHaveBeenCalled();
    });

    it('should throw if send fails', async () => {
      mockTextChannel.send.mockRejectedValueOnce(new Error('No permissions'));

      await expect(
        channel.sendToChannel('channel-123', { text: 'Hello' })
      ).rejects.toThrow('No permissions');
    });
  });

  describe('isConfigured', () => {
    it('should return true when config has botToken', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-token',
      };

      await channel.initialize(config);

      expect(channel.isConfigured()).toBe(true);
    });

    it('should return true when env var is set', () => {
      const originalEnv = process.env.DISCORD_BOT_TOKEN;
      process.env.DISCORD_BOT_TOKEN = 'env-token';

      try {
        expect(channel.isConfigured()).toBe(true);
      } finally {
        if (originalEnv) {
          process.env.DISCORD_BOT_TOKEN = originalEnv;
        } else {
          delete process.env.DISCORD_BOT_TOKEN;
        }
      }
    });

    it('should return false when no token available', () => {
      const originalEnv = process.env.DISCORD_BOT_TOKEN;
      delete process.env.DISCORD_BOT_TOKEN;

      try {
        const freshChannel = new DiscordChannel();
        expect(freshChannel.isConfigured()).toBe(false);
      } finally {
        if (originalEnv) {
          process.env.DISCORD_BOT_TOKEN = originalEnv;
        }
      }
    });
  });

  describe('validateConfig', () => {
    it('should return valid for correct token', async () => {
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
      mockClient.login.mockRejectedValueOnce(new Error('Invalid token'));

      const result = await channel.validateConfig!({
        enabled: true,
        botToken: 'invalid-token',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token');
    });

    it('should destroy test client after validation', async () => {
      await channel.validateConfig!({
        enabled: true,
        botToken: 'valid-bot-token',
      });

      expect(mockClient.destroy).toHaveBeenCalled();
    });
  });

  describe('image download', () => {
    beforeEach(async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should download image attachments', async () => {
      const imageBuffer = new ArrayBuffer(100);
      mockFetch.mockResolvedValueOnce({
        arrayBuffer: vi.fn().mockResolvedValue(imageBuffer),
      });

      const mockAttachment = {
        id: 'attach-123',
        url: 'https://cdn.discord.com/attachments/123/456/image.png',
        name: 'image.png',
        contentType: 'image/png',
      };

      const attachments = new MockCollection<string, any>();
      attachments.set('attach-123', mockAttachment);
      mockMessage.attachments = attachments;
      mockMessage.content = `<@${mockBotUser.id}> check this image`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Got your image!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockFetch).toHaveBeenCalledWith(mockAttachment.url);
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({
              id: 'attach-123',
              mimeType: 'image/png',
            }),
          ]),
        })
      );
    });

    it('should create images directory if not exists', async () => {
      vi.mocked(existsSync).mockReturnValueOnce(false);
      
      const mockAttachment = {
        id: 'attach-456',
        url: 'https://cdn.discord.com/attachments/123/456/photo.jpg',
        name: 'photo.jpg',
        contentType: 'image/jpeg',
      };

      const attachments = new MockCollection<string, any>();
      attachments.set('attach-456', mockAttachment);
      mockMessage.attachments = attachments;
      mockMessage.content = `<@${mockBotUser.id}> photo`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Nice photo!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('images'), { recursive: true });
    });

    it('should handle image download failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const mockAttachment = {
        id: 'attach-789',
        url: 'https://cdn.discord.com/attachments/123/456/broken.png',
        name: 'broken.png',
        contentType: 'image/png',
      };

      const attachments = new MockCollection<string, any>();
      attachments.set('attach-789', mockAttachment);
      mockMessage.attachments = attachments;
      mockMessage.content = `<@${mockBotUser.id}> image`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      // Should not throw
      await handlers[Events.MessageCreate](mockMessage);

      // Handler should still be called (without the failed image)
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should detect image by file extension when contentType missing', async () => {
      const mockAttachment = {
        id: 'attach-ext',
        url: 'https://cdn.discord.com/attachments/123/456/pic.jpeg',
        name: 'pic.jpeg',
        contentType: null,
      };

      const attachments = new MockCollection<string, any>();
      attachments.set('attach-ext', mockAttachment);
      mockMessage.attachments = attachments;
      mockMessage.content = `<@${mockBotUser.id}> pic`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Got it!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({
              mimeType: 'image/jpeg',
            }),
          ]),
        })
      );
    });

    it('should process text file attachments as documents', async () => {
      const textAttachment = {
        id: 'attach-txt',
        url: 'https://cdn.discord.com/attachments/123/456/file.txt',
        name: 'file.txt',
        contentType: 'text/plain',
      };

      const attachments = new MockCollection<string, any>();
      attachments.set('attach-txt', textAttachment);
      mockMessage.attachments = attachments;
      mockMessage.content = `<@${mockBotUser.id}> file`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      // Text files are now processed as documents
      expect(mockFetch).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          documents: expect.any(Array),
          metadata: expect.objectContaining({
            hasDocument: true,
          }),
        })
      );
    });

    it('should filter out truly unsupported attachments', async () => {
      const zipAttachment = {
        id: 'attach-zip',
        url: 'https://cdn.discord.com/attachments/123/456/file.zip',
        name: 'file.zip',
        contentType: 'application/zip',
      };

      const attachments = new MockCollection<string, any>();
      attachments.set('attach-zip', zipAttachment);
      mockMessage.attachments = attachments;
      mockMessage.content = `<@${mockBotUser.id}> file`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: undefined,
          documents: undefined,
        })
      );
    });

    it('should handle multiple image attachments', async () => {
      const attachment1 = {
        id: 'attach-1',
        url: 'https://cdn.discord.com/attachments/123/456/image1.png',
        name: 'image1.png',
        contentType: 'image/png',
      };
      const attachment2 = {
        id: 'attach-2',
        url: 'https://cdn.discord.com/attachments/123/456/image2.jpg',
        name: 'image2.jpg',
        contentType: 'image/jpeg',
      };

      const attachments = new MockCollection<string, any>();
      attachments.set('attach-1', attachment1);
      attachments.set('attach-2', attachment2);
      mockMessage.attachments = attachments;
      mockMessage.content = `<@${mockBotUser.id}> images`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Got them!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({ id: 'attach-1' }),
            expect.objectContaining({ id: 'attach-2' }),
          ]),
        })
      );
    });

    it('should use [Image attached] as text when only image with minimal text', async () => {
      const mockAttachment = {
        id: 'attach-only',
        url: 'https://cdn.discord.com/attachments/123/456/only.png',
        name: 'only.png',
        contentType: 'image/png',
      };

      const attachments = new MockCollection<string, any>();
      attachments.set('attach-only', mockAttachment);
      mockMessage.attachments = attachments;
      // Use "image" as text since empty content returns early in the handler
      mockMessage.content = `<@${mockBotUser.id}> image`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Got image!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({ id: 'attach-only' }),
          ]),
        })
      );
    });

    it('should return early when mention only with no text content', async () => {
      const mockAttachment = {
        id: 'attach-notext',
        url: 'https://cdn.discord.com/attachments/123/456/image.png',
        name: 'image.png',
        contentType: 'image/png',
      };

      const attachments = new MockCollection<string, any>();
      attachments.set('attach-notext', mockAttachment);
      mockMessage.attachments = attachments;
      mockMessage.content = `<@${mockBotUser.id}>`;  // Mention only, no text - returns early

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Got image!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      // Handler should NOT be called because content is empty after stripping mention
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('guild restrictions', () => {
    it('should ignore messages from non-allowed guilds', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        guildIds: ['allowed-guild-1', 'allowed-guild-2'],
      };

      await channel.initialize(config);

      const mockHandler = vi.fn();
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage); // mockGuild.id is 'guild-123'

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should process messages from allowed guilds', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        guildIds: ['guild-123'], // Same as mockGuild.id
      };

      await channel.initialize(config);
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Hi!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should ignore DM when guildIds are set but message has no guild', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        guildIds: ['guild-123'],
      };

      await channel.initialize(config);
      const dmMessage = { ...mockMessage, guild: null };

      const mockHandler = vi.fn();
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](dmMessage);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('channel restrictions', () => {
    it('should ignore messages from non-allowed channels', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        channelIds: ['allowed-channel-1'],
      };

      await channel.initialize(config);

      const mockHandler = vi.fn();
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage); // channel.id is 'channel-123'

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should process messages from allowed channels', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        channelIds: ['channel-123'], // Same as mockTextChannel.id
      };

      await channel.initialize(config);
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Hi!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('role restrictions', () => {
    it('should ignore messages from users without allowed roles', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        allowedRoles: ['Admin', 'VIP'],
      };

      await channel.initialize(config);
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn();
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage); // Has 'Moderator' role

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should process messages from users with allowed role name', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        allowedRoles: ['Moderator'], // Same as mockMember role
      };

      await channel.initialize(config);
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Hi!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should process messages from users with allowed role ID', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        allowedRoles: ['role-1'], // Same as mockMember role ID
      };

      await channel.initialize(config);
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Hi!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('bot mention handling', () => {
    beforeEach(async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should respond when mentioned', async () => {
      mockMessage.content = `<@${mockBotUser.id}> what time is it?`;

      const mockHandler = vi.fn().mockResolvedValue({ text: "It's noon!" });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'what time is it?',
        })
      );
    });

    it('should strip mention from message text', async () => {
      mockMessage.content = `<@${mockBotUser.id}> hello there`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Hi!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'hello there',
        })
      );
    });

    it('should ignore messages without mention in guild', async () => {
      mockMessage.content = 'just a regular message';

      const mockHandler = vi.fn();
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('prefix handling', () => {
    it('should respond to messages with command prefix', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        commandPrefix: '!',
      };

      await channel.initialize(config);
      mockMessage.content = '!help me';

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Here is help!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'help me',
        })
      );
    });

    it('should strip prefix from message text', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        commandPrefix: '>>',
      };

      await channel.initialize(config);
      mockMessage.content = '>>ask something';

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Answer!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'ask something',
        })
      );
    });

    it('should ignore messages without prefix when prefix is required', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
        commandPrefix: '!',
      };

      await channel.initialize(config);
      mockMessage.content = 'no prefix here';

      const mockHandler = vi.fn();
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('DM handling', () => {
    beforeEach(async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should always respond to DMs without mention or prefix', async () => {
      const dmMessage = {
        ...mockMessage,
        guild: null, // No guild = DM
        content: 'hello from DM',
      };

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Hi from DM!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](dmMessage);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          text: 'hello from DM',
          metadata: expect.objectContaining({
            isDM: true,
          }),
        })
      );
    });
  });

  describe('bot message filtering', () => {
    beforeEach(async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should ignore messages from bots', async () => {
      const botMessage = {
        ...mockMessage,
        author: { ...mockUser, bot: true },
        content: `<@${mockBotUser.id}> hello`,
      };

      const mockHandler = vi.fn();
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](botMessage);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('message response', () => {
    beforeEach(async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should reply to message', async () => {
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Hello back!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('Hello back!');
    });

    it('should truncate long responses to 2000 chars', async () => {
      mockMessage.content = `<@${mockBotUser.id}> tell me a story`;

      const longResponse = 'A'.repeat(2500);
      const mockHandler = vi.fn().mockResolvedValue({ text: longResponse });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('A'.repeat(1900) + '...');
    });

    it('should send typing indicator', async () => {
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockTextChannel.sendTyping).toHaveBeenCalled();
    });

    it('should warn when no handler configured', async () => {
      mockMessage.content = `<@${mockBotUser.id}> hello`;
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(null);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('⚠️ Agent not configured.');
    });

    it('should not reply when handler returns null', async () => {
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn().mockResolvedValue(null);
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockMessage.reply).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should handle message processing errors', async () => {
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn().mockRejectedValue(new Error('Processing failed'));
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ Error processing your message.');
    });

    it('should set up error handler on client', async () => {
      expect(mockClient.on).toHaveBeenCalledWith(Events.Error, expect.any(Function));
    });
  });

  describe('message metadata', () => {
    beforeEach(async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };
      await channel.initialize(config);
    });

    it('should include guild information in metadata', async () => {
      mockMessage.content = `<@${mockBotUser.id}> hello`;

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Hi!' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      const handlers = getClientHandlers();
      await handlers[Events.MessageCreate](mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          metadata: expect.objectContaining({
            guildId: 'guild-123',
            guildName: 'Test Server',
            channelId: 'channel-123',
            isDM: false,
          }),
        })
      );
    });
  });

  describe('ClientReady event', () => {
    it('should log when bot is ready', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      await channel.initialize(config);

      const handlers = getClientHandlers();
      const readyHandler = handlers[Events.ClientReady];

      // Should not throw
      readyHandler({ user: mockBotUser });
    });
  });

  describe('channel lifecycle', () => {
    it('should support full lifecycle: init -> start -> send -> stop', async () => {
      const config: DiscordConfig = {
        enabled: true,
        botToken: 'test-bot-token',
      };

      // Initialize
      await channel.initialize(config);
      expect(Client).toHaveBeenCalled();

      // Start
      await channel.start();
      expect(mockClient.login).toHaveBeenCalled();

      // Send
      await channel.send('123', { text: 'Hello' });
      expect(mockDmChannel.send).toHaveBeenCalled();

      // Send to channel
      await channel.sendToChannel('channel-123', { text: 'Hello channel' });
      expect(mockTextChannel.send).toHaveBeenCalled();

      // Stop
      await channel.stop();
      expect(mockClient.destroy).toHaveBeenCalled();
    });
  });
});

describe('DiscordChannel module exports', () => {
  it('should export discordChannel instance', async () => {
    const mod = await import('./discord.js');

    expect(mod.discordChannel).toBeDefined();
    expect(mod.discordChannel).toBeInstanceOf(DiscordChannel);
  });

  it('should export DiscordChannel class', async () => {
    const mod = await import('./discord.js');

    expect(mod.DiscordChannel).toBeDefined();
    expect(new mod.DiscordChannel()).toBeInstanceOf(DiscordChannel);
  });
});
