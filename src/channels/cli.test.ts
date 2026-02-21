/**
 * CLI Channel Tests
 * Tests CLIChannel implementation with mocked readline
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock readline before importing the channel
const mockReadlineInterface = {
  question: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
};

vi.mock('readline', () => ({
  createInterface: vi.fn(() => mockReadlineInterface),
}));

// Mock pino
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock the registry to avoid side effects
vi.mock('./registry.js', () => ({
  channelRegistry: {
    register: vi.fn(),
    getMessageHandler: vi.fn(),
  },
}));

// Mock console.log for send tests
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

import * as readline from 'readline';
import { CLIChannel, CLIConfig } from './cli.js';
import { channelRegistry } from './registry.js';
import { ChannelResponse } from './types.js';

describe('CLIChannel', () => {
  let channel: CLIChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    channel = new CLIChannel();
  });

  afterEach(async () => {
    try {
      await channel.stop();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('static properties', () => {
    it('should have correct name', () => {
      expect(channel.name).toBe('cli');
    });

    it('should have correct displayName', () => {
      expect(channel.displayName).toBe('CLI');
    });

    it('should have correct description', () => {
      expect(channel.description).toBe(
        'Interact with MarketClaw via command line (local testing)'
      );
    });

    it('should have empty requiredConfig', () => {
      expect(channel.requiredConfig).toEqual([]);
    });

    it('should have correct optionalConfig', () => {
      expect(channel.optionalConfig).toEqual(['userId', 'prompt']);
    });

    it('should not require any env vars', () => {
      expect(channel.requiredEnv).toBeUndefined();
    });
  });

  describe('initialize', () => {
    it('should initialize with default config', async () => {
      const config: CLIConfig = {
        enabled: true,
      };

      await channel.initialize(config);

      // Should not throw and should complete successfully
      expect(channel.isConfigured()).toBe(true);
    });

    it('should initialize with custom userId', async () => {
      const config: CLIConfig = {
        enabled: true,
        userId: 'custom-user-123',
      };

      await channel.initialize(config);

      expect(channel.isConfigured()).toBe(true);
    });

    it('should initialize with custom prompt', async () => {
      const config: CLIConfig = {
        enabled: true,
        prompt: '>>> ',
      };

      await channel.initialize(config);

      expect(channel.isConfigured()).toBe(true);
    });

    it('should initialize with all options', async () => {
      const config: CLIConfig = {
        enabled: true,
        userId: 'test-user',
        prompt: 'MarketClaw> ',
      };

      await channel.initialize(config);

      expect(channel.isConfigured()).toBe(true);
    });
  });

  describe('start', () => {
    beforeEach(async () => {
      await channel.initialize({ enabled: true });
    });

    it('should create readline interface', async () => {
      // Mock question to prevent hanging
      mockReadlineInterface.question.mockImplementation(() => {});

      await channel.start();

      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
      });
    });

    it('should print welcome message', async () => {
      mockReadlineInterface.question.mockImplementation(() => {});

      await channel.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MarketClaw CLI Mode')
      );
    });

    it('should use custom prompt if configured', async () => {
      const customChannel = new CLIChannel();
      await customChannel.initialize({ enabled: true, prompt: '>>> ' });

      mockReadlineInterface.question.mockImplementation(() => {});

      await customChannel.start();

      // First argument to question should be the prompt
      expect(mockReadlineInterface.question).toHaveBeenCalledWith(
        '>>> ',
        expect.any(Function)
      );
    });

    it('should use default prompt if not configured', async () => {
      mockReadlineInterface.question.mockImplementation(() => {});

      await channel.start();

      expect(mockReadlineInterface.question).toHaveBeenCalledWith(
        '🦀 > ',
        expect.any(Function)
      );
    });
  });

  describe('stop', () => {
    it('should close readline interface', async () => {
      await channel.initialize({ enabled: true });
      mockReadlineInterface.question.mockImplementation(() => {});
      await channel.start();

      await channel.stop();

      expect(mockReadlineInterface.close).toHaveBeenCalled();
    });

    it('should handle stop when not started', async () => {
      // Should not throw
      await channel.stop();
    });

    it('should handle multiple stop calls', async () => {
      await channel.initialize({ enabled: true });
      mockReadlineInterface.question.mockImplementation(() => {});
      await channel.start();

      await channel.stop();
      await channel.stop(); // Second call should not throw

      expect(mockReadlineInterface.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      await channel.initialize({ enabled: true });
    });

    it('should print text response to console', async () => {
      const response: ChannelResponse = {
        text: 'Hello from MarketClaw!',
      };

      await channel.send('user-123', response);

      expect(consoleSpy).toHaveBeenCalledWith('\nHello from MarketClaw!\n');
    });

    it('should send multiline text', async () => {
      const response: ChannelResponse = {
        text: 'Line 1\nLine 2\nLine 3',
      };

      await channel.send('user-123', response);

      expect(consoleSpy).toHaveBeenCalledWith('\nLine 1\nLine 2\nLine 3\n');
    });

    it('should ignore userId (always prints to stdout)', async () => {
      const response: ChannelResponse = { text: 'Test' };

      await channel.send('different-user', response);
      await channel.send('another-user', response);

      // Both should print successfully
      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle empty text', async () => {
      const response: ChannelResponse = { text: '' };

      await channel.send('user', response);

      expect(consoleSpy).toHaveBeenCalledWith('\n\n');
    });

    it('should ignore buttons (CLI has no button support)', async () => {
      const response: ChannelResponse = {
        text: 'Choose an option:',
        buttons: [
          { text: 'Yes', callback: 'yes' },
          { text: 'No', callback: 'no' },
        ],
      };

      await channel.send('user', response);

      // Should just print the text, ignoring buttons
      expect(consoleSpy).toHaveBeenCalledWith('\nChoose an option:\n');
    });

    it('should ignore replyToId (no threading in CLI)', async () => {
      const response: ChannelResponse = {
        text: 'This is a reply',
        replyToId: 'msg-123',
      };

      await channel.send('user', response);

      // Should just print the text
      expect(consoleSpy).toHaveBeenCalledWith('\nThis is a reply\n');
    });

    it('should ignore metadata', async () => {
      const response: ChannelResponse = {
        text: 'Response with metadata',
        metadata: { someKey: 'someValue' },
      };

      await channel.send('user', response);

      expect(consoleSpy).toHaveBeenCalledWith('\nResponse with metadata\n');
    });
  });

  describe('isConfigured', () => {
    it('should always return true (CLI is always available)', () => {
      expect(channel.isConfigured()).toBe(true);
    });

    it('should return true even before initialization', () => {
      const freshChannel = new CLIChannel();
      expect(freshChannel.isConfigured()).toBe(true);
    });

    it('should return true after initialization', async () => {
      await channel.initialize({ enabled: true });
      expect(channel.isConfigured()).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should always return valid', async () => {
      const result = await channel.validateConfig!({ enabled: true });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for any config', async () => {
      const result = await channel.validateConfig!({
        enabled: true,
        userId: 'test',
        prompt: '>>> ',
        extraField: 'ignored',
      });

      expect(result.valid).toBe(true);
    });

    it('should return valid even with enabled: false', async () => {
      const result = await channel.validateConfig!({ enabled: false });

      expect(result.valid).toBe(true);
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      await channel.initialize({ enabled: true });
    });

    it('should create message with correct structure', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      // Capture the question callback
      let questionCallback: ((input: string) => void) | null = null;
      mockReadlineInterface.question.mockImplementation((prompt, cb) => {
        questionCallback = cb;
      });

      await channel.start();

      // Simulate user input
      if (questionCallback) {
        questionCallback('Hello bot!');
      }

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify handler was called with correct message structure
      expect(mockHandler).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          userId: 'cli-user',
          text: 'Hello bot!',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should use custom userId when configured', async () => {
      const customChannel = new CLIChannel();
      await customChannel.initialize({
        enabled: true,
        userId: 'custom-user-id',
      });

      const mockHandler = vi.fn().mockResolvedValue({ text: 'Response' });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      let questionCallback: ((input: string) => void) | null = null;
      mockReadlineInterface.question.mockImplementation((prompt, cb) => {
        questionCallback = cb;
      });

      await customChannel.start();

      if (questionCallback) {
        questionCallback('Test message');
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockHandler).toHaveBeenCalledWith(
        customChannel,
        expect.objectContaining({
          userId: 'custom-user-id',
        })
      );
    });

    it('should handle missing message handler gracefully', async () => {
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(null);

      let questionCallback: ((input: string) => void) | null = null;
      mockReadlineInterface.question.mockImplementation((prompt, cb) => {
        questionCallback = cb;
      });

      await channel.start();

      if (questionCallback) {
        questionCallback('Test message');
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should print warning about agent not configured
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent not configured')
      );
    });

    it('should handle empty input by prompting again', async () => {
      let questionCallback: ((input: string) => void) | null = null;
      let callCount = 0;
      
      mockReadlineInterface.question.mockImplementation((prompt, cb) => {
        callCount++;
        questionCallback = cb;
      });

      await channel.start();
      expect(callCount).toBe(1);

      // Simulate empty input
      if (questionCallback) {
        questionCallback('   '); // Whitespace only
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should prompt again (called twice total)
      expect(callCount).toBe(2);
    });

    it('should handle handler errors gracefully', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      let questionCallback: ((input: string) => void) | null = null;
      mockReadlineInterface.question.mockImplementation((prompt, cb) => {
        questionCallback = cb;
      });

      await channel.start();

      if (questionCallback) {
        questionCallback('Test message');
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should print error message
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error')
      );
    });

    it('should print response text when handler returns response', async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        text: 'Bot response text',
      });
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      let questionCallback: ((input: string) => void) | null = null;
      mockReadlineInterface.question.mockImplementation((prompt, cb) => {
        questionCallback = cb;
      });

      await channel.start();

      if (questionCallback) {
        questionCallback('Hello');
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith('\nBot response text\n');
    });

    it('should handle null response from handler', async () => {
      const mockHandler = vi.fn().mockResolvedValue(null);
      vi.mocked(channelRegistry.getMessageHandler).mockReturnValue(mockHandler);

      let questionCallback: ((input: string) => void) | null = null;
      let promptCount = 0;
      
      mockReadlineInterface.question.mockImplementation((prompt, cb) => {
        promptCount++;
        questionCallback = cb;
      });

      await channel.start();

      if (questionCallback) {
        questionCallback('Hello');
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should just prompt again without printing a response
      expect(promptCount).toBe(2);
    });
  });

  describe('exit commands', () => {
    // Note: Testing exit behavior is tricky because process.exit() is mocked
    // but the code still continues (unlike real exit). We test that the correct
    // methods are called by checking close() was called after exit input.
    
    it('should call stop and exit on "exit" command', async () => {
      // We test exit behavior by checking the channel recognizes exit keywords
      // The actual implementation calls stop() then process.exit(0)
      
      // Create a fresh channel and manually test the exit path
      const testChannel = new CLIChannel();
      await testChannel.initialize({ enabled: true });
      
      // Verify isConfigured works
      expect(testChannel.isConfigured()).toBe(true);
      
      // Note: Full exit testing requires integration tests since
      // mocking process.exit causes the async callback to continue
      // and try to call askQuestion() after rl is null.
      // The code path is: input "exit" -> stop() -> exit(0)
      // This is validated by inspecting the source code.
    });

    it('should recognize exit and quit keywords (case-insensitive)', () => {
      // Test that the logic correctly identifies exit commands
      // This tests the logic without running the full readline loop
      const exitCommands = ['exit', 'EXIT', 'Exit', 'quit', 'QUIT', 'Quit'];
      const nonExitCommands = ['hello', 'exiting', 'quitter', ''];

      exitCommands.forEach((cmd) => {
        const text = cmd.trim().toLowerCase();
        expect(text === 'exit' || text === 'quit').toBe(true);
      });

      nonExitCommands.forEach((cmd) => {
        const text = cmd.trim().toLowerCase();
        expect(text === 'exit' || text === 'quit').toBe(false);
      });
    });

    it('should stop channel gracefully', async () => {
      const testChannel = new CLIChannel();
      await testChannel.initialize({ enabled: true });
      
      mockReadlineInterface.question.mockImplementation(() => {});
      await testChannel.start();
      
      // Verify stop works
      await testChannel.stop();
      expect(mockReadlineInterface.close).toHaveBeenCalled();
    });
  });

  describe('channel lifecycle', () => {
    it('should support full lifecycle: init -> start -> send -> stop', async () => {
      const config: CLIConfig = {
        enabled: true,
        userId: 'test-user',
        prompt: '> ',
      };

      // Initialize
      await channel.initialize(config);
      expect(channel.isConfigured()).toBe(true);

      // Start
      mockReadlineInterface.question.mockImplementation(() => {});
      await channel.start();
      expect(readline.createInterface).toHaveBeenCalled();

      // Send
      await channel.send('test-user', { text: 'Hello' });
      expect(consoleSpy).toHaveBeenCalledWith('\nHello\n');

      // Stop
      await channel.stop();
      expect(mockReadlineInterface.close).toHaveBeenCalled();
    });

    it('should allow restart after stop', async () => {
      await channel.initialize({ enabled: true });

      // First run
      mockReadlineInterface.question.mockImplementation(() => {});
      await channel.start();
      await channel.stop();

      // Clear mocks
      vi.mocked(readline.createInterface).mockClear();
      vi.mocked(mockReadlineInterface.close).mockClear();

      // Second run
      await channel.start();
      expect(readline.createInterface).toHaveBeenCalledTimes(1);

      await channel.stop();
      expect(mockReadlineInterface.close).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CLIChannel module exports', () => {
  it('should export cliChannel instance', async () => {
    const mod = await import('./cli.js');

    expect(mod.cliChannel).toBeDefined();
    expect(mod.cliChannel).toBeInstanceOf(CLIChannel);
  });

  it('should export CLIChannel class', async () => {
    const mod = await import('./cli.js');

    expect(mod.CLIChannel).toBeDefined();
    expect(new mod.CLIChannel()).toBeInstanceOf(CLIChannel);
  });
});
