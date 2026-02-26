/**
 * Tools Index
 * Exports registry and registers all built-in tools
 */

export * from './types.js';
export * from './registry.js';

import { toolRegistry } from './registry.js';
import { schedulerTools } from './scheduler-tools.js';
import { knowledgeTools } from './knowledge-tools.js';
import { linkedInTools } from './linkedin-tools.js';
import { imageTools } from './image-tools.js';
import { twitterTools } from './twitter-tools.js';
import { productHuntTools } from './producthunt-tools.js';
import { emailTools } from './email-tools.js';
import { imapTools } from './imap-tools.js';
import { configTools } from './config-tools.js';
import { leadsTools } from './leads-tools.js';
import { costTools } from '../costs/tools.js';
import { brandTools } from './brand-tools.js';
import { imageLibraryTools } from './image-library-tools.js';
import { webTools } from './web-tools.js';
import { campaignTools } from './campaign-tools.js';
import { calendarTools } from './calendar-tools.js';
import { productTools } from './product-tools.js';
import { discordTools } from './discord-tools.js';
import { telegramTools } from './telegram-tools.js';

/**
 * Initialize all built-in tools
 */
export async function initializeTools(): Promise<void> {
  // Register scheduler tools
  toolRegistry.registerAll(schedulerTools, { category: 'scheduling' });
  
  // Register knowledge tools
  toolRegistry.registerAll(knowledgeTools, { category: 'knowledge' });
  
  // Register LinkedIn tools
  toolRegistry.registerAll(linkedInTools, { category: 'social' });
  
  // Register Twitter tools
  toolRegistry.registerAll(twitterTools, { category: 'social' });
  
  // Register Product Hunt tools
  toolRegistry.registerAll(productHuntTools, { category: 'marketing' });
  
  // Register image generation tools
  toolRegistry.registerAll(imageTools, { category: 'marketing' });
  
  // Register email tools (outbound)
  toolRegistry.registerAll(emailTools, { category: 'marketing' });
  
  // Register IMAP tools (inbound email via Himalaya)
  toolRegistry.registerAll(imapTools, { category: 'marketing' });
  
  // Register config tools (per-product settings)
  toolRegistry.registerAll(configTools, { category: 'utility' });
  
  // Register leads tools (CRM-lite)
  toolRegistry.registerAll(leadsTools, { category: 'marketing' });
  
  // Register cost tracking tools
  toolRegistry.registerAll(costTools, { category: 'utility' });
  
  // Register brand identity tools
  toolRegistry.registerAll(brandTools, { category: 'marketing' });
  
  // Register image library tools
  toolRegistry.registerAll(imageLibraryTools, { category: 'marketing' });
  
  // Register web search tools
  toolRegistry.registerAll(webTools, { category: 'research' });
  
  // Register campaign management tools
  toolRegistry.registerAll(campaignTools, { category: 'marketing' });
  
  // Register Google Calendar tools
  toolRegistry.registerAll(calendarTools, { category: 'scheduling' });
  
  // Register product CRUD tools
  toolRegistry.registerAll(productTools, { category: 'utility' });
  
  // Register Discord tools
  toolRegistry.registerAll(discordTools, { category: 'social' });
  
  // Register Telegram tools (for messaging other users/bots)
  toolRegistry.registerAll(telegramTools, { category: 'social' });
  
  // Future: auto-discover tools from plugins folder
}

// Re-export for convenience
export { schedulerTools } from './scheduler-tools.js';
export { knowledgeTools } from './knowledge-tools.js';
export { linkedInTools } from './linkedin-tools.js';
export { twitterTools } from './twitter-tools.js';
export { productHuntTools } from './producthunt-tools.js';
export { imageTools } from './image-tools.js';
export { emailTools } from './email-tools.js';
export { imapTools } from './imap-tools.js';
export { configTools } from './config-tools.js';
export { leadsTools } from './leads-tools.js';
export { costTools } from '../costs/tools.js';
export { brandTools } from './brand-tools.js';
export { imageLibraryTools } from './image-library-tools.js';
export { webTools } from './web-tools.js';
export { campaignTools } from './campaign-tools.js';
export { calendarTools } from './calendar-tools.js';
export { productTools } from './product-tools.js';
export { discordTools } from './discord-tools.js';
export { telegramTools } from './telegram-tools.js';
