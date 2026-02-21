/**
 * Team Manager
 * Handles user management, roles, and permissions
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { Team, TeamMember, Role, Permission, PendingInvite, BUILTIN_ROLES } from './types.js';
import pino from 'pino';

const logger = pino({ name: 'team' });

const WORKSPACE = path.join(homedir(), '.marketclaw', 'workspace');
const TEAM_FILE = path.join(WORKSPACE, 'team.json');

function generateId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

class TeamManager {
  private team: Team | null = null;
  private pendingInvites: PendingInvite[] = [];

  /**
   * Initialize team (create default if none exists)
   */
  async init(adminTelegramId?: number): Promise<void> {
    await mkdir(WORKSPACE, { recursive: true });

    if (existsSync(TEAM_FILE)) {
      const data = await readFile(TEAM_FILE, 'utf-8');
      this.team = JSON.parse(data);
      logger.info({ members: this.team?.members.length }, 'Team loaded');
    } else if (adminTelegramId) {
      // Create initial team with admin
      this.team = {
        id: 'default',
        name: 'My Team',
        roles: [...BUILTIN_ROLES],
        members: [{
          id: generateId(),
          telegramId: adminTelegramId,
          name: 'Admin',
          defaultRole: 'admin',
          status: 'active',
          joinedAt: new Date().toISOString(),
        }],
        settings: {
          defaultRole: 'viewer',
          requireApproval: true,
          allowSelfRegister: false,
        },
        createdAt: new Date().toISOString(),
        createdBy: 'setup',
      };
      await this.save();
      logger.info({ adminTelegramId }, 'Team created with admin');
    }
  }

  /**
   * Save team to disk
   */
  async save(): Promise<void> {
    if (!this.team) return;
    await writeFile(TEAM_FILE, JSON.stringify(this.team, null, 2));
  }

  /**
   * Get team
   */
  getTeam(): Team | null {
    return this.team;
  }

  /**
   * Find member by channel ID
   */
  findMember(opts: { telegramId?: number; discordId?: string; slackId?: string; email?: string }): TeamMember | undefined {
    if (!this.team) return undefined;
    
    return this.team.members.find(m => {
      if (opts.telegramId && m.telegramId === opts.telegramId) return true;
      if (opts.discordId && m.discordId === opts.discordId) return true;
      if (opts.slackId && m.slackId === opts.slackId) return true;
      if (opts.email && m.email === opts.email) return true;
      return false;
    });
  }

  /**
   * Get member by ID
   */
  getMember(id: string): TeamMember | undefined {
    return this.team?.members.find(m => m.id === id);
  }

  /**
   * List all members
   */
  listMembers(includeInactive = false): TeamMember[] {
    if (!this.team) return [];
    return includeInactive 
      ? this.team.members 
      : this.team.members.filter(m => m.status === 'active');
  }

  /**
   * Get effective role for a member on a product
   */
  getMemberRole(member: TeamMember, productId?: string): string {
    // Check product-specific role first
    if (productId && member.productRoles?.[productId]) {
      return member.productRoles[productId];
    }
    // Fall back to default role
    return member.defaultRole;
  }

  /**
   * Check if user has permission (optionally for a specific product)
   */
  hasPermission(member: TeamMember, permission: Permission, productId?: string): boolean {
    // Direct permissions override (global)
    if (member.permissions?.includes(permission)) return true;
    if (member.permissions?.includes('admin')) return true;

    // Get the role for this context
    const roleId = this.getMemberRole(member, productId);
    const role = this.getRole(roleId);
    
    if (role?.permissions.includes(permission)) return true;
    if (role?.permissions.includes('admin')) return true;

    return false;
  }

  /**
   * Check permission by channel ID (optionally for a specific product)
   */
  checkPermission(opts: { telegramId?: number; discordId?: string; slackId?: string }, permission: Permission, productId?: string): boolean {
    const member = this.findMember(opts);
    if (!member) return false;
    if (member.status !== 'active') return false;
    return this.hasPermission(member, permission, productId);
  }

  /**
   * Is user an admin?
   */
  isAdmin(opts: { telegramId?: number; discordId?: string }): boolean {
    return this.checkPermission(opts, 'admin');
  }

  /**
   * Get role by ID
   */
  getRole(id: string): Role | undefined {
    return this.team?.roles.find(r => r.id === id);
  }

  /**
   * List roles
   */
  listRoles(): Role[] {
    return this.team?.roles || [];
  }

  /**
   * Add a new member
   */
  async addMember(opts: {
    telegramId?: number;
    discordId?: string;
    slackId?: string;
    email?: string;
    name: string;
    defaultRole?: string;
    productRoles?: Record<string, string>;
    addedBy: string;
  }): Promise<TeamMember> {
    if (!this.team) throw new Error('Team not initialized');

    // Check if already exists
    const existing = this.findMember(opts);
    if (existing) {
      throw new Error('User already exists on team');
    }

    const member: TeamMember = {
      id: generateId(),
      telegramId: opts.telegramId,
      discordId: opts.discordId,
      slackId: opts.slackId,
      email: opts.email,
      name: opts.name,
      defaultRole: opts.defaultRole || this.team.settings.defaultRole,
      productRoles: opts.productRoles,
      status: 'active',
      invitedBy: opts.addedBy,
      joinedAt: new Date().toISOString(),
    };

    this.team.members.push(member);
    await this.save();

    logger.info({ memberId: member.id, name: member.name }, 'Member added');
    return member;
  }

  /**
   * Update member
   */
  async updateMember(id: string, updates: Partial<TeamMember>): Promise<TeamMember | undefined> {
    if (!this.team) return undefined;

    const member = this.getMember(id);
    if (!member) return undefined;

    Object.assign(member, updates);
    member.lastActiveAt = new Date().toISOString();
    
    await this.save();
    return member;
  }

  /**
   * Assign default role to member
   */
  async assignDefaultRole(memberId: string, role: string): Promise<TeamMember | undefined> {
    return this.updateMember(memberId, { defaultRole: role });
  }

  /**
   * Assign role for a specific product
   */
  async assignProductRole(memberId: string, productId: string, role: string): Promise<TeamMember | undefined> {
    const member = this.getMember(memberId);
    if (!member) return undefined;

    const productRoles = { ...(member.productRoles || {}), [productId]: role };
    return this.updateMember(memberId, { productRoles });
  }

  /**
   * Remove product-specific role (falls back to default)
   */
  async removeProductRole(memberId: string, productId: string): Promise<TeamMember | undefined> {
    const member = this.getMember(memberId);
    if (!member || !member.productRoles) return member;

    const productRoles = { ...member.productRoles };
    delete productRoles[productId];
    return this.updateMember(memberId, { productRoles });
  }

  /**
   * Remove member
   */
  async removeMember(id: string): Promise<boolean> {
    if (!this.team) return false;

    const idx = this.team.members.findIndex(m => m.id === id);
    if (idx < 0) return false;

    this.team.members.splice(idx, 1);
    await this.save();

    logger.info({ memberId: id }, 'Member removed');
    return true;
  }

  /**
   * Suspend member
   */
  async suspendMember(id: string): Promise<TeamMember | undefined> {
    return this.updateMember(id, { status: 'suspended' });
  }

  /**
   * Reactivate member
   */
  async activateMember(id: string): Promise<TeamMember | undefined> {
    return this.updateMember(id, { status: 'active' });
  }

  /**
   * Update member's personal memory
   */
  async updateMemberMemory(id: string, key: string, value: unknown): Promise<void> {
    const member = this.getMember(id);
    if (!member) return;

    member.memory = member.memory || {};
    member.memory[key] = value;
    await this.save();
  }

  /**
   * Record member activity
   */
  async recordActivity(opts: { telegramId?: number; discordId?: string }): Promise<void> {
    const member = this.findMember(opts);
    if (member) {
      member.lastActiveAt = new Date().toISOString();
      await this.save();
    }
  }

  /**
   * Create custom role
   */
  async createRole(role: Omit<Role, 'isBuiltin'>): Promise<Role> {
    if (!this.team) throw new Error('Team not initialized');

    const newRole: Role = { ...role, isBuiltin: false };
    this.team.roles.push(newRole);
    await this.save();

    return newRole;
  }

  /**
   * Delete custom role
   */
  async deleteRole(id: string): Promise<boolean> {
    if (!this.team) return false;

    const role = this.getRole(id);
    if (!role || role.isBuiltin) return false;

    const idx = this.team.roles.findIndex(r => r.id === id);
    if (idx >= 0) {
      this.team.roles.splice(idx, 1);
      await this.save();
      return true;
    }

    return false;
  }

  /**
   * Get permissions for display (optionally for a specific product)
   */
  getMemberPermissions(member: TeamMember, productId?: string): Permission[] {
    const perms = new Set<Permission>();

    // Direct permissions (global)
    member.permissions?.forEach(p => perms.add(p));

    // Get role for this context
    const roleId = this.getMemberRole(member, productId);
    const role = this.getRole(roleId);
    role?.permissions.forEach(p => perms.add(p));

    return Array.from(perms);
  }

  /**
   * Get all product roles for a member
   */
  getMemberProductRoles(member: TeamMember): Record<string, { role: string; permissions: Permission[] }> {
    const result: Record<string, { role: string; permissions: Permission[] }> = {};
    
    if (member.productRoles) {
      for (const [productId, roleId] of Object.entries(member.productRoles)) {
        const role = this.getRole(roleId);
        result[productId] = {
          role: roleId,
          permissions: role?.permissions || [],
        };
      }
    }

    return result;
  }
}

export const teamManager = new TeamManager();
