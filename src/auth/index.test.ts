/**
 * Auth Module Tests
 * Tests for API key storage, OAuth tokens, and credential management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import {
  storeApiKey,
  storeOAuthToken,
  storeSetupToken,
  getCredentials,
  listProfiles,
  getActiveProfile,
  setActiveProfile,
  type AuthStore,
  type AuthProfile,
} from './index.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock os
vi.mock('os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);
const mockExistsSync = vi.mocked(existsSync);

// Helper to create mock auth store
function createMockAuthStore(overrides: Partial<AuthStore> = {}): AuthStore {
  return {
    activeProfiles: {},
    profiles: [],
    ...overrides,
  };
}

// Helper to create mock profile
function createMockProfile(overrides: Partial<AuthProfile> = {}): AuthProfile {
  return {
    provider: 'test-provider',
    name: 'test-profile',
    mode: 'api-key',
    createdAt: 1000000000000,
    updatedAt: 1000000000000,
    ...overrides,
  };
}

// File paths used in mocks
const AUTH_FILE_PATH = '/mock/home/.marketclaw/auth.json';
const SECRETS_FILE_PATH = '/mock/home/.marketclaw/secrets.json';

// Helper to simulate files existing (called by tests that pre-populate state)
function markFilesAsExisting(files: Set<string>) {
  files.add(AUTH_FILE_PATH);
  files.add(SECRETS_FILE_PATH);
}

describe('Auth Module', () => {
  let mockSecrets: Record<string, string>;
  let mockAuthStore: AuthStore;
  let filesWritten: Set<string>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

    mockSecrets = {};
    mockAuthStore = createMockAuthStore();
    filesWritten = new Set();

    // Default mock implementations
    mockMkdir.mockResolvedValue(undefined);

    // Mock existsSync - tracks what files have been "written"
    mockExistsSync.mockImplementation((filePath) => {
      const path = filePath.toString();
      return filesWritten.has(path);
    });

    // Mock readFile based on path
    mockReadFile.mockImplementation(async (filePath) => {
      const path = filePath.toString();
      if (path.includes('auth.json')) {
        return JSON.stringify(mockAuthStore);
      }
      if (path.includes('secrets.json')) {
        return JSON.stringify(mockSecrets);
      }
      throw new Error(`File not found: ${path}`);
    });

    // Capture writes and track that file now exists
    mockWriteFile.mockImplementation(async (filePath, data) => {
      const path = filePath.toString();
      filesWritten.add(path);
      if (path.includes('auth.json')) {
        mockAuthStore = JSON.parse(data as string);
      }
      if (path.includes('secrets.json')) {
        mockSecrets = JSON.parse(data as string);
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('storeApiKey', () => {
    it('should store a new API key and create profile', async () => {
      await storeApiKey('openai', 'default', 'sk-test-key-123');

      // Check secrets were stored
      expect(mockSecrets['openai:default']).toBe('sk-test-key-123');

      // Check profile was created
      expect(mockAuthStore.profiles).toHaveLength(1);
      expect(mockAuthStore.profiles[0]).toMatchObject({
        provider: 'openai',
        name: 'default',
        mode: 'api-key',
      });

      // Check it's set as active
      expect(mockAuthStore.activeProfiles['openai']).toBe('default');
    });

    it('should update existing profile when storing API key again', async () => {
      // Pre-populate with existing profile
      mockAuthStore = createMockAuthStore({
        profiles: [createMockProfile({
          provider: 'openai',
          name: 'default',
          createdAt: 1000000000000,
          updatedAt: 1000000000000,
        })],
        activeProfiles: { openai: 'default' },
      });
      markFilesAsExisting(filesWritten);

      await storeApiKey('openai', 'default', 'sk-new-key-456');

      // Should still have 1 profile, not 2
      expect(mockAuthStore.profiles).toHaveLength(1);
      expect(mockSecrets['openai:default']).toBe('sk-new-key-456');

      // createdAt should be preserved
      expect(mockAuthStore.profiles[0].createdAt).toBe(1000000000000);
      // updatedAt should be updated
      expect(mockAuthStore.profiles[0].updatedAt).toBe(Date.now());
    });

    it('should allow multiple profiles for same provider', async () => {
      await storeApiKey('openai', 'personal', 'sk-personal-key');
      await storeApiKey('openai', 'work', 'sk-work-key');

      expect(mockAuthStore.profiles).toHaveLength(2);
      expect(mockSecrets['openai:personal']).toBe('sk-personal-key');
      expect(mockSecrets['openai:work']).toBe('sk-work-key');

      // Last one stored should be active
      expect(mockAuthStore.activeProfiles['openai']).toBe('work');
    });

    it('should handle multiple providers', async () => {
      await storeApiKey('openai', 'default', 'sk-openai-key');
      await storeApiKey('anthropic', 'default', 'sk-anthropic-key');

      expect(mockAuthStore.profiles).toHaveLength(2);
      expect(mockAuthStore.activeProfiles['openai']).toBe('default');
      expect(mockAuthStore.activeProfiles['anthropic']).toBe('default');
    });

    it('should create config directory if it does not exist', async () => {
      // filesWritten is empty by default, so files don't exist
      await storeApiKey('openai', 'default', 'sk-test-key');

      expect(mockMkdir).toHaveBeenCalledWith('/mock/home/.marketclaw', { recursive: true });
    });

    it('should write secrets file with restricted permissions', async () => {
      await storeApiKey('openai', 'default', 'sk-test-key');

      // Check writeFile was called with mode 0o600 for secrets
      const secretsWriteCall = mockWriteFile.mock.calls.find(
        call => call[0].toString().includes('secrets.json')
      );
      expect(secretsWriteCall).toBeDefined();
      expect(secretsWriteCall![2]).toEqual({ mode: 0o600 });
    });
  });

  describe('storeOAuthToken', () => {
    it('should store OAuth tokens correctly', async () => {
      const expiresAt = Date.now() + 3600000; // 1 hour from now

      await storeOAuthToken(
        'anthropic',
        'main',
        'access-token-123',
        'refresh-token-456',
        expiresAt
      );

      // Check tokens were stored
      expect(mockSecrets['anthropic:main:access']).toBe('access-token-123');
      expect(mockSecrets['anthropic:main:refresh']).toBe('refresh-token-456');

      // Check profile
      expect(mockAuthStore.profiles[0]).toMatchObject({
        provider: 'anthropic',
        name: 'main',
        mode: 'oauth',
        expiresAt,
      });
    });

    it('should store OAuth token without refresh token', async () => {
      await storeOAuthToken('anthropic', 'main', 'access-token-123');

      expect(mockSecrets['anthropic:main:access']).toBe('access-token-123');
      expect(mockSecrets['anthropic:main:refresh']).toBeUndefined();
    });

    it('should update existing OAuth profile', async () => {
      mockAuthStore = createMockAuthStore({
        profiles: [createMockProfile({
          provider: 'anthropic',
          name: 'main',
          mode: 'oauth',
          createdAt: 1000000000000,
        })],
      });
      markFilesAsExisting(filesWritten);

      await storeOAuthToken('anthropic', 'main', 'new-access-token');

      expect(mockAuthStore.profiles).toHaveLength(1);
      expect(mockSecrets['anthropic:main:access']).toBe('new-access-token');
      expect(mockAuthStore.profiles[0].createdAt).toBe(1000000000000);
    });
  });

  describe('storeSetupToken', () => {
    it('should store Claude CLI setup token', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await storeSetupToken('setup-token-abc123');

      expect(result).toBe(true);
      expect(mockSecrets['anthropic:claude-cli:access']).toBe('setup-token-abc123');
      expect(mockAuthStore.profiles[0]).toMatchObject({
        provider: 'anthropic',
        name: 'claude-cli',
        mode: 'oauth',
      });
      expect(consoleSpy).toHaveBeenCalledWith('✅ Stored Claude setup-token');

      consoleSpy.mockRestore();
    });

    it('should return false and log error on failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockWriteFile.mockRejectedValueOnce(new Error('Write failed'));

      const result = await storeSetupToken('setup-token-abc123');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to store setup-token:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCredentials', () => {
    it('should retrieve API key credentials', async () => {
      mockAuthStore = createMockAuthStore({
        profiles: [createMockProfile({
          provider: 'openai',
          name: 'default',
          mode: 'api-key',
        })],
        activeProfiles: { openai: 'default' },
      });
      mockSecrets = { 'openai:default': 'sk-test-key' };
      markFilesAsExisting(filesWritten);

      const credentials = await getCredentials('openai');

      expect(credentials).toEqual({
        apiKey: 'sk-test-key',
        mode: 'api-key',
      });
    });

    it('should retrieve OAuth credentials', async () => {
      mockAuthStore = createMockAuthStore({
        profiles: [createMockProfile({
          provider: 'anthropic',
          name: 'main',
          mode: 'oauth',
        })],
        activeProfiles: { anthropic: 'main' },
      });
      mockSecrets = { 'anthropic:main:access': 'access-token-123' };
      markFilesAsExisting(filesWritten);

      const credentials = await getCredentials('anthropic');

      expect(credentials).toEqual({
        accessToken: 'access-token-123',
        mode: 'oauth',
      });
    });

    it('should use specific profile when provided', async () => {
      mockAuthStore = createMockAuthStore({
        profiles: [
          createMockProfile({ provider: 'openai', name: 'personal', mode: 'api-key' }),
          createMockProfile({ provider: 'openai', name: 'work', mode: 'api-key' }),
        ],
        activeProfiles: { openai: 'personal' },
      });
      mockSecrets = {
        'openai:personal': 'sk-personal',
        'openai:work': 'sk-work',
      };
      markFilesAsExisting(filesWritten);

      const credentials = await getCredentials('openai', 'work');

      expect(credentials).toEqual({
        apiKey: 'sk-work',
        mode: 'api-key',
      });
    });

    it('should return null if no active profile exists', async () => {
      mockAuthStore = createMockAuthStore();
      markFilesAsExisting(filesWritten);

      const credentials = await getCredentials('openai');

      expect(credentials).toBeNull();
    });

    it('should return null if profile not found', async () => {
      mockAuthStore = createMockAuthStore({
        activeProfiles: { openai: 'nonexistent' },
        profiles: [],
      });
      markFilesAsExisting(filesWritten);

      const credentials = await getCredentials('openai');

      expect(credentials).toBeNull();
    });

    it('should return null if API key not found in secrets', async () => {
      mockAuthStore = createMockAuthStore({
        profiles: [createMockProfile({
          provider: 'openai',
          name: 'default',
          mode: 'api-key',
        })],
        activeProfiles: { openai: 'default' },
      });
      mockSecrets = {}; // No secret stored
      markFilesAsExisting(filesWritten);

      const credentials = await getCredentials('openai');

      expect(credentials).toBeNull();
    });

    it('should return null if OAuth token not found in secrets', async () => {
      mockAuthStore = createMockAuthStore({
        profiles: [createMockProfile({
          provider: 'anthropic',
          name: 'main',
          mode: 'oauth',
        })],
        activeProfiles: { anthropic: 'main' },
      });
      mockSecrets = {}; // No token stored
      markFilesAsExisting(filesWritten);

      const credentials = await getCredentials('anthropic');

      expect(credentials).toBeNull();
    });

    it('should handle missing secrets file gracefully', async () => {
      mockAuthStore = createMockAuthStore({
        profiles: [createMockProfile({
          provider: 'openai',
          name: 'default',
          mode: 'api-key',
        })],
        activeProfiles: { openai: 'default' },
      });
      // Only auth.json exists, not secrets.json
      filesWritten.add(AUTH_FILE_PATH);

      const credentials = await getCredentials('openai');

      expect(credentials).toBeNull();
    });
  });

  describe('listProfiles', () => {
    it('should return empty array when no profiles exist', async () => {
      mockAuthStore = createMockAuthStore();
      markFilesAsExisting(filesWritten);

      const profiles = await listProfiles();

      expect(profiles).toEqual([]);
    });

    it('should return all profiles', async () => {
      const profile1 = createMockProfile({ provider: 'openai', name: 'default' });
      const profile2 = createMockProfile({ provider: 'anthropic', name: 'main' });
      mockAuthStore = createMockAuthStore({
        profiles: [profile1, profile2],
      });
      markFilesAsExisting(filesWritten);

      const profiles = await listProfiles();

      expect(profiles).toHaveLength(2);
      expect(profiles).toContainEqual(profile1);
      expect(profiles).toContainEqual(profile2);
    });

    it('should handle missing auth file gracefully', async () => {
      // filesWritten is empty by default, so auth file doesn't exist
      const profiles = await listProfiles();

      expect(profiles).toEqual([]);
    });
  });

  describe('getActiveProfile', () => {
    it('should return active profile name for provider', async () => {
      mockAuthStore = createMockAuthStore({
        activeProfiles: { openai: 'work', anthropic: 'main' },
      });
      markFilesAsExisting(filesWritten);

      const active = await getActiveProfile('openai');

      expect(active).toBe('work');
    });

    it('should return null if no active profile for provider', async () => {
      mockAuthStore = createMockAuthStore({
        activeProfiles: { anthropic: 'main' },
      });
      markFilesAsExisting(filesWritten);

      const active = await getActiveProfile('openai');

      expect(active).toBeNull();
    });

    it('should handle empty auth store', async () => {
      // filesWritten is empty by default, so no auth file exists
      const active = await getActiveProfile('openai');

      expect(active).toBeNull();
    });
  });

  describe('setActiveProfile', () => {
    it('should set active profile for provider', async () => {
      mockAuthStore = createMockAuthStore({
        activeProfiles: { openai: 'personal' },
      });
      markFilesAsExisting(filesWritten);

      await setActiveProfile('openai', 'work');

      expect(mockAuthStore.activeProfiles['openai']).toBe('work');
    });

    it('should add new provider to active profiles', async () => {
      mockAuthStore = createMockAuthStore({
        activeProfiles: {},
      });
      markFilesAsExisting(filesWritten);

      await setActiveProfile('anthropic', 'main');

      expect(mockAuthStore.activeProfiles['anthropic']).toBe('main');
    });

    it('should preserve other providers when setting active', async () => {
      mockAuthStore = createMockAuthStore({
        activeProfiles: { openai: 'default' },
      });
      markFilesAsExisting(filesWritten);

      await setActiveProfile('anthropic', 'main');

      expect(mockAuthStore.activeProfiles['openai']).toBe('default');
      expect(mockAuthStore.activeProfiles['anthropic']).toBe('main');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full workflow: store, retrieve, switch profiles', async () => {
      // Store first API key
      await storeApiKey('openai', 'personal', 'sk-personal-123');

      // Store second API key
      await storeApiKey('openai', 'work', 'sk-work-456');

      // Now files exist
      markFilesAsExisting(filesWritten);

      // Get credentials (should be work - last stored)
      let creds = await getCredentials('openai');
      expect(creds?.apiKey).toBe('sk-work-456');

      // Switch to personal
      await setActiveProfile('openai', 'personal');

      // Get credentials again
      creds = await getCredentials('openai');
      expect(creds?.apiKey).toBe('sk-personal-123');

      // List profiles
      const profiles = await listProfiles();
      expect(profiles).toHaveLength(2);
    });

    it('should handle mixed API key and OAuth providers', async () => {
      await storeApiKey('openai', 'default', 'sk-openai-key');
      await storeOAuthToken('anthropic', 'main', 'access-token', 'refresh-token');

      markFilesAsExisting(filesWritten);

      const openaiCreds = await getCredentials('openai');
      const anthropicCreds = await getCredentials('anthropic');

      expect(openaiCreds).toEqual({ apiKey: 'sk-openai-key', mode: 'api-key' });
      expect(anthropicCreds).toEqual({ accessToken: 'access-token', mode: 'oauth' });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty profile name', async () => {
      await storeApiKey('openai', '', 'sk-test-key');

      markFilesAsExisting(filesWritten);

      const profiles = await listProfiles();
      expect(profiles[0].name).toBe('');
    });

    it('should handle special characters in profile names', async () => {
      await storeApiKey('openai', 'profile-with-dashes_and_underscores', 'sk-test-key');

      markFilesAsExisting(filesWritten);

      const creds = await getCredentials('openai', 'profile-with-dashes_and_underscores');
      expect(creds?.apiKey).toBe('sk-test-key');
    });

    it('should handle very long API keys', async () => {
      const longKey = 'sk-' + 'a'.repeat(1000);
      await storeApiKey('openai', 'default', longKey);

      markFilesAsExisting(filesWritten);

      const creds = await getCredentials('openai');
      expect(creds?.apiKey).toBe(longKey);
    });
  });
});
