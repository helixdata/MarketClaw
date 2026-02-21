# Brand Identity Tools

MarketClaw supports comprehensive brand identity management for products. Each product can have its own brand identity including colors, voice, taglines, typography, and visual assets.

## Overview

Brand identity is stored as part of the product data and can be used to:
- Generate on-brand content and copy
- Maintain consistent messaging across channels
- Store visual guidelines for image generation
- Define voice and tone for AI-generated content

## Tools

### set_brand_colors

Set brand colors for a product. Supports standard color slots (primary, secondary, accent, background, text) and custom color names.

```
set_brand_colors productId="proofping" primary="#FF6B35" secondary="#2D3047" accent="#00D9C0"
```

**Parameters:**
- `productId` - Product ID (uses active product if not specified)
- `primary` - Primary brand color (e.g., "#FF6B35")
- `secondary` - Secondary brand color
- `accent` - Accent color for CTAs, highlights
- `background` - Background color
- `text` - Text color
- `custom` - Object with additional custom colors (e.g., `{"cta": "#00FF00", "warning": "#FF0000"}`)
- `merge` - Merge with existing colors (default: true). Set false to replace all.

### set_brand_voice

Set the voice and tone guidelines for product communications.

```
set_brand_voice productId="proofping" tone="warm" personality="reassuring friend" style="conversational"
```

**Parameters:**
- `productId` - Product ID (uses active product if not specified)
- `tone` - Voice tone (e.g., "warm", "professional", "playful", "authoritative")
- `personality` - Brand personality (e.g., "friendly expert", "trusted advisor")
- `style` - Communication style (e.g., "casual", "formal", "conversational")
- `guidelines` - Free-form voice guidelines
- `merge` - Merge with existing voice settings (default: true)

### set_brand_tagline

Add or replace taglines/slogans for a product. Products can have multiple taglines.

```
set_brand_tagline productId="proofping" tagline="Someone's always got your back"
```

Add additional taglines:
```
set_brand_tagline productId="proofping" tagline="Peace of mind, every check-in" add=true
```

Set multiple at once:
```
set_brand_tagline productId="proofping" taglines='["Tagline one", "Tagline two"]'
```

**Parameters:**
- `productId` - Product ID (uses active product if not specified)
- `tagline` - Single tagline to add
- `taglines` - Array of multiple taglines to set
- `add` - Add to existing taglines (default: false = replace all)

### set_brand_asset

Set visual asset URLs (logos, icons, etc.) for a product.

```
set_brand_asset productId="proofping" logo="https://example.com/logo.png" icon="https://example.com/icon.png"
```

**Parameters:**
- `productId` - Product ID (uses active product if not specified)
- `logo` - Primary logo URL
- `logoAlt` - Alternative/small logo URL
- `icon` - Icon/favicon URL
- `custom` - Object with additional custom assets (e.g., `{"banner": "https://...", "hero": "https://..."}`)
- `merge` - Merge with existing assets (default: true)

### set_brand_typography

Set typography guidelines for a product.

```
set_brand_typography productId="proofping" headingFont="Inter" bodyFont="Open Sans"
```

**Parameters:**
- `productId` - Product ID (uses active product if not specified)
- `headingFont` - Font for headings (e.g., "Inter", "Playfair Display")
- `bodyFont` - Font for body text
- `guidelines` - Typography usage guidelines
- `merge` - Merge with existing typography (default: true)

### get_product_brand

Retrieve all brand identity information for a product.

```
get_product_brand productId="proofping"
```

**Parameters:**
- `productId` - Product ID (uses active product if not specified)

**Returns:**
- Complete brand object with colors, voice, taglines, assets, and typography

### clear_brand_section

Clear a specific section of brand identity or the entire brand.

```
clear_brand_section productId="proofping" section="colors"
```

**Parameters:**
- `productId` - Product ID (uses active product if not specified)
- `section` - Section to clear: `colors`, `voice`, `taglines`, `assets`, `typography`, or `all`

## Data Structure

The brand identity is stored in the Product interface:

```typescript
interface ProductBrand {
  colors?: {
    primary?: string;      // e.g., "#FF6B35"
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    [key: string]: string | undefined;  // custom colors
  };
  voice?: {
    tone?: string;         // e.g., "warm", "professional"
    personality?: string;  // e.g., "friendly expert"
    style?: string;        // e.g., "casual", "formal"
    guidelines?: string;   // free-form guidelines
  };
  typography?: {
    headingFont?: string;
    bodyFont?: string;
    guidelines?: string;
  };
  taglines?: string[];     // multiple taglines/slogans
  assets?: {
    logo?: string;
    logoAlt?: string;
    icon?: string;
    [key: string]: string | undefined;  // custom assets
  };
}
```

## Usage Tips

1. **Start with basics**: Set primary color and voice tone first
2. **Use active product**: If you've set an active product, you can omit `productId`
3. **Merge by default**: All tools merge with existing data unless `merge=false`
4. **Multiple taglines**: Use `add=true` to build up a collection of taglines
5. **Custom fields**: Both colors and assets support custom field names for flexibility

## Example: Complete Brand Setup

```
# Set as active product
select_product productId="proofping"

# Colors
set_brand_colors primary="#FF6B35" secondary="#2D3047" accent="#00D9C0" background="#FAFAFA" text="#333333"

# Voice
set_brand_voice tone="warm" personality="reassuring friend who's always there" style="conversational" guidelines="Use contractions. Keep sentences short. Be empathetic."

# Taglines
set_brand_tagline taglines='["Someone always got your back", "Peace of mind, every check-in", "Never miss a check"]'

# Typography
set_brand_typography headingFont="Inter" bodyFont="Open Sans"

# Assets
set_brand_asset logo="https://cdn.proofping.com/logo.png" icon="https://cdn.proofping.com/icon.png" custom='{"socialCard": "https://cdn.proofping.com/og-image.png"}'

# Verify
get_product_brand
```
