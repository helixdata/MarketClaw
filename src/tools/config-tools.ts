/**
 * Tool Configuration Tools
 * Manage per-product tool settings
 */

import { Tool, ToolResult } from './types.js';
import { 
  getProductToolConfig, 
  saveProductToolConfig, 
  getGlobalToolConfig
} from './config.js';
import { memory } from '../memory/index.js';

// ============ Get Product Tool Config ============
export const getProductToolConfigTool: Tool = {
  name: 'get_tool_config',
  description: 'Get tool configuration for a product (email accounts, social handles, API keys)',
  parameters: {
    type: 'object',
    properties: {
      productId: { 
        type: 'string', 
        description: 'Product ID (uses active product if not specified)' 
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
      // Return global config
      const config = await getGlobalToolConfig();
      return {
        success: true,
        message: 'Global tool configuration',
        data: config || { note: 'No global config set' },
      };
    }

    const config = await getProductToolConfig(productId);
    
    return {
      success: true,
      message: `Tool config for ${productId}`,
      data: config || { note: 'No product-specific config. Using defaults.' },
    };
  },
};

// ============ Set Product Tool Config ============
export const setProductToolConfigTool: Tool = {
  name: 'set_tool_config',
  description: 'Set tool configuration for a product',
  parameters: {
    type: 'object',
    properties: {
      productId: { 
        type: 'string', 
        description: 'Product ID (uses active product if not specified)' 
      },
      category: {
        type: 'string',
        enum: ['email', 'resend', 'twitter', 'linkedin', 'producthunt', 'images'],
        description: 'Tool category to configure'
      },
      settings: {
        type: 'object',
        description: 'Settings object (varies by category)'
      },
    },
    required: ['category', 'settings'],
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

    // Get existing config or create new
    const config = (await getProductToolConfig(productId)) || {};
    
    // Update the specified category
    (config as any)[params.category] = params.settings;
    
    // Save
    await saveProductToolConfig(productId, config);
    
    return {
      success: true,
      message: `✅ Updated ${params.category} config for ${productId}`,
      data: { [params.category]: params.settings },
    };
  },
};

// ============ Set Email Account ============
export const setProductEmailTool: Tool = {
  name: 'set_product_email',
  description: 'Set email configuration for a product',
  parameters: {
    type: 'object',
    properties: {
      productId: { 
        type: 'string', 
        description: 'Product ID' 
      },
      himalayaAccount: { 
        type: 'string', 
        description: 'Himalaya account name (for IMAP)' 
      },
      fromAddress: { 
        type: 'string', 
        description: 'Default sender address' 
      },
      resendApiKey: { 
        type: 'string', 
        description: 'Resend API key (for transactional email)' 
      },
    },
    required: ['productId'],
  },

  async execute(params): Promise<ToolResult> {
    const config = (await getProductToolConfig(params.productId)) || {};
    
    if (params.himalayaAccount || params.fromAddress) {
      config.email = {
        ...config.email,
        account: params.himalayaAccount,
        from: params.fromAddress,
      };
    }
    
    if (params.resendApiKey) {
      config.resend = {
        ...config.resend,
        apiKey: params.resendApiKey,
        fromEmail: params.fromAddress,
      };
    }
    
    await saveProductToolConfig(params.productId, config);
    
    return {
      success: true,
      message: `✅ Email config saved for ${params.productId}`,
      data: { email: config.email, resend: config.resend ? '(configured)' : undefined },
    };
  },
};

// ============ Set Social Accounts ============
export const setProductSocialTool: Tool = {
  name: 'set_product_social',
  description: 'Set social media accounts for a product',
  parameters: {
    type: 'object',
    properties: {
      productId: { 
        type: 'string', 
        description: 'Product ID' 
      },
      twitterHandle: { 
        type: 'string', 
        description: 'Twitter @handle' 
      },
      linkedinUrn: { 
        type: 'string', 
        description: 'LinkedIn URN (person or company page)' 
      },
      linkedinToken: { 
        type: 'string', 
        description: 'LinkedIn access token (if different from default)' 
      },
    },
    required: ['productId'],
  },

  async execute(params): Promise<ToolResult> {
    const config = (await getProductToolConfig(params.productId)) || {};
    
    if (params.twitterHandle) {
      config.twitter = {
        ...config.twitter,
        handle: params.twitterHandle,
      };
    }
    
    if (params.linkedinUrn || params.linkedinToken) {
      config.linkedin = {
        ...config.linkedin,
        profileUrn: params.linkedinUrn,
        accessToken: params.linkedinToken,
      };
    }
    
    await saveProductToolConfig(params.productId, config);
    
    return {
      success: true,
      message: `✅ Social accounts saved for ${params.productId}`,
      data: { 
        twitter: config.twitter?.handle,
        linkedin: config.linkedin?.profileUrn,
      },
    };
  },
};

// ============ List Product Configs ============
export const listProductConfigsTool: Tool = {
  name: 'list_product_configs',
  description: 'List which products have tool configurations',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const products = await memory.listProducts();
    const configs: { productId: string; hasConfig: boolean; categories: string[] }[] = [];
    
    for (const product of products) {
      const config = await getProductToolConfig(product.id);
      if (config) {
        configs.push({
          productId: product.id,
          hasConfig: true,
          categories: Object.keys(config).filter(k => k !== 'env'),
        });
      } else {
        configs.push({
          productId: product.id,
          hasConfig: false,
          categories: [],
        });
      }
    }
    
    return {
      success: true,
      message: `Found ${products.length} product(s)`,
      data: configs,
    };
  },
};

// ============ Export All ============
export const configTools: Tool[] = [
  getProductToolConfigTool,
  setProductToolConfigTool,
  setProductEmailTool,
  setProductSocialTool,
  listProductConfigsTool,
];
