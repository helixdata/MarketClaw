/**
 * Marketplace Skill
 * Install and manage skills from registry
 */

import { mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { Tool, ToolResult } from '../tools/types.js';
import { skillLoader } from './loader.js';
import { SkillManifest, SkillRegistryEntry } from './types.js';

const SKILLS_DIR = path.join(homedir(), '.marketclaw', 'skills');

// Built-in skill registry (can be expanded to fetch from remote)
const SKILL_REGISTRY: SkillRegistryEntry[] = [
  {
    name: 'twitter',
    version: '1.0.0',
    description: 'Post tweets, threads, and monitor Twitter/X',
    author: 'MarketClaw',
    repository: 'https://github.com/marketclaw/skill-twitter',
    source: 'github',
    installUrl: 'https://github.com/marketclaw/skill-twitter',
    tags: ['social', 'twitter', 'x'],
  },
  {
    name: 'linkedin',
    version: '1.0.0',
    description: 'Post to LinkedIn and manage professional content',
    author: 'MarketClaw',
    repository: 'https://github.com/marketclaw/skill-linkedin',
    source: 'github',
    installUrl: 'https://github.com/marketclaw/skill-linkedin',
    tags: ['social', 'linkedin', 'professional'],
  },
  {
    name: 'producthunt',
    version: '1.0.0',
    description: 'Manage Product Hunt launches and track products',
    author: 'MarketClaw',
    repository: 'https://github.com/marketclaw/skill-producthunt',
    source: 'github',
    installUrl: 'https://github.com/marketclaw/skill-producthunt',
    tags: ['launch', 'producthunt', 'marketing'],
  },
  {
    name: 'image-gen',
    version: '1.0.0',
    description: 'Generate images with AI (DALL-E, Midjourney)',
    author: 'MarketClaw',
    repository: 'https://github.com/marketclaw/skill-image-gen',
    source: 'github',
    installUrl: 'https://github.com/marketclaw/skill-image-gen',
    tags: ['images', 'ai', 'creative'],
  },
];

// ============ Search Skills ============
export const searchSkillsTool: Tool = {
  name: 'search_skills',
  description: 'Search for available skills to install',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (searches name, description, tags)',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const query = params.query?.toLowerCase() || '';
    
    let results = SKILL_REGISTRY;
    
    if (query) {
      results = results.filter(skill => 
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.tags?.some(t => t.toLowerCase().includes(query))
      );
    }
    
    if (results.length === 0) {
      return {
        success: true,
        message: 'No skills found matching your query.',
        data: [],
      };
    }
    
    return {
      success: true,
      message: `Found ${results.length} skill(s)`,
      data: results.map(s => ({
        name: s.name,
        description: s.description,
        version: s.version,
        tags: s.tags,
      })),
    };
  },
};

// ============ Install Skill ============
export const installSkillTool: Tool = {
  name: 'install_skill',
  description: 'Install a skill from the marketplace',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the skill to install',
      },
    },
    required: ['name'],
  },

  async execute(params): Promise<ToolResult> {
    const { name } = params;
    
    // Find skill in registry
    const skillEntry = SKILL_REGISTRY.find(s => s.name.toLowerCase() === name.toLowerCase());
    
    if (!skillEntry) {
      return {
        success: false,
        message: `Skill "${name}" not found in marketplace. Use search_skills to find available skills.`,
      };
    }
    
    // Check if already installed
    const skillDir = path.join(SKILLS_DIR, skillEntry.name);
    if (existsSync(skillDir)) {
      return {
        success: false,
        message: `Skill "${name}" is already installed. Use upgrade_skill to update.`,
      };
    }
    
    try {
      // Create skill directory
      await mkdir(skillDir, { recursive: true });
      
      if (skillEntry.source === 'github') {
        // Clone from GitHub
        execSync(`git clone ${skillEntry.installUrl} ${skillDir}`, {
          stdio: 'pipe',
        });
      } else if (skillEntry.source === 'npm') {
        // Install from npm
        execSync(`npm pack ${skillEntry.installUrl}`, { cwd: skillDir, stdio: 'pipe' });
      }
      
      // Install dependencies
      if (existsSync(path.join(skillDir, 'package.json'))) {
        execSync('npm install', { cwd: skillDir, stdio: 'pipe' });
      }
      
      // Load manifest
      const manifestPath = path.join(skillDir, 'skill.json');
      let manifest: SkillManifest | null = null;
      
      if (existsSync(manifestPath)) {
        const content = await readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(content);
      }
      
      // Check for required secrets
      const missingSecrets = manifest?.secrets
        ?.filter(s => s.required && !process.env[s.name])
        .map(s => s.name) || [];
      
      let message = `✅ Installed skill: ${name} v${skillEntry.version}`;
      
      if (missingSecrets.length > 0) {
        message += `\n\n⚠️ Missing required secrets:\n`;
        for (const secretName of missingSecrets) {
          const secret = manifest?.secrets?.find(s => s.name === secretName);
          message += `- ${secretName}: ${secret?.description || ''}\n`;
          if (secret?.helpUrl) {
            message += `  Get it at: ${secret.helpUrl}\n`;
          }
        }
        message += `\nSet secrets with: marketclaw config set <NAME> <value>`;
      }
      
      // Try to load the skill
      await skillLoader.load(name);
      
      return {
        success: true,
        message,
        data: {
          name: skillEntry.name,
          version: skillEntry.version,
          path: skillDir,
          missingSecrets,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to install skill: ${error instanceof Error ? error.message : error}`,
      };
    }
  },
};

// ============ List Installed Skills ============
export const listSkillsTool: Tool = {
  name: 'list_installed_skills',
  description: 'List all installed skills',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const manifests = await skillLoader.discover();
    const loadedSkills = skillLoader.list();
    
    if (manifests.length === 0) {
      return {
        success: true,
        message: 'No skills installed. Use search_skills to find skills to install.',
        data: [],
      };
    }
    
    const skills = manifests.map(m => {
      const loaded = loadedSkills.find(s => s.name === m.name);
      return {
        name: m.name,
        version: m.version,
        description: m.description,
        status: loaded?.isReady() ? 'active' : 'inactive',
        tools: m.tools,
      };
    });
    
    return {
      success: true,
      message: `${skills.length} skill(s) installed`,
      data: skills,
    };
  },
};

// ============ Skill Info ============
export const skillInfoTool: Tool = {
  name: 'skill_info',
  description: 'Get detailed information about a skill',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Skill name',
      },
    },
    required: ['name'],
  },

  async execute(params): Promise<ToolResult> {
    const { name } = params;
    
    // Check installed
    const manifests = await skillLoader.discover();
    const manifest = manifests.find(m => m.name.toLowerCase() === name.toLowerCase());
    
    if (!manifest) {
      // Check registry
      const registryEntry = SKILL_REGISTRY.find(s => s.name.toLowerCase() === name.toLowerCase());
      
      if (registryEntry) {
        return {
          success: true,
          message: `Skill "${name}" is available but not installed.`,
          data: {
            ...registryEntry,
            installed: false,
          },
        };
      }
      
      return {
        success: false,
        message: `Skill "${name}" not found.`,
      };
    }
    
    const loadedSkill = skillLoader.get(name);
    
    return {
      success: true,
      message: `Skill: ${manifest.displayName || manifest.name}`,
      data: {
        name: manifest.name,
        displayName: manifest.displayName,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        repository: manifest.repository,
        tools: manifest.tools,
        secrets: manifest.secrets?.map(s => ({
          name: s.name,
          description: s.description,
          required: s.required,
          configured: !!process.env[s.name],
        })),
        installed: true,
        active: loadedSkill?.isReady() || false,
      },
    };
  },
};

// ============ Uninstall Skill ============
export const uninstallSkillTool: Tool = {
  name: 'uninstall_skill',
  description: 'Uninstall a skill',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the skill to uninstall',
      },
    },
    required: ['name'],
  },

  async execute(params): Promise<ToolResult> {
    const { name } = params;
    const skillDir = path.join(SKILLS_DIR, name);
    
    if (!existsSync(skillDir)) {
      return {
        success: false,
        message: `Skill "${name}" is not installed.`,
      };
    }
    
    try {
      // Unload skill
      await skillLoader.unload(name);
      
      // Remove directory
      const { rm } = await import('fs/promises');
      await rm(skillDir, { recursive: true, force: true });
      
      return {
        success: true,
        message: `Uninstalled skill: ${name}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to uninstall: ${error instanceof Error ? error.message : error}`,
      };
    }
  },
};

// Export all marketplace tools
export const marketplaceTools: Tool[] = [
  searchSkillsTool,
  installSkillTool,
  listSkillsTool,
  skillInfoTool,
  uninstallSkillTool,
];
