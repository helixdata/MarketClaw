/**
 * Leads Tools Unit Tests
 * Tests the CRM-lite lead management functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  addLeadTool,
  listLeadsTool,
  updateLeadTool,
  searchLeadsTool,
  importLeadsTool,
  leadsTools,
} from './leads-tools.js';

// Mock fs modules
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const mockedReadFile = vi.mocked(readFile);
const mockedWriteFile = vi.mocked(writeFile);
const mockedExistsSync = vi.mocked(existsSync);

// Test data factory
function createLeadsFile(leads: any[] = [], productId = 'test-product') {
  return {
    meta: {
      productId,
      lastUpdated: new Date().toISOString(),
      dedupeKey: 'email',
    },
    leads,
  };
}

function createLead(overrides: Partial<any> = {}) {
  return {
    id: `lead_${Date.now()}_abc123`,
    email: 'test@example.com',
    name: 'Test User',
    company: 'Test Corp',
    source: 'twitter',
    status: 'new',
    tags: ['test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Leads Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('leadsTools array', () => {
    it('exports all lead tools', () => {
      expect(leadsTools).toHaveLength(5);
      const names = leadsTools.map(t => t.name);
      expect(names).toContain('add_lead');
      expect(names).toContain('list_leads');
      expect(names).toContain('update_lead');
      expect(names).toContain('search_leads');
      expect(names).toContain('import_leads');
    });
  });

  describe('add_lead', () => {
    it('has correct tool definition', () => {
      expect(addLeadTool.name).toBe('add_lead');
      expect(addLeadTool.parameters.required).toContain('productId');
      expect(addLeadTool.parameters.required).toContain('email');
    });

    it('creates a new lead when none exists', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await addLeadTool.execute({
        productId: 'proofping',
        email: 'alice@example.com',
        name: 'Alice Smith',
        company: 'Acme Corp',
        source: 'twitter',
        tags: 'prospect,high-value',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Added new lead');
      expect(result.data).toMatchObject({
        email: 'alice@example.com',
        name: 'Alice Smith',
        company: 'Acme Corp',
        source: 'twitter',
        status: 'new',
        tags: ['prospect', 'high-value'],
      });
      expect(result.data.id).toMatch(/^lead_/);

      // Verify writeFile was called
      expect(mockedWriteFile).toHaveBeenCalled();
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
      expect(written.leads).toHaveLength(1);
    });

    it('normalizes email to lowercase', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await addLeadTool.execute({
        productId: 'test',
        email: 'ALICE@EXAMPLE.COM',
      });

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('alice@example.com');
    });

    it('deduplicates by email and returns existing lead', async () => {
      const existingLead = createLead({ email: 'alice@example.com', name: 'Alice' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([existingLead])));

      const result = await addLeadTool.execute({
        productId: 'test',
        email: 'alice@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('already exists');
      expect(mockedWriteFile).not.toHaveBeenCalled();
    });

    it('updates existing lead with new info', async () => {
      const existingLead = createLead({ 
        email: 'alice@example.com', 
        name: undefined, 
        company: undefined,
        tags: ['existing'],
      });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([existingLead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await addLeadTool.execute({
        productId: 'test',
        email: 'alice@example.com',
        name: 'Alice Smith',
        company: 'Acme',
        tags: 'new-tag',
        notes: 'Additional note',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated existing lead');
      expect(result.data.name).toBe('Alice Smith');
      expect(result.data.company).toBe('Acme');
      expect(result.data.tags).toContain('existing');
      expect(result.data.tags).toContain('new-tag');
      expect(mockedWriteFile).toHaveBeenCalled();
    });

    it('handles metadata JSON', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await addLeadTool.execute({
        productId: 'test',
        email: 'bob@example.com',
        metadata: JSON.stringify({ role: 'CEO', budget: 50000 }),
      });

      expect(result.success).toBe(true);
      expect(result.data.metadata).toEqual({ role: 'CEO', budget: 50000 });
    });

    it('rejects invalid metadata JSON', async () => {
      mockedExistsSync.mockReturnValue(false);

      const result = await addLeadTool.execute({
        productId: 'test',
        email: 'bob@example.com',
        metadata: 'not valid json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid metadata JSON');
    });

    it('appends notes with separator on duplicate', async () => {
      const existingLead = createLead({ 
        email: 'alice@example.com',
        notes: 'First note',
      });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([existingLead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await addLeadTool.execute({
        productId: 'test',
        email: 'alice@example.com',
        notes: 'Second note',
      });

      expect(result.success).toBe(true);
      expect(result.data.notes).toContain('First note');
      expect(result.data.notes).toContain('---');
      expect(result.data.notes).toContain('Second note');
    });
  });

  describe('list_leads', () => {
    it('has correct tool definition', () => {
      expect(listLeadsTool.name).toBe('list_leads');
      expect(listLeadsTool.parameters.required).toContain('productId');
    });

    it('returns empty list when no leads exist', async () => {
      mockedExistsSync.mockReturnValue(false);

      const result = await listLeadsTool.execute({
        productId: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.data.leads).toEqual([]);
      expect(result.data.stats.total).toBe(0);
    });

    it('returns all leads sorted by updatedAt', async () => {
      const leads = [
        createLead({ email: 'a@test.com', updatedAt: '2024-01-01T00:00:00Z' }),
        createLead({ email: 'b@test.com', updatedAt: '2024-01-15T00:00:00Z' }),
        createLead({ email: 'c@test.com', updatedAt: '2024-01-10T00:00:00Z' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await listLeadsTool.execute({
        productId: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.data.leads).toHaveLength(3);
      expect(result.data.leads[0].email).toBe('b@test.com');
      expect(result.data.leads[2].email).toBe('a@test.com');
    });

    it('filters by status', async () => {
      const leads = [
        createLead({ email: 'new@test.com', status: 'new' }),
        createLead({ email: 'contacted@test.com', status: 'contacted' }),
        createLead({ email: 'converted@test.com', status: 'converted' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await listLeadsTool.execute({
        productId: 'test',
        status: 'contacted',
      });

      expect(result.success).toBe(true);
      expect(result.data.leads).toHaveLength(1);
      expect(result.data.leads[0].email).toBe('contacted@test.com');
    });

    it('filters by source', async () => {
      const leads = [
        createLead({ email: 'twitter@test.com', source: 'twitter' }),
        createLead({ email: 'ph@test.com', source: 'producthunt' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await listLeadsTool.execute({
        productId: 'test',
        source: 'Twitter', // Test case insensitivity
      });

      expect(result.success).toBe(true);
      expect(result.data.leads).toHaveLength(1);
      expect(result.data.leads[0].source).toBe('twitter');
    });

    it('filters by tag', async () => {
      const leads = [
        createLead({ email: 'tagged@test.com', tags: ['vip', 'urgent'] }),
        createLead({ email: 'other@test.com', tags: ['normal'] }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await listLeadsTool.execute({
        productId: 'test',
        tag: 'vip',
      });

      expect(result.success).toBe(true);
      expect(result.data.leads).toHaveLength(1);
      expect(result.data.leads[0].email).toBe('tagged@test.com');
    });

    it('respects limit parameter', async () => {
      const leads = Array.from({ length: 10 }, (_, i) => 
        createLead({ email: `user${i}@test.com`, updatedAt: `2024-01-${10 + i}T00:00:00Z` })
      );
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await listLeadsTool.execute({
        productId: 'test',
        limit: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data.leads).toHaveLength(3);
    });

    it('returns correct stats', async () => {
      const leads = [
        createLead({ email: 'a@test.com', status: 'new' }),
        createLead({ email: 'b@test.com', status: 'new' }),
        createLead({ email: 'c@test.com', status: 'contacted' }),
        createLead({ email: 'd@test.com', status: 'converted' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await listLeadsTool.execute({
        productId: 'test',
      });

      expect(result.data.stats).toEqual({
        total: 4,
        new: 2,
        contacted: 1,
        responded: 0,
        qualified: 0,
        converted: 1,
      });
    });

    it('returns all leads when status is "all"', async () => {
      const leads = [
        createLead({ email: 'a@test.com', status: 'new' }),
        createLead({ email: 'b@test.com', status: 'converted' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await listLeadsTool.execute({
        productId: 'test',
        status: 'all',
      });

      expect(result.data.leads).toHaveLength(2);
    });
  });

  describe('update_lead', () => {
    it('has correct tool definition', () => {
      expect(updateLeadTool.name).toBe('update_lead');
      expect(updateLeadTool.parameters.required).toContain('productId');
      expect(updateLeadTool.parameters.required).toContain('email');
    });

    it('returns error when lead not found', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([])));

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'notfound@test.com',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('updates lead status', async () => {
      const lead = createLead({ email: 'alice@test.com', status: 'new' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        status: 'qualified',
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('qualified');
    });

    it('appends notes with separator', async () => {
      const lead = createLead({ email: 'alice@test.com', notes: 'Original note' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        notes: 'New note',
      });

      expect(result.success).toBe(true);
      expect(result.data.notes).toContain('Original note');
      expect(result.data.notes).toContain('---');
      expect(result.data.notes).toContain('New note');
    });

    it('adds new notes when none exist', async () => {
      const lead = createLead({ email: 'alice@test.com', notes: undefined });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        notes: 'First note',
      });

      expect(result.success).toBe(true);
      expect(result.data.notes).toBe('First note');
    });

    it('merges tags', async () => {
      const lead = createLead({ email: 'alice@test.com', tags: ['existing'] });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        tags: 'new-tag, another-tag',
      });

      expect(result.success).toBe(true);
      expect(result.data.tags).toContain('existing');
      expect(result.data.tags).toContain('new-tag');
      expect(result.data.tags).toContain('another-tag');
    });

    it('deduplicates tags', async () => {
      const lead = createLead({ email: 'alice@test.com', tags: ['existing'] });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        tags: 'existing, new',
      });

      expect(result.data.tags.filter((t: string) => t === 'existing')).toHaveLength(1);
    });

    it('sets lastContactedAt and updates status when markContacted', async () => {
      const lead = createLead({ email: 'alice@test.com', status: 'new' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        markContacted: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.lastContactedAt).toBe('2024-01-15T10:00:00.000Z');
      expect(result.data.status).toBe('contacted');
    });

    it('does not change status on markContacted if not "new"', async () => {
      const lead = createLead({ email: 'alice@test.com', status: 'qualified' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        markContacted: true,
      });

      expect(result.data.status).toBe('qualified');
      expect(result.data.lastContactedAt).toBeDefined();
    });

    it('merges metadata', async () => {
      const lead = createLead({ 
        email: 'alice@test.com', 
        metadata: { existing: 'value' },
      });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        metadata: JSON.stringify({ newKey: 123 }),
      });

      expect(result.success).toBe(true);
      expect(result.data.metadata).toEqual({ existing: 'value', newKey: 123 });
    });

    it('rejects invalid metadata JSON', async () => {
      const lead = createLead({ email: 'alice@test.com' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        metadata: 'invalid json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid metadata JSON');
    });

    it('updates updatedAt timestamp', async () => {
      const lead = createLead({ 
        email: 'alice@test.com', 
        updatedAt: '2024-01-01T00:00:00Z',
      });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'alice@test.com',
        status: 'responded',
      });

      expect(result.data.updatedAt).toBe('2024-01-15T10:00:00.000Z');
    });

    it('finds lead case-insensitively', async () => {
      const lead = createLead({ email: 'alice@test.com' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([lead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const result = await updateLeadTool.execute({
        productId: 'test',
        email: 'ALICE@TEST.COM',
        status: 'contacted',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('search_leads', () => {
    it('has correct tool definition', () => {
      expect(searchLeadsTool.name).toBe('search_leads');
      expect(searchLeadsTool.parameters.required).toContain('productId');
      expect(searchLeadsTool.parameters.required).toContain('query');
    });

    it('returns empty array when no matches', async () => {
      const leads = [createLead({ email: 'alice@test.com', name: 'Alice' })];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await searchLeadsTool.execute({
        productId: 'test',
        query: 'bob',
      });

      expect(result.success).toBe(true);
      expect(result.data.leads).toEqual([]);
    });

    it('searches by email', async () => {
      const leads = [
        createLead({ email: 'alice@test.com' }),
        createLead({ email: 'bob@example.com' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await searchLeadsTool.execute({
        productId: 'test',
        query: 'alice',
      });

      expect(result.data.leads).toHaveLength(1);
      expect(result.data.leads[0].email).toBe('alice@test.com');
    });

    it('searches by name', async () => {
      const leads = [
        createLead({ email: 'a@test.com', name: 'Alice Smith' }),
        createLead({ email: 'b@test.com', name: 'Bob Jones' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await searchLeadsTool.execute({
        productId: 'test',
        query: 'smith',
      });

      expect(result.data.leads).toHaveLength(1);
      expect(result.data.leads[0].name).toBe('Alice Smith');
    });

    it('searches by company', async () => {
      const leads = [
        createLead({ email: 'a@test.com', company: 'Acme Corp' }),
        createLead({ email: 'b@test.com', company: 'Beta Inc' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await searchLeadsTool.execute({
        productId: 'test',
        query: 'acme',
      });

      expect(result.data.leads).toHaveLength(1);
      expect(result.data.leads[0].company).toBe('Acme Corp');
    });

    it('searches by notes', async () => {
      const leads = [
        createLead({ email: 'a@test.com', notes: 'Interested in enterprise plan' }),
        createLead({ email: 'b@test.com', notes: 'Looking for free tier' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await searchLeadsTool.execute({
        productId: 'test',
        query: 'enterprise',
      });

      expect(result.data.leads).toHaveLength(1);
    });

    it('searches by tags', async () => {
      const leads = [
        createLead({ email: 'a@test.com', tags: ['vip', 'enterprise'] }),
        createLead({ email: 'b@test.com', tags: ['standard'] }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await searchLeadsTool.execute({
        productId: 'test',
        query: 'vip',
      });

      expect(result.data.leads).toHaveLength(1);
    });

    it('is case-insensitive', async () => {
      const leads = [createLead({ email: 'alice@test.com', name: 'Alice Smith' })];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await searchLeadsTool.execute({
        productId: 'test',
        query: 'ALICE',
      });

      expect(result.data.leads).toHaveLength(1);
    });

    it('returns multiple matches', async () => {
      const leads = [
        createLead({ email: 'alice@acme.com', company: 'Acme Corp' }),
        createLead({ email: 'bob@acme.com', company: 'Acme Inc' }),
        createLead({ email: 'charlie@other.com', company: 'Other LLC' }),
      ];
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile(leads)));

      const result = await searchLeadsTool.execute({
        productId: 'test',
        query: 'acme',
      });

      expect(result.data.leads).toHaveLength(2);
    });
  });

  describe('import_leads', () => {
    it('has correct tool definition', () => {
      expect(importLeadsTool.name).toBe('import_leads');
      expect(importLeadsTool.parameters.required).toContain('productId');
      expect(importLeadsTool.parameters.required).toContain('leads');
    });

    it('rejects invalid JSON', async () => {
      const result = await importLeadsTool.execute({
        productId: 'test',
        leads: 'not valid json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid JSON');
    });

    it('imports leads successfully', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const toImport = [
        { email: 'alice@test.com', name: 'Alice' },
        { email: 'bob@test.com', name: 'Bob', company: 'Acme' },
      ];

      const result = await importLeadsTool.execute({
        productId: 'test',
        leads: JSON.stringify(toImport),
      });

      expect(result.success).toBe(true);
      expect(result.data.added).toBe(2);
      expect(result.data.skipped).toBe(0);
      expect(result.data.total).toBe(2);
    });

    it('skips duplicates', async () => {
      const existingLead = createLead({ email: 'alice@test.com' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([existingLead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const toImport = [
        { email: 'alice@test.com', name: 'Alice Duplicate' },
        { email: 'bob@test.com', name: 'Bob New' },
      ];

      const result = await importLeadsTool.execute({
        productId: 'test',
        leads: JSON.stringify(toImport),
      });

      expect(result.success).toBe(true);
      expect(result.data.added).toBe(1);
      expect(result.data.skipped).toBe(1);
    });

    it('applies default source to imported leads', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const toImport = [
        { email: 'alice@test.com' },
      ];

      const result = await importLeadsTool.execute({
        productId: 'test',
        leads: JSON.stringify(toImport),
        source: 'producthunt',
      });

      expect(result.success).toBe(true);
      
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
      expect(written.leads[0].source).toBe('producthunt');
    });

    it('applies default tags to all imported leads', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const toImport = [
        { email: 'alice@test.com' },
        { email: 'bob@test.com' },
      ];

      const result = await importLeadsTool.execute({
        productId: 'test',
        leads: JSON.stringify(toImport),
        tags: 'batch-import, jan-2024',
      });

      expect(result.success).toBe(true);
      
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
      expect(written.leads[0].tags).toContain('batch-import');
      expect(written.leads[0].tags).toContain('jan-2024');
      expect(written.leads[1].tags).toContain('batch-import');
    });

    it('skips entries without email', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const toImport = [
        { email: 'valid@test.com', name: 'Valid' },
        { name: 'No Email' }, // Missing email
        { email: '', name: 'Empty Email' }, // Empty email (will be added as empty)
      ];

      const result = await importLeadsTool.execute({
        productId: 'test',
        leads: JSON.stringify(toImport),
      });

      expect(result.success).toBe(true);
      // Only valid@test.com should be added (empty string is falsy but treated differently)
      expect(result.data.added).toBe(1);
    });

    it('preserves metadata from imported leads', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const toImport = [
        { 
          email: 'alice@test.com', 
          metadata: { role: 'CTO', interest: 'high' },
        },
      ];

      const result = await importLeadsTool.execute({
        productId: 'test',
        leads: JSON.stringify(toImport),
      });

      expect(result.success).toBe(true);
      
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
      expect(written.leads[0].metadata).toEqual({ role: 'CTO', interest: 'high' });
    });

    it('handles case-insensitive duplicate detection', async () => {
      const existingLead = createLead({ email: 'alice@test.com' });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(createLeadsFile([existingLead])));
      mockedWriteFile.mockResolvedValue(undefined);

      const toImport = [
        { email: 'ALICE@TEST.COM' }, // Should be detected as duplicate
      ];

      const result = await importLeadsTool.execute({
        productId: 'test',
        leads: JSON.stringify(toImport),
      });

      expect(result.data.skipped).toBe(1);
      expect(result.data.added).toBe(0);
    });

    it('sets all new leads to status "new"', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const toImport = [
        { email: 'alice@test.com' },
      ];

      await importLeadsTool.execute({
        productId: 'test',
        leads: JSON.stringify(toImport),
      });

      const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
      expect(written.leads[0].status).toBe('new');
    });

    it('uses item source over default source', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedWriteFile.mockResolvedValue(undefined);

      const toImport = [
        { email: 'alice@test.com', source: 'twitter' },
        { email: 'bob@test.com' }, // No source, should use default
      ];

      await importLeadsTool.execute({
        productId: 'test',
        leads: JSON.stringify(toImport),
        source: 'default-source',
      });

      const written = JSON.parse(mockedWriteFile.mock.calls[0][1] as string);
      expect(written.leads[0].source).toBe('twitter');
      expect(written.leads[1].source).toBe('default-source');
    });
  });
});
