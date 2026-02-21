/**
 * Memory Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Memory, Product, Campaign, MemoryState } from './index.js';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

describe('Memory', () => {
  let memory: Memory;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'marketclaw-memory-test-'));
    memory = new Memory(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ========== Brand Tests ==========

  describe('getBrand / setBrand', () => {
    it('should return null when brand does not exist', async () => {
      const brand = await memory.getBrand();
      expect(brand).toBeNull();
    });

    it('should save and retrieve brand content', async () => {
      const brandContent = `# Our Brand
      
Voice: Professional but friendly
Values: Innovation, Quality, Trust`;

      await memory.setBrand(brandContent);
      const retrieved = await memory.getBrand();

      expect(retrieved).toBe(brandContent);
    });

    it('should overwrite existing brand', async () => {
      await memory.setBrand('Original brand');
      await memory.setBrand('Updated brand');

      const retrieved = await memory.getBrand();
      expect(retrieved).toBe('Updated brand');
    });
  });

  // ========== Products Tests ==========

  describe('getProduct / saveProduct / listProducts', () => {
    const testProduct: Product = {
      id: 'prod-1',
      name: 'Test Product',
      tagline: 'The best product ever',
      description: 'A comprehensive test product for all your testing needs',
      features: ['Feature A', 'Feature B', 'Feature C'],
      audience: ['Developers', 'Testers', 'QA Engineers'],
      positioning: 'Premium testing solution',
      competitors: ['Competitor X', 'Competitor Y'],
      links: { website: 'https://example.com' },
      createdAt: 0,
      updatedAt: 0,
    };

    it('should return null for non-existent product', async () => {
      const product = await memory.getProduct('non-existent');
      expect(product).toBeNull();
    });

    it('should save and retrieve a product', async () => {
      await memory.saveProduct(testProduct);
      const retrieved = await memory.getProduct('prod-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('prod-1');
      expect(retrieved!.name).toBe('Test Product');
      expect(retrieved!.tagline).toBe('The best product ever');
      expect(retrieved!.features).toEqual(['Feature A', 'Feature B', 'Feature C']);
    });

    it('should set createdAt on first save', async () => {
      const product = { ...testProduct, createdAt: 0 };
      await memory.saveProduct(product);
      const retrieved = await memory.getProduct('prod-1');

      expect(retrieved!.createdAt).toBeGreaterThan(0);
    });

    it('should update updatedAt on save', async () => {
      await memory.saveProduct(testProduct);
      const first = await memory.getProduct('prod-1');

      // Small delay to ensure different timestamp
      await new Promise(r => setTimeout(r, 10));

      await memory.saveProduct({ ...testProduct, name: 'Updated Name' });
      const second = await memory.getProduct('prod-1');

      expect(second!.updatedAt).toBeGreaterThanOrEqual(first!.updatedAt);
      expect(second!.name).toBe('Updated Name');
    });

    it('should list all products', async () => {
      await memory.saveProduct(testProduct);
      await memory.saveProduct({
        ...testProduct,
        id: 'prod-2',
        name: 'Second Product',
      });

      const products = await memory.listProducts();
      expect(products.length).toBe(2);
      expect(products.map(p => p.id).sort()).toEqual(['prod-1', 'prod-2']);
    });

    it('should return empty array when no products', async () => {
      const products = await memory.listProducts();
      expect(products).toEqual([]);
    });
  });

  // ========== Campaigns Tests ==========

  describe('getCampaign / saveCampaign / listCampaigns', () => {
    const testCampaign: Campaign = {
      id: 'camp-1',
      productId: 'prod-1',
      name: 'Launch Campaign',
      status: 'active',
      channels: ['twitter', 'linkedin'],
      startDate: Date.now(),
      posts: [
        {
          id: 'post-1',
          channel: 'twitter',
          content: 'Exciting launch!',
          status: 'published',
        },
      ],
      metrics: {
        impressions: 1000,
        clicks: 50,
        engagement: 5.0,
      },
      notes: 'Initial launch campaign',
      createdAt: 0,
      updatedAt: 0,
    };

    it('should return null for non-existent campaign', async () => {
      const campaign = await memory.getCampaign('non-existent');
      expect(campaign).toBeNull();
    });

    it('should save and retrieve a campaign', async () => {
      await memory.saveCampaign(testCampaign);
      const retrieved = await memory.getCampaign('camp-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('camp-1');
      expect(retrieved!.name).toBe('Launch Campaign');
      expect(retrieved!.status).toBe('active');
      expect(retrieved!.channels).toEqual(['twitter', 'linkedin']);
      expect(retrieved!.posts.length).toBe(1);
    });

    it('should set createdAt on first save', async () => {
      const campaign = { ...testCampaign, createdAt: 0 };
      await memory.saveCampaign(campaign);
      const retrieved = await memory.getCampaign('camp-1');

      expect(retrieved!.createdAt).toBeGreaterThan(0);
    });

    it('should update updatedAt on save', async () => {
      await memory.saveCampaign(testCampaign);
      const first = await memory.getCampaign('camp-1');

      await new Promise(r => setTimeout(r, 10));

      await memory.saveCampaign({ ...testCampaign, status: 'completed' });
      const second = await memory.getCampaign('camp-1');

      expect(second!.updatedAt).toBeGreaterThanOrEqual(first!.updatedAt);
      expect(second!.status).toBe('completed');
    });

    it('should list all campaigns', async () => {
      await memory.saveCampaign(testCampaign);
      await memory.saveCampaign({
        ...testCampaign,
        id: 'camp-2',
        name: 'Second Campaign',
      });

      const campaigns = await memory.listCampaigns();
      expect(campaigns.length).toBe(2);
    });

    it('should filter campaigns by productId', async () => {
      await memory.saveCampaign(testCampaign);
      await memory.saveCampaign({
        ...testCampaign,
        id: 'camp-2',
        productId: 'prod-2',
        name: 'Different Product Campaign',
      });

      const prod1Campaigns = await memory.listCampaigns('prod-1');
      expect(prod1Campaigns.length).toBe(1);
      expect(prod1Campaigns[0].id).toBe('camp-1');

      const prod2Campaigns = await memory.listCampaigns('prod-2');
      expect(prod2Campaigns.length).toBe(1);
      expect(prod2Campaigns[0].id).toBe('camp-2');
    });

    it('should return empty array when no campaigns', async () => {
      const campaigns = await memory.listCampaigns();
      expect(campaigns).toEqual([]);
    });
  });

  // ========== State Tests ==========

  describe('getState / saveState', () => {
    it('should return default state when none exists', async () => {
      const state = await memory.getState();

      expect(state.lastInteraction).toBeGreaterThan(0);
      expect(state.preferences).toEqual({});
      expect(state.activeProduct).toBeUndefined();
      expect(state.activeCampaign).toBeUndefined();
    });

    it('should save and retrieve state', async () => {
      const state: MemoryState = {
        activeProduct: 'prod-1',
        activeCampaign: 'camp-1',
        lastInteraction: Date.now(),
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      };

      await memory.saveState(state);
      const retrieved = await memory.getState();

      expect(retrieved.activeProduct).toBe('prod-1');
      expect(retrieved.activeCampaign).toBe('camp-1');
      expect(retrieved.preferences.theme).toBe('dark');
      expect(retrieved.preferences.notifications).toBe(true);
    });

    it('should update lastInteraction on save', async () => {
      const state: MemoryState = {
        lastInteraction: 1000, // Old timestamp
        preferences: {},
      };

      await memory.saveState(state);
      const retrieved = await memory.getState();

      expect(retrieved.lastInteraction).toBeGreaterThan(1000);
    });
  });

  // ========== Sessions Tests ==========

  describe('appendToSession / getSession', () => {
    it('should return empty array for non-existent session', async () => {
      const session = await memory.getSession('non-existent');
      expect(session).toEqual([]);
    });

    it('should append entry to session', async () => {
      await memory.appendToSession('session-1', {
        role: 'user',
        content: 'Hello!',
      });

      const session = await memory.getSession('session-1');
      expect(session.length).toBe(1);
      expect(session[0].role).toBe('user');
      expect(session[0].content).toBe('Hello!');
      expect(session[0].timestamp).toBeGreaterThan(0);
    });

    it('should append multiple entries', async () => {
      await memory.appendToSession('session-1', { role: 'user', content: 'Hi' });
      await memory.appendToSession('session-1', { role: 'assistant', content: 'Hello!' });
      await memory.appendToSession('session-1', { role: 'user', content: 'How are you?' });

      const session = await memory.getSession('session-1');
      expect(session.length).toBe(3);
      expect(session[0].content).toBe('Hi');
      expect(session[1].content).toBe('Hello!');
      expect(session[2].content).toBe('How are you?');
    });
  });

  // ========== buildContext Tests ==========

  describe('buildContext', () => {
    it('should return empty string when no data', async () => {
      const context = await memory.buildContext();
      expect(context).toBe('');
    });

    it('should include brand in context', async () => {
      await memory.setBrand('# Our Brand\nWe are awesome');

      const context = await memory.buildContext();
      expect(context).toContain('# Brand Identity');
      expect(context).toContain('We are awesome');
    });

    it('should include active product in context', async () => {
      const product: Product = {
        id: 'prod-1',
        name: 'Test Product',
        description: 'A test product',
        features: ['Feature A'],
        audience: ['Devs'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await memory.saveProduct(product);
      await memory.saveState({
        activeProduct: 'prod-1',
        lastInteraction: Date.now(),
        preferences: {},
      });

      const context = await memory.buildContext();
      expect(context).toContain('# Active Product: Test Product');
      expect(context).toContain('prod-1');
    });

    it('should include active campaign in context', async () => {
      const campaign: Campaign = {
        id: 'camp-1',
        productId: 'prod-1',
        name: 'Launch Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await memory.saveCampaign(campaign);
      await memory.saveState({
        activeCampaign: 'camp-1',
        lastInteraction: Date.now(),
        preferences: {},
      });

      const context = await memory.buildContext();
      expect(context).toContain('# Active Campaign: Launch Campaign');
    });

    it('should include products summary in context', async () => {
      await memory.saveProduct({
        id: 'prod-1',
        name: 'Product One',
        tagline: 'First product tagline',
        description: 'First product description',
        features: [],
        audience: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await memory.saveProduct({
        id: 'prod-2',
        name: 'Product Two',
        description: 'Second product description',
        features: [],
        audience: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const context = await memory.buildContext();
      expect(context).toContain('# Products');
      expect(context).toContain('Product One: First product tagline');
      expect(context).toContain('Product Two: Second product description');
    });

    it('should combine all context parts', async () => {
      // Set up brand
      await memory.setBrand('# Brand\nWe are the best');

      // Set up product
      await memory.saveProduct({
        id: 'prod-1',
        name: 'Super Product',
        tagline: 'It is super',
        description: 'The most super product',
        features: ['Super feature'],
        audience: ['Super users'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Set up campaign
      await memory.saveCampaign({
        id: 'camp-1',
        productId: 'prod-1',
        name: 'Super Campaign',
        status: 'active',
        channels: ['twitter'],
        posts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Set active product and campaign
      await memory.saveState({
        activeProduct: 'prod-1',
        activeCampaign: 'camp-1',
        lastInteraction: Date.now(),
        preferences: {},
      });

      const context = await memory.buildContext();

      // Should have all sections
      expect(context).toContain('# Brand Identity');
      expect(context).toContain('# Active Product: Super Product');
      expect(context).toContain('# Active Campaign: Super Campaign');
      expect(context).toContain('# Products');

      // Should be separated by dividers
      expect(context).toContain('---');
    });
  });
});
