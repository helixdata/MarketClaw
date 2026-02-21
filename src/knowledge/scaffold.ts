/**
 * Product Second Brain Scaffold
 * Creates the initial knowledge structure for a product
 */

import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

export interface ProductScaffoldOptions {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  workspace?: string;
}

const VOICE_TEMPLATE = (name: string, tagline?: string) => `# ${name} Voice Guide

${tagline ? `> ${tagline}\n` : ''}
## Tone
- Conversational yet professional
- Confident but not arrogant
- Clear and direct

## Key Messages
1. [Primary value proposition]
2. [Secondary benefit]
3. [Differentiator]

## Words We Use
- 

## Words We Avoid
- 

## Example Posts
### Twitter
> 

### LinkedIn
> 
`;

const PRODUCT_TEMPLATE = (name: string, description?: string) => `# ${name}

${description || '[Product description]'}

## What It Does
[Core functionality]

## Who It's For
- [Primary audience]
- [Secondary audience]

## Key Features
1. 
2. 
3. 

## Pricing
[Pricing model]

## Links
- Website: 
- App Store: 
- Play Store: 
`;

const COMPETITORS_TEMPLATE = `# Competitor Analysis

## Direct Competitors

### [Competitor 1]
- **What they do:** 
- **Pricing:** 
- **Strengths:** 
- **Weaknesses:** 
- **Our advantage:** 

## Indirect Competitors

### [Alternative Solution]
- **What they do:** 
- **Why people use them:** 
- **Our differentiator:** 
`;

const AUDIENCE_TEMPLATE = `# Audience Insights

## Primary Persona

### [Persona Name]
- **Demographics:** 
- **Pain points:** 
- **Goals:** 
- **Where they hang out:** 
- **How they discover products:** 

## What Resonates
- 

## What Doesn't Work
- 
`;

const WHAT_WORKS_TEMPLATE = `# What Works

Track posts and campaigns that performed well.

## Format
For each entry, capture:
- **Post/Campaign:** What was it?
- **Channel:** Where was it posted?
- **Performance:** Metrics (engagement, clicks, etc.)
- **Why it worked:** Your analysis
- **Reusable elements:** What to repeat

---

`;

const KEY_MESSAGES_TEMPLATE = `# Key Messages

Approved talking points and hooks.

## One-Liners
- 

## Value Props
1. 
2. 
3. 

## Social Proof
- 

## CTAs
- 
`;

export async function scaffoldProduct(options: ProductScaffoldOptions): Promise<string[]> {
  const workspace = options.workspace || path.join(homedir(), '.marketclaw', 'workspace');
  const productPath = path.join(workspace, 'products', options.id);
  const created: string[] = [];

  // Create directory structure
  const dirs = [
    productPath,
    path.join(productPath, 'research'),
    path.join(productPath, 'learnings'),
    path.join(productPath, 'assets'),
    path.join(productPath, 'history'),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  // Create template files
  const files: [string, string][] = [
    ['PRODUCT.md', PRODUCT_TEMPLATE(options.name, options.description)],
    ['VOICE.md', VOICE_TEMPLATE(options.name, options.tagline)],
    ['research/competitors.md', COMPETITORS_TEMPLATE],
    ['research/audience.md', AUDIENCE_TEMPLATE],
    ['learnings/what-works.md', WHAT_WORKS_TEMPLATE],
    ['assets/key-messages.md', KEY_MESSAGES_TEMPLATE],
  ];

  for (const [filename, content] of files) {
    const filePath = path.join(productPath, filename);
    if (!existsSync(filePath)) {
      await writeFile(filePath, content);
      created.push(filename);
    }
  }

  return created;
}
