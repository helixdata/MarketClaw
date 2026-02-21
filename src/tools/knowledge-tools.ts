/**
 * Knowledge Base Tools
 * Tools for searching and managing product knowledge
 */

import { Tool, ToolResult } from './types.js';
import { knowledge } from '../knowledge/index.js';
import { memory } from '../memory/index.js';

// ============ Search Knowledge ============
export const searchKnowledgeTool: Tool = {
  name: 'search_knowledge',
  description: 'Search the product knowledge base for relevant information (voice guidelines, research, learnings, etc.)',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for' },
      productId: { type: 'string', description: 'Product ID (uses active product if not specified)' },
      limit: { type: 'number', description: 'Max results (default: 5)' },
    },
    required: ['query'],
  },

  async execute(params): Promise<ToolResult> {
    let productId = params.productId;
    
    // Use active product if not specified
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
      const results = await knowledge.search(productId, params.query, params.limit || 5);
      
      if (results.length === 0) {
        return {
          success: true,
          message: `No results found for "${params.query}" in ${productId} knowledge base.`,
          data: [],
        };
      }

      return {
        success: true,
        message: `Found ${results.length} result(s).`,
        data: results.map(r => ({
          file: r.file,
          section: r.section,
          content: r.content,
          score: Math.round(r.score * 100) + '%',
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

// ============ Add Knowledge ============
export const addKnowledgeTool: Tool = {
  name: 'add_knowledge',
  description: 'Add new knowledge to a product (learnings, research insights, voice notes, etc.)',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'The knowledge to add' },
      type: { 
        type: 'string', 
        enum: ['voice', 'research', 'learning', 'asset'],
        description: 'Type of knowledge' 
      },
      category: { type: 'string', description: 'Subcategory/filename (e.g., "competitors", "what-works")' },
      productId: { type: 'string', description: 'Product ID (uses active product if not specified)' },
    },
    required: ['content', 'type'],
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
      const file = await knowledge.addKnowledge(productId, {
        type: params.type,
        category: params.category,
        content: params.content,
      });

      return {
        success: true,
        message: `Added to ${file}. Knowledge indexed.`,
        data: { file, productId },
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to add knowledge: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Set Active Product ============
export const setActiveProductTool: Tool = {
  name: 'set_active_product',
  description: 'Set the active product for context in conversations',
  parameters: {
    type: 'object',
    properties: {
      productId: { type: 'string', description: 'Product ID to make active' },
    },
    required: ['productId'],
  },

  async execute(params): Promise<ToolResult> {
    const product = await memory.getProduct(params.productId);
    
    if (!product) {
      // List available products
      const products = await memory.listProducts();
      const available = products.map(p => p.id).join(', ');
      
      return {
        success: false,
        message: `Product "${params.productId}" not found. Available: ${available || 'none'}`,
      };
    }

    const state = await memory.getState();
    state.activeProduct = params.productId;
    await memory.saveState(state);

    return {
      success: true,
      message: `Active product set to: ${product.name}`,
      data: { productId: params.productId, productName: product.name },
    };
  },
};

// ============ Get Active Product ============
export const getActiveProductTool: Tool = {
  name: 'get_active_product',
  description: 'Get the currently active product',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const state = await memory.getState();
    
    if (!state.activeProduct) {
      return {
        success: true,
        message: 'No active product set.',
        data: null,
      };
    }

    const product = await memory.getProduct(state.activeProduct);
    
    return {
      success: true,
      message: `Active product: ${product?.name || state.activeProduct}`,
      data: product,
    };
  },
};

// ============ List Products ============
export const listProductsTool: Tool = {
  name: 'list_products',
  description: 'List all configured products',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const products = await memory.listProducts();
    
    if (products.length === 0) {
      return {
        success: true,
        message: 'No products configured yet.',
        data: [],
      };
    }

    return {
      success: true,
      message: `Found ${products.length} product(s).`,
      data: products.map(p => ({
        id: p.id,
        name: p.name,
        tagline: p.tagline,
      })),
    };
  },
};

// ============ Export All ============
export const knowledgeTools: Tool[] = [
  searchKnowledgeTool,
  addKnowledgeTool,
  setActiveProductTool,
  getActiveProductTool,
  listProductsTool,
];
