/**
 * PowerPoint Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { generatePptx, PptxOptions } from './pptx.js';

describe('generatePptx', () => {
  it('should generate a PPTX with slides', async () => {
    const options: PptxOptions = {
      slides: [
        { title: 'Slide 1', content: 'Content for slide 1' },
        { title: 'Slide 2', content: 'Content for slide 2' },
      ],
    };

    const buffer = await generatePptx(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PPTX files are ZIP archives starting with PK
    expect(buffer.toString('utf8', 0, 2)).toBe('PK');
  });

  it('should generate a PPTX with title slide', async () => {
    const options: PptxOptions = {
      title: 'My Presentation',
      subtitle: 'A subtitle for the presentation',
      slides: [
        { title: 'First Content Slide', content: 'Some content here' },
      ],
    };

    const buffer = await generatePptx(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should generate a PPTX with bullet point content', async () => {
    const options: PptxOptions = {
      title: 'Bullet Points',
      slides: [
        { 
          title: 'Key Points', 
          content: [
            'First point',
            'Second point',
            'Third point',
          ],
        },
      ],
    };

    const buffer = await generatePptx(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should generate a PPTX with speaker notes', async () => {
    const options: PptxOptions = {
      slides: [
        { 
          title: 'Slide with Notes', 
          content: 'Visible content',
          notes: 'These are speaker notes that only the presenter sees.',
        },
      ],
    };

    const buffer = await generatePptx(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle custom theme color', async () => {
    const options: PptxOptions = {
      title: 'Custom Theme',
      themeColor: '#FF5500',
      slides: [
        { title: 'Orange Theme', content: 'Content with orange theme' },
      ],
    };

    const buffer = await generatePptx(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle author and company metadata', async () => {
    const options: PptxOptions = {
      title: 'Metadata Test',
      author: 'Test Author',
      company: 'Test Company',
      subject: 'Test Subject',
      slides: [
        { title: 'Slide', content: 'Content' },
      ],
    };

    const buffer = await generatePptx(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle slides without titles', async () => {
    const options: PptxOptions = {
      slides: [
        { content: 'Content only, no title' },
      ],
    };

    const buffer = await generatePptx(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle many slides', async () => {
    const slides = Array.from({ length: 10 }, (_, i) => ({
      title: `Slide ${i + 1}`,
      content: `Content for slide ${i + 1}`,
    }));

    const options: PptxOptions = {
      title: 'Many Slides',
      slides,
    };

    const buffer = await generatePptx(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle content with line breaks as bullets', async () => {
    const options: PptxOptions = {
      slides: [
        { 
          title: 'Line Break Content', 
          content: 'First line\nSecond line\nThird line',
        },
      ],
    };

    const buffer = await generatePptx(options);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
