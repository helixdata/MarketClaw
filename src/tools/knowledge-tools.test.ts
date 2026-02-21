/**
 * Knowledge Tools Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchKnowledgeTool,
  addKnowledgeTool,
  setActiveProductTool,
  getActiveProductTool,
  listProductsTool,
} from './knowledge-tools.js';

// Mock the knowledge module
vi.mock('../knowledge/index.js', () => ({
  knowledge: {
    search: vi.fn(),
    addKnowledge: vi.fn(),
  },
}));

// Mock the memory module
vi.mock('../memory/index.js', () => ({
  memory: {
    getState: vi.fn(),
    saveState: vi.fn(),
    getProduct: vi.fn(),
    listProducts: vi.fn(),
  },
}));

// Import mocked modules
import { knowledge } from '../knowledge/index.js';
import { memory } from '../memory/index.js';

describe('Knowledge Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ searchKnowledgeTool ============
  describe('searchKnowledgeTool', () => {
    it('should have correct metadata', () => {
      expect(searchKnowledgeTool.name).toBe('search_knowledge');
      expect(searchKnowledgeTool.parameters.required).toContain('query');
    });

    it('should search with explicit productId', async () => {
      vi.mocked(knowledge.search).mockResolvedValue([
        { file: 'VOICE.md', section: 'Tone', content: 'Be friendly and approachable', score: 0.95 },
        { file: 'research/audience.md', section: 'Demographics', content: 'Tech-savvy millennials', score: 0.82 },
      ]);

      const result = await searchKnowledgeTool.execute({
        query: 'voice guidelines',
        productId: 'acme-saas',
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Found 2 result(s).');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].file).toBe('VOICE.md');
      expect(result.data[0].score).toBe('95%');
      expect(knowledge.search).toHaveBeenCalledWith('acme-saas', 'voice guidelines', 5);
    });

    it('should use active product when productId not specified', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'my-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(knowledge.search).mockResolvedValue([
        { file: 'VOICE.md', content: 'Voice content', score: 0.9 },
      ]);

      const result = await searchKnowledgeTool.execute({ query: 'tone' });

      expect(result.success).toBe(true);
      expect(knowledge.search).toHaveBeenCalledWith('my-product', 'tone', 5);
    });

    it('should fail when no product specified and no active product', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await searchKnowledgeTool.execute({ query: 'anything' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No product specified');
    });

    it('should return empty results gracefully', async () => {
      vi.mocked(knowledge.search).mockResolvedValue([]);

      const result = await searchKnowledgeTool.execute({
        query: 'nonexistent',
        productId: 'test-product',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('No results found');
      expect(result.data).toEqual([]);
    });

    it('should handle search errors', async () => {
      vi.mocked(knowledge.search).mockRejectedValue(new Error('Embedding API failed'));

      const result = await searchKnowledgeTool.execute({
        query: 'test',
        productId: 'product-1',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Search failed');
      expect(result.message).toContain('Embedding API failed');
    });

    it('should default limit to 5', async () => {
      vi.mocked(knowledge.search).mockResolvedValue([]);

      await searchKnowledgeTool.execute({
        query: 'test',
        productId: 'product-1',
      });

      expect(knowledge.search).toHaveBeenCalledWith('product-1', 'test', 5);
    });
  });

  // ============ addKnowledgeTool ============
  describe('addKnowledgeTool', () => {
    it('should have correct metadata', () => {
      expect(addKnowledgeTool.name).toBe('add_knowledge');
      expect(addKnowledgeTool.parameters.required).toContain('content');
      expect(addKnowledgeTool.parameters.required).toContain('type');
    });

    it('should add knowledge with explicit productId', async () => {
      vi.mocked(knowledge.addKnowledge).mockResolvedValue('learnings/insights.md');

      const result = await addKnowledgeTool.execute({
        content: 'Emojis in subject lines increase open rates by 15%',
        type: 'learning',
        productId: 'newsletter-app',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('learnings/insights.md');
      expect(result.data.file).toBe('learnings/insights.md');
      expect(result.data.productId).toBe('newsletter-app');
      expect(knowledge.addKnowledge).toHaveBeenCalledWith('newsletter-app', {
        type: 'learning',
        category: undefined,
        content: 'Emojis in subject lines increase open rates by 15%',
      });
    });

    it('should use active product when productId not specified', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-prod',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(knowledge.addKnowledge).mockResolvedValue('research/competitors.md');

      const result = await addKnowledgeTool.execute({
        content: 'Competitor X launched new feature',
        type: 'research',
        category: 'competitors',
      });

      expect(result.success).toBe(true);
      expect(knowledge.addKnowledge).toHaveBeenCalledWith('active-prod', {
        type: 'research',
        category: 'competitors',
        content: 'Competitor X launched new feature',
      });
    });

    it('should fail when no product available', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await addKnowledgeTool.execute({
        content: 'Some knowledge',
        type: 'voice',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No product specified');
    });

    it('should handle add errors', async () => {
      vi.mocked(knowledge.addKnowledge).mockRejectedValue(new Error('Write failed'));

      const result = await addKnowledgeTool.execute({
        content: 'content',
        type: 'asset',
        productId: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to add knowledge');
      expect(result.message).toContain('Write failed');
    });

    it('should support all knowledge types', async () => {
      vi.mocked(knowledge.addKnowledge).mockResolvedValue('VOICE.md');

      const types = ['voice', 'research', 'learning', 'asset'] as const;
      for (const type of types) {
        await addKnowledgeTool.execute({
          content: `Test ${type}`,
          type,
          productId: 'test-product',
        });
      }

      expect(knowledge.addKnowledge).toHaveBeenCalledTimes(4);
    });
  });

  // ============ setActiveProductTool ============
  describe('setActiveProductTool', () => {
    it('should have correct metadata', () => {
      expect(setActiveProductTool.name).toBe('set_active_product');
      expect(setActiveProductTool.parameters.required).toContain('productId');
    });

    it('should set active product successfully', async () => {
      vi.mocked(memory.getProduct).mockResolvedValue({
        id: 'my-saas',
        name: 'My SaaS Product',
        description: 'A great product',
        features: [],
        audience: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      vi.mocked(memory.getState).mockResolvedValue({
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(memory.saveState).mockResolvedValue(undefined);

      const result = await setActiveProductTool.execute({ productId: 'my-saas' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('My SaaS Product');
      expect(result.data.productId).toBe('my-saas');
      expect(result.data.productName).toBe('My SaaS Product');
      expect(memory.saveState).toHaveBeenCalledWith(
        expect.objectContaining({ activeProduct: 'my-saas' })
      );
    });

    it('should fail when product not found', async () => {
      vi.mocked(memory.getProduct).mockResolvedValue(null);
      vi.mocked(memory.listProducts).mockResolvedValue([
        { id: 'prod-a', name: 'Product A', description: '', features: [], audience: [], createdAt: 0, updatedAt: 0 },
        { id: 'prod-b', name: 'Product B', description: '', features: [], audience: [], createdAt: 0, updatedAt: 0 },
      ]);

      const result = await setActiveProductTool.execute({ productId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
      expect(result.message).toContain('prod-a, prod-b');
    });

    it('should show "none" when no products exist', async () => {
      vi.mocked(memory.getProduct).mockResolvedValue(null);
      vi.mocked(memory.listProducts).mockResolvedValue([]);

      const result = await setActiveProductTool.execute({ productId: 'any' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Available: none');
    });
  });

  // ============ getActiveProductTool ============
  describe('getActiveProductTool', () => {
    it('should have correct metadata', () => {
      expect(getActiveProductTool.name).toBe('get_active_product');
    });

    it('should return active product', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'current-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(memory.getProduct).mockResolvedValue({
        id: 'current-product',
        name: 'Current Product',
        description: 'Description',
        tagline: 'Tagline here',
        features: ['feature1'],
        audience: ['developers'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await getActiveProductTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Current Product');
      expect(result.data).toBeTruthy();
      expect(result.data.id).toBe('current-product');
    });

    it('should handle no active product', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await getActiveProductTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No active product');
      expect(result.data).toBeNull();
    });

    it('should handle product ID when product details unavailable', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'orphan-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(memory.getProduct).mockResolvedValue(null);

      const result = await getActiveProductTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('orphan-product');
    });
  });

  // ============ listProductsTool ============
  describe('listProductsTool', () => {
    it('should have correct metadata', () => {
      expect(listProductsTool.name).toBe('list_products');
    });

    it('should list all products', async () => {
      vi.mocked(memory.listProducts).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Product One',
          tagline: 'The first product',
          description: 'Description 1',
          features: [],
          audience: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'product-2',
          name: 'Product Two',
          tagline: 'The second product',
          description: 'Description 2',
          features: [],
          audience: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);

      const result = await listProductsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('2 product(s)');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: 'product-1',
        name: 'Product One',
        tagline: 'The first product',
      });
      expect(result.data[1]).toEqual({
        id: 'product-2',
        name: 'Product Two',
        tagline: 'The second product',
      });
    });

    it('should handle no products', async () => {
      vi.mocked(memory.listProducts).mockResolvedValue([]);

      const result = await listProductsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No products configured');
      expect(result.data).toEqual([]);
    });

    it('should handle products without taglines', async () => {
      vi.mocked(memory.listProducts).mockResolvedValue([
        {
          id: 'no-tagline',
          name: 'No Tagline Product',
          description: 'Just a description',
          features: [],
          audience: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);

      const result = await listProductsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data[0].tagline).toBeUndefined();
    });
  });

  // ============ Tool Array Export ============
  describe('knowledgeTools export', () => {
    it('should export all tools', async () => {
      const { knowledgeTools } = await import('./knowledge-tools.js');
      
      expect(knowledgeTools).toHaveLength(5);
      const names = knowledgeTools.map(t => t.name);
      expect(names).toContain('search_knowledge');
      expect(names).toContain('add_knowledge');
      expect(names).toContain('set_active_product');
      expect(names).toContain('get_active_product');
      expect(names).toContain('list_products');
    });
  });
});
