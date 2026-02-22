/**
 * Product Tools
 * CRUD operations for managing products
 */

import { Tool, ToolResult } from './types.js';
import { memory, Product } from '../memory/index.js';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

// ============ Create Product ============
export const createProductTool: Tool = {
  name: 'create_product',
  description: 'Create a new product to manage marketing for',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique product identifier (snake_case recommended)',
      },
      name: {
        type: 'string',
        description: 'Display name of the product',
      },
      tagline: {
        type: 'string',
        description: 'Short tagline or slogan',
      },
      description: {
        type: 'string',
        description: 'Full product description',
      },
    },
    required: ['id', 'name'],
  },

  async execute(params): Promise<ToolResult> {
    // Check if product already exists
    const existing = await memory.getProduct(params.id);
    if (existing) {
      return {
        success: false,
        message: `Product "${params.id}" already exists. Use update_product to modify it.`,
      };
    }

    // Validate ID format
    if (!/^[a-z0-9_-]+$/i.test(params.id)) {
      return {
        success: false,
        message: 'Product ID must contain only alphanumeric characters, hyphens, and underscores.',
      };
    }

    const product: Product = {
      id: params.id,
      name: params.name,
      tagline: params.tagline,
      description: params.description || '',
      features: [],
      audience: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await memory.saveProduct(product);

    // Update state with new product in list
    const state = await memory.getState();
    await memory.saveState({
      ...state,
      activeProduct: params.id, // Auto-activate new product
    });

    return {
      success: true,
      message: `✅ Created product "${params.name}" (${params.id})`,
      data: { product },
    };
  },
};

// ============ Delete Product ============
export const deleteProductTool: Tool = {
  name: 'delete_product',
  description: 'Delete a product and all its associated data',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'ID of the product to delete',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm deletion',
      },
    },
    required: ['productId', 'confirm'],
  },

  async execute(params): Promise<ToolResult> {
    if (!params.confirm) {
      return {
        success: false,
        message: 'Deletion not confirmed. Set confirm=true to delete the product.',
      };
    }

    // Check if product exists
    const product = await memory.getProduct(params.productId);
    if (!product) {
      return {
        success: false,
        message: `Product "${params.productId}" not found.`,
      };
    }

    // Get workspace path
    const workspacePath = process.env.MARKETCLAW_WORKSPACE ||
      path.join(homedir(), '.marketclaw', 'workspace');

    // Delete product file
    const productPath = path.join(workspacePath, 'products', `${params.productId}.json`);
    if (existsSync(productPath)) {
      await rm(productPath);
    }

    // Clean up product directory if it exists (for product-specific data)
    const productDir = path.join(workspacePath, 'products', params.productId);
    if (existsSync(productDir)) {
      await rm(productDir, { recursive: true });
    }

    // Update state if this was the active product
    const state = await memory.getState();
    if (state.activeProduct === params.productId) {
      const remainingProducts = await memory.listProducts();
      await memory.saveState({
        ...state,
        activeProduct: remainingProducts.length > 0 ? remainingProducts[0].id : undefined,
      });
    }

    return {
      success: true,
      message: `🗑️ Deleted product "${product.name}" (${params.productId}) and all associated data.`,
      data: { deletedProduct: product },
    };
  },
};

// ============ Update Product ============
export const updateProductTool: Tool = {
  name: 'update_product',
  description: 'Update basic product information (name, description)',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'ID of the product to update',
      },
      name: {
        type: 'string',
        description: 'New display name',
      },
      tagline: {
        type: 'string',
        description: 'New tagline',
      },
      description: {
        type: 'string',
        description: 'New description',
      },
    },
    required: ['productId'],
  },

  async execute(params): Promise<ToolResult> {
    const product = await memory.getProduct(params.productId);
    if (!product) {
      return {
        success: false,
        message: `Product "${params.productId}" not found.`,
      };
    }

    const updates: string[] = [];

    if (params.name !== undefined) {
      product.name = params.name;
      updates.push('name');
    }

    if (params.tagline !== undefined) {
      product.tagline = params.tagline;
      updates.push('tagline');
    }

    if (params.description !== undefined) {
      product.description = params.description;
      updates.push('description');
    }

    if (updates.length === 0) {
      return {
        success: false,
        message: 'No updates provided. Specify at least one field to update (name, tagline, or description).',
      };
    }

    await memory.saveProduct(product);

    return {
      success: true,
      message: `✅ Updated product "${product.name}": ${updates.join(', ')}`,
      data: { product },
    };
  },
};

// ============ Export All ============
export const productTools: Tool[] = [
  createProductTool,
  deleteProductTool,
  updateProductTool,
];
