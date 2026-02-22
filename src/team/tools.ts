/**
 * Team Management Tools
 * Tools for admins to manage team members and roles
 */

import { Tool, ToolResult } from '../tools/types.js';
import { teamManager } from './manager.js';
import { BUILTIN_ROLES } from './types.js';

// ============ List Team ============
export const listTeamTool: Tool = {
  name: 'list_team',
  description: 'List all team members and their roles',
  parameters: {
    type: 'object',
    properties: {
      includeInactive: {
        type: 'boolean',
        description: 'Include suspended members',
      },
      productId: {
        type: 'string',
        description: 'Show roles for a specific product',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const members = teamManager.listMembers(params?.includeInactive);

    const memberList = members.map(m => {
      const effectiveRole = params?.productId 
        ? teamManager.getMemberRole(m, params.productId)
        : m.defaultRole;
      
      return {
        id: m.id,
        name: m.name,
        defaultRole: m.defaultRole,
        productRoles: m.productRoles,
        effectiveRole: params?.productId ? effectiveRole : undefined,
        status: m.status,
        telegramId: m.telegramId,
        lastActive: m.lastActiveAt,
      };
    });

    return {
      success: true,
      message: `${memberList.length} team member(s)`,
      data: { members: memberList },
    };
  },
};

// ============ Add Team Member ============
export const addTeamMemberTool: Tool = {
  name: 'add_team_member',
  description: 'Add a new member to the team (admin only). Provide their ID from the platform they use.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Member name',
      },
      telegramId: {
        type: 'number',
        description: 'Telegram user ID (if they use Telegram)',
      },
      discordId: {
        type: 'string',
        description: 'Discord user ID (if they use Discord)',
      },
      slackId: {
        type: 'string',
        description: 'Slack user ID (if they use Slack)',
      },
      email: {
        type: 'string',
        description: 'Email address (for identification)',
      },
      defaultRole: {
        type: 'string',
        description: 'Default role (admin, manager, creator, viewer). Default: viewer',
      },
      productRoles: {
        type: 'string',
        description: 'Product-specific roles as JSON: {"proofping": "manager", "other": "viewer"}',
      },
    },
    required: ['name'],
  },

  async execute(params): Promise<ToolResult> {
    // Require at least one platform ID
    if (!params.telegramId && !params.discordId && !params.slackId && !params.email) {
      return { 
        success: false, 
        message: 'Please provide at least one platform ID (telegramId, discordId, slackId, or email)' 
      };
    }

    try {
      let productRoles: Record<string, string> | undefined;
      if (params.productRoles) {
        try {
          productRoles = JSON.parse(params.productRoles);
        } catch {
          return { success: false, message: 'Invalid productRoles JSON' };
        }
      }

      const member = await teamManager.addMember({
        telegramId: params.telegramId,
        discordId: params.discordId,
        slackId: params.slackId,
        email: params.email,
        name: params.name,
        defaultRole: params.defaultRole,
        productRoles,
        addedBy: 'admin',
      });

      const platforms = [
        params.telegramId && 'Telegram',
        params.discordId && 'Discord',
        params.slackId && 'Slack',
      ].filter(Boolean).join(', ');

      const roleDesc = productRoles 
        ? `default: ${member.defaultRole}, products: ${JSON.stringify(productRoles)}`
        : member.defaultRole;

      return {
        success: true,
        message: `✅ Added ${member.name} to the team (${roleDesc}) on ${platforms || 'email only'}`,
        data: { member },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to add member: ${err instanceof Error ? err.message : err}`,
      };
    }
  },
};

// ============ Remove Team Member ============
export const removeTeamMemberTool: Tool = {
  name: 'remove_team_member',
  description: 'Remove a member from the team (admin only)',
  parameters: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        description: 'Member ID to remove',
      },
      telegramId: {
        type: 'number',
        description: 'Or: Telegram ID of member to remove',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    let memberId = params.memberId;

    // Find by telegram ID if not provided
    if (!memberId && params.telegramId) {
      const member = teamManager.findMember({ telegramId: params.telegramId });
      if (member) memberId = member.id;
    }

    if (!memberId) {
      return { success: false, message: 'Member not found' };
    }

    const removed = await teamManager.removeMember(memberId);
    
    return {
      success: removed,
      message: removed ? '✅ Member removed from team' : 'Failed to remove member',
    };
  },
};

// ============ Assign Role ============
export const assignRoleTool: Tool = {
  name: 'assign_role',
  description: 'Assign a role to a team member, optionally for a specific product',
  parameters: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        description: 'Member ID',
      },
      telegramId: {
        type: 'number',
        description: 'Or: Telegram ID of member',
      },
      role: {
        type: 'string',
        description: 'Role ID (admin, manager, creator, viewer)',
      },
      productId: {
        type: 'string',
        description: 'Product ID for product-specific role. Omit for default role.',
      },
    },
    required: ['role'],
  },

  async execute(params): Promise<ToolResult> {
    const member = params.memberId 
      ? teamManager.getMember(params.memberId)
      : teamManager.findMember({ telegramId: params.telegramId });

    if (!member) {
      return { success: false, message: 'Member not found' };
    }

    // Validate role exists
    const validRoles = teamManager.listRoles();
    if (!validRoles.find(r => r.id === params.role)) {
      return {
        success: false,
        message: `Invalid role: ${params.role}. Available: ${validRoles.map(r => r.id).join(', ')}`,
      };
    }

    let updated;
    if (params.productId) {
      updated = await teamManager.assignProductRole(member.id, params.productId, params.role);
      return {
        success: true,
        message: `✅ ${member.name} is now ${params.role} for ${params.productId}`,
        data: { member: updated },
      };
    } else {
      updated = await teamManager.assignDefaultRole(member.id, params.role);
      return {
        success: true,
        message: `✅ ${member.name}'s default role is now ${params.role}`,
        data: { member: updated },
      };
    }
  },
};

// ============ List Roles ============
export const listRolesTool: Tool = {
  name: 'list_roles',
  description: 'List available roles and their permissions',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const roles = teamManager.listRoles();

    const roleList = roles.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      builtin: r.isBuiltin,
    }));

    return {
      success: true,
      message: `${roleList.length} roles available`,
      data: { roles: roleList },
    };
  },
};

// ============ Who Has Permission ============
export const whoHasPermissionTool: Tool = {
  name: 'who_has_permission',
  description: 'Find team members who have a specific permission, optionally for a product',
  parameters: {
    type: 'object',
    properties: {
      permission: {
        type: 'string',
        description: 'Permission to check (e.g., "send_email", "post", "manage_team", "admin")',
      },
      productId: {
        type: 'string',
        description: 'Check permission for a specific product (optional)',
      },
    },
    required: ['permission'],
  },

  async execute(params): Promise<ToolResult> {
    const members = teamManager.listMembers();
    
    const withPermission = members.filter(m => 
      teamManager.hasPermission(m, params.permission, params.productId)
    );

    const result = withPermission.map(m => ({
      name: m.name,
      role: teamManager.getMemberRole(m, params.productId),
      telegramId: m.telegramId,
    }));

    const context = params.productId ? ` for ${params.productId}` : '';
    
    return {
      success: true,
      message: `${result.length} member(s) can ${params.permission}${context}`,
      data: { members: result, permission: params.permission, productId: params.productId },
    };
  },
};

// ============ List Permissions ============
export const listPermissionsTool: Tool = {
  name: 'list_permissions',
  description: 'List all available permissions and which roles have them',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const roles = teamManager.listRoles();
    
    // Build permission -> roles mapping
    const permissionMap: Record<string, string[]> = {};
    
    for (const role of roles) {
      for (const perm of role.permissions) {
        if (!permissionMap[perm]) {
          permissionMap[perm] = [];
        }
        permissionMap[perm].push(role.id);
      }
    }

    // Sort permissions alphabetically
    const permissions = Object.entries(permissionMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([permission, roles]) => ({ permission, roles }));

    return {
      success: true,
      message: `${permissions.length} permissions available`,
      data: { permissions },
    };
  },
};

// ============ Get Member Info ============
export const getMemberInfoTool: Tool = {
  name: 'get_member_info',
  description: 'Get detailed info about a team member',
  parameters: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        description: 'Member ID',
      },
      telegramId: {
        type: 'number',
        description: 'Or: Telegram ID',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const member = params.memberId
      ? teamManager.getMember(params.memberId)
      : teamManager.findMember({ telegramId: params.telegramId });

    if (!member) {
      return { success: false, message: 'Member not found' };
    }

    const permissions = teamManager.getMemberPermissions(member);

    return {
      success: true,
      message: `${member.name}`,
      data: {
        ...member,
        effectivePermissions: permissions,
      },
    };
  },
};

// ============ Suspend Member ============
export const suspendMemberTool: Tool = {
  name: 'suspend_member',
  description: 'Suspend a team member (they can no longer use the bot)',
  parameters: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        description: 'Member ID',
      },
      telegramId: {
        type: 'number',
        description: 'Or: Telegram ID',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    let memberId = params.memberId;
    if (!memberId && params.telegramId) {
      const member = teamManager.findMember({ telegramId: params.telegramId });
      if (member) memberId = member.id;
    }

    if (!memberId) {
      return { success: false, message: 'Member not found' };
    }

    const updated = await teamManager.suspendMember(memberId);
    
    return {
      success: !!updated,
      message: updated ? `⏸️ ${updated.name} has been suspended` : 'Failed to suspend',
    };
  },
};

// ============ Activate Member ============
export const activateMemberTool: Tool = {
  name: 'activate_member',
  description: 'Reactivate a suspended team member',
  parameters: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        description: 'Member ID',
      },
      telegramId: {
        type: 'number',
        description: 'Or: Telegram ID',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    let memberId = params.memberId;
    if (!memberId && params.telegramId) {
      const member = teamManager.findMember({ telegramId: params.telegramId });
      if (member) memberId = member.id;
    }

    if (!memberId) {
      return { success: false, message: 'Member not found' };
    }

    const updated = await teamManager.activateMember(memberId);
    
    return {
      success: !!updated,
      message: updated ? `✅ ${updated.name} has been reactivated` : 'Failed to activate',
    };
  },
};

// ============ Update Member Preferences ============
export const updateMemberPreferencesTool: Tool = {
  name: 'update_member_preferences',
  description: 'Update a member\'s preferences (voice style, default product, etc.)',
  parameters: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        description: 'Member ID',
      },
      telegramId: {
        type: 'number',
        description: 'Or: Telegram ID',
      },
      voice: {
        type: 'string',
        enum: ['professional', 'casual', 'friendly', 'playful'],
        description: 'Preferred communication style',
      },
      defaultProduct: {
        type: 'string',
        description: 'Default product to work with',
      },
      timezone: {
        type: 'string',
        description: 'Timezone (e.g., "Pacific/Auckland")',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const member = params.memberId
      ? teamManager.getMember(params.memberId)
      : teamManager.findMember({ telegramId: params.telegramId });

    if (!member) {
      return { success: false, message: 'Member not found' };
    }

    const preferences = {
      ...member.preferences,
      ...(params.voice && { voice: params.voice }),
      ...(params.defaultProduct && { defaultProduct: params.defaultProduct }),
      ...(params.timezone && { timezone: params.timezone }),
    };

    const updated = await teamManager.updateMember(member.id, { preferences });

    return {
      success: true,
      message: `✅ Updated preferences for ${member.name}`,
      data: { preferences: updated?.preferences },
    };
  },
};

// ============ Remember About Member ============
export const rememberMemberTool: Tool = {
  name: 'remember_about_member',
  description: 'Store something to remember about a team member',
  parameters: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        description: 'Member ID',
      },
      telegramId: {
        type: 'number',
        description: 'Or: Telegram ID',
      },
      key: {
        type: 'string',
        description: 'What to remember (e.g., "prefers_bullets", "working_on")',
      },
      value: {
        type: 'string',
        description: 'The value to remember',
      },
    },
    required: ['key', 'value'],
  },

  async execute(params): Promise<ToolResult> {
    const member = params.memberId
      ? teamManager.getMember(params.memberId)
      : teamManager.findMember({ telegramId: params.telegramId });

    if (!member) {
      return { success: false, message: 'Member not found' };
    }

    await teamManager.updateMemberMemory(member.id, params.key, params.value);

    return {
      success: true,
      message: `✅ I'll remember that ${member.name} ${params.key}: ${params.value}`,
    };
  },
};

// ============ Export All ============
export const teamTools: Tool[] = [
  listTeamTool,
  addTeamMemberTool,
  removeTeamMemberTool,
  assignRoleTool,
  listRolesTool,
  listPermissionsTool,
  whoHasPermissionTool,
  getMemberInfoTool,
  suspendMemberTool,
  activateMemberTool,
  updateMemberPreferencesTool,
  rememberMemberTool,
];
