/**
 * Document Parser
 * Parses PDF, Word, and text documents to extract text content
 */

import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { ParsedDocument, SupportedDocType, SUPPORTED_MIME_TYPES, MIME_TO_DOCTYPE } from './types.js';
import pino from 'pino';

const logger = pino({ name: 'documents' });

/** Maximum characters to extract from a document (to avoid token limits) */
const MAX_TEXT_LENGTH = 50000;

export class DocumentParser {
  /**
   * Parse a document and extract text content
   */
  async parseDocument(buffer: Buffer, filename: string, mimeType: string): Promise<ParsedDocument> {
    const docType = this.getDocType(mimeType, filename);
    
    if (!docType) {
      throw new Error(`Unsupported document type: ${mimeType}`);
    }

    logger.info({ filename, mimeType, docType }, 'Parsing document');

    let result: { text: string; pageCount?: number };

    switch (docType) {
      case 'pdf':
        result = await this.parsePdf(buffer);
        break;
      case 'docx':
      case 'doc':
        result = await this.parseDocx(buffer);
        break;
      case 'txt':
        result = await this.parseTxt(buffer);
        break;
      default:
        throw new Error(`Unsupported document type: ${docType}`);
    }

    // Truncate text if too long
    let text = result.text;
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH) + '\n\n[Document truncated - showing first 50,000 characters]';
      logger.info({ filename, originalLength: result.text.length, truncatedLength: MAX_TEXT_LENGTH }, 'Document text truncated');
    }

    const wordCount = this.countWords(text);

    const parsed: ParsedDocument = {
      id: this.generateId(filename),
      filename,
      mimeType,
      text,
      wordCount,
      extractedAt: Date.now(),
    };

    if (result.pageCount !== undefined) {
      parsed.pageCount = result.pageCount;
    }

    logger.info({ filename, wordCount, pageCount: parsed.pageCount }, 'Document parsed successfully');

    return parsed;
  }

  /**
   * Parse PDF document
   */
  async parsePdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    try {
      // pdf-parse v2 API: create parser with buffer, then extract text
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      
      return {
        text: textResult.text.trim(),
        pageCount: textResult.pages.length,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to parse PDF');
      throw new Error(`Failed to parse PDF: ${(error as Error).message}`);
    }
  }

  /**
   * Parse Word document (.docx or .doc)
   * Note: .doc support is limited; .docx is recommended
   */
  async parseDocx(buffer: Buffer): Promise<{ text: string }> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      
      if (result.messages.length > 0) {
        const warnings = result.messages.filter(m => m.type === 'warning');
        if (warnings.length > 0) {
          logger.warn({ warnings: warnings.map(w => w.message) }, 'Warnings while parsing Word document');
        }
      }

      return {
        text: result.value.trim(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to parse Word document');
      throw new Error(`Failed to parse Word document: ${(error as Error).message}`);
    }
  }

  /**
   * Parse plain text file
   */
  async parseTxt(buffer: Buffer): Promise<{ text: string }> {
    try {
      const text = buffer.toString('utf-8').trim();
      return { text };
    } catch (error) {
      logger.error({ error }, 'Failed to parse text file');
      throw new Error(`Failed to parse text file: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a MIME type is supported for document parsing
   */
  isSupportedDocument(mimeType: string): boolean {
    return mimeType in MIME_TO_DOCTYPE;
  }

  /**
   * Check if a MIME type or filename indicates a supported document
   */
  isSupportedDocumentByFilename(mimeType: string, filename: string): boolean {
    if (this.isSupportedDocument(mimeType)) {
      return true;
    }
    
    // Check by extension
    const ext = filename.toLowerCase().split('.').pop();
    return ext ? ['pdf', 'docx', 'doc', 'txt'].includes(ext) : false;
  }

  /**
   * Get list of supported MIME types
   */
  getSupportedMimeTypes(): string[] {
    return Object.values(SUPPORTED_MIME_TYPES);
  }

  /**
   * Get document type from MIME type or filename
   */
  private getDocType(mimeType: string, filename: string): SupportedDocType | null {
    // First try MIME type
    if (mimeType in MIME_TO_DOCTYPE) {
      return MIME_TO_DOCTYPE[mimeType];
    }

    // Fall back to extension
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return 'pdf';
      case 'docx':
        return 'docx';
      case 'doc':
        return 'doc';
      case 'txt':
        return 'txt';
      default:
        return null;
    }
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }

  /**
   * Generate a unique ID for a document
   */
  private generateId(filename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const safeName = filename.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    return `doc_${safeName}_${timestamp}_${random}`;
  }
}

// Export singleton instance
export const documentParser = new DocumentParser();

// Re-export types
export * from './types.js';
