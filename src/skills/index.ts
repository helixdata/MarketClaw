/**
 * Skills System
 * Modular, installable capabilities
 */

export * from './types.js';
export * from './loader.js';
export * from './marketplace.js';

import { skillLoader } from './loader.js';
import { marketplaceTools } from './marketplace.js';
import { toolRegistry } from '../tools/registry.js';

/**
 * Initialize the skills system
 */
export async function initializeSkills(config: Record<string, any> = {}): Promise<void> {
  // Initialize skill loader
  await skillLoader.init(config.skills || {});
  
  // Register marketplace tools
  toolRegistry.registerAll(marketplaceTools, { category: 'utility' });
  
  // Load enabled skills
  await skillLoader.loadAll();
}
