/**
 * Skill System Types
 * Modular, installable capabilities for MarketClaw
 */

import { Tool, ToolResult } from '../tools/types.js';

/**
 * Skill manifest (skill.json)
 */
export interface SkillManifest {
  /** Unique skill identifier */
  name: string;
  
  /** Display name */
  displayName?: string;
  
  /** Version (semver) */
  version: string;
  
  /** Description */
  description: string;
  
  /** Author */
  author?: string;
  
  /** Repository URL */
  repository?: string;
  
  /** Tool names this skill provides */
  tools: string[];
  
  /** Config schema (JSON Schema) */
  config?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  
  /** Required secrets */
  secrets?: SkillSecret[];
  
  /** Dependencies */
  dependencies?: {
    node?: string;
    marketclaw?: string;
    skills?: string[];
  };
  
  /** Tags for discovery */
  tags?: string[];
}

export interface SkillSecret {
  /** Environment variable name */
  name: string;
  
  /** Description for user */
  description: string;
  
  /** Is this required? */
  required: boolean;
  
  /** Help text for setup */
  helpUrl?: string;
}

/**
 * Loaded skill instance
 */
export interface Skill {
  /** Skill name */
  name: string;
  
  /** Skill manifest */
  manifest: SkillManifest;
  
  /** Initialize the skill */
  init(config: any): Promise<void>;
  
  /** Get tools provided by this skill */
  getTools(): Tool[];
  
  /** Shutdown/cleanup */
  shutdown(): Promise<void>;
  
  /** Is the skill ready? */
  isReady(): boolean;
}

/**
 * Skill installation result
 */
export interface SkillInstallResult {
  success: boolean;
  skill?: SkillManifest;
  message: string;
  missingSecrets?: string[];
}

/**
 * Skill from registry
 */
export interface SkillRegistryEntry {
  name: string;
  version: string;
  description: string;
  author?: string;
  repository?: string;
  downloads?: number;
  tags?: string[];
  source: 'npm' | 'github' | 'local';
  installUrl: string;
}
