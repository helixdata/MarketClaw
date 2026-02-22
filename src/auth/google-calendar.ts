/**
 * Google Calendar OAuth Handler
 * Manages OAuth 2.0 flow for Google Calendar API
 */

import { google, Auth } from 'googleapis';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

const CONFIG_DIR = path.join(homedir(), '.marketclaw');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'google-credentials.json');
const TOKENS_FILE = path.join(CONFIG_DIR, 'google-tokens.json');

// OAuth scopes for calendar access
export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

export interface GoogleCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load stored OAuth credentials (client_id, client_secret)
 */
export async function loadCredentials(): Promise<GoogleCredentials | null> {
  if (!existsSync(CREDENTIALS_FILE)) {
    return null;
  }

  try {
    const data = await readFile(CREDENTIALS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Handle both direct format and "installed" wrapper format
    if (parsed.installed) {
      return {
        client_id: parsed.installed.client_id,
        client_secret: parsed.installed.client_secret,
        redirect_uri: parsed.installed.redirect_uris?.[0],
      };
    }
    
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save OAuth credentials
 */
export async function saveCredentials(credentials: GoogleCredentials): Promise<void> {
  await ensureConfigDir();
  await writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

/**
 * Load stored tokens
 */
export async function loadTokens(): Promise<GoogleTokens | null> {
  if (!existsSync(TOKENS_FILE)) {
    return null;
  }

  try {
    const data = await readFile(TOKENS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save tokens
 */
export async function saveTokens(tokens: GoogleTokens): Promise<void> {
  await ensureConfigDir();
  await writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

/**
 * Clear stored tokens (for logout/reauth)
 */
export async function clearTokens(): Promise<void> {
  if (existsSync(TOKENS_FILE)) {
    const { unlink } = await import('fs/promises');
    await unlink(TOKENS_FILE);
  }
}

/**
 * Create OAuth2 client
 */
export async function createOAuth2Client(): Promise<Auth.OAuth2Client | null> {
  const credentials = await loadCredentials();
  if (!credentials) {
    return null;
  }

  const redirectUri = credentials.redirect_uri || 'urn:ietf:wg:oauth:2.0:oob';
  
  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    redirectUri
  );

  // Try to load existing tokens
  const tokens = await loadTokens();
  if (tokens) {
    oauth2Client.setCredentials(tokens);
    
    // Set up automatic token refresh
    oauth2Client.on('tokens', async (newTokens) => {
      // Merge with existing tokens (keep refresh_token if not returned)
      const merged: GoogleTokens = {
        access_token: newTokens.access_token ?? tokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
        expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
        token_type: newTokens.token_type ?? tokens.token_type,
        scope: newTokens.scope ?? tokens.scope,
      };
      await saveTokens(merged);
    });
  }

  return oauth2Client;
}

/**
 * Generate OAuth authorization URL
 */
export async function getAuthUrl(): Promise<string | null> {
  const credentials = await loadCredentials();
  if (!credentials) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uri || 'urn:ietf:wg:oauth:2.0:oob'
  );

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: CALENDAR_SCOPES,
    prompt: 'consent', // Force consent to get refresh_token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(code: string): Promise<GoogleTokens | null> {
  const oauth2Client = await createOAuth2Client();
  if (!oauth2Client) {
    return null;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const typedTokens: GoogleTokens = {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      token_type: tokens.token_type ?? undefined,
      scope: tokens.scope ?? undefined,
    };
    
    await saveTokens(typedTokens);
    return typedTokens;
  } catch (error) {
    console.error('Failed to exchange code:', error);
    return null;
  }
}

/**
 * Check if we have valid credentials and tokens
 */
export async function isAuthenticated(): Promise<boolean> {
  const credentials = await loadCredentials();
  if (!credentials) return false;

  const tokens = await loadTokens();
  if (!tokens?.access_token) return false;

  // Check if token is expired (with 5 minute buffer)
  if (tokens.expiry_date) {
    const now = Date.now();
    const buffer = 5 * 60 * 1000; // 5 minutes
    if (tokens.expiry_date - buffer < now) {
      // Token expired - try to refresh
      if (tokens.refresh_token) {
        try {
          const oauth2Client = await createOAuth2Client();
          if (oauth2Client) {
            oauth2Client.setCredentials(tokens);
            const { credentials: refreshed } = await oauth2Client.refreshAccessToken();
            const newTokens: GoogleTokens = {
              access_token: refreshed.access_token!,
              refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
              expiry_date: refreshed.expiry_date ?? undefined,
              token_type: refreshed.token_type ?? undefined,
              scope: refreshed.scope ?? undefined,
            };
            await saveTokens(newTokens);
            return true;
          }
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  return true;
}

/**
 * Get authenticated calendar client
 */
export async function getCalendarClient() {
  const oauth2Client = await createOAuth2Client();
  if (!oauth2Client) {
    throw new Error('Google Calendar not configured. Run setup to configure OAuth credentials.');
  }

  const tokens = await loadTokens();
  if (!tokens?.access_token) {
    throw new Error('Google Calendar not authenticated. Run auth flow to connect your account.');
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}
