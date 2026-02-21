/**
 * Unit tests for tools/config.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

// We need to dynamically re-import the module for each test since WORKSPACE is computed at load time
let tempDir: string;

// Store module reference
type ConfigModule = typeof import('./config.js');
let configModule: ConfigModule;

describe('tools/config', () => {
  beforeEach(async () => {
    // Create a temp directory for each test
    tempDir = await mkdtemp(path.join(tmpdir(), 'marketclaw-config-test-'));
    
    // Reset all mocks and modules
    vi.resetModules();
    
    // Mock os.homedir to return our temp dir
    vi.doMock('os', async () => {
      const actual = await vi.importActual('os');
      return {
        ...actual,
        homedir: () => tempDir,
      };
    });
    
    // Re-import the module with the mocked homedir
    configModule = await import('./config.js');
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
    vi.resetAllMocks();
  });

  describe('getProductToolConfig', () => {
    it('returns null when config file does not exist', async () => {
      const result = await configModule.getProductToolConfig('nonexistent-product');
      expect(result).toBeNull();
    });

    it('returns parsed config when file exists', async () => {
      const productId = 'test-product';
      const config: ConfigModule['ProductToolConfig'] = {
        email: { account: 'test@example.com', from: 'sender@example.com' },
        twitter: { handle: '@testhandle' },
      };

      // Save config first
      await configModule.saveProductToolConfig(productId, config);

      // Now retrieve it
      const result = await configModule.getProductToolConfig(productId);
      expect(result).toEqual(config);
    });

    it('returns null for invalid JSON', async () => {
      const productId = 'bad-json-product';
      const productDir = path.join(tempDir, '.marketclaw', 'workspace', 'products', productId);
      await mkdir(productDir, { recursive: true });
      await writeFile(path.join(productDir, 'tools.json'), '{ invalid json }');

      const result = await configModule.getProductToolConfig(productId);
      expect(result).toBeNull();
    });
  });

  describe('saveProductToolConfig', () => {
    it('creates product directory and saves config', async () => {
      const productId = 'new-product';
      const config: ConfigModule['ProductToolConfig'] = {
        resend: {
          apiKey: 're_test123',
          fromEmail: 'noreply@example.com',
          fromName: 'Test App',
        },
      };

      await configModule.saveProductToolConfig(productId, config);

      // Read the file directly to verify
      const configPath = path.join(tempDir, '.marketclaw', 'workspace', 'products', productId, 'tools.json');
      const saved = JSON.parse(await readFile(configPath, 'utf-8'));
      expect(saved).toEqual(config);
    });

    it('overwrites existing config', async () => {
      const productId = 'overwrite-test';
      const original: ConfigModule['ProductToolConfig'] = { twitter: { handle: '@old' } };
      const updated: ConfigModule['ProductToolConfig'] = { twitter: { handle: '@new' } };

      await configModule.saveProductToolConfig(productId, original);
      await configModule.saveProductToolConfig(productId, updated);

      const result = await configModule.getProductToolConfig(productId);
      expect(result).toEqual(updated);
    });
  });

  describe('getGlobalToolConfig', () => {
    it('returns null when global config does not exist', async () => {
      const result = await configModule.getGlobalToolConfig();
      expect(result).toBeNull();
    });

    it('returns parsed global config when file exists', async () => {
      const config: ConfigModule['ProductToolConfig'] = {
        linkedin: { profileUrn: 'urn:li:person:123', accessToken: 'token123' },
      };

      await configModule.saveGlobalToolConfig(config);
      const result = await configModule.getGlobalToolConfig();
      expect(result).toEqual(config);
    });

    it('returns null for invalid JSON', async () => {
      const workspaceDir = path.join(tempDir, '.marketclaw', 'workspace');
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(path.join(workspaceDir, 'tools.json'), 'not valid json');

      const result = await configModule.getGlobalToolConfig();
      expect(result).toBeNull();
    });
  });

  describe('saveGlobalToolConfig', () => {
    it('creates workspace directory and saves config', async () => {
      const config: ConfigModule['ProductToolConfig'] = {
        images: { outputDir: '/custom/images', defaultStyle: 'photorealistic' },
      };

      await configModule.saveGlobalToolConfig(config);

      const configPath = path.join(tempDir, '.marketclaw', 'workspace', 'tools.json');
      const saved = JSON.parse(await readFile(configPath, 'utf-8'));
      expect(saved).toEqual(config);
    });
  });

  describe('getToolConfig', () => {
    it('returns undefined when no config exists', async () => {
      const result = await configModule.getToolConfig('email');
      expect(result).toBeUndefined();
    });

    it('returns global config when no product specified', async () => {
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        email: { account: 'global@example.com', from: 'global@sender.com' },
      };
      await configModule.saveGlobalToolConfig(globalConfig);

      const result = await configModule.getToolConfig('email');
      expect(result).toEqual(globalConfig.email);
    });

    it('returns product config when it exists and product specified', async () => {
      const productId = 'product-with-override';
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        email: { account: 'global@example.com' },
      };
      const productConfig: ConfigModule['ProductToolConfig'] = {
        email: { account: 'product@example.com' },
      };

      await configModule.saveGlobalToolConfig(globalConfig);
      await configModule.saveProductToolConfig(productId, productConfig);

      const result = await configModule.getToolConfig('email', productId);
      expect(result).toEqual(productConfig.email);
    });

    it('falls back to global config when product has no override', async () => {
      const productId = 'product-no-email';
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        email: { account: 'global@example.com' },
      };
      const productConfig: ConfigModule['ProductToolConfig'] = {
        twitter: { handle: '@product' },  // No email config
      };

      await configModule.saveGlobalToolConfig(globalConfig);
      await configModule.saveProductToolConfig(productId, productConfig);

      const result = await configModule.getToolConfig('email', productId);
      expect(result).toEqual(globalConfig.email);
    });
  });

  describe('resolveToolEnv', () => {
    it('includes process.env by default', async () => {
      const env = await configModule.resolveToolEnv();
      expect(env.PATH).toBeDefined();  // PATH should exist in any env
    });

    it('applies global config env vars', async () => {
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        env: { CUSTOM_VAR: 'global_value', ANOTHER_VAR: 'another' },
      };
      await configModule.saveGlobalToolConfig(globalConfig);

      const env = await configModule.resolveToolEnv();
      expect(env.CUSTOM_VAR).toBe('global_value');
      expect(env.ANOTHER_VAR).toBe('another');
    });

    it('product env vars override global', async () => {
      const productId = 'env-override-product';
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        env: { SHARED_VAR: 'global', GLOBAL_ONLY: 'yes' },
      };
      const productConfig: ConfigModule['ProductToolConfig'] = {
        env: { SHARED_VAR: 'product', PRODUCT_ONLY: 'yes' },
      };

      await configModule.saveGlobalToolConfig(globalConfig);
      await configModule.saveProductToolConfig(productId, productConfig);

      const env = await configModule.resolveToolEnv(productId);
      expect(env.SHARED_VAR).toBe('product');  // Product overrides
      expect(env.GLOBAL_ONLY).toBe('yes');     // Global still available
      expect(env.PRODUCT_ONLY).toBe('yes');    // Product var available
    });
  });

  describe('getHimalayaAccount', () => {
    it('returns undefined when no email config exists', async () => {
      const result = await configModule.getHimalayaAccount();
      expect(result).toBeUndefined();
    });

    it('returns account from global config', async () => {
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        email: { account: 'himalaya-account' },
      };
      await configModule.saveGlobalToolConfig(globalConfig);

      const result = await configModule.getHimalayaAccount();
      expect(result).toBe('himalaya-account');
    });

    it('returns account from product config when specified', async () => {
      const productId = 'email-product';
      const productConfig: ConfigModule['ProductToolConfig'] = {
        email: { account: 'product-himalaya' },
      };
      await configModule.saveProductToolConfig(productId, productConfig);

      const result = await configModule.getHimalayaAccount(productId);
      expect(result).toBe('product-himalaya');
    });
  });

  describe('getResendConfig', () => {
    it('returns undefined when no resend config exists', async () => {
      const result = await configModule.getResendConfig();
      expect(result).toBeUndefined();
    });

    it('returns apiKey and formatted from address', async () => {
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        resend: {
          apiKey: 're_test_apikey',
          fromEmail: 'hello@example.com',
          fromName: 'My App',
        },
      };
      await configModule.saveGlobalToolConfig(globalConfig);

      const result = await configModule.getResendConfig();
      expect(result).toEqual({
        apiKey: 're_test_apikey',
        from: 'My App <hello@example.com>',
      });
    });

    it('uses default fromName when not provided', async () => {
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        resend: {
          apiKey: 're_test_apikey',
          fromEmail: 'hello@example.com',
          // No fromName
        },
      };
      await configModule.saveGlobalToolConfig(globalConfig);

      const result = await configModule.getResendConfig();
      expect(result).toEqual({
        apiKey: 're_test_apikey',
        from: 'MarketClaw <hello@example.com>',
      });
    });

    it('returns undefined from when no fromEmail', async () => {
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        resend: {
          apiKey: 're_test_apikey',
          // No fromEmail
        },
      };
      await configModule.saveGlobalToolConfig(globalConfig);

      const result = await configModule.getResendConfig();
      expect(result).toEqual({
        apiKey: 're_test_apikey',
        from: undefined,
      });
    });

    it('respects product override', async () => {
      const productId = 'resend-product';
      const productConfig: ConfigModule['ProductToolConfig'] = {
        resend: {
          apiKey: 're_product_key',
          fromEmail: 'product@example.com',
          fromName: 'Product Name',
        },
      };
      await configModule.saveProductToolConfig(productId, productConfig);

      const result = await configModule.getResendConfig(productId);
      expect(result).toEqual({
        apiKey: 're_product_key',
        from: 'Product Name <product@example.com>',
      });
    });
  });

  describe('getTwitterConfig', () => {
    it('returns undefined when no twitter config exists', async () => {
      const result = await configModule.getTwitterConfig();
      expect(result).toBeUndefined();
    });

    it('returns handle and profile from config', async () => {
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        twitter: {
          handle: '@myhandle',
          cookieProfile: 'ChromeProfile1',
        },
      };
      await configModule.saveGlobalToolConfig(globalConfig);

      const result = await configModule.getTwitterConfig();
      expect(result).toEqual({
        handle: '@myhandle',
        profile: 'ChromeProfile1',
      });
    });

    it('returns partial config when only handle exists', async () => {
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        twitter: { handle: '@justhandle' },
      };
      await configModule.saveGlobalToolConfig(globalConfig);

      const result = await configModule.getTwitterConfig();
      expect(result).toEqual({
        handle: '@justhandle',
        profile: undefined,
      });
    });
  });

  describe('getLinkedInConfig', () => {
    it('returns undefined when no linkedin config exists', async () => {
      const result = await configModule.getLinkedInConfig();
      expect(result).toBeUndefined();
    });

    it('returns urn and token from config', async () => {
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        linkedin: {
          profileUrn: 'urn:li:person:abc123',
          accessToken: 'linkedin_access_token',
        },
      };
      await configModule.saveGlobalToolConfig(globalConfig);

      const result = await configModule.getLinkedInConfig();
      expect(result).toEqual({
        urn: 'urn:li:person:abc123',
        token: 'linkedin_access_token',
      });
    });

    it('respects product override', async () => {
      const productId = 'linkedin-product';
      const globalConfig: ConfigModule['ProductToolConfig'] = {
        linkedin: { profileUrn: 'urn:li:person:global', accessToken: 'global_token' },
      };
      const productConfig: ConfigModule['ProductToolConfig'] = {
        linkedin: { profileUrn: 'urn:li:person:product', accessToken: 'product_token' },
      };

      await configModule.saveGlobalToolConfig(globalConfig);
      await configModule.saveProductToolConfig(productId, productConfig);

      const result = await configModule.getLinkedInConfig(productId);
      expect(result).toEqual({
        urn: 'urn:li:person:product',
        token: 'product_token',
      });
    });
  });
});
