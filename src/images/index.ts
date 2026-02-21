/**
 * Product Image Library
 * Storage and semantic search for per-product image assets
 * 
 * Images stored in: ~/.marketclaw/workspace/products/{productId}/images/
 * Metadata index: images.json
 * Vector embeddings for semantic search via Vectra
 */

import { LocalIndex } from 'vectra';
import OpenAI from 'openai';
import { readFile, writeFile, mkdir, copyFile, unlink, readdir, stat } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import { homedir } from 'os';
import crypto from 'crypto';
import { imageSize } from 'image-size';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

import type {
  ProductImage,
  ImageType,
  ImageSearchResult,
  ImageFilters,
  ImageMetadataInput,
  ImageUpdateInput,
} from './types.js';

// Re-export types
export * from './types.js';

// Embedding config
const EMBEDDING_MODEL = 'text-embedding-3-small';

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

type ImageVectraMetadata = Record<string, string | number | boolean>;

export class ProductImageLibrary {
  private workspacePath: string;
  private openai: OpenAI | null = null;
  private indexes: Map<string, LocalIndex<ImageVectraMetadata>> = new Map();

  constructor(workspace?: string) {
    this.workspacePath = workspace || path.join(homedir(), '.marketclaw', 'workspace');
  }

  /**
   * Initialize OpenAI client for embeddings
   */
  async init(apiKey?: string): Promise<void> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (key) {
      this.openai = new OpenAI({ apiKey: key });
    }
  }

  /**
   * Get the images directory path for a product
   */
  private getImagesPath(productId: string): string {
    return path.join(this.workspacePath, 'products', productId, 'images');
  }

  /**
   * Get the metadata file path for a product
   */
  private getMetadataPath(productId: string): string {
    return path.join(this.getImagesPath(productId), 'images.json');
  }

  /**
   * Get the vector index path for a product's images
   */
  private getVectorPath(productId: string): string {
    return path.join(this.getImagesPath(productId), 'vectors');
  }

  /**
   * Generate a unique image ID
   */
  private generateId(): string {
    return 'img_' + crypto.randomBytes(8).toString('hex');
  }

  /**
   * Determine MIME type from file extension
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
  }

  /**
   * Get or create the vector index for a product's images
   */
  private async getIndex(productId: string): Promise<LocalIndex<ImageVectraMetadata>> {
    if (this.indexes.has(productId)) {
      return this.indexes.get(productId)!;
    }

    const indexPath = this.getVectorPath(productId);
    const index = new LocalIndex<ImageVectraMetadata>(indexPath);

    if (!await index.isIndexCreated()) {
      await index.createIndex();
    }

    this.indexes.set(productId, index);
    return index;
  }

  /**
   * Generate embedding for text
   */
  private async embed(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Call init() with API key first.');
    }

    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Create searchable text from image metadata
   */
  private createSearchableText(image: ProductImage): string {
    const parts = [image.name];
    if (image.description) parts.push(image.description);
    if (image.tags.length > 0) parts.push(image.tags.join(' '));
    parts.push(image.type);
    return parts.join('. ');
  }

  /**
   * Load all image metadata for a product
   */
  private async loadMetadata(productId: string): Promise<ProductImage[]> {
    const metadataPath = this.getMetadataPath(productId);
    if (!existsSync(metadataPath)) {
      return [];
    }

    try {
      const data = await readFile(metadataPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Save all image metadata for a product
   */
  private async saveMetadata(productId: string, images: ProductImage[]): Promise<void> {
    const imagesDir = this.getImagesPath(productId);
    await mkdir(imagesDir, { recursive: true });

    const metadataPath = this.getMetadataPath(productId);
    await writeFile(metadataPath, JSON.stringify(images, null, 2));
  }

  /**
   * Download image from URL
   */
  private async downloadImage(url: string, destPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const fileStream = createWriteStream(destPath);
    // Convert web ReadableStream to Node.js Readable
    const nodeStream = Readable.fromWeb(response.body as any);
    await finished(nodeStream.pipe(fileStream));
  }

  /**
   * Detect image dimensions
   */
  private async detectDimensions(imagePath: string): Promise<{ width: number; height: number } | undefined> {
    try {
      const buffer = await readFile(imagePath);
      const result = imageSize(new Uint8Array(buffer));
      if (result.width && result.height) {
        return { width: result.width, height: result.height };
      }
    } catch {
      // Silently fail - dimensions are optional
    }
    return undefined;
  }

  /**
   * Add an image to the library
   * @param productId - Product ID
   * @param source - Local file path or URL
   * @param metadata - Image metadata (name, description, tags, type)
   */
  async addImage(
    productId: string,
    source: string,
    metadata: ImageMetadataInput
  ): Promise<ProductImage> {
    const imagesDir = this.getImagesPath(productId);
    await mkdir(imagesDir, { recursive: true });

    const id = this.generateId();
    const isUrl = source.startsWith('http://') || source.startsWith('https://');
    
    // Determine filename
    let filename: string;
    if (isUrl) {
      const urlPath = new URL(source).pathname;
      const urlFilename = path.basename(urlPath);
      // If URL doesn't have a proper extension, try to infer one
      const ext = path.extname(urlFilename);
      if (ext && MIME_TYPES[ext.toLowerCase()]) {
        filename = `${id}${ext}`;
      } else {
        // Default to png if we can't determine extension
        filename = `${id}.png`;
      }
    } else {
      const ext = path.extname(source);
      filename = `${id}${ext}`;
    }

    const destPath = path.join(imagesDir, filename);

    // Copy or download the image
    if (isUrl) {
      await this.downloadImage(source, destPath);
    } else {
      if (!existsSync(source)) {
        throw new Error(`Source file not found: ${source}`);
      }
      await copyFile(source, destPath);
    }

    // Get file stats
    const stats = await stat(destPath);
    const dimensions = await this.detectDimensions(destPath);

    const now = Date.now();
    const image: ProductImage = {
      id,
      productId,
      filename,
      path: destPath,
      url: isUrl ? source : undefined,
      name: metadata.name,
      description: metadata.description,
      tags: metadata.tags || [],
      type: metadata.type || 'other',
      mimeType: this.getMimeType(filename),
      size: stats.size,
      dimensions,
      uploadedAt: now,
      updatedAt: now,
    };

    // Save metadata
    const images = await this.loadMetadata(productId);
    images.push(image);
    await this.saveMetadata(productId, images);

    // Index for semantic search
    await this.indexImage(productId, image);

    return image;
  }

  /**
   * Index an image for semantic search
   */
  private async indexImage(productId: string, image: ProductImage): Promise<void> {
    if (!this.openai) {
      // Skip indexing if OpenAI not available
      return;
    }

    try {
      const index = await this.getIndex(productId);
      const searchText = this.createSearchableText(image);
      const vector = await this.embed(searchText);

      await index.upsertItem({
        id: image.id,
        vector,
        metadata: {
          imageId: image.id,
          name: image.name,
          description: image.description || '',
          tags: image.tags.join(','),
          type: image.type,
        },
      });
    } catch (err) {
      console.error(`Failed to index image ${image.id}:`, err);
    }
  }

  /**
   * Get a single image by ID
   */
  async getImage(productId: string, imageId: string): Promise<ProductImage | null> {
    const images = await this.loadMetadata(productId);
    return images.find(img => img.id === imageId) || null;
  }

  /**
   * List all images for a product with optional filters
   */
  async listImages(productId: string, filters?: ImageFilters): Promise<ProductImage[]> {
    let images = await this.loadMetadata(productId);

    if (filters?.type) {
      images = images.filter(img => img.type === filters.type);
    }

    if (filters?.tags && filters.tags.length > 0) {
      images = images.filter(img =>
        filters.tags!.some(tag => img.tags.includes(tag))
      );
    }

    return images;
  }

  /**
   * Search images using semantic search
   */
  async searchImages(
    productId: string,
    query: string,
    limit: number = 5
  ): Promise<ImageSearchResult[]> {
    const images = await this.loadMetadata(productId);
    if (images.length === 0) {
      return [];
    }

    const results: ImageSearchResult[] = [];

    // First try semantic search if OpenAI is available
    if (this.openai) {
      try {
        const index = await this.getIndex(productId);
        if (await index.isIndexCreated()) {
          const queryVector = await this.embed(query);
          const vectraResults = await index.queryItems(queryVector, query, limit);

          for (const result of vectraResults) {
            const imageId = (result.item.metadata as any).imageId;
            const image = images.find(img => img.id === imageId);
            if (image) {
              results.push({
                image,
                score: result.score,
                matchType: 'semantic',
              });
            }
          }
        }
      } catch (err) {
        console.error('Semantic search failed, falling back to text search:', err);
      }
    }

    // If semantic search didn't work or returned few results, add text-based matches
    if (results.length < limit) {
      const queryLower = query.toLowerCase();
      const queryTerms = queryLower.split(/\s+/);

      for (const image of images) {
        // Skip if already in results
        if (results.some(r => r.image.id === image.id)) {
          continue;
        }

        // Check name match
        if (image.name.toLowerCase().includes(queryLower)) {
          results.push({ image, score: 0.8, matchType: 'name' });
          continue;
        }

        // Check tag match
        const tagMatch = image.tags.some(tag =>
          queryTerms.some(term => tag.toLowerCase().includes(term))
        );
        if (tagMatch) {
          results.push({ image, score: 0.6, matchType: 'tag' });
          continue;
        }

        // Check description match
        if (image.description && image.description.toLowerCase().includes(queryLower)) {
          results.push({ image, score: 0.5, matchType: 'name' });
        }

        if (results.length >= limit) break;
      }
    }

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Update image metadata
   */
  async updateImage(
    productId: string,
    imageId: string,
    updates: ImageUpdateInput
  ): Promise<ProductImage | null> {
    const images = await this.loadMetadata(productId);
    const index = images.findIndex(img => img.id === imageId);

    if (index === -1) {
      return null;
    }

    const image = images[index];

    if (updates.name !== undefined) image.name = updates.name;
    if (updates.description !== undefined) image.description = updates.description;
    if (updates.tags !== undefined) image.tags = updates.tags;
    if (updates.type !== undefined) image.type = updates.type;
    image.updatedAt = Date.now();

    images[index] = image;
    await this.saveMetadata(productId, images);

    // Re-index for semantic search
    await this.indexImage(productId, image);

    return image;
  }

  /**
   * Delete an image
   */
  async deleteImage(productId: string, imageId: string): Promise<boolean> {
    const images = await this.loadMetadata(productId);
    const index = images.findIndex(img => img.id === imageId);

    if (index === -1) {
      return false;
    }

    const image = images[index];

    // Delete the actual file
    try {
      await unlink(image.path);
    } catch {
      // File might already be deleted
    }

    // Remove from metadata
    images.splice(index, 1);
    await this.saveMetadata(productId, images);

    // Remove from vector index
    try {
      const vectraIndex = await this.getIndex(productId);
      await vectraIndex.deleteItem(imageId);
    } catch {
      // Index might not exist
    }

    return true;
  }

  /**
   * Get the local file path for an image
   */
  async getImagePath(productId: string, imageId: string): Promise<string | null> {
    const image = await this.getImage(productId, imageId);
    if (!image) {
      return null;
    }

    if (!existsSync(image.path)) {
      return null;
    }

    return image.path;
  }

  /**
   * Check if an image file exists
   */
  async imageExists(productId: string, imageId: string): Promise<boolean> {
    const imagePath = await this.getImagePath(productId, imageId);
    return imagePath !== null;
  }

  /**
   * Get all images across all products (useful for global search)
   */
  async listAllImages(): Promise<ProductImage[]> {
    const productsDir = path.join(this.workspacePath, 'products');
    if (!existsSync(productsDir)) {
      return [];
    }

    const allImages: ProductImage[] = [];
    const products = await readdir(productsDir);

    for (const productId of products) {
      const productPath = path.join(productsDir, productId);
      const stats = await stat(productPath);
      if (!stats.isDirectory()) continue;

      try {
        const images = await this.loadMetadata(productId);
        allImages.push(...images);
      } catch {
        // Skip products without image libraries
      }
    }

    return allImages;
  }
}

// Singleton instance
export const imageLibrary = new ProductImageLibrary();
