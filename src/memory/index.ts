/**
 * Persistent Memory System
 * Context that never gets lost across sessions
 * 
 * Architecture:
 * - BRAND.md: Voice, positioning, values (like SOUL.md)
 * - PRODUCTS/: Product-specific context (features, audience, messaging)
 * - CAMPAIGNS/: Campaign history, what worked, analytics
 * - sessions/: Conversation transcripts
 * - state.json: Runtime state
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

export interface ProductBrand {
  colors?: {
    primary?: string;      // e.g., "#FF6B35"
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    [key: string]: string | undefined;  // allow custom color names
  };
  voice?: {
    tone?: string;         // e.g., "warm", "professional", "playful"
    personality?: string;  // e.g., "friendly expert", "trusted advisor"
    style?: string;        // e.g., "casual", "formal", "conversational"
    guidelines?: string;   // free-form voice guidelines
  };
  typography?: {
    headingFont?: string;
    bodyFont?: string;
    guidelines?: string;
  };
  taglines?: string[];     // multiple taglines/slogans
  assets?: {
    logo?: string;         // URL
    logoAlt?: string;
    icon?: string;
    [key: string]: string | undefined;
  };
}

export interface Product {
  id: string;
  name: string;
  tagline?: string;
  description: string;
  features: string[];
  audience: string[];
  positioning?: string;
  competitors?: string[];
  links?: Record<string, string>;
  brand?: ProductBrand;
  createdAt: number;
  updatedAt: number;
}

export interface Campaign {
  id: string;
  productId: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  channels: string[];
  startDate?: number;
  endDate?: number;
  posts: CampaignPost[];
  metrics?: CampaignMetrics;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CampaignPost {
  id: string;
  channel: string;
  content: string;
  scheduledAt?: number;
  publishedAt?: number;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  externalId?: string;
  externalUrl?: string;
  metrics?: {
    impressions?: number;
    clicks?: number;
    likes?: number;
    shares?: number;
    comments?: number;
  };
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  engagement: number;
  conversions?: number;
}

export interface MemoryState {
  activeProduct?: string;
  activeCampaign?: string;
  lastInteraction: number;
  preferences: Record<string, any>;
}

export class Memory {
  private workspacePath: string;

  constructor(workspace?: string) {
    this.workspacePath = workspace || path.join(homedir(), '.marketclaw', 'workspace');
  }

  private async ensureDirs(): Promise<void> {
    const dirs = [
      this.workspacePath,
      path.join(this.workspacePath, 'products'),
      path.join(this.workspacePath, 'campaigns'),
      path.join(this.workspacePath, 'sessions'),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }
  }

  // ========== Brand ==========

  async getBrand(): Promise<string | null> {
    const brandPath = path.join(this.workspacePath, 'BRAND.md');
    if (!existsSync(brandPath)) return null;
    return readFile(brandPath, 'utf-8');
  }

  async setBrand(content: string): Promise<void> {
    await this.ensureDirs();
    await writeFile(path.join(this.workspacePath, 'BRAND.md'), content);
  }

  // ========== Products ==========

  async getProduct(id: string): Promise<Product | null> {
    const productPath = path.join(this.workspacePath, 'products', `${id}.json`);
    if (!existsSync(productPath)) return null;
    const data = await readFile(productPath, 'utf-8');
    return JSON.parse(data);
  }

  async saveProduct(product: Product): Promise<void> {
    await this.ensureDirs();
    product.updatedAt = Date.now();
    if (!product.createdAt) product.createdAt = Date.now();
    await writeFile(
      path.join(this.workspacePath, 'products', `${product.id}.json`),
      JSON.stringify(product, null, 2)
    );
  }

  async listProducts(): Promise<Product[]> {
    await this.ensureDirs();
    const productsDir = path.join(this.workspacePath, 'products');
    const files = await readdir(productsDir);
    
    const products: Product[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await readFile(path.join(productsDir, file), 'utf-8');
        products.push(JSON.parse(data));
      }
    }
    return products;
  }

  // ========== Campaigns ==========

  async getCampaign(id: string): Promise<Campaign | null> {
    const campaignPath = path.join(this.workspacePath, 'campaigns', `${id}.json`);
    if (!existsSync(campaignPath)) return null;
    const data = await readFile(campaignPath, 'utf-8');
    return JSON.parse(data);
  }

  async saveCampaign(campaign: Campaign): Promise<void> {
    await this.ensureDirs();
    campaign.updatedAt = Date.now();
    if (!campaign.createdAt) campaign.createdAt = Date.now();
    await writeFile(
      path.join(this.workspacePath, 'campaigns', `${campaign.id}.json`),
      JSON.stringify(campaign, null, 2)
    );
  }

  async listCampaigns(productId?: string): Promise<Campaign[]> {
    await this.ensureDirs();
    const campaignsDir = path.join(this.workspacePath, 'campaigns');
    const files = await readdir(campaignsDir);
    
    const campaigns: Campaign[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await readFile(path.join(campaignsDir, file), 'utf-8');
        const campaign = JSON.parse(data);
        if (!productId || campaign.productId === productId) {
          campaigns.push(campaign);
        }
      }
    }
    return campaigns;
  }

  // ========== State ==========

  async getState(): Promise<MemoryState> {
    const statePath = path.join(this.workspacePath, 'state.json');
    if (!existsSync(statePath)) {
      return {
        lastInteraction: Date.now(),
        preferences: {},
      };
    }
    const data = await readFile(statePath, 'utf-8');
    return JSON.parse(data);
  }

  async saveState(state: MemoryState): Promise<void> {
    await this.ensureDirs();
    state.lastInteraction = Date.now();
    await writeFile(
      path.join(this.workspacePath, 'state.json'),
      JSON.stringify(state, null, 2)
    );
  }

  // ========== Sessions ==========

  async appendToSession(sessionId: string, entry: any): Promise<void> {
    await this.ensureDirs();
    const sessionPath = path.join(this.workspacePath, 'sessions', `${sessionId}.jsonl`);
    const line = JSON.stringify({ ...entry, timestamp: Date.now() }) + '\n';
    
    if (existsSync(sessionPath)) {
      const existing = await readFile(sessionPath, 'utf-8');
      await writeFile(sessionPath, existing + line);
    } else {
      await writeFile(sessionPath, line);
    }
  }

  async getSession(sessionId: string): Promise<any[]> {
    const sessionPath = path.join(this.workspacePath, 'sessions', `${sessionId}.jsonl`);
    if (!existsSync(sessionPath)) return [];
    
    const data = await readFile(sessionPath, 'utf-8');
    return data.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  }

  // ========== Context Building ==========

  /**
   * Build full context for the AI agent
   */
  async buildContext(): Promise<string> {
    const parts: string[] = [];

    // Brand context
    const brand = await this.getBrand();
    if (brand) {
      parts.push('# Brand Identity\n' + brand);
    }

    // Active product
    const state = await this.getState();
    if (state.activeProduct) {
      const product = await this.getProduct(state.activeProduct);
      if (product) {
        parts.push(`# Active Product: ${product.name}\n${JSON.stringify(product, null, 2)}`);
      }
    }

    // Active campaign
    if (state.activeCampaign) {
      const campaign = await this.getCampaign(state.activeCampaign);
      if (campaign) {
        parts.push(`# Active Campaign: ${campaign.name}\n${JSON.stringify(campaign, null, 2)}`);
      }
    }

    // Products summary
    const products = await this.listProducts();
    if (products.length > 0) {
      parts.push('# Products\n' + products.map(p => `- ${p.name}: ${p.tagline || p.description.slice(0, 100)}`).join('\n'));
    }

    return parts.join('\n\n---\n\n');
  }
}

// Singleton instance
export const memory = new Memory();
