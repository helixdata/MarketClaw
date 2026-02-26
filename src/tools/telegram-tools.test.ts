/**
 * Tests for Telegram Tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { telegramTools } from './telegram-tools.js';

// Mock the channel registry
vi.mock('../channels/index.js', () => ({
  channelRegistry: {
    get: vi.fn(),
  },
}));

// Mock logging
vi.mock('../logging/index.js', () => ({
  createStructuredLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { channelRegistry } from '../channels/index.js';

describe('telegramTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('send_telegram_message', () => {
    const sendTool = telegramTools.find(t => t.name === 'send_telegram_message')!;

    it('should exist', () => {
      expect(sendTool).toBeDefined();
      expect(sendTool.name).toBe('send_telegram_message');
    });

    it('should have correct parameters', () => {
      expect(sendTool.parameters.required).toContain('recipient');
      expect(sendTool.parameters.required).toContain('message');
    });

    it('should send message to known contact (nova)', async () => {
      const mockChannel = {
        send: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(channelRegistry.get).mockReturnValue(mockChannel as any);

      const result = await sendTool.execute({ recipient: 'nova', message: 'Hello Nova!' });

      expect(result.success).toBe(true);
      expect(mockChannel.send).toHaveBeenCalledWith('5900329802', { text: 'Hello Nova!' });
    });

    it('should send message to known contact (brett)', async () => {
      const mockChannel = {
        send: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(channelRegistry.get).mockReturnValue(mockChannel as any);

      const result = await sendTool.execute({ recipient: 'brett', message: 'Hello Brett!' });

      expect(result.success).toBe(true);
      expect(mockChannel.send).toHaveBeenCalledWith('5900329802', { text: 'Hello Brett!' });
    });

    it('should send message to numeric user ID', async () => {
      const mockChannel = {
        send: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(channelRegistry.get).mockReturnValue(mockChannel as any);

      const result = await sendTool.execute({ recipient: '123456789', message: 'Hello!' });

      expect(result.success).toBe(true);
      expect(mockChannel.send).toHaveBeenCalledWith('123456789', { text: 'Hello!' });
    });

    it('should fail for unknown recipient', async () => {
      const result = await sendTool.execute({ recipient: 'unknown_user', message: 'Hello!' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown recipient');
    });

    it('should fail if Telegram channel not configured', async () => {
      vi.mocked(channelRegistry.get).mockReturnValue(undefined);

      const result = await sendTool.execute({ recipient: 'nova', message: 'Hello!' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Telegram channel not configured');
    });

    it('should handle send errors', async () => {
      const mockChannel = {
        send: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      vi.mocked(channelRegistry.get).mockReturnValue(mockChannel as any);

      const result = await sendTool.execute({ recipient: 'nova', message: 'Hello!' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to send message');
      expect(result.message).toContain('Network error');
    });

    it('should be case-insensitive for contact names', async () => {
      const mockChannel = {
        send: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(channelRegistry.get).mockReturnValue(mockChannel as any);

      const result = await sendTool.execute({ recipient: 'NOVA', message: 'Hello!' });

      expect(result.success).toBe(true);
      expect(mockChannel.send).toHaveBeenCalledWith('5900329802', { text: 'Hello!' });
    });
  });

  describe('list_telegram_contacts', () => {
    const listTool = telegramTools.find(t => t.name === 'list_telegram_contacts')!;

    it('should exist', () => {
      expect(listTool).toBeDefined();
      expect(listTool.name).toBe('list_telegram_contacts');
    });

    it('should return list of contacts', async () => {
      const result = await listTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      const novaContact = result.data.find((c: any) => c.name === 'nova');
      expect(novaContact).toBeDefined();
      expect(novaContact.description).toContain('Nova');
    });

    it('should include brett contact', async () => {
      const result = await listTool.execute({});

      const brettContact = result.data.find((c: any) => c.name === 'brett');
      expect(brettContact).toBeDefined();
      expect(brettContact.description).toContain('Brett');
    });
  });
});
