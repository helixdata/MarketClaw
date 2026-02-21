/**
 * Configuration System
 * Loads from config file, env vars, and CLI args
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import YAML from 'yaml';
import { z } from 'zod';

const CONFIG_DIR = path.join(homedir(), '.marketclaw');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

// Config schema
const ConfigSchema = z.object({
  // Telegram
  telegram: z.object({
    botToken: z.string().optional(),
    allowedUsers: z.array(z.number()).optional(),
    adminUsers: z.array(z.number()).optional(),
  }).optional(),

  // Providers
  providers: z.object({
    default: z.string().default('anthropic'),
    anthropic: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('claude-opus-4-5'),
    }).optional(),
    openai: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('gpt-4o'),
    }).optional(),
  }).optional(),

  // Agent
  agent: z.object({
    name: z.string().default('MarketClaw'),
    systemPrompt: z.string().optional(),
  }).optional(),

  // Marketing channels (for posting, not chat)
  marketing: z.object({
    twitter: z.object({
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      accessToken: z.string().optional(),
      accessSecret: z.string().optional(),
    }).optional(),
    linkedin: z.object({
      accessToken: z.string().optional(),
    }).optional(),
    producthunt: z.object({
      developerToken: z.string().optional(),
    }).optional(),
  }).optional(),

  // Workspace
  workspace: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

const defaultConfig: Config = {
  providers: {
    default: 'anthropic',
  },
  agent: {
    name: 'MarketClaw',
  },
};

async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export async function loadConfig(): Promise<Config> {
  await ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return defaultConfig;
  }

  const content = await readFile(CONFIG_FILE, 'utf-8');
  const parsed = YAML.parse(content);
  
  // Merge with env vars
  const config = {
    ...parsed,
    telegram: {
      ...parsed?.telegram,
      botToken: process.env.TELEGRAM_BOT_TOKEN || parsed?.telegram?.botToken,
    },
    providers: {
      ...parsed?.providers,
      anthropic: {
        ...parsed?.providers?.anthropic,
        apiKey: process.env.ANTHROPIC_API_KEY || parsed?.providers?.anthropic?.apiKey,
      },
      openai: {
        ...parsed?.providers?.openai,
        apiKey: process.env.OPENAI_API_KEY || parsed?.providers?.openai?.apiKey,
      },
    },
  };

  return ConfigSchema.parse(config);
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureConfigDir();
  const yaml = YAML.stringify(config);
  await writeFile(CONFIG_FILE, yaml);
}

export async function getConfigPath(): Promise<string> {
  return CONFIG_FILE;
}

// Default system prompt for marketing agent
export const DEFAULT_SYSTEM_PROMPT = `You are MarketClaw, an AI marketing agent. Your job is to help with product marketing.

## Capabilities
- Create marketing content (tweets, LinkedIn posts, Product Hunt launches)
- Manage marketing campaigns
- Track and analyze performance
- Maintain brand voice consistency
- Schedule and publish posts

## Behavior
- Be proactive: suggest improvements, spot opportunities
- Stay on brand: use the brand voice from BRAND.md
- Be concise: marketing copy should be punchy
- Ask clarifying questions when needed
- Remember context: use your persistent memory

## Formatting (Telegram)
- Use **bold** and _italic_ sparingly
- Use bullet lists, NOT tables (Telegram doesn't support tables)
- Keep messages reasonably short
- Use emojis to make things scannable

## Commands
You can be asked to:
- Add products to memory
- Create campaigns
- Draft posts for various channels
- Analyze what's working
- Schedule content
- Generate images and visuals

## Images
When generating images, use get_image_path with "latest" to send them to the user.
After generating an image, ALWAYS call get_image_path to show it.

Always confirm before posting to external channels.`;
