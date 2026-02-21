/**
 * Skill Loader
 * Discovers, loads, and manages skills
 */

import { readFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { Skill, SkillManifest, SkillInstallResult } from './types.js';
import { Tool } from '../tools/types.js';
import { toolRegistry } from '../tools/registry.js';

const SKILLS_DIR = path.join(homedir(), '.marketclaw', 'skills');
const BUNDLED_SKILLS_DIR = path.join(process.cwd(), 'skills');

export class SkillLoader {
  private skills: Map<string, Skill> = new Map();
  private config: Record<string, any> = {};

  /**
   * Initialize skill loader with config
   */
  async init(config: Record<string, any> = {}): Promise<void> {
    this.config = config;
    
    // Ensure skills directory exists
    if (!existsSync(SKILLS_DIR)) {
      await mkdir(SKILLS_DIR, { recursive: true });
    }
  }

  /**
   * Discover all available skills
   */
  async discover(): Promise<SkillManifest[]> {
    const manifests: SkillManifest[] = [];

    // Check user skills directory
    if (existsSync(SKILLS_DIR)) {
      const userSkills = await this.discoverInDir(SKILLS_DIR);
      manifests.push(...userSkills);
    }

    // Check bundled skills
    if (existsSync(BUNDLED_SKILLS_DIR)) {
      const bundledSkills = await this.discoverInDir(BUNDLED_SKILLS_DIR);
      manifests.push(...bundledSkills);
    }

    return manifests;
  }

  private async discoverInDir(dir: string): Promise<SkillManifest[]> {
    const manifests: SkillManifest[] = [];
    
    try {
      const entries = await readdir(dir);
      
      for (const entry of entries) {
        const skillDir = path.join(dir, entry);
        const stats = await stat(skillDir);
        
        if (!stats.isDirectory()) continue;
        
        const manifestPath = path.join(skillDir, 'skill.json');
        if (!existsSync(manifestPath)) continue;
        
        try {
          const content = await readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(content) as SkillManifest;
          manifests.push(manifest);
        } catch (err) {
          console.warn(`Failed to load skill manifest: ${manifestPath}`, err);
        }
      }
    } catch (err) {
      console.warn(`Failed to read skills directory: ${dir}`, err);
    }
    
    return manifests;
  }

  /**
   * Load a skill by name
   */
  async load(name: string): Promise<Skill | null> {
    // Check if already loaded
    if (this.skills.has(name)) {
      return this.skills.get(name)!;
    }

    // Find skill directory
    const skillDir = await this.findSkillDir(name);
    if (!skillDir) {
      return null;
    }

    // Load manifest
    const manifestPath = path.join(skillDir, 'skill.json');
    if (!existsSync(manifestPath)) {
      console.error(`Skill ${name} missing skill.json`);
      return null;
    }

    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent) as SkillManifest;

    // Check secrets
    const missingSecrets = this.checkSecrets(manifest);
    if (missingSecrets.length > 0) {
      console.warn(`Skill ${name} missing secrets: ${missingSecrets.join(', ')}`);
    }

    // Load skill module
    try {
      const indexPath = path.join(skillDir, 'index.js');
      if (!existsSync(indexPath)) {
        // Try TypeScript
        const tsIndexPath = path.join(skillDir, 'index.ts');
        if (!existsSync(tsIndexPath)) {
          console.error(`Skill ${name} missing index.js or index.ts`);
          return null;
        }
      }

      const skillModule = await import(indexPath);
      const skill: Skill = skillModule.default || skillModule;

      // Initialize skill
      const skillConfig = this.config[name] || {};
      await skill.init(skillConfig);

      // Register skill
      this.skills.set(name, skill);

      // Register tools
      const tools = skill.getTools();
      for (const tool of tools) {
        toolRegistry.register(tool, { category: 'social' });
      }

      return skill;
    } catch (err) {
      console.error(`Failed to load skill ${name}:`, err);
      return null;
    }
  }

  private async findSkillDir(name: string): Promise<string | null> {
    // Check user skills
    const userSkillDir = path.join(SKILLS_DIR, name);
    if (existsSync(userSkillDir)) {
      return userSkillDir;
    }

    // Check bundled skills
    const bundledSkillDir = path.join(BUNDLED_SKILLS_DIR, name);
    if (existsSync(bundledSkillDir)) {
      return bundledSkillDir;
    }

    return null;
  }

  private checkSecrets(manifest: SkillManifest): string[] {
    const missing: string[] = [];
    
    for (const secret of manifest.secrets || []) {
      if (secret.required && !process.env[secret.name]) {
        missing.push(secret.name);
      }
    }
    
    return missing;
  }

  /**
   * Load all enabled skills
   */
  async loadAll(): Promise<void> {
    const manifests = await this.discover();
    
    for (const manifest of manifests) {
      const skillConfig = this.config[manifest.name];
      
      // Skip if explicitly disabled
      if (skillConfig?.enabled === false) {
        continue;
      }
      
      await this.load(manifest.name);
    }
  }

  /**
   * Get a loaded skill
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * List loaded skills
   */
  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Unload a skill
   */
  async unload(name: string): Promise<boolean> {
    const skill = this.skills.get(name);
    if (!skill) return false;

    // Shutdown
    await skill.shutdown();

    // Unregister tools
    for (const tool of skill.getTools()) {
      toolRegistry.unregister(tool.name);
    }

    this.skills.delete(name);
    return true;
  }

  /**
   * Shutdown all skills
   */
  async shutdownAll(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.shutdown();
    }
    this.skills.clear();
  }

  /**
   * Get skills directory path
   */
  getSkillsDir(): string {
    return SKILLS_DIR;
  }
}

// Singleton
export const skillLoader = new SkillLoader();
