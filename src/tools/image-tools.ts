/**
 * Image Generation Tools
 * Generate and edit images via Nano Banana Pro (Gemini 3 Pro Image)
 */

import { Tool, ToolResult } from './types.js';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

// Nano Banana Pro script location
const NANO_BANANA_SCRIPT = '/usr/local/lib/node_modules/clawdbot/skills/nano-banana-pro/scripts/generate_image.py';

// Output directory for generated images
const OUTPUT_DIR = path.join(homedir(), '.marketclaw', 'images');

// Ensure output directory exists
function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// Generate timestamp filename
function generateFilename(prefix: string = 'image'): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[T:]/g, '-')
    .replace(/\..+/, '')
    .replace(/-/g, '-');
  return `${timestamp}-${prefix}.png`;
}

// ============ Generate Image ============
export const generateImageTool: Tool = {
  name: 'generate_image',
  description: 'Generate an image using AI (Gemini 3 Pro Image / Nano Banana Pro). Great for marketing visuals, social media graphics, product mockups.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { 
        type: 'string', 
        description: 'Detailed description of the image to generate' 
      },
      filename: { 
        type: 'string', 
        description: 'Output filename (optional, auto-generated if not provided)' 
      },
      resolution: { 
        type: 'string', 
        enum: ['1K', '2K', '4K'],
        description: 'Image resolution (default: 1K)' 
      },
      style: {
        type: 'string',
        description: 'Style hint to add to prompt (e.g., "minimalist", "vibrant", "professional")'
      },
    },
    required: ['prompt'],
  },

  async execute(params): Promise<ToolResult> {
    // Check if script exists
    if (!existsSync(NANO_BANANA_SCRIPT)) {
      return {
        success: false,
        message: 'Nano Banana Pro script not found. Make sure Clawdbot is installed with the nano-banana-pro skill.',
      };
    }

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        message: 'GEMINI_API_KEY not set. Required for image generation.',
      };
    }

    ensureOutputDir();

    const filename = params.filename || generateFilename('generated');
    const outputPath = path.join(OUTPUT_DIR, filename);
    const resolution = params.resolution || '1K';
    
    // Enhance prompt with style if provided
    let fullPrompt = params.prompt;
    if (params.style) {
      fullPrompt = `${params.prompt}. Style: ${params.style}`;
    }

    try {
      const cmd = `uv run "${NANO_BANANA_SCRIPT}" --prompt "${fullPrompt.replace(/"/g, '\\"')}" --filename "${outputPath}" --resolution ${resolution}`;
      
      const output = execSync(cmd, { 
        encoding: 'utf-8',
        env: { ...process.env },
        timeout: 120000, // 2 minute timeout
      });

      // Extract MEDIA line if present
      const mediaMatch = output.match(/MEDIA:(.+)/);
      const mediaPath = mediaMatch ? mediaMatch[1].trim() : outputPath;

      return {
        success: true,
        message: `✅ Image generated!`,
        data: {
          path: mediaPath,
          filename,
          resolution,
          prompt: params.prompt,
        },
        cost: {
          usd: 0.02, // Gemini Imagen-3 approximate cost per image
          provider: 'gemini',
          units: 1,
          unitType: 'images',
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Image generation failed: ${err.message || String(err)}`,
      };
    }
  },
};

// ============ Edit Image ============
export const editImageTool: Tool = {
  name: 'edit_image',
  description: 'Edit an existing image using AI instructions (Gemini 3 Pro Image). Can modify, enhance, or transform images.',
  parameters: {
    type: 'object',
    properties: {
      inputImage: { 
        type: 'string', 
        description: 'Path to the input image to edit' 
      },
      prompt: { 
        type: 'string', 
        description: 'Edit instructions (e.g., "remove background", "add sunset colors", "make it more vibrant")' 
      },
      filename: { 
        type: 'string', 
        description: 'Output filename (optional)' 
      },
      resolution: { 
        type: 'string', 
        enum: ['1K', '2K', '4K'],
        description: 'Output resolution (default: 2K)' 
      },
    },
    required: ['inputImage', 'prompt'],
  },

  async execute(params): Promise<ToolResult> {
    if (!existsSync(NANO_BANANA_SCRIPT)) {
      return {
        success: false,
        message: 'Nano Banana Pro script not found.',
      };
    }

    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        message: 'GEMINI_API_KEY not set.',
      };
    }

    if (!existsSync(params.inputImage)) {
      return {
        success: false,
        message: `Input image not found: ${params.inputImage}`,
      };
    }

    ensureOutputDir();

    const filename = params.filename || generateFilename('edited');
    const outputPath = path.join(OUTPUT_DIR, filename);
    const resolution = params.resolution || '2K';

    try {
      const cmd = `uv run "${NANO_BANANA_SCRIPT}" --prompt "${params.prompt.replace(/"/g, '\\"')}" --filename "${outputPath}" --input-image "${params.inputImage}" --resolution ${resolution}`;
      
      const output = execSync(cmd, { 
        encoding: 'utf-8',
        env: { ...process.env },
        timeout: 120000,
      });

      const mediaMatch = output.match(/MEDIA:(.+)/);
      const mediaPath = mediaMatch ? mediaMatch[1].trim() : outputPath;

      return {
        success: true,
        message: `✅ Image edited!`,
        data: {
          path: mediaPath,
          filename,
          resolution,
          inputImage: params.inputImage,
          prompt: params.prompt,
        },
        cost: {
          usd: 0.025, // Image editing costs slightly more
          provider: 'gemini',
          units: 1,
          unitType: 'images',
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Image editing failed: ${err.message || String(err)}`,
      };
    }
  },
};

// ============ Generate Marketing Visual ============
export const generateMarketingVisualTool: Tool = {
  name: 'generate_marketing_visual',
  description: 'Generate a marketing-optimized visual for social media, ads, or campaigns. Handles aspect ratios and platform requirements.',
  parameters: {
    type: 'object',
    properties: {
      concept: { 
        type: 'string', 
        description: 'What the visual should convey (e.g., "app screenshot with happy user", "product hero shot")' 
      },
      platform: { 
        type: 'string', 
        enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'appstore', 'general'],
        description: 'Target platform (affects aspect ratio recommendations)' 
      },
      productId: { 
        type: 'string', 
        description: 'Product ID for brand context' 
      },
      mood: {
        type: 'string',
        description: 'Visual mood (e.g., "professional", "playful", "minimalist", "bold")'
      },
    },
    required: ['concept'],
  },

  async execute(params): Promise<ToolResult> {
    // Build an optimized prompt based on platform and concept
    const platformGuides: Record<string, string> = {
      twitter: 'horizontal composition, 16:9 aspect ratio, eye-catching, works at small sizes',
      linkedin: 'professional, clean, corporate-friendly, 1200x627 optimized',
      instagram: 'square composition, vibrant colors, mobile-first design',
      facebook: 'engaging, shareable, works with text overlay',
      appstore: 'clean app screenshot style, device mockup friendly',
      general: 'versatile composition, balanced layout',
    };

    const platform = params.platform || 'general';
    const platformHint = platformGuides[platform];
    const mood = params.mood || 'professional and modern';

    const enhancedPrompt = `Marketing visual: ${params.concept}. ${platformHint}. Mood: ${mood}. High quality, suitable for ${platform} marketing.`;

    // Delegate to generate_image
    return generateImageTool.execute({
      prompt: enhancedPrompt,
      filename: generateFilename(`${platform}-marketing`),
      resolution: '2K',
    });
  },
};

// ============ List Generated Images ============
export const listGeneratedImagesTool: Tool = {
  name: 'list_generated_images',
  description: 'List recently generated images',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max images to list (default: 10)' },
    },
  },

  async execute(params): Promise<ToolResult> {
    const { readdirSync, statSync } = await import('fs');
    
    ensureOutputDir();
    
    try {
      const files = readdirSync(OUTPUT_DIR)
        .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
        .map(f => ({
          name: f,
          path: path.join(OUTPUT_DIR, f),
          created: statSync(path.join(OUTPUT_DIR, f)).mtime,
        }))
        .sort((a, b) => b.created.getTime() - a.created.getTime())
        .slice(0, params.limit || 10);

      if (files.length === 0) {
        return {
          success: true,
          message: 'No generated images found.',
          data: [],
        };
      }

      return {
        success: true,
        message: `Found ${files.length} image(s).`,
        data: files.map(f => ({
          filename: f.name,
          path: f.path,
          created: f.created.toISOString(),
        })),
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to list images: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ============ Get Image Path ============
export const getImagePathTool: Tool = {
  name: 'get_image_path',
  description: 'Get the full path to a generated image so it can be sent. Use this when user asks to see/show an image.',
  parameters: {
    type: 'object',
    properties: {
      filename: { 
        type: 'string', 
        description: 'Image filename (or "latest" for most recent)' 
      },
    },
    required: ['filename'],
  },

  async execute(params): Promise<ToolResult> {
    const { readdirSync, statSync, existsSync: fsExists } = await import('fs');
    
    ensureOutputDir();

    let imagePath: string;

    if (params.filename === 'latest') {
      // Get most recent image
      const files = readdirSync(OUTPUT_DIR)
        .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
        .map(f => ({
          name: f,
          path: path.join(OUTPUT_DIR, f),
          created: statSync(path.join(OUTPUT_DIR, f)).mtime,
        }))
        .sort((a, b) => b.created.getTime() - a.created.getTime());

      if (files.length === 0) {
        return {
          success: false,
          message: 'No generated images found.',
        };
      }

      imagePath = files[0].path;
    } else {
      imagePath = params.filename.startsWith('/') 
        ? params.filename 
        : path.join(OUTPUT_DIR, params.filename);
    }

    if (!fsExists(imagePath)) {
      return {
        success: false,
        message: `Image not found: ${imagePath}`,
      };
    }

    return {
      success: true,
      message: `SEND_IMAGE:${imagePath}`,
      data: { 
        path: imagePath,
        sendable: true,
      },
    };
  },
};

// ============ Export All ============
export const imageTools: Tool[] = [
  generateImageTool,
  editImageTool,
  generateMarketingVisualTool,
  listGeneratedImagesTool,
  getImagePathTool,
];
