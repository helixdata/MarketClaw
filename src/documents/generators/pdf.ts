/**
 * PDF Document Generator
 * Creates PDF documents using pdfkit
 */

import PDFDocument from 'pdfkit';

export interface PdfContentSection {
  heading?: string;
  body: string;
}

export interface PdfOptions {
  /** Document title (shown in header) */
  title?: string;
  /** Content - either a single string or array of sections */
  content: string | PdfContentSection[];
  /** Document author (metadata) */
  author?: string;
  /** Document subject (metadata) */
  subject?: string;
  /** Font size for body text (default: 12) */
  fontSize?: number;
  /** Font size for headings (default: 16) */
  headingSize?: number;
  /** Include page numbers (default: true) */
  pageNumbers?: boolean;
  /** Include date in header (default: true) */
  includeDate?: boolean;
}

/**
 * Generate a PDF document from content
 * @param options PDF generation options
 * @returns Promise resolving to PDF buffer
 */
export async function generatePdf(options: PdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const {
        title,
        content,
        author = 'MarketClaw',
        subject,
        fontSize = 12,
        headingSize = 16,
        pageNumbers = true,
        includeDate = true,
      } = options;

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 72,
          bottom: 72,
          left: 72,
          right: 72,
        },
        info: {
          Title: title || 'Document',
          Author: author,
          Subject: subject || '',
          Creator: 'MarketClaw',
        },
      });

      // Collect chunks into buffer
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Track page count for page numbers (reserved for future use)
      let _pageCount = 1;
      doc.on('pageAdded', () => {
        _pageCount++;
      });

      // Add title if provided
      if (title) {
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text(title, { align: 'center' });
        
        // Add date under title
        if (includeDate) {
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#666666')
            .text(new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }), { align: 'center' });
        }
        
        doc.moveDown(2);
        doc.fillColor('#000000');
      }

      // Process content
      const sections = typeof content === 'string' 
        ? [{ body: content }] 
        : content;

      for (const section of sections) {
        // Add heading if present
        if (section.heading) {
          doc
            .fontSize(headingSize)
            .font('Helvetica-Bold')
            .text(section.heading);
          doc.moveDown(0.5);
        }

        // Add body text
        // Split into paragraphs and render each
        const paragraphs = section.body.split(/\n\n+/);
        doc.font('Helvetica').fontSize(fontSize);
        
        for (let i = 0; i < paragraphs.length; i++) {
          const paragraph = paragraphs[i].trim();
          if (!paragraph) continue;

          // Check for bullet points
          if (paragraph.startsWith('• ') || paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
            // It's a bullet list - process line by line
            const lines = paragraph.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                doc.text('• ' + trimmed.slice(2), {
                  indent: 20,
                });
              } else if (trimmed) {
                doc.text(trimmed);
              }
            }
          } else {
            // Regular paragraph
            doc.text(paragraph, {
              align: 'left',
              lineGap: 2,
            });
          }
          
          if (i < paragraphs.length - 1) {
            doc.moveDown();
          }
        }

        doc.moveDown();
      }

      // Add page numbers if enabled
      if (pageNumbers) {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc
            .fontSize(10)
            .fillColor('#666666')
            .text(
              `Page ${i + 1} of ${range.count}`,
              0,
              doc.page.height - 50,
              { align: 'center' }
            );
        }
      }

      // Finalize PDF
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
