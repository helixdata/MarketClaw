/**
 * AI Tool Router
 * Uses a fast LLM call to determine which tool categories are needed
 * Supports multiple providers for flexibility
 */

// Tool category definitions for the router
const TOOL_CATEGORIES: Record<string, string> = {
  a2a: 'Agent-to-agent communication (talking to other AI agents like Nova, sending messages via GopherHole)',
  twitter: 'Twitter/X posting, threads, replies, searching tweets',
  linkedin: 'LinkedIn posts, professional content, B2B outreach',
  email: 'Sending emails, email sequences, outreach',
  calendar: 'Calendar events, scheduling meetings, appointments',
  image: 'Image generation, logos, visuals, creative assets',
  producthunt: 'Product Hunt launches, indie maker marketing',
  browser: 'Web browsing, clicking, navigating websites, screenshots',
  campaign: 'Marketing campaigns, campaign management',
  leads: 'Lead management, CRM, contacts, prospects',
  brand: 'Brand identity, colors, voice, taglines, typography',
  knowledge: 'Storing/recalling information, memory, learning',
  web: 'Web search, research, looking things up online',
  scheduler: 'Scheduling tasks, reminders, recurring jobs',
  product: 'Product management, adding/switching products',
  delegate: 'Delegating tasks to specialist agents (Tweety, Quinn, Emma, etc.)',
  discord: 'Discord messaging, server management',
  telegram: 'Telegram messaging',
};

const ROUTER_PROMPT = `You are a tool router. Given a user message, determine which tool categories are needed.

Available categories:
${Object.entries(TOOL_CATEGORIES).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Respond with ONLY a JSON array of category names needed. Include "delegate" if the user wants to assign work to a specialist.
Be conservative - only include categories that are clearly needed.

Examples:
- "Send a message to Nova" → ["a2a"]
- "Write a tweet about our launch" → ["twitter", "delegate"]
- "Post this to LinkedIn: Hello world" → ["linkedin"]
- "Schedule a reminder for tomorrow" → ["scheduler"]
- "Search for competitors" → ["web"]
- "What agents are available?" → ["a2a"]
- "Switch to GopherHole product" → ["product"]

User message: `;

export interface RouterResult {
  categories: string[];
  cached: boolean;
}

export interface RouterConfig {
  provider: 'anthropic' | 'openai' | 'groq' | 'gemini' | 'openrouter';
  model?: string;  // Override default model for provider
  apiKey?: string;
  authToken?: string;  // For OAuth tokens
}

// Default fast models per provider
const DEFAULT_ROUTER_MODELS: Record<string, string> = {
  anthropic: 'claude-3-5-haiku-20241022',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.1-8b-instant',
  gemini: 'gemini-2.0-flash',
  openrouter: 'anthropic/claude-3-haiku',
};

// Simple cache to avoid repeated router calls for similar messages
const routerCache = new Map<string, string[]>();

/**
 * Generic router that works with any provider
 */
export async function routeMessage(
  message: string, 
  config: RouterConfig
): Promise<RouterResult> {
  // Check cache first
  const cacheKey = message.toLowerCase().trim().slice(0, 100);
  if (routerCache.has(cacheKey)) {
    return { categories: routerCache.get(cacheKey)!, cached: true };
  }

  const model = config.model || DEFAULT_ROUTER_MODELS[config.provider] || 'gpt-4o-mini';
  const prompt = ROUTER_PROMPT + message;

  try {
    let text = '';

    if (config.provider === 'anthropic') {
      text = await routeWithAnthropic(prompt, model, config);
    } else if (config.provider === 'openai' || config.provider === 'openrouter') {
      text = await routeWithOpenAI(prompt, model, config);
    } else if (config.provider === 'groq') {
      text = await routeWithGroq(prompt, model, config);
    } else if (config.provider === 'gemini') {
      text = await routeWithGemini(prompt, model, config);
    } else {
      // Fallback to OpenAI-compatible API
      text = await routeWithOpenAI(prompt, model, config);
    }

    // Parse JSON array from response
    const match = text.match(/\[.*\]/s);
    if (match) {
      const categories = JSON.parse(match[0]) as string[];
      // Validate categories
      const validCategories = categories.filter(c => c in TOOL_CATEGORIES);
      
      // Cache the result
      routerCache.set(cacheKey, validCategories);
      
      console.log(`[ToolRouter] ${config.provider}/${model} → [${validCategories.join(', ')}]`);
      return { categories: validCategories, cached: false };
    }
  } catch (error) {
    console.error('[ToolRouter] Error:', error);
  }

  // Fallback to empty (will use keyword defaults)
  return { categories: [], cached: false };
}

async function routeWithAnthropic(prompt: string, model: string, config: RouterConfig): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  
  const clientOptions: any = {};
  if (config.authToken) {
    // OAuth token mode
    clientOptions.apiKey = null;
    clientOptions.authToken = config.authToken;
    clientOptions.defaultHeaders = {
      'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20',
      'user-agent': 'claude-cli/2.1.44 (external, cli)',
      'x-app': 'cli',
    };
  } else if (config.apiKey) {
    clientOptions.apiKey = config.apiKey;
  }

  const client = new Anthropic(clientOptions);
  const response = await client.messages.create({
    model,
    max_tokens: 100,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}

async function routeWithOpenAI(prompt: string, model: string, config: RouterConfig): Promise<string> {
  const OpenAI = (await import('openai')).default;
  
  const clientOptions: any = { apiKey: config.apiKey };
  if (config.provider === 'openrouter') {
    clientOptions.baseURL = 'https://openrouter.ai/api/v1';
  }

  const client = new OpenAI(clientOptions);
  const response = await client.chat.completions.create({
    model,
    max_tokens: 100,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0]?.message?.content || '';
}

async function routeWithGroq(prompt: string, model: string, config: RouterConfig): Promise<string> {
  // Use OpenAI-compatible API for Groq
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

async function routeWithGemini(prompt: string, model: string, config: RouterConfig): Promise<string> {
  // Use REST API for Gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 100 },
    }),
  });

  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Export category keys for use in selector
export const CATEGORY_NAMES = Object.keys(TOOL_CATEGORIES);
