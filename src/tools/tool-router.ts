/**
 * AI Tool Router
 * Uses a fast LLM call to determine which tool categories are needed
 */

import Anthropic from '@anthropic-ai/sdk';

// Tool category definitions for the router
const TOOL_CATEGORIES = {
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

User message: `;

interface RouterResult {
  categories: string[];
  cached: boolean;
}

// Simple cache to avoid repeated router calls for similar messages
const routerCache = new Map<string, string[]>();

export async function routeMessage(message: string, client: Anthropic): Promise<RouterResult> {
  // Check cache first
  const cacheKey = message.toLowerCase().trim().slice(0, 100);
  if (routerCache.has(cacheKey)) {
    return { categories: routerCache.get(cacheKey)!, cached: true };
  }

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',  // Fast model for routing
      max_tokens: 100,
      messages: [
        { role: 'user', content: ROUTER_PROMPT + message }
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Parse JSON array from response
    const match = text.match(/\[.*\]/s);
    if (match) {
      const categories = JSON.parse(match[0]) as string[];
      // Validate categories
      const validCategories = categories.filter(c => c in TOOL_CATEGORIES);
      
      // Cache the result
      routerCache.set(cacheKey, validCategories);
      
      console.log(`[ToolRouter] Categories for "${message.slice(0, 50)}...": [${validCategories.join(', ')}]`);
      return { categories: validCategories, cached: false };
    }
  } catch (error) {
    console.error('[ToolRouter] Error:', error);
  }

  // Fallback to empty (will use defaults)
  return { categories: [], cached: false };
}

// Export category keys for use in selector
export const CATEGORY_NAMES = Object.keys(TOOL_CATEGORIES);
