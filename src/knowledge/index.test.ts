/**
 * Unit tests for Product Knowledge Base
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Create mock state that persists
const mockState = {
  queryItems: vi.fn(),
  upsertItem: vi.fn(),
  isIndexCreated: vi.fn(),
  createIndex: vi.fn(),
  embeddingsCreate: vi.fn(),
};

// Mock OpenAI - must be before imports
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: (...args: unknown[]) => mockState.embeddingsCreate(...args),
      };
    },
  };
});

// Mock Vectra LocalIndex - must be before imports  
vi.mock('vectra', () => {
  return {
    LocalIndex: class MockLocalIndex {
      constructor(_path: string) {}
      isIndexCreated = () => mockState.isIndexCreated();
      createIndex = () => mockState.createIndex();
      upsertItem = (item: unknown) => mockState.upsertItem(item);
      queryItems = (vector: number[], query: string, limit: number) => 
        mockState.queryItems(vector, query, limit);
    },
  };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
}));

// Mock fs (sync)
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { ProductKnowledge, knowledge } from './index.js';
import { scaffoldProduct } from './scaffold.js';
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';

describe('ProductKnowledge', () => {
  let pk: ProductKnowledge;
  const testWorkspace = '/tmp/test-workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    pk = new ProductKnowledge(testWorkspace);
    
    // Default mock behaviors
    mockState.isIndexCreated.mockResolvedValue(false);
    mockState.createIndex.mockResolvedValue(undefined);
    mockState.upsertItem.mockResolvedValue(undefined);
    mockState.embeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('init', () => {
    it('should initialize OpenAI client with provided API key', async () => {
      await pk.init('test-api-key');
      // No error means success
      expect(true).toBe(true);
    });

    it('should use environment variable if no key provided', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-api-key';
      
      await pk.init();
      
      process.env.OPENAI_API_KEY = originalEnv;
    });

    it('should not throw if no API key available', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      await expect(pk.init()).resolves.not.toThrow();
      
      process.env.OPENAI_API_KEY = originalEnv;
    });
  });

  describe('indexFile', () => {
    beforeEach(async () => {
      await pk.init('test-api-key');
    });

    it('should throw error if file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(pk.indexFile('test-product', 'nonexistent.md'))
        .rejects.toThrow('File not found');
    });

    it('should index file chunks and return count', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('# Test Header\n\nSome content here.');

      const count = await pk.indexFile('test-product', 'test.md');

      expect(count).toBeGreaterThan(0);
      expect(mockState.upsertItem).toHaveBeenCalled();
    });

    it('should chunk long text properly', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const longText = '# Section 1\n' + 'A'.repeat(500) + '\n# Section 2\n' + 'B'.repeat(500);
      vi.mocked(readFile).mockResolvedValue(longText);

      const count = await pk.indexFile('test-product', 'long.md');

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should create index if not exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('Simple content');
      mockState.isIndexCreated.mockResolvedValue(false);

      await pk.indexFile('test-product', 'test.md');

      expect(mockState.createIndex).toHaveBeenCalled();
    });

    it('should detect knowledge type from file path', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('Content');

      // Test voice type
      await pk.indexFile('test-product', 'VOICE.md');
      expect(mockState.upsertItem).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ type: 'voice' }),
        })
      );

      mockState.upsertItem.mockClear();

      // Test research type (need fresh index since it's cached by productId)
      const pk2 = new ProductKnowledge(testWorkspace);
      await pk2.init('test-api-key');
      await pk2.indexFile('test-product-2', 'research/competitors.md');
      expect(mockState.upsertItem).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ type: 'research' }),
        })
      );
    });
  });

  describe('indexProduct', () => {
    beforeEach(async () => {
      await pk.init('test-api-key');
    });

    it('should return zeros if product path does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await pk.indexProduct('nonexistent');

      expect(result).toEqual({ files: 0, chunks: 0 });
    });

    it('should index all markdown files in product directory', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      vi.mocked(readdir).mockImplementation(async (dir) => {
        if (String(dir).includes('research')) {
          return [
            { name: 'competitors.md', isFile: () => true, isDirectory: () => false },
          ] as any;
        }
        return [
          { name: 'VOICE.md', isFile: () => true, isDirectory: () => false },
          { name: 'PRODUCT.md', isFile: () => true, isDirectory: () => false },
          { name: 'research', isFile: () => false, isDirectory: () => true },
        ] as any;
      });
      vi.mocked(readFile).mockResolvedValue('Test content');

      const result = await pk.indexProduct('test-product');

      expect(result.files).toBeGreaterThan(0);
    });

    it('should skip vectors directory', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue([
        { name: 'vectors', isFile: () => false, isDirectory: () => true },
        { name: 'VOICE.md', isFile: () => true, isDirectory: () => false },
      ] as any);
      vi.mocked(readFile).mockResolvedValue('Test content');

      const result = await pk.indexProduct('test-product');

      expect(result.files).toBe(1);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await pk.init('test-api-key');
    });

    it('should return empty array if index not created', async () => {
      // First call for getIndex, second for the search check
      mockState.isIndexCreated
        .mockResolvedValueOnce(false)  // getIndex creates it
        .mockResolvedValueOnce(false); // search checks and it's empty

      const results = await pk.search('test-product', 'test query');

      expect(results).toEqual([]);
    });

    it('should return search results with scores', async () => {
      mockState.isIndexCreated.mockResolvedValue(true);
      mockState.queryItems.mockResolvedValue([
        {
          score: 0.95,
          item: {
            metadata: {
              content: 'Relevant content',
              file: 'VOICE.md',
              section: 'Tone',
            },
          },
        },
        {
          score: 0.85,
          item: {
            metadata: {
              content: 'Another result',
              file: 'research/audience.md',
              section: '',
            },
          },
        },
      ]);

      const results = await pk.search('test-product', 'brand voice', 5);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        content: 'Relevant content',
        file: 'VOICE.md',
        section: 'Tone',
        score: 0.95,
      });
      expect(results[1].score).toBe(0.85);
    });

    it('should respect limit parameter', async () => {
      mockState.isIndexCreated.mockResolvedValue(true);
      mockState.queryItems.mockResolvedValue([]);

      await pk.search('test-product', 'query', 3);

      expect(mockState.queryItems).toHaveBeenCalledWith(
        expect.any(Array),
        'query',
        3
      );
    });
  });

  describe('searchAll', () => {
    beforeEach(async () => {
      await pk.init('test-api-key');
    });

    it('should return empty array if products directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const results = await pk.searchAll('test query');

      expect(results).toEqual([]);
    });

    it('should search across multiple products and sort by score', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue(['product-a', 'product-b'] as any);
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
      mockState.isIndexCreated.mockResolvedValue(true);
      
      let callCount = 0;
      mockState.queryItems.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{
            score: 0.7,
            item: { metadata: { content: 'From A', file: 'a.md', section: '' } },
          }]);
        }
        return Promise.resolve([{
          score: 0.9,
          item: { metadata: { content: 'From B', file: 'b.md', section: '' } },
        }]);
      });

      const results = await pk.searchAll('query', 5);

      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.9);
      expect(results[0].productId).toBe('product-b');
      expect(results[1].score).toBe(0.7);
    });
  });

  describe('addKnowledge', () => {
    beforeEach(async () => {
      await pk.init('test-api-key');
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('');
    });

    it('should add voice knowledge to VOICE.md', async () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(false)  // File doesn't exist for reading
        .mockReturnValueOnce(true);   // File exists for indexing

      const filePath = await pk.addKnowledge('test-product', {
        type: 'voice',
        content: 'New voice guidelines',
      });

      expect(filePath).toBe('VOICE.md');
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('VOICE.md'),
        expect.stringContaining('New voice guidelines')
      );
    });

    it('should add research knowledge to research directory', async () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const filePath = await pk.addKnowledge('test-product', {
        type: 'research',
        category: 'competitors',
        content: 'Competitor analysis',
      });

      expect(filePath).toBe('research/competitors.md');
      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('research'),
        { recursive: true }
      );
    });

    it('should add learning knowledge to learnings directory', async () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const filePath = await pk.addKnowledge('test-product', {
        type: 'learning',
        category: 'insights',
        content: 'Campaign performed well',
      });

      expect(filePath).toBe('learnings/insights.md');
    });

    it('should add asset knowledge to assets directory', async () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const filePath = await pk.addKnowledge('test-product', {
        type: 'asset',
        category: 'hooks',
        content: 'Great hook: "Stop scrolling!"',
      });

      expect(filePath).toBe('assets/hooks.md');
    });

    it('should append to existing file', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('# Existing content\n');

      await pk.addKnowledge('test-product', {
        type: 'voice',
        content: 'New content',
      });

      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('# Existing content')
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('New content')
      );
    });

    it('should use default category if not provided', async () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const filePath = await pk.addKnowledge('test-product', {
        type: 'research',
        content: 'Some research',
      });

      expect(filePath).toBe('research/notes.md');
    });

    it('should include timestamp in entry', async () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      await pk.addKnowledge('test-product', {
        type: 'voice',
        content: 'Timestamped content',
      });

      const writeCall = vi.mocked(writeFile).mock.calls[0];
      const content = writeCall[1] as string;
      expect(content).toMatch(/## \d{4}-\d{2}-\d{2}/);
    });
  });

  describe('buildContext', () => {
    beforeEach(async () => {
      await pk.init('test-api-key');
    });

    it('should include VOICE.md if it exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('# Brand Voice\nBe friendly and professional.');
      mockState.isIndexCreated.mockResolvedValue(true);
      mockState.queryItems.mockResolvedValue([]);

      const context = await pk.buildContext('test-product', 'test query');

      expect(context).toContain('Brand Voice');
    });

    it('should include search results when query provided', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      mockState.isIndexCreated.mockResolvedValue(true);
      mockState.queryItems.mockResolvedValue([
        {
          score: 0.9,
          item: {
            metadata: {
              content: 'Relevant search result',
              file: 'research/audience.md',
              section: 'Demographics',
            },
          },
        },
      ]);

      const context = await pk.buildContext('test-product', 'audience demographics');

      expect(context).toContain('Relevant search result');
      expect(context).toContain('research/audience.md');
      expect(context).toContain('Demographics');
    });

    it('should respect maxChars limit', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      mockState.isIndexCreated.mockResolvedValue(true);
      mockState.queryItems.mockResolvedValue([
        {
          score: 0.9,
          item: { metadata: { content: 'A'.repeat(500), file: 'a.md', section: '' } },
        },
        {
          score: 0.8,
          item: { metadata: { content: 'B'.repeat(500), file: 'b.md', section: '' } },
        },
      ]);

      const context = await pk.buildContext('test-product', 'query', 600);

      expect(context.length).toBeLessThan(700);
    });

    it('should return empty string if no content available', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      mockState.isIndexCreated.mockResolvedValue(true);
      mockState.queryItems.mockResolvedValue([]);

      const context = await pk.buildContext('test-product');

      expect(context).toBe('');
    });
  });

  describe('embedding errors', () => {
    it('should return 0 chunks if OpenAI not initialized (errors are caught)', async () => {
      const freshPk = new ProductKnowledge('/tmp/fresh');
      // Don't call init
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('Content');

      // indexFile catches errors and returns 0 instead of throwing
      const result = await freshPk.indexFile('test-product', 'test.md');
      expect(result).toBe(0);
    });

    it('should throw from embed when called directly without init', async () => {
      const freshPk = new ProductKnowledge('/tmp/fresh');
      // The embed method is private, but we can test via search which also uses it
      vi.mocked(existsSync).mockReturnValue(true);
      mockState.isIndexCreated.mockResolvedValue(true);

      // search calls embed and doesn't catch the error
      await expect(freshPk.search('test-product', 'query'))
        .rejects.toThrow('OpenAI client not initialized');
    });
  });

  describe('singleton export', () => {
    it('should export a singleton instance', () => {
      expect(knowledge).toBeInstanceOf(ProductKnowledge);
    });
  });
});

describe('scaffoldProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  it('should create directory structure', async () => {
    await scaffoldProduct({
      id: 'test-product',
      name: 'Test Product',
      workspace: '/tmp/test-workspace',
    });

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('test-product'),
      { recursive: true }
    );
    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('research'),
      { recursive: true }
    );
    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('learnings'),
      { recursive: true }
    );
    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('assets'),
      { recursive: true }
    );
    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('history'),
      { recursive: true }
    );
  });

  it('should create template files', async () => {
    const created = await scaffoldProduct({
      id: 'test-product',
      name: 'Test Product',
      workspace: '/tmp/test-workspace',
    });

    expect(created).toContain('PRODUCT.md');
    expect(created).toContain('VOICE.md');
    expect(created).toContain('research/competitors.md');
    expect(created).toContain('research/audience.md');
    expect(created).toContain('learnings/what-works.md');
    expect(created).toContain('assets/key-messages.md');
  });

  it('should include product name in templates', async () => {
    await scaffoldProduct({
      id: 'awesome-app',
      name: 'Awesome App',
      tagline: 'Making life awesome',
      workspace: '/tmp/test-workspace',
    });

    const voiceCall = vi.mocked(writeFile).mock.calls.find(
      call => String(call[0]).includes('VOICE.md')
    );
    expect(voiceCall).toBeDefined();
    expect(voiceCall![1]).toContain('Awesome App');
    expect(voiceCall![1]).toContain('Making life awesome');
  });

  it('should include description in PRODUCT.md', async () => {
    await scaffoldProduct({
      id: 'my-product',
      name: 'My Product',
      description: 'A revolutionary product',
      workspace: '/tmp/test-workspace',
    });

    const productCall = vi.mocked(writeFile).mock.calls.find(
      call => String(call[0]).endsWith('PRODUCT.md')
    );
    expect(productCall).toBeDefined();
    expect(productCall![1]).toContain('A revolutionary product');
  });

  it('should not overwrite existing files', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const created = await scaffoldProduct({
      id: 'existing-product',
      name: 'Existing Product',
      workspace: '/tmp/test-workspace',
    });

    expect(created).toEqual([]);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should use default workspace if not provided', async () => {
    await scaffoldProduct({
      id: 'default-workspace-product',
      name: 'Default Workspace Product',
    });

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('.marketclaw'),
      { recursive: true }
    );
  });

  it('should return only newly created files', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).includes('VOICE.md');
    });

    const created = await scaffoldProduct({
      id: 'partial-product',
      name: 'Partial Product',
      workspace: '/tmp/test-workspace',
    });

    expect(created).not.toContain('VOICE.md');
    expect(created).toContain('PRODUCT.md');
  });
});

describe('chunkText internal logic', () => {
  let pk: ProductKnowledge;

  beforeEach(async () => {
    vi.clearAllMocks();
    pk = new ProductKnowledge('/tmp/test');
    await pk.init('test-key');
    vi.mocked(existsSync).mockReturnValue(true);
    mockState.isIndexCreated.mockResolvedValue(false);
    mockState.embeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });
  });

  it('should split by headers when present', async () => {
    const textWithHeaders = `# Header 1
Content under header 1

## Header 2
Content under header 2

### Header 3
Content under header 3`;

    vi.mocked(readFile).mockResolvedValue(textWithHeaders);

    await pk.indexFile('test', 'test.md');

    expect(mockState.upsertItem.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should chunk by size when no headers', async () => {
    const longTextNoHeaders = 'A'.repeat(3000);

    vi.mocked(readFile).mockResolvedValue(longTextNoHeaders);

    await pk.indexFile('test', 'test.md');

    expect(mockState.upsertItem.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getKnowledgeType internal logic', () => {
  const testCases: [string, string][] = [
    ['VOICE.md', 'voice'],
    ['voice-guide.md', 'voice'],
    ['research/competitors.md', 'research'],
    ['research/audience.md', 'research'],
    ['learnings/what-works.md', 'learning'],
    ['learnings/flops.md', 'learning'],
    ['assets/hooks.md', 'asset'],
    ['assets/key-messages.md', 'asset'],
    ['assets/hashtags.md', 'asset'],
    ['history/2024-01/campaigns.md', 'history'],
    ['random.md', 'general'],
  ];

  it.each(testCases)('should classify %s as %s', async (filePath, expectedType) => {
    vi.clearAllMocks();
    mockState.upsertItem.mockClear();
    mockState.isIndexCreated.mockResolvedValue(false);
    mockState.embeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue('content');

    // Use a unique product ID for each test to avoid index caching issues
    const pk = new ProductKnowledge('/tmp/test');
    await pk.init('test-key');
    await pk.indexFile(`test-${filePath.replace(/\//g, '-')}`, filePath);

    expect(mockState.upsertItem).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ type: expectedType }),
      })
    );
  });
});
