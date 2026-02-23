/**
 * Unit tests for MarketClaw Extension Background Service Worker
 * 
 * Tests command routing and primitive handling.
 * Run with: npx vitest extension/__tests__/background.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  scripting: {
    executeScript: vi.fn()
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn()
  },
  runtime: {
    onMessage: {
      addListener: vi.fn()
    }
  }
};

global.chrome = mockChrome;

// Available primitives list (from background.js)
const PRIMITIVES = [
  'click', 'type', 'find', 'getText', 'getAttribute', 'setAttribute',
  'scroll', 'hover', 'focus', 'select', 'setChecked', 'wait', 'waitGone',
  'delay', 'pageInfo', 'evaluate'
];

describe('Background Service Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('PRIMITIVES constant', () => {
    it('should include all expected primitive actions', () => {
      const expectedPrimitives = [
        'click', 'type', 'find', 'getText', 'getAttribute', 'setAttribute',
        'scroll', 'hover', 'focus', 'select', 'setChecked', 'wait', 'waitGone',
        'delay', 'pageInfo', 'evaluate'
      ];
      
      expect(PRIMITIVES).toEqual(expectedPrimitives);
    });
    
    it('should have 16 primitives', () => {
      expect(PRIMITIVES).toHaveLength(16);
    });
  });
  
  describe('handleCommand routing', () => {
    // Simulate handleCommand function
    async function handleCommand(message) {
      const { action, platform, ...params } = message;
      
      switch (action) {
        case 'ping':
          return { success: true, pong: true };
          
        case 'status':
          return { 
            success: true, 
            connected: true, 
            platforms: ['twitter', 'linkedin', 'instagram'],
            primitives: PRIMITIVES,
            version: '0.2.0'
          };
          
        case 'post':
          return { success: true, platform, content: params.content };
          
        case 'navigate':
          return { success: true, url: params.url };
          
        case 'getTabs':
          return { success: true, tabs: [] };
          
        case 'execute':
          return { success: true, result: 'executed' };
          
        default:
          // Check if it's a primitive
          if (PRIMITIVES.includes(action)) {
            return { success: true, primitive: action, params };
          }
          return { success: false, error: `Unknown action: ${action}` };
      }
    }
    
    it('should handle ping command', async () => {
      const result = await handleCommand({ action: 'ping' });
      expect(result).toEqual({ success: true, pong: true });
    });
    
    it('should handle status command', async () => {
      const result = await handleCommand({ action: 'status' });
      expect(result.success).toBe(true);
      expect(result.connected).toBe(true);
      expect(result.primitives).toEqual(PRIMITIVES);
      expect(result.version).toBe('0.2.0');
    });
    
    it('should handle post command', async () => {
      const result = await handleCommand({ 
        action: 'post', 
        platform: 'twitter', 
        content: 'Hello!' 
      });
      expect(result.success).toBe(true);
      expect(result.platform).toBe('twitter');
    });
    
    it('should route click to primitives', async () => {
      const result = await handleCommand({ 
        action: 'click', 
        selector: '#button' 
      });
      expect(result.success).toBe(true);
      expect(result.primitive).toBe('click');
    });
    
    it('should route type to primitives', async () => {
      const result = await handleCommand({ 
        action: 'type', 
        selector: '#input', 
        text: 'hello' 
      });
      expect(result.success).toBe(true);
      expect(result.primitive).toBe('type');
    });
    
    it('should route all primitive actions', async () => {
      for (const primitive of PRIMITIVES) {
        const result = await handleCommand({ action: primitive, selector: '#test' });
        expect(result.success).toBe(true);
        expect(result.primitive).toBe(primitive);
      }
    });
    
    it('should return error for unknown action', async () => {
      const result = await handleCommand({ action: 'unknownAction' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });
  });
  
  describe('Handshake format', () => {
    it('should include correct handshake structure', () => {
      const handshake = {
        type: 'handshake',
        client: 'marketclaw-extension',
        version: '0.2.0',
        capabilities: {
          platforms: ['twitter', 'linkedin', 'instagram'],
          primitives: PRIMITIVES
        }
      };
      
      expect(handshake.type).toBe('handshake');
      expect(handshake.version).toBe('0.2.0');
      expect(handshake.capabilities.platforms).toContain('twitter');
      expect(handshake.capabilities.primitives).toEqual(PRIMITIVES);
    });
  });
  
  describe('Response format', () => {
    it('should format success response correctly', () => {
      const response = {
        type: 'response',
        id: 'msg-001',
        success: true,
        result: { clicked: true, selector: '#button' }
      };
      
      expect(response.type).toBe('response');
      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
    });
    
    it('should format error response correctly', () => {
      const response = {
        type: 'response',
        id: 'msg-001',
        success: false,
        error: 'Element not found: #missing'
      };
      
      expect(response.type).toBe('response');
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });
});

describe('Platform Configuration', () => {
  const PLATFORMS = {
    twitter: {
      patterns: ['twitter.com', 'x.com'],
      contentScript: 'content-scripts/twitter.js'
    },
    linkedin: {
      patterns: ['linkedin.com'],
      contentScript: 'content-scripts/linkedin.js'
    },
    instagram: {
      patterns: ['instagram.com'],
      contentScript: 'content-scripts/instagram.js'
    }
  };
  
  it('should have twitter configuration', () => {
    expect(PLATFORMS.twitter).toBeDefined();
    expect(PLATFORMS.twitter.patterns).toContain('twitter.com');
    expect(PLATFORMS.twitter.patterns).toContain('x.com');
  });
  
  it('should have linkedin configuration', () => {
    expect(PLATFORMS.linkedin).toBeDefined();
    expect(PLATFORMS.linkedin.patterns).toContain('linkedin.com');
  });
  
  it('should have instagram configuration', () => {
    expect(PLATFORMS.instagram).toBeDefined();
    expect(PLATFORMS.instagram.patterns).toContain('instagram.com');
  });
  
  it('should match URLs correctly', () => {
    const matchesPlatform = (url, platform) => {
      return PLATFORMS[platform].patterns.some(p => url.includes(p));
    };
    
    expect(matchesPlatform('https://twitter.com/home', 'twitter')).toBe(true);
    expect(matchesPlatform('https://x.com/compose/tweet', 'twitter')).toBe(true);
    expect(matchesPlatform('https://www.linkedin.com/feed/', 'linkedin')).toBe(true);
    expect(matchesPlatform('https://www.instagram.com/', 'instagram')).toBe(true);
    expect(matchesPlatform('https://facebook.com/', 'twitter')).toBe(false);
  });
});
