/**
 * Team & User Types
 * Multi-user support with roles and permissions
 */

/**
 * Available permissions
 */
export type Permission =
  | 'admin'           // Full access, manage team
  | 'manage_team'     // Add/remove users, assign roles
  | 'manage_products' // Create/edit products
  | 'manage_campaigns'// Create/edit campaigns
  | 'create_content'  // Draft posts and content
  | 'approve_content' // Approve content for posting
  | 'post'            // Actually post to channels
  | 'view_analytics'  // View metrics and reports
  | 'manage_leads'    // Add/edit leads
  | 'send_email'      // Send emails
  | 'use_agents';     // Delegate to sub-agents

/**
 * Pre-defined roles with permission sets
 */
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isBuiltin: boolean;
}

/**
 * Team member / user
 */
export interface TeamMember {
  id: string;                    // Internal ID
  
  // Identity (from channel)
  telegramId?: number;
  discordId?: string;
  slackId?: string;
  email?: string;
  
  // Profile
  name: string;
  displayName?: string;
  avatar?: string;
  
  // Access
  defaultRole: string;                        // Fallback role for products not listed
  productRoles?: Record<string, string>;      // Product-specific roles: { "proofping": "manager", "launchcrew": "viewer" }
  permissions?: Permission[];                 // Direct permissions (override, applies globally)
  status: 'pending' | 'active' | 'suspended';
  
  // Preferences
  preferences?: {
    voice?: 'professional' | 'casual' | 'friendly' | 'playful';
    defaultProduct?: string;
    timezone?: string;
    notifyOn?: string[];         // Events to notify about
  };
  
  // Memory (bot learns about this person)
  memory?: Record<string, unknown>;
  
  // Metadata
  invitedBy?: string;
  joinedAt: string;
  lastActiveAt?: string;
}

/**
 * Team configuration
 */
export interface Team {
  id: string;
  name: string;
  
  // Roles
  roles: Role[];
  
  // Members
  members: TeamMember[];
  
  // Settings
  settings: {
    defaultRole: string;         // Role for new members
    requireApproval: boolean;    // Admin must approve new members
    allowSelfRegister: boolean;  // Can users request access?
  };
  
  // Metadata
  createdAt: string;
  createdBy: string;
}

/**
 * Pending invite
 */
export interface PendingInvite {
  id: string;
  telegramId?: number;
  discordId?: string;
  email?: string;
  roles: string[];
  invitedBy: string;
  createdAt: string;
  expiresAt?: string;
  message?: string;
}

/**
 * Built-in roles
 */
export const BUILTIN_ROLES: Role[] = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full access — can manage team, post, and do everything',
    permissions: [
      'admin', 'manage_team', 'manage_products', 'manage_campaigns',
      'create_content', 'approve_content', 'post', 'view_analytics',
      'manage_leads', 'send_email', 'use_agents'
    ],
    isBuiltin: true,
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Can approve content, post, and manage campaigns (no team mgmt)',
    permissions: [
      'manage_products', 'manage_campaigns', 'create_content',
      'approve_content', 'post', 'view_analytics', 'manage_leads',
      'send_email', 'use_agents'
    ],
    isBuiltin: true,
  },
  {
    id: 'creator',
    name: 'Creator',
    description: 'Can create content and use agents, but cannot post/send directly',
    permissions: [
      'create_content', 'view_analytics', 'use_agents', 'manage_leads'
    ],
    isBuiltin: true,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'View-only — can see analytics but not create or send anything',
    permissions: [
      'view_analytics'
    ],
    isBuiltin: true,
  },
];
