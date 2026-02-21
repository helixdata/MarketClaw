/**
 * Channel Types
 * Defines the interface all interaction channels must implement
 */

export interface ChannelConfig {
  enabled: boolean;
  [key: string]: unknown;
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

export interface ChannelMessage {
  id: string;
  userId: string;
  username?: string;
  text: string;
  timestamp: Date;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  
  /** Images attached to the message */
  images?: ChannelImage[];
}

export interface ChannelResponse {
  text: string;
  replyToId?: string;
  buttons?: Array<{ text: string; callback: string }>;
  metadata?: Record<string, unknown>;
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
