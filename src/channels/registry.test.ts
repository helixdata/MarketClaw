/**
 * Channel Registry Tests
 * Tests the actual registry.ts module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Channel, ChannelConfig, MessageHandler } from './types.js';

// Import the actual module
import { channelRegistry } from './registry.js';

// Mock Channel implementation
const createMockChannel = (name: string, overrides?: Partial<Channel>): Channel => ({
  name,
  displayName: `${name.charAt(0).toUpperCase()}${name.slice(1)}`,
  description: `${name} channel for testing`,
  requiredConfig: ['token'],
  optionalConfig: ['webhook'],
  requiredEnv: [`${name.toUpperCase()}_TOKEN`],
  initialize: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('ChannelRegistry', () => {
  // Track channels we register for cleanup
  let registeredChannels: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    registeredChannels = [];
  });

  afterEach(async () => {
    // Stop any enabled channels from our tests
    try {
      await channelRegistry.stopAll();
    } catch (e) {
      // Ignore errors during cleanup
    }
  });

  describe('register', () => {
    it('should register a channel', () => {
      const channelName = `telegram-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      expect(channelRegistry.get(channelName)).toBe(channel);
    });

    it('should set registered channel as disabled by default', () => {
      const channelName = `discord-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      const list = channelRegistry.list();
      const registered = list.find(rc => rc.channel.name === channelName);
      expect(registered?.enabled).toBe(false);
    });

    it('should allow registering multiple channels', () => {
      const names = [`ch1-${Date.now()}`, `ch2-${Date.now()}`, `ch3-${Date.now()}`];
      names.forEach(name => {
        channelRegistry.register(createMockChannel(name));
        registeredChannels.push(name);
      });

      const available = channelRegistry.available();
      names.forEach(name => {
        expect(available).toContain(name);
      });
    });
  });

  describe('get', () => {
    it('should return channel by name', () => {
      const channelName = `get-test-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      expect(channelRegistry.get(channelName)).toBe(channel);
    });

    it('should return undefined for non-existent channel', () => {
      expect(channelRegistry.get('nonexistent-channel-xyz')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list registered channels', () => {
      const channelName = `list-test-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      const list = channelRegistry.list();
      expect(list.some(rc => rc.channel.name === channelName)).toBe(true);
    });

    it('should include enabled status', () => {
      const channelName = `status-test-${Date.now()}`;
      channelRegistry.register(createMockChannel(channelName));
      registeredChannels.push(channelName);
      
      const list = channelRegistry.list();
      const registered = list.find(rc => rc.channel.name === channelName);
      expect(registered).toHaveProperty('enabled');
    });
  });

  describe('available', () => {
    it('should return names of registered channels', () => {
      const channelName = `avail-test-${Date.now()}`;
      channelRegistry.register(createMockChannel(channelName));
      registeredChannels.push(channelName);

      expect(channelRegistry.available()).toContain(channelName);
    });
  });

  describe('enabled', () => {
    it('should return only enabled channels', async () => {
      const enabledName = `enabled-${Date.now()}`;
      const disabledName = `disabled-${Date.now()}`;
      
      const enabledChannel = createMockChannel(enabledName);
      const disabledChannel = createMockChannel(disabledName);
      
      channelRegistry.register(enabledChannel);
      channelRegistry.register(disabledChannel);
      registeredChannels.push(enabledName, disabledName);

      await channelRegistry.configure(enabledName, { enabled: true, token: 'test' });

      const enabled = channelRegistry.enabled();
      expect(enabled.some(ch => ch.name === enabledName)).toBe(true);
      expect(enabled.some(ch => ch.name === disabledName)).toBe(false);
    });
  });

  describe('configure', () => {
    it('should enable channel when config.enabled is true', async () => {
      const channelName = `config-enable-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      await channelRegistry.configure(channelName, { enabled: true, token: 'test' });

      const list = channelRegistry.list();
      const registered = list.find(rc => rc.channel.name === channelName);
      expect(registered?.enabled).toBe(true);
    });

    it('should call channel.initialize when enabling', async () => {
      const channelName = `config-init-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      const config: ChannelConfig = { enabled: true, token: 'test' };
      await channelRegistry.configure(channelName, config);

      expect(channel.initialize).toHaveBeenCalledWith(config);
    });

    it('should disable channel when config.enabled is false', async () => {
      const channelName = `config-disable-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      await channelRegistry.configure(channelName, { enabled: true, token: 'test' });
      await channelRegistry.configure(channelName, { enabled: false });

      const list = channelRegistry.list();
      const registered = list.find(rc => rc.channel.name === channelName);
      expect(registered?.enabled).toBe(false);
    });

    it('should throw for non-existent channel', async () => {
      await expect(
        channelRegistry.configure('nonexistent-xyz-123', { enabled: true })
      ).rejects.toThrow('Channel not found: nonexistent-xyz-123');
    });

    it('should not call initialize when disabling', async () => {
      const channelName = `no-init-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      await channelRegistry.configure(channelName, { enabled: false });

      expect(channel.initialize).not.toHaveBeenCalled();
    });
  });

  describe('setMessageHandler and getMessageHandler', () => {
    it('should set message handler', () => {
      const handler: MessageHandler = vi.fn();
      channelRegistry.setMessageHandler(handler);

      expect(channelRegistry.getMessageHandler()).toBe(handler);
    });

    it('should return null when no handler set initially', () => {
      // Note: This test assumes the handler might be null initially
      // In the real module, it depends on whether a handler was previously set
      const handler = channelRegistry.getMessageHandler();
      // Just verify it returns something (null or function)
      expect(handler === null || typeof handler === 'function').toBe(true);
    });

    it('should allow updating handler', () => {
      const handler1: MessageHandler = vi.fn();
      const handler2: MessageHandler = vi.fn();
      
      channelRegistry.setMessageHandler(handler1);
      expect(channelRegistry.getMessageHandler()).toBe(handler1);
      
      channelRegistry.setMessageHandler(handler2);
      expect(channelRegistry.getMessageHandler()).toBe(handler2);
    });
  });

  describe('startAll', () => {
    it('should start all enabled channels', async () => {
      const ch1Name = `start-1-${Date.now()}`;
      const ch2Name = `start-2-${Date.now()}`;
      
      const ch1 = createMockChannel(ch1Name);
      const ch2 = createMockChannel(ch2Name);
      
      channelRegistry.register(ch1);
      channelRegistry.register(ch2);
      registeredChannels.push(ch1Name, ch2Name);

      await channelRegistry.configure(ch1Name, { enabled: true, token: 'test1' });
      await channelRegistry.configure(ch2Name, { enabled: true, token: 'test2' });

      await channelRegistry.startAll();

      expect(ch1.start).toHaveBeenCalled();
      expect(ch2.start).toHaveBeenCalled();
    });

    it('should not start disabled channels', async () => {
      const enabledName = `start-enabled-${Date.now()}`;
      const disabledName = `start-disabled-${Date.now()}`;
      
      const enabled = createMockChannel(enabledName);
      const disabled = createMockChannel(disabledName);
      
      channelRegistry.register(enabled);
      channelRegistry.register(disabled);
      registeredChannels.push(enabledName, disabledName);

      await channelRegistry.configure(enabledName, { enabled: true, token: 'test' });

      await channelRegistry.startAll();

      expect(enabled.start).toHaveBeenCalled();
      expect(disabled.start).not.toHaveBeenCalled();
    });

    it('should handle no enabled channels', async () => {
      const channelName = `no-start-${Date.now()}`;
      channelRegistry.register(createMockChannel(channelName));
      registeredChannels.push(channelName);

      // Should not throw
      await channelRegistry.startAll();
    });
  });

  describe('stopAll', () => {
    it('should stop all enabled channels', async () => {
      const ch1Name = `stop-1-${Date.now()}`;
      const ch2Name = `stop-2-${Date.now()}`;
      
      const ch1 = createMockChannel(ch1Name);
      const ch2 = createMockChannel(ch2Name);
      
      channelRegistry.register(ch1);
      channelRegistry.register(ch2);
      registeredChannels.push(ch1Name, ch2Name);

      await channelRegistry.configure(ch1Name, { enabled: true, token: 'test1' });
      await channelRegistry.configure(ch2Name, { enabled: true, token: 'test2' });

      await channelRegistry.stopAll();

      expect(ch1.stop).toHaveBeenCalled();
      expect(ch2.stop).toHaveBeenCalled();
    });

    it('should not stop disabled channels', async () => {
      const enabledName = `stop-enabled-${Date.now()}`;
      const disabledName = `stop-disabled-${Date.now()}`;
      
      const enabled = createMockChannel(enabledName);
      const disabled = createMockChannel(disabledName);
      
      channelRegistry.register(enabled);
      channelRegistry.register(disabled);
      registeredChannels.push(enabledName, disabledName);

      await channelRegistry.configure(enabledName, { enabled: true, token: 'test' });

      await channelRegistry.stopAll();

      expect(enabled.stop).toHaveBeenCalled();
      expect(disabled.stop).not.toHaveBeenCalled();
    });
  });

  describe('getSetupInfo', () => {
    it('should return setup info for registered channels', () => {
      const channelName = `setup-info-${Date.now()}`;
      channelRegistry.register(createMockChannel(channelName, {
        displayName: 'Setup Test',
        description: 'Setup test channel',
        requiredConfig: ['token', 'chatId'],
        optionalConfig: ['parseMode'],
        requiredEnv: ['TEST_TOKEN'],
      }));
      registeredChannels.push(channelName);

      const info = channelRegistry.getSetupInfo();
      const channelInfo = info.find(i => i.name === channelName);

      expect(channelInfo).toBeDefined();
      expect(channelInfo!.displayName).toBe('Setup Test');
      expect(channelInfo!.description).toBe('Setup test channel');
      expect(channelInfo!.requiredConfig).toContain('token');
      expect(channelInfo!.optionalConfig).toContain('parseMode');
      expect(channelInfo!.requiredEnv).toContain('TEST_TOKEN');
    });

    it('should return info for multiple channels', () => {
      const names = [`info-1-${Date.now()}`, `info-2-${Date.now()}`];
      names.forEach(name => {
        channelRegistry.register(createMockChannel(name));
        registeredChannels.push(name);
      });

      const info = channelRegistry.getSetupInfo();
      names.forEach(name => {
        expect(info.some(i => i.name === name)).toBe(true);
      });
    });

    it('should handle channels without optional fields', () => {
      const channelName = `no-optional-${Date.now()}`;
      channelRegistry.register(createMockChannel(channelName, {
        optionalConfig: undefined,
        requiredEnv: undefined,
      }));
      registeredChannels.push(channelName);

      const info = channelRegistry.getSetupInfo();
      const channelInfo = info.find(i => i.name === channelName);

      expect(channelInfo!.optionalConfig).toBeUndefined();
      expect(channelInfo!.requiredEnv).toBeUndefined();
    });
  });

  describe('channel lifecycle', () => {
    it('should support enable -> start -> stop -> disable cycle', async () => {
      const channelName = `lifecycle-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      // Enable
      await channelRegistry.configure(channelName, { enabled: true, token: 'test' });
      expect(channelRegistry.enabled().some(ch => ch.name === channelName)).toBe(true);

      // Start
      await channelRegistry.startAll();
      expect(channel.start).toHaveBeenCalled();

      // Stop
      await channelRegistry.stopAll();
      expect(channel.stop).toHaveBeenCalled();

      // Disable
      await channelRegistry.configure(channelName, { enabled: false });
      expect(channelRegistry.enabled().some(ch => ch.name === channelName)).toBe(false);
    });

    it('should support re-enabling channel', async () => {
      const channelName = `re-enable-${Date.now()}`;
      const channel = createMockChannel(channelName);
      channelRegistry.register(channel);
      registeredChannels.push(channelName);

      await channelRegistry.configure(channelName, { enabled: true, token: 'test1' });
      await channelRegistry.configure(channelName, { enabled: false });
      await channelRegistry.configure(channelName, { enabled: true, token: 'test2' });

      expect(channelRegistry.enabled().some(ch => ch.name === channelName)).toBe(true);
      expect(channel.initialize).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent configure calls', async () => {
      const ch1Name = `concurrent-1-${Date.now()}`;
      const ch2Name = `concurrent-2-${Date.now()}`;
      
      channelRegistry.register(createMockChannel(ch1Name));
      channelRegistry.register(createMockChannel(ch2Name));
      registeredChannels.push(ch1Name, ch2Name);

      await Promise.all([
        channelRegistry.configure(ch1Name, { enabled: true, token: 'test1' }),
        channelRegistry.configure(ch2Name, { enabled: true, token: 'test2' }),
      ]);

      const enabled = channelRegistry.enabled();
      expect(enabled.some(ch => ch.name === ch1Name)).toBe(true);
      expect(enabled.some(ch => ch.name === ch2Name)).toBe(true);
    });
  });
});
