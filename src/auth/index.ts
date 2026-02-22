/**
 * Auth System
 * Handles API keys, OAuth tokens, and Claude Code CLI integration
 * Based on Clawdbot's auth approach
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
// Fall back to file storage (simpler and more reliable)

const CONFIG_DIR = path.join(homedir(), '.marketclaw');
const AUTH_FILE = path.join(CONFIG_DIR, 'auth.json');

export interface AuthProfile {
  provider: string;
  name: string;
  mode: 'api-key' | 'oauth' | 'setup-token';
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuthStore {
  activeProfiles: Record<string, string>; // provider -> profile name
  profiles: AuthProfile[];
}

async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

async function loadAuthStore(): Promise<AuthStore> {
  await ensureConfigDir();
  
  if (!existsSync(AUTH_FILE)) {
    return { activeProfiles: {}, profiles: [] };
  }

  const data = await readFile(AUTH_FILE, 'utf-8');
  return JSON.parse(data);
}

async function saveAuthStore(store: AuthStore): Promise<void> {
  await ensureConfigDir();
  await writeFile(AUTH_FILE, JSON.stringify(store, null, 2));
}

// File-based secure storage
const SECRETS_FILE = path.join(CONFIG_DIR, 'secrets.json');

async function secureSet(key: string, value: string): Promise<void> {
  await ensureConfigDir();
  let secrets: Record<string, string> = {};
  if (existsSync(SECRETS_FILE)) {
    secrets = JSON.parse(await readFile(SECRETS_FILE, 'utf-8'));
  }
  secrets[key] = value;
  await writeFile(SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
}

async function secureGet(key: string): Promise<string | null> {
  if (!existsSync(SECRETS_FILE)) return null;
  const secrets = JSON.parse(await readFile(SECRETS_FILE, 'utf-8'));
  return secrets[key] || null;
}

/**
 * Store an API key securely
 */
export async function storeApiKey(provider: string, profileName: string, apiKey: string): Promise<void> {
  const store = await loadAuthStore();
  
  // Store securely
  await secureSet(`${provider}:${profileName}`, apiKey);
  
  // Update profile
  const existingIndex = store.profiles.findIndex(
    p => p.provider === provider && p.name === profileName
  );

  const profile: AuthProfile = {
    provider,
    name: profileName,
    mode: 'api-key',
    createdAt: existingIndex >= 0 ? store.profiles[existingIndex].createdAt : Date.now(),
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    store.profiles[existingIndex] = profile;
  } else {
    store.profiles.push(profile);
  }

  // Set as active for this provider
  store.activeProfiles[provider] = profileName;
  
  await saveAuthStore(store);
}

/**
 * Store OAuth/setup-token credentials (like Claude Code CLI)
 */
export async function storeOAuthToken(
  provider: string,
  profileName: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: number
): Promise<void> {
  const store = await loadAuthStore();
  
  // Store tokens securely
  await secureSet(`${provider}:${profileName}:access`, accessToken);
  if (refreshToken) {
    await secureSet(`${provider}:${profileName}:refresh`, refreshToken);
  }

  const existingIndex = store.profiles.findIndex(
    p => p.provider === provider && p.name === profileName
  );

  const profile: AuthProfile = {
    provider,
    name: profileName,
    mode: 'oauth',
    expiresAt,
    createdAt: existingIndex >= 0 ? store.profiles[existingIndex].createdAt : Date.now(),
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    store.profiles[existingIndex] = profile;
  } else {
    store.profiles.push(profile);
  }

  store.activeProfiles[provider] = profileName;
  
  await saveAuthStore(store);
}

/**
 * Store a setup-token from Claude Code CLI
 * Run `claude setup-token` to generate, then paste here
 */
export async function storeSetupToken(token: string): Promise<boolean> {
  try {
    // Setup tokens are used directly as auth tokens
    await storeOAuthToken('anthropic', 'claude-cli', token);
    console.log('✅ Stored Claude setup-token');
    return true;
  } catch (error) {
    console.error('Failed to store setup-token:', error);
    return false;
  }
}

/**
 * Interactive prompt to paste setup-token
 */
export async function promptForSetupToken(): Promise<boolean> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n📋 Claude Setup Token');
    console.log('────────────────────');
    console.log('1. Run: claude setup-token');
    console.log('2. Copy the token that appears');
    console.log('3. Paste it below\n');
    
    rl.question('Paste setup-token: ', async (token) => {
      rl.close();
      if (token && token.trim()) {
        const success = await storeSetupToken(token.trim());
        resolve(success);
      } else {
        console.log('No token provided');
        resolve(false);
      }
    });
  });
}

/**
 * Get credentials for a provider
 */
export async function getCredentials(provider: string, profileName?: string): Promise<{
  apiKey?: string;
  accessToken?: string;
  mode: 'api-key' | 'oauth' | 'setup-token';
} | null> {
  const store = await loadAuthStore();
  
  const pName = profileName || store.activeProfiles[provider];
  if (!pName) return null;

  const profile = store.profiles.find(p => p.provider === provider && p.name === pName);
  if (!profile) return null;

  if (profile.mode === 'api-key') {
    const apiKey = await secureGet(`${provider}:${pName}`);
    return apiKey ? { apiKey, mode: 'api-key' } : null;
  } else {
    const accessToken = await secureGet(`${provider}:${pName}:access`);
    return accessToken ? { accessToken, mode: 'oauth' } : null;
  }
}

/**
 * List all profiles
 */
export async function listProfiles(): Promise<AuthProfile[]> {
  const store = await loadAuthStore();
  return store.profiles;
}

/**
 * Get active profile for a provider
 */
export async function getActiveProfile(provider: string): Promise<string | null> {
  const store = await loadAuthStore();
  return store.activeProfiles[provider] || null;
}

/**
 * Set active profile for a provider
 */
export async function setActiveProfile(provider: string, profileName: string): Promise<void> {
  const store = await loadAuthStore();
  store.activeProfiles[provider] = profileName;
  await saveAuthStore(store);
}

// Re-export Google Calendar auth
export * from './google-calendar.js';
