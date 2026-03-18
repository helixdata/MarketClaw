/**
 * Smart Tool Selector
 * Selects relevant tools based on categories from AI router
 */

import { ToolDefinition } from './types.js';

// Map category names to tool prefixes
const CATEGORY_TO_TOOLS: Record<string, string[]> = {
  a2a: ['a2a_'],
  twitter: ['twitter_', 'post_tweet', 'reply_tweet', 'search_tweets', 'read_tweet', 'get_mentions', 'get_home_timeline'],
  linkedin: ['linkedin_', 'post_to_linkedin', 'draft_linkedin_post', 'get_linkedin_profile', 'check_linkedin_auth'],
  email: ['email_', 'send_email', 'gmail_', 'imap_'],
  calendar: ['calendar_', 'list_calendar', 'create_calendar', 'update_calendar', 'delete_calendar', 'google_calendar'],
  image: ['image_', 'generate_image', 'upload_image', 'list_images'],
  producthunt: ['producthunt_', 'ph_'],
  browser: ['browser_'],
  campaign: ['campaign_', 'create_campaign', 'list_campaign', 'update_campaign'],
  leads: ['lead_', 'add_lead', 'list_lead', 'update_lead'],
  brand: ['brand_', 'set_brand', 'get_brand', 'clear_brand'],
  knowledge: ['knowledge_', 'remember', 'recall', 'search_knowledge', 'add_knowledge'],
  web: ['web_', 'search_web', 'fetch_url'],
  scheduler: ['scheduler_', 'schedule_', 'create_task', 'list_task', 'cancel_task', 'pause_task', 'resume_task', 'run_job'],
  product: ['product_', 'add_product', 'list_product', 'set_active_product', 'get_active_product'],
  delegate: ['delegate_'],
  discord: ['discord_'],
  telegram: ['telegram_', 'tg_'],
  cost: ['cost_', 'track_cost', 'get_cost'],
};

// Core tools always included (essential for basic operation)
const CORE_TOOLS = [
  'delegate_task',
  'list_products', 
  'get_active_product',
  'set_active_product',  // Must be able to switch products
];

// Maximum tools (lower limit for OAuth token compatibility)
const MAX_TOOLS = 16;

/**
 * Select tools based on category list from AI router
 */
export function selectToolsByCategories(categories: string[], allTools: ToolDefinition[]): ToolDefinition[] {
  const includePrefixes: string[] = [];
  
  // Add prefixes for each category
  for (const cat of categories) {
    const prefixes = CATEGORY_TO_TOOLS[cat];
    if (prefixes) {
      includePrefixes.push(...prefixes);
    }
  }
  
  // Always include core tools
  const coreToolNames = new Set(CORE_TOOLS);
  
  // Filter tools
  const selectedTools = allTools.filter(tool => {
    const name = tool.name.toLowerCase();
    
    // Include if it's a core tool
    if (coreToolNames.has(tool.name)) return true;
    
    // Include if it matches any prefix
    return includePrefixes.some(prefix => 
      name.startsWith(prefix.toLowerCase())
    );
  });
  
  // Apply max limit
  if (selectedTools.length > MAX_TOOLS) {
    console.log(`[ToolSelector] Limiting from ${selectedTools.length} to ${MAX_TOOLS}`);
    return selectedTools.slice(0, MAX_TOOLS);
  }
  
  console.log(`[ToolSelector] Selected ${selectedTools.length} tools for [${categories.join(', ')}]: ${selectedTools.map(t => t.name).join(', ')}`);
  
  return selectedTools;
}

/**
 * Fallback keyword-based selection (when AI router not available)
 */
export function selectTools(message: string, allTools: ToolDefinition[]): ToolDefinition[] {
  const messageLower = message.toLowerCase();
  const categories: string[] = [];
  
  // Simple keyword matching
  const keywordMap: Record<string, string[]> = {
    a2a: ['a2a', 'agent', 'gopherhole', 'nova', 'send to agent'],
    twitter: ['tweet', 'twitter', 'x.com'],
    linkedin: ['linkedin'],
    email: ['email', 'mail'],
    calendar: ['calendar', 'meeting', 'event'],
    image: ['image', 'picture', 'generate image'],
    browser: ['browse', 'website', 'click'],
    web: ['search', 'look up', 'find', 'scrape', 'fetch', 'url', 'website', 'check out', '.com', '.ai', '.io', '.dev', '.org', '.net'],
    scheduler: ['schedule', 'remind', 'task'],
    delegate: ['delegate', 'assign', 'tweety', 'quinn', 'emma', 'pixel'],
    product: ['product', 'switch to', 'work on', 'focus on', 'active product'],
    brand: ['brand', 'tagline', 'identity', 'voice'],
    campaign: ['campaign', 'launch', 'marketing'],
    knowledge: ['remember', 'recall', 'knowledge', 'context'],
  };
  
  for (const [cat, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => messageLower.includes(kw))) {
      categories.push(cat);
    }
  }
  
  // If no matches, use minimal default set
  if (categories.length === 0) {
    categories.push('knowledge', 'product');
  }
  
  return selectToolsByCategories(categories, allTools);
}
