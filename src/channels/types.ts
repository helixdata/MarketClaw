/**
 * Channel Types
 * Defines the interface all interaction channels must implement
 */

export interface ChannelConfig {
  enabled: boolean;
  [key: string]: unknown;
}

/**
 * File attachment to send with a response
 */
export interface ChannelAttachment {
  /** File data as Buffer */
  buffer: Buffer;
  
  /** Filename for the attachment */
  filename: string;
  
  /** MIME type (application/pdf, application/vnd.openxmlformats-officedocument.presentationml.presentation, etc.) */
  mimeType: string;
  
  /** Optional caption/description for the attachment */
  caption?: string;
}

/**
 * Image attachment from a channel
 */
export interface ChannelImage {
  /** Unique identifier for the image */
  id: string;
  
  /** URL to download the image (may be temporary) */
  url: string;
  
  /** Local file path if downloaded */
  path?: string;
  
  /** MIME type (image/jpeg, image/png, etc.) */
  mimeType?: string;
  
  /** File size in bytes */
  size?: number;
  
  /** Original filename */
  filename?: string;
  
  /** Base64 encoded image data */
  base64?: string;
}

/**
 * Document attachment from a channel
 */
export interface ChannelDocument {
  /** Unique identifier for the document */
  id: string;
  
  /** Original filename */
  filename: string;
  
  /** MIME type (application/pdf, etc.) */
  mimeType: string;
  
  /** Extracted text content */
  text: string;
  
  /** Number of pages (for PDFs) */
  pageCount?: number;
  
  /** Word count of extracted text */
  wordCount: number;
}

export interface ChannelMessage {
  id: string;
  userId: string;
  username?: string;
  text: string;
  timestamp: Date;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  
  /** Chat/channel ID - for groups, this differs from userId */
  chatId?: string;
  
  /** Whether this message is from a group/channel (vs DM) */
  isGroup?: boolean;
  
  /** Images attached to the message */
  images?: ChannelImage[];
  
  /** Documents attached to the message (PDF, Word, etc.) */
  documents?: ChannelDocument[];
}

export interface ChannelResponse {
  text: string;
  replyToId?: string;
  buttons?: Array<{ text: string; callback: string }>;
  metadata?: Record<string, unknown>;
  
  /** File attachments to send with the response */
  attachments?: ChannelAttachment[];
}

/**
 * Channel Interface
 * All channels (Telegram, Discord, Slack, CLI, etc.) implement this
 */
export interface Channel {
  /** Unique channel identifier */
  readonly name: string;
  
  /** Human-readable display name */
  readonly displayName: string;
  
  /** Channel description for setup wizard */
  readonly description: string;
  
  /** Required config keys */
  readonly requiredConfig: string[];
  
  /** Optional config keys */
  readonly optionalConfig?: string[];
  
  /** Environment variables this channel needs */
  readonly requiredEnv?: string[];

  /**
   * Initialize the channel (called once at startup)
   */
  initialize(config: ChannelConfig): Promise<void>;

  /**
   * Start listening for messages
   */
  start(): Promise<void>;

  /**
   * Stop the channel gracefully
   */
  stop(): Promise<void>;

  /**
   * Send a message to a user
   */
  send(userId: string, response: ChannelResponse): Promise<void>;

  /**
   * Check if channel is properly configured
   */
  isConfigured(): boolean;

  /**
   * Validate configuration (for setup wizard)
   */
  validateConfig?(config: ChannelConfig): Promise<{ valid: boolean; error?: string }>;
}

/**
 * Message handler type - called when channel receives a message
 */
export type MessageHandler = (
  channel: Channel,
  message: ChannelMessage
) => Promise<ChannelResponse | null>;

/**
 * Channel metadata for registry
 */
export interface RegisteredChannel {
  channel: Channel;
  enabled: boolean;
  config?: ChannelConfig;
}
