/**
 * Config Tools Unit Tests
 * Tests for per-product tool configuration management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProductToolConfigTool,
  setProductToolConfigTool,
  setProductEmailTool,
  setProductSocialTool,
  listProductConfigsTool,
} from './config-tools.js';
import { ProductToolConfig } from './config.js';
import { Product } from '../memory/index.js';

// Mock the config module (file system operations)
vi.mock('./config.js', () => ({
  getProductToolConfig: vi.fn(),
  saveProductToolConfig: vi.fn(),
  getGlobalToolConfig: vi.fn(),
  saveGlobalToolConfig: vi.fn(),
}));

// Mock the memory module
vi.mock('../memory/index.js', () => ({
  memory: {
    getState: vi.fn(),
    listProducts: vi.fn(),
  },
}));

// Import mocked modules
import {
  getProductToolConfig,
  saveProductToolConfig,
  getGlobalToolConfig,
  saveGlobalToolConfig,
} from './config.js';
import { memory } from '../memory/index.js';

// Helper to create a mock product
function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product',
    name: 'Test Product',
    description: 'A test product',
    features: ['feature1'],
    audience: ['developers'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// Helper to create a mock config
function createMockConfig(overrides: Partial<ProductToolConfig> = {}): ProductToolConfig {
  return {
    email: {
      account: 'test-account',
      from: 'test@example.com',
    },
    twitter: {
      handle: '@testhandle',
    },
    ...overrides,
  };
}

describe('Config Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ get_tool_config ============
  describe('get_tool_config', () => {
    it('gets config for a specific product', async () => {
      const mockConfig = createMockConfig();
      vi.mocked(getProductToolConfig).mockResolvedValue(mockConfig);

      const result = await getProductToolConfigTool.execute({
        productId: 'my-product',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Tool config for my-product');
      expect(result.data).toEqual(mockConfig);
      expect(getProductToolConfig).toHaveBeenCalledWith('my-product');
    });

    it('uses active product when productId not specified', async () => {
      const mockConfig = createMockConfig();
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(getProductToolConfig).mockResolvedValue(mockConfig);

      const result = await getProductToolConfigTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Tool config for active-product');
      expect(getProductToolConfig).toHaveBeenCalledWith('active-product');
    });

    it('returns global config when no product specified and no active product', async () => {
      const mockGlobalConfig = createMockConfig({
        linkedin: { profileUrn: 'urn:li:person:default' },
      });
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: undefined,
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(getGlobalToolConfig).mockResolvedValue(mockGlobalConfig);

      const result = await getProductToolConfigTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Global tool configuration');
      expect(result.data).toEqual(mockGlobalConfig);
      expect(getGlobalToolConfig).toHaveBeenCalled();
    });

    it('returns note when no product config exists', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);

      const result = await getProductToolConfigTool.execute({
        productId: 'no-config-product',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ note: 'No product-specific config. Using defaults.' });
    });

    it('returns note when no global config exists', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: undefined,
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(getGlobalToolConfig).mockResolvedValue(null);

      const result = await getProductToolConfigTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ note: 'No global config set' });
    });
  });

  // ============ set_tool_config ============
  describe('set_tool_config', () => {
    it('sets config category for a specific product', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      const result = await setProductToolConfigTool.execute({
        productId: 'my-product',
        category: 'twitter',
        settings: { handle: '@newhandle', cookieProfile: 'default' },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('✅ Updated twitter config for my-product');
      expect(result.data).toEqual({
        twitter: { handle: '@newhandle', cookieProfile: 'default' },
      });
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        twitter: { handle: '@newhandle', cookieProfile: 'default' },
      });
    });

    it('merges with existing config', async () => {
      const existingConfig = createMockConfig({
        email: { account: 'existing', from: 'old@example.com' },
      });
      vi.mocked(getProductToolConfig).mockResolvedValue(existingConfig);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      const result = await setProductToolConfigTool.execute({
        productId: 'my-product',
        category: 'linkedin',
        settings: { profileUrn: 'urn:li:person:123' },
      });

      expect(result.success).toBe(true);
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        ...existingConfig,
        linkedin: { profileUrn: 'urn:li:person:123' },
      });
    });

    it('uses active product when productId not specified', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      const result = await setProductToolConfigTool.execute({
        category: 'resend',
        settings: { apiKey: 're_xxx', fromEmail: 'hello@example.com' },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('✅ Updated resend config for active-product');
      expect(saveProductToolConfig).toHaveBeenCalledWith('active-product', {
        resend: { apiKey: 're_xxx', fromEmail: 'hello@example.com' },
      });
    });

    it('returns error when no product specified and no active product', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: undefined,
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await setProductToolConfigTool.execute({
        category: 'twitter',
        settings: { handle: '@test' },
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('No product specified and no active product. Set a product first.');
      expect(saveProductToolConfig).not.toHaveBeenCalled();
    });

    it('handles all category types', async () => {
      const categories = ['email', 'resend', 'twitter', 'linkedin', 'producthunt', 'images'] as const;
      
      for (const category of categories) {
        vi.clearAllMocks();
        vi.mocked(getProductToolConfig).mockResolvedValue(null);
        vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

        const result = await setProductToolConfigTool.execute({
          productId: 'test-product',
          category,
          settings: { testKey: 'testValue' },
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain(`Updated ${category} config`);
      }
    });
  });

  // ============ set_product_email ============
  describe('set_product_email', () => {
    it('sets email config with all fields', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      const result = await setProductEmailTool.execute({
        productId: 'my-product',
        himalayaAccount: 'myimap',
        fromAddress: 'contact@myproduct.com',
        resendApiKey: 're_secret_key',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('✅ Email config saved for my-product');
      expect(result.data.email).toEqual({
        account: 'myimap',
        from: 'contact@myproduct.com',
      });
      expect(result.data.resend).toBe('(configured)');
      
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        email: { account: 'myimap', from: 'contact@myproduct.com' },
        resend: { apiKey: 're_secret_key', fromEmail: 'contact@myproduct.com' },
      });
    });

    it('sets only himalaya account', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      const result = await setProductEmailTool.execute({
        productId: 'my-product',
        himalayaAccount: 'myimap',
      });

      expect(result.success).toBe(true);
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        email: { account: 'myimap', from: undefined },
      });
    });

    it('sets only resend API key', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      const result = await setProductEmailTool.execute({
        productId: 'my-product',
        resendApiKey: 're_secret',
      });

      expect(result.success).toBe(true);
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        resend: { apiKey: 're_secret', fromEmail: undefined },
      });
    });

    it('merges with existing config preserving non-email settings', async () => {
      const existingConfig = createMockConfig({
        twitter: { handle: '@existing' },
        email: { account: 'old', from: 'old@example.com' },
      });
      vi.mocked(getProductToolConfig).mockResolvedValue(existingConfig);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      await setProductEmailTool.execute({
        productId: 'my-product',
        himalayaAccount: 'new-account',
        fromAddress: 'new@example.com',
      });

      // Should preserve twitter config while updating email
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        ...existingConfig,
        email: { account: 'new-account', from: 'new@example.com' },
      });
    });
  });

  // ============ set_product_social ============
  describe('set_product_social', () => {
    it('sets twitter handle', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      const result = await setProductSocialTool.execute({
        productId: 'my-product',
        twitterHandle: '@myproduct',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('✅ Social accounts saved for my-product');
      expect(result.data).toEqual({
        twitter: '@myproduct',
        linkedin: undefined,
      });
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        twitter: { handle: '@myproduct' },
      });
    });

    it('sets linkedin URN and token', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      const result = await setProductSocialTool.execute({
        productId: 'my-product',
        linkedinUrn: 'urn:li:person:abc123',
        linkedinToken: 'token_xxx',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        twitter: undefined,
        linkedin: 'urn:li:person:abc123',
      });
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        linkedin: { profileUrn: 'urn:li:person:abc123', accessToken: 'token_xxx' },
      });
    });

    it('sets both twitter and linkedin', async () => {
      vi.mocked(getProductToolConfig).mockResolvedValue(null);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      const result = await setProductSocialTool.execute({
        productId: 'my-product',
        twitterHandle: '@myproduct',
        linkedinUrn: 'urn:li:company:456',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        twitter: '@myproduct',
        linkedin: 'urn:li:company:456',
      });
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        twitter: { handle: '@myproduct' },
        linkedin: { profileUrn: 'urn:li:company:456', accessToken: undefined },
      });
    });

    it('merges with existing social config', async () => {
      const existingConfig = createMockConfig({
        twitter: { handle: '@old', cookieProfile: 'profile1' },
        linkedin: { profileUrn: 'urn:li:person:old', accessToken: 'old_token' },
      });
      vi.mocked(getProductToolConfig).mockResolvedValue(existingConfig);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      await setProductSocialTool.execute({
        productId: 'my-product',
        twitterHandle: '@newhandle',
      });

      // Should preserve cookieProfile from existing config
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        ...existingConfig,
        twitter: { handle: '@newhandle', cookieProfile: 'profile1' },
      });
    });

    it('merges linkedin with existing config when providing both urn and token', async () => {
      const existingConfig = createMockConfig({
        linkedin: { profileUrn: 'urn:li:person:old', accessToken: 'existing_token' },
      });
      vi.mocked(getProductToolConfig).mockResolvedValue(existingConfig);
      vi.mocked(saveProductToolConfig).mockResolvedValue(undefined);

      await setProductSocialTool.execute({
        productId: 'my-product',
        linkedinUrn: 'urn:li:person:new',
        linkedinToken: 'new_token',
      });

      // Updates both URN and token
      expect(saveProductToolConfig).toHaveBeenCalledWith('my-product', {
        ...existingConfig,
        linkedin: { profileUrn: 'urn:li:person:new', accessToken: 'new_token' },
      });
    });
  });

  // ============ list_product_configs ============
  describe('list_product_configs', () => {
    it('lists products with their config status', async () => {
      const mockProducts = [
        createMockProduct({ id: 'product1', name: 'Product One' }),
        createMockProduct({ id: 'product2', name: 'Product Two' }),
        createMockProduct({ id: 'product3', name: 'Product Three' }),
      ];
      vi.mocked(memory.listProducts).mockResolvedValue(mockProducts);
      
      // Use explicit config objects to avoid createMockConfig defaults
      vi.mocked(getProductToolConfig)
        .mockResolvedValueOnce({ email: { account: 'test' }, twitter: { handle: '@test' } })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ linkedin: { profileUrn: 'urn:li:person:x' } });

      const result = await listProductConfigsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Found 3 product(s)');
      expect(result.data).toHaveLength(3);
      
      expect(result.data[0]).toEqual({
        productId: 'product1',
        hasConfig: true,
        categories: ['email', 'twitter'],
      });
      expect(result.data[1]).toEqual({
        productId: 'product2',
        hasConfig: false,
        categories: [],
      });
      expect(result.data[2]).toEqual({
        productId: 'product3',
        hasConfig: true,
        categories: ['linkedin'],
      });
    });

    it('handles no products', async () => {
      vi.mocked(memory.listProducts).mockResolvedValue([]);

      const result = await listProductConfigsTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Found 0 product(s)');
      expect(result.data).toEqual([]);
    });

    it('excludes env category from listed categories', async () => {
      const mockProducts = [createMockProduct({ id: 'product1' })];
      vi.mocked(memory.listProducts).mockResolvedValue(mockProducts);
      vi.mocked(getProductToolConfig).mockResolvedValue({
        email: { account: 'test' },
        env: { CUSTOM_VAR: 'value' },
      });

      const result = await listProductConfigsTool.execute({});

      expect(result.data[0].categories).toEqual(['email']);
      expect(result.data[0].categories).not.toContain('env');
    });
  });

  // ============ Tool Metadata ============
  describe('Tool Metadata', () => {
    it('get_tool_config has correct definition', () => {
      expect(getProductToolConfigTool.name).toBe('get_tool_config');
      expect(getProductToolConfigTool.description).toContain('tool configuration');
      expect(getProductToolConfigTool.parameters.properties.productId).toBeDefined();
    });

    it('set_tool_config has correct definition', () => {
      expect(setProductToolConfigTool.name).toBe('set_tool_config');
      expect(setProductToolConfigTool.parameters.required).toContain('category');
      expect(setProductToolConfigTool.parameters.required).toContain('settings');
      expect(setProductToolConfigTool.parameters.properties.category.enum).toEqual([
        'email', 'resend', 'twitter', 'linkedin', 'producthunt', 'images'
      ]);
    });

    it('set_product_email has correct definition', () => {
      expect(setProductEmailTool.name).toBe('set_product_email');
      expect(setProductEmailTool.parameters.required).toContain('productId');
      expect(setProductEmailTool.parameters.properties.himalayaAccount).toBeDefined();
      expect(setProductEmailTool.parameters.properties.resendApiKey).toBeDefined();
    });

    it('set_product_social has correct definition', () => {
      expect(setProductSocialTool.name).toBe('set_product_social');
      expect(setProductSocialTool.parameters.required).toContain('productId');
      expect(setProductSocialTool.parameters.properties.twitterHandle).toBeDefined();
      expect(setProductSocialTool.parameters.properties.linkedinUrn).toBeDefined();
    });

    it('list_product_configs has correct definition', () => {
      expect(listProductConfigsTool.name).toBe('list_product_configs');
      expect(listProductConfigsTool.description).toContain('List');
    });
  });
});
