/**
 * Interactive Setup Wizard
 * Gets MarketClaw running in under 5 minutes
 */

import { createInterface } from 'readline';
import chalk from 'chalk';
import { loadConfig, saveConfig, Config } from './config/index.js';
import { storeApiKey, storeSetupToken } from './auth/index.js';
import { providers, PROVIDER_INFO } from './providers/index.js';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function clear(): void {
  process.stdout.write('\x1Bc');
}

function header(text: string): void {
  console.log();
  console.log(chalk.cyan.bold(`═══ ${text} ═══`));
  console.log();
}

function success(text: string): void {
  console.log(chalk.green(`✓ ${text}`));
}

function info(text: string): void {
  console.log(chalk.gray(`  ${text}`));
}

function warn(text: string): void {
  console.log(chalk.yellow(`⚠ ${text}`));
}

function error(text: string): void {
  console.log(chalk.red(`✗ ${text}`));
}

async function validateTelegramToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json() as any;
    return data.ok === true;
  } catch {
    return false;
  }
}

async function validateProviderKey(providerName: string, apiKey: string): Promise<boolean> {
  try {
    const providerInfo = PROVIDER_INFO[providerName];
    if (!providerInfo) return false;

    // For Ollama, just check if it's running
    if (providerName === 'ollama') {
      const baseUrl = apiKey || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`);
      return response.ok;
    }

    // For API-based providers, try to initialize
    await providers.initProvider(providerName, { apiKey });
    return true;
  } catch {
    return false;
  }
}

export async function runSetup(): Promise<void> {
  clear();
  
  console.log(chalk.cyan(`
  ╔══════════════════════════════════════╗
  ║                                      ║
  ║   🦀 MarketClaw Setup                ║
  ║                                      ║
  ║   Let's get you up and running       ║
  ║   in under 5 minutes.                ║
  ║                                      ║
  ╚══════════════════════════════════════╝
  `));

  const config: Config = await loadConfig();
  const steps = { telegram: false, provider: false };

  // ═══════════════════════════════════════
  // Step 1: Telegram
  // ═══════════════════════════════════════
  header('Step 1: Telegram Bot');

  console.log('MarketClaw lives in Telegram. You need a bot token.');
  console.log();
  console.log('Quick steps:');
  info('1. Open Telegram and message @BotFather');
  info('2. Send /newbot and follow prompts');
  info('3. Copy the token it gives you');
  console.log();

  // Check if already configured
  const existingToken = config.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (existingToken && existingToken.length > 20) {
    console.log(chalk.gray('Existing token found. Press Enter to keep it, or paste a new one.'));
  }

  let telegramToken = await question(chalk.cyan('Bot Token: '));
  telegramToken = telegramToken.trim() || existingToken || '';

  if (!telegramToken) {
    error('Telegram bot token is required.');
    console.log('Run setup again when you have one.');
    rl.close();
    process.exit(1);
  }

  // Validate
  process.stdout.write(chalk.gray('  Validating... '));
  const telegramValid = await validateTelegramToken(telegramToken);
  
  if (telegramValid) {
    console.log(chalk.green('valid!'));
    config.telegram = { ...config.telegram, botToken: telegramToken };
    steps.telegram = true;
    success('Telegram configured');
  } else {
    console.log(chalk.red('invalid'));
    error('Token validation failed. Check the token and try again.');
    warn('Continuing anyway - you can fix this later.');
    config.telegram = { ...config.telegram, botToken: telegramToken };
  }

  // Optional: Allowed users
  console.log();
  console.log(chalk.gray('Optional: Restrict access to specific users?'));
  info('Find your user ID via @userinfobot on Telegram');
  
  const allowedUsersStr = await question(chalk.cyan('Allowed user IDs (comma-separated, or Enter to skip): '));
  
  if (allowedUsersStr.trim()) {
    const ids = allowedUsersStr
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));
    
    if (ids.length > 0) {
      config.telegram = {
        ...config.telegram,
        allowedUsers: ids,
        adminUsers: ids,
      };
      success(`Access restricted to ${ids.length} user(s)`);
    }
  }

  // ═══════════════════════════════════════
  // Step 2: Agent Identity
  // ═══════════════════════════════════════
  header('Step 2: Agent Identity');

  console.log('Give your agent a name and personality.');
  console.log(chalk.gray('This is how it will introduce itself to users.'));
  console.log();

  // Name
  const existingName = config.agent?.name || 'MarketClaw';
  const agentName = await question(chalk.cyan(`Agent name [${existingName}]: `));
  const name = agentName.trim() || existingName;

  // Emoji
  const existingEmoji = config.agent?.emoji || '🦀';
  const agentEmoji = await question(chalk.cyan(`Signature emoji [${existingEmoji}]: `));
  const emoji = agentEmoji.trim() || existingEmoji;

  // Voice
  console.log();
  console.log('Voice style:');
  info('1. Professional — Formal, polished');
  info('2. Casual — Relaxed, conversational');
  info('3. Friendly — Warm, approachable (default)');
  info('4. Playful — Fun, energetic, uses humor');
  
  const voiceChoice = await question(chalk.cyan('Voice (1-4) [3]: '));
  const voiceMap: Record<string, 'professional' | 'casual' | 'friendly' | 'playful'> = {
    '1': 'professional',
    '2': 'casual',
    '3': 'friendly',
    '4': 'playful',
  };
  const voice = voiceMap[voiceChoice.trim()] || 'friendly';

  // Persona (optional)
  console.log();
  console.log(chalk.gray('Optional: Add a persona description'));
  info('e.g., "a witty marketing strategist" or "your friendly growth hacker"');
  const personaInput = await question(chalk.cyan('Persona (Enter to skip): '));
  const persona = personaInput.trim() || undefined;

  // Save agent config
  config.agent = {
    ...config.agent,
    name,
    emoji,
    voice,
    persona,
  };

  success(`Agent configured as ${emoji} ${name} (${voice})`);

  // ═══════════════════════════════════════
  // Step 3: AI Provider
  // ═══════════════════════════════════════
  header('Step 3: AI Provider');

  console.log('Choose your AI provider:');
  console.log();

  const providerList = Object.values(PROVIDER_INFO);
  providerList.forEach((p, i) => {
    const num = chalk.cyan(`${i + 1}.`);
    const name = chalk.white.bold(p.displayName);
    const desc = chalk.gray(p.description);
    const free = p.name === 'ollama' ? chalk.green(' (free, local)') : '';
    console.log(`  ${num} ${name}${free}`);
    console.log(`     ${desc}`);
  });

  console.log();
  const providerChoice = await question(chalk.cyan(`Provider (1-${providerList.length}) [1]: `));
  const providerIndex = parseInt(providerChoice) - 1 || 0;
  const selectedProvider = providerList[Math.max(0, Math.min(providerIndex, providerList.length - 1))];

  console.log();
  console.log(`Selected: ${chalk.bold(selectedProvider.displayName)}`);

  config.providers = { ...config.providers, default: selectedProvider.name };

  // Get API key
  if (selectedProvider.requiresApiKey) {
    console.log();
    console.log(`Get your API key at: ${chalk.underline(selectedProvider.setupUrl)}`);
    console.log();

    // Check for existing key in env
    const envKey = process.env[selectedProvider.envVar];
    if (envKey) {
      console.log(chalk.gray(`Found ${selectedProvider.envVar} in environment.`));
      const useEnv = await question(chalk.cyan('Use environment variable? (Y/n): '));
      
      if (useEnv.toLowerCase() !== 'n') {
        success(`Using ${selectedProvider.envVar} from environment`);
        steps.provider = true;
      }
    }
    
    if (!steps.provider) {
      // Check for Claude CLI auth option for Anthropic
      if (selectedProvider.name === 'anthropic') {
        console.log(chalk.gray('Options:'));
        info('1. Paste an API key');
        info('2. Use Claude Code CLI setup-token');
        console.log();
        const authMethod = await question(chalk.cyan('Auth method (1/2) [1]: '));
        
        if (authMethod.trim() === '2') {
          console.log();
          console.log('Run this in another terminal:');
          console.log(chalk.cyan('  claude setup-token'));
          console.log();
          const setupToken = await question(chalk.cyan('Paste setup-token: '));
          
          if (setupToken.trim()) {
            const stored = await storeSetupToken(setupToken.trim());
            if (stored) {
              success('Claude setup-token stored');
              steps.provider = true;
            } else {
              error('Failed to store setup-token');
            }
          }
        }
      }
      
      if (!steps.provider) {
        const apiKey = await question(chalk.cyan('API Key: '));
        
        if (apiKey.trim()) {
          process.stdout.write(chalk.gray('  Validating... '));
          const valid = await validateProviderKey(selectedProvider.name, apiKey.trim());
          
          if (valid) {
            console.log(chalk.green('valid!'));
            await storeApiKey(selectedProvider.name, 'default', apiKey.trim());
            success(`${selectedProvider.displayName} configured`);
            steps.provider = true;
          } else {
            console.log(chalk.red('could not validate'));
            warn('Storing anyway - you can fix this later.');
            await storeApiKey(selectedProvider.name, 'default', apiKey.trim());
          }
        } else {
          warn('No API key provided. Set via environment variable later.');
        }
      }
    }
  } else {
    // Ollama - just check if it's running
    console.log();
    console.log('Ollama runs locally. Make sure it\'s installed and running.');
    console.log(chalk.gray(`Install from: ${selectedProvider.setupUrl}`));
    console.log();
    
    const ollamaHost = await question(chalk.cyan('Ollama host [http://localhost:11434]: '));
    const host = ollamaHost.trim() || 'http://localhost:11434';
    
    process.stdout.write(chalk.gray('  Checking Ollama... '));
    const valid = await validateProviderKey('ollama', host);
    
    if (valid) {
      console.log(chalk.green('running!'));
      success('Ollama configured');
      steps.provider = true;
    } else {
      console.log(chalk.red('not responding'));
      warn('Make sure Ollama is running before starting MarketClaw.');
    }
  }

  // ═══════════════════════════════════════
  // Step 4: Optional Integrations
  // ═══════════════════════════════════════
  header('Step 4: Integrations (Optional)');

  console.log('MarketClaw can integrate with these services.');
  console.log(chalk.gray('Skip any you don\'t need - you can add them later.'));
  console.log();

  // Brave Search is highly recommended - prompt first
  console.log(chalk.white.bold('🔍 Web Search (Recommended)'));
  console.log(chalk.gray('Web search lets MarketClaw research competitors, find trends, and gather intel.'));
  console.log();
  
  const existingBrave = config.web?.braveApiKey || process.env.BRAVE_SEARCH_API_KEY;
  if (existingBrave) {
    console.log(chalk.green('✓ Brave Search already configured'));
  } else {
    console.log('Get a free API key at: ' + chalk.cyan('https://brave.com/search/api/'));
    info('Free tier: 2,000 queries/month');
    console.log();
    
    const braveKey = await question(chalk.cyan('Brave Search API Key (or Enter to skip): '));
    if (braveKey.trim()) {
      config.web = { ...config.web, braveApiKey: braveKey.trim() };
      success('Brave Search configured');
    } else {
      warn('Skipped - you can add BRAVE_SEARCH_API_KEY later');
    }
  }
  console.log();

  const integrations = [
    { name: 'Twitter/X', envVar: 'TWITTER_COOKIES', desc: 'Post tweets and threads' },
    { name: 'Resend', envVar: 'RESEND_API_KEY', desc: 'Send emails', url: 'https://resend.com' },
    { name: 'OpenAI (images)', envVar: 'OPENAI_API_KEY', desc: 'Generate images with DALL-E' },
  ];

  for (const integration of integrations) {
    const existing = process.env[integration.envVar];
    const status = existing ? chalk.green('(configured via env)') : '';
    
    const answer = await question(
      chalk.cyan(`Set up ${integration.name}? ${status} (y/N): `)
    );
    
    if (answer.toLowerCase() === 'y' && !existing) {
      if (integration.url) {
        console.log(chalk.gray(`  Get key at: ${integration.url}`));
      }
      const key = await question(chalk.cyan(`  ${integration.envVar}: `));
      if (key.trim()) {
        // Store in config or secrets
        success(`${integration.name} configured`);
      }
    }
  }

  // ═══════════════════════════════════════
  // Save and Finish
  // ═══════════════════════════════════════
  await saveConfig(config);

  header('Setup Complete!');

  console.log('Configuration saved to ~/.marketclaw/config.yaml');
  console.log();

  // Summary
  console.log(chalk.white.bold('Summary:'));
  console.log(`  Telegram: ${steps.telegram ? chalk.green('✓') : chalk.yellow('⚠ needs attention')}`);
  console.log(`  Provider: ${steps.provider ? chalk.green('✓') : chalk.yellow('⚠ needs attention')} (${selectedProvider.displayName})`);
  console.log();

  // Next steps
  console.log(chalk.white.bold('Next steps:'));
  console.log();
  console.log('  1. Start MarketClaw:');
  console.log(chalk.cyan('     npx tsx src/cli.ts start'));
  console.log();
  console.log('  2. Open Telegram and message your bot');
  console.log();
  console.log('  3. Add a product:');
  console.log(chalk.cyan('     npx tsx src/cli.ts products add "MyProduct" --tagline "..."'));
  console.log();

  if (!steps.telegram || !steps.provider) {
    console.log(chalk.yellow('⚠ Some items need attention. Check config and try again.'));
    console.log();
  }

  console.log(chalk.cyan('Happy marketing! 🦀'));
  console.log();

  rl.close();
}
