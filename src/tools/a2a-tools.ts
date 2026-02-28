/**
 * A2A Tools
 * Tools for interacting with other AI agents via A2A protocol
 */

import { Tool, ToolResult } from './types.js';
import { a2aChannel } from '../channels/a2a.js';

/**
 * List connected A2A agents
 */
const listAgentsTool: Tool = {
  name: 'a2a_list_agents',
  description: 'List all connected A2A agents including local bridge and GopherHole connections',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (): Promise<ToolResult> => {
    try {
      const agents = a2aChannel.listAgents();
      const gopherHoleConnected = a2aChannel.isGopherHoleConnected();
      
      return {
        success: true,
        message: `Found ${agents.filter(a => a.connected).length} connected agents`,
        data: {
          agents,
          gopherHoleConnected,
          totalConnected: agents.filter(a => a.connected).length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  },
};

/**
 * Send message to an agent
 */
const sendToAgentTool: Tool = {
  name: 'a2a_send',
  description: 'Send a message to another AI agent via A2A protocol and wait for a response',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'ID of the target agent (e.g., "nova", "openclaw", "bridge")',
      },
      message: {
        type: 'string',
        description: 'Message to send to the agent',
      },
      viaGopherHole: {
        type: 'boolean',
        description: 'Send via GopherHole hub instead of direct connection (for remote agents)',
      },
    },
    required: ['agentId', 'message'],
  },
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const agentId = params.agentId as string;
      const message = params.message as string;
      const viaGopherHole = params.viaGopherHole as boolean | undefined;

      let response;
      if (viaGopherHole) {
        response = await a2aChannel.sendViaGopherHole(agentId, message);
      } else {
        response = await a2aChannel.sendToAgent(agentId, message);
      }

      return {
        success: true,
        message: `Got response from ${agentId}`,
        data: {
          agentId,
          response: response.text,
          status: response.status,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  },
};

/**
 * Ask another agent to perform a task
 */
const askAgentTool: Tool = {
  name: 'a2a_ask',
  description: 'Ask another AI agent to help with a task. Useful for delegating specialized work.',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'ID of the target agent',
      },
      task: {
        type: 'string',
        description: 'Description of the task you want the agent to perform',
      },
      context: {
        type: 'string',
        description: 'Optional context or background information for the task',
      },
    },
    required: ['agentId', 'task'],
  },
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const agentId = params.agentId as string;
      const task = params.task as string;
      const context = params.context as string | undefined;

      // Format the request
      const prompt = context 
        ? `Context: ${context}\n\nTask: ${task}`
        : task;

      // Try GopherHole first if connected, otherwise direct
      let response;
      if (a2aChannel.isGopherHoleConnected()) {
        try {
          response = await a2aChannel.sendViaGopherHole(agentId, prompt);
        } catch {
          // Fall back to direct connection
          response = await a2aChannel.sendToAgent(agentId, prompt);
        }
      } else {
        response = await a2aChannel.sendToAgent(agentId, prompt);
      }

      return {
        success: true,
        message: `Task completed by ${agentId}`,
        data: {
          agentId,
          task,
          response: response.text,
          status: response.status,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  },
};

/**
 * Discover available agents via GopherHole
 */
const discoverAgentsTool: Tool = {
  name: 'a2a_discover',
  description: 'Discover available agents on the GopherHole network',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (): Promise<ToolResult> => {
    try {
      const agents = await a2aChannel.discoverAgents();
      
      return {
        success: true,
        message: `Discovered ${agents.length} agents`,
        data: {
          agents,
          count: agents.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  },
};

export const a2aTools: Tool[] = [
  listAgentsTool,
  sendToAgentTool,
  askAgentTool,
  discoverAgentsTool,
];
