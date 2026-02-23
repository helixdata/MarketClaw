## Raw Concept
**Task:**
Document the brand identity management system and tools

**Files:**
- src/tools/brand-tools.ts
- docs/BRAND.md
- src/memory/index.ts

**Flow:**
Agent Core -> set_brand_voice/colors -> memory.saveProduct -> Persistent Brand Context -> Content Generation

**Timestamp:** 2026-02-23

## Narrative
### Structure
The Brand Identity system allows per-product customization of visual and verbal guidelines. Identity data is stored within the `Product` model in the persistent memory workspace.

### Features
Management of brand colors (primary, secondary, custom), voice and tone (personality, style), taglines/slogans, visual assets (logos, icons), and typography.

### Rules
1. Brand identity is used to generate on-brand content and maintain consistent messaging.
2. Most tools merge with existing data by default unless `merge: false` is specified.
3. The `productId` is optional if an active product is set in the agent state.
4. Taglines can be managed as a collection using the `add: true` parameter.

### Examples
Brand Identity Tools:
| Tool Name | Description |
| :--- | :--- |
| `set_brand_colors` | Set primary, secondary, accent, and custom brand colors |
| `set_brand_voice` | Define tone, personality, style, and free-form guidelines |
| `set_brand_tagline` | Add or replace product taglines and slogans |
| `set_brand_asset` | Manage URLs for logos, icons, and custom visual assets |
| `set_brand_typography` | Set heading/body fonts and usage guidelines |
| `get_product_brand` | Retrieve the complete brand identity object for a product |
| `clear_brand_section` | Remove specific sections (e.g., "colors") or the entire brand identity |
