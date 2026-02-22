/**
 * Product Tools Tests
 * Tests CRUD operations for products
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock pino before imports
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  rm: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock team manager - admin check
vi.mock('../team/index.js', () => ({
  teamManager: {
    checkPermission: vi.fn().mockReturnValue(true), // Default: user is admin
  },
}));

// Mock memory module
vi.mock('../memory/index.js', () => ({
  memory: {
    getProduct: vi.fn(),
    saveProduct: vi.fn(),
    listProducts: vi.fn(),
    getState: vi.fn(),
    saveState: vi.fn(),
  },
}));

import {
  createProductTool,
  deleteProductTool,
  updateProductTool,
} from './product-tools.js';
import { memory } from '../memory/index.js';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';

// Cast to get access to mock functions
const mockMemory = memory as unknown as {
  getProduct: ReturnType<typeof vi.fn>;
  saveProduct: ReturnType<typeof vi.fn>;
  listProducts: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  saveState: ReturnType<typeof vi.fn>;
};

const mockRm = rm as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;

describe('Product Tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Ensure teamManager mock returns true for admin
    const { teamManager } = await import('../team/index.js');
    vi.mocked(teamManager.checkPermission).mockReturnValue(true);

    mockMemory.getState.mockResolvedValue({
      lastInteraction: Date.now(),
      preferences: {},
    });
    mockMemory.listProducts.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create_product', () => {
    it('should have correct metadata', () => {
      expect(createProductTool.name).toBe('create_product');
      expect(createProductTool.parameters.required).toContain('id');
      expect(createProductTool.parameters.required).toContain('name');
    });

    it('should create a new product', async () => {
      mockMemory.getProduct.mockResolvedValue(null);
      mockMemory.saveProduct.mockResolvedValue(undefined);
      mockMemory.saveState.mockResolvedValue(undefined);

      const result = await createProductTool.execute({ callerTelegramId: 12345,
        id: 'my_product',
        name: 'My Product',
        tagline: 'The best product',
        description: 'A great product',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Created product');
      expect(result.message).toContain('My Product');
      expect(result.data.product.id).toBe('my_product');
      expect(result.data.product.name).toBe('My Product');
      expect(result.data.product.tagline).toBe('The best product');
      expect(mockMemory.saveProduct).toHaveBeenCalled();
    });

    it('should fail if product already exists', async () => {
      mockMemory.getProduct.mockResolvedValue({
        id: 'existing',
        name: 'Existing Product',
      });

      const result = await createProductTool.execute({ callerTelegramId: 12345,
        id: 'existing',
        name: 'New Name',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should validate product ID format', async () => {
      mockMemory.getProduct.mockResolvedValue(null);

      const result = await createProductTool.execute({ callerTelegramId: 12345,
        id: 'invalid id!',
        name: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('must contain only');
    });

    it('should auto-activate new product', async () => {
      mockMemory.getProduct.mockResolvedValue(null);
      mockMemory.saveProduct.mockResolvedValue(undefined);
      mockMemory.saveState.mockResolvedValue(undefined);

      await createProductTool.execute({ callerTelegramId: 12345,
        id: 'new_product',
        name: 'New Product',
      });

      expect(mockMemory.saveState).toHaveBeenCalledWith(
        expect.objectContaining({ activeProduct: 'new_product' })
      );
    });
  });

  describe('delete_product', () => {
    it('should have correct metadata', () => {
      expect(deleteProductTool.name).toBe('delete_product');
      expect(deleteProductTool.parameters.required).toContain('productId');
      expect(deleteProductTool.parameters.required).toContain('confirm');
    });

    it('should delete a product', async () => {
      mockMemory.getProduct.mockResolvedValue({
        id: 'to_delete',
        name: 'To Delete',
      });
      mockExistsSync.mockReturnValue(true);
      mockRm.mockResolvedValue(undefined);

      const result = await deleteProductTool.execute({ callerTelegramId: 12345,
        productId: 'to_delete',
        confirm: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Deleted product');
      expect(mockRm).toHaveBeenCalled();
    });

    it('should fail without confirmation', async () => {
      const result = await deleteProductTool.execute({ callerTelegramId: 12345,
        productId: 'some_product',
        confirm: false,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not confirmed');
    });

    it('should fail if product not found', async () => {
      mockMemory.getProduct.mockResolvedValue(null);

      const result = await deleteProductTool.execute({ callerTelegramId: 12345,
        productId: 'nonexistent',
        confirm: true,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should update state if deleting active product', async () => {
      mockMemory.getProduct.mockResolvedValue({
        id: 'active_product',
        name: 'Active',
      });
      mockMemory.getState.mockResolvedValue({
        activeProduct: 'active_product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      mockMemory.listProducts.mockResolvedValue([
        { id: 'other_product', name: 'Other' },
      ]);
      mockExistsSync.mockReturnValue(false);

      await deleteProductTool.execute({ callerTelegramId: 12345,
        productId: 'active_product',
        confirm: true,
      });

      expect(mockMemory.saveState).toHaveBeenCalledWith(
        expect.objectContaining({ activeProduct: 'other_product' })
      );
    });
  });

  describe('update_product', () => {
    it('should have correct metadata', () => {
      expect(updateProductTool.name).toBe('update_product');
      expect(updateProductTool.parameters.required).toContain('productId');
    });

    it('should update product name', async () => {
      mockMemory.getProduct.mockResolvedValue({
        id: 'test_product',
        name: 'Old Name',
        description: 'Old desc',
      });
      mockMemory.saveProduct.mockResolvedValue(undefined);

      const result = await updateProductTool.execute({ callerTelegramId: 12345,
        productId: 'test_product',
        name: 'New Name',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated product');
      expect(result.message).toContain('name');
      expect(result.data.product.name).toBe('New Name');
    });

    it('should update multiple fields', async () => {
      mockMemory.getProduct.mockResolvedValue({
        id: 'test_product',
        name: 'Old Name',
        tagline: 'Old tagline',
        description: 'Old desc',
      });
      mockMemory.saveProduct.mockResolvedValue(undefined);

      const result = await updateProductTool.execute({ callerTelegramId: 12345,
        productId: 'test_product',
        name: 'New Name',
        tagline: 'New tagline',
        description: 'New description',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('name');
      expect(result.message).toContain('tagline');
      expect(result.message).toContain('description');
    });

    it('should fail if product not found', async () => {
      mockMemory.getProduct.mockResolvedValue(null);

      const result = await updateProductTool.execute({ callerTelegramId: 12345,
        productId: 'nonexistent',
        name: 'New Name',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should fail if no updates provided', async () => {
      mockMemory.getProduct.mockResolvedValue({
        id: 'test_product',
        name: 'Name',
      });

      const result = await updateProductTool.execute({ callerTelegramId: 12345,
        productId: 'test_product',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No updates provided');
    });
  });

  describe('Permission checks', () => {
    it('should deny create_product without callerTelegramId', async () => {
      const result = await createProductTool.execute({
        id: 'test',
        name: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('admin permissions');
    });

    it('should deny delete_product without callerTelegramId', async () => {
      const result = await deleteProductTool.execute({
        productId: 'test',
        confirm: true,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('admin permissions');
    });

    it('should deny update_product without callerTelegramId', async () => {
      const result = await updateProductTool.execute({
        productId: 'test',
        name: 'New Name',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('admin permissions');
    });
  });
});
