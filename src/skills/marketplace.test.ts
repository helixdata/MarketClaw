/**
 * Tests for Marketplace Tools
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  searchSkillsTool,
  installSkillTool,
  listSkillsTool,
  skillInfoTool,
  uninstallSkillTool,
  marketplaceTools,
} from './marketplace.js';
import type { SkillManifest, Skill } from './types.js';

// Mock dependencies
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('./loader.js', () => ({
  skillLoader: {
    discover: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    load: vi.fn(),
    unload: vi.fn(),
  },
}));

import { mkdir, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { skillLoader } from './loader.js';

// Helper to create mock manifest
function createMockManifest(name: string, options?: Partial<SkillManifest>): SkillManifest {
  return {
    name,
    version: '1.0.0',
    description: `Test skill ${name}`,
    tools: [`${name}_tool`],
    ...options,
  };
}

// Helper to create mock skill
function createMockSkill(name: string, ready = true): Skill {
  return {
    name,
    manifest: createMockManifest(name),
    init: vi.fn(),
    getTools: vi.fn().mockReturnValue([]),
    shutdown: vi.fn(),
    isReady: vi.fn().mockReturnValue(ready),
  };
}

describe('Marketplace Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('marketplaceTools export', () => {
    it('should export all marketplace tools', () => {
      expect(marketplaceTools).toHaveLength(5);
      expect(marketplaceTools.map(t => t.name)).toEqual([
        'search_skills',
        'install_skill',
        'list_installed_skills',
        'skill_info',
        'uninstall_skill',
      ]);
    });
  });

  describe('searchSkillsTool', () => {
    it('should have correct metadata', () => {
      expect(searchSkillsTool.name).toBe('search_skills');
      expect(searchSkillsTool.description).toContain('Search');
      expect(searchSkillsTool.parameters.properties).toHaveProperty('query');
    });

    it('should return all skills when no query provided', async () => {
      const result = await searchSkillsTool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should filter skills by name', async () => {
      const result = await searchSkillsTool.execute({ query: 'twitter' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.some((s: any) => s.name === 'twitter')).toBe(true);
    });

    it('should filter skills by description', async () => {
      const result = await searchSkillsTool.execute({ query: 'professional' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.some((s: any) => s.name === 'linkedin')).toBe(true);
    });

    it('should filter skills by tags', async () => {
      const result = await searchSkillsTool.execute({ query: 'social' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', async () => {
      const result = await searchSkillsTool.execute({ query: 'nonexistent-skill-xyz' });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.message).toContain('No skills found');
    });

    it('should be case insensitive', async () => {
      const result = await searchSkillsTool.execute({ query: 'TWITTER' });
      
      expect(result.success).toBe(true);
      expect(result.data.some((s: any) => s.name === 'twitter')).toBe(true);
    });

    it('should return correct data shape', async () => {
      const result = await searchSkillsTool.execute({ query: 'twitter' });
      
      expect(result.success).toBe(true);
      const skill = result.data.find((s: any) => s.name === 'twitter');
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('version');
      expect(skill).toHaveProperty('tags');
    });
  });

  describe('installSkillTool', () => {
    it('should have correct metadata', () => {
      expect(installSkillTool.name).toBe('install_skill');
      expect(installSkillTool.description).toContain('Install');
      expect(installSkillTool.parameters.required).toContain('name');
    });

    it('should return error for unknown skill', async () => {
      const result = await installSkillTool.execute({ name: 'nonexistent-skill' });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
      expect(result.message).toContain('search_skills');
    });

    it('should return error if skill already installed', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      const result = await installSkillTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already installed');
      expect(result.message).toContain('upgrade_skill');
    });

    it('should clone from GitHub for github source', async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        // Skill not installed, but package.json exists after clone
        return path.includes('package.json');
      });
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));
      vi.mocked(skillLoader.load).mockResolvedValue(createMockSkill('twitter'));
      
      const result = await installSkillTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('git clone'),
        expect.anything()
      );
      expect(execSync).toHaveBeenCalledWith(
        'npm install',
        expect.anything()
      );
    });

    it('should install npm dependencies if package.json exists', async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        if (path.includes('twitter') && !path.includes('package.json')) return false;
        return path.includes('package.json');
      });
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));
      vi.mocked(skillLoader.load).mockResolvedValue(createMockSkill('twitter'));
      
      await installSkillTool.execute({ name: 'twitter' });
      
      expect(execSync).toHaveBeenCalledWith(
        'npm install',
        expect.objectContaining({ cwd: expect.stringContaining('twitter') })
      );
    });

    it('should report missing required secrets', async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        if (path.includes('.marketclaw/skills/twitter') && !path.includes('/')) return false;
        return path.includes('package.json') || path.includes('skill.json');
      });
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        name: 'twitter',
        version: '1.0.0',
        description: 'Twitter skill',
        tools: ['post_tweet'],
        secrets: [
          { name: 'TWITTER_API_KEY', description: 'Your API key', required: true, helpUrl: 'https://dev.twitter.com' },
        ],
      }));
      vi.mocked(skillLoader.load).mockResolvedValue(createMockSkill('twitter'));
      
      // Ensure env var is not set
      const originalEnv = process.env.TWITTER_API_KEY;
      delete process.env.TWITTER_API_KEY;
      
      const result = await installSkillTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('TWITTER_API_KEY');
      expect(result.message).toContain('Missing required secrets');
      expect(result.data.missingSecrets).toContain('TWITTER_API_KEY');
      
      if (originalEnv) process.env.TWITTER_API_KEY = originalEnv;
    });

    it('should load the skill after installation', async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('package.json');
      });
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));
      vi.mocked(skillLoader.load).mockResolvedValue(createMockSkill('twitter'));
      
      await installSkillTool.execute({ name: 'twitter' });
      
      expect(skillLoader.load).toHaveBeenCalledWith('twitter');
    });

    it('should handle installation errors', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('git clone failed');
      });
      
      const result = await installSkillTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to install');
      expect(result.message).toContain('git clone failed');
    });

    it('should be case insensitive for skill names', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      const result = await installSkillTool.execute({ name: 'TWITTER' });
      
      // Should find twitter regardless of case (and fail because already installed)
      expect(result.message).toContain('already installed');
    });
  });

  describe('listSkillsTool', () => {
    it('should have correct metadata', () => {
      expect(listSkillsTool.name).toBe('list_installed_skills');
      expect(listSkillsTool.description).toContain('List');
    });

    it('should return empty list when no skills installed', async () => {
      vi.mocked(skillLoader.discover).mockResolvedValue([]);
      vi.mocked(skillLoader.list).mockReturnValue([]);
      
      const result = await listSkillsTool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.message).toContain('No skills installed');
    });

    it('should list installed skills with status', async () => {
      const manifest1 = createMockManifest('twitter');
      const manifest2 = createMockManifest('linkedin');
      
      vi.mocked(skillLoader.discover).mockResolvedValue([manifest1, manifest2]);
      vi.mocked(skillLoader.list).mockReturnValue([
        createMockSkill('twitter', true),
      ]);
      
      const result = await listSkillsTool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.message).toContain('2 skill(s)');
      
      const twitter = result.data.find((s: any) => s.name === 'twitter');
      const linkedin = result.data.find((s: any) => s.name === 'linkedin');
      
      expect(twitter.status).toBe('active');
      expect(linkedin.status).toBe('inactive');
    });

    it('should include tool names in response', async () => {
      const manifest = createMockManifest('twitter', { tools: ['post_tweet', 'get_timeline'] });
      vi.mocked(skillLoader.discover).mockResolvedValue([manifest]);
      vi.mocked(skillLoader.list).mockReturnValue([]);
      
      const result = await listSkillsTool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data[0].tools).toEqual(['post_tweet', 'get_timeline']);
    });
  });

  describe('skillInfoTool', () => {
    it('should have correct metadata', () => {
      expect(skillInfoTool.name).toBe('skill_info');
      expect(skillInfoTool.description).toContain('information');
      expect(skillInfoTool.parameters.required).toContain('name');
    });

    it('should return installed skill info', async () => {
      const manifest = createMockManifest('twitter', {
        displayName: 'Twitter',
        author: 'MarketClaw',
        repository: 'https://github.com/marketclaw/skill-twitter',
        secrets: [
          { name: 'TWITTER_API_KEY', description: 'API Key', required: true },
        ],
      });
      
      vi.mocked(skillLoader.discover).mockResolvedValue([manifest]);
      vi.mocked(skillLoader.get).mockReturnValue(createMockSkill('twitter', true));
      
      process.env.TWITTER_API_KEY = 'test-key';
      
      const result = await skillInfoTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(true);
      expect(result.data.installed).toBe(true);
      expect(result.data.active).toBe(true);
      expect(result.data.secrets[0].configured).toBe(true);
      
      delete process.env.TWITTER_API_KEY;
    });

    it('should show unconfigured secrets', async () => {
      const manifest = createMockManifest('twitter', {
        secrets: [
          { name: 'TWITTER_SECRET_XYZ', description: 'Secret', required: true },
        ],
      });
      
      vi.mocked(skillLoader.discover).mockResolvedValue([manifest]);
      vi.mocked(skillLoader.get).mockReturnValue(createMockSkill('twitter', false));
      
      const originalEnv = process.env.TWITTER_SECRET_XYZ;
      delete process.env.TWITTER_SECRET_XYZ;
      
      const result = await skillInfoTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(true);
      expect(result.data.secrets[0].configured).toBe(false);
      
      if (originalEnv) process.env.TWITTER_SECRET_XYZ = originalEnv;
    });

    it('should return registry info for uninstalled skill', async () => {
      vi.mocked(skillLoader.discover).mockResolvedValue([]);
      
      const result = await skillInfoTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(true);
      expect(result.data.installed).toBe(false);
      expect(result.message).toContain('not installed');
    });

    it('should return error for unknown skill', async () => {
      vi.mocked(skillLoader.discover).mockResolvedValue([]);
      
      const result = await skillInfoTool.execute({ name: 'totally-unknown-skill' });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should be case insensitive', async () => {
      vi.mocked(skillLoader.discover).mockResolvedValue([]);
      
      const result = await skillInfoTool.execute({ name: 'TWITTER' });
      
      // Should find twitter in registry
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('twitter');
    });
  });

  describe('uninstallSkillTool', () => {
    it('should have correct metadata', () => {
      expect(uninstallSkillTool.name).toBe('uninstall_skill');
      expect(uninstallSkillTool.description).toContain('Uninstall');
      expect(uninstallSkillTool.parameters.required).toContain('name');
    });

    it('should return error if skill not installed', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = await uninstallSkillTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not installed');
    });

    it('should unload skill before removing', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(skillLoader.unload).mockResolvedValue(true);
      vi.mocked(rm).mockResolvedValue(undefined);
      
      const result = await uninstallSkillTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(true);
      expect(skillLoader.unload).toHaveBeenCalledWith('twitter');
    });

    it('should remove skill directory', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(skillLoader.unload).mockResolvedValue(true);
      vi.mocked(rm).mockResolvedValue(undefined);
      
      const result = await uninstallSkillTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(true);
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('twitter'),
        { recursive: true, force: true }
      );
    });

    it('should handle uninstall errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(skillLoader.unload).mockRejectedValue(new Error('Permission denied'));
      
      const result = await uninstallSkillTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to uninstall');
      expect(result.message).toContain('Permission denied');
    });

    it('should return success message on completion', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(skillLoader.unload).mockResolvedValue(true);
      vi.mocked(rm).mockResolvedValue(undefined);
      
      const result = await uninstallSkillTool.execute({ name: 'twitter' });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Uninstalled');
      expect(result.message).toContain('twitter');
    });
  });
});
