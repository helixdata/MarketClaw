/**
 * Sub-Agent Loader
 * Loads sub-agents from config, built-ins, and modular files
 */

import { readFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { subAgentRegistry } from './registry.js';
import { builtinSpecialists } from './specialists.js';
import { SubAgentManifest, SubAgentConfig, AgentIdentity } from './types.js';
import pino from 'pino';

const logger = pino({ name: 'agent-loader' });

const WORKSPACE = path.join(homedir(), '.marketclaw', 'workspace');
const AGENTS_DIR = path.join(WORKSPACE, 'agents');

/**
 * Agent configuration from config.yaml
 */
export interface AgentConfigEntry {
  enabled?: boolean;
  // Identity overrides
  name?: string;
  emoji?: string;
  persona?: string;
  voice?: 'professional' | 'casual' | 'friendly' | 'playful';
  // Model override
  model?: string;
}

export interface AgentsConfig {
  // Enable/disable all sub-agents
  enabled?: boolean;
  // Which built-ins to enable (default: all)
  builtins?: string[] | 'all' | 'none';
  // Custom agents directory
  customDir?: string;
  // Per-agent config
  agents?: Record<string, AgentConfigEntry>;
}

/**
 * Initialize all sub-agents
 */
export async function initializeAgents(config?: AgentsConfig): Promise<void> {
  // Ensure agents directory exists
  await mkdir(AGENTS_DIR, { recursive: true });

  // Skip if agents are disabled
  if (config?.enabled === false) {
    logger.info('Sub-agents disabled');
    return;
  }

  // Load built-in specialists
  const builtinsToLoad = config?.builtins ?? 'all';
  
  if (builtinsToLoad !== 'none') {
    for (const specialist of builtinSpecialists) {
      // Check if this builtin should be loaded
      if (Array.isArray(builtinsToLoad) && !builtinsToLoad.includes(specialist.id)) {
        continue;
      }

      // Get per-agent config overrides
      const agentConfig = config?.agents?.[specialist.id];
      
      // Skip if explicitly disabled
      if (agentConfig?.enabled === false) {
        continue;
      }

      // Apply identity overrides
      const identity: AgentIdentity = {
        ...specialist.identity,
        ...(agentConfig?.name && { name: agentConfig.name }),
        ...(agentConfig?.emoji && { emoji: agentConfig.emoji }),
        ...(agentConfig?.persona && { persona: agentConfig.persona }),
        ...(agentConfig?.voice && { voice: agentConfig.voice }),
      };

      subAgentRegistry.registerFromManifest(
        { ...specialist, identity },
        {
          enabled: agentConfig?.enabled ?? true,
          model: agentConfig?.model,
        }
      );
    }

    logger.info({ count: subAgentRegistry.listEnabled().length }, 'Built-in agents loaded');
  }

  // Load custom agents from directory
  const customDir = config?.customDir || AGENTS_DIR;
  await loadCustomAgents(customDir, config?.agents);
}

/**
 * Load custom agents from a directory
 */
async function loadCustomAgents(
  dir: string, 
  agentConfigs?: Record<string, AgentConfigEntry>
): Promise<void> {
  if (!existsSync(dir)) {
    return;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const agentPath = path.join(dir, entry.name);
        await loadAgentFromFile(agentPath, agentConfigs);
      } else if (entry.isDirectory()) {
        // Check for manifest.json in subdirectory
        const manifestPath = path.join(dir, entry.name, 'manifest.json');
        if (existsSync(manifestPath)) {
          await loadAgentFromFile(manifestPath, agentConfigs);
        }
      }
    }
  } catch (err) {
    logger.error({ err, dir }, 'Failed to load custom agents');
  }
}

/**
 * Load a single agent from a manifest file
 */
async function loadAgentFromFile(
  manifestPath: string,
  agentConfigs?: Record<string, AgentConfigEntry>
): Promise<void> {
  try {
    const content = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as SubAgentManifest;

    // Validate manifest
    if (!manifest.id || !manifest.identity || !manifest.specialty) {
      logger.warn({ path: manifestPath }, 'Invalid agent manifest');
      return;
    }

    // Get per-agent config overrides
    const agentConfig = agentConfigs?.[manifest.id];

    // Skip if explicitly disabled
    if (agentConfig?.enabled === false) {
      return;
    }

    // Apply identity overrides
    const identity: AgentIdentity = {
      ...manifest.identity,
      ...(agentConfig?.name && { name: agentConfig.name }),
      ...(agentConfig?.emoji && { emoji: agentConfig.emoji }),
      ...(agentConfig?.persona && { persona: agentConfig.persona }),
      ...(agentConfig?.voice && { voice: agentConfig.voice }),
    };

    subAgentRegistry.registerFromManifest(
      { ...manifest, identity },
      {
        enabled: agentConfig?.enabled ?? true,
        model: agentConfig?.model,
      }
    );

    logger.info({ agentId: manifest.id, path: manifestPath }, 'Custom agent loaded');
  } catch (err) {
    logger.error({ err, path: manifestPath }, 'Failed to load agent manifest');
  }
}

/**
 * Create a custom agent from config
 */
export async function createCustomAgent(manifest: SubAgentManifest): Promise<void> {
  const agentDir = path.join(AGENTS_DIR, manifest.id);
  await mkdir(agentDir, { recursive: true });

  const manifestPath = path.join(agentDir, 'manifest.json');
  await require('fs/promises').writeFile(
    manifestPath,
    JSON.stringify(manifest, null, 2)
  );

  // Register immediately
  subAgentRegistry.registerFromManifest(manifest, { enabled: true });

  logger.info({ agentId: manifest.id }, 'Custom agent created');
}
