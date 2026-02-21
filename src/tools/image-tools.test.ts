/**
 * Tests for Image Generation Tools
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { homedir } from 'os';

// Mock child_process before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// Import after mocks are set up
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import {
  generateImageTool,
  editImageTool,
  generateMarketingVisualTool,
  listGeneratedImagesTool,
  getImagePathTool,
} from './image-tools.js';

const NANO_BANANA_SCRIPT = '/usr/local/lib/node_modules/clawdbot/skills/nano-banana-pro/scripts/generate_image.py';
const OUTPUT_DIR = path.join(homedir(), '.marketclaw', 'images');

describe('generateImageTool', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should generate an image successfully with cost reporting', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      if (p === OUTPUT_DIR) return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('Image generated successfully\nMEDIA:/path/to/output.png');

    const result = await generateImageTool.execute({
      prompt: 'A beautiful sunset over mountains',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('✅ Image generated!');
    expect(result.data).toBeDefined();
    expect(result.data.prompt).toBe('A beautiful sunset over mountains');
    expect(result.data.resolution).toBe('1K');
    expect(result.data.path).toBe('/path/to/output.png');
    
    // Verify cost reporting
    expect(result.cost).toBeDefined();
    expect(result.cost?.usd).toBe(0.02);
    expect(result.cost?.provider).toBe('gemini');
    expect(result.cost?.units).toBe(1);
    expect(result.cost?.unitType).toBe('images');
  });

  it('should fail when Nano Banana Pro script is missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await generateImageTool.execute({
      prompt: 'Test prompt',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Nano Banana Pro script not found');
  });

  it('should fail when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    vi.mocked(existsSync).mockImplementation((p) => p === NANO_BANANA_SCRIPT);

    const result = await generateImageTool.execute({
      prompt: 'Test prompt',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('GEMINI_API_KEY not set');
  });

  it('should support different resolution options', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/path/to/output.png');

    const result = await generateImageTool.execute({
      prompt: 'High res image',
      resolution: '4K',
    });

    expect(result.success).toBe(true);
    expect(result.data.resolution).toBe('4K');
    
    // Verify the command includes the resolution
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('--resolution 4K'),
      expect.any(Object)
    );
  });

  it('should include style in the prompt when provided', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/path/to/output.png');

    await generateImageTool.execute({
      prompt: 'A logo',
      style: 'minimalist',
    });

    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('Style: minimalist'),
      expect.any(Object)
    );
  });

  it('should handle execution errors gracefully', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      return false;
    });
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('Python script crashed');
    });

    const result = await generateImageTool.execute({
      prompt: 'Test prompt',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Image generation failed');
    expect(result.message).toContain('Python script crashed');
  });
});

describe('editImageTool', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should edit an image successfully', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      if (p === '/input/image.png') return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/path/to/edited.png');

    const result = await editImageTool.execute({
      inputImage: '/input/image.png',
      prompt: 'Remove the background',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('✅ Image edited!');
    expect(result.data.inputImage).toBe('/input/image.png');
    expect(result.data.prompt).toBe('Remove the background');
    expect(result.data.resolution).toBe('2K'); // default for edit
    
    // Verify cost
    expect(result.cost?.usd).toBe(0.025); // edit costs more
    expect(result.cost?.provider).toBe('gemini');
  });

  it('should fail when input image is not found', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      if (p === '/nonexistent/image.png') return false;
      return false;
    });

    const result = await editImageTool.execute({
      inputImage: '/nonexistent/image.png',
      prompt: 'Make it brighter',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Input image not found');
    expect(result.message).toContain('/nonexistent/image.png');
  });

  it('should include input image in the command', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      if (p === '/my/photo.jpg') return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/output.png');

    await editImageTool.execute({
      inputImage: '/my/photo.jpg',
      prompt: 'Add vintage filter',
    });

    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('--input-image "/my/photo.jpg"'),
      expect.any(Object)
    );
  });
});

describe('generateMarketingVisualTool', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should generate marketing visual for Twitter', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/path/to/marketing.png');

    const result = await generateMarketingVisualTool.execute({
      concept: 'App launch announcement',
      platform: 'twitter',
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('16:9 aspect ratio'),
      expect.any(Object)
    );
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('twitter-marketing'),
      expect.any(Object)
    );
  });

  it('should generate marketing visual for LinkedIn', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/path/to/marketing.png');

    const result = await generateMarketingVisualTool.execute({
      concept: 'B2B software feature',
      platform: 'linkedin',
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('professional'),
      expect.any(Object)
    );
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('1200x627'),
      expect.any(Object)
    );
  });

  it('should generate marketing visual for Instagram', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/path/to/marketing.png');

    const result = await generateMarketingVisualTool.execute({
      concept: 'Product showcase',
      platform: 'instagram',
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('square composition'),
      expect.any(Object)
    );
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('vibrant colors'),
      expect.any(Object)
    );
  });

  it('should use general platform when not specified', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/path/to/marketing.png');

    const result = await generateMarketingVisualTool.execute({
      concept: 'Generic promotional image',
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('versatile composition'),
      expect.any(Object)
    );
  });

  it('should include mood in the prompt', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/path/to/marketing.png');

    await generateMarketingVisualTool.execute({
      concept: 'Playful app icon',
      mood: 'playful and colorful',
    });

    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('Mood: playful and colorful'),
      expect.any(Object)
    );
  });

  it('should use 2K resolution by default', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === NANO_BANANA_SCRIPT) return true;
      return false;
    });
    vi.mocked(execSync).mockReturnValue('MEDIA:/path/to/marketing.png');

    const result = await generateMarketingVisualTool.execute({
      concept: 'Hero banner',
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('--resolution 2K'),
      expect.any(Object)
    );
  });
});

describe('listGeneratedImagesTool', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return empty list when no images exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readdirSync).mockReturnValue([]);

    const result = await listGeneratedImagesTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toBe('No generated images found.');
    expect(result.data).toEqual([]);
  });

  it('should list images with files present', async () => {
    const mockDate1 = new Date('2024-01-15T10:00:00Z');
    const mockDate2 = new Date('2024-01-15T11:00:00Z');
    
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([
      'image1.png',
      'image2.png',
      'notanimage.txt', // should be filtered out
    ] as any);
    vi.mocked(statSync).mockImplementation((p) => {
      const filename = path.basename(String(p));
      if (filename === 'image1.png') {
        return { mtime: mockDate1 } as any;
      }
      return { mtime: mockDate2 } as any;
    });

    const result = await listGeneratedImagesTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toBe('Found 2 image(s).');
    expect(result.data).toHaveLength(2);
    // Should be sorted by date, newest first
    expect(result.data[0].filename).toBe('image2.png');
    expect(result.data[1].filename).toBe('image1.png');
  });

  it('should respect limit parameter', async () => {
    const mockDate = new Date('2024-01-15T10:00:00Z');
    
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([
      'image1.png',
      'image2.png',
      'image3.png',
      'image4.png',
      'image5.png',
    ] as any);
    vi.mocked(statSync).mockReturnValue({ mtime: mockDate } as any);

    const result = await listGeneratedImagesTool.execute({ limit: 3 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
  });

  it('should include jpg files', async () => {
    const mockDate = new Date('2024-01-15T10:00:00Z');
    
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([
      'photo1.jpg',
      'graphic.png',
    ] as any);
    vi.mocked(statSync).mockReturnValue({ mtime: mockDate } as any);

    const result = await listGeneratedImagesTool.execute({});

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data.map((f: any) => f.filename)).toContain('photo1.jpg');
  });

  it('should default to limit of 10', async () => {
    const mockDate = new Date('2024-01-15T10:00:00Z');
    const files = Array.from({ length: 15 }, (_, i) => `image${i}.png`);
    
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(files as any);
    vi.mocked(statSync).mockReturnValue({ mtime: mockDate } as any);

    const result = await listGeneratedImagesTool.execute({});

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(10);
  });
});

describe('getImagePathTool', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should get image path by filename', async () => {
    const imagePath = path.join(OUTPUT_DIR, 'myimage.png');
    
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === imagePath || p === OUTPUT_DIR) return true;
      return false;
    });

    const result = await getImagePathTool.execute({ filename: 'myimage.png' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('SEND_IMAGE:');
    expect(result.data.path).toBe(imagePath);
    expect(result.data.sendable).toBe(true);
  });

  it('should get latest image when filename is "latest"', async () => {
    const mockDate1 = new Date('2024-01-15T10:00:00Z');
    const mockDate2 = new Date('2024-01-15T12:00:00Z'); // more recent
    
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['old.png', 'recent.png'] as any);
    vi.mocked(statSync).mockImplementation((p) => {
      const filename = path.basename(String(p));
      if (filename === 'recent.png') {
        return { mtime: mockDate2 } as any;
      }
      return { mtime: mockDate1 } as any;
    });

    const result = await getImagePathTool.execute({ filename: 'latest' });

    expect(result.success).toBe(true);
    expect(result.data.path).toContain('recent.png');
  });

  it('should fail when image is not found', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await getImagePathTool.execute({ filename: 'nonexistent.png' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Image not found');
  });

  it('should fail when no images exist and "latest" is requested', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([]);

    const result = await getImagePathTool.execute({ filename: 'latest' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('No generated images found.');
  });

  it('should handle absolute paths', async () => {
    const absolutePath = '/absolute/path/to/image.png';
    
    vi.mocked(existsSync).mockImplementation((p) => {
      if (p === absolutePath || p === OUTPUT_DIR) return true;
      return false;
    });

    const result = await getImagePathTool.execute({ filename: absolutePath });

    expect(result.success).toBe(true);
    expect(result.data.path).toBe(absolutePath);
  });
});
