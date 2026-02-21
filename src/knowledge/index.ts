/**
 * Product Knowledge Base
 * Vectra-powered semantic search for per-product second brain
 * 
 * Each product gets its own vector index + markdown knowledge base
 */

import { LocalIndex } from 'vectra';
import OpenAI from 'openai';
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import crypto from 'crypto';

// Embedding config
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 1000;  // chars per chunk
const CHUNK_OVERLAP = 200;

export interface KnowledgeItem {
  id: string;
  content: string;
  metadata: {
    productId: string;
    file: string;
    section?: string;
    type: 'voice' | 'research' | 'learning' | 'asset' | 'history' | 'general';
    updatedAt: number;
  };
}

export interface SearchResult {
  content: string;
  file: string;
  section?: string;
  score: number;
}

type KnowledgeMetadata = Record<string, string | number | boolean>;

export class ProductKnowledge {
  private workspacePath: string;
  private openai: OpenAI | null = null;
  private indexes: Map<string, LocalIndex<KnowledgeMetadata>> = new Map();

  constructor(workspace?: string) {
    this.workspacePath = workspace || path.join(homedir(), '.marketclaw', 'workspace');
  }

  /**
   * Initialize OpenAI client for embeddings
   */
  async init(apiKey?: string): Promise<void> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (key) {
      this.openai = new OpenAI({ apiKey: key });
    }
  }

  /**
   * Get the knowledge base path for a product
   */
  private getProductPath(productId: string): string {
    return path.join(this.workspacePath, 'products', productId);
  }

  /**
   * Get or create the vector index for a product
   */
  private async getIndex(productId: string): Promise<LocalIndex<KnowledgeMetadata>> {
    if (this.indexes.has(productId)) {
      return this.indexes.get(productId)!;
    }

    const indexPath = path.join(this.getProductPath(productId), 'vectors');
    const index = new LocalIndex<KnowledgeMetadata>(indexPath);

    if (!await index.isIndexCreated()) {
      await index.createIndex();
    }

    this.indexes.set(productId, index);
    return index;
  }

  /**
   * Generate embedding for text
   */
  private async embed(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Call init() with API key first.');
    }

    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Chunk text into smaller pieces for embedding
   */
  private chunkText(text: string, metadata: { file: string }): { content: string; section?: string }[] {
    const chunks: { content: string; section?: string }[] = [];
    
    // Try to split by headers first
    const sections = text.split(/^(#{1,3}\s+.+)$/gm);
    
    if (sections.length > 1) {
      let currentSection = '';
      let currentContent = '';
      
      for (const part of sections) {
        if (part.match(/^#{1,3}\s+/)) {
          // This is a header
          if (currentContent.trim()) {
            chunks.push({ content: currentContent.trim(), section: currentSection || undefined });
          }
          currentSection = part.replace(/^#{1,3}\s+/, '').trim();
          currentContent = part + '\n';
        } else {
          currentContent += part;
        }
      }
      
      if (currentContent.trim()) {
        chunks.push({ content: currentContent.trim(), section: currentSection || undefined });
      }
    } else {
      // No headers, chunk by size
      for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        const chunk = text.slice(i, i + CHUNK_SIZE);
        if (chunk.trim()) {
          chunks.push({ content: chunk.trim() });
        }
      }
    }

    // Further split any chunks that are too large
    const finalChunks: { content: string; section?: string }[] = [];
    for (const chunk of chunks) {
      if (chunk.content.length > CHUNK_SIZE * 2) {
        for (let i = 0; i < chunk.content.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          const subChunk = chunk.content.slice(i, i + CHUNK_SIZE);
          if (subChunk.trim()) {
            finalChunks.push({ content: subChunk.trim(), section: chunk.section });
          }
        }
      } else {
        finalChunks.push(chunk);
      }
    }

    return finalChunks;
  }

  /**
   * Determine the type of knowledge from file path
   */
  private getKnowledgeType(filePath: string): KnowledgeItem['metadata']['type'] {
    const lower = filePath.toLowerCase();
    if (lower.includes('voice')) return 'voice';
    if (lower.includes('research') || lower.includes('competitor') || lower.includes('audience')) return 'research';
    if (lower.includes('learning') || lower.includes('works') || lower.includes('flop')) return 'learning';
    if (lower.includes('asset') || lower.includes('message') || lower.includes('hook') || lower.includes('hashtag')) return 'asset';
    if (lower.includes('history') || lower.match(/\d{4}-\d{2}/)) return 'history';
    return 'general';
  }

  /**
   * Index a single file for a product
   */
  async indexFile(productId: string, filePath: string): Promise<number> {
    const fullPath = path.join(this.getProductPath(productId), filePath);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = await readFile(fullPath, 'utf-8');
    const chunks = this.chunkText(content, { file: filePath });
    const index = await this.getIndex(productId);
    const type = this.getKnowledgeType(filePath);
    const now = Date.now();

    let indexed = 0;
    for (const chunk of chunks) {
      const id = crypto.createHash('md5').update(`${productId}:${filePath}:${chunk.content.slice(0, 100)}`).digest('hex');
      
      try {
        const vector = await this.embed(chunk.content);
        await index.upsertItem({
          id,
          vector,
          metadata: {
            productId,
            file: filePath,
            section: chunk.section || '',
            type,
            updatedAt: now,
            content: chunk.content,
          },
        });
        indexed++;
      } catch (err) {
        console.error(`Failed to index chunk from ${filePath}:`, err);
      }
    }

    return indexed;
  }

  /**
   * Index all markdown files for a product
   */
  async indexProduct(productId: string): Promise<{ files: number; chunks: number }> {
    const productPath = this.getProductPath(productId);
    if (!existsSync(productPath)) {
      return { files: 0, chunks: 0 };
    }

    let totalFiles = 0;
    let totalChunks = 0;

    const processDir = async (dir: string, prefix: string = '') => {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        
        if (entry.isDirectory() && entry.name !== 'vectors') {
          await processDir(fullPath, relativePath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const chunks = await this.indexFile(productId, relativePath);
          totalFiles++;
          totalChunks += chunks;
        }
      }
    };

    await processDir(productPath);
    return { files: totalFiles, chunks: totalChunks };
  }

  /**
   * Search the knowledge base for a product
   */
  async search(productId: string, query: string, limit: number = 5): Promise<SearchResult[]> {
    const index = await this.getIndex(productId);
    
    if (!await index.isIndexCreated()) {
      return [];
    }

    const queryVector = await this.embed(query);
    const results = await index.queryItems(queryVector, query, limit);

    return results.map(r => ({
      content: (r.item.metadata as any).content || '',
      file: (r.item.metadata as any).file || '',
      section: (r.item.metadata as any).section,
      score: r.score,
    }));
  }

  /**
   * Search across all products
   */
  async searchAll(query: string, limit: number = 5): Promise<(SearchResult & { productId: string })[]> {
    const productsDir = path.join(this.workspacePath, 'products');
    if (!existsSync(productsDir)) {
      return [];
    }

    const products = await readdir(productsDir);
    const allResults: (SearchResult & { productId: string })[] = [];

    for (const productId of products) {
      const productPath = path.join(productsDir, productId);
      const stats = await stat(productPath);
      if (!stats.isDirectory()) continue;

      try {
        const results = await this.search(productId, query, limit);
        allResults.push(...results.map(r => ({ ...r, productId })));
      } catch (err) {
        // Skip products without indexes
      }
    }

    // Sort by score and take top results
    return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Add knowledge to a product (creates/appends to appropriate file)
   */
  async addKnowledge(productId: string, params: {
    type: 'voice' | 'research' | 'learning' | 'asset';
    category?: string;
    content: string;
  }): Promise<string> {
    const productPath = this.getProductPath(productId);
    await mkdir(productPath, { recursive: true });

    // Determine file path based on type
    let filePath: string;
    switch (params.type) {
      case 'voice':
        filePath = 'VOICE.md';
        break;
      case 'research':
        await mkdir(path.join(productPath, 'research'), { recursive: true });
        filePath = `research/${params.category || 'notes'}.md`;
        break;
      case 'learning':
        await mkdir(path.join(productPath, 'learnings'), { recursive: true });
        filePath = `learnings/${params.category || 'insights'}.md`;
        break;
      case 'asset':
        await mkdir(path.join(productPath, 'assets'), { recursive: true });
        filePath = `assets/${params.category || 'general'}.md`;
        break;
    }

    const fullPath = path.join(productPath, filePath);
    
    // Append to existing or create new
    let existing = '';
    if (existsSync(fullPath)) {
      existing = await readFile(fullPath, 'utf-8');
      if (!existing.endsWith('\n')) existing += '\n';
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const entry = `\n## ${timestamp}\n${params.content}\n`;
    
    await writeFile(fullPath, existing + entry);

    // Re-index the file
    await this.indexFile(productId, filePath);

    return filePath;
  }

  /**
   * Build context from knowledge base for AI prompt
   */
  async buildContext(productId: string, query?: string, maxChars: number = 4000): Promise<string> {
    const parts: string[] = [];
    let charCount = 0;

    // If we have a query, do semantic search
    if (query) {
      const results = await this.search(productId, query, 10);
      
      for (const result of results) {
        if (charCount + result.content.length > maxChars) break;
        
        const header = result.section 
          ? `### ${result.file} > ${result.section}` 
          : `### ${result.file}`;
        parts.push(`${header}\n${result.content}`);
        charCount += result.content.length;
      }
    }

    // Always include VOICE.md if it exists and we have room
    const voicePath = path.join(this.getProductPath(productId), 'VOICE.md');
    if (existsSync(voicePath) && charCount < maxChars - 500) {
      const voice = await readFile(voicePath, 'utf-8');
      if (voice.length < maxChars - charCount) {
        parts.unshift(`### Brand Voice\n${voice}`);
      }
    }

    return parts.join('\n\n---\n\n');
  }
}

// Singleton
export const knowledge = new ProductKnowledge();
