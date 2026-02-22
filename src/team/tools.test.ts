/**
 * Team Tools Tests
 * Tests the team management tools with mocked teamManager
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { TeamMember, Role, BUILTIN_ROLES } from './types.js';

// Mock the teamManager
vi.mock('./manager.js', () => ({
  teamManager: {
    listMembers: vi.fn(),
    getMemberRole: vi.fn(),
    findMember: vi.fn(),
    getMember: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    listRoles: vi.fn(),
    assignDefaultRole: vi.fn(),
    assignProductRole: vi.fn(),
    hasPermission: vi.fn(),
    getMemberPermissions: vi.fn(),
    suspendMember: vi.fn(),
    activateMember: vi.fn(),
    updateMember: vi.fn(),
    updateMemberMemory: vi.fn(),
  },
}));

// Import tools after mock
import {
  listTeamTool,
  addTeamMemberTool,
  removeTeamMemberTool,
  updateTeamMemberTool,
  assignRoleTool,
  listRolesTool,
  whoHasPermissionTool,
  listPermissionsTool,
  getMemberInfoTool,
  suspendMemberTool,
  activateMemberTool,
  updateMemberPreferencesTool,
  rememberMemberTool,
  teamTools,
} from './tools.js';
import { teamManager } from './manager.js';

// Helper to create a mock member
function createMockMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'user_123',
    name: 'Test User',
    defaultRole: 'viewer',
    status: 'active',
    joinedAt: new Date().toISOString(),
    telegramId: 12345,
    ...overrides,
  };
}

describe('Team Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('teamTools export', () => {
    it('should export all team tools', () => {
      expect(teamTools).toHaveLength(13);
      expect(teamTools.map(t => t.name)).toEqual([
        'list_team',
        'add_team_member',
        'remove_team_member',
        'update_team_member',
        'assign_role',
        'list_roles',
        'list_permissions',
        'who_has_permission',
        'get_member_info',
        'suspend_member',
        'activate_member',
        'update_member_preferences',
        'remember_about_member',
      ]);
    });
  });

  describe('listTeamTool', () => {
    it('should have correct metadata', () => {
      expect(listTeamTool.name).toBe('list_team');
      expect(listTeamTool.description).toContain('List all team members');
    });

    it('should list active members by default', async () => {
      const mockMembers = [
        createMockMember({ id: 'user_1', name: 'Alice', defaultRole: 'admin' }),
        createMockMember({ id: 'user_2', name: 'Bob', defaultRole: 'viewer' }),
      ];
      (teamManager.listMembers as Mock).mockReturnValue(mockMembers);
      (teamManager.getMemberRole as Mock).mockImplementation((m) => m.defaultRole);

      const result = await listTeamTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('2 team member(s)');
      expect(result.data?.members).toHaveLength(2);
      expect(teamManager.listMembers).toHaveBeenCalledWith(undefined);
    });

    it('should include inactive members when requested', async () => {
      const mockMembers = [
        createMockMember({ id: 'user_1', name: 'Alice', status: 'active' }),
        createMockMember({ id: 'user_2', name: 'Bob', status: 'suspended' }),
      ];
      (teamManager.listMembers as Mock).mockReturnValue(mockMembers);

      const result = await listTeamTool.execute({ includeInactive: true });

      expect(teamManager.listMembers).toHaveBeenCalledWith(true);
      expect(result.data?.members).toHaveLength(2);
    });

    it('should include effective role when productId is specified', async () => {
      const mockMembers = [
        createMockMember({ 
          id: 'user_1', 
          name: 'Alice', 
          defaultRole: 'viewer',
          productRoles: { 'proofping': 'manager' },
        }),
      ];
      (teamManager.listMembers as Mock).mockReturnValue(mockMembers);
      (teamManager.getMemberRole as Mock).mockReturnValue('manager');

      const result = await listTeamTool.execute({ productId: 'proofping' });

      expect(teamManager.getMemberRole).toHaveBeenCalledWith(mockMembers[0], 'proofping');
      expect(result.data?.members[0].effectiveRole).toBe('manager');
    });

    it('should not include effectiveRole when no productId specified', async () => {
      const mockMembers = [createMockMember()];
      (teamManager.listMembers as Mock).mockReturnValue(mockMembers);

      const result = await listTeamTool.execute({});

      expect(result.data?.members[0].effectiveRole).toBeUndefined();
    });

    it('should return member details in data', async () => {
      const mockMember = createMockMember({
        id: 'user_1',
        name: 'Alice',
        defaultRole: 'admin',
        telegramId: 12345,
        productRoles: { 'product1': 'manager' },
        lastActiveAt: '2024-01-01T00:00:00Z',
      });
      (teamManager.listMembers as Mock).mockReturnValue([mockMember]);

      const result = await listTeamTool.execute({});

      const member = result.data?.members[0];
      expect(member.id).toBe('user_1');
      expect(member.name).toBe('Alice');
      expect(member.defaultRole).toBe('admin');
      expect(member.telegramId).toBe(12345);
      expect(member.productRoles).toEqual({ 'product1': 'manager' });
      expect(member.status).toBe('active');
      expect(member.lastActive).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('addTeamMemberTool', () => {
    it('should have correct metadata', () => {
      expect(addTeamMemberTool.name).toBe('add_team_member');
      expect(addTeamMemberTool.parameters.required).toContain('name');
    });

    it('should require at least one platform ID', async () => {
      const result = await addTeamMemberTool.execute({ name: 'New User' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Please provide at least one platform ID');
    });

    it('should add member with telegramId', async () => {
      const newMember = createMockMember({ 
        id: 'user_new', 
        name: 'New User',
        telegramId: 99999,
        defaultRole: 'viewer',
      });
      (teamManager.addMember as Mock).mockResolvedValue(newMember);

      const result = await addTeamMemberTool.execute({
        name: 'New User',
        telegramId: 99999,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Added New User');
      expect(result.message).toContain('Telegram');
      expect(teamManager.addMember).toHaveBeenCalledWith({
        telegramId: 99999,
        discordId: undefined,
        slackId: undefined,
        email: undefined,
        name: 'New User',
        defaultRole: undefined,
        productRoles: undefined,
        addedBy: 'admin',
      });
    });

    it('should add member with discordId', async () => {
      const newMember = createMockMember({ 
        name: 'Discord User',
        discordId: 'discord123',
      });
      (teamManager.addMember as Mock).mockResolvedValue(newMember);

      const result = await addTeamMemberTool.execute({
        name: 'Discord User',
        discordId: 'discord123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Discord');
    });

    it('should add member with slackId', async () => {
      const newMember = createMockMember({ 
        name: 'Slack User',
        slackId: 'slack123',
      });
      (teamManager.addMember as Mock).mockResolvedValue(newMember);

      const result = await addTeamMemberTool.execute({
        name: 'Slack User',
        slackId: 'slack123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Slack');
    });

    it('should add member with email only', async () => {
      const newMember = createMockMember({ 
        name: 'Email User',
        email: 'user@example.com',
      });
      (teamManager.addMember as Mock).mockResolvedValue(newMember);

      const result = await addTeamMemberTool.execute({
        name: 'Email User',
        email: 'user@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('email only');
    });

    it('should add member with multiple platform IDs', async () => {
      const newMember = createMockMember({ 
        name: 'Multi User',
        telegramId: 11111,
        discordId: 'discord111',
      });
      (teamManager.addMember as Mock).mockResolvedValue(newMember);

      const result = await addTeamMemberTool.execute({
        name: 'Multi User',
        telegramId: 11111,
        discordId: 'discord111',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Telegram');
      expect(result.message).toContain('Discord');
    });

    it('should add member with custom default role', async () => {
      const newMember = createMockMember({ 
        name: 'Manager User',
        telegramId: 22222,
        defaultRole: 'manager',
      });
      (teamManager.addMember as Mock).mockResolvedValue(newMember);

      const result = await addTeamMemberTool.execute({
        name: 'Manager User',
        telegramId: 22222,
        defaultRole: 'manager',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('manager');
      expect(teamManager.addMember).toHaveBeenCalledWith(
        expect.objectContaining({ defaultRole: 'manager' })
      );
    });

    it('should parse and apply product roles from JSON', async () => {
      const newMember = createMockMember({ 
        name: 'Product User',
        telegramId: 33333,
        defaultRole: 'viewer',
        productRoles: { 'proofping': 'manager', 'other': 'viewer' },
      });
      (teamManager.addMember as Mock).mockResolvedValue(newMember);

      const result = await addTeamMemberTool.execute({
        name: 'Product User',
        telegramId: 33333,
        productRoles: '{"proofping": "manager", "other": "viewer"}',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('products:');
      expect(teamManager.addMember).toHaveBeenCalledWith(
        expect.objectContaining({ 
          productRoles: { 'proofping': 'manager', 'other': 'viewer' } 
        })
      );
    });

    it('should return error for invalid productRoles JSON', async () => {
      const result = await addTeamMemberTool.execute({
        name: 'Bad JSON User',
        telegramId: 44444,
        productRoles: 'not valid json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid productRoles JSON');
    });

    it('should handle error from teamManager', async () => {
      (teamManager.addMember as Mock).mockRejectedValue(new Error('User already exists on team'));

      const result = await addTeamMemberTool.execute({
        name: 'Duplicate User',
        telegramId: 12345,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to add member');
      expect(result.message).toContain('User already exists');
    });

    it('should handle non-Error thrown from teamManager', async () => {
      (teamManager.addMember as Mock).mockRejectedValue('string error');

      const result = await addTeamMemberTool.execute({
        name: 'Error User',
        telegramId: 55555,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('string error');
    });
  });

  describe('removeTeamMemberTool', () => {
    it('should have correct metadata', () => {
      expect(removeTeamMemberTool.name).toBe('remove_team_member');
    });

    it('should remove member by memberId', async () => {
      (teamManager.removeMember as Mock).mockResolvedValue(true);

      const result = await removeTeamMemberTool.execute({ memberId: 'user_123' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Member removed');
      expect(teamManager.removeMember).toHaveBeenCalledWith('user_123');
    });

    it('should find and remove member by telegramId', async () => {
      const mockMember = createMockMember({ id: 'user_456' });
      (teamManager.findMember as Mock).mockReturnValue(mockMember);
      (teamManager.removeMember as Mock).mockResolvedValue(true);

      const result = await removeTeamMemberTool.execute({ telegramId: 12345 });

      expect(result.success).toBe(true);
      expect(teamManager.findMember).toHaveBeenCalledWith({ telegramId: 12345 });
      expect(teamManager.removeMember).toHaveBeenCalledWith('user_456');
    });

    it('should return error when member not found by telegramId', async () => {
      (teamManager.findMember as Mock).mockReturnValue(undefined);

      const result = await removeTeamMemberTool.execute({ telegramId: 99999 });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
    });

    it('should return error when no identifiers provided', async () => {
      const result = await removeTeamMemberTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
    });

    it('should return failure when removeMember returns false', async () => {
      (teamManager.removeMember as Mock).mockResolvedValue(false);

      const result = await removeTeamMemberTool.execute({ memberId: 'user_123' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to remove member');
    });
  });

  describe('updateTeamMemberTool', () => {
    it('should have correct metadata', () => {
      expect(updateTeamMemberTool.name).toBe('update_team_member');
      expect(updateTeamMemberTool.description).toContain('Update');
    });

    it('should update member email', async () => {
      const mockMember = createMockMember({ id: 'user_123', name: 'Test User' });
      const updatedMember = { ...mockMember, email: 'new@example.com' };
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.updateMember as Mock).mockResolvedValue(updatedMember);

      const result = await updateTeamMemberTool.execute({
        memberId: 'user_123',
        email: 'new@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated Test User');
      expect(result.message).toContain('email');
      expect(teamManager.updateMember).toHaveBeenCalledWith('user_123', { email: 'new@example.com' });
    });

    it('should update member name', async () => {
      const mockMember = createMockMember({ id: 'user_123', name: 'Old Name' });
      const updatedMember = { ...mockMember, name: 'New Name' };
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.updateMember as Mock).mockResolvedValue(updatedMember);

      const result = await updateTeamMemberTool.execute({
        memberId: 'user_123',
        name: 'New Name',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated New Name');
    });

    it('should find member by telegramId', async () => {
      const mockMember = createMockMember({ id: 'user_456', name: 'TG User' });
      const updatedMember = { ...mockMember, email: 'tg@example.com' };
      (teamManager.findMember as Mock).mockReturnValue(mockMember);
      (teamManager.updateMember as Mock).mockResolvedValue(updatedMember);

      const result = await updateTeamMemberTool.execute({
        telegramId: 12345,
        email: 'tg@example.com',
      });

      expect(result.success).toBe(true);
      expect(teamManager.findMember).toHaveBeenCalledWith({ telegramId: 12345 });
    });

    it('should return error when member not found', async () => {
      (teamManager.getMember as Mock).mockReturnValue(undefined);

      const result = await updateTeamMemberTool.execute({
        memberId: 'nonexistent',
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
    });

    it('should return error when no updates provided', async () => {
      const mockMember = createMockMember({ id: 'user_123' });
      (teamManager.getMember as Mock).mockReturnValue(mockMember);

      const result = await updateTeamMemberTool.execute({ memberId: 'user_123' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('No updates provided');
    });

    it('should update multiple fields at once', async () => {
      const mockMember = createMockMember({ id: 'user_123', name: 'Test' });
      const updatedMember = { ...mockMember, name: 'New Name', email: 'new@test.com' };
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.updateMember as Mock).mockResolvedValue(updatedMember);

      const result = await updateTeamMemberTool.execute({
        memberId: 'user_123',
        name: 'New Name',
        email: 'new@test.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('name');
      expect(result.message).toContain('email');
    });
  });

  describe('assignRoleTool', () => {
    it('should have correct metadata', () => {
      expect(assignRoleTool.name).toBe('assign_role');
      expect(assignRoleTool.parameters.required).toContain('role');
    });

    it('should assign default role by memberId', async () => {
      const mockMember = createMockMember();
      const updatedMember = createMockMember({ defaultRole: 'manager' });
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.listRoles as Mock).mockReturnValue(BUILTIN_ROLES);
      (teamManager.assignDefaultRole as Mock).mockResolvedValue(updatedMember);

      const result = await assignRoleTool.execute({
        memberId: 'user_123',
        role: 'manager',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("default role is now manager");
      expect(teamManager.assignDefaultRole).toHaveBeenCalledWith('user_123', 'manager');
    });

    it('should find member by telegramId', async () => {
      const mockMember = createMockMember();
      const updatedMember = createMockMember({ defaultRole: 'admin' });
      (teamManager.getMember as Mock).mockReturnValue(undefined);
      (teamManager.findMember as Mock).mockReturnValue(mockMember);
      (teamManager.listRoles as Mock).mockReturnValue(BUILTIN_ROLES);
      (teamManager.assignDefaultRole as Mock).mockResolvedValue(updatedMember);

      const result = await assignRoleTool.execute({
        telegramId: 12345,
        role: 'admin',
      });

      expect(result.success).toBe(true);
      expect(teamManager.findMember).toHaveBeenCalledWith({ telegramId: 12345 });
    });

    it('should return error when member not found', async () => {
      (teamManager.getMember as Mock).mockReturnValue(undefined);
      (teamManager.findMember as Mock).mockReturnValue(undefined);

      const result = await assignRoleTool.execute({
        memberId: 'nonexistent',
        role: 'admin',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
    });

    it('should return error for invalid role', async () => {
      const mockMember = createMockMember();
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.listRoles as Mock).mockReturnValue(BUILTIN_ROLES);

      const result = await assignRoleTool.execute({
        memberId: 'user_123',
        role: 'invalid_role',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid role: invalid_role');
      expect(result.message).toContain('Available:');
    });

    it('should assign product-specific role', async () => {
      const mockMember = createMockMember();
      const updatedMember = createMockMember({ 
        productRoles: { 'proofping': 'manager' } 
      });
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.listRoles as Mock).mockReturnValue(BUILTIN_ROLES);
      (teamManager.assignProductRole as Mock).mockResolvedValue(updatedMember);

      const result = await assignRoleTool.execute({
        memberId: 'user_123',
        role: 'manager',
        productId: 'proofping',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('manager for proofping');
      expect(teamManager.assignProductRole).toHaveBeenCalledWith('user_123', 'proofping', 'manager');
    });
  });

  describe('listRolesTool', () => {
    it('should have correct metadata', () => {
      expect(listRolesTool.name).toBe('list_roles');
    });

    it('should list all roles with permissions', async () => {
      (teamManager.listRoles as Mock).mockReturnValue(BUILTIN_ROLES);

      const result = await listRolesTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('4 roles available');
      expect(result.data?.roles).toHaveLength(4);
      
      const adminRole = result.data?.roles.find((r: { id: string }) => r.id === 'admin');
      expect(adminRole.name).toBe('Admin');
      expect(adminRole.permissions).toContain('admin');
      expect(adminRole.builtin).toBe(true);
    });

    it('should include custom roles', async () => {
      const customRole: Role = {
        id: 'custom',
        name: 'Custom Role',
        description: 'A custom role',
        permissions: ['create_content'],
        isBuiltin: false,
      };
      (teamManager.listRoles as Mock).mockReturnValue([...BUILTIN_ROLES, customRole]);

      const result = await listRolesTool.execute({});

      expect(result.data?.roles).toHaveLength(5);
      const custom = result.data?.roles.find((r: { id: string }) => r.id === 'custom');
      expect(custom.builtin).toBe(false);
    });
  });

  describe('whoHasPermissionTool', () => {
    it('should have correct metadata', () => {
      expect(whoHasPermissionTool.name).toBe('who_has_permission');
      expect(whoHasPermissionTool.parameters.required).toContain('permission');
    });

    it('should find members with permission', async () => {
      const members = [
        createMockMember({ id: 'user_1', name: 'Alice', defaultRole: 'admin' }),
        createMockMember({ id: 'user_2', name: 'Bob', defaultRole: 'viewer' }),
        createMockMember({ id: 'user_3', name: 'Carol', defaultRole: 'manager' }),
      ];
      (teamManager.listMembers as Mock).mockReturnValue(members);
      (teamManager.hasPermission as Mock).mockImplementation((m, perm) => {
        if (perm === 'post') return m.defaultRole === 'admin' || m.defaultRole === 'manager';
        return false;
      });
      (teamManager.getMemberRole as Mock).mockImplementation((m) => m.defaultRole);

      const result = await whoHasPermissionTool.execute({ permission: 'post' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('2 member(s) can post');
      expect(result.data?.members).toHaveLength(2);
      expect(result.data?.members.map((m: { name: string }) => m.name)).toContain('Alice');
      expect(result.data?.members.map((m: { name: string }) => m.name)).toContain('Carol');
    });

    it('should check permission for specific product', async () => {
      const members = [createMockMember({ name: 'Alice' })];
      (teamManager.listMembers as Mock).mockReturnValue(members);
      (teamManager.hasPermission as Mock).mockReturnValue(true);
      (teamManager.getMemberRole as Mock).mockReturnValue('manager');

      const result = await whoHasPermissionTool.execute({ 
        permission: 'approve_content',
        productId: 'proofping',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('for proofping');
      expect(teamManager.hasPermission).toHaveBeenCalledWith(members[0], 'approve_content', 'proofping');
    });

    it('should return empty list when no members have permission', async () => {
      const members = [createMockMember({ name: 'Alice', defaultRole: 'viewer' })];
      (teamManager.listMembers as Mock).mockReturnValue(members);
      (teamManager.hasPermission as Mock).mockReturnValue(false);

      const result = await whoHasPermissionTool.execute({ permission: 'admin' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('0 member(s) can admin');
      expect(result.data?.members).toHaveLength(0);
    });
  });

  describe('listPermissionsTool', () => {
    it('should have correct metadata', () => {
      expect(listPermissionsTool.name).toBe('list_permissions');
    });

    it('should list all permissions with roles', async () => {
      (teamManager.listRoles as Mock).mockReturnValue(BUILTIN_ROLES);

      const result = await listPermissionsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.permissions).toBeDefined();
      
      // Check that permissions are sorted alphabetically
      const permNames = result.data?.permissions.map((p: { permission: string }) => p.permission);
      const sorted = [...permNames].sort();
      expect(permNames).toEqual(sorted);

      // Check specific permission mappings
      const adminPerm = result.data?.permissions.find(
        (p: { permission: string }) => p.permission === 'admin'
      );
      expect(adminPerm.roles).toContain('admin');

      const viewPerm = result.data?.permissions.find(
        (p: { permission: string }) => p.permission === 'view_analytics'
      );
      expect(viewPerm.roles).toContain('admin');
      expect(viewPerm.roles).toContain('viewer');
    });
  });

  describe('getMemberInfoTool', () => {
    it('should have correct metadata', () => {
      expect(getMemberInfoTool.name).toBe('get_member_info');
    });

    it('should get member info by memberId', async () => {
      const mockMember = createMockMember({
        id: 'user_123',
        name: 'Test User',
        defaultRole: 'manager',
        telegramId: 12345,
      });
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.getMemberPermissions as Mock).mockReturnValue(['approve_content', 'post']);

      const result = await getMemberInfoTool.execute({ memberId: 'user_123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Test User');
      expect(result.data?.name).toBe('Test User');
      expect(result.data?.effectivePermissions).toEqual(['approve_content', 'post']);
    });

    it('should find member by telegramId', async () => {
      const mockMember = createMockMember({ name: 'Telegram User' });
      (teamManager.getMember as Mock).mockReturnValue(undefined);
      (teamManager.findMember as Mock).mockReturnValue(mockMember);
      (teamManager.getMemberPermissions as Mock).mockReturnValue([]);

      const result = await getMemberInfoTool.execute({ telegramId: 12345 });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Telegram User');
      expect(teamManager.findMember).toHaveBeenCalledWith({ telegramId: 12345 });
    });

    it('should return error when member not found', async () => {
      (teamManager.getMember as Mock).mockReturnValue(undefined);
      (teamManager.findMember as Mock).mockReturnValue(undefined);

      const result = await getMemberInfoTool.execute({ memberId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
    });
  });

  describe('suspendMemberTool', () => {
    it('should have correct metadata', () => {
      expect(suspendMemberTool.name).toBe('suspend_member');
    });

    it('should suspend member by memberId', async () => {
      const suspendedMember = createMockMember({ 
        name: 'Suspended User',
        status: 'suspended',
      });
      (teamManager.suspendMember as Mock).mockResolvedValue(suspendedMember);

      const result = await suspendMemberTool.execute({ memberId: 'user_123' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Suspended User has been suspended');
      expect(teamManager.suspendMember).toHaveBeenCalledWith('user_123');
    });

    it('should find and suspend member by telegramId', async () => {
      const mockMember = createMockMember({ id: 'user_456' });
      const suspendedMember = createMockMember({ 
        id: 'user_456',
        name: 'Telegram User',
        status: 'suspended',
      });
      (teamManager.findMember as Mock).mockReturnValue(mockMember);
      (teamManager.suspendMember as Mock).mockResolvedValue(suspendedMember);

      const result = await suspendMemberTool.execute({ telegramId: 12345 });

      expect(result.success).toBe(true);
      expect(teamManager.findMember).toHaveBeenCalledWith({ telegramId: 12345 });
      expect(teamManager.suspendMember).toHaveBeenCalledWith('user_456');
    });

    it('should return error when member not found', async () => {
      (teamManager.findMember as Mock).mockReturnValue(undefined);

      const result = await suspendMemberTool.execute({ telegramId: 99999 });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
    });

    it('should return failure when suspendMember returns undefined', async () => {
      (teamManager.suspendMember as Mock).mockResolvedValue(undefined);

      const result = await suspendMemberTool.execute({ memberId: 'user_123' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to suspend');
    });
  });

  describe('activateMemberTool', () => {
    it('should have correct metadata', () => {
      expect(activateMemberTool.name).toBe('activate_member');
    });

    it('should activate member by memberId', async () => {
      const activatedMember = createMockMember({ 
        name: 'Activated User',
        status: 'active',
      });
      (teamManager.activateMember as Mock).mockResolvedValue(activatedMember);

      const result = await activateMemberTool.execute({ memberId: 'user_123' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Activated User has been reactivated');
      expect(teamManager.activateMember).toHaveBeenCalledWith('user_123');
    });

    it('should find and activate member by telegramId', async () => {
      const mockMember = createMockMember({ id: 'user_456' });
      const activatedMember = createMockMember({ 
        id: 'user_456',
        name: 'Telegram User',
        status: 'active',
      });
      (teamManager.findMember as Mock).mockReturnValue(mockMember);
      (teamManager.activateMember as Mock).mockResolvedValue(activatedMember);

      const result = await activateMemberTool.execute({ telegramId: 12345 });

      expect(result.success).toBe(true);
      expect(teamManager.findMember).toHaveBeenCalledWith({ telegramId: 12345 });
      expect(teamManager.activateMember).toHaveBeenCalledWith('user_456');
    });

    it('should return error when member not found', async () => {
      (teamManager.findMember as Mock).mockReturnValue(undefined);

      const result = await activateMemberTool.execute({ telegramId: 99999 });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
    });

    it('should return failure when activateMember returns undefined', async () => {
      (teamManager.activateMember as Mock).mockResolvedValue(undefined);

      const result = await activateMemberTool.execute({ memberId: 'user_123' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to activate');
    });
  });

  describe('updateMemberPreferencesTool', () => {
    it('should have correct metadata', () => {
      expect(updateMemberPreferencesTool.name).toBe('update_member_preferences');
    });

    it('should update member preferences by memberId', async () => {
      const mockMember = createMockMember();
      const updatedMember = createMockMember({
        preferences: { voice: 'casual', defaultProduct: 'proofping' },
      });
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.updateMember as Mock).mockResolvedValue(updatedMember);

      const result = await updateMemberPreferencesTool.execute({
        memberId: 'user_123',
        voice: 'casual',
        defaultProduct: 'proofping',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated preferences');
      expect(teamManager.updateMember).toHaveBeenCalledWith('user_123', {
        preferences: { voice: 'casual', defaultProduct: 'proofping' },
      });
    });

    it('should find member by telegramId', async () => {
      const mockMember = createMockMember();
      const updatedMember = createMockMember({
        preferences: { timezone: 'Pacific/Auckland' },
      });
      (teamManager.getMember as Mock).mockReturnValue(undefined);
      (teamManager.findMember as Mock).mockReturnValue(mockMember);
      (teamManager.updateMember as Mock).mockResolvedValue(updatedMember);

      const result = await updateMemberPreferencesTool.execute({
        telegramId: 12345,
        timezone: 'Pacific/Auckland',
      });

      expect(result.success).toBe(true);
      expect(teamManager.findMember).toHaveBeenCalledWith({ telegramId: 12345 });
    });

    it('should preserve existing preferences', async () => {
      const mockMember = createMockMember({
        preferences: { voice: 'professional', defaultProduct: 'existing' },
      });
      const updatedMember = createMockMember({
        preferences: { voice: 'professional', defaultProduct: 'existing', timezone: 'UTC' },
      });
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.updateMember as Mock).mockResolvedValue(updatedMember);

      const result = await updateMemberPreferencesTool.execute({
        memberId: 'user_123',
        timezone: 'UTC',
      });

      expect(result.success).toBe(true);
      expect(teamManager.updateMember).toHaveBeenCalledWith('user_123', {
        preferences: { 
          voice: 'professional', 
          defaultProduct: 'existing',
          timezone: 'UTC',
        },
      });
    });

    it('should return error when member not found', async () => {
      (teamManager.getMember as Mock).mockReturnValue(undefined);
      (teamManager.findMember as Mock).mockReturnValue(undefined);

      const result = await updateMemberPreferencesTool.execute({
        memberId: 'nonexistent',
        voice: 'casual',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
    });
  });

  describe('rememberMemberTool', () => {
    it('should have correct metadata', () => {
      expect(rememberMemberTool.name).toBe('remember_about_member');
      expect(rememberMemberTool.parameters.required).toContain('key');
      expect(rememberMemberTool.parameters.required).toContain('value');
    });

    it('should remember about member by memberId', async () => {
      const mockMember = createMockMember({ name: 'Test User' });
      (teamManager.getMember as Mock).mockReturnValue(mockMember);
      (teamManager.updateMemberMemory as Mock).mockResolvedValue(undefined);

      const result = await rememberMemberTool.execute({
        memberId: 'user_123',
        key: 'prefers_bullets',
        value: 'true',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("I'll remember that Test User");
      expect(result.message).toContain('prefers_bullets');
      expect(result.message).toContain('true');
      expect(teamManager.updateMemberMemory).toHaveBeenCalledWith('user_123', 'prefers_bullets', 'true');
    });

    it('should find member by telegramId', async () => {
      const mockMember = createMockMember({ id: 'user_456', name: 'Telegram User' });
      (teamManager.getMember as Mock).mockReturnValue(undefined);
      (teamManager.findMember as Mock).mockReturnValue(mockMember);
      (teamManager.updateMemberMemory as Mock).mockResolvedValue(undefined);

      const result = await rememberMemberTool.execute({
        telegramId: 12345,
        key: 'working_on',
        value: 'ProofPing launch',
      });

      expect(result.success).toBe(true);
      expect(teamManager.findMember).toHaveBeenCalledWith({ telegramId: 12345 });
      expect(teamManager.updateMemberMemory).toHaveBeenCalledWith('user_456', 'working_on', 'ProofPing launch');
    });

    it('should return error when member not found', async () => {
      (teamManager.getMember as Mock).mockReturnValue(undefined);
      (teamManager.findMember as Mock).mockReturnValue(undefined);

      const result = await rememberMemberTool.execute({
        memberId: 'nonexistent',
        key: 'test',
        value: 'value',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
    });
  });
});
