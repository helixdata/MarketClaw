/**
 * Product Image Library Types
 */

export interface ProductImage {
  id: string;                    // img_abc123
  productId: string;
  filename: string;              // hero-shot-01.png
  path: string;                  // full local path
  url?: string;                  // external URL if applicable
  name: string;                  // "App Store Hero"
  description?: string;          // "iPhone mockup showing main dashboard"
  tags: string[];                // ["app-store", "hero", "iphone"]
  type: ImageType;
  mimeType: string;              // image/png
  size: number;                  // bytes
  dimensions?: {
    width: number;
    height: number;
  };
  uploadedAt: number;
  updatedAt: number;
}

export type ImageType = 
  | 'screenshot'
  | 'logo'
  | 'icon'
  | 'hero'
  | 'social'
  | 'product-shot'
  | 'banner'
  | 'thumbnail'
  | 'other';

export interface ImageSearchResult {
  image: ProductImage;
  score: number;
  matchType: 'semantic' | 'tag' | 'name';
}

export interface ImageFilters {
  type?: ImageType;
  tags?: string[];
}

export interface ImageMetadataInput {
  name: string;
  description?: string;
  tags?: string[];
  type?: ImageType;
  url?: string;  // Original URL if downloaded
}

export interface ImageUpdateInput {
  name?: string;
  description?: string;
  tags?: string[];
  type?: ImageType;
}
