/**
 * Brand Tools Unit Tests
 * Tests for brand identity management tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setBrandColorsTool,
  setBrandVoiceTool,
  setBrandTaglineTool,
  setBrandAssetTool,
  setBrandTypographyTool,
  getProductBrandTool,
  clearBrandSectionTool,
} from './brand-tools.js';
import { Product, ProductBrand } from '../memory/index.js';

// Mock the memory module
vi.mock('../memory/index.js', () => ({
  memory: {
    getState: vi.fn(),
    getProduct: vi.fn(),
    saveProduct: vi.fn(),
  },
}));

// Import mocked module
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

// Helper to create a mock brand
function createMockBrand(overrides: Partial<ProductBrand> = {}): ProductBrand {
  return {
    colors: {
      primary: '#FF6B35',
      secondary: '#2D3047',
    },
    voice: {
      tone: 'warm',
      personality: 'friendly expert',
    },
    taglines: ['Test tagline'],
    assets: {
      logo: 'https://example.com/logo.png',
    },
    ...overrides,
  };
}

describe('Brand Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ set_brand_colors ============
  describe('set_brand_colors', () => {
    it('sets colors for a specific product', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandColorsTool.execute({
        productId: 'test-product',
        primary: '#FF6B35',
        secondary: '#2D3047',
        accent: '#00D9C0',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Brand colors updated');
      expect(result.data.colors).toEqual({
        primary: '#FF6B35',
        secondary: '#2D3047',
        accent: '#00D9C0',
      });
      expect(memory.saveProduct).toHaveBeenCalled();
    });

    it('uses active product when productId not specified', async () => {
      const product = createMockProduct({ id: 'active-product' });
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandColorsTool.execute({
        primary: '#123456',
      });

      expect(result.success).toBe(true);
      expect(memory.getProduct).toHaveBeenCalledWith('active-product');
    });

    it('returns error when no product and no active product', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: undefined,
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await setBrandColorsTool.execute({
        primary: '#123456',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No product specified');
    });

    it('returns error when product not found', async () => {
      vi.mocked(memory.getProduct).mockResolvedValue(null);

      const result = await setBrandColorsTool.execute({
        productId: 'nonexistent',
        primary: '#123456',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('merges with existing colors by default', async () => {
      const product = createMockProduct({
        brand: { colors: { primary: '#OLD', secondary: '#OLD2' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandColorsTool.execute({
        productId: 'test-product',
        primary: '#NEW',
      });

      expect(result.success).toBe(true);
      expect(result.data.colors.primary).toBe('#NEW');
      expect(result.data.colors.secondary).toBe('#OLD2');
    });

    it('replaces all colors when merge=false', async () => {
      const product = createMockProduct({
        brand: { colors: { primary: '#OLD', secondary: '#OLD2' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandColorsTool.execute({
        productId: 'test-product',
        primary: '#NEW',
        merge: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.colors).toEqual({ primary: '#NEW' });
      expect(result.data.colors.secondary).toBeUndefined();
    });

    it('supports custom color names', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandColorsTool.execute({
        productId: 'test-product',
        primary: '#FF6B35',
        custom: {
          cta: '#00FF00',
          warning: '#FF0000',
          success: '#00CC00',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.colors).toEqual({
        primary: '#FF6B35',
        cta: '#00FF00',
        warning: '#FF0000',
        success: '#00CC00',
      });
    });

    it('sets background and text colors', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandColorsTool.execute({
        productId: 'test-product',
        background: '#FFFFFF',
        text: '#333333',
      });

      expect(result.success).toBe(true);
      expect(result.data.colors.background).toBe('#FFFFFF');
      expect(result.data.colors.text).toBe('#333333');
    });

    it('initializes brand object if not exists', async () => {
      const product = createMockProduct({ brand: undefined });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandColorsTool.execute({
        productId: 'test-product',
        primary: '#123456',
      });

      expect(result.success).toBe(true);
      expect(result.data.colors.primary).toBe('#123456');
    });
  });

  // ============ set_brand_voice ============
  describe('set_brand_voice', () => {
    it('sets voice for a product', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandVoiceTool.execute({
        productId: 'test-product',
        tone: 'warm',
        personality: 'reassuring friend',
        style: 'conversational',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Brand voice updated');
      expect(result.data.voice).toEqual({
        tone: 'warm',
        personality: 'reassuring friend',
        style: 'conversational',
      });
    });

    it('uses active product when productId not specified', async () => {
      const product = createMockProduct({ id: 'active-product' });
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandVoiceTool.execute({
        tone: 'professional',
      });

      expect(result.success).toBe(true);
      expect(memory.getProduct).toHaveBeenCalledWith('active-product');
    });

    it('returns error when product not found', async () => {
      vi.mocked(memory.getProduct).mockResolvedValue(null);

      const result = await setBrandVoiceTool.execute({
        productId: 'nonexistent',
        tone: 'warm',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('merges with existing voice by default', async () => {
      const product = createMockProduct({
        brand: { voice: { tone: 'old', personality: 'old personality' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandVoiceTool.execute({
        productId: 'test-product',
        tone: 'new',
      });

      expect(result.success).toBe(true);
      expect(result.data.voice.tone).toBe('new');
      expect(result.data.voice.personality).toBe('old personality');
    });

    it('replaces all voice settings when merge=false', async () => {
      const product = createMockProduct({
        brand: { voice: { tone: 'old', personality: 'old personality', style: 'old style' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandVoiceTool.execute({
        productId: 'test-product',
        tone: 'new',
        merge: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.voice).toEqual({ tone: 'new' });
    });

    it('sets voice guidelines', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandVoiceTool.execute({
        productId: 'test-product',
        guidelines: 'Always be helpful and friendly. Avoid jargon.',
      });

      expect(result.success).toBe(true);
      expect(result.data.voice.guidelines).toBe('Always be helpful and friendly. Avoid jargon.');
    });
  });

  // ============ set_brand_tagline ============
  describe('set_brand_tagline', () => {
    it('sets a single tagline', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTaglineTool.execute({
        productId: 'test-product',
        tagline: "Someone's always got your back",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Set 1 tagline');
      expect(result.data.taglines).toEqual(["Someone's always got your back"]);
    });

    it('sets multiple taglines at once', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTaglineTool.execute({
        productId: 'test-product',
        taglines: ['Tagline one', 'Tagline two', 'Tagline three'],
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Set 3 tagline');
      expect(result.data.taglines).toHaveLength(3);
    });

    it('replaces existing taglines by default', async () => {
      const product = createMockProduct({
        brand: { taglines: ['Old tagline'] },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTaglineTool.execute({
        productId: 'test-product',
        tagline: 'New tagline',
      });

      expect(result.success).toBe(true);
      expect(result.data.taglines).toEqual(['New tagline']);
    });

    it('adds to existing taglines when add=true', async () => {
      const product = createMockProduct({
        brand: { taglines: ['Existing tagline'] },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTaglineTool.execute({
        productId: 'test-product',
        tagline: 'New tagline',
        add: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Added 1 tagline');
      expect(result.data.taglines).toEqual(['Existing tagline', 'New tagline']);
    });

    it('does not add duplicate taglines', async () => {
      const product = createMockProduct({
        brand: { taglines: ['Existing tagline'] },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTaglineTool.execute({
        productId: 'test-product',
        tagline: 'Existing tagline',
        add: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.taglines).toEqual(['Existing tagline']);
    });

    it('returns error when no tagline provided', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);

      const result = await setBrandTaglineTool.execute({
        productId: 'test-product',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No tagline(s) provided');
    });

    it('uses active product when productId not specified', async () => {
      const product = createMockProduct({ id: 'active-product' });
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTaglineTool.execute({
        tagline: 'Test',
      });

      expect(result.success).toBe(true);
      expect(memory.getProduct).toHaveBeenCalledWith('active-product');
    });
  });

  // ============ set_brand_asset ============
  describe('set_brand_asset', () => {
    it('sets logo and icon', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandAssetTool.execute({
        productId: 'test-product',
        logo: 'https://example.com/logo.png',
        icon: 'https://example.com/icon.png',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Brand assets updated');
      expect(result.data.assets).toEqual({
        logo: 'https://example.com/logo.png',
        icon: 'https://example.com/icon.png',
      });
    });

    it('sets logoAlt', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandAssetTool.execute({
        productId: 'test-product',
        logoAlt: 'https://example.com/logo-small.png',
      });

      expect(result.success).toBe(true);
      expect(result.data.assets.logoAlt).toBe('https://example.com/logo-small.png');
    });

    it('supports custom asset names', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandAssetTool.execute({
        productId: 'test-product',
        custom: {
          banner: 'https://example.com/banner.png',
          hero: 'https://example.com/hero.png',
          socialCard: 'https://example.com/social.png',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.assets.banner).toBe('https://example.com/banner.png');
      expect(result.data.assets.hero).toBe('https://example.com/hero.png');
      expect(result.data.assets.socialCard).toBe('https://example.com/social.png');
    });

    it('merges with existing assets by default', async () => {
      const product = createMockProduct({
        brand: { assets: { logo: 'old-logo.png', icon: 'old-icon.png' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandAssetTool.execute({
        productId: 'test-product',
        logo: 'new-logo.png',
      });

      expect(result.success).toBe(true);
      expect(result.data.assets.logo).toBe('new-logo.png');
      expect(result.data.assets.icon).toBe('old-icon.png');
    });

    it('replaces all assets when merge=false', async () => {
      const product = createMockProduct({
        brand: { assets: { logo: 'old-logo.png', icon: 'old-icon.png' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandAssetTool.execute({
        productId: 'test-product',
        logo: 'new-logo.png',
        merge: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.assets).toEqual({ logo: 'new-logo.png' });
    });

    it('returns error when product not found', async () => {
      vi.mocked(memory.getProduct).mockResolvedValue(null);

      const result = await setBrandAssetTool.execute({
        productId: 'nonexistent',
        logo: 'test.png',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  // ============ set_brand_typography ============
  describe('set_brand_typography', () => {
    it('sets typography fonts', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTypographyTool.execute({
        productId: 'test-product',
        headingFont: 'Inter',
        bodyFont: 'Open Sans',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Brand typography updated');
      expect(result.data.typography).toEqual({
        headingFont: 'Inter',
        bodyFont: 'Open Sans',
      });
    });

    it('sets typography guidelines', async () => {
      const product = createMockProduct();
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTypographyTool.execute({
        productId: 'test-product',
        guidelines: 'Use heading font for all titles. Body font for paragraphs.',
      });

      expect(result.success).toBe(true);
      expect(result.data.typography.guidelines).toBe('Use heading font for all titles. Body font for paragraphs.');
    });

    it('merges with existing typography by default', async () => {
      const product = createMockProduct({
        brand: { typography: { headingFont: 'Old Font', bodyFont: 'Old Body' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTypographyTool.execute({
        productId: 'test-product',
        headingFont: 'New Font',
      });

      expect(result.success).toBe(true);
      expect(result.data.typography.headingFont).toBe('New Font');
      expect(result.data.typography.bodyFont).toBe('Old Body');
    });

    it('replaces all typography when merge=false', async () => {
      const product = createMockProduct({
        brand: { typography: { headingFont: 'Old', bodyFont: 'Old', guidelines: 'Old guidelines' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await setBrandTypographyTool.execute({
        productId: 'test-product',
        headingFont: 'New',
        merge: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.typography).toEqual({ headingFont: 'New' });
    });
  });

  // ============ get_product_brand ============
  describe('get_product_brand', () => {
    it('gets complete brand info for a product', async () => {
      const brand = createMockBrand();
      const product = createMockProduct({ brand });
      vi.mocked(memory.getProduct).mockResolvedValue(product);

      const result = await getProductBrandTool.execute({
        productId: 'test-product',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Brand identity for');
      expect(result.data.productId).toBe('test-product');
      expect(result.data.productName).toBe('Test Product');
      expect(result.data.brand).toEqual(brand);
    });

    it('uses active product when productId not specified', async () => {
      const product = createMockProduct({ id: 'active-product', brand: createMockBrand() });
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);

      const result = await getProductBrandTool.execute({});

      expect(result.success).toBe(true);
      expect(memory.getProduct).toHaveBeenCalledWith('active-product');
    });

    it('returns null brand when no brand defined', async () => {
      const product = createMockProduct({ brand: undefined });
      vi.mocked(memory.getProduct).mockResolvedValue(product);

      const result = await getProductBrandTool.execute({
        productId: 'test-product',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('No brand identity defined');
      expect(result.data.brand).toBeNull();
    });

    it('returns error when product not found', async () => {
      vi.mocked(memory.getProduct).mockResolvedValue(null);

      const result = await getProductBrandTool.execute({
        productId: 'nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('returns error when no product and no active product', async () => {
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: undefined,
        lastInteraction: Date.now(),
        preferences: {},
      });

      const result = await getProductBrandTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('No product specified');
    });
  });

  // ============ clear_brand_section ============
  describe('clear_brand_section', () => {
    it('clears colors section', async () => {
      const product = createMockProduct({
        brand: { colors: { primary: '#123' }, voice: { tone: 'warm' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await clearBrandSectionTool.execute({
        productId: 'test-product',
        section: 'colors',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleared colors');
      
      const savedProduct = vi.mocked(memory.saveProduct).mock.calls[0][0];
      expect(savedProduct.brand?.colors).toBeUndefined();
      expect(savedProduct.brand?.voice).toBeDefined();
    });

    it('clears voice section', async () => {
      const product = createMockProduct({
        brand: { colors: { primary: '#123' }, voice: { tone: 'warm' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await clearBrandSectionTool.execute({
        productId: 'test-product',
        section: 'voice',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleared voice');
    });

    it('clears taglines section', async () => {
      const product = createMockProduct({
        brand: { taglines: ['Test'] },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await clearBrandSectionTool.execute({
        productId: 'test-product',
        section: 'taglines',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleared taglines');
    });

    it('clears assets section', async () => {
      const product = createMockProduct({
        brand: { assets: { logo: 'test.png' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await clearBrandSectionTool.execute({
        productId: 'test-product',
        section: 'assets',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleared assets');
    });

    it('clears typography section', async () => {
      const product = createMockProduct({
        brand: { typography: { headingFont: 'Inter' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await clearBrandSectionTool.execute({
        productId: 'test-product',
        section: 'typography',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleared typography');
    });

    it('clears entire brand when section=all', async () => {
      const product = createMockProduct({
        brand: createMockBrand(),
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await clearBrandSectionTool.execute({
        productId: 'test-product',
        section: 'all',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleared entire brand identity');
      
      const savedProduct = vi.mocked(memory.saveProduct).mock.calls[0][0];
      expect(savedProduct.brand).toBeUndefined();
    });

    it('removes brand object when last section cleared', async () => {
      const product = createMockProduct({
        brand: { colors: { primary: '#123' } },
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      await clearBrandSectionTool.execute({
        productId: 'test-product',
        section: 'colors',
      });

      const savedProduct = vi.mocked(memory.saveProduct).mock.calls[0][0];
      expect(savedProduct.brand).toBeUndefined();
    });

    it('returns success when no brand to clear', async () => {
      const product = createMockProduct({ brand: undefined });
      vi.mocked(memory.getProduct).mockResolvedValue(product);

      const result = await clearBrandSectionTool.execute({
        productId: 'test-product',
        section: 'colors',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('No brand identity to clear');
    });

    it('uses active product when productId not specified', async () => {
      const product = createMockProduct({
        id: 'active-product',
        brand: { colors: { primary: '#123' } },
      });
      vi.mocked(memory.getState).mockResolvedValue({
        activeProduct: 'active-product',
        lastInteraction: Date.now(),
        preferences: {},
      });
      vi.mocked(memory.getProduct).mockResolvedValue(product);
      vi.mocked(memory.saveProduct).mockResolvedValue(undefined);

      const result = await clearBrandSectionTool.execute({
        section: 'colors',
      });

      expect(result.success).toBe(true);
      expect(memory.getProduct).toHaveBeenCalledWith('active-product');
    });
  });

  // ============ Tool Metadata ============
  describe('Tool Metadata', () => {
    it('set_brand_colors has correct definition', () => {
      expect(setBrandColorsTool.name).toBe('set_brand_colors');
      expect(setBrandColorsTool.description).toContain('colors');
      expect(setBrandColorsTool.parameters.properties.primary).toBeDefined();
      expect(setBrandColorsTool.parameters.properties.secondary).toBeDefined();
      expect(setBrandColorsTool.parameters.properties.accent).toBeDefined();
      expect(setBrandColorsTool.parameters.properties.custom).toBeDefined();
    });

    it('set_brand_voice has correct definition', () => {
      expect(setBrandVoiceTool.name).toBe('set_brand_voice');
      expect(setBrandVoiceTool.description).toContain('voice');
      expect(setBrandVoiceTool.parameters.properties.tone).toBeDefined();
      expect(setBrandVoiceTool.parameters.properties.personality).toBeDefined();
      expect(setBrandVoiceTool.parameters.properties.style).toBeDefined();
    });

    it('set_brand_tagline has correct definition', () => {
      expect(setBrandTaglineTool.name).toBe('set_brand_tagline');
      expect(setBrandTaglineTool.description).toContain('tagline');
      expect(setBrandTaglineTool.parameters.properties.tagline).toBeDefined();
      expect(setBrandTaglineTool.parameters.properties.taglines).toBeDefined();
      expect(setBrandTaglineTool.parameters.properties.add).toBeDefined();
    });

    it('set_brand_asset has correct definition', () => {
      expect(setBrandAssetTool.name).toBe('set_brand_asset');
      expect(setBrandAssetTool.description).toContain('asset');
      expect(setBrandAssetTool.parameters.properties.logo).toBeDefined();
      expect(setBrandAssetTool.parameters.properties.icon).toBeDefined();
    });

    it('set_brand_typography has correct definition', () => {
      expect(setBrandTypographyTool.name).toBe('set_brand_typography');
      expect(setBrandTypographyTool.description).toContain('typography');
      expect(setBrandTypographyTool.parameters.properties.headingFont).toBeDefined();
      expect(setBrandTypographyTool.parameters.properties.bodyFont).toBeDefined();
    });

    it('get_product_brand has correct definition', () => {
      expect(getProductBrandTool.name).toBe('get_product_brand');
      expect(getProductBrandTool.description).toContain('brand');
      expect(getProductBrandTool.parameters.properties.productId).toBeDefined();
    });

    it('clear_brand_section has correct definition', () => {
      expect(clearBrandSectionTool.name).toBe('clear_brand_section');
      expect(clearBrandSectionTool.parameters.required).toContain('section');
      expect(clearBrandSectionTool.parameters.properties.section.enum).toEqual([
        'colors', 'voice', 'taglines', 'assets', 'typography', 'all'
      ]);
    });
  });
});
