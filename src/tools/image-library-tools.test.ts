/**
 * Image Library Tools Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addProductImageTool,
  searchProductImagesTool,
  listProductImagesTool,
  getProductImageTool,
  updateProductImageTool,
  deleteProductImageTool,
  imageLibraryTools,
} from './image-library-tools.js';

// Mock the image library module
vi.mock('../images/index.js', () => ({
  imageLibrary: {
    init: vi.fn().mockResolvedValue(undefined),
    addImage: vi.fn(),
    getImage: vi.fn(),
    listImages: vi.fn(),
    searchImages: vi.fn(),
    updateImage: vi.fn(),
    deleteImage: vi.fn(),
    getImagePath: vi.fn(),
  },
  // Export types
  ImageType: {},
  ImageFilters: {},
}));

// Mock the memory module
vi.mock('../memory/index.js', () => ({
  memory: {
    getState: vi.fn(),
  },
}));

import { imageLibrary } from '../images/index.js';
import { memory } from '../memory/index.js';

describe('Image Library Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ addProductImageTool ============
  describe('addProductImageTool', () => {
    it('should have correct metadata', () => {
      expect(addProductImageTool.name).toBe('add_product_image');
      expect(addProductImageTool.parameters.required).toContain('source');
      expect(addProductImageTool.parameters.required).toContain('name');
    });

    it('should add image with explicit productId', async () => {
      vi.mocked(imageLibrary.addImage).mockResolvedValue({
        id: 'img_abc123',
        productId: 'proofping',
        filename: 'img_abc123.png',
        path: '/path/to/img_abc123.png',
        name: 'App Store Hero',
        description: 'iPhone showing dashboard',
        tags: ['app-store', 'hero', 'iphone'],
        type: 'screenshot',
        mimeType: 'image/png',
        size: 102400,
        dimensions: { width: 1920, height: 1080 },
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await addProductImageTool.execute({
        source: '/path/to/image.png',
        name: 'App Store Hero',
        description: 'iPhone showing dashboard',
        tags: 'app-store,hero,iphone',
        type: 'screenshot',
        productId: 'proofping',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('App Store Hero');
      expect(result.message).toContain('1920x1080');
      expect(result.data.id).toBe('img_abc123');
      expect(imageLibrary.addImage).toHaveBeenCalledWith(
        'proofping',
        '/path/to/image.png',
        expect.objectContaining({
          name: 'App Store Hero',
          description: 'iPhone showing dashboard',
          tags: ['app-store', 'hero', 'iphone'],
          type: 'screenshot',
        })
      );
    });

    it('should add image from URL', async () => {
      vi.mocked(imageLibrary.addImage).mockResolvedValue({
        id: 'img_url123',
        productId: 'proofping',
        filename: 'img_url123.png',
        path: '/path/to/img_url123.png',
        url: 'https://example.com/image.png',
        name: 'Downloaded Logo',
        tags: [],
        type: 'logo',
        mimeType: 'image/png',
        size: 5120,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await addProductImageTool.execute({
        source: 'https://example.com/image.png',
        name: 'Downloaded Logo',
        type: 'logo',
        productId: 'proofping',
      });

      expect(result.success).toBe(true);
      expect(imageLibrary.addImage).toHaveBeenCalledWith(
        'proofping',
        'https://example.com/image.png',
        expect.any(Object)
      );
    });

    it('should use active product when productId not specified', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(imageLibrary.addImage).mockResolvedValue({
        id: 'img_active',
        productId: 'active-product',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'Test',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await addProductImageTool.execute({
        source: '/path/to/image.png',
        name: 'Test',
      });

      expect(result.success).toBe(true);
      expect(imageLibrary.addImage).toHaveBeenCalledWith(
        'active-product',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should fail when no product specified and no active product', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await addProductImageTool.execute({
        source: '/path/to/image.png',
        name: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No product specified');
    });

    it('should handle add errors', async () => {
      vi.mocked(imageLibrary.addImage).mockRejectedValue(new Error('File not found'));

      const result = await addProductImageTool.execute({
        source: '/nonexistent/image.png',
        name: 'Missing Image',
        productId: 'test-product',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to add image');
      expect(result.message).toContain('File not found');
    });

    it('should parse comma-separated tags', async () => {
      vi.mocked(imageLibrary.addImage).mockResolvedValue({
        id: 'img_tags',
        productId: 'test',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'Tagged',
        tags: ['one', 'two', 'three'],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await addProductImageTool.execute({
        source: '/path/image.png',
        name: 'Tagged',
        tags: 'one, two, three',
        productId: 'test',
      });

      expect(imageLibrary.addImage).toHaveBeenCalledWith(
        'test',
        expect.any(String),
        expect.objectContaining({
          tags: ['one', 'two', 'three'],
        })
      );
    });

    it('should default type to "other" when not specified', async () => {
      vi.mocked(imageLibrary.addImage).mockResolvedValue({
        id: 'img_default',
        productId: 'test',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'Default Type',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await addProductImageTool.execute({
        source: '/path/image.png',
        name: 'Default Type',
        productId: 'test',
      });

      expect(imageLibrary.addImage).toHaveBeenCalledWith(
        'test',
        expect.any(String),
        expect.objectContaining({ type: 'other' })
      );
    });

    it('should format size in human-readable format', async () => {
      vi.mocked(imageLibrary.addImage).mockResolvedValue({
        id: 'img_size',
        productId: 'test',
        filename: 'large.png',
        path: '/path/large.png',
        name: 'Large Image',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 2097152, // 2 MB
        dimensions: { width: 800, height: 600 },
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await addProductImageTool.execute({
        source: '/path/large.png',
        name: 'Large Image',
        productId: 'test',
      });

      expect(result.message).toContain('2 MB');
    });
  });

  // ============ searchProductImagesTool ============
  describe('searchProductImagesTool', () => {
    it('should have correct metadata', () => {
      expect(searchProductImagesTool.name).toBe('search_product_images');
      expect(searchProductImagesTool.parameters.required).toContain('query');
    });

    it('should search with explicit productId', async () => {
      vi.mocked(imageLibrary.searchImages).mockResolvedValue([
        {
          image: {
            id: 'img_1',
            productId: 'proofping',
            filename: 'dashboard.png',
            path: '/path/dashboard.png',
            name: 'Dashboard Screenshot',
            description: 'Main dashboard view',
            tags: ['dashboard', 'screenshot'],
            type: 'screenshot',
            mimeType: 'image/png',
            size: 1024,
            uploadedAt: Date.now(),
            updatedAt: Date.now(),
          },
          score: 0.95,
          matchType: 'semantic',
        },
      ]);

      const result = await searchProductImagesTool.execute({
        query: 'dashboard screenshot',
        productId: 'proofping',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Found 1 image(s).');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].score).toBe('95%');
      expect(result.data[0].matchType).toBe('semantic');
    });

    it('should use active product when productId not specified', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-prod',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(imageLibrary.searchImages).mockResolvedValue([]);

      await searchProductImagesTool.execute({ query: 'test' });

      expect(imageLibrary.searchImages).toHaveBeenCalledWith('active-prod', 'test', 5);
    });

    it('should fail when no product available', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await searchProductImagesTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No product specified');
    });

    it('should return empty results gracefully', async () => {
      vi.mocked(imageLibrary.searchImages).mockResolvedValue([]);

      const result = await searchProductImagesTool.execute({
        query: 'nonexistent',
        productId: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('No images found');
      expect(result.data).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      vi.mocked(imageLibrary.searchImages).mockResolvedValue([]);

      await searchProductImagesTool.execute({
        query: 'test',
        productId: 'test',
        limit: 10,
      });

      expect(imageLibrary.searchImages).toHaveBeenCalledWith('test', 'test', 10);
    });

    it('should default limit to 5', async () => {
      vi.mocked(imageLibrary.searchImages).mockResolvedValue([]);

      await searchProductImagesTool.execute({
        query: 'test',
        productId: 'test',
      });

      expect(imageLibrary.searchImages).toHaveBeenCalledWith('test', 'test', 5);
    });

    it('should handle search errors', async () => {
      vi.mocked(imageLibrary.searchImages).mockRejectedValue(new Error('Search failed'));

      const result = await searchProductImagesTool.execute({
        query: 'test',
        productId: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Search failed');
    });
  });

  // ============ listProductImagesTool ============
  describe('listProductImagesTool', () => {
    it('should have correct metadata', () => {
      expect(listProductImagesTool.name).toBe('list_product_images');
    });

    it('should list all images without filters', async () => {
      vi.mocked(imageLibrary.listImages).mockResolvedValue([
        {
          id: 'img_1',
          productId: 'proofping',
          filename: 'image1.png',
          path: '/path/image1.png',
          name: 'Image 1',
          tags: ['tag1'],
          type: 'screenshot',
          mimeType: 'image/png',
          size: 1024,
          dimensions: { width: 800, height: 600 },
          uploadedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'img_2',
          productId: 'proofping',
          filename: 'image2.png',
          path: '/path/image2.png',
          name: 'Image 2',
          tags: ['tag2'],
          type: 'logo',
          mimeType: 'image/png',
          size: 512,
          uploadedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);

      const result = await listProductImagesTool.execute({ productId: 'proofping' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Found 2 image(s).');
      expect(result.data).toHaveLength(2);
      expect(imageLibrary.listImages).toHaveBeenCalledWith('proofping', {});
    });

    it('should filter by type', async () => {
      vi.mocked(imageLibrary.listImages).mockResolvedValue([]);

      await listProductImagesTool.execute({
        productId: 'test',
        type: 'screenshot',
      });

      expect(imageLibrary.listImages).toHaveBeenCalledWith('test', { type: 'screenshot' });
    });

    it('should filter by tags', async () => {
      vi.mocked(imageLibrary.listImages).mockResolvedValue([]);

      await listProductImagesTool.execute({
        productId: 'test',
        tags: 'hero,app-store',
      });

      expect(imageLibrary.listImages).toHaveBeenCalledWith('test', {
        tags: ['hero', 'app-store'],
      });
    });

    it('should use active product fallback', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'fallback-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(imageLibrary.listImages).mockResolvedValue([]);

      await listProductImagesTool.execute({});

      expect(imageLibrary.listImages).toHaveBeenCalledWith('fallback-product', {});
    });

    it('should fail when no product available', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await listProductImagesTool.execute({});

      expect(result.success).toBe(false);
    });

    it('should return empty message when no images found', async () => {
      vi.mocked(imageLibrary.listImages).mockResolvedValue([]);

      const result = await listProductImagesTool.execute({ productId: 'test' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('No images found');
    });

    it('should format dimensions as string', async () => {
      vi.mocked(imageLibrary.listImages).mockResolvedValue([
        {
          id: 'img_dim',
          productId: 'test',
          filename: 'test.png',
          path: '/path/test.png',
          name: 'With Dimensions',
          tags: [],
          type: 'other',
          mimeType: 'image/png',
          size: 1024,
          dimensions: { width: 1920, height: 1080 },
          uploadedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);

      const result = await listProductImagesTool.execute({ productId: 'test' });

      expect(result.data[0].dimensions).toBe('1920x1080');
    });

    it('should handle missing dimensions', async () => {
      vi.mocked(imageLibrary.listImages).mockResolvedValue([
        {
          id: 'img_nodim',
          productId: 'test',
          filename: 'test.png',
          path: '/path/test.png',
          name: 'No Dimensions',
          tags: [],
          type: 'other',
          mimeType: 'image/png',
          size: 1024,
          uploadedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);

      const result = await listProductImagesTool.execute({ productId: 'test' });

      expect(result.data[0].dimensions).toBe('unknown');
    });
  });

  // ============ getProductImageTool ============
  describe('getProductImageTool', () => {
    it('should have correct metadata', () => {
      expect(getProductImageTool.name).toBe('get_product_image');
      expect(getProductImageTool.parameters.required).toContain('imageId');
    });

    it('should get image details', async () => {
      vi.mocked(imageLibrary.getImage).mockResolvedValue({
        id: 'img_detail',
        productId: 'proofping',
        filename: 'detail.png',
        path: '/path/detail.png',
        url: 'https://example.com/original.png',
        name: 'Detailed Image',
        description: 'A detailed description',
        tags: ['tag1', 'tag2'],
        type: 'hero',
        mimeType: 'image/png',
        size: 2048,
        dimensions: { width: 1280, height: 720 },
        uploadedAt: 1700000000000,
        updatedAt: 1700000001000,
      });

      const result = await getProductImageTool.execute({
        imageId: 'img_detail',
        productId: 'proofping',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Detailed Image');
      expect(result.data.id).toBe('img_detail');
      expect(result.data.url).toBe('https://example.com/original.png');
      expect(result.data.dimensions).toEqual({ width: 1280, height: 720 });
    });

    it('should fail when image not found', async () => {
      vi.mocked(imageLibrary.getImage).mockResolvedValue(null);

      const result = await getProductImageTool.execute({
        imageId: 'img_nonexistent',
        productId: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Image not found');
    });

    it('should use active product fallback', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(imageLibrary.getImage).mockResolvedValue(null);

      await getProductImageTool.execute({ imageId: 'img_test' });

      expect(imageLibrary.getImage).toHaveBeenCalledWith('active', 'img_test');
    });

    it('should fail when no product available', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await getProductImageTool.execute({ imageId: 'img_test' });

      expect(result.success).toBe(false);
    });

    it('should include timestamps as ISO strings', async () => {
      const timestamp = 1700000000000;
      vi.mocked(imageLibrary.getImage).mockResolvedValue({
        id: 'img_time',
        productId: 'test',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'Test',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: timestamp,
        updatedAt: timestamp,
      });

      const result = await getProductImageTool.execute({
        imageId: 'img_time',
        productId: 'test',
      });

      expect(result.data.uploadedAt).toBe(new Date(timestamp).toISOString());
    });
  });

  // ============ updateProductImageTool ============
  describe('updateProductImageTool', () => {
    it('should have correct metadata', () => {
      expect(updateProductImageTool.name).toBe('update_product_image');
      expect(updateProductImageTool.parameters.required).toContain('imageId');
    });

    it('should update image name', async () => {
      vi.mocked(imageLibrary.updateImage).mockResolvedValue({
        id: 'img_update',
        productId: 'test',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'New Name',
        tags: ['tag'],
        type: 'screenshot',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await updateProductImageTool.execute({
        imageId: 'img_update',
        name: 'New Name',
        productId: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('New Name');
      expect(imageLibrary.updateImage).toHaveBeenCalledWith(
        'test',
        'img_update',
        { name: 'New Name' }
      );
    });

    it('should update multiple fields', async () => {
      vi.mocked(imageLibrary.updateImage).mockResolvedValue({
        id: 'img_multi',
        productId: 'test',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'Updated Name',
        description: 'Updated description',
        tags: ['new', 'tags'],
        type: 'logo',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await updateProductImageTool.execute({
        imageId: 'img_multi',
        name: 'Updated Name',
        description: 'Updated description',
        tags: 'new,tags',
        type: 'logo',
        productId: 'test',
      });

      expect(result.success).toBe(true);
      expect(imageLibrary.updateImage).toHaveBeenCalledWith(
        'test',
        'img_multi',
        {
          name: 'Updated Name',
          description: 'Updated description',
          tags: ['new', 'tags'],
          type: 'logo',
        }
      );
    });

    it('should fail when no updates provided', async () => {
      const result = await updateProductImageTool.execute({
        imageId: 'img_test',
        productId: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No updates specified');
    });

    it('should fail when image not found', async () => {
      vi.mocked(imageLibrary.updateImage).mockResolvedValue(null);

      const result = await updateProductImageTool.execute({
        imageId: 'img_nonexistent',
        name: 'New Name',
        productId: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Image not found');
    });

    it('should use active product fallback', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(imageLibrary.updateImage).mockResolvedValue({
        id: 'img_test',
        productId: 'active',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'Updated',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await updateProductImageTool.execute({
        imageId: 'img_test',
        name: 'Updated',
      });

      expect(imageLibrary.updateImage).toHaveBeenCalledWith('active', 'img_test', expect.any(Object));
    });

    it('should parse comma-separated tags', async () => {
      vi.mocked(imageLibrary.updateImage).mockResolvedValue({
        id: 'img_tags',
        productId: 'test',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'Tagged',
        tags: ['a', 'b', 'c'],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await updateProductImageTool.execute({
        imageId: 'img_tags',
        tags: 'a, b, c',
        productId: 'test',
      });

      expect(imageLibrary.updateImage).toHaveBeenCalledWith(
        'test',
        'img_tags',
        { tags: ['a', 'b', 'c'] }
      );
    });
  });

  // ============ deleteProductImageTool ============
  describe('deleteProductImageTool', () => {
    it('should have correct metadata', () => {
      expect(deleteProductImageTool.name).toBe('delete_product_image');
      expect(deleteProductImageTool.parameters.required).toContain('imageId');
    });

    it('should delete image successfully', async () => {
      vi.mocked(imageLibrary.getImage).mockResolvedValue({
        id: 'img_delete',
        productId: 'test',
        filename: 'delete.png',
        path: '/path/delete.png',
        name: 'To Delete',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });
      vi.mocked(imageLibrary.deleteImage).mockResolvedValue(true);

      const result = await deleteProductImageTool.execute({
        imageId: 'img_delete',
        productId: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Deleted image');
      expect(result.message).toContain('To Delete');
      expect(result.data.id).toBe('img_delete');
    });

    it('should fail when image not found', async () => {
      vi.mocked(imageLibrary.getImage).mockResolvedValue(null);

      const result = await deleteProductImageTool.execute({
        imageId: 'img_nonexistent',
        productId: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Image not found');
    });

    it('should fail when delete fails', async () => {
      vi.mocked(imageLibrary.getImage).mockResolvedValue({
        id: 'img_fail',
        productId: 'test',
        filename: 'fail.png',
        path: '/path/fail.png',
        name: 'Fail Delete',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });
      vi.mocked(imageLibrary.deleteImage).mockResolvedValue(false);

      const result = await deleteProductImageTool.execute({
        imageId: 'img_fail',
        productId: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to delete');
    });

    it('should use active product fallback', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(imageLibrary.getImage).mockResolvedValue({
        id: 'img_test',
        productId: 'active',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'Test',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });
      vi.mocked(imageLibrary.deleteImage).mockResolvedValue(true);

      await deleteProductImageTool.execute({ imageId: 'img_test' });

      expect(imageLibrary.getImage).toHaveBeenCalledWith('active', 'img_test');
      expect(imageLibrary.deleteImage).toHaveBeenCalledWith('active', 'img_test');
    });

    it('should fail when no product available', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await deleteProductImageTool.execute({ imageId: 'img_test' });

      expect(result.success).toBe(false);
    });

    it('should handle delete errors', async () => {
      vi.mocked(imageLibrary.getImage).mockResolvedValue({
        id: 'img_err',
        productId: 'test',
        filename: 'err.png',
        path: '/path/err.png',
        name: 'Error',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      });
      vi.mocked(imageLibrary.deleteImage).mockRejectedValue(new Error('Permission denied'));

      const result = await deleteProductImageTool.execute({
        imageId: 'img_err',
        productId: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Permission denied');
    });
  });

  // ============ Tool Array Export ============
  describe('imageLibraryTools export', () => {
    it('should export all 6 tools', () => {
      expect(imageLibraryTools).toHaveLength(6);
    });

    it('should contain all expected tools', () => {
      const names = imageLibraryTools.map(t => t.name);
      expect(names).toContain('add_product_image');
      expect(names).toContain('search_product_images');
      expect(names).toContain('list_product_images');
      expect(names).toContain('get_product_image');
      expect(names).toContain('update_product_image');
      expect(names).toContain('delete_product_image');
    });

    it('should all have execute functions', () => {
      for (const tool of imageLibraryTools) {
        expect(typeof tool.execute).toBe('function');
      }
    });

    it('should all have valid parameter schemas', () => {
      for (const tool of imageLibraryTools) {
        expect(tool.parameters.type).toBe('object');
        expect(typeof tool.parameters.properties).toBe('object');
      }
    });
  });
});
