/**
 * Image Library Tools
 * Tools for managing product image assets
 */

import { Tool, ToolResult } from './types.js';
import { imageLibrary, ImageType, ImageFilters } from '../images/index.js';
import { memory } from '../memory/index.js';

const IMAGE_TYPES: ImageType[] = [
  'screenshot', 'logo', 'icon', 'hero', 'social',
  'product-shot', 'banner', 'thumbnail', 'other'
];

// ============ Add Product Image ============
export const addProductImageTool: Tool = {
  name: 'add_product_image',
  description: 'Add an image to a product\'s image library. Source can be a local file path or URL (will be downloaded).',
  parameters: {
    type: 'object',
    properties: {
      source: { 
        type: 'string', 
        description: 'Local file path or URL to the image' 
      },
      name: { 
        type: 'string', 
        description: 'Display name for the image (e.g., "App Store Hero")' 
      },
      productId: { 
        type: 'string', 
        description: 'Product ID (uses active product if not specified)' 
      },
      description: { 
        type: 'string', 
        description: 'Description of the image' 
      },
      tags: { 
        type: 'string', 
        description: 'Comma-separated tags (e.g., "app-store,hero,iphone")' 
      },
      type: { 
        type: 'string',
        enum: IMAGE_TYPES,
        description: 'Image type' 
      },
    },
    required: ['source', 'name'],
  },

  async execute(params): Promise<ToolResult> {
    let productId = params.productId;
    
    if (!productId) {
      const state = await memory.getState();
      productId = state.activeProduct;
    }

    if (!productId) {
      return {
        success: false,
        message: 'No product specified and no active product set. Use "set active product <name>" first.',
      };
    }

    try {
      // Initialize image library
      await imageLibrary.init();

      const tags = params.tags 
        ? params.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
        : [];

      const image = await imageLibrary.addImage(productId, params.source, {
        name: params.name,
        description: params.description,
        tags,
        type: params.type || 'other',
      });

      const dimStr = image.dimensions 
        ? `${image.dimensions.width}x${image.dimensions.height}` 
        : 'unknown';
      const sizeStr = formatBytes(image.size);

      return {
        success: true,
        message: `Image added: ${image.name} (${dimStr}, ${sizeStr})`,
        data: {
          id: image.id,
          name: image.name,
          filename: image.filename,
          type: image.type,
          dimensions: dimStr,
          size: sizeStr,
          tags: image.tags,
          path: image.path,
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to add image: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Search Product Images ============
export const searchProductImagesTool: Tool = {
  name: 'search_product_images',
  description: 'Search for images using semantic search on name and description',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'Search query (e.g., "iPhone screenshots", "mockup dashboard")' 
      },
      productId: { 
        type: 'string', 
        description: 'Product ID (uses active product if not specified)' 
      },
      limit: { 
        type: 'number', 
        description: 'Max results (default: 5)' 
      },
    },
    required: ['query'],
  },

  async execute(params): Promise<ToolResult> {
    let productId = params.productId;
    
    if (!productId) {
      const state = await memory.getState();
      productId = state.activeProduct;
    }

    if (!productId) {
      return {
        success: false,
        message: 'No product specified and no active product set.',
      };
    }

    try {
      await imageLibrary.init();

      const results = await imageLibrary.searchImages(
        productId, 
        params.query, 
        params.limit || 5
      );

      if (results.length === 0) {
        return {
          success: true,
          message: `No images found matching "${params.query}".`,
          data: [],
        };
      }

      return {
        success: true,
        message: `Found ${results.length} image(s).`,
        data: results.map(r => ({
          id: r.image.id,
          name: r.image.name,
          description: r.image.description,
          type: r.image.type,
          tags: r.image.tags,
          score: Math.round(r.score * 100) + '%',
          matchType: r.matchType,
          path: r.image.path,
        })),
      };
    } catch (err) {
      return {
        success: false,
        message: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ List Product Images ============
export const listProductImagesTool: Tool = {
  name: 'list_product_images',
  description: 'List all images for a product with optional filters',
  parameters: {
    type: 'object',
    properties: {
      productId: { 
        type: 'string', 
        description: 'Product ID (uses active product if not specified)' 
      },
      type: { 
        type: 'string',
        enum: IMAGE_TYPES,
        description: 'Filter by image type' 
      },
      tags: { 
        type: 'string', 
        description: 'Comma-separated tags to filter by' 
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    let productId = params.productId;
    
    if (!productId) {
      const state = await memory.getState();
      productId = state.activeProduct;
    }

    if (!productId) {
      return {
        success: false,
        message: 'No product specified and no active product set.',
      };
    }

    try {
      const filters: ImageFilters = {};
      if (params.type) filters.type = params.type;
      if (params.tags) {
        filters.tags = params.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
      }

      const images = await imageLibrary.listImages(productId, filters);

      if (images.length === 0) {
        const filterDesc = Object.keys(filters).length > 0 
          ? ' matching filters' 
          : '';
        return {
          success: true,
          message: `No images found${filterDesc} for ${productId}.`,
          data: [],
        };
      }

      return {
        success: true,
        message: `Found ${images.length} image(s).`,
        data: images.map(img => ({
          id: img.id,
          name: img.name,
          type: img.type,
          tags: img.tags,
          dimensions: img.dimensions 
            ? `${img.dimensions.width}x${img.dimensions.height}` 
            : 'unknown',
          size: formatBytes(img.size),
          path: img.path,
        })),
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to list images: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Get Product Image ============
export const getProductImageTool: Tool = {
  name: 'get_product_image',
  description: 'Get and display a specific product image by ID. Use this to show an image to the user.',
  parameters: {
    type: 'object',
    properties: {
      imageId: { 
        type: 'string', 
        description: 'Image ID (e.g., img_abc123)' 
      },
      productId: { 
        type: 'string', 
        description: 'Product ID (uses active product if not specified)' 
      },
    },
    required: ['imageId'],
  },

  async execute(params): Promise<ToolResult> {
    let productId = params.productId;
    
    if (!productId) {
      const state = await memory.getState();
      productId = state.activeProduct;
    }

    if (!productId) {
      return {
        success: false,
        message: 'No product specified and no active product set.',
      };
    }

    try {
      const image = await imageLibrary.getImage(productId, params.imageId);

      if (!image) {
        return {
          success: false,
          message: `Image not found: ${params.imageId}`,
        };
      }

      // If image has a local path, include SEND_IMAGE directive to display it
      const message = image.path 
        ? `SEND_IMAGE:${image.path}`
        : `Image: ${image.name}`;

      return {
        success: true,
        message,
        data: {
          id: image.id,
          name: image.name,
          description: image.description,
          type: image.type,
          tags: image.tags,
          filename: image.filename,
          path: image.path,
          url: image.url,
          mimeType: image.mimeType,
          size: formatBytes(image.size),
          sizeBytes: image.size,
          dimensions: image.dimensions,
          uploadedAt: new Date(image.uploadedAt).toISOString(),
          updatedAt: new Date(image.updatedAt).toISOString(),
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to get image: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Update Product Image ============
export const updateProductImageTool: Tool = {
  name: 'update_product_image',
  description: 'Update image metadata (name, description, tags, type)',
  parameters: {
    type: 'object',
    properties: {
      imageId: { 
        type: 'string', 
        description: 'Image ID to update' 
      },
      productId: { 
        type: 'string', 
        description: 'Product ID (uses active product if not specified)' 
      },
      name: { 
        type: 'string', 
        description: 'New display name' 
      },
      description: { 
        type: 'string', 
        description: 'New description' 
      },
      tags: { 
        type: 'string', 
        description: 'New comma-separated tags (replaces existing)' 
      },
      type: { 
        type: 'string',
        enum: IMAGE_TYPES,
        description: 'New image type' 
      },
    },
    required: ['imageId'],
  },

  async execute(params): Promise<ToolResult> {
    let productId = params.productId;
    
    if (!productId) {
      const state = await memory.getState();
      productId = state.activeProduct;
    }

    if (!productId) {
      return {
        success: false,
        message: 'No product specified and no active product set.',
      };
    }

    // Build updates object
    const updates: Record<string, any> = {};
    if (params.name !== undefined) updates.name = params.name;
    if (params.description !== undefined) updates.description = params.description;
    if (params.type !== undefined) updates.type = params.type;
    if (params.tags !== undefined) {
      updates.tags = params.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        message: 'No updates specified. Provide name, description, tags, or type.',
      };
    }

    try {
      await imageLibrary.init();

      const image = await imageLibrary.updateImage(productId, params.imageId, updates);

      if (!image) {
        return {
          success: false,
          message: `Image not found: ${params.imageId}`,
        };
      }

      return {
        success: true,
        message: `Updated image: ${image.name}`,
        data: {
          id: image.id,
          name: image.name,
          description: image.description,
          type: image.type,
          tags: image.tags,
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to update image: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Delete Product Image ============
export const deleteProductImageTool: Tool = {
  name: 'delete_product_image',
  description: 'Delete an image from the library',
  parameters: {
    type: 'object',
    properties: {
      imageId: { 
        type: 'string', 
        description: 'Image ID to delete' 
      },
      productId: { 
        type: 'string', 
        description: 'Product ID (uses active product if not specified)' 
      },
    },
    required: ['imageId'],
  },

  async execute(params): Promise<ToolResult> {
    let productId = params.productId;
    
    if (!productId) {
      const state = await memory.getState();
      productId = state.activeProduct;
    }

    if (!productId) {
      return {
        success: false,
        message: 'No product specified and no active product set.',
      };
    }

    try {
      // Get image details first for the success message
      const image = await imageLibrary.getImage(productId, params.imageId);
      
      if (!image) {
        return {
          success: false,
          message: `Image not found: ${params.imageId}`,
        };
      }

      const deleted = await imageLibrary.deleteImage(productId, params.imageId);

      if (!deleted) {
        return {
          success: false,
          message: `Failed to delete image: ${params.imageId}`,
        };
      }

      return {
        success: true,
        message: `Deleted image: ${image.name}`,
        data: {
          id: params.imageId,
          name: image.name,
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to delete image: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Helper Functions ============

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ Export All ============
export const imageLibraryTools: Tool[] = [
  addProductImageTool,
  searchProductImagesTool,
  listProductImagesTool,
  getProductImageTool,
  updateProductImageTool,
  deleteProductImageTool,
];
