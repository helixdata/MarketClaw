/**
 * Tests for SkillLoader
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkillLoader } from './loader.js';
import type { Skill, SkillManifest } from './types.js';
import type { Tool, ToolResult } from '../tools/types.js';

// Mock dependencies
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

vi.mock('../tools/registry.js', () => ({
  toolRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
  },
}));

import { readFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { toolRegistry } from '../tools/registry.js';

// Helper to create mock skill
function createMockSkill(name: string, ready = true): Skill {
  const mockTool: Tool = {
    name: `${name}_tool`,
    description: `Tool for ${name}`,
    parameters: { type: 'object', properties: {} },
    execute: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  };

  return {
    name,
    manifest: {
      name,
      version: '1.0.0',
      description: `Test skill ${name}`,
      tools: [`${name}_tool`],
    },
    init: vi.fn().mockResolvedValue(undefined),
    getTools: vi.fn().mockReturnValue([mockTool]),
    shutdown: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(ready),
  };
}

// Helper to create mock manifest
function createMockManifest(name: string, secrets?: { name: string; required: boolean }[]): SkillManifest {
  return {
    name,
    version: '1.0.0',
    description: `Test skill ${name}`,
    tools: [`${name}_tool`],
    secrets: secrets?.map(s => ({ ...s, description: `Secret ${s.name}` })),
  };
}

describe('SkillLoader', () => {
  let loader: SkillLoader;

  beforeEach(() => {
    loader = new SkillLoader();
    vi.clearAllMocks();
    
    // Default mocks
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(mkdir).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('init', () => {
    it('should create skills directory if it does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      await loader.init();
      
      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.marketclaw/skills'),
        { recursive: true }
      );
    });

    it('should not create directory if it exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      await loader.init();
      
      expect(mkdir).not.toHaveBeenCalled();
    });

    it('should store config', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const config = { twitter: { enabled: true } };
      
      await loader.init(config);
      
      // Config is stored internally - we can verify through load behavior
      expect(loader.getSkillsDir()).toContain('.marketclaw/skills');
    });
  });

  describe('discover', () => {
    it('should return empty array when no skills directories exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const manifests = await loader.discover();
      
      expect(manifests).toEqual([]);
    });

    it('should discover skills from user directory', async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('.marketclaw/skills') || path.includes('skill.json');
      });
      vi.mocked(readdir).mockResolvedValue(['twitter', 'linkedin'] as any);
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(createMockManifest('test')));
      
      const manifests = await loader.discover();
      
      expect(manifests.length).toBeGreaterThan(0);
    });

    it('should skip non-directory entries', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue(['README.md', 'twitter'] as any);
      vi.mocked(stat).mockImplementation(async (path: any) => ({
        isDirectory: () => !path.includes('README'),
      }) as any);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(createMockManifest('twitter')));
      
      const manifests = await loader.discover();
      
      // Should only include directories with skill.json
      expect(readFile).toHaveBeenCalledWith(
        expect.stringContaining('twitter/skill.json'),
        'utf-8'
      );
    });

    it('should skip directories without skill.json', async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        if (path.includes('skill.json')) return false;
        return path.includes('.marketclaw/skills');
      });
      vi.mocked(readdir).mockResolvedValue(['incomplete-skill'] as any);
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
      
      const manifests = await loader.discover();
      
      expect(manifests).toEqual([]);
      expect(readFile).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in skill.json', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue(['broken-skill'] as any);
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(readFile).mockResolvedValue('{ invalid json }');
      
      const manifests = await loader.discover();
      
      expect(manifests).toEqual([]);
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load skill manifest'),
        expect.anything()
      );
      
      consoleWarn.mockRestore();
    });

    it('should handle directory read errors', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockRejectedValue(new Error('Permission denied'));
      
      const manifests = await loader.discover();
      
      expect(manifests).toEqual([]);
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read skills directory'),
        expect.anything()
      );
      
      consoleWarn.mockRestore();
    });
  });

  describe('load', () => {
    it('should return null if skill directory not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const skill = await loader.load('nonexistent');
      
      expect(skill).toBeNull();
    });

    it('should return cached skill if already loaded', async () => {
      // First, load a skill manually into the cache
      const mockSkill = createMockSkill('cached-skill');
      
      // Access private skills map through any cast
      (loader as any).skills.set('cached-skill', mockSkill);
      
      const skill = await loader.load('cached-skill');
      
      expect(skill).toBe(mockSkill);
      // Should not try to read from filesystem
      expect(readFile).not.toHaveBeenCalled();
    });

    it('should return null if skill.json is missing', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(existsSync).mockImplementation((path: any) => {
        // Skill dir exists but not skill.json
        return path.includes('.marketclaw/skills/test-skill') && !path.includes('skill.json');
      });
      
      const skill = await loader.load('test-skill');
      
      expect(skill).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('missing skill.json')
      );
      
      consoleError.mockRestore();
    });

    it('should warn about missing required secrets', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalEnv = process.env.TWITTER_API_KEY;
      delete process.env.TWITTER_API_KEY;
      
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('test-skill') || path.includes('skill.json') || path.includes('index.js');
      });
      
      const manifest = createMockManifest('test-skill', [
        { name: 'TWITTER_API_KEY', required: true },
      ]);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(manifest));
      
      // Mock import - this is tricky since we can't easily mock dynamic imports
      // The load will fail at import step, but we can verify secret checking
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await loader.load('test-skill');
      
      // The warn call is a single string containing both parts
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('missing secrets: TWITTER_API_KEY')
      );
      
      // Restore
      if (originalEnv) process.env.TWITTER_API_KEY = originalEnv;
      consoleWarn.mockRestore();
      consoleError.mockRestore();
    });

    it('should not warn about missing optional secrets', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      vi.mocked(existsSync).mockReturnValue(true);
      
      const manifest = createMockManifest('test-skill', [
        { name: 'OPTIONAL_SECRET', required: false },
      ]);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(manifest));
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await loader.load('test-skill');
      
      // Should not warn about optional missing secrets
      expect(consoleWarn).not.toHaveBeenCalledWith(
        expect.stringContaining('OPTIONAL_SECRET')
      );
      
      consoleWarn.mockRestore();
      consoleError.mockRestore();
    });

    it('should not warn if required secrets are present', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.TEST_SECRET = 'test-value';
      
      vi.mocked(existsSync).mockReturnValue(true);
      
      const manifest = createMockManifest('test-skill', [
        { name: 'TEST_SECRET', required: true },
      ]);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(manifest));
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await loader.load('test-skill');
      
      // Should not warn when secret is present
      expect(consoleWarn).not.toHaveBeenCalledWith(
        expect.stringContaining('missing secrets')
      );
      
      delete process.env.TEST_SECRET;
      consoleWarn.mockRestore();
      consoleError.mockRestore();
    });

    it('should return null if index.js and index.ts are missing', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.mocked(existsSync).mockImplementation((path: any) => {
        // Only skill.json exists, not index files
        return path.includes('skill.json') || 
               (path.includes('test-skill') && !path.includes('index'));
      });
      
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(createMockManifest('test-skill')));
      
      const skill = await loader.load('test-skill');
      
      expect(skill).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('missing index.js or index.ts')
      );
      
      consoleError.mockRestore();
    });

    it('should prefer user skills over bundled skills', async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        // Both directories exist
        return path.includes('test-skill');
      });
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(createMockManifest('test-skill')));
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await loader.load('test-skill');
      
      // First existsSync call should be for user skills directory
      const calls = vi.mocked(existsSync).mock.calls;
      const firstCall = calls.find(c => c[0].toString().includes('test-skill'));
      expect(firstCall?.[0]).toContain('.marketclaw/skills');
      
      consoleError.mockRestore();
    });
  });

  describe('loadAll', () => {
    it('should load all discovered skills', async () => {
      // Only user skills dir exists, not bundled
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('.marketclaw/skills') && !path.includes('bundled');
      });
      vi.mocked(readdir).mockResolvedValue(['skill1', 'skill2'] as any);
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('skill1')) {
          return JSON.stringify(createMockManifest('skill1'));
        }
        return JSON.stringify(createMockManifest('skill2'));
      });
      
      const loadSpy = vi.spyOn(loader, 'load').mockResolvedValue(createMockSkill('test'));
      
      await loader.loadAll();
      
      // Should be called for each discovered skill
      expect(loadSpy).toHaveBeenCalledWith('skill1');
      expect(loadSpy).toHaveBeenCalledWith('skill2');
    });

    it('should skip explicitly disabled skills', async () => {
      await loader.init({ disabled_skill: { enabled: false } });
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue(['disabled_skill'] as any);
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(createMockManifest('disabled_skill')));
      
      const loadSpy = vi.spyOn(loader, 'load');
      
      await loader.loadAll();
      
      expect(loadSpy).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return undefined for non-loaded skill', () => {
      expect(loader.get('nonexistent')).toBeUndefined();
    });

    it('should return loaded skill', () => {
      const mockSkill = createMockSkill('test-skill');
      (loader as any).skills.set('test-skill', mockSkill);
      
      expect(loader.get('test-skill')).toBe(mockSkill);
    });
  });

  describe('list', () => {
    it('should return empty array when no skills loaded', () => {
      expect(loader.list()).toEqual([]);
    });

    it('should return all loaded skills', () => {
      const skill1 = createMockSkill('skill1');
      const skill2 = createMockSkill('skill2');
      (loader as any).skills.set('skill1', skill1);
      (loader as any).skills.set('skill2', skill2);
      
      const skills = loader.list();
      
      expect(skills).toHaveLength(2);
      expect(skills).toContain(skill1);
      expect(skills).toContain(skill2);
    });
  });

  describe('unload', () => {
    it('should return false for non-loaded skill', async () => {
      const result = await loader.unload('nonexistent');
      
      expect(result).toBe(false);
    });

    it('should shutdown and unregister skill', async () => {
      const mockSkill = createMockSkill('test-skill');
      (loader as any).skills.set('test-skill', mockSkill);
      
      const result = await loader.unload('test-skill');
      
      expect(result).toBe(true);
      expect(mockSkill.shutdown).toHaveBeenCalled();
      expect(toolRegistry.unregister).toHaveBeenCalledWith('test-skill_tool');
      expect(loader.get('test-skill')).toBeUndefined();
    });

    it('should unregister all tools from the skill', async () => {
      const mockTool1: Tool = {
        name: 'tool1',
        description: 'Tool 1',
        parameters: { type: 'object', properties: {} },
        execute: vi.fn(),
      };
      const mockTool2: Tool = {
        name: 'tool2',
        description: 'Tool 2',
        parameters: { type: 'object', properties: {} },
        execute: vi.fn(),
      };
      
      const mockSkill: Skill = {
        name: 'multi-tool-skill',
        manifest: createMockManifest('multi-tool-skill'),
        init: vi.fn(),
        getTools: vi.fn().mockReturnValue([mockTool1, mockTool2]),
        shutdown: vi.fn(),
        isReady: vi.fn().mockReturnValue(true),
      };
      
      (loader as any).skills.set('multi-tool-skill', mockSkill);
      
      await loader.unload('multi-tool-skill');
      
      expect(toolRegistry.unregister).toHaveBeenCalledWith('tool1');
      expect(toolRegistry.unregister).toHaveBeenCalledWith('tool2');
    });
  });

  describe('shutdownAll', () => {
    it('should shutdown all skills and clear map', async () => {
      const skill1 = createMockSkill('skill1');
      const skill2 = createMockSkill('skill2');
      (loader as any).skills.set('skill1', skill1);
      (loader as any).skills.set('skill2', skill2);
      
      await loader.shutdownAll();
      
      expect(skill1.shutdown).toHaveBeenCalled();
      expect(skill2.shutdown).toHaveBeenCalled();
      expect(loader.list()).toHaveLength(0);
    });
  });

  describe('getSkillsDir', () => {
    it('should return the skills directory path', () => {
      const dir = loader.getSkillsDir();
      
      expect(dir).toContain('.marketclaw');
      expect(dir).toContain('skills');
    });
  });
});
