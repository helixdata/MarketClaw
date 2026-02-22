/**
 * Google Calendar OAuth Tests
 * Tests file operations and basic logic - googleapis interactions tested via integration tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fs modules
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock googleapis to prevent actual API calls
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?test'),
        getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 3600000 } }),
        setCredentials: vi.fn(),
        on: vi.fn(),
      })),
    },
    calendar: vi.fn().mockReturnValue({}),
  },
}));

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import {
  loadCredentials,
  saveCredentials,
  loadTokens,
  saveTokens,
  clearTokens,
  isAuthenticated,
  CALENDAR_SCOPES,
} from './google-calendar.js';

describe('Google Calendar OAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CALENDAR_SCOPES', () => {
    it('should include calendar.events scope', () => {
      expect(CALENDAR_SCOPES).toContain('https://www.googleapis.com/auth/calendar.events');
    });

    it('should include calendar.readonly scope', () => {
      expect(CALENDAR_SCOPES).toContain('https://www.googleapis.com/auth/calendar.readonly');
    });

    it('should have exactly 2 scopes', () => {
      expect(CALENDAR_SCOPES).toHaveLength(2);
    });
  });

  describe('loadCredentials', () => {
    it('should return null if credentials file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const result = await loadCredentials();
      expect(result).toBeNull();
    });

    it('should load credentials from direct format', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
      }));

      const result = await loadCredentials();
      expect(result).toEqual({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
      });
    });

    it('should handle installed wrapper format from Google Cloud Console', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        installed: {
          client_id: 'wrapped-client-id',
          client_secret: 'wrapped-client-secret',
          redirect_uris: ['http://localhost:3000/callback'],
        },
      }));

      const result = await loadCredentials();
      expect(result).toEqual({
        client_id: 'wrapped-client-id',
        client_secret: 'wrapped-client-secret',
        redirect_uri: 'http://localhost:3000/callback',
      });
    });

    it('should return raw object if not installed wrapper', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        web: {
          client_id: 'web-client-id',
          client_secret: 'web-client-secret',
        },
      }));

      // Non-installed format returns as-is (web wrapper is not parsed)
      const result = await loadCredentials();
      expect(result).toHaveProperty('web');
    });

    it('should return null on JSON parse error', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('invalid json content');

      const result = await loadCredentials();
      expect(result).toBeNull();
    });

    it('should return null on read error', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockRejectedValue(new Error('Read error'));

      const result = await loadCredentials();
      expect(result).toBeNull();
    });
  });

  describe('saveCredentials', () => {
    it('should save credentials to file', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFile).mockResolvedValue();

      await saveCredentials({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
      });

      expect(writeFile).toHaveBeenCalledTimes(1);
      const writeCall = vi.mocked(writeFile).mock.calls[0];
      expect(writeCall[1]).toContain('test-client-id');
    });

    it('should create config directory if it does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue();

      await saveCredentials({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
      });

      expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(writeFile).toHaveBeenCalled();
    });
  });

  describe('loadTokens', () => {
    it('should return null if tokens file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const result = await loadTokens();
      expect(result).toBeNull();
    });

    it('should load tokens from file', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expiry_date: 1234567890,
      }));

      const result = await loadTokens();
      expect(result).toEqual({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expiry_date: 1234567890,
      });
    });

    it('should return null on JSON parse error', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('not json');

      const result = await loadTokens();
      expect(result).toBeNull();
    });

    it('should return null on read error', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockRejectedValue(new Error('Read error'));

      const result = await loadTokens();
      expect(result).toBeNull();
    });
  });

  describe('saveTokens', () => {
    it('should save tokens to file', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFile).mockResolvedValue();

      await saveTokens({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });

      expect(writeFile).toHaveBeenCalled();
      const writeCall = vi.mocked(writeFile).mock.calls[0];
      expect(writeCall[1]).toContain('new-access-token');
    });

    it('should create directory if needed', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue();

      await saveTokens({ access_token: 'token' });

      expect(mkdir).toHaveBeenCalled();
    });
  });

  describe('clearTokens', () => {
    it('should not throw if tokens file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      await expect(clearTokens()).resolves.not.toThrow();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false if no tokens file', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return true if tokens have access_token', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        access_token: 'valid-access-token',
      }));

      const result = await isAuthenticated();
      expect(result).toBe(true);
    });

    it('should return false if tokens missing access_token', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        refresh_token: 'only-refresh-token',
      }));

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return false if tokens are empty object', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({}));

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return false if tokens file is invalid', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('invalid');

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });
  });
});
