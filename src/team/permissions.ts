/**
 * Permission Enforcement
 * Maps tools to required permissions
 */

import { Permission } from './types.js';

/**
 * Tool → Required Permission mapping
 */
export const TOOL_PERMISSIONS: Record<string, Permission> = {
  // Team management (admin only)
  'add_team_member': 'manage_team',
  'remove_team_member': 'manage_team',
  'update_team_member': 'manage_team',
  'assign_roles': 'manage_team',
  'suspend_member': 'manage_team',
  'activate_member': 'manage_team',
  
  // Content creation
  'draft_email': 'create_content',
  'draft_ph_post': 'create_content',
  'generate_image': 'create_content',
  
  // Sending/posting (needs approval or post permission)
  'send_email': 'send_email',
  'send_launch_announcement': 'send_email',
  'post_tweet': 'post',
  'post_linkedin': 'post',
  'create_ph_launch': 'post',
  
  // Scheduling
  'schedule_post': 'post',           // Scheduling a post = posting permission
  'schedule_reminder': 'create_content',  // Anyone who can create can set reminders
  'cancel_scheduled_job': 'post',    // Canceling requires post permission
  'pause_scheduled_job': 'post',
  'resume_scheduled_job': 'post',
  'run_job_now': 'post',             // Running a job immediately = posting
  
  // Lead management
  'add_lead': 'manage_leads',
  'update_lead': 'manage_leads',
  'import_leads': 'manage_leads',
  
  // Analytics (view only)
  'list_leads': 'view_analytics',
  'search_leads': 'view_analytics',
  
  // Products & Campaigns
  'add_product': 'manage_products',
  'update_product': 'manage_products',
  'create_campaign': 'manage_campaigns',
  'update_campaign': 'manage_campaigns',
  
  // Sub-agents
  'delegate_task': 'use_agents',
  'create_agent': 'admin',
  
  // Approvals
  'approve_content': 'approve_content',
  'reject_content': 'approve_content',
  'request_approval': 'create_content',  // Anyone who can create can request approval
};

/**
 * Tools that require knowing the current user context
 */
export const USER_CONTEXT_TOOLS: string[] = [
  'request_approval',
  'my_pending_approvals',
];

/**
 * Tools that anyone can use (no permission required)
 */
export const PUBLIC_TOOLS: string[] = [
  'list_team',
  'list_roles',
  'list_permissions',
  'who_has_permission',
  'get_member_info',
  'list_agents',
  'agent_info',
  'get_task_status',
  'list_products',
  'list_campaigns',
  'list_scheduled_jobs',        // View-only
  'list_pending_approvals',     // View-only
  'get_approval',               // View-only
  'list_approvers',             // View-only
  'my_pending_approvals',       // Own approvals
  'list_installed_skills',
  'search_skills',
  'check_email_auth',
  'check_twitter_auth',
  'check_linkedin_auth',
  'check_ph_auth',
  'update_member_preferences',  // Can update own preferences
  'remember_about_member',      // Admins use this, but checking happens inside
];

/**
 * Get required permission for a tool
 */
export function getToolPermission(toolName: string): Permission | null {
  if (PUBLIC_TOOLS.includes(toolName)) {
    return null;  // No permission needed
  }
  return TOOL_PERMISSIONS[toolName] || null;
}
