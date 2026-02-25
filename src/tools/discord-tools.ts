/**
 * Discord Tools
 * Post to channels, list servers/channels, and manage Discord interactions
 */

import { Tool, ToolResult } from './types.js';
import { channelRegistry } from '../channels/index.js';
import { DiscordChannel } from '../channels/discord.js';

/**
 * Get the Discord channel instance
 */
function getDiscordChannel(): DiscordChannel | null {
  const channel = channelRegistry.get('discord');
  if (channel && channel.name === 'discord') {
    return channel as DiscordChannel;
  }
  return null;
}

/**
 * List Discord servers and channels the bot can access
 */
export const discordListChannelsTool: Tool = {
  name: 'discord_list_channels',
  description: 'List Discord servers (guilds) and channels the bot can access. Use this to find channel IDs for posting.',
  parameters: {
    type: 'object',
    properties: {
      guildId: {
        type: 'string',
        description: 'Optional: filter to a specific server/guild ID',
      },
      type: {
        type: 'string',
        enum: ['text', 'voice', 'all'],
        description: 'Filter by channel type (default: text)',
      },
    },
    required: [],
  },
  execute: async (params: { guildId?: string; type?: string }): Promise<ToolResult> => {
    const discord = getDiscordChannel();
    if (!discord) {
      return { success: false, message: 'Discord channel not configured or not running' };
    }

    const client = discord.getClient();
    if (!client || !client.isReady()) {
      return { success: false, message: 'Discord bot not connected' };
    }

    const filterType = params.type || 'text';
    const results: Array<{
      guild: { id: string; name: string };
      channels: Array<{ id: string; name: string; type: string }>;
    }> = [];

    for (const guild of client.guilds.cache.values()) {
      if (params.guildId && guild.id !== params.guildId) continue;

      const channels: Array<{ id: string; name: string; type: string }> = [];

      for (const channel of guild.channels.cache.values()) {
        const channelType = channel.type === 0 ? 'text' : 
                           channel.type === 2 ? 'voice' : 
                           channel.type === 5 ? 'announcement' :
                           channel.type === 15 ? 'forum' : 'other';

        if (filterType === 'all' || 
            (filterType === 'text' && (channel.type === 0 || channel.type === 5)) ||
            (filterType === 'voice' && channel.type === 2)) {
          channels.push({
            id: channel.id,
            name: channel.name,
            type: channelType,
          });
        }
      }

      if (channels.length > 0) {
        results.push({
          guild: { id: guild.id, name: guild.name },
          channels: channels.sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
    }

    if (results.length === 0) {
      return { 
        success: true, 
        message: 'No accessible servers/channels found. Make sure the bot is invited to a server.',
      };
    }

    return { success: true, message: 'Found servers and channels', data: results };
  },
};

/**
 * Post a message to a Discord channel
 */
export const discordPostTool: Tool = {
  name: 'discord_post',
  description: 'Post a message to a specific Discord channel. Requires the channel ID (use discord_list_channels to find it).',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'The Discord channel ID to post to',
      },
      message: {
        type: 'string',
        description: 'The message content to post (supports Discord markdown)',
      },
      embed: {
        type: 'object',
        description: 'Optional embed object with title, description, color, fields, etc.',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'number', description: 'Decimal color value (e.g., 0x00ff00 for green)' },
          url: { type: 'string' },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
                inline: { type: 'boolean' },
              },
            },
          },
          footer: {
            type: 'object',
            properties: {
              text: { type: 'string' },
            },
          },
          timestamp: { type: 'string', description: 'ISO timestamp' },
        },
      },
    },
    required: ['channelId', 'message'],
  },
  execute: async (params: { 
    channelId: string; 
    message: string; 
    embed?: {
      title?: string;
      description?: string;
      color?: number;
      url?: string;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: { text: string };
      timestamp?: string;
    };
  }): Promise<ToolResult> => {
    const discord = getDiscordChannel();
    if (!discord) {
      return { success: false, message: 'Discord channel not configured or not running' };
    }

    const client = discord.getClient();
    if (!client || !client.isReady()) {
      return { success: false, message: 'Discord bot not connected' };
    }

    try {
      const channel = await client.channels.fetch(params.channelId);
      if (!channel || !channel.isTextBased()) {
        return { success: false, message: 'Channel not found or not a text channel' };
      }

      const messageOptions: { content: string; embeds?: any[] } = {
        content: params.message,
      };

      if (params.embed) {
        messageOptions.embeds = [params.embed];
      }

      const sent = await (channel as any).send(messageOptions);

      return {
        success: true,
        message: 'Message posted successfully',
        data: {
          messageId: sent.id,
          channelId: params.channelId,
          content: params.message,
          url: sent.url,
        },
      };
    } catch (err) {
      return { 
        success: false, 
        message: `Failed to post: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

/**
 * Read recent messages from a Discord channel
 */
export const discordReadChannelTool: Tool = {
  name: 'discord_read_channel',
  description: 'Read recent messages from a Discord channel. Useful for monitoring or catching up on conversations.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'The Discord channel ID to read from',
      },
      limit: {
        type: 'number',
        description: 'Number of messages to fetch (default: 10, max: 100)',
      },
      before: {
        type: 'string',
        description: 'Optional: fetch messages before this message ID',
      },
    },
    required: ['channelId'],
  },
  execute: async (params: { channelId: string; limit?: number; before?: string }): Promise<ToolResult> => {
    const discord = getDiscordChannel();
    if (!discord) {
      return { success: false, message: 'Discord channel not configured or not running' };
    }

    const client = discord.getClient();
    if (!client || !client.isReady()) {
      return { success: false, message: 'Discord bot not connected' };
    }

    try {
      const channel = await client.channels.fetch(params.channelId);
      if (!channel || !channel.isTextBased()) {
        return { success: false, message: 'Channel not found or not a text channel' };
      }

      const limit = Math.min(params.limit || 10, 100);
      const options: { limit: number; before?: string } = { limit };
      if (params.before) options.before = params.before;

      const messages = await (channel as any).messages.fetch(options);

      const result = messages.map((msg: any) => ({
        id: msg.id,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          bot: msg.author.bot,
        },
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        attachments: msg.attachments.map((a: any) => ({ name: a.name, url: a.url })),
        embeds: msg.embeds.length,
      }));

      return {
        success: true,
        message: `Fetched ${result.length} messages`,
        data: {
          channelId: params.channelId,
          messages: result.reverse(), // Chronological order
        },
      };
    } catch (err) {
      return { 
        success: false, 
        message: `Failed to read channel: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

/**
 * React to a Discord message
 */
export const discordReactTool: Tool = {
  name: 'discord_react',
  description: 'Add a reaction emoji to a Discord message.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'The channel ID where the message is',
      },
      messageId: {
        type: 'string',
        description: 'The message ID to react to',
      },
      emoji: {
        type: 'string',
        description: 'The emoji to react with (e.g., "👍", "🎉", or custom emoji ID)',
      },
    },
    required: ['channelId', 'messageId', 'emoji'],
  },
  execute: async (params: { channelId: string; messageId: string; emoji: string }): Promise<ToolResult> => {
    const discord = getDiscordChannel();
    if (!discord) {
      return { success: false, message: 'Discord channel not configured or not running' };
    }

    const client = discord.getClient();
    if (!client || !client.isReady()) {
      return { success: false, message: 'Discord bot not connected' };
    }

    try {
      const channel = await client.channels.fetch(params.channelId);
      if (!channel || !channel.isTextBased()) {
        return { success: false, message: 'Channel not found or not a text channel' };
      }

      const message = await (channel as any).messages.fetch(params.messageId);
      await message.react(params.emoji);

      return {
        success: true,
        message: `Reacted with ${params.emoji} to message ${params.messageId}`,
      };
    } catch (err) {
      return { 
        success: false, 
        message: `Failed to react: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

/**
 * Get server/guild info
 */
export const discordServerInfoTool: Tool = {
  name: 'discord_server_info',
  description: 'Get information about a Discord server (guild) including member count, roles, etc.',
  parameters: {
    type: 'object',
    properties: {
      guildId: {
        type: 'string',
        description: 'The server/guild ID to get info for',
      },
    },
    required: ['guildId'],
  },
  execute: async (params: { guildId: string }): Promise<ToolResult> => {
    const discord = getDiscordChannel();
    if (!discord) {
      return { success: false, message: 'Discord channel not configured or not running' };
    }

    const client = discord.getClient();
    if (!client || !client.isReady()) {
      return { success: false, message: 'Discord bot not connected' };
    }

    try {
      const guild = await client.guilds.fetch(params.guildId);
      
      return {
        success: true,
        message: `Server info for ${guild.name}`,
        data: {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
          ownerId: guild.ownerId,
          createdAt: guild.createdAt.toISOString(),
          description: guild.description,
          icon: guild.iconURL(),
          roles: guild.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
          channels: guild.channels.cache.size,
        },
      };
    } catch (err) {
      return { 
        success: false, 
        message: `Failed to get server info: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

/**
 * Create a new Discord channel
 */
export const discordCreateChannelTool: Tool = {
  name: 'discord_create_channel',
  description: 'Create a new text or voice channel in a Discord server. Requires Manage Channels permission.',
  parameters: {
    type: 'object',
    properties: {
      guildId: {
        type: 'string',
        description: 'The server/guild ID to create the channel in',
      },
      name: {
        type: 'string',
        description: 'The channel name (will be lowercase with hyphens for text channels)',
      },
      type: {
        type: 'string',
        enum: ['text', 'voice', 'announcement'],
        description: 'Channel type (default: text)',
      },
      topic: {
        type: 'string',
        description: 'Optional channel topic/description (text channels only)',
      },
      categoryId: {
        type: 'string',
        description: 'Optional category/parent ID to place the channel under',
      },
      private: {
        type: 'boolean',
        description: 'Make the channel private (only visible to admins initially)',
      },
    },
    required: ['guildId', 'name'],
  },
  execute: async (params: { 
    guildId: string; 
    name: string; 
    type?: string;
    topic?: string;
    categoryId?: string;
    private?: boolean;
  }): Promise<ToolResult> => {
    const discord = getDiscordChannel();
    if (!discord) {
      return { success: false, message: 'Discord channel not configured or not running' };
    }

    const client = discord.getClient();
    if (!client || !client.isReady()) {
      return { success: false, message: 'Discord bot not connected' };
    }

    try {
      const guild = await client.guilds.fetch(params.guildId);
      
      // Map type string to Discord channel type
      const channelType = params.type === 'voice' ? 2 : 
                         params.type === 'announcement' ? 5 : 0; // 0 = text
      
      const channelOptions: any = {
        name: params.name,
        type: channelType,
      };
      
      if (params.topic && channelType === 0) {
        channelOptions.topic = params.topic;
      }
      
      if (params.categoryId) {
        channelOptions.parent = params.categoryId;
      }
      
      if (params.private) {
        // Make channel private by denying @everyone view permission
        channelOptions.permissionOverwrites = [
          {
            id: guild.id, // @everyone role has same ID as guild
            deny: ['ViewChannel'],
          },
        ];
      }
      
      const newChannel = await guild.channels.create(channelOptions);
      
      return {
        success: true,
        message: `Created channel #${newChannel.name}`,
        data: {
          id: newChannel.id,
          name: newChannel.name,
          type: params.type || 'text',
          guildId: params.guildId,
          url: `https://discord.com/channels/${params.guildId}/${newChannel.id}`,
        },
      };
    } catch (err) {
      return { 
        success: false, 
        message: `Failed to create channel: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

/**
 * Delete a Discord channel
 */
export const discordDeleteChannelTool: Tool = {
  name: 'discord_delete_channel',
  description: 'Delete a Discord channel. Requires Manage Channels permission. Use with caution!',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'The channel ID to delete',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for the audit log',
      },
    },
    required: ['channelId'],
  },
  execute: async (params: { channelId: string; reason?: string }): Promise<ToolResult> => {
    const discord = getDiscordChannel();
    if (!discord) {
      return { success: false, message: 'Discord channel not configured or not running' };
    }

    const client = discord.getClient();
    if (!client || !client.isReady()) {
      return { success: false, message: 'Discord bot not connected' };
    }

    try {
      const channel = await client.channels.fetch(params.channelId);
      if (!channel) {
        return { success: false, message: 'Channel not found' };
      }
      
      const channelName = (channel as any).name || params.channelId;
      await (channel as any).delete(params.reason);
      
      return {
        success: true,
        message: `Deleted channel #${channelName}`,
      };
    } catch (err) {
      return { 
        success: false, 
        message: `Failed to delete channel: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

/**
 * Edit a Discord channel
 */
export const discordEditChannelTool: Tool = {
  name: 'discord_edit_channel',
  description: 'Edit a Discord channel (rename, change topic, etc.). Requires Manage Channels permission.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'The channel ID to edit',
      },
      name: {
        type: 'string',
        description: 'New channel name',
      },
      topic: {
        type: 'string',
        description: 'New channel topic/description',
      },
      nsfw: {
        type: 'boolean',
        description: 'Mark channel as NSFW',
      },
      slowmode: {
        type: 'number',
        description: 'Slowmode delay in seconds (0 to disable)',
      },
    },
    required: ['channelId'],
  },
  execute: async (params: { 
    channelId: string; 
    name?: string;
    topic?: string;
    nsfw?: boolean;
    slowmode?: number;
  }): Promise<ToolResult> => {
    const discord = getDiscordChannel();
    if (!discord) {
      return { success: false, message: 'Discord channel not configured or not running' };
    }

    const client = discord.getClient();
    if (!client || !client.isReady()) {
      return { success: false, message: 'Discord bot not connected' };
    }

    try {
      const channel = await client.channels.fetch(params.channelId);
      if (!channel || !('edit' in channel)) {
        return { success: false, message: 'Channel not found or cannot be edited' };
      }
      
      const editOptions: any = {};
      if (params.name) editOptions.name = params.name;
      if (params.topic !== undefined) editOptions.topic = params.topic;
      if (params.nsfw !== undefined) editOptions.nsfw = params.nsfw;
      if (params.slowmode !== undefined) editOptions.rateLimitPerUser = params.slowmode;
      
      const edited = await (channel as any).edit(editOptions);
      
      return {
        success: true,
        message: `Updated channel #${edited.name}`,
        data: {
          id: edited.id,
          name: edited.name,
          topic: edited.topic,
        },
      };
    } catch (err) {
      return { 
        success: false, 
        message: `Failed to edit channel: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// Export all Discord tools
export const discordTools: Tool[] = [
  discordListChannelsTool,
  discordPostTool,
  discordReadChannelTool,
  discordReactTool,
  discordServerInfoTool,
  discordCreateChannelTool,
  discordDeleteChannelTool,
  discordEditChannelTool,
];
