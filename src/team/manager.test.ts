/**
 * Team Manager Tests
 * Tests the actual manager.ts module with mocked dependencies
 */

import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { BUILTIN_ROLES, Permission, TeamMember } from './types.js';

// Mock fs/promises BEFORE importing the manager
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Now import the actual module
import { teamManager } from './manager.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

describe('TeamManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the manager's internal state by re-initializing
    (existsSync as Mock).mockReturnValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('init', () => {
    it('should create team with admin member when no existing team', async () => {
      (existsSync as Mock).mockReturnValue(false);
      
      await teamManager.init(12345);
      
      const team = teamManager.getTeam();
      expect(team).not.toBeNull();
      expect(team!.members.length).toBeGreaterThanOrEqual(1);
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
    });

    it('should load existing team from file', async () => {
      const existingTeam = {
        id: 'existing',
        name: 'Existing Team',
        roles: [...BUILTIN_ROLES],
        members: [{
          id: 'user_existing_123',
          telegramId: 99999,
          name: 'Existing Admin',
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

      (existsSync as Mock).mockReturnValue(true);
      (readFile as Mock).mockResolvedValue(JSON.stringify(existingTeam));

      await teamManager.init();

      const team = teamManager.getTeam();
      expect(team).not.toBeNull();
      expect(readFile).toHaveBeenCalled();
    });

    it('should include builtin roles in new team', async () => {
      (existsSync as Mock).mockReturnValue(false);
      
      await teamManager.init(12345);
      
      const team = teamManager.getTeam();
      expect(team!.roles.find(r => r.id === 'admin')).toBeDefined();
      expect(team!.roles.find(r => r.id === 'manager')).toBeDefined();
      expect(team!.roles.find(r => r.id === 'creator')).toBeDefined();
      expect(team!.roles.find(r => r.id === 'viewer')).toBeDefined();
    });
  });

  describe('findMember', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should find member by telegramId', () => {
      const member = teamManager.findMember({ telegramId: 12345 });
      expect(member).toBeDefined();
      expect(member!.name).toBe('Admin');
    });

    it('should find member by discordId', async () => {
      await teamManager.addMember({
        discordId: 'discord123',
        name: 'Discord User',
        addedBy: 'admin',
      });
      
      const member = teamManager.findMember({ discordId: 'discord123' });
      expect(member).toBeDefined();
      expect(member!.name).toBe('Discord User');
    });

    it('should find member by slackId', async () => {
      await teamManager.addMember({
        slackId: 'slack123',
        name: 'Slack User',
        addedBy: 'admin',
      });
      
      const member = teamManager.findMember({ slackId: 'slack123' });
      expect(member).toBeDefined();
    });

    it('should find member by email', async () => {
      await teamManager.addMember({
        email: 'test@example.com',
        name: 'Email User',
        addedBy: 'admin',
      });
      
      const member = teamManager.findMember({ email: 'test@example.com' });
      expect(member).toBeDefined();
    });

    it('should return undefined for non-existent member', () => {
      const member = teamManager.findMember({ telegramId: 99999 });
      expect(member).toBeUndefined();
    });
  });

  describe('getMember', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should get member by ID', () => {
      const members = teamManager.listMembers();
      const member = teamManager.getMember(members[0].id);
      expect(member).toBeDefined();
    });

    it('should return undefined for non-existent ID', () => {
      const member = teamManager.getMember('nonexistent');
      expect(member).toBeUndefined();
    });
  });

  describe('listMembers', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should list active members', () => {
      const members = teamManager.listMembers();
      expect(members.length).toBeGreaterThanOrEqual(1);
      expect(members[0].status).toBe('active');
    });

    it('should include inactive members when requested', async () => {
      // Add a non-admin member to suspend (can't suspend the last admin)
      const newMember = await teamManager.addMember({
        telegramId: 99999,
        name: 'Test User',
        defaultRole: 'viewer',
        addedBy: 'admin',
      });
      await teamManager.suspendMember(newMember.id);
      
      const active = teamManager.listMembers(false);
      const allActive = active.every(m => m.status === 'active');
      
      const all = teamManager.listMembers(true);
      expect(all.length).toBeGreaterThan(active.length);
    });
  });

  describe('getMemberRole', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should return default role when no product specified', () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      const role = teamManager.getMemberRole(member);
      expect(role).toBe('admin');
    });

    it('should return default role when product has no specific role', () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      const role = teamManager.getMemberRole(member, 'unknown-product');
      expect(role).toBe('admin');
    });

    it('should return product-specific role when available', async () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      await teamManager.assignProductRole(member.id, 'product1', 'viewer');
      
      const updatedMember = teamManager.getMember(member.id)!;
      const role = teamManager.getMemberRole(updatedMember, 'product1');
      expect(role).toBe('viewer');
    });
  });

  describe('hasPermission', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should return true for admin permission on admin role', () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      expect(teamManager.hasPermission(member, 'admin')).toBe(true);
    });

    it('should return true for any permission when member has admin role', () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      expect(teamManager.hasPermission(member, 'create_content')).toBe(true);
      expect(teamManager.hasPermission(member, 'post')).toBe(true);
    });

    it('should check direct permissions', async () => {
      await teamManager.addMember({
        telegramId: 99999,
        name: 'Direct Perm User',
        defaultRole: 'viewer',
        addedBy: 'admin',
      });
      const member = teamManager.findMember({ telegramId: 99999 })!;
      // Assign direct permission
      await teamManager.updateMember(member.id, { permissions: ['post'] });
      const updated = teamManager.getMember(member.id)!;
      
      expect(teamManager.hasPermission(updated, 'post')).toBe(true);
    });

    it('should return true if direct permissions include admin', async () => {
      await teamManager.addMember({
        telegramId: 88888,
        name: 'Admin Perm User',
        defaultRole: 'viewer',
        addedBy: 'admin',
      });
      const member = teamManager.findMember({ telegramId: 88888 })!;
      await teamManager.updateMember(member.id, { permissions: ['admin'] });
      const updated = teamManager.getMember(member.id)!;
      
      expect(teamManager.hasPermission(updated, 'manage_team')).toBe(true);
    });

    it('should respect product-specific roles', async () => {
      await teamManager.addMember({
        telegramId: 77777,
        name: 'Multi Role User',
        defaultRole: 'viewer',
        addedBy: 'admin',
      });
      const member = teamManager.findMember({ telegramId: 77777 })!;
      await teamManager.assignProductRole(member.id, 'product1', 'manager');
      
      const updatedMember = teamManager.getMember(member.id)!;
      
      // Should have manager permissions on product1
      expect(teamManager.hasPermission(updatedMember, 'approve_content', 'product1')).toBe(true);
      
      // Should only have viewer permissions globally
      expect(teamManager.hasPermission(updatedMember, 'approve_content')).toBe(false);
    });
  });

  describe('checkPermission', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should check permission by channel ID', () => {
      expect(teamManager.checkPermission({ telegramId: 12345 }, 'admin')).toBe(true);
    });

    it('should return false for non-existent member', () => {
      expect(teamManager.checkPermission({ telegramId: 99999 }, 'admin')).toBe(false);
    });

    it('should return false for suspended member', async () => {
      // Add a non-admin member to suspend (can't suspend the last admin)
      const newMember = await teamManager.addMember({
        telegramId: 77777,
        name: 'Suspendable User',
        defaultRole: 'manager',
        addedBy: 'admin',
      });
      await teamManager.suspendMember(newMember.id);
      
      expect(teamManager.checkPermission({ telegramId: 77777 }, 'manage_products')).toBe(false);
    });

    it('should check permission for specific product', async () => {
      await teamManager.addMember({
        telegramId: 55555,
        name: 'Product User',
        defaultRole: 'viewer',
        addedBy: 'admin',
      });
      const member = teamManager.findMember({ telegramId: 55555 })!;
      await teamManager.assignProductRole(member.id, 'product1', 'manager');
      
      expect(teamManager.checkPermission({ telegramId: 55555 }, 'approve_content', 'product1')).toBe(true);
      expect(teamManager.checkPermission({ telegramId: 55555 }, 'approve_content')).toBe(false);
    });
  });

  describe('isAdmin', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should return true for admin', () => {
      expect(teamManager.isAdmin({ telegramId: 12345 })).toBe(true);
    });

    it('should return false for non-admin', async () => {
      await teamManager.addMember({
        telegramId: 44444,
        name: 'Regular User',
        defaultRole: 'viewer',
        addedBy: 'admin',
      });
      expect(teamManager.isAdmin({ telegramId: 44444 })).toBe(false);
    });

    it('should return false for non-existent user', () => {
      expect(teamManager.isAdmin({ telegramId: 99999 })).toBe(false);
    });
  });

  describe('getRole', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should get role by ID', () => {
      const role = teamManager.getRole('admin');
      expect(role).toBeDefined();
      expect(role!.name).toBe('Admin');
    });

    it('should return undefined for non-existent role', () => {
      const role = teamManager.getRole('nonexistent');
      expect(role).toBeUndefined();
    });
  });

  describe('listRoles', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should list all roles', () => {
      const roles = teamManager.listRoles();
      expect(roles.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('addMember', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should add a new member', async () => {
      const member = await teamManager.addMember({
        telegramId: 33333,
        name: 'New User',
        addedBy: 'admin',
      });
      
      expect(member.telegramId).toBe(33333);
      expect(member.name).toBe('New User');
      expect(member.defaultRole).toBe('viewer'); // team default
      expect(member.status).toBe('active');
    });

    it('should use provided role', async () => {
      const member = await teamManager.addMember({
        telegramId: 22222,
        name: 'Manager User',
        defaultRole: 'manager',
        addedBy: 'admin',
      });
      
      expect(member.defaultRole).toBe('manager');
    });

    it('should throw if member already exists', async () => {
      await expect(
        teamManager.addMember({
          telegramId: 12345,
          name: 'Duplicate',
          addedBy: 'admin',
        })
      ).rejects.toThrow('User already exists on team');
    });

    it('should set product roles when provided', async () => {
      const member = await teamManager.addMember({
        telegramId: 11111,
        name: 'Multi Product User',
        productRoles: { 'product1': 'manager', 'product2': 'viewer' },
        addedBy: 'admin',
      });
      
      expect(member.productRoles).toEqual({ 'product1': 'manager', 'product2': 'viewer' });
    });
  });

  describe('updateMember', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should update member fields', async () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      const updated = await teamManager.updateMember(member.id, { name: 'Updated Name' });
      
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.lastActiveAt).toBeDefined();
    });

    it('should return undefined for non-existent member', async () => {
      const result = await teamManager.updateMember('nonexistent', { name: 'Test' });
      expect(result).toBeUndefined();
    });
  });

  describe('assignDefaultRole', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should assign default role', async () => {
      // Add a non-admin member to reassign (can't demote the last admin)
      const newMember = await teamManager.addMember({
        telegramId: 88888,
        name: 'Role Test User',
        defaultRole: 'manager',
        addedBy: 'admin',
      });
      const updated = await teamManager.assignDefaultRole(newMember.id, 'creator');
      
      expect(updated!.defaultRole).toBe('creator');
    });

    it('should prevent demoting the last admin', async () => {
      const admin = teamManager.findMember({ telegramId: 12345 })!;
      
      await expect(teamManager.assignDefaultRole(admin.id, 'creator'))
        .rejects.toThrow('Cannot demote the last admin');
    });
  });

  describe('assignProductRole', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should assign product-specific role', async () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      const updated = await teamManager.assignProductRole(member.id, 'product1', 'viewer');
      
      expect(updated!.productRoles).toBeDefined();
      expect(updated!.productRoles!['product1']).toBe('viewer');
    });

    it('should add to existing product roles', async () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      await teamManager.assignProductRole(member.id, 'product1', 'viewer');
      const updated = await teamManager.assignProductRole(member.id, 'product2', 'manager');
      
      expect(updated!.productRoles!['product1']).toBe('viewer');
      expect(updated!.productRoles!['product2']).toBe('manager');
    });

    it('should return undefined for non-existent member', async () => {
      const result = await teamManager.assignProductRole('nonexistent', 'product1', 'viewer');
      expect(result).toBeUndefined();
    });
  });

  describe('removeProductRole', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should remove product role', async () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      await teamManager.assignProductRole(member.id, 'product1', 'viewer');
      await teamManager.assignProductRole(member.id, 'product2', 'manager');
      
      const updated = await teamManager.removeProductRole(member.id, 'product1');
      
      expect(updated!.productRoles!['product1']).toBeUndefined();
      expect(updated!.productRoles!['product2']).toBe('manager');
    });
  });

  describe('removeMember', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should remove member', async () => {
      await teamManager.addMember({
        telegramId: 55555,
        name: 'To Remove',
        addedBy: 'admin',
      });
      
      const member = teamManager.findMember({ telegramId: 55555 })!;
      const result = await teamManager.removeMember(member.id);
      
      expect(result).toBe(true);
      expect(teamManager.findMember({ telegramId: 55555 })).toBeUndefined();
    });

    it('should return false for non-existent member', async () => {
      const result = await teamManager.removeMember('nonexistent');
      expect(result).toBe(false);
    });

    it('should prevent removing the last admin', async () => {
      const admin = teamManager.findMember({ telegramId: 12345 })!;
      
      await expect(teamManager.removeMember(admin.id))
        .rejects.toThrow('Cannot remove the last admin');
    });
  });

  describe('suspendMember and activateMember', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should suspend member', async () => {
      await teamManager.addMember({
        telegramId: 66666,
        name: 'To Suspend',
        addedBy: 'admin',
      });
      const member = teamManager.findMember({ telegramId: 66666 })!;
      const updated = await teamManager.suspendMember(member.id);
      
      expect(updated!.status).toBe('suspended');
    });

    it('should activate member', async () => {
      await teamManager.addMember({
        telegramId: 77777,
        name: 'To Activate',
        addedBy: 'admin',
      });
      const member = teamManager.findMember({ telegramId: 77777 })!;
      await teamManager.suspendMember(member.id);
      const updated = await teamManager.activateMember(member.id);
      
      expect(updated!.status).toBe('active');
    });

    it('should prevent suspending the last admin', async () => {
      const admin = teamManager.findMember({ telegramId: 12345 })!;
      
      await expect(teamManager.suspendMember(admin.id))
        .rejects.toThrow('Cannot suspend the last admin');
    });
  });

  describe('updateMemberMemory', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should update member memory', async () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      await teamManager.updateMemberMemory(member.id, 'preference', 'value');
      
      const updated = teamManager.getMember(member.id)!;
      expect(updated.memory).toEqual({ preference: 'value' });
    });

    it('should handle non-existent member', async () => {
      // Should not throw
      await teamManager.updateMemberMemory('nonexistent', 'key', 'value');
    });
  });

  describe('recordActivity', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should record activity timestamp', async () => {
      const before = new Date().toISOString();
      await teamManager.recordActivity({ telegramId: 12345 });
      
      const member = teamManager.findMember({ telegramId: 12345 })!;
      expect(member.lastActiveAt).toBeDefined();
      expect(member.lastActiveAt! >= before).toBe(true);
    });

    it('should handle non-existent member', async () => {
      // Should not throw
      await teamManager.recordActivity({ telegramId: 99999 });
    });
  });

  describe('createRole', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should create custom role', async () => {
      const role = await teamManager.createRole({
        id: 'custom',
        name: 'Custom Role',
        description: 'A custom role',
        permissions: ['create_content', 'view_analytics'],
      });
      
      expect(role.isBuiltin).toBe(false);
      expect(teamManager.getRole('custom')).toBeDefined();
    });
  });

  describe('deleteRole', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should delete custom role', async () => {
      await teamManager.createRole({
        id: 'custom-to-delete',
        name: 'Custom',
        description: 'Test',
        permissions: [],
      });
      
      const result = await teamManager.deleteRole('custom-to-delete');
      expect(result).toBe(true);
      expect(teamManager.getRole('custom-to-delete')).toBeUndefined();
    });

    it('should not delete builtin role', async () => {
      const result = await teamManager.deleteRole('admin');
      expect(result).toBe(false);
      expect(teamManager.getRole('admin')).toBeDefined();
    });

    it('should return false for non-existent role', async () => {
      const result = await teamManager.deleteRole('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getMemberPermissions', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should return all permissions for admin', () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      const perms = teamManager.getMemberPermissions(member);
      
      expect(perms).toContain('admin');
      expect(perms).toContain('manage_team');
      expect(perms).toContain('create_content');
    });

    it('should include direct permissions', async () => {
      await teamManager.addMember({
        telegramId: 44444,
        name: 'Direct User',
        defaultRole: 'viewer',
        addedBy: 'admin',
      });
      const member = teamManager.findMember({ telegramId: 44444 })!;
      await teamManager.updateMember(member.id, { permissions: ['post'] });
      const updated = teamManager.getMember(member.id)!;
      
      const perms = teamManager.getMemberPermissions(updated);
      expect(perms).toContain('view_analytics'); // from viewer role
      expect(perms).toContain('post'); // direct permission
    });

    it('should use product-specific role permissions', async () => {
      await teamManager.addMember({
        telegramId: 33333,
        name: 'Product User',
        defaultRole: 'viewer',
        addedBy: 'admin',
      });
      const member = teamManager.findMember({ telegramId: 33333 })!;
      await teamManager.assignProductRole(member.id, 'product1', 'manager');
      
      const updatedMember = teamManager.getMember(member.id)!;
      const perms = teamManager.getMemberPermissions(updatedMember, 'product1');
      
      expect(perms).toContain('approve_content'); // from manager role
    });
  });

  describe('getMemberProductRoles', () => {
    beforeEach(async () => {
      (existsSync as Mock).mockReturnValue(false);
      await teamManager.init(12345);
    });

    it('should return all product roles with permissions', async () => {
      const member = teamManager.findMember({ telegramId: 12345 })!;
      await teamManager.assignProductRole(member.id, 'product1', 'manager');
      await teamManager.assignProductRole(member.id, 'product2', 'viewer');
      
      const updatedMember = teamManager.getMember(member.id)!;
      const productRoles = teamManager.getMemberProductRoles(updatedMember);
      
      expect(productRoles['product1'].role).toBe('manager');
      expect(productRoles['product1'].permissions).toContain('approve_content');
      
      expect(productRoles['product2'].role).toBe('viewer');
      expect(productRoles['product2'].permissions).toContain('view_analytics');
    });

    it('should return empty object for member without product roles', async () => {
      await teamManager.addMember({
        telegramId: 88888,
        name: 'No Product Roles',
        addedBy: 'admin',
      });
      const member = teamManager.findMember({ telegramId: 88888 })!;
      const productRoles = teamManager.getMemberProductRoles(member);
      expect(productRoles).toEqual({});
    });
  });
});
