/**
 * Per-Product Tool Configuration
 * Allows products to override default tool auth/settings
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

const WORKSPACE = path.join(homedir(), '.marketclaw', 'workspace');

export interface ProductToolConfig {
  // Email (IMAP/SMTP via Himalaya)
  email?: {
    account?: string;       // Himalaya account name
    from?: string;          // Default sender address
  };
  
  // Email (Resend)
  resend?: {
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
  };
  
  // Twitter
  twitter?: {
    handle?: string;        // @handle to use
    cookieProfile?: string; // Chrome profile for cookies
  };
  
  // LinkedIn
  linkedin?: {
    profileUrn?: string;    // urn:li:person:xxx or company page
    accessToken?: string;
  };
  
  // Product Hunt
  producthunt?: {
    devToken?: string;
  };
  
  // Image generation
  images?: {
    outputDir?: string;     // Custom output directory
    defaultStyle?: string;  // Default style for images
  };
  
  // Google Calendar
  calendar?: {
    calendarId?: string;    // Calendar ID for this product
  };
  
  // Custom env vars for any tool
  env?: Record<string, string>;
}

/**
 * Get tool config for a product
 */
export async function getProductToolConfig(productId: string): Promise<ProductToolConfig | null> {
  const configPath = path.join(WORKSPACE, 'products', productId, 'tools.json');
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const data = await readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save tool config for a product
 */
export async function saveProductToolConfig(productId: string, config: ProductToolConfig): Promise<void> {
  const productDir = path.join(WORKSPACE, 'products', productId);
  await mkdir(productDir, { recursive: true });
  
  const configPath = path.join(productDir, 'tools.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Get a specific tool's config, with product override
 */
export async function getToolConfig<K extends keyof ProductToolConfig>(
  toolCategory: K,
  productId?: string
): Promise<ProductToolConfig[K] | undefined> {
  // Try product-specific config first
  if (productId) {
    const productConfig = await getProductToolConfig(productId);
    if (productConfig?.[toolCategory]) {
      return productConfig[toolCategory];
    }
  }
  
  // Fall back to global config
  const globalConfig = await getGlobalToolConfig();
  return globalConfig?.[toolCategory];
}

/**
 * Get global tool config (default for all products)
 */
export async function getGlobalToolConfig(): Promise<ProductToolConfig | null> {
  const configPath = path.join(WORKSPACE, 'tools.json');
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const data = await readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save global tool config
 */
export async function saveGlobalToolConfig(config: ProductToolConfig): Promise<void> {
  await mkdir(WORKSPACE, { recursive: true });
  const configPath = path.join(WORKSPACE, 'tools.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Resolve env vars for a tool, with product overrides
 */
export async function resolveToolEnv(productId?: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  
  // Start with process.env
  Object.assign(env, process.env);
  
  // Apply global config env
  const globalConfig = await getGlobalToolConfig();
  if (globalConfig?.env) {
    Object.assign(env, globalConfig.env);
  }
  
  // Apply product config env (overrides global)
  if (productId) {
    const productConfig = await getProductToolConfig(productId);
    if (productConfig?.env) {
      Object.assign(env, productConfig.env);
    }
  }
  
  return env;
}

/**
 * Get Himalaya account for a product
 */
export async function getHimalayaAccount(productId?: string): Promise<string | undefined> {
  const config = await getToolConfig('email', productId);
  return config?.account;
}

/**
 * Get Resend config for a product
 */
export async function getResendConfig(productId?: string): Promise<{ apiKey?: string; from?: string } | undefined> {
  const config = await getToolConfig('resend', productId);
  if (!config) return undefined;
  
  return {
    apiKey: config.apiKey,
    from: config.fromEmail ? `${config.fromName || 'MarketClaw'} <${config.fromEmail}>` : undefined,
  };
}

/**
 * Get Twitter config for a product
 */
export async function getTwitterConfig(productId?: string): Promise<{ handle?: string; profile?: string } | undefined> {
  const config = await getToolConfig('twitter', productId);
  return config ? { handle: config.handle, profile: config.cookieProfile } : undefined;
}

/**
 * Get LinkedIn config for a product  
 */
export async function getLinkedInConfig(productId?: string): Promise<{ urn?: string; token?: string } | undefined> {
  const config = await getToolConfig('linkedin', productId);
  return config ? { urn: config.profileUrn, token: config.accessToken } : undefined;
}
