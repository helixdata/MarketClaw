/**
 * Config Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import YAML from 'yaml';

// Store module reference
let configModule: typeof import('./index.js');
let tempDir: string;
let configDir: string;
let configFile: string;
let originalEnv: NodeJS.ProcessEnv;

// Use vi.hoisted to define mock before vi.mock runs
const { mockHomeDir } = vi.hoisted(() => {
  return { mockHomeDir: vi.fn(() => '/tmp/default-home') };
});

// Mock os.homedir
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    homedir: () => mockHomeDir(),
  };
});

describe('Config Module', () => {
  beforeEach(async () => {
    // Create temp directory for each test
    tempDir = await mkdtemp(path.join(tmpdir(), 'marketclaw-test-'));
    configDir = path.join(tempDir, '.marketclaw');
    configFile = path.join(configDir, 'config.yaml');
    
    // Set mock to return our temp directory
    mockHomeDir.mockReturnValue(tempDir);
    
    // Save original env
    originalEnv = { ...process.env };
    
    // Clear relevant env vars
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    // Reset modules and re-import to pick up new homedir
    vi.resetModules();
    configModule = await import('./index.js');
  });

  afterEach(async () => {
    // Restore env
    process.env = originalEnv;
    
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should return default config when no config file exists', async () => {
      const config = await configModule.loadConfig();
      
      expect(config.providers?.default).toBe('anthropic');
      expect(config.agent?.name).toBe('MarketClaw');
      expect(config.agent?.emoji).toBe('🦀');
      expect(config.agent?.voice).toBe('friendly');
    });

    it('should create config directory if it does not exist', async () => {
      expect(existsSync(configDir)).toBe(false);
      
      await configModule.loadConfig();
      
      expect(existsSync(configDir)).toBe(true);
    });

    it('should load config from YAML file', async () => {
      // Create config directory and file
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        agent: {
          name: 'TestBot',
          emoji: '🤖',
          voice: 'professional',
        },
        providers: {
          default: 'openai',
        },
        workspace: '/tmp/workspace',
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();

      expect(config.agent?.name).toBe('TestBot');
      expect(config.agent?.emoji).toBe('🤖');
      expect(config.agent?.voice).toBe('professional');
      expect(config.providers?.default).toBe('openai');
      expect(config.workspace).toBe('/tmp/workspace');
    });

    it('should merge env vars with config file (env takes precedence)', async () => {
      // Set up config file
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        telegram: {
          botToken: 'file-token',
        },
        providers: {
          anthropic: {
            apiKey: 'file-anthropic-key',
          },
          openai: {
            apiKey: 'file-openai-key',
          },
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      // Set env vars
      process.env.TELEGRAM_BOT_TOKEN = 'env-token';
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';

      const config = await configModule.loadConfig();

      // Env vars should override file values
      expect(config.telegram?.botToken).toBe('env-token');
      expect(config.providers?.anthropic?.apiKey).toBe('env-anthropic-key');
      // File value should be used when no env var
      expect(config.providers?.openai?.apiKey).toBe('file-openai-key');
    });

    it('should use file values when env vars are not set', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        telegram: {
          botToken: 'file-token',
        },
        providers: {
          anthropic: {
            apiKey: 'file-key',
          },
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();

      expect(config.telegram?.botToken).toBe('file-token');
      expect(config.providers?.anthropic?.apiKey).toBe('file-key');
    });

    it('should handle complex channel configurations', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        channels: {
          telegram: {
            enabled: true,
            botToken: 'tg-token',
            allowedUsers: [123, 456],
            adminUsers: [123],
          },
          discord: {
            enabled: true,
            botToken: 'dc-token',
            guildIds: ['guild1', 'guild2'],
            allowedRoles: ['admin', 'mod'],
          },
          slack: {
            enabled: false,
            appToken: 'slack-app',
            signingSecret: 'slack-secret',
            allowedChannels: ['general', 'marketing'],
          },
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();

      expect(config.channels?.telegram?.enabled).toBe(true);
      expect(config.channels?.telegram?.allowedUsers).toEqual([123, 456]);
      expect(config.channels?.discord?.guildIds).toEqual(['guild1', 'guild2']);
      expect(config.channels?.slack?.enabled).toBe(false);
    });

    it('should handle agent configuration with sub-agents', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        agents: {
          enabled: true,
          builtins: ['tweety', 'quinn'],
          defaultTimeoutMs: 60000,
          defaultMaxIterations: 5,
          agents: {
            tweety: {
              enabled: true,
              model: 'claude-sonnet-4-20250514',
            },
            quinn: {
              enabled: false,
            },
          },
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();

      expect(config.agents?.enabled).toBe(true);
      expect(config.agents?.builtins).toEqual(['tweety', 'quinn']);
      expect(config.agents?.defaultTimeoutMs).toBe(60000);
      expect(config.agents?.agents?.tweety?.model).toBe('claude-sonnet-4-20250514');
      expect(config.agents?.agents?.quinn?.enabled).toBe(false);
    });

    it('should handle marketing channel configurations', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        marketing: {
          twitter: {
            apiKey: 'tw-key',
            apiSecret: 'tw-secret',
            accessToken: 'tw-access',
            accessSecret: 'tw-access-secret',
          },
          linkedin: {
            accessToken: 'li-token',
          },
          producthunt: {
            developerToken: 'ph-token',
          },
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();

      expect(config.marketing?.twitter?.apiKey).toBe('tw-key');
      expect(config.marketing?.linkedin?.accessToken).toBe('li-token');
      expect(config.marketing?.producthunt?.developerToken).toBe('ph-token');
    });

    it('should apply schema defaults', async () => {
      await mkdir(configDir, { recursive: true });
      // Minimal config - defaults should be applied
      const yamlConfig = {
        providers: {},
        agent: {},
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();

      // Schema defaults
      expect(config.providers?.default).toBe('anthropic');
      expect(config.agent?.name).toBe('MarketClaw');
      expect(config.agent?.emoji).toBe('🦀');
      expect(config.agent?.voice).toBe('friendly');
    });

    it('should handle empty config file gracefully', async () => {
      await mkdir(configDir, { recursive: true });
      await writeFile(configFile, '');

      // Empty YAML parses as null, should still work
      const config = await configModule.loadConfig();
      
      // Should get merged with env vars structure
      expect(config).toBeDefined();
    });
  });

  describe('saveConfig', () => {
    it('should save config to YAML file', async () => {
      const config = {
        agent: {
          name: 'SavedBot',
          emoji: '💾',
          voice: 'casual' as const,
        },
        providers: {
          default: 'openai',
        },
        workspace: '/test/workspace',
      };

      await configModule.saveConfig(config);

      expect(existsSync(configFile)).toBe(true);
      
      const content = await readFile(configFile, 'utf-8');
      const parsed = YAML.parse(content);
      
      expect(parsed.agent.name).toBe('SavedBot');
      expect(parsed.agent.emoji).toBe('💾');
      expect(parsed.workspace).toBe('/test/workspace');
    });

    it('should create config directory if it does not exist', async () => {
      expect(existsSync(configDir)).toBe(false);

      await configModule.saveConfig({ agent: { name: 'Test' } });

      expect(existsSync(configDir)).toBe(true);
      expect(existsSync(configFile)).toBe(true);
    });

    it('should overwrite existing config file', async () => {
      await mkdir(configDir, { recursive: true });
      await writeFile(configFile, YAML.stringify({ agent: { name: 'Old' } }));

      await configModule.saveConfig({ agent: { name: 'New', emoji: '🆕' } });

      const content = await readFile(configFile, 'utf-8');
      const parsed = YAML.parse(content);
      
      expect(parsed.agent.name).toBe('New');
      expect(parsed.agent.emoji).toBe('🆕');
    });

    it('should save complex nested configurations', async () => {
      const config = {
        channels: {
          telegram: {
            enabled: true,
            botToken: 'token',
            allowedUsers: [1, 2, 3],
          },
        },
        agents: {
          enabled: true,
          builtins: 'all' as const,
          defaultTimeoutMs: 120000,
          defaultMaxIterations: 10,
        },
        marketing: {
          twitter: {
            apiKey: 'key',
          },
        },
      };

      await configModule.saveConfig(config);

      const content = await readFile(configFile, 'utf-8');
      const parsed = YAML.parse(content);

      expect(parsed.channels.telegram.allowedUsers).toEqual([1, 2, 3]);
      expect(parsed.agents.builtins).toBe('all');
      expect(parsed.marketing.twitter.apiKey).toBe('key');
    });
  });

  describe('getConfigPath', () => {
    it('should return the config file path', async () => {
      const configPath = await configModule.getConfigPath();
      
      expect(configPath).toBe(path.join(tempDir, '.marketclaw', 'config.yaml'));
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build prompt with default values', () => {
      const prompt = configModule.buildSystemPrompt();

      expect(prompt).toContain('MarketClaw');
      expect(prompt).toContain('🦀');
      expect(prompt).toContain('an AI marketing agent');
      expect(prompt).toContain('warm and approachable'); // friendly voice
    });

    it('should build prompt with custom name and emoji', () => {
      const prompt = configModule.buildSystemPrompt({
        name: 'CustomBot',
        emoji: '🤖',
      });

      expect(prompt).toContain('You are CustomBot 🤖');
      expect(prompt).toContain('Your name is **CustomBot**');
      expect(prompt).toContain('Use "🤖" as your signature emoji');
    });

    it('should include custom persona', () => {
      const prompt = configModule.buildSystemPrompt({
        persona: 'a witty marketing guru who loves puns',
      });

      expect(prompt).toContain('a witty marketing guru who loves puns');
    });

    it('should apply professional voice style', () => {
      const prompt = configModule.buildSystemPrompt({
        voice: 'professional',
      });

      expect(prompt).toContain('Be professional and polished');
      expect(prompt).toContain('formal language');
    });

    it('should apply casual voice style', () => {
      const prompt = configModule.buildSystemPrompt({
        voice: 'casual',
      });

      expect(prompt).toContain('Be casual and relaxed');
      expect(prompt).toContain('conversational language');
    });

    it('should apply friendly voice style', () => {
      const prompt = configModule.buildSystemPrompt({
        voice: 'friendly',
      });

      expect(prompt).toContain('Be warm and approachable');
      expect(prompt).toContain('Balance professionalism with friendliness');
    });

    it('should apply playful voice style', () => {
      const prompt = configModule.buildSystemPrompt({
        voice: 'playful',
      });

      expect(prompt).toContain('Be fun and energetic');
      expect(prompt).toContain('Use humor');
    });

    it('should include team member descriptions', () => {
      const prompt = configModule.buildSystemPrompt();

      expect(prompt).toContain('🐦 **Tweety**');
      expect(prompt).toContain('💼 **Quinn**');
      expect(prompt).toContain('✉️ **Emma**');
      expect(prompt).toContain('🎨 **Pixel**');
      expect(prompt).toContain('📊 **Dash**');
      expect(prompt).toContain('🔍 **Scout**');
      expect(prompt).toContain('🚀 **Hunter**');
    });

    it('should include capabilities section', () => {
      const prompt = configModule.buildSystemPrompt();

      expect(prompt).toContain('## Capabilities');
      expect(prompt).toContain('Create marketing content');
      expect(prompt).toContain('Track and analyze performance');
    });

    it('should include formatting guidelines', () => {
      const prompt = configModule.buildSystemPrompt();

      expect(prompt).toContain('## Formatting');
      expect(prompt).toContain('NOT tables');
    });

    it('should handle all agent identity fields', () => {
      const prompt = configModule.buildSystemPrompt({
        name: 'TestAgent',
        emoji: '🧪',
        persona: 'a test automation specialist',
        voice: 'professional',
        systemPrompt: 'This is ignored',  // systemPrompt field exists but isn't used in buildSystemPrompt
      });

      expect(prompt).toContain('TestAgent');
      expect(prompt).toContain('🧪');
      expect(prompt).toContain('a test automation specialist');
      expect(prompt).toContain('Be professional and polished');
    });
  });

  describe('Config Validation', () => {
    it('should validate channel enabled as boolean', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        channels: {
          telegram: {
            enabled: true,
          },
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();
      expect(config.channels?.telegram?.enabled).toBe(true);
    });

    it('should validate voice enum values', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        agent: {
          voice: 'playful',
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();
      expect(config.agent?.voice).toBe('playful');
    });

    it('should reject invalid voice values', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        agent: {
          voice: 'invalid-voice',
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      await expect(configModule.loadConfig()).rejects.toThrow();
    });

    it('should validate allowedUsers as number array', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        telegram: {
          allowedUsers: [123, 456, 789],
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();
      expect(config.telegram?.allowedUsers).toEqual([123, 456, 789]);
    });

    it('should validate agents.builtins union type', async () => {
      await mkdir(configDir, { recursive: true });
      
      // Test 'all'
      await writeFile(configFile, YAML.stringify({ agents: { builtins: 'all' } }));
      let config = await configModule.loadConfig();
      expect(config.agents?.builtins).toBe('all');

      // Test 'none'
      await writeFile(configFile, YAML.stringify({ agents: { builtins: 'none' } }));
      config = await configModule.loadConfig();
      expect(config.agents?.builtins).toBe('none');

      // Test array
      await writeFile(configFile, YAML.stringify({ agents: { builtins: ['tweety', 'quinn'] } }));
      config = await configModule.loadConfig();
      expect(config.agents?.builtins).toEqual(['tweety', 'quinn']);
    });

    it('should apply default values for agents config', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        agents: {
          enabled: true,
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();
      expect(config.agents?.enabled).toBe(true);
      expect(config.agents?.builtins).toBe('all'); // default
      expect(config.agents?.defaultTimeoutMs).toBe(120000); // default
      expect(config.agents?.defaultMaxIterations).toBe(10); // default
    });

    it('should allow passthrough properties in channel config', async () => {
      await mkdir(configDir, { recursive: true });
      const yamlConfig = {
        channels: {
          custom: {
            enabled: true,
            customProperty: 'custom-value',
            anotherProp: 123,
          },
        },
      };
      await writeFile(configFile, YAML.stringify(yamlConfig));

      const config = await configModule.loadConfig();
      expect(config.channels?.custom?.enabled).toBe(true);
      expect((config.channels?.custom as Record<string, unknown>)?.customProperty).toBe('custom-value');
      expect((config.channels?.custom as Record<string, unknown>)?.anotherProp).toBe(123);
    });
  });

  describe('Round-trip', () => {
    it('should preserve config through save and load cycle', async () => {
      const originalConfig = {
        agent: {
          name: 'RoundTripBot',
          emoji: '🔄',
          voice: 'casual' as const,
          persona: 'a helpful assistant',
        },
        providers: {
          default: 'anthropic',
          anthropic: {
            model: 'claude-sonnet-4-20250514',
          },
        },
        channels: {
          telegram: {
            enabled: true,
            allowedUsers: [111, 222],
          },
        },
        workspace: '/my/workspace',
        agents: {
          enabled: true,
          builtins: ['tweety'] as string[],
          defaultTimeoutMs: 90000,
          defaultMaxIterations: 8,
        },
      };

      await configModule.saveConfig(originalConfig);
      const loadedConfig = await configModule.loadConfig();

      expect(loadedConfig.agent?.name).toBe('RoundTripBot');
      expect(loadedConfig.agent?.emoji).toBe('🔄');
      expect(loadedConfig.agent?.voice).toBe('casual');
      expect(loadedConfig.providers?.default).toBe('anthropic');
      expect(loadedConfig.channels?.telegram?.enabled).toBe(true);
      expect(loadedConfig.channels?.telegram?.allowedUsers).toEqual([111, 222]);
      expect(loadedConfig.workspace).toBe('/my/workspace');
      expect(loadedConfig.agents?.builtins).toEqual(['tweety']);
    });
  });

  describe('DEFAULT_SYSTEM_PROMPT', () => {
    it('should export a default system prompt', () => {
      expect(configModule.DEFAULT_SYSTEM_PROMPT).toBeDefined();
      expect(typeof configModule.DEFAULT_SYSTEM_PROMPT).toBe('string');
      expect(configModule.DEFAULT_SYSTEM_PROMPT).toContain('MarketClaw');
    });
  });
});
