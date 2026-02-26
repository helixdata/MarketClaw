/**
 * Telegram Tools
 * Tools for sending messages to Telegram users/bots
 */

import { Tool, ToolResult } from './types.js';
import { channelRegistry } from '../channels/index.js';
import { createStructuredLogger } from '../logging/index.js';

const logger = createStructuredLogger('telegram-tools');

// Known contacts for easy reference
const KNOWN_CONTACTS: Record<string, { telegramId: string; description: string }> = {
  'agent-hq': {
    telegramId: '-5124089402', // Agent HQ group - for inter-agent communication
    description: 'Agent HQ (group chat with Nova)',
  },
  'nova': {
    telegramId: '-5124089402', // Send to Agent HQ group where Nova can see it
    description: 'Nova (Clawdbot AI assistant) via Agent HQ group',
  },
  'brett': {
    telegramId: '5900329802',
    description: 'Brett (admin) - direct message',
  },
};

/**
 * Send a message to a Telegram user
 */
const sendTelegramMessage: Tool = {
  name: 'send_telegram_message',
  description: `Send a message to a Telegram user or bot. Use this to communicate with other agents or notify users.
  
Known contacts:
- "nova" - Nova (Clawdbot AI assistant) - for self-improvement discussions, asking questions, getting help
- "brett" - Brett (admin)

You can also use a numeric Telegram user ID directly.`,
  parameters: {
    type: 'object',
    properties: {
      recipient: {
        type: 'string',
        description: 'Recipient name (e.g., "nova", "brett") or numeric Telegram user ID',
      },
      message: {
        type: 'string',
        description: 'Message to send',
      },
    },
    required: ['recipient', 'message'],
  },
  execute: async (args: { recipient: string; message: string }): Promise<ToolResult> => {
    const { recipient, message } = args;
    
    // Resolve recipient to Telegram ID
    let telegramId: string;
    let recipientName: string;
    
    const knownContact = KNOWN_CONTACTS[recipient.toLowerCase()];
    if (knownContact) {
      telegramId = knownContact.telegramId;
      recipientName = knownContact.description;
    } else if (/^\d+$/.test(recipient)) {
      telegramId = recipient;
      recipientName = `User ${recipient}`;
    } else {
      return {
        success: false,
        message: `Unknown recipient "${recipient}". Use a known contact name (nova, brett) or a numeric Telegram ID.`,
      };
    }
    
    // Get Telegram channel
    const telegramChannel = channelRegistry.get('telegram');
    if (!telegramChannel) {
      return {
        success: false,
        message: 'Telegram channel not configured',
      };
    }
    
    try {
      await telegramChannel.send(telegramId, { text: message });
      
      logger.info('Sent Telegram message', { 
        recipient: recipientName, 
        telegramId,
        messagePreview: message.slice(0, 50),
      });
      
      return {
        success: true,
        message: `Message sent to ${recipientName}`,
      };
    } catch (error) {
      logger.error('Failed to send Telegram message', { 
        error: error instanceof Error ? error.message : String(error),
        recipient: recipientName,
        telegramId,
      });
      
      return {
        success: false,
        message: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * List available Telegram contacts
 */
const listTelegramContacts: Tool = {
  name: 'list_telegram_contacts',
  description: 'List known Telegram contacts that you can message',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (): Promise<ToolResult> => {
    const contacts = Object.entries(KNOWN_CONTACTS).map(([name, info]) => ({
      name,
      description: info.description,
    }));
    
    return {
      success: true,
      message: 'Available contacts',
      data: contacts,
    };
  },
};

export const telegramTools: Tool[] = [
  sendTelegramMessage,
  listTelegramContacts,
];
