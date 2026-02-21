/**
 * Channels Index
 * Exports channel registry and all available channels
 */

export * from './types.js';
export * from './registry.js';

// Import channels to register them
import './telegram.js';
import './discord.js';
import './slack.js';
import './cli.js';

// Re-export for direct access
export { telegramChannel } from './telegram.js';
export { discordChannel } from './discord.js';
export { slackChannel } from './slack.js';
export { cliChannel } from './cli.js';
