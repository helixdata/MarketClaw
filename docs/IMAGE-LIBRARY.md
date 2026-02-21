# Product Image Library

The Product Image Library provides organized storage and semantic search for product marketing images, screenshots, logos, and other visual assets.

## Overview

Each product gets its own image library stored at:
```
~/.marketclaw/workspace/products/{productId}/images/
├── images.json         # Metadata index
├── vectors/            # Semantic search embeddings
├── img_abc123.png      # Actual image files
├── img_def456.jpg
└── ...
```

## Features

- **Organized Storage**: Images are copied to the product library with unique IDs
- **Metadata Tracking**: Name, description, tags, type, dimensions, size
- **Semantic Search**: Find images using natural language queries
- **URL Support**: Add images directly from URLs (automatically downloaded)
- **Dimension Detection**: Automatic width/height detection on import

## Image Types

| Type | Description |
|------|-------------|
| `screenshot` | App/product screenshots |
| `logo` | Brand logos |
| `icon` | App icons, favicons |
| `hero` | Hero images for landing pages, app stores |
| `social` | Social media graphics |
| `product-shot` | Product photography |
| `banner` | Banner ads, promotional banners |
| `thumbnail` | Small preview images |
| `other` | Miscellaneous images |

## Tools

### add_product_image

Add an image to the library from a local file or URL.

**Parameters:**
- `source` (required): Local file path or URL
- `name` (required): Display name for the image
- `productId`: Product ID (uses active product if not specified)
- `description`: Description of the image
- `tags`: Comma-separated tags
- `type`: Image type (see types above)

**Examples:**

```
# Add from local file
add_product_image source="/path/to/screenshot.png" name="App Store Hero" description="iPhone showing main dashboard" tags="app-store,hero,iphone" type="screenshot"

# Add from URL
add_product_image source="https://example.com/logo.png" name="Company Logo" type="logo"

# Minimal (uses active product, defaults type to "other")
add_product_image source="/path/to/image.png" name="Quick Upload"
```

### search_product_images

Search images using semantic search on name, description, and tags.

**Parameters:**
- `query` (required): Search query
- `productId`: Product ID (uses active product if not specified)
- `limit`: Max results (default: 5)

**Examples:**

```
# Search for iPhone screenshots
search_product_images query="iPhone screenshots"

# Search with natural language
search_product_images query="mockup showing the check-in feature"

# Search specific product with limit
search_product_images productId="proofping" query="app store" limit=10
```

### list_product_images

List all images with optional filters.

**Parameters:**
- `productId`: Product ID (uses active product if not specified)
- `type`: Filter by image type
- `tags`: Comma-separated tags to filter by

**Examples:**

```
# List all images
list_product_images productId="proofping"

# Filter by type
list_product_images type="screenshot"

# Filter by tags
list_product_images tags="hero,app-store"

# Combine filters
list_product_images type="screenshot" tags="iphone"
```

### get_product_image

Get detailed information about a specific image.

**Parameters:**
- `imageId` (required): Image ID (e.g., `img_abc123`)
- `productId`: Product ID (uses active product if not specified)

**Example:**

```
get_product_image imageId="img_abc123"
```

### update_product_image

Update image metadata.

**Parameters:**
- `imageId` (required): Image ID to update
- `productId`: Product ID (uses active product if not specified)
- `name`: New display name
- `description`: New description
- `tags`: New comma-separated tags (replaces existing)
- `type`: New image type

**Examples:**

```
# Update name only
update_product_image imageId="img_abc123" name="New Name"

# Update multiple fields
update_product_image imageId="img_abc123" name="Updated Hero" description="New description" tags="updated,tags" type="hero"
```

### delete_product_image

Delete an image from the library.

**Parameters:**
- `imageId` (required): Image ID to delete
- `productId`: Product ID (uses active product if not specified)

**Example:**

```
delete_product_image imageId="img_abc123"
```

## Programmatic Usage

```typescript
import { imageLibrary } from './images/index.js';

// Initialize (required for semantic search)
await imageLibrary.init(process.env.OPENAI_API_KEY);

// Add image
const image = await imageLibrary.addImage('proofping', '/path/to/image.png', {
  name: 'App Store Hero',
  description: 'iPhone mockup',
  tags: ['app-store', 'hero'],
  type: 'screenshot',
});

// Search
const results = await imageLibrary.searchImages('proofping', 'iPhone mockup', 5);

// List with filters
const screenshots = await imageLibrary.listImages('proofping', { type: 'screenshot' });

// Get path for use
const imagePath = await imageLibrary.getImagePath('proofping', 'img_abc123');

// Update
await imageLibrary.updateImage('proofping', 'img_abc123', {
  name: 'Updated Name',
  tags: ['new', 'tags'],
});

// Delete
await imageLibrary.deleteImage('proofping', 'img_abc123');
```

## ProductImage Schema

```typescript
interface ProductImage {
  id: string;                    // img_abc123
  productId: string;
  filename: string;              // img_abc123.png
  path: string;                  // Full local path
  url?: string;                  // Original URL if downloaded
  name: string;                  // Display name
  description?: string;          // Description
  tags: string[];                // Tags for categorization
  type: ImageType;               // screenshot, logo, hero, etc.
  mimeType: string;              // image/png
  size: number;                  // Size in bytes
  dimensions?: {
    width: number;
    height: number;
  };
  uploadedAt: number;            // Timestamp
  updatedAt: number;             // Timestamp
}
```

## Semantic Search

The image library uses OpenAI embeddings for semantic search. When you search for "iPhone dashboard screenshot", it will find images with similar meaning even if the exact words don't match.

The search creates embeddings from:
- Image name
- Description
- Tags
- Type

If semantic search fails (no API key, network error), it falls back to text-based matching on name, tags, and description.

## Supported Formats

- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- GIF (`.gif`)
- WebP (`.webp`)
- SVG (`.svg`)
- BMP (`.bmp`)
- ICO (`.ico`)

## Best Practices

1. **Use descriptive names**: "App Store Hero Shot - iPhone 15 Pro" is better than "image1"
2. **Add tags**: Makes filtering and searching much easier
3. **Set correct type**: Helps organize and filter images
4. **Write descriptions**: Improves semantic search accuracy
5. **Use consistent naming**: E.g., all App Store screenshots tagged with "app-store"

## Storage Considerations

- Images are **copied** to the library (original files are not modified)
- Each image gets a unique ID-based filename to avoid conflicts
- Metadata is stored in `images.json` (JSON format, human-readable)
- Vector embeddings stored in `vectors/` directory (Vectra format)
