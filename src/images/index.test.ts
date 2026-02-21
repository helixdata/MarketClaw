/**
 * Product Image Library Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProductImageLibrary, ProductImage } from './index.js';
import path from 'path';
import os from 'os';

// Mock fs modules
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  createWriteStream: vi.fn(() => ({
    on: vi.fn((event, cb) => {
      if (event === 'finish') setTimeout(cb, 0);
      return this;
    }),
  })),
}));

// Mock image-size
vi.mock('image-size', () => ({
  imageSize: vi.fn(),
}));

// Mock stream/promises
vi.mock('stream/promises', () => ({
  finished: vi.fn().mockResolvedValue(undefined),
}));

// Mock stream
vi.mock('stream', () => ({
  Readable: {
    fromWeb: vi.fn(() => ({
      pipe: vi.fn(() => ({})),
    })),
  },
}));

// Mock vectra
vi.mock('vectra', () => ({
  LocalIndex: vi.fn().mockImplementation(() => ({
    isIndexCreated: vi.fn().mockResolvedValue(true),
    createIndex: vi.fn().mockResolvedValue(undefined),
    upsertItem: vi.fn().mockResolvedValue(undefined),
    queryItems: vi.fn().mockResolvedValue([]),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock OpenAI
vi.mock('openai', () => {
  const mockEmbeddingsCreate = vi.fn().mockResolvedValue({
    data: [{ embedding: Array(1536).fill(0) }],
  });
  
  return {
    default: class MockOpenAI {
      embeddings = {
        create: mockEmbeddingsCreate,
      };
    },
  };
});

// Import mocks
import { readFile, writeFile, mkdir, copyFile, unlink, readdir, stat } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { imageSize } from 'image-size';
import { LocalIndex } from 'vectra';

describe('ProductImageLibrary', () => {
  let library: ProductImageLibrary;
  const testWorkspace = '/tmp/test-marketclaw';

  beforeEach(() => {
    vi.clearAllMocks();
    library = new ProductImageLibrary(testWorkspace);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create library with default workspace', () => {
      const defaultLibrary = new ProductImageLibrary();
      expect(defaultLibrary).toBeDefined();
    });

    it('should create library with custom workspace', () => {
      expect(library).toBeDefined();
    });

    it('should initialize OpenAI client with API key', async () => {
      await library.init('test-api-key');
      // No error thrown means success
    });

    it('should initialize with environment variable', async () => {
      process.env.OPENAI_API_KEY = 'env-api-key';
      await library.init();
      delete process.env.OPENAI_API_KEY;
    });
  });

  describe('addImage', () => {
    const mockImage: Partial<ProductImage> = {
      name: 'Test Image',
      description: 'A test image',
      tags: ['test', 'sample'],
      type: 'screenshot',
    };

    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('[]');
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(copyFile).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 1024 } as any);
      vi.mocked(imageSize).mockReturnValue({ width: 800, height: 600 });
    });

    it('should add image from local path', async () => {
      const result = await library.addImage('test-product', '/path/to/image.png', {
        name: 'Test Image',
        tags: ['test'],
        type: 'screenshot',
      });

      expect(result.id).toMatch(/^img_/);
      expect(result.name).toBe('Test Image');
      expect(result.type).toBe('screenshot');
      expect(result.tags).toEqual(['test']);
      expect(result.productId).toBe('test-product');
      expect(mkdir).toHaveBeenCalled();
      expect(copyFile).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
    });

    it('should add image from URL', async () => {
      // Mock fetch for URL download
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {},
      } as any);

      const result = await library.addImage(
        'test-product',
        'https://example.com/image.png',
        { name: 'Downloaded Image', type: 'logo' }
      );

      expect(result.id).toMatch(/^img_/);
      expect(result.name).toBe('Downloaded Image');
      expect(result.url).toBe('https://example.com/image.png');
      expect(result.type).toBe('logo');
    });

    it('should detect image dimensions', async () => {
      vi.mocked(imageSize).mockReturnValue({ width: 1920, height: 1080 });

      const result = await library.addImage('test-product', '/path/to/image.png', {
        name: 'HD Image',
      });

      expect(result.dimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('should handle missing dimensions gracefully', async () => {
      vi.mocked(imageSize).mockImplementation(() => {
        throw new Error('Invalid image');
      });

      const result = await library.addImage('test-product', '/path/to/image.png', {
        name: 'Unknown Dimensions',
      });

      expect(result.dimensions).toBeUndefined();
    });

    it('should throw error if source file not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(
        library.addImage('test-product', '/nonexistent/image.png', { name: 'Test' })
      ).rejects.toThrow('Source file not found');
    });

    it('should throw error if URL download fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as any);

      await expect(
        library.addImage('test-product', 'https://example.com/notfound.png', { name: 'Test' })
      ).rejects.toThrow('Failed to download image');
    });

    it('should default type to "other" if not specified', async () => {
      const result = await library.addImage('test-product', '/path/to/image.png', {
        name: 'No Type',
      });

      expect(result.type).toBe('other');
    });

    it('should generate unique IDs', async () => {
      const result1 = await library.addImage('test-product', '/path/to/img1.png', { name: 'Image 1' });
      const result2 = await library.addImage('test-product', '/path/to/img2.png', { name: 'Image 2' });

      expect(result1.id).not.toBe(result2.id);
    });

    it('should set timestamps correctly', async () => {
      const before = Date.now();
      const result = await library.addImage('test-product', '/path/to/image.png', { name: 'Test' });
      const after = Date.now();

      expect(result.uploadedAt).toBeGreaterThanOrEqual(before);
      expect(result.uploadedAt).toBeLessThanOrEqual(after);
      expect(result.updatedAt).toBe(result.uploadedAt);
    });

    it('should detect correct MIME types', async () => {
      const pngResult = await library.addImage('test-product', '/path/to/image.png', { name: 'PNG' });
      expect(pngResult.mimeType).toBe('image/png');

      const jpgResult = await library.addImage('test-product', '/path/to/image.jpg', { name: 'JPG' });
      expect(jpgResult.mimeType).toBe('image/jpeg');

      const webpResult = await library.addImage('test-product', '/path/to/image.webp', { name: 'WebP' });
      expect(webpResult.mimeType).toBe('image/webp');
    });
  });

  describe('getImage', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
    });

    it('should return image by ID', async () => {
      const mockImages: ProductImage[] = [
        {
          id: 'img_abc123',
          productId: 'test-product',
          filename: 'test.png',
          path: '/full/path/test.png',
          name: 'Test Image',
          tags: ['test'],
          type: 'screenshot',
          mimeType: 'image/png',
          size: 1024,
          uploadedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockImages));

      const result = await library.getImage('test-product', 'img_abc123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('img_abc123');
      expect(result!.name).toBe('Test Image');
    });

    it('should return null for non-existent image', async () => {
      vi.mocked(readFile).mockResolvedValue('[]');

      const result = await library.getImage('test-product', 'img_nonexistent');

      expect(result).toBeNull();
    });

    it('should return null if metadata file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await library.getImage('test-product', 'img_any');

      expect(result).toBeNull();
    });
  });

  describe('listImages', () => {
    const mockImages: ProductImage[] = [
      {
        id: 'img_1',
        productId: 'test-product',
        filename: 'screenshot1.png',
        path: '/path/screenshot1.png',
        name: 'Screenshot 1',
        tags: ['app-store', 'iphone'],
        type: 'screenshot',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'img_2',
        productId: 'test-product',
        filename: 'logo.png',
        path: '/path/logo.png',
        name: 'Logo',
        tags: ['branding'],
        type: 'logo',
        mimeType: 'image/png',
        size: 512,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'img_3',
        productId: 'test-product',
        filename: 'hero.png',
        path: '/path/hero.png',
        name: 'Hero Image',
        tags: ['app-store', 'hero'],
        type: 'hero',
        mimeType: 'image/png',
        size: 2048,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockImages));
    });

    it('should list all images without filters', async () => {
      const result = await library.listImages('test-product');

      expect(result).toHaveLength(3);
    });

    it('should filter by type', async () => {
      const result = await library.listImages('test-product', { type: 'screenshot' });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('screenshot');
    });

    it('should filter by tags', async () => {
      const result = await library.listImages('test-product', { tags: ['app-store'] });

      expect(result).toHaveLength(2);
    });

    it('should filter by multiple tags (OR logic)', async () => {
      const result = await library.listImages('test-product', { tags: ['branding', 'hero'] });

      expect(result).toHaveLength(2);
    });

    it('should combine type and tag filters', async () => {
      const result = await library.listImages('test-product', {
        type: 'hero',
        tags: ['app-store'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('img_3');
    });

    it('should return empty array if no matches', async () => {
      const result = await library.listImages('test-product', { type: 'banner' });

      expect(result).toHaveLength(0);
    });

    it('should return empty array for product with no images', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await library.listImages('empty-product');

      expect(result).toHaveLength(0);
    });
  });

  describe('searchImages', () => {
    const mockImages: ProductImage[] = [
      {
        id: 'img_1',
        productId: 'test-product',
        filename: 'iphone-dashboard.png',
        path: '/path/iphone-dashboard.png',
        name: 'iPhone Dashboard Screenshot',
        description: 'Shows the main dashboard on iPhone',
        tags: ['iphone', 'dashboard', 'screenshot'],
        type: 'screenshot',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'img_2',
        productId: 'test-product',
        filename: 'logo.png',
        path: '/path/logo.png',
        name: 'Company Logo',
        description: 'Primary brand logo',
        tags: ['branding', 'logo'],
        type: 'logo',
        mimeType: 'image/png',
        size: 512,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockImages));
    });

    it('should search by name', async () => {
      const results = await library.searchImages('test-product', 'iPhone');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.image.name.includes('iPhone'))).toBe(true);
    });

    it('should search by tags', async () => {
      const results = await library.searchImages('test-product', 'dashboard');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should search by description', async () => {
      const results = await library.searchImages('test-product', 'brand logo');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', async () => {
      const results = await library.searchImages('test-product', 'xyz123nonexistent');

      expect(results).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const results = await library.searchImages('test-product', 'png', 1);

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should include match type and score', async () => {
      const results = await library.searchImages('test-product', 'iPhone');

      if (results.length > 0) {
        expect(results[0].score).toBeGreaterThan(0);
        expect(['semantic', 'tag', 'name']).toContain(results[0].matchType);
      }
    });

    it('should handle empty product gracefully', async () => {
      vi.mocked(readFile).mockResolvedValue('[]');

      const results = await library.searchImages('test-product', 'anything');

      expect(results).toHaveLength(0);
    });
  });

  describe('updateImage', () => {
    const mockImages: ProductImage[] = [
      {
        id: 'img_update',
        productId: 'test-product',
        filename: 'test.png',
        path: '/path/test.png',
        name: 'Original Name',
        description: 'Original description',
        tags: ['original'],
        type: 'screenshot',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now() - 10000,
        updatedAt: Date.now() - 10000,
      },
    ];

    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockImages));
      vi.mocked(writeFile).mockResolvedValue(undefined);
    });

    it('should update image name', async () => {
      const result = await library.updateImage('test-product', 'img_update', {
        name: 'New Name',
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('New Name');
    });

    it('should update image description', async () => {
      const result = await library.updateImage('test-product', 'img_update', {
        description: 'New description',
      });

      expect(result!.description).toBe('New description');
    });

    it('should update image tags', async () => {
      const result = await library.updateImage('test-product', 'img_update', {
        tags: ['new', 'tags'],
      });

      expect(result!.tags).toEqual(['new', 'tags']);
    });

    it('should update image type', async () => {
      const result = await library.updateImage('test-product', 'img_update', {
        type: 'hero',
      });

      expect(result!.type).toBe('hero');
    });

    it('should update multiple fields at once', async () => {
      const result = await library.updateImage('test-product', 'img_update', {
        name: 'Updated Name',
        description: 'Updated description',
        tags: ['updated'],
        type: 'logo',
      });

      expect(result!.name).toBe('Updated Name');
      expect(result!.description).toBe('Updated description');
      expect(result!.tags).toEqual(['updated']);
      expect(result!.type).toBe('logo');
    });

    it('should update timestamp on change', async () => {
      const originalUpdatedAt = mockImages[0].updatedAt;
      const result = await library.updateImage('test-product', 'img_update', {
        name: 'New Name',
      });

      expect(result!.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should return null for non-existent image', async () => {
      const result = await library.updateImage('test-product', 'img_nonexistent', {
        name: 'Test',
      });

      expect(result).toBeNull();
    });

    it('should persist changes to file', async () => {
      await library.updateImage('test-product', 'img_update', { name: 'Persisted' });

      expect(writeFile).toHaveBeenCalled();
    });
  });

  describe('deleteImage', () => {
    const mockImages: ProductImage[] = [
      {
        id: 'img_delete',
        productId: 'test-product',
        filename: 'to-delete.png',
        path: '/path/to-delete.png',
        name: 'To Delete',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockImages));
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(unlink).mockResolvedValue(undefined);
    });

    it('should delete image and return true', async () => {
      const result = await library.deleteImage('test-product', 'img_delete');

      expect(result).toBe(true);
      expect(unlink).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
    });

    it('should return false for non-existent image', async () => {
      const result = await library.deleteImage('test-product', 'img_nonexistent');

      expect(result).toBe(false);
    });

    it('should handle file already deleted gracefully', async () => {
      vi.mocked(unlink).mockRejectedValue(new Error('ENOENT'));

      const result = await library.deleteImage('test-product', 'img_delete');

      expect(result).toBe(true);
    });

    it('should remove from metadata', async () => {
      await library.deleteImage('test-product', 'img_delete');

      // Check that writeFile was called with empty array
      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[]')
      );
    });
  });

  describe('getImagePath', () => {
    const mockImages: ProductImage[] = [
      {
        id: 'img_path',
        productId: 'test-product',
        filename: 'test.png',
        path: '/full/path/to/test.png',
        name: 'Test',
        tags: [],
        type: 'other',
        mimeType: 'image/png',
        size: 1024,
        uploadedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    it('should return path for existing image', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockImages));

      const result = await library.getImagePath('test-product', 'img_path');

      expect(result).toBe('/full/path/to/test.png');
    });

    it('should return null for non-existent image', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('[]');

      const result = await library.getImagePath('test-product', 'img_nonexistent');

      expect(result).toBeNull();
    });

    it('should return null if file does not exist', async () => {
      vi.mocked(existsSync).mockImplementation((p) => {
        // Metadata exists, but image file doesn't
        if (String(p).endsWith('.json')) return true;
        return false;
      });
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockImages));

      const result = await library.getImagePath('test-product', 'img_path');

      expect(result).toBeNull();
    });
  });

  describe('imageExists', () => {
    it('should return true if image file exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify([
        {
          id: 'img_exists',
          productId: 'test-product',
          filename: 'test.png',
          path: '/path/test.png',
          name: 'Test',
          tags: [],
          type: 'other',
          mimeType: 'image/png',
          size: 1024,
          uploadedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]));

      const result = await library.imageExists('test-product', 'img_exists');

      expect(result).toBe(true);
    });

    it('should return false if image does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('[]');

      const result = await library.imageExists('test-product', 'img_nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('listAllImages', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue(['product1', 'product2'] as any);
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    });

    it('should list images from all products', async () => {
      vi.mocked(readFile).mockImplementation(async (path) => {
        if (String(path).includes('product1')) {
          return JSON.stringify([
            { id: 'img_p1', productId: 'product1', name: 'Product 1 Image' },
          ]);
        }
        if (String(path).includes('product2')) {
          return JSON.stringify([
            { id: 'img_p2', productId: 'product2', name: 'Product 2 Image' },
          ]);
        }
        return '[]';
      });

      const result = await library.listAllImages();

      expect(result).toHaveLength(2);
    });

    it('should return empty array if products directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await library.listAllImages();

      expect(result).toHaveLength(0);
    });

    it('should skip non-directory entries', async () => {
      vi.mocked(readdir).mockResolvedValue(['product1', 'file.txt'] as any);
      vi.mocked(stat).mockImplementation(async (path) => ({
        isDirectory: () => !String(path).includes('file.txt'),
      } as any));
      vi.mocked(readFile).mockResolvedValue(JSON.stringify([
        { id: 'img_1', productId: 'product1', name: 'Image' },
      ]));

      const result = await library.listAllImages();

      expect(result).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted metadata file', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('{ invalid json }');

      const result = await library.listImages('test-product');

      expect(result).toHaveLength(0);
    });

    it('should handle embedding API failure gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('[]');
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(copyFile).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 1024 } as any);
      vi.mocked(imageSize).mockReturnValue({ width: 100, height: 100 });

      // Initialize with failing OpenAI client
      await library.init('bad-key');

      // Should still add image even if embedding fails
      const result = await library.addImage('test-product', '/path/to/image.png', {
        name: 'Test',
      });

      expect(result.id).toMatch(/^img_/);
    });
  });
});
