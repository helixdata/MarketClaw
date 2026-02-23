#!/usr/bin/env node
/**
 * MarketClaw CLI
 */

import { Command } from 'commander';
import { loadConfig, getConfigPath } from './config/index.js';
import { promptForSetupToken, listProfiles } from './auth/index.js';
import { providers, PROVIDER_INFO } from './providers/index.js';
import { memory } from './memory/index.js';
import { knowledge } from './knowledge/index.js';
import { scaffoldProduct } from './knowledge/scaffold.js';
import { scheduler, Scheduler } from './scheduler/index.js';
import { startAgent } from './index.js';
import { runSetup } from './setup.js';
import { skillLoader } from './skills/loader.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('marketclaw')
  .description('🦀 AI Marketing Agent — Telegram-first, multi-provider')
  .version('0.1.1');

// Start command
program
  .command('start')
  .description('Start the MarketClaw agent')
  .action(async () => {
    await startAgent();
  });

// Setup command
program
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    await runSetup();
  });

// Auth commands
const auth = program.command('auth').description('Manage authentication');

auth
  .command('list')
  .description('List auth profiles')
  .action(async () => {
    const profiles = await listProfiles();
    if (profiles.length === 0) {
      console.log('No auth profiles configured.');
      return;
    }

    console.log(chalk.cyan('Auth Profiles:\n'));
    for (const profile of profiles) {
      console.log(`  ${chalk.yellow(profile.provider)}:${profile.name}`);
      console.log(`    Mode: ${profile.mode}`);
      console.log(`    Updated: ${new Date(profile.updatedAt).toLocaleString()}`);
    }
  });

auth
  .command('setup-token')
  .description('Paste a Claude setup-token (run: claude setup-token)')
  .action(async () => {
    const success = await promptForSetupToken();
    if (success) {
      console.log(chalk.green('✅ Setup-token stored'));
    }
  });

// Products commands
const products = program.command('products').description('Manage products');

products
  .command('list')
  .description('List all products')
  .action(async () => {
    const prods = await memory.listProducts();
    if (prods.length === 0) {
      console.log('No products configured.');
      return;
    }

    console.log(chalk.cyan('Products:\n'));
    for (const p of prods) {
      console.log(`  ${chalk.yellow(p.name)}`);
      if (p.tagline) console.log(`    ${p.tagline}`);
      console.log(`    Features: ${p.features.length}`);
    }
  });

products
  .command('add <name>')
  .description('Add a product')
  .option('-d, --description <desc>', 'Product description')
  .option('-t, --tagline <tagline>', 'Product tagline')
  .action(async (name, options) => {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    await memory.saveProduct({
      id,
      name,
      description: options.description || '',
      tagline: options.tagline,
      features: [],
      audience: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log(chalk.green(`✅ Added product: ${name}`));
  });

// Campaigns commands
const campaigns = program.command('campaigns').description('Manage campaigns');

campaigns
  .command('list')
  .description('List all campaigns')
  .action(async () => {
    const camps = await memory.listCampaigns();
    if (camps.length === 0) {
      console.log('No campaigns yet.');
      return;
    }

    console.log(chalk.cyan('Campaigns:\n'));
    for (const c of camps) {
      const status = { draft: '📝', active: '🚀', paused: '⏸️', completed: '✅' }[c.status];
      console.log(`  ${status} ${chalk.yellow(c.name)}`);
      console.log(`    Product: ${c.productId}`);
      console.log(`    Posts: ${c.posts.length}`);
    }
  });

// Config commands
program
  .command('config')
  .description('Show config path')
  .action(async () => {
    const path = await getConfigPath();
    console.log(`Config: ${path}`);
  });

// Knowledge commands
const kb = program.command('knowledge').alias('kb').description('Manage product knowledge base');

kb
  .command('init <productId>')
  .description('Initialize knowledge base for a product')
  .option('-n, --name <name>', 'Product name')
  .option('-t, --tagline <tagline>', 'Product tagline')
  .option('-d, --description <desc>', 'Product description')
  .action(async (productId, options) => {
    const created = await scaffoldProduct({
      id: productId,
      name: options.name || productId,
      tagline: options.tagline,
      description: options.description,
    });

    if (created.length > 0) {
      console.log(chalk.green(`✅ Created knowledge base for ${productId}:`));
      created.forEach(f => console.log(`   📄 ${f}`));
    } else {
      console.log(chalk.yellow('Knowledge base already exists.'));
    }
  });

kb
  .command('index <productId>')
  .description('Index/re-index knowledge base for a product')
  .option('--openai-key <key>', 'OpenAI API key for embeddings')
  .action(async (productId, options) => {
    const apiKey = options.openaiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log(chalk.red('❌ OpenAI API key required for embeddings.'));
      console.log('Set OPENAI_API_KEY or pass --openai-key');
      return;
    }

    await knowledge.init(apiKey);
    console.log(chalk.cyan(`📚 Indexing knowledge base for ${productId}...`));
    
    const result = await knowledge.indexProduct(productId);
    console.log(chalk.green(`✅ Indexed ${result.files} files, ${result.chunks} chunks`));
  });

kb
  .command('search <productId> <query>')
  .description('Search product knowledge base')
  .option('--openai-key <key>', 'OpenAI API key for embeddings')
  .option('-n, --limit <n>', 'Number of results', '5')
  .action(async (productId, query, options) => {
    const apiKey = options.openaiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log(chalk.red('❌ OpenAI API key required.'));
      return;
    }

    await knowledge.init(apiKey);
    const results = await knowledge.search(productId, query, parseInt(options.limit));

    if (results.length === 0) {
      console.log(chalk.yellow('No results found. Try indexing first: marketclaw kb index <productId>'));
      return;
    }

    console.log(chalk.cyan(`\n🔍 Results for "${query}":\n`));
    for (const r of results) {
      console.log(chalk.yellow(`📄 ${r.file}${r.section ? ` > ${r.section}` : ''}`));
      console.log(chalk.gray(`   Score: ${(r.score * 100).toFixed(1)}%`));
      console.log(`   ${r.content.slice(0, 200)}${r.content.length > 200 ? '...' : ''}\n`);
    }
  });

kb
  .command('add <productId>')
  .description('Add knowledge to a product')
  .option('-t, --type <type>', 'Type: voice, research, learning, asset', 'learning')
  .option('-c, --category <cat>', 'Category/filename')
  .option('-m, --message <msg>', 'Content to add')
  .action(async (productId, options) => {
    if (!options.message) {
      console.log(chalk.red('❌ Message required. Use -m "your content"'));
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      await knowledge.init(apiKey);
    }

    const file = await knowledge.addKnowledge(productId, {
      type: options.type,
      category: options.category,
      content: options.message,
    });

    console.log(chalk.green(`✅ Added to ${file}`));
    
    if (apiKey) {
      console.log(chalk.cyan('📚 Re-indexing...'));
      await knowledge.indexFile(productId, file);
      console.log(chalk.green('✅ Indexed'));
    }
  });

// Status command
program
  .command('status')
  .description('Show status')
  .action(async () => {
    console.log(chalk.cyan('🦀 MarketClaw Status\n'));
    
    const config = await loadConfig();
    const profiles = await listProfiles();
    const prods = await memory.listProducts();
    const camps = await memory.listCampaigns();
    await scheduler.load();
    const jobs = scheduler.listJobs();

    console.log(`Provider: ${config.providers?.default || 'none'}`);
    console.log(`Auth profiles: ${profiles.length}`);
    console.log(`Products: ${prods.length}`);
    console.log(`Campaigns: ${camps.length}`);
    console.log(`Scheduled jobs: ${jobs.length}`);
    console.log(`Telegram: ${config.telegram?.botToken ? 'configured' : 'not configured'}`);
  });

// Scheduler commands
const crons = program.command('cron').alias('schedule').description('Manage scheduled jobs');

crons
  .command('list')
  .description('List all scheduled jobs')
  .option('-t, --type <type>', 'Filter by type (post, reminder, task)')
  .action(async (options) => {
    await scheduler.load();
    const jobs = scheduler.listJobs({ type: options.type });

    if (jobs.length === 0) {
      console.log('No scheduled jobs.');
      return;
    }

    console.log(chalk.cyan('Scheduled Jobs:\n'));
    for (const job of jobs) {
      const status = job.enabled ? chalk.green('●') : chalk.gray('○');
      console.log(`  ${status} ${chalk.yellow(job.id)}`);
      console.log(`     ${job.name} (${job.type})`);
      console.log(`     Schedule: ${job.cronExpression}`);
      console.log(`     Runs: ${job.runCount}${job.lastRun ? `, last: ${new Date(job.lastRun).toLocaleString()}` : ''}`);
    }
  });

crons
  .command('add')
  .description('Add a scheduled job')
  .option('-n, --name <name>', 'Job name')
  .option('-t, --type <type>', 'Job type (post, reminder, task)', 'reminder')
  .option('-s, --schedule <cron>', 'Cron expression or human-readable (e.g., "every day", "at 09:00")')
  .option('-m, --message <msg>', 'Content/message')
  .option('-c, --channel <channel>', 'Channel for posts (twitter, linkedin, telegram)')
  .option('-p, --product <id>', 'Product ID')
  .action(async (options) => {
    if (!options.schedule) {
      console.log(chalk.red('❌ Schedule required. Use -s "every day" or -s "0 9 * * *"'));
      return;
    }

    const cronExpression = Scheduler.parseToCron(options.schedule);
    if (!cronExpression) {
      console.log(chalk.red(`❌ Invalid schedule: ${options.schedule}`));
      return;
    }

    await scheduler.load();
    const job = await scheduler.addJob({
      name: options.name || `${options.type} job`,
      cronExpression,
      type: options.type,
      enabled: true,
      payload: {
        content: options.message,
        channel: options.channel,
        productId: options.product,
      },
    });

    console.log(chalk.green(`✅ Created job: ${job.id}`));
    console.log(`   Schedule: ${job.cronExpression}`);
  });

crons
  .command('remove <jobId>')
  .description('Remove a scheduled job')
  .action(async (jobId) => {
    await scheduler.load();
    const removed = await scheduler.removeJob(jobId);
    
    if (removed) {
      console.log(chalk.green(`✅ Removed job: ${jobId}`));
    } else {
      console.log(chalk.red(`❌ Job not found: ${jobId}`));
    }
  });

crons
  .command('enable <jobId>')
  .description('Enable a job')
  .action(async (jobId) => {
    await scheduler.load();
    const success = await scheduler.enableJob(jobId);
    console.log(success ? chalk.green(`✅ Enabled: ${jobId}`) : chalk.red(`❌ Not found: ${jobId}`));
  });

crons
  .command('disable <jobId>')
  .description('Disable a job')
  .action(async (jobId) => {
    await scheduler.load();
    const success = await scheduler.disableJob(jobId);
    console.log(success ? chalk.green(`✅ Disabled: ${jobId}`) : chalk.red(`❌ Not found: ${jobId}`));
  });

crons
  .command('run <jobId>')
  .description('Run a job immediately')
  .action(async (jobId) => {
    await scheduler.load();
    const success = await scheduler.runNow(jobId);
    console.log(success ? chalk.green(`✅ Executed: ${jobId}`) : chalk.red(`❌ Not found: ${jobId}`));
  });

// Provider commands
const providerCmd = program.command('provider').alias('providers').description('Manage AI providers');

providerCmd
  .command('list')
  .description('List available providers')
  .action(() => {
    console.log(chalk.cyan('Available AI Providers:\n'));
    
    for (const info of Object.values(PROVIDER_INFO)) {
      const envSet = process.env[info.envVar] ? chalk.green('(key set)') : chalk.gray('(not configured)');
      console.log(`  ${chalk.yellow(info.name)} — ${info.displayName} ${envSet}`);
      console.log(`    ${chalk.gray(info.description)}`);
      console.log(`    Default model: ${info.defaultModel}`);
      console.log(`    Env var: ${info.envVar}`);
      if (info.setupUrl) console.log(`    Setup: ${chalk.underline(info.setupUrl)}`);
      console.log();
    }
  });

providerCmd
  .command('test <provider>')
  .description('Test a provider connection')
  .action(async (providerName) => {
    const info = PROVIDER_INFO[providerName];
    if (!info) {
      console.log(chalk.red(`Unknown provider: ${providerName}`));
      console.log(`Available: ${Object.keys(PROVIDER_INFO).join(', ')}`);
      return;
    }

    console.log(`Testing ${info.displayName}...`);

    try {
      const apiKey = process.env[info.envVar];
      if (!apiKey && info.requiresApiKey) {
        console.log(chalk.yellow(`No ${info.envVar} set. Provider may not work.`));
      }

      await providers.initProvider(providerName, { apiKey });
      const provider = providers.getProvider(providerName);
      
      if (provider?.isReady()) {
        console.log(chalk.green(`✓ ${info.displayName} is ready`));
        console.log(`  Model: ${provider.currentModel()}`);
        console.log(`  Available models: ${(await provider.listModels()).join(', ')}`);
      } else {
        console.log(chalk.red(`✗ Provider not ready`));
      }
    } catch (error) {
      console.log(chalk.red(`✗ Error: ${error instanceof Error ? error.message : error}`));
    }
  });

// Skill commands
const skillCmd = program.command('skill').alias('skills').description('Manage skills');

skillCmd
  .command('list')
  .description('List installed skills')
  .action(async () => {
    await skillLoader.init();
    const manifests = await skillLoader.discover();
    
    if (manifests.length === 0) {
      console.log('No skills installed.');
      console.log(chalk.gray('Use "marketclaw skill search" to find skills.'));
      return;
    }
    
    console.log(chalk.cyan('Installed Skills:\n'));
    for (const manifest of manifests) {
      console.log(`  ${chalk.yellow(manifest.name)} v${manifest.version}`);
      console.log(`    ${chalk.gray(manifest.description)}`);
      console.log(`    Tools: ${manifest.tools.join(', ')}`);
      console.log();
    }
  });

skillCmd
  .command('search [query]')
  .description('Search for skills in the marketplace')
  .action(async (query?: string) => {
    const { marketplaceTools } = await import('./skills/marketplace.js');
    const searchTool = marketplaceTools.find(t => t.name === 'search_skills');
    
    if (searchTool) {
      const result = await searchTool.execute({ query });
      
      if (result.data?.length === 0) {
        console.log('No skills found.');
        return;
      }
      
      console.log(chalk.cyan('Available Skills:\n'));
      for (const skill of result.data) {
        console.log(`  ${chalk.yellow(skill.name)}`);
        console.log(`    ${skill.description}`);
        if (skill.tags?.length) {
          console.log(`    Tags: ${skill.tags.join(', ')}`);
        }
        console.log();
      }
    }
  });

skillCmd
  .command('install <name>')
  .description('Install a skill')
  .action(async (name: string) => {
    const { marketplaceTools } = await import('./skills/marketplace.js');
    const installTool = marketplaceTools.find(t => t.name === 'install_skill');
    
    if (installTool) {
      console.log(`Installing skill: ${name}...`);
      const result = await installTool.execute({ name });
      
      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.log(chalk.red(result.message));
      }
    }
  });

skillCmd
  .command('uninstall <name>')
  .description('Uninstall a skill')
  .action(async (name: string) => {
    const { marketplaceTools } = await import('./skills/marketplace.js');
    const uninstallTool = marketplaceTools.find(t => t.name === 'uninstall_skill');
    
    if (uninstallTool) {
      console.log(`Uninstalling skill: ${name}...`);
      const result = await uninstallTool.execute({ name });
      
      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.log(chalk.red(result.message));
      }
    }
  });

skillCmd
  .command('info <name>')
  .description('Show skill details')
  .action(async (name: string) => {
    const { marketplaceTools } = await import('./skills/marketplace.js');
    const infoTool = marketplaceTools.find(t => t.name === 'skill_info');
    
    if (infoTool) {
      const result = await infoTool.execute({ name });
      
      if (result.success && result.data) {
        const s = result.data;
        console.log(chalk.cyan(`\n${s.displayName || s.name} v${s.version}\n`));
        console.log(`${s.description}\n`);
        if (s.author) console.log(`Author: ${s.author}`);
        if (s.repository) console.log(`Repository: ${s.repository}`);
        console.log(`Status: ${s.installed ? (s.active ? chalk.green('active') : chalk.yellow('inactive')) : chalk.gray('not installed')}`);
        
        if (s.tools?.length) {
          console.log(`\nTools: ${s.tools.join(', ')}`);
        }
        
        if (s.secrets?.length) {
          console.log('\nSecrets:');
          for (const secret of s.secrets) {
            const status = secret.configured ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${status} ${secret.name}${secret.required ? ' (required)' : ''}`);
            console.log(`    ${secret.description}`);
          }
        }
        console.log();
      } else {
        console.log(chalk.red(result.message));
      }
    }
  });

// Update command
program
  .command('update')
  .description('Update MarketClaw to the latest version')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('--check', 'Only check for updates, don\'t install')
  .action(async (options) => {
    const { execSync } = await import('child_process');
    const { createInterface } = await import('readline');
    
    // Find the installation directory (where this script is running from)
    const installDir = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
    
    console.log(chalk.cyan('🦀 MarketClaw Update\n'));
    
    // Check if installed via npm global
    const isNpmGlobal = installDir.includes('node_modules');
    
    if (isNpmGlobal) {
      console.log(`Installation: ${chalk.gray('npm global')}`);
      console.log('\nChecking for updates...');
      
      try {
        const outdated = execSync('npm outdated -g marketclaw', { encoding: 'utf-8', stdio: 'pipe' }).trim();
        if (!outdated) {
          console.log(chalk.green('\n✓ Already up to date!'));
          return;
        }
        console.log(chalk.yellow('\nUpdate available:'));
        console.log(chalk.gray(outdated));
      } catch (err: any) {
        // npm outdated exits with code 1 when updates available
        if (err.stdout) {
          console.log(chalk.yellow('\nUpdate available:'));
          console.log(chalk.gray(err.stdout));
        } else {
          console.log(chalk.green('\n✓ Already up to date!'));
          return;
        }
      }
      
      if (options.check) {
        console.log(chalk.cyan('\nRun `npm update -g marketclaw` to install.'));
        return;
      }
      
      if (!options.yes) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>(resolve => {
          rl.question('\nInstall update? [y/N] ', resolve);
        });
        rl.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(chalk.gray('Update cancelled.'));
          return;
        }
      }
      
      console.log('\nUpdating via npm...');
      try {
        execSync('npm update -g marketclaw', { stdio: 'inherit' });
        console.log(chalk.green('\n✓ Update complete!'));
        console.log(chalk.cyan('\nRestart MarketClaw to use the new version.'));
      } catch {
        console.log(chalk.red('✗ Update failed. Try: npm update -g marketclaw'));
      }
      return;
    }
    
    // Git installation
    console.log(`Installation: ${chalk.gray(installDir)}`);
    
    try {
      // Check if it's a git repo
      execSync('git rev-parse --git-dir', { cwd: installDir, stdio: 'pipe' });
    } catch {
      console.log(chalk.red('\n✗ Not a git or npm installation.'));
      console.log(chalk.gray('  Install via: npm install -g marketclaw'));
      console.log(chalk.gray('  Or clone: https://github.com/helixdata/MarketClaw'));
      return;
    }
    
    // Fetch latest
    console.log('\nChecking for updates...');
    try {
      execSync('git fetch', { cwd: installDir, stdio: 'pipe' });
    } catch (err) {
      console.log(chalk.red('✗ Failed to fetch updates. Check your internet connection.'));
      return;
    }
    
    // Check if behind
    const local = execSync('git rev-parse HEAD', { cwd: installDir, encoding: 'utf-8' }).trim();
    const remote = execSync('git rev-parse @{u}', { cwd: installDir, encoding: 'utf-8' }).trim();
    
    if (local === remote) {
      console.log(chalk.green('\n✓ Already up to date!'));
      return;
    }
    
    // Show what's new
    const commits = execSync(`git log --oneline ${local}..${remote}`, { cwd: installDir, encoding: 'utf-8' }).trim();
    const commitCount = commits.split('\n').filter(l => l).length;
    
    console.log(chalk.yellow(`\n${commitCount} new commit(s) available:\n`));
    console.log(chalk.gray(commits));
    console.log();
    
    if (options.check) {
      console.log(chalk.cyan('Run `marketclaw update` to install.'));
      return;
    }
    
    // Confirm unless --yes
    if (!options.yes) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>(resolve => {
        rl.question('Install updates? [y/N] ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log(chalk.gray('Update cancelled.'));
        return;
      }
    }
    
    // Pull
    console.log('\nPulling updates...');
    try {
      execSync('git pull', { cwd: installDir, stdio: 'inherit' });
    } catch {
      console.log(chalk.red('✗ Failed to pull. You may have local changes.'));
      console.log(chalk.gray('  Try: git stash && marketclaw update && git stash pop'));
      return;
    }
    
    // Install deps
    console.log('\nInstalling dependencies...');
    try {
      execSync('npm install', { cwd: installDir, stdio: 'inherit' });
    } catch {
      console.log(chalk.red('✗ Failed to install dependencies.'));
      return;
    }
    
    // Build
    console.log('\nBuilding...');
    try {
      execSync('npm run build', { cwd: installDir, stdio: 'inherit' });
    } catch {
      console.log(chalk.red('✗ Build failed.'));
      return;
    }
    
    console.log(chalk.green('\n✓ Update complete!'));
    console.log(chalk.cyan('\nRestart MarketClaw to use the new version:'));
    console.log(chalk.gray('  marketclaw start'));
  });

program.parse();
