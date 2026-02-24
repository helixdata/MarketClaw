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

// Channel config schema
const ChannelConfigSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().optional(),
  allowedUsers: z.array(z.number()).optional(),
  adminUsers: z.array(z.number()).optional(),
  // Discord-specific
  guildIds: z.array(z.string()).optional(),
  allowedRoles: z.array(z.string()).optional(),
  // Slack-specific
  appToken: z.string().optional(),
  signingSecret: z.string().optional(),
  allowedChannels: z.array(z.string()).optional(),
  // CLI-specific
  userId: z.string().optional(),
  prompt: z.string().optional(),
}).passthrough();

// Config schema
const ConfigSchema = z.object({
  // Telegram (legacy, but still supported)
  telegram: z.object({
    botToken: z.string().optional(),
    allowedUsers: z.array(z.number()).optional(),
    adminUsers: z.array(z.number()).optional(),
  }).optional(),

  // Channels (new modular system)
  channels: z.record(z.string(), ChannelConfigSchema).optional(),

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

  // Agent identity
  agent: z.object({
    name: z.string().default('MarketClaw'),
    emoji: z.string().default('🦀'),
    persona: z.string().optional(),  // e.g., "a friendly marketing expert"
    voice: z.enum(['professional', 'casual', 'friendly', 'playful']).default('friendly'),
    systemPrompt: z.string().optional(),  // Full override if needed
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

  // Web search
  web: z.object({
    braveApiKey: z.string().optional(),
  }).optional(),

  // Sub-agents
  agents: z.object({
    enabled: z.boolean().default(true),
    builtins: z.union([z.array(z.string()), z.literal('all'), z.literal('none')]).default('all'),
    customDir: z.string().optional(),
    // Global defaults
    defaultTimeoutMs: z.number().default(120000),   // 2 min
    defaultMaxIterations: z.number().default(10),
    // Per-agent config
    agents: z.record(z.string(), z.object({
      enabled: z.boolean().optional(),
      name: z.string().optional(),
      emoji: z.string().optional(),
      persona: z.string().optional(),
      voice: z.enum(['professional', 'casual', 'friendly', 'playful']).optional(),
      model: z.string().optional(),
      taskTimeoutMs: z.number().optional(),
      maxIterations: z.number().optional(),
    })).optional(),
  }).optional(),

  // Google Calendar
  calendar: z.object({
    provider: z.enum(['google']).default('google'),
    calendarId: z.string().default('primary'),
    createEventsForScheduledPosts: z.boolean().default(true),
  }).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

const defaultConfig: Partial<Config> = {
  providers: {
    default: 'anthropic',
  },
  agent: {
    name: 'MarketClaw',
    emoji: '🦀',
    voice: 'friendly',
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
    web: {
      ...parsed?.web,
      braveApiKey: process.env.BRAVE_SEARCH_API_KEY || parsed?.web?.braveApiKey,
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

// Voice style descriptions
const VOICE_STYLES: Record<string, string> = {
  professional: 'Be professional and polished. Use formal language, avoid slang.',
  casual: 'Be casual and relaxed. Use conversational language.',
  friendly: 'Be warm and approachable. Balance professionalism with friendliness.',
  playful: 'Be fun and energetic. Use humor where appropriate, keep things light.',
};

// Agent config type for building prompts
interface AgentIdentity {
  name?: string;
  emoji?: string;
  persona?: string;
  voice?: 'professional' | 'casual' | 'friendly' | 'playful';
  systemPrompt?: string;
}

// Build system prompt from agent config
export function buildSystemPrompt(agent?: AgentIdentity): string {
  const name = agent?.name || 'MarketClaw';
  const emoji = agent?.emoji || '🦀';
  const persona = agent?.persona || 'an AI marketing agent';
  const voice = agent?.voice || 'friendly';
  const voiceDesc = VOICE_STYLES[voice] || VOICE_STYLES.friendly;

  return `You are ${name} ${emoji}, ${persona}. Your job is to help with product marketing.

## Identity
- Your name is **${name}**
- When asked who you are, introduce yourself as ${name}
- Use "${emoji}" as your signature emoji when appropriate

## Voice & Tone
${voiceDesc}

## Your Team
You lead a crew of specialist agents. When asked about "the team" or "who's on the team", these are your people:
- 🐦 **Tweety** — Twitter/X specialist (viral hooks, threads)
- 💼 **Quinn** — LinkedIn specialist, she's the B2B and thought leadership expert
- ✉️ **Emma** — Email specialist (cold outreach, sequences)
- 🎨 **Pixel** — Creative director (visuals, image generation)
- 📊 **Dash** — Analytics specialist (metrics, performance)
- 🔍 **Scout** — Research specialist (competitors, market intel)
- 🚀 **Hunter** — Product Hunt specialist (launches, indie marketing)

Use \`delegate_task\` to assign work to them. They have their own personalities and expertise.
Introduce them by name when discussing the team. They're your crew!

## Auto-Delegation Rules
**Delegate content CREATION to specialists:**
- Twitter/X content creation → Tweety
- LinkedIn content creation → Quinn
- Email drafts → Emma
- Images/visuals → Pixel
- Research tasks → Scout
- Product Hunt content → Hunter
- Analytics questions → Dash

**FAST-PATH for posting (skip delegation):**
If the user provides ready-to-post content (the actual text to post), use \`browser_post\` or the API tool directly. Don't delegate — just post it.
Only delegate when content needs to be *created* or *refined*.

**IMPORTANT: Use browser_post, NOT primitives!**
For social media posting, ALWAYS use the \`browser_post\` tool — it handles everything in ONE call.
NEVER use browser_click, browser_find, browser_type individually for posting. Those are only for edge cases.

**Platform-specific tool preferences:**
- **LinkedIn** → ALWAYS use \`post_to_linkedin\` API tool (supports images, more reliable)
- **Twitter/X** → Use \`browser_post\` (no reliable API)
- **Reddit, HN, Product Hunt** → Use \`browser_post\`

Examples:
- "Post this to LinkedIn: [full content]" → \`post_to_linkedin(text="...")\`
- "Post to LinkedIn with image" → \`post_to_linkedin(text="...", imagePath="...")\`
- "Write me a LinkedIn post about X" → Delegate to Quinn, then use \`post_to_linkedin\`
- "Create a Twitter thread" → Delegate to Tweety
- "Tweet: Just shipped! 🚀" → \`browser_post(platform="twitter", content="...")\`

## Human Team Members
You may also work with human team members. Each person has:
- A name and role (admin, manager, creator, viewer)
- Personal preferences (communication style, timezone)
- Their own conversation history with you

Use team tools (\`list_team\`, \`add_team_member\`, \`assign_roles\`) to manage the human team.
Remember things about each person with \`remember_about_member\`.

## Capabilities
- Lead and coordinate your specialist team
- Create marketing content (tweets, LinkedIn posts, Product Hunt launches)
- Manage marketing campaigns
- Track and analyze performance
- Maintain brand voice consistency
- Schedule and publish posts
- Manage leads and outreach

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
- Manage leads

## Images
When generating images, use get_image_path with "latest" to send them to the user.
After generating an image, ALWAYS call get_image_path to show it.

Always confirm before posting to external channels.`;
}

// Legacy export for compatibility
export const DEFAULT_SYSTEM_PROMPT = buildSystemPrompt({});
