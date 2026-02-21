/**
 * Team Types Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  BUILTIN_ROLES, 
  Role, 
  Permission, 
  TeamMember, 
  Team, 
  PendingInvite 
} from './types.js';

describe('BUILTIN_ROLES', () => {
  it('should have 4 built-in roles', () => {
    expect(BUILTIN_ROLES).toHaveLength(4);
  });

  it('should have admin role with all permissions', () => {
    const admin = BUILTIN_ROLES.find(r => r.id === 'admin');
    expect(admin).toBeDefined();
    expect(admin!.name).toBe('Admin');
    expect(admin!.isBuiltin).toBe(true);
    
    const expectedPermissions: Permission[] = [
      'admin', 'manage_team', 'manage_products', 'manage_campaigns',
      'create_content', 'approve_content', 'post', 'view_analytics',
      'manage_leads', 'send_email', 'use_agents'
    ];
    
    expect(admin!.permissions).toEqual(expectedPermissions);
  });

  it('should have manager role without team management', () => {
    const manager = BUILTIN_ROLES.find(r => r.id === 'manager');
    expect(manager).toBeDefined();
    expect(manager!.name).toBe('Manager');
    expect(manager!.isBuiltin).toBe(true);
    expect(manager!.permissions).not.toContain('admin');
    expect(manager!.permissions).not.toContain('manage_team');
    expect(manager!.permissions).toContain('approve_content');
    expect(manager!.permissions).toContain('post');
  });

  it('should have creator role without posting', () => {
    const creator = BUILTIN_ROLES.find(r => r.id === 'creator');
    expect(creator).toBeDefined();
    expect(creator!.name).toBe('Creator');
    expect(creator!.isBuiltin).toBe(true);
    expect(creator!.permissions).toContain('create_content');
    expect(creator!.permissions).toContain('use_agents');
    expect(creator!.permissions).not.toContain('post');
    expect(creator!.permissions).not.toContain('approve_content');
  });

  it('should have viewer role with only analytics', () => {
    const viewer = BUILTIN_ROLES.find(r => r.id === 'viewer');
    expect(viewer).toBeDefined();
    expect(viewer!.name).toBe('Viewer');
    expect(viewer!.isBuiltin).toBe(true);
    expect(viewer!.permissions).toEqual(['view_analytics']);
  });

  it('should have all roles marked as builtin', () => {
    for (const role of BUILTIN_ROLES) {
      expect(role.isBuiltin).toBe(true);
    }
  });

  it('should have unique IDs', () => {
    const ids = BUILTIN_ROLES.map(r => r.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids).toEqual(uniqueIds);
  });

  it('should have descriptions for all roles', () => {
    for (const role of BUILTIN_ROLES) {
      expect(role.description).toBeDefined();
      expect(role.description.length).toBeGreaterThan(0);
    }
  });
});

describe('Permission type', () => {
  it('should include all expected permissions', () => {
    const allPermissions: Permission[] = [
      'admin',
      'manage_team',
      'manage_products',
      'manage_campaigns',
      'create_content',
      'approve_content',
      'post',
      'view_analytics',
      'manage_leads',
      'send_email',
      'use_agents',
    ];

    // Check that admin role has all permissions
    const admin = BUILTIN_ROLES.find(r => r.id === 'admin');
    for (const perm of allPermissions) {
      expect(admin!.permissions).toContain(perm);
    }
  });
});

describe('Role interface', () => {
  it('should create valid role object', () => {
    const role: Role = {
      id: 'custom',
      name: 'Custom Role',
      description: 'A custom role for testing',
      permissions: ['create_content', 'view_analytics'],
      isBuiltin: false,
    };

    expect(role.id).toBe('custom');
    expect(role.name).toBe('Custom Role');
    expect(role.description).toBe('A custom role for testing');
    expect(role.permissions).toEqual(['create_content', 'view_analytics']);
    expect(role.isBuiltin).toBe(false);
  });
});

describe('TeamMember interface', () => {
  it('should create valid member with minimal fields', () => {
    const member: TeamMember = {
      id: 'user_123',
      name: 'Test User',
      defaultRole: 'viewer',
      status: 'active',
      joinedAt: '2024-01-01T00:00:00Z',
    };

    expect(member.id).toBe('user_123');
    expect(member.name).toBe('Test User');
    expect(member.defaultRole).toBe('viewer');
    expect(member.status).toBe('active');
    expect(member.joinedAt).toBe('2024-01-01T00:00:00Z');
  });

  it('should create valid member with all optional fields', () => {
    const member: TeamMember = {
      id: 'user_456',
      telegramId: 12345,
      discordId: 'discord123',
      slackId: 'slack123',
      email: 'test@example.com',
      name: 'Full User',
      displayName: 'Fullname',
      avatar: 'https://example.com/avatar.png',
      defaultRole: 'manager',
      productRoles: { 'product1': 'admin', 'product2': 'viewer' },
      permissions: ['post'],
      status: 'active',
      preferences: {
        voice: 'professional',
        defaultProduct: 'product1',
        timezone: 'UTC',
        notifyOn: ['approval_requested', 'task_completed'],
      },
      memory: { lastTopic: 'marketing' },
      invitedBy: 'admin_user',
      joinedAt: '2024-01-01T00:00:00Z',
      lastActiveAt: '2024-01-15T12:00:00Z',
    };

    expect(member.telegramId).toBe(12345);
    expect(member.discordId).toBe('discord123');
    expect(member.slackId).toBe('slack123');
    expect(member.email).toBe('test@example.com');
    expect(member.displayName).toBe('Fullname');
    expect(member.productRoles).toEqual({ 'product1': 'admin', 'product2': 'viewer' });
    expect(member.permissions).toEqual(['post']);
    expect(member.preferences?.voice).toBe('professional');
    expect(member.memory).toEqual({ lastTopic: 'marketing' });
  });

  it('should support all status values', () => {
    const statuses: Array<'pending' | 'active' | 'suspended'> = ['pending', 'active', 'suspended'];
    
    for (const status of statuses) {
      const member: TeamMember = {
        id: 'user',
        name: 'User',
        defaultRole: 'viewer',
        status,
        joinedAt: '2024-01-01T00:00:00Z',
      };
      expect(member.status).toBe(status);
    }
  });

  it('should support all voice preferences', () => {
    const voices: Array<'professional' | 'casual' | 'friendly' | 'playful'> = [
      'professional', 'casual', 'friendly', 'playful'
    ];
    
    for (const voice of voices) {
      const member: TeamMember = {
        id: 'user',
        name: 'User',
        defaultRole: 'viewer',
        status: 'active',
        joinedAt: '2024-01-01T00:00:00Z',
        preferences: { voice },
      };
      expect(member.preferences?.voice).toBe(voice);
    }
  });
});

describe('Team interface', () => {
  it('should create valid team object', () => {
    const team: Team = {
      id: 'team_1',
      name: 'My Team',
      roles: [...BUILTIN_ROLES],
      members: [
        {
          id: 'user_1',
          name: 'Admin',
          defaultRole: 'admin',
          status: 'active',
          joinedAt: '2024-01-01T00:00:00Z',
        },
      ],
      settings: {
        defaultRole: 'viewer',
        requireApproval: true,
        allowSelfRegister: false,
      },
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'setup',
    };

    expect(team.id).toBe('team_1');
    expect(team.name).toBe('My Team');
    expect(team.roles.length).toBeGreaterThan(0);
    expect(team.members).toHaveLength(1);
    expect(team.settings.defaultRole).toBe('viewer');
    expect(team.settings.requireApproval).toBe(true);
    expect(team.settings.allowSelfRegister).toBe(false);
  });
});

describe('PendingInvite interface', () => {
  it('should create valid pending invite', () => {
    const invite: PendingInvite = {
      id: 'invite_1',
      telegramId: 12345,
      roles: ['creator'],
      invitedBy: 'admin_user',
      createdAt: '2024-01-01T00:00:00Z',
    };

    expect(invite.id).toBe('invite_1');
    expect(invite.telegramId).toBe(12345);
    expect(invite.roles).toEqual(['creator']);
    expect(invite.invitedBy).toBe('admin_user');
  });

  it('should support optional fields', () => {
    const invite: PendingInvite = {
      id: 'invite_2',
      discordId: 'discord123',
      email: 'invite@example.com',
      roles: ['viewer'],
      invitedBy: 'admin',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: '2024-01-08T00:00:00Z',
      message: 'Welcome to the team!',
    };

    expect(invite.discordId).toBe('discord123');
    expect(invite.email).toBe('invite@example.com');
    expect(invite.expiresAt).toBe('2024-01-08T00:00:00Z');
    expect(invite.message).toBe('Welcome to the team!');
  });
});
