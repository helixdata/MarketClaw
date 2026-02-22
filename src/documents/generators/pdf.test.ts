/**
 * PDF Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { generatePdf, PdfOptions } from './pdf.js';

describe('generatePdf', () => {
  it('should generate a PDF with simple text content', async () => {
    const options: PdfOptions = {
      content: 'Hello, this is a test PDF document.',
    };

    const buffer = await generatePdf(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PDF files start with %PDF
    expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should generate a PDF with title and content', async () => {
    const options: PdfOptions = {
      title: 'Test Document',
      content: 'This is the body content of the document.',
      author: 'Test Author',
    };

    const buffer = await generatePdf(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should generate a PDF with multiple sections', async () => {
    const options: PdfOptions = {
      title: 'Multi-Section Document',
      content: [
        { heading: 'Introduction', body: 'This is the introduction section.' },
        { heading: 'Main Content', body: 'This is the main content section with more details.' },
        { heading: 'Conclusion', body: 'This is the conclusion.' },
      ],
      author: 'MarketClaw',
    };

    const buffer = await generatePdf(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle bullet points in content', async () => {
    const options: PdfOptions = {
      title: 'Document with Bullets',
      content: `Here are some points:

• First bullet point
• Second bullet point
• Third bullet point

And a regular paragraph after.`,
    };

    const buffer = await generatePdf(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle custom font sizes', async () => {
    const options: PdfOptions = {
      title: 'Custom Sizes',
      content: 'Content with custom font sizes.',
      fontSize: 14,
      headingSize: 20,
    };

    const buffer = await generatePdf(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle empty content gracefully', async () => {
    const options: PdfOptions = {
      content: '',
    };

    const buffer = await generatePdf(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should generate PDF without page numbers when disabled', async () => {
    const options: PdfOptions = {
      content: 'Content without page numbers.',
      pageNumbers: false,
    };

    const buffer = await generatePdf(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should generate PDF without date when disabled', async () => {
    const options: PdfOptions = {
      title: 'No Date Document',
      content: 'Content without date in header.',
      includeDate: false,
    };

    const buffer = await generatePdf(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
