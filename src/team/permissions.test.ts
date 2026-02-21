/**
 * Permissions Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  TOOL_PERMISSIONS, 
  PUBLIC_TOOLS, 
  USER_CONTEXT_TOOLS,
  getToolPermission 
} from './permissions.js';

describe('TOOL_PERMISSIONS', () => {
  it('should have permissions for team management tools', () => {
    expect(TOOL_PERMISSIONS['add_team_member']).toBe('manage_team');
    expect(TOOL_PERMISSIONS['remove_team_member']).toBe('manage_team');
    expect(TOOL_PERMISSIONS['assign_roles']).toBe('manage_team');
    expect(TOOL_PERMISSIONS['suspend_member']).toBe('manage_team');
    expect(TOOL_PERMISSIONS['activate_member']).toBe('manage_team');
  });

  it('should have permissions for content creation tools', () => {
    expect(TOOL_PERMISSIONS['draft_email']).toBe('create_content');
    expect(TOOL_PERMISSIONS['draft_ph_post']).toBe('create_content');
    expect(TOOL_PERMISSIONS['generate_image']).toBe('create_content');
  });

  it('should have permissions for posting tools', () => {
    expect(TOOL_PERMISSIONS['send_email']).toBe('send_email');
    expect(TOOL_PERMISSIONS['send_launch_announcement']).toBe('send_email');
    expect(TOOL_PERMISSIONS['post_tweet']).toBe('post');
    expect(TOOL_PERMISSIONS['post_linkedin']).toBe('post');
    expect(TOOL_PERMISSIONS['create_ph_launch']).toBe('post');
  });

  it('should have permissions for scheduling tools', () => {
    expect(TOOL_PERMISSIONS['schedule_post']).toBe('post');
    expect(TOOL_PERMISSIONS['schedule_reminder']).toBe('create_content');
    expect(TOOL_PERMISSIONS['cancel_scheduled_job']).toBe('post');
    expect(TOOL_PERMISSIONS['pause_scheduled_job']).toBe('post');
    expect(TOOL_PERMISSIONS['resume_scheduled_job']).toBe('post');
    expect(TOOL_PERMISSIONS['run_job_now']).toBe('post');
  });

  it('should have permissions for lead management tools', () => {
    expect(TOOL_PERMISSIONS['add_lead']).toBe('manage_leads');
    expect(TOOL_PERMISSIONS['update_lead']).toBe('manage_leads');
    expect(TOOL_PERMISSIONS['import_leads']).toBe('manage_leads');
  });

  it('should have permissions for analytics tools', () => {
    expect(TOOL_PERMISSIONS['list_leads']).toBe('view_analytics');
    expect(TOOL_PERMISSIONS['search_leads']).toBe('view_analytics');
  });

  it('should have permissions for products and campaigns', () => {
    expect(TOOL_PERMISSIONS['add_product']).toBe('manage_products');
    expect(TOOL_PERMISSIONS['update_product']).toBe('manage_products');
    expect(TOOL_PERMISSIONS['create_campaign']).toBe('manage_campaigns');
    expect(TOOL_PERMISSIONS['update_campaign']).toBe('manage_campaigns');
  });

  it('should have permissions for sub-agents', () => {
    expect(TOOL_PERMISSIONS['delegate_task']).toBe('use_agents');
    expect(TOOL_PERMISSIONS['create_agent']).toBe('admin');
  });

  it('should have permissions for approvals', () => {
    expect(TOOL_PERMISSIONS['approve_content']).toBe('approve_content');
    expect(TOOL_PERMISSIONS['reject_content']).toBe('approve_content');
    expect(TOOL_PERMISSIONS['request_approval']).toBe('create_content');
  });
});

describe('USER_CONTEXT_TOOLS', () => {
  it('should include tools that need user context', () => {
    expect(USER_CONTEXT_TOOLS).toContain('request_approval');
    expect(USER_CONTEXT_TOOLS).toContain('my_pending_approvals');
  });

  it('should be an array', () => {
    expect(Array.isArray(USER_CONTEXT_TOOLS)).toBe(true);
  });
});

describe('PUBLIC_TOOLS', () => {
  it('should include listing tools', () => {
    expect(PUBLIC_TOOLS).toContain('list_team');
    expect(PUBLIC_TOOLS).toContain('list_roles');
    expect(PUBLIC_TOOLS).toContain('list_permissions');
    expect(PUBLIC_TOOLS).toContain('list_agents');
    expect(PUBLIC_TOOLS).toContain('list_products');
    expect(PUBLIC_TOOLS).toContain('list_campaigns');
    expect(PUBLIC_TOOLS).toContain('list_scheduled_jobs');
    expect(PUBLIC_TOOLS).toContain('list_pending_approvals');
    expect(PUBLIC_TOOLS).toContain('list_installed_skills');
  });

  it('should include info tools', () => {
    expect(PUBLIC_TOOLS).toContain('who_has_permission');
    expect(PUBLIC_TOOLS).toContain('get_member_info');
    expect(PUBLIC_TOOLS).toContain('agent_info');
    expect(PUBLIC_TOOLS).toContain('get_task_status');
    expect(PUBLIC_TOOLS).toContain('get_approval');
    expect(PUBLIC_TOOLS).toContain('list_approvers');
  });

  it('should include auth check tools', () => {
    expect(PUBLIC_TOOLS).toContain('check_email_auth');
    expect(PUBLIC_TOOLS).toContain('check_twitter_auth');
    expect(PUBLIC_TOOLS).toContain('check_linkedin_auth');
    expect(PUBLIC_TOOLS).toContain('check_ph_auth');
  });

  it('should include user self-service tools', () => {
    expect(PUBLIC_TOOLS).toContain('my_pending_approvals');
    expect(PUBLIC_TOOLS).toContain('update_member_preferences');
    expect(PUBLIC_TOOLS).toContain('search_skills');
  });

  it('should be an array', () => {
    expect(Array.isArray(PUBLIC_TOOLS)).toBe(true);
  });
});

describe('getToolPermission', () => {
  it('should return null for public tools', () => {
    expect(getToolPermission('list_team')).toBeNull();
    expect(getToolPermission('list_roles')).toBeNull();
    expect(getToolPermission('get_member_info')).toBeNull();
    expect(getToolPermission('check_email_auth')).toBeNull();
  });

  it('should return permission for protected tools', () => {
    expect(getToolPermission('add_team_member')).toBe('manage_team');
    expect(getToolPermission('post_tweet')).toBe('post');
    expect(getToolPermission('send_email')).toBe('send_email');
    expect(getToolPermission('add_lead')).toBe('manage_leads');
  });

  it('should return null for unknown tools', () => {
    expect(getToolPermission('unknown_tool')).toBeNull();
    expect(getToolPermission('not_a_real_tool')).toBeNull();
  });

  it('should return correct permission for admin-only tools', () => {
    expect(getToolPermission('create_agent')).toBe('admin');
  });

  it('should return correct permission for approval tools', () => {
    expect(getToolPermission('approve_content')).toBe('approve_content');
    expect(getToolPermission('reject_content')).toBe('approve_content');
    expect(getToolPermission('request_approval')).toBe('create_content');
  });

  it('should return correct permission for scheduling tools', () => {
    expect(getToolPermission('schedule_post')).toBe('post');
    expect(getToolPermission('schedule_reminder')).toBe('create_content');
    expect(getToolPermission('cancel_scheduled_job')).toBe('post');
  });
});
