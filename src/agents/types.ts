/**
 * Sub-Agent Types
 * Defines the interface for specialized sub-agents
 */

export type AgentVoice = 'professional' | 'casual' | 'friendly' | 'playful';

/**
 * Sub-agent identity configuration
 */
export interface AgentIdentity {
  name: string;
  emoji: string;
  persona?: string;
  voice?: AgentVoice;
}

/**
 * Sub-agent specialty definition
 */
export interface AgentSpecialty {
  id: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  tools?: string[];           // Specific tools this agent can use (empty = all)
  requiredTools?: string[];   // Tools that must be available
}

/**
 * Sub-agent configuration
 */
export interface SubAgentConfig {
  // Identity
  identity: AgentIdentity;
  
  // Specialty
  specialty: AgentSpecialty;
  
  // Model override (optional)
  model?: string;
  
  // Whether this agent is enabled
  enabled: boolean;
  
  // Max concurrent tasks
  maxConcurrent?: number;
  
  // Task timeout in ms (default: 120000 = 2 min)
  taskTimeoutMs?: number;
  
  // Max tool iterations per task (default: 10)
  maxIterations?: number;
}

/**
 * Task for a sub-agent to execute
 */
export interface AgentTask {
  id: string;
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  /** If true, send notification when task completes (for async tasks) */
  notifyOnComplete?: boolean;
  /** User/chat to notify (for async tasks) */
  notifyTarget?: string;
}

/**
 * Sub-agent runtime state
 */
export interface SubAgentState {
  config: SubAgentConfig;
  activeTasks: AgentTask[];
  completedTasks: AgentTask[];
  isRunning: boolean;
}

/**
 * Built-in specialty IDs
 */
export type BuiltinSpecialty = 
  | 'twitter'
  | 'linkedin'
  | 'email'
  | 'creative'
  | 'analyst'
  | 'researcher'
  | 'producthunt';

/**
 * Sub-agent manifest (for modular loading)
 */
export interface SubAgentManifest {
  id: string;
  version: string;
  identity: AgentIdentity;
  specialty: Omit<AgentSpecialty, 'id'>;
  defaultModel?: string;
  author?: string;
  description?: string;
}
