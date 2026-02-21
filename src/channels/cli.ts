/**
 * CLI Channel
 * Interact with MarketClaw via command line (for testing/local use)
 */

import * as readline from 'readline';
import { Channel, ChannelConfig, ChannelMessage, ChannelResponse } from './types.js';
import { channelRegistry } from './registry.js';
import pino from 'pino';

const logger = pino({ name: 'cli' });

export interface CLIConfig extends ChannelConfig {
  userId?: string;
  prompt?: string;
}

export class CLIChannel implements Channel {
  readonly name = 'cli';
  readonly displayName = 'CLI';
  readonly description = 'Interact with MarketClaw via command line (local testing)';
  readonly requiredConfig: string[] = [];
  readonly optionalConfig = ['userId', 'prompt'];

  private config: CLIConfig | null = null;
  private rl: readline.Interface | null = null;
  private userId = 'cli-user';

  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config as CLIConfig;
    this.userId = this.config.userId || 'cli-user';
    logger.info('CLI channel initialized');
  }

  async start(): Promise<void> {
    const prompt = this.config?.prompt || '🦀 > ';
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\n🦀 MarketClaw CLI Mode');
    console.log('Type your message and press Enter. Use "exit" or Ctrl+C to quit.\n');

    const askQuestion = (): void => {
      this.rl!.question(prompt, async (input) => {
        const text = input.trim();
        
        if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
          await this.stop();
          process.exit(0);
        }

        if (!text) {
          askQuestion();
          return;
        }

        const message: ChannelMessage = {
          id: String(Date.now()),
          userId: this.userId,
          text,
          timestamp: new Date(),
        };

        try {
          const handler = channelRegistry.getMessageHandler();
          if (!handler) {
            console.log('\n⚠️ Agent not configured.\n');
            askQuestion();
            return;
          }

          const response = await handler(this, message);
          
          if (response) {
            console.log(`\n${response.text}\n`);
          }
        } catch (error) {
          console.log(`\n❌ Error: ${error}\n`);
        }

        askQuestion();
      });
    };

    askQuestion();
  }

  async stop(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    logger.info('CLI channel stopped');
  }

  async send(userId: string, response: ChannelResponse): Promise<void> {
    console.log(`\n${response.text}\n`);
  }

  isConfigured(): boolean {
    return true; // CLI is always available
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }
}

// Create and register the channel
export const cliChannel = new CLIChannel();
channelRegistry.register(cliChannel);
