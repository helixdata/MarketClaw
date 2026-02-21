/**
 * Document Types
 * Types for document parsing functionality
 */

export interface ParsedDocument {
  /** Unique identifier for the document */
  id: string;
  
  /** Original filename */
  filename: string;
  
  /** MIME type of the document */
  mimeType: string;
  
  /** Extracted text content */
  text: string;
  
  /** Number of pages (for PDFs) */
  pageCount?: number;
  
  /** Word count of extracted text */
  wordCount: number;
  
  /** Timestamp when document was extracted */
  extractedAt: number;
}

export type SupportedDocType = 'pdf' | 'docx' | 'doc' | 'txt';

/**
 * Supported MIME types for document parsing
 */
export const SUPPORTED_MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
} as const;

/**
 * Reverse mapping from MIME type to document type
 */
export const MIME_TO_DOCTYPE: Record<string, SupportedDocType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
};
