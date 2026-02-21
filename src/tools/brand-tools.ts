/**
 * Brand Identity Tools
 * Manage brand colors, voice, taglines, and assets for products
 */

import { Tool, ToolResult } from './types.js';
import { memory, ProductBrand } from '../memory/index.js';

// ============ Set Brand Colors ============
export const setBrandColorsTool: Tool = {
  name: 'set_brand_colors',
  description: 'Set brand colors for a product (primary, secondary, accent, or custom color names)',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID (uses active product if not specified)',
      },
      primary: {
        type: 'string',
        description: 'Primary brand color (e.g., "#FF6B35")',
      },
      secondary: {
        type: 'string',
        description: 'Secondary brand color',
      },
      accent: {
        type: 'string',
        description: 'Accent color',
      },
      background: {
        type: 'string',
        description: 'Background color',
      },
      text: {
        type: 'string',
        description: 'Text color',
      },
      custom: {
        type: 'object',
        description: 'Additional custom colors (e.g., {"cta": "#00FF00", "warning": "#FF0000"})',
      },
      merge: {
        type: 'boolean',
        description: 'Merge with existing colors (default: true). Set false to replace all colors.',
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
        message: 'No product specified and no active product. Set a product first.',
      };
    }

    const product = await memory.getProduct(productId);
    if (!product) {
      return {
        success: false,
        message: `Product "${productId}" not found.`,
      };
    }

    // Build new colors object
    const newColors: Record<string, string | undefined> = {};
    if (params.primary !== undefined) newColors.primary = params.primary;
    if (params.secondary !== undefined) newColors.secondary = params.secondary;
    if (params.accent !== undefined) newColors.accent = params.accent;
    if (params.background !== undefined) newColors.background = params.background;
    if (params.text !== undefined) newColors.text = params.text;

    // Add any custom colors
    if (params.custom && typeof params.custom === 'object') {
      for (const [key, value] of Object.entries(params.custom)) {
        if (typeof value === 'string') {
          newColors[key] = value;
        }
      }
    }

    // Initialize brand if not exists
    if (!product.brand) {
      product.brand = {};
    }

    // Merge or replace colors
    const shouldMerge = params.merge !== false;
    if (shouldMerge && product.brand.colors) {
      product.brand.colors = { ...product.brand.colors, ...newColors };
    } else {
      product.brand.colors = newColors;
    }

    await memory.saveProduct(product);

    return {
      success: true,
      message: `✅ Brand colors updated for ${product.name}`,
      data: { colors: product.brand.colors },
    };
  },
};

// ============ Set Brand Voice ============
export const setBrandVoiceTool: Tool = {
  name: 'set_brand_voice',
  description: 'Set brand voice/tone for a product (tone, personality, style, guidelines)',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID (uses active product if not specified)',
      },
      tone: {
        type: 'string',
        description: 'Voice tone (e.g., "warm", "professional", "playful")',
      },
      personality: {
        type: 'string',
        description: 'Brand personality (e.g., "friendly expert", "trusted advisor")',
      },
      style: {
        type: 'string',
        description: 'Communication style (e.g., "casual", "formal", "conversational")',
      },
      guidelines: {
        type: 'string',
        description: 'Free-form voice guidelines',
      },
      merge: {
        type: 'boolean',
        description: 'Merge with existing voice settings (default: true). Set false to replace all.',
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
        message: 'No product specified and no active product. Set a product first.',
      };
    }

    const product = await memory.getProduct(productId);
    if (!product) {
      return {
        success: false,
        message: `Product "${productId}" not found.`,
      };
    }

    // Build new voice object
    const newVoice: ProductBrand['voice'] = {};
    if (params.tone !== undefined) newVoice.tone = params.tone;
    if (params.personality !== undefined) newVoice.personality = params.personality;
    if (params.style !== undefined) newVoice.style = params.style;
    if (params.guidelines !== undefined) newVoice.guidelines = params.guidelines;

    // Initialize brand if not exists
    if (!product.brand) {
      product.brand = {};
    }

    // Merge or replace voice
    const shouldMerge = params.merge !== false;
    if (shouldMerge && product.brand.voice) {
      product.brand.voice = { ...product.brand.voice, ...newVoice };
    } else {
      product.brand.voice = newVoice;
    }

    await memory.saveProduct(product);

    return {
      success: true,
      message: `✅ Brand voice updated for ${product.name}`,
      data: { voice: product.brand.voice },
    };
  },
};

// ============ Set Brand Tagline ============
export const setBrandTaglineTool: Tool = {
  name: 'set_brand_tagline',
  description: 'Set or add taglines/slogans for a product',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID (uses active product if not specified)',
      },
      tagline: {
        type: 'string',
        description: 'Tagline or slogan to add',
      },
      taglines: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple taglines to set at once',
      },
      add: {
        type: 'boolean',
        description: 'Add to existing taglines (default: false = replace all)',
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
        message: 'No product specified and no active product. Set a product first.',
      };
    }

    const product = await memory.getProduct(productId);
    if (!product) {
      return {
        success: false,
        message: `Product "${productId}" not found.`,
      };
    }

    // Determine taglines to set
    let newTaglines: string[] = [];
    if (params.taglines && Array.isArray(params.taglines)) {
      newTaglines = params.taglines;
    } else if (params.tagline) {
      newTaglines = [params.tagline];
    }

    if (newTaglines.length === 0) {
      return {
        success: false,
        message: 'No tagline(s) provided. Use tagline="..." or taglines=["...", "..."]',
      };
    }

    // Initialize brand if not exists
    if (!product.brand) {
      product.brand = {};
    }

    // Add or replace taglines
    if (params.add && product.brand.taglines) {
      // Filter out duplicates
      const existing = new Set(product.brand.taglines);
      for (const t of newTaglines) {
        if (!existing.has(t)) {
          product.brand.taglines.push(t);
        }
      }
    } else {
      product.brand.taglines = newTaglines;
    }

    await memory.saveProduct(product);

    return {
      success: true,
      message: params.add 
        ? `✅ Added ${newTaglines.length} tagline(s) to ${product.name}`
        : `✅ Set ${newTaglines.length} tagline(s) for ${product.name}`,
      data: { taglines: product.brand.taglines },
    };
  },
};

// ============ Set Brand Asset ============
export const setBrandAssetTool: Tool = {
  name: 'set_brand_asset',
  description: 'Set brand assets (logo, icon, etc.) for a product',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID (uses active product if not specified)',
      },
      logo: {
        type: 'string',
        description: 'Logo URL',
      },
      logoAlt: {
        type: 'string',
        description: 'Alternative/small logo URL',
      },
      icon: {
        type: 'string',
        description: 'Icon/favicon URL',
      },
      custom: {
        type: 'object',
        description: 'Additional custom assets (e.g., {"banner": "https://...", "hero": "https://..."})',
      },
      merge: {
        type: 'boolean',
        description: 'Merge with existing assets (default: true). Set false to replace all.',
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
        message: 'No product specified and no active product. Set a product first.',
      };
    }

    const product = await memory.getProduct(productId);
    if (!product) {
      return {
        success: false,
        message: `Product "${productId}" not found.`,
      };
    }

    // Build new assets object
    const newAssets: Record<string, string | undefined> = {};
    if (params.logo !== undefined) newAssets.logo = params.logo;
    if (params.logoAlt !== undefined) newAssets.logoAlt = params.logoAlt;
    if (params.icon !== undefined) newAssets.icon = params.icon;

    // Add any custom assets
    if (params.custom && typeof params.custom === 'object') {
      for (const [key, value] of Object.entries(params.custom)) {
        if (typeof value === 'string') {
          newAssets[key] = value;
        }
      }
    }

    // Initialize brand if not exists
    if (!product.brand) {
      product.brand = {};
    }

    // Merge or replace assets
    const shouldMerge = params.merge !== false;
    if (shouldMerge && product.brand.assets) {
      product.brand.assets = { ...product.brand.assets, ...newAssets };
    } else {
      product.brand.assets = newAssets;
    }

    await memory.saveProduct(product);

    return {
      success: true,
      message: `✅ Brand assets updated for ${product.name}`,
      data: { assets: product.brand.assets },
    };
  },
};

// ============ Set Brand Typography ============
export const setBrandTypographyTool: Tool = {
  name: 'set_brand_typography',
  description: 'Set typography settings for a product (fonts and guidelines)',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID (uses active product if not specified)',
      },
      headingFont: {
        type: 'string',
        description: 'Font for headings (e.g., "Inter", "Playfair Display")',
      },
      bodyFont: {
        type: 'string',
        description: 'Font for body text',
      },
      guidelines: {
        type: 'string',
        description: 'Typography usage guidelines',
      },
      merge: {
        type: 'boolean',
        description: 'Merge with existing typography (default: true). Set false to replace all.',
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
        message: 'No product specified and no active product. Set a product first.',
      };
    }

    const product = await memory.getProduct(productId);
    if (!product) {
      return {
        success: false,
        message: `Product "${productId}" not found.`,
      };
    }

    // Build new typography object
    const newTypography: ProductBrand['typography'] = {};
    if (params.headingFont !== undefined) newTypography.headingFont = params.headingFont;
    if (params.bodyFont !== undefined) newTypography.bodyFont = params.bodyFont;
    if (params.guidelines !== undefined) newTypography.guidelines = params.guidelines;

    // Initialize brand if not exists
    if (!product.brand) {
      product.brand = {};
    }

    // Merge or replace typography
    const shouldMerge = params.merge !== false;
    if (shouldMerge && product.brand.typography) {
      product.brand.typography = { ...product.brand.typography, ...newTypography };
    } else {
      product.brand.typography = newTypography;
    }

    await memory.saveProduct(product);

    return {
      success: true,
      message: `✅ Brand typography updated for ${product.name}`,
      data: { typography: product.brand.typography },
    };
  },
};

// ============ Get Product Brand ============
export const getProductBrandTool: Tool = {
  name: 'get_product_brand',
  description: 'Get all brand identity information for a product',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID (uses active product if not specified)',
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
        message: 'No product specified and no active product. Set a product first.',
      };
    }

    const product = await memory.getProduct(productId);
    if (!product) {
      return {
        success: false,
        message: `Product "${productId}" not found.`,
      };
    }

    if (!product.brand) {
      return {
        success: true,
        message: `No brand identity defined for ${product.name}`,
        data: { productId, productName: product.name, brand: null },
      };
    }

    return {
      success: true,
      message: `Brand identity for ${product.name}`,
      data: {
        productId,
        productName: product.name,
        brand: product.brand,
      },
    };
  },
};

// ============ Clear Brand Section ============
export const clearBrandSectionTool: Tool = {
  name: 'clear_brand_section',
  description: 'Clear a specific section of brand identity (colors, voice, taglines, assets, typography) or entire brand',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID (uses active product if not specified)',
      },
      section: {
        type: 'string',
        enum: ['colors', 'voice', 'taglines', 'assets', 'typography', 'all'],
        description: 'Section to clear (or "all" for entire brand)',
      },
    },
    required: ['section'],
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
        message: 'No product specified and no active product. Set a product first.',
      };
    }

    const product = await memory.getProduct(productId);
    if (!product) {
      return {
        success: false,
        message: `Product "${productId}" not found.`,
      };
    }

    if (!product.brand) {
      return {
        success: true,
        message: `No brand identity to clear for ${product.name}`,
      };
    }

    const section = params.section as string;

    if (section === 'all') {
      delete product.brand;
      await memory.saveProduct(product);
      return {
        success: true,
        message: `✅ Cleared entire brand identity for ${product.name}`,
      };
    }

    if (section === 'colors') delete product.brand.colors;
    else if (section === 'voice') delete product.brand.voice;
    else if (section === 'taglines') delete product.brand.taglines;
    else if (section === 'assets') delete product.brand.assets;
    else if (section === 'typography') delete product.brand.typography;

    // Clean up empty brand object
    if (Object.keys(product.brand).length === 0) {
      delete product.brand;
    }

    await memory.saveProduct(product);

    return {
      success: true,
      message: `✅ Cleared ${section} from brand identity for ${product.name}`,
    };
  },
};

// ============ Export All ============
export const brandTools: Tool[] = [
  setBrandColorsTool,
  setBrandVoiceTool,
  setBrandTaglineTool,
  setBrandAssetTool,
  setBrandTypographyTool,
  getProductBrandTool,
  clearBrandSectionTool,
];
