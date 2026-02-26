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
import './a2a.js';

// Re-export for direct access
export { telegramChannel } from './telegram.js';
export { discordChannel, DiscordChannel } from './discord.js';
export { slackChannel } from './slack.js';
export { cliChannel } from './cli.js';
export { a2aChannel, A2AChannel } from './a2a.js';
