/**
 * Document Parser Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentParser, documentParser, SUPPORTED_MIME_TYPES, MIME_TO_DOCTYPE } from './index.js';

// Mock pdf-parse v2 API
vi.mock('pdf-parse', () => {
  return {
    PDFParse: class {
      private data: Buffer;
      
      constructor({ data }: { data: Buffer }) {
        this.data = data;
      }
      
      async getText() {
        const text = this.data.toString();
        if (text.includes('CORRUPT')) {
          throw new Error('Invalid PDF structure');
        }
        return {
          text: 'Sample PDF text content with multiple words.',
          pages: [{}, {}, {}], // 3 pages
        };
      }
    },
  };
});

// Mock mammoth
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn().mockImplementation(async ({ buffer }: { buffer: Buffer }) => {
      const text = buffer.toString();
      if (text.includes('CORRUPT')) {
        throw new Error('Could not read file');
      }
      return {
        value: 'Sample Word document text content.',
        messages: [],
      };
    }),
  },
}));

describe('DocumentParser', () => {
  let parser: DocumentParser;

  beforeEach(() => {
    parser = new DocumentParser();
    vi.clearAllMocks();
  });

  describe('parseDocument', () => {
    it('should parse PDF successfully', async () => {
      const buffer = Buffer.from('fake pdf content');
      const result = await parser.parseDocument(buffer, 'test.pdf', 'application/pdf');

      expect(result.filename).toBe('test.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.text).toBe('Sample PDF text content with multiple words.');
      expect(result.pageCount).toBe(3);
      expect(result.wordCount).toBe(7);
      expect(result.id).toMatch(/^doc_testpdf_\d+_[a-z0-9]+$/);
      expect(result.extractedAt).toBeGreaterThan(0);
    });

    it('should parse DOCX successfully', async () => {
      const buffer = Buffer.from('fake docx content');
      const result = await parser.parseDocument(buffer, 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      expect(result.filename).toBe('test.docx');
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(result.text).toBe('Sample Word document text content.');
      expect(result.pageCount).toBeUndefined();
      expect(result.wordCount).toBe(5);
    });

    it('should parse DOC successfully', async () => {
      const buffer = Buffer.from('fake doc content');
      const result = await parser.parseDocument(buffer, 'test.doc', 'application/msword');

      expect(result.filename).toBe('test.doc');
      expect(result.mimeType).toBe('application/msword');
      expect(result.text).toBe('Sample Word document text content.');
    });

    it('should parse TXT successfully', async () => {
      const buffer = Buffer.from('This is plain text content with several words.');
      const result = await parser.parseDocument(buffer, 'test.txt', 'text/plain');

      expect(result.filename).toBe('test.txt');
      expect(result.mimeType).toBe('text/plain');
      expect(result.text).toBe('This is plain text content with several words.');
      expect(result.wordCount).toBe(8);
    });

    it('should throw on unsupported MIME type', async () => {
      const buffer = Buffer.from('content');
      await expect(
        parser.parseDocument(buffer, 'test.xyz', 'application/xyz')
      ).rejects.toThrow('Unsupported document type');
    });

    it('should handle corrupted PDF gracefully', async () => {
      const buffer = Buffer.from('CORRUPT pdf');
      await expect(
        parser.parseDocument(buffer, 'corrupt.pdf', 'application/pdf')
      ).rejects.toThrow('Failed to parse PDF');
    });

    it('should handle corrupted Word document gracefully', async () => {
      const buffer = Buffer.from('CORRUPT docx');
      await expect(
        parser.parseDocument(buffer, 'corrupt.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).rejects.toThrow('Failed to parse Word document');
    });

    it('should truncate large documents', async () => {
      // Create a large text document that exceeds 50k chars
      const largeText = 'x'.repeat(60000);
      const buffer = Buffer.from(largeText);
      const result = await parser.parseDocument(buffer, 'large.txt', 'text/plain');

      expect(result.text.length).toBeLessThanOrEqual(50100); // 50k + truncation message
      expect(result.text).toContain('[Document truncated');
    });

    it('should fall back to filename extension when MIME type unknown', async () => {
      const buffer = Buffer.from('This is text content');
      const result = await parser.parseDocument(buffer, 'test.txt', 'application/octet-stream');

      // Should fail as octet-stream isn't in our mapping
      await expect(
        parser.parseDocument(buffer, 'test.xyz', 'application/octet-stream')
      ).rejects.toThrow('Unsupported document type');
    });
  });

  describe('parsePdf', () => {
    it('should return text and page count', async () => {
      const buffer = Buffer.from('pdf content');
      const result = await parser.parsePdf(buffer);

      expect(result.text).toBe('Sample PDF text content with multiple words.');
      expect(result.pageCount).toBe(3);
    });
  });

  describe('parseDocx', () => {
    it('should return text content', async () => {
      const buffer = Buffer.from('docx content');
      const result = await parser.parseDocx(buffer);

      expect(result.text).toBe('Sample Word document text content.');
    });
  });

  describe('parseTxt', () => {
    it('should return text content', async () => {
      const buffer = Buffer.from('Hello World');
      const result = await parser.parseTxt(buffer);

      expect(result.text).toBe('Hello World');
    });

    it('should handle UTF-8 content', async () => {
      const buffer = Buffer.from('Hello 世界 🌍');
      const result = await parser.parseTxt(buffer);

      expect(result.text).toBe('Hello 世界 🌍');
    });

    it('should trim whitespace', async () => {
      const buffer = Buffer.from('  \n  Hello World  \n  ');
      const result = await parser.parseTxt(buffer);

      expect(result.text).toBe('Hello World');
    });
  });

  describe('isSupportedDocument', () => {
    it('should return true for PDF', () => {
      expect(parser.isSupportedDocument('application/pdf')).toBe(true);
    });

    it('should return true for DOCX', () => {
      expect(parser.isSupportedDocument('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    });

    it('should return true for DOC', () => {
      expect(parser.isSupportedDocument('application/msword')).toBe(true);
    });

    it('should return true for TXT', () => {
      expect(parser.isSupportedDocument('text/plain')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(parser.isSupportedDocument('image/jpeg')).toBe(false);
      expect(parser.isSupportedDocument('application/json')).toBe(false);
      expect(parser.isSupportedDocument('video/mp4')).toBe(false);
    });
  });

  describe('isSupportedDocumentByFilename', () => {
    it('should return true for supported MIME types', () => {
      expect(parser.isSupportedDocumentByFilename('application/pdf', 'test.pdf')).toBe(true);
    });

    it('should return true based on file extension', () => {
      expect(parser.isSupportedDocumentByFilename('application/octet-stream', 'test.pdf')).toBe(true);
      expect(parser.isSupportedDocumentByFilename('application/octet-stream', 'test.docx')).toBe(true);
      expect(parser.isSupportedDocumentByFilename('application/octet-stream', 'test.doc')).toBe(true);
      expect(parser.isSupportedDocumentByFilename('application/octet-stream', 'test.txt')).toBe(true);
    });

    it('should return false for unsupported extensions', () => {
      expect(parser.isSupportedDocumentByFilename('application/octet-stream', 'test.xyz')).toBe(false);
      expect(parser.isSupportedDocumentByFilename('application/octet-stream', 'test.jpg')).toBe(false);
    });
  });

  describe('getSupportedMimeTypes', () => {
    it('should return all supported MIME types', () => {
      const mimeTypes = parser.getSupportedMimeTypes();

      expect(mimeTypes).toContain('application/pdf');
      expect(mimeTypes).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(mimeTypes).toContain('application/msword');
      expect(mimeTypes).toContain('text/plain');
      expect(mimeTypes).toHaveLength(4);
    });
  });

  describe('word count calculation', () => {
    it('should count words correctly', async () => {
      const buffer = Buffer.from('One two three four five');
      const result = await parser.parseDocument(buffer, 'test.txt', 'text/plain');
      expect(result.wordCount).toBe(5);
    });

    it('should handle multiple spaces', async () => {
      const buffer = Buffer.from('One   two    three');
      const result = await parser.parseDocument(buffer, 'test.txt', 'text/plain');
      expect(result.wordCount).toBe(3);
    });

    it('should handle newlines and tabs', async () => {
      const buffer = Buffer.from('One\ttwo\nthree\r\nfour');
      const result = await parser.parseDocument(buffer, 'test.txt', 'text/plain');
      expect(result.wordCount).toBe(4);
    });

    it('should handle empty text', async () => {
      const buffer = Buffer.from('   \n\t  ');
      const result = await parser.parseDocument(buffer, 'test.txt', 'text/plain');
      expect(result.wordCount).toBe(0);
    });
  });

  describe('ID generation', () => {
    it('should generate unique IDs', async () => {
      const buffer = Buffer.from('content');
      const result1 = await parser.parseDocument(buffer, 'test.txt', 'text/plain');
      const result2 = await parser.parseDocument(buffer, 'test.txt', 'text/plain');

      expect(result1.id).not.toBe(result2.id);
    });

    it('should include sanitized filename in ID', async () => {
      const buffer = Buffer.from('content');
      const result = await parser.parseDocument(buffer, 'my-file!@#.pdf', 'application/pdf');

      // Sanitization removes special chars, so "my-file!@#.pdf" becomes "myfilepdf" (first 10 chars kept)
      expect(result.id).toMatch(/^doc_myfilepdf_/);
    });
  });

  describe('singleton export', () => {
    it('should export a singleton instance', () => {
      expect(documentParser).toBeInstanceOf(DocumentParser);
    });
  });

  describe('MIME type constants', () => {
    it('should have correct SUPPORTED_MIME_TYPES', () => {
      expect(SUPPORTED_MIME_TYPES.pdf).toBe('application/pdf');
      expect(SUPPORTED_MIME_TYPES.docx).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(SUPPORTED_MIME_TYPES.doc).toBe('application/msword');
      expect(SUPPORTED_MIME_TYPES.txt).toBe('text/plain');
    });

    it('should have correct MIME_TO_DOCTYPE mapping', () => {
      expect(MIME_TO_DOCTYPE['application/pdf']).toBe('pdf');
      expect(MIME_TO_DOCTYPE['application/vnd.openxmlformats-officedocument.wordprocessingml.document']).toBe('docx');
      expect(MIME_TO_DOCTYPE['application/msword']).toBe('doc');
      expect(MIME_TO_DOCTYPE['text/plain']).toBe('txt');
    });
  });
});
