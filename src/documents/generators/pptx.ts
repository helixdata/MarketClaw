/**
 * PowerPoint Document Generator
 * Creates PPTX presentations using pptxgenjs
 */

import PptxGenJS from 'pptxgenjs';

export interface PptxSlide {
  /** Slide title */
  title?: string;
  /** Slide content - string or array of bullet points */
  content: string | string[];
  /** Speaker notes */
  notes?: string;
  /** Slide layout type */
  layout?: 'title' | 'content' | 'titleAndContent' | 'blank';
}

export interface PptxOptions {
  /** Presentation title (for title slide and metadata) */
  title?: string;
  /** Presentation subtitle (for title slide) */
  subtitle?: string;
  /** Array of slides */
  slides: PptxSlide[];
  /** Author name (metadata) */
  author?: string;
  /** Company name */
  company?: string;
  /** Subject (metadata) */
  subject?: string;
  /** Theme color (hex, default: '#0066cc') */
  themeColor?: string;
}

/**
 * Generate a PowerPoint presentation
 * @param options PPTX generation options
 * @returns Promise resolving to PPTX buffer
 */
export async function generatePptx(options: PptxOptions): Promise<Buffer> {
  const {
    title,
    subtitle,
    slides,
    author = 'MarketClaw',
    company = 'MarketClaw',
    subject,
    themeColor = '#0066cc',
  } = options;

  // Create presentation
  const pptx = new PptxGenJS();
  
  // Set metadata
  pptx.author = author;
  pptx.company = company;
  pptx.title = title || 'Presentation';
  pptx.subject = subject || '';

  // Define master slide layouts
  pptx.defineSlideMaster({
    title: 'TITLE_SLIDE',
    background: { color: themeColor },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 2.5, w: 9, h: 1.5 }, text: '' } },
      { placeholder: { options: { name: 'subtitle', type: 'body', x: 0.5, y: 4.2, w: 9, h: 1 }, text: '' } },
    ],
  });

  pptx.defineSlideMaster({
    title: 'CONTENT_SLIDE',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: '100%', h: 0.75, fill: { color: themeColor } } },
      { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.15, w: 9, h: 0.5, fontFace: 'Arial', fontSize: 24, color: 'FFFFFF', bold: true }, text: '' } },
    ],
  });

  // Add title slide if title is provided
  if (title) {
    const titleSlide = pptx.addSlide({ masterName: 'TITLE_SLIDE' });
    
    titleSlide.addText(title, {
      x: 0.5,
      y: 2.2,
      w: 9,
      h: 1.2,
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      fontFace: 'Arial',
    });

    if (subtitle) {
      titleSlide.addText(subtitle, {
        x: 0.5,
        y: 3.5,
        w: 9,
        h: 0.8,
        fontSize: 24,
        color: 'FFFFFF',
        align: 'center',
        fontFace: 'Arial',
      });
    }

    // Add date
    titleSlide.addText(new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }), {
      x: 0.5,
      y: 4.5,
      w: 9,
      h: 0.5,
      fontSize: 14,
      color: 'FFFFFF',
      align: 'center',
      fontFace: 'Arial',
    });
  }

  // Add content slides
  for (const slideData of slides) {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    // Add title
    if (slideData.title) {
      slide.addText(slideData.title, {
        x: 0.5,
        y: 0.15,
        w: 9,
        h: 0.5,
        fontSize: 24,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Arial',
      });
    }

    // Add content
    const contentArray = Array.isArray(slideData.content) 
      ? slideData.content 
      : slideData.content.split('\n').filter(line => line.trim());

    if (contentArray.length > 0) {
      // Format as bullet points
      const bulletPoints: Array<{ text: string; options?: any }> = contentArray.map(text => ({
        text: text.replace(/^[-•*]\s*/, ''), // Remove leading bullets
        options: { bullet: { type: 'bullet' }, indentLevel: 0 },
      }));

      slide.addText(bulletPoints, {
        x: 0.5,
        y: 1.0,
        w: 9,
        h: 4.5,
        fontSize: 18,
        color: '333333',
        fontFace: 'Arial',
        valign: 'top',
        lineSpaceMult: 1.3,
      });
    }

    // Add speaker notes
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  // Generate buffer
  const data = await pptx.write({ outputType: 'nodebuffer' });
  return data as Buffer;
}
