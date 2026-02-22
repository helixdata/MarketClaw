# File Attachments

MarketClaw can generate and send file attachments (PDF, PowerPoint) as part of responses. This is useful for creating reports, presentations, and other documents on demand.

## Overview

The file attachment system allows agents to:
- Generate PDF documents with titles, sections, and formatting
- Create PowerPoint presentations with slides and speaker notes
- Attach files to responses in Telegram, Discord, Slack, and CLI
- Include captions and descriptions with attachments

## Usage

### Generating PDFs

```typescript
import { generatePdf } from './documents/generators/pdf.js';

const buffer = await generatePdf({
  title: 'Weekly Marketing Report',
  content: [
    { heading: 'Summary', body: 'This week saw a 20% increase in engagement...' },
    { heading: 'Key Metrics', body: '• Twitter: 15K impressions\n• LinkedIn: 8K views\n• Email: 45% open rate' },
    { heading: 'Next Steps', body: 'Focus on video content and increase posting frequency.' },
  ],
  author: 'MarketClaw',
});

// Send as attachment
return {
  text: 'Here is your weekly report:',
  attachments: [{
    buffer,
    filename: 'weekly-report.pdf',
    mimeType: 'application/pdf',
    caption: 'Weekly Marketing Report - Week 8',
  }],
};
```

### Generating PowerPoints

```typescript
import { generatePptx } from './documents/generators/pptx.js';

const buffer = await generatePptx({
  title: 'Q1 Marketing Strategy',
  subtitle: 'Building our brand presence',
  slides: [
    {
      title: 'Goals',
      content: [
        'Increase Twitter followers by 50%',
        'Launch LinkedIn content strategy',
        'Build email list to 10K subscribers',
      ],
      notes: 'These are stretch goals but achievable with consistent effort.',
    },
    {
      title: 'Content Pillars',
      content: [
        'Product updates and features',
        'Behind-the-scenes / building in public',
        'Educational content and tips',
        'Customer success stories',
      ],
    },
    {
      title: 'Timeline',
      content: 'January: Twitter focus\nFebruary: LinkedIn launch\nMarch: Email nurture campaigns',
    },
  ],
  author: 'MarketClaw',
  themeColor: '#FF6B35',
});

return {
  text: 'I\'ve created a presentation for your Q1 strategy:',
  attachments: [{
    buffer,
    filename: 'q1-strategy.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    caption: 'Q1 Marketing Strategy Deck',
  }],
};
```

## API Reference

### generatePdf(options)

Generate a PDF document.

**Options:**
| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Optional document title (displayed at top) |
| `content` | `string \| PdfContentSection[]` | Document content (see below) |
| `author` | `string` | Document author metadata (default: 'MarketClaw') |
| `subject` | `string` | Document subject metadata |
| `fontSize` | `number` | Body text font size (default: 12) |
| `headingSize` | `number` | Heading font size (default: 16) |
| `pageNumbers` | `boolean` | Include page numbers (default: true) |
| `includeDate` | `boolean` | Include date under title (default: true) |

**PdfContentSection:**
```typescript
interface PdfContentSection {
  heading?: string;  // Section heading
  body: string;      // Section content (supports • or - bullets)
}
```

**Returns:** `Promise<Buffer>`

### generatePptx(options)

Generate a PowerPoint presentation.

**Options:**
| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Presentation title (creates title slide) |
| `subtitle` | `string` | Subtitle for title slide |
| `slides` | `PptxSlide[]` | Array of content slides |
| `author` | `string` | Author metadata (default: 'MarketClaw') |
| `company` | `string` | Company metadata (default: 'MarketClaw') |
| `subject` | `string` | Subject metadata |
| `themeColor` | `string` | Hex color for theme (default: '#0066cc') |

**PptxSlide:**
```typescript
interface PptxSlide {
  title?: string;              // Slide title
  content: string | string[];  // Bullet points or text
  notes?: string;              // Speaker notes
}
```

**Returns:** `Promise<Buffer>`

## Channel Support

### Telegram
Files are sent as documents using `sendDocument`. Each attachment appears as a separate message after the text response.

### Discord
Files are included in the reply using Discord's file attachment system. Multiple files can be sent in a single message.

### Slack
Files are uploaded using `files.uploadV2` and posted to the thread.

### CLI
Files are saved to a temporary directory (`/tmp/marketclaw-attachments/`) and the path is printed to the console.

## ChannelAttachment Interface

```typescript
interface ChannelAttachment {
  /** File data as Buffer */
  buffer: Buffer;
  
  /** Filename for the attachment */
  filename: string;
  
  /** MIME type */
  mimeType: string;
  
  /** Optional caption/description */
  caption?: string;
}
```

## Common MIME Types

| Format | MIME Type |
|--------|-----------|
| PDF | `application/pdf` |
| PowerPoint | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| CSV | `text/csv` |
| JSON | `application/json` |
| Plain Text | `text/plain` |

## Best Practices

1. **Keep files small** — Large files may fail to upload on some channels
2. **Use descriptive filenames** — Include dates or product names for clarity
3. **Add captions** — Help users understand what the file contains
4. **Handle errors gracefully** — File generation can fail; always have a fallback

## Example: Report Generation Tool

```typescript
// tools/report-tools.ts
export const generateReport = {
  name: 'generate_weekly_report',
  description: 'Generate a PDF report for a product',
  parameters: {
    type: 'object',
    properties: {
      product: { type: 'string', description: 'Product name' },
      period: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
    },
    required: ['product'],
  },
  execute: async ({ product, period = 'weekly' }) => {
    // Gather data...
    const metrics = await getMetrics(product, period);
    
    const buffer = await generatePdf({
      title: `${product} ${period.charAt(0).toUpperCase() + period.slice(1)} Report`,
      content: [
        { heading: 'Summary', body: metrics.summary },
        { heading: 'Social Media', body: formatMetrics(metrics.social) },
        { heading: 'Email', body: formatMetrics(metrics.email) },
        { heading: 'Recommendations', body: metrics.recommendations },
      ],
    });
    
    return {
      text: `Here's your ${period} report for ${product}:`,
      attachments: [{
        buffer,
        filename: `${product.toLowerCase()}-${period}-report.pdf`,
        mimeType: 'application/pdf',
        caption: `${period.charAt(0).toUpperCase() + period.slice(1)} performance report`,
      }],
    };
  },
};
```

## Dependencies

The file attachment system uses:
- **pdfkit** — PDF generation
- **pptxgenjs** — PowerPoint generation

These are included in the MarketClaw dependencies.
