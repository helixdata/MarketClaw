/**
 * Leads Tools
 * Manage product leads with automatic deduplication
 */

import { Tool, ToolResult } from './types.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

const WORKSPACE = path.join(homedir(), '.marketclaw', 'workspace');

interface Lead {
  id: string;
  email: string;
  name?: string;
  company?: string;
  source?: string;
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'converted' | 'lost';
  notes?: string;
  tags?: string[];
  metadata?: Record<string, string | number | boolean | null>;  // Flexible key-value storage
  createdAt: string;
  updatedAt: string;
  lastContactedAt?: string;
}

interface LeadsFile {
  meta: {
    productId: string;
    lastUpdated: string;
    dedupeKey: string;
  };
  leads: Lead[];
}

function generateId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getLeadsPath(productId: string): Promise<string> {
  const productDir = path.join(WORKSPACE, 'products', productId);
  await mkdir(productDir, { recursive: true });
  return path.join(productDir, 'leads.json');
}

async function loadLeads(productId: string): Promise<LeadsFile> {
  const leadsPath = await getLeadsPath(productId);
  
  if (!existsSync(leadsPath)) {
    return {
      meta: {
        productId,
        lastUpdated: new Date().toISOString(),
        dedupeKey: 'email',
      },
      leads: [],
    };
  }
  
  const data = await readFile(leadsPath, 'utf-8');
  return JSON.parse(data);
}

async function saveLeads(productId: string, data: LeadsFile): Promise<void> {
  const leadsPath = await getLeadsPath(productId);
  data.meta.lastUpdated = new Date().toISOString();
  await writeFile(leadsPath, JSON.stringify(data, null, 2));
}

// ============ Add Lead ============
export const addLeadTool: Tool = {
  name: 'add_lead',
  description: 'Add a new lead for a product. Automatically dedupes by email.',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID (e.g., "proofping")',
      },
      email: {
        type: 'string',
        description: 'Lead email address (required, used for deduplication)',
      },
      name: {
        type: 'string',
        description: 'Lead name',
      },
      company: {
        type: 'string',
        description: 'Company/organization name',
      },
      source: {
        type: 'string',
        description: 'Lead source (e.g., "twitter", "producthunt", "outreach", "referral")',
      },
      notes: {
        type: 'string',
        description: 'Notes about this lead',
      },
      tags: {
        type: 'string',
        description: 'Comma-separated tags',
      },
      metadata: {
        type: 'string',
        description: 'JSON object of custom metadata (e.g., {"role": "CEO", "size": "50-100", "interest": "high"})',
      },
    },
    required: ['productId', 'email'],
  },

  async execute(params): Promise<ToolResult> {
    const email = params.email.toLowerCase().trim();
    const data = await loadLeads(params.productId);
    
    // Parse metadata if provided
    let metadata: Record<string, string | number | boolean | null> | undefined;
    if (params.metadata) {
      try {
        metadata = JSON.parse(params.metadata);
      } catch {
        return { success: false, message: '❌ Invalid metadata JSON' };
      }
    }
    
    // Check for duplicate
    const existing = data.leads.find(l => l.email.toLowerCase() === email);
    if (existing) {
      // Update existing lead with new info
      let updated = false;
      if (params.name && !existing.name) { existing.name = params.name; updated = true; }
      if (params.company && !existing.company) { existing.company = params.company; updated = true; }
      if (params.source && !existing.source) { existing.source = params.source; updated = true; }
      if (params.notes) { 
        existing.notes = existing.notes ? `${existing.notes}\n---\n${params.notes}` : params.notes;
        updated = true;
      }
      if (params.tags) {
        const newTags = params.tags.split(',').map((t: string) => t.trim().toLowerCase());
        existing.tags = [...new Set([...(existing.tags || []), ...newTags])];
        updated = true;
      }
      if (metadata) {
        existing.metadata = { ...(existing.metadata || {}), ...metadata };
        updated = true;
      }
      
      if (updated) {
        existing.updatedAt = new Date().toISOString();
        await saveLeads(params.productId, data);
        return {
          success: true,
          message: `📝 Updated existing lead: ${email}`,
          data: existing,
        };
      }
      
      return {
        success: true,
        message: `ℹ️ Lead already exists: ${email}`,
        data: existing,
      };
    }
    
    // Create new lead
    const lead: Lead = {
      id: generateId(),
      email,
      name: params.name,
      company: params.company,
      source: params.source,
      status: 'new',
      notes: params.notes,
      tags: params.tags ? params.tags.split(',').map((t: string) => t.trim().toLowerCase()) : undefined,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    data.leads.push(lead);
    await saveLeads(params.productId, data);
    
    return {
      success: true,
      message: `✅ Added new lead: ${email}`,
      data: lead,
    };
  },
};

// ============ List Leads ============
export const listLeadsTool: Tool = {
  name: 'list_leads',
  description: 'List leads for a product with optional filters',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID',
      },
      status: {
        type: 'string',
        enum: ['new', 'contacted', 'responded', 'qualified', 'converted', 'lost', 'all'],
        description: 'Filter by status (default: all)',
      },
      source: {
        type: 'string',
        description: 'Filter by source',
      },
      tag: {
        type: 'string',
        description: 'Filter by tag',
      },
      limit: {
        type: 'number',
        description: 'Max results (default: 50)',
      },
    },
    required: ['productId'],
  },

  async execute(params): Promise<ToolResult> {
    const data = await loadLeads(params.productId);
    let leads = data.leads;
    
    // Apply filters
    if (params.status && params.status !== 'all') {
      leads = leads.filter(l => l.status === params.status);
    }
    if (params.source) {
      leads = leads.filter(l => l.source?.toLowerCase() === params.source.toLowerCase());
    }
    if (params.tag) {
      const tag = params.tag.toLowerCase();
      leads = leads.filter(l => l.tags?.includes(tag));
    }
    
    // Sort by most recent first
    leads = leads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    // Limit
    const limit = params.limit || 50;
    leads = leads.slice(0, limit);
    
    const stats = {
      total: data.leads.length,
      new: data.leads.filter(l => l.status === 'new').length,
      contacted: data.leads.filter(l => l.status === 'contacted').length,
      responded: data.leads.filter(l => l.status === 'responded').length,
      qualified: data.leads.filter(l => l.status === 'qualified').length,
      converted: data.leads.filter(l => l.status === 'converted').length,
    };
    
    return {
      success: true,
      message: `📋 ${leads.length} leads${params.status && params.status !== 'all' ? ` (${params.status})` : ''} for ${params.productId}`,
      data: { leads, stats },
    };
  },
};

// ============ Update Lead ============
export const updateLeadTool: Tool = {
  name: 'update_lead',
  description: 'Update a lead status, notes, or other fields',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID',
      },
      email: {
        type: 'string',
        description: 'Lead email to update',
      },
      status: {
        type: 'string',
        enum: ['new', 'contacted', 'responded', 'qualified', 'converted', 'lost'],
        description: 'New status',
      },
      notes: {
        type: 'string',
        description: 'Notes to append',
      },
      tags: {
        type: 'string',
        description: 'Tags to add (comma-separated)',
      },
      markContacted: {
        type: 'boolean',
        description: 'Set lastContactedAt to now',
      },
      metadata: {
        type: 'string',
        description: 'JSON object of metadata to merge (e.g., {"interest": "high", "budget": "10k"})',
      },
    },
    required: ['productId', 'email'],
  },

  async execute(params): Promise<ToolResult> {
    const email = params.email.toLowerCase().trim();
    const data = await loadLeads(params.productId);
    
    const lead = data.leads.find(l => l.email.toLowerCase() === email);
    if (!lead) {
      return {
        success: false,
        message: `❌ Lead not found: ${email}`,
      };
    }
    
    if (params.status) lead.status = params.status;
    if (params.notes) {
      lead.notes = lead.notes ? `${lead.notes}\n---\n${params.notes}` : params.notes;
    }
    if (params.tags) {
      const newTags = params.tags.split(',').map((t: string) => t.trim().toLowerCase());
      lead.tags = [...new Set([...(lead.tags || []), ...newTags])];
    }
    if (params.metadata) {
      try {
        const newMeta = JSON.parse(params.metadata);
        lead.metadata = { ...(lead.metadata || {}), ...newMeta };
      } catch {
        return { success: false, message: '❌ Invalid metadata JSON' };
      }
    }
    if (params.markContacted) {
      lead.lastContactedAt = new Date().toISOString();
      if (lead.status === 'new') lead.status = 'contacted';
    }
    
    lead.updatedAt = new Date().toISOString();
    await saveLeads(params.productId, data);
    
    return {
      success: true,
      message: `✅ Updated lead: ${email}`,
      data: lead,
    };
  },
};

// ============ Search Leads ============
export const searchLeadsTool: Tool = {
  name: 'search_leads',
  description: 'Search leads by name, email, company, or notes',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID',
      },
      query: {
        type: 'string',
        description: 'Search query',
      },
    },
    required: ['productId', 'query'],
  },

  async execute(params): Promise<ToolResult> {
    const data = await loadLeads(params.productId);
    const query = params.query.toLowerCase();
    
    const matches = data.leads.filter(l => 
      l.email.toLowerCase().includes(query) ||
      l.name?.toLowerCase().includes(query) ||
      l.company?.toLowerCase().includes(query) ||
      l.notes?.toLowerCase().includes(query) ||
      l.tags?.some(t => t.includes(query))
    );
    
    return {
      success: true,
      message: `🔍 Found ${matches.length} leads matching "${params.query}"`,
      data: { leads: matches },
    };
  },
};

// ============ Import Leads ============
export const importLeadsTool: Tool = {
  name: 'import_leads',
  description: 'Bulk import leads from a list. Dedupes automatically.',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID',
      },
      leads: {
        type: 'string',
        description: 'JSON array of leads: [{email, name?, company?, source?, notes?}, ...]',
      },
      source: {
        type: 'string',
        description: 'Default source for all imported leads',
      },
      tags: {
        type: 'string',
        description: 'Tags to add to all imported leads (comma-separated)',
      },
    },
    required: ['productId', 'leads'],
  },

  async execute(params): Promise<ToolResult> {
    let toImport: Array<{ email: string; name?: string; company?: string; source?: string; notes?: string; metadata?: Record<string, string | number | boolean | null> }>;
    try {
      toImport = JSON.parse(params.leads);
    } catch {
      return {
        success: false,
        message: '❌ Invalid JSON. Expected: [{email, name?, company?, source?, metadata?}, ...]',
      };
    }
    
    const data = await loadLeads(params.productId);
    const existingEmails = new Set(data.leads.map(l => l.email.toLowerCase()));
    const defaultTags = params.tags ? params.tags.split(',').map((t: string) => t.trim().toLowerCase()) : undefined;
    
    let added = 0;
    let skipped = 0;
    
    for (const item of toImport) {
      if (!item.email) continue;
      
      const email = item.email.toLowerCase().trim();
      if (existingEmails.has(email)) {
        skipped++;
        continue;
      }
      
      const lead: Lead = {
        id: generateId(),
        email,
        name: item.name,
        company: item.company,
        source: item.source || params.source,
        status: 'new',
        notes: item.notes,
        tags: defaultTags,
        metadata: item.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      data.leads.push(lead);
      existingEmails.add(email);
      added++;
    }
    
    await saveLeads(params.productId, data);
    
    return {
      success: true,
      message: `✅ Imported ${added} leads, ${skipped} duplicates skipped`,
      data: { added, skipped, total: data.leads.length },
    };
  },
};

// ============ Export All ============
export const leadsTools: Tool[] = [
  addLeadTool,
  listLeadsTool,
  updateLeadTool,
  searchLeadsTool,
  importLeadsTool,
];
