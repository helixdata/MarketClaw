/**
 * Structured Logging System for MarketClaw
 * 
 * Provides:
 * - Correlation IDs for request tracking
 * - JSON structured output
 * - Daily log rotation (7 days retention)
 * - Component-based logging
 * - Session-level debug toggle
 */

import pino, { Logger, LoggerOptions } from 'pino';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Log directory
const LOG_DIR = path.join(process.env.HOME || '~', '.marketclaw', 'logs');

// Ensure log directory exists
function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

// Get log file path for today
function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `marketclaw-${date}.log`);
}

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Correlation ID storage (per-session)
const correlationStore = new Map<string, string>();

// Generate correlation ID
export function generateCorrelationId(): string {
  return randomUUID().slice(0, 8);
}

// Get or create correlation ID for a session
export function getCorrelationId(sessionKey: string): string {
  if (!correlationStore.has(sessionKey)) {
    correlationStore.set(sessionKey, generateCorrelationId());
  }
  return correlationStore.get(sessionKey)!;
}

// Set correlation ID for a session
export function setCorrelationId(sessionKey: string, correlationId: string): void {
  correlationStore.set(sessionKey, correlationId);
}

// Clear correlation ID
export function clearCorrelationId(sessionKey: string): void {
  correlationStore.delete(sessionKey);
}

// Session debug levels (can be toggled at runtime)
const sessionDebugLevels = new Map<string, LogLevel>();
let globalLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

// Set session log level (for /debug command)
export function setSessionLogLevel(sessionKey: string, level: LogLevel): void {
  sessionDebugLevels.set(sessionKey, level);
}

// Get effective log level for session
export function getSessionLogLevel(sessionKey: string): LogLevel {
  return sessionDebugLevels.get(sessionKey) || globalLogLevel;
}

// Reset session to global level
export function resetSessionLogLevel(sessionKey: string): void {
  sessionDebugLevels.delete(sessionKey);
}

// Set global log level
export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

// Truncate large values for logging
export function truncate(value: unknown, maxLength: number = 200): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str && str.length > maxLength) {
    return str.slice(0, maxLength) + '...';
  }
  return str || '';
}

// Sanitize headers (remove auth tokens)
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (/auth|token|key|secret|password|bearer/i.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Create base pino options
function createBaseOptions(component: string): LoggerOptions {
  ensureLogDir();
  
  return {
    name: `marketclaw:${component}`,
    level: globalLogLevel,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
      bindings: () => ({}), // Remove pid/hostname from logs
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  };
}

// Create file transport for production
function createFileTransport(): pino.TransportSingleOptions {
  return {
    target: 'pino/file',
    options: {
      destination: getLogFilePath(),
      mkdir: true,
    },
  };
}

// Create pretty transport for console
function createPrettyTransport(): pino.TransportSingleOptions {
  return {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  };
}

// Main logger factory
export function createLogger(component: string): Logger {
  const options = createBaseOptions(component);
  
  // In production, log to file; in dev, use pretty console
  const isDev = process.env.NODE_ENV !== 'production' && !process.env.LOG_TO_FILE;
  
  if (isDev) {
    return pino({
      ...options,
      transport: createPrettyTransport(),
    });
  }
  
  // Production: log to both file and console
  return pino({
    ...options,
    transport: {
      targets: [
        createFileTransport(),
        createPrettyTransport(),
      ],
    },
  });
}

// Component-specific loggers
export interface StructuredLogger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): StructuredLogger;
}

// Create a structured logger with component and optional correlation ID
export function createStructuredLogger(component: string, correlationId?: string): StructuredLogger {
  const baseLogger = createLogger(component);
  
  const addContext = (data?: Record<string, unknown>): Record<string, unknown> => {
    const ctx: Record<string, unknown> = { component };
    if (correlationId) ctx.correlationId = correlationId;
    if (data) Object.assign(ctx, data);
    return ctx;
  };
  
  return {
    debug(msg: string, data?: Record<string, unknown>) {
      baseLogger.debug(addContext(data), msg);
    },
    info(msg: string, data?: Record<string, unknown>) {
      baseLogger.info(addContext(data), msg);
    },
    warn(msg: string, data?: Record<string, unknown>) {
      baseLogger.warn(addContext(data), msg);
    },
    error(msg: string, data?: Record<string, unknown>) {
      baseLogger.error(addContext(data), msg);
    },
    child(bindings: Record<string, unknown>): StructuredLogger {
      return createStructuredLogger(component, correlationId || bindings.correlationId as string);
    },
  };
}

// Specific logger types for key components

/** Tool execution logger */
export interface ToolLogger extends StructuredLogger {
  toolStart(toolName: string, args: unknown): void;
  toolEnd(toolName: string, result: { success: boolean; message?: string }, durationMs: number): void;
  toolError(toolName: string, error: unknown, durationMs: number): void;
}

export function createToolLogger(correlationId?: string): ToolLogger {
  const base = createStructuredLogger('tool', correlationId);
  return {
    ...base,
    toolStart(toolName: string, args: unknown) {
      base.info('Tool execution started', {
        tool: toolName,
        args: truncate(args, 500),
      });
    },
    toolEnd(toolName: string, result: { success: boolean; message?: string }, durationMs: number) {
      base.info('Tool execution completed', {
        tool: toolName,
        success: result.success,
        message: truncate(result.message, 200),
        durationMs,
      });
    },
    toolError(toolName: string, error: unknown, durationMs: number) {
      base.error('Tool execution failed', {
        tool: toolName,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });
    },
  };
}

/** Browser automation logger */
export interface BrowserLogger extends StructuredLogger {
  commandSent(action: string, data?: Record<string, unknown>): void;
  commandResponse(action: string, success: boolean, durationMs: number, data?: Record<string, unknown>): void;
  selectorTried(selector: string, matched: boolean): void;
  navigation(url: string, status: 'start' | 'complete' | 'error'): void;
}

export function createBrowserLogger(correlationId?: string): BrowserLogger {
  const base = createStructuredLogger('browser', correlationId);
  return {
    ...base,
    commandSent(action: string, data?: Record<string, unknown>) {
      base.debug('Browser command sent', { action, ...data });
    },
    commandResponse(action: string, success: boolean, durationMs: number, data?: Record<string, unknown>) {
      base.info('Browser command response', { action, success, durationMs, ...data });
    },
    selectorTried(selector: string, matched: boolean) {
      base.debug('Selector tried', { selector: truncate(selector, 100), matched });
    },
    navigation(url: string, status: 'start' | 'complete' | 'error') {
      base.info('Browser navigation', { url: truncate(url, 100), status });
    },
  };
}

/** API call logger */
export interface ApiLogger extends StructuredLogger {
  request(method: string, url: string, headers?: Record<string, string>): void;
  response(method: string, url: string, status: number, durationMs: number, rateLimitHeaders?: Record<string, string>): void;
  requestError(method: string, url: string, error: unknown, durationMs: number): void;
}

export function createApiLogger(correlationId?: string): ApiLogger {
  const base = createStructuredLogger('api', correlationId);
  return {
    ...base,
    request(method: string, url: string, headers?: Record<string, string>) {
      base.debug('API request', {
        method,
        url: truncate(url, 200),
        headers: headers ? sanitizeHeaders(headers) : undefined,
      });
    },
    response(method: string, url: string, status: number, durationMs: number, rateLimitHeaders?: Record<string, string>) {
      const level = status >= 400 ? 'warn' : 'info';
      base[level]('API response', {
        method,
        url: truncate(url, 200),
        status,
        durationMs,
        rateLimit: rateLimitHeaders,
      });
    },
    requestError(method: string, url: string, error: unknown, durationMs: number) {
      base.error('API request failed', {
        method,
        url: truncate(url, 200),
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });
    },
  };
}

/** Sub-agent logger */
export interface AgentLogger extends StructuredLogger {
  delegation(agentId: string, taskSummary: string): void;
  delegationComplete(agentId: string, taskId: string, durationMs: number, success: boolean): void;
  delegationError(agentId: string, taskId: string, error: unknown): void;
}

export function createAgentLogger(correlationId?: string): AgentLogger {
  const base = createStructuredLogger('agent', correlationId);
  return {
    ...base,
    delegation(agentId: string, taskSummary: string) {
      base.info('Task delegated to sub-agent', {
        agentId,
        taskSummary: truncate(taskSummary, 200),
      });
    },
    delegationComplete(agentId: string, taskId: string, durationMs: number, success: boolean) {
      base.info('Sub-agent task completed', {
        agentId,
        taskId,
        durationMs,
        success,
      });
    },
    delegationError(agentId: string, taskId: string, error: unknown) {
      base.error('Sub-agent task failed', {
        agentId,
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  };
}

/** Tool loop logger */
export interface ToolLoopLogger extends StructuredLogger {
  iterationStart(iteration: number, maxIterations: number): void;
  iterationEnd(iteration: number, toolCount: number): void;
  maxIterationsReached(iterations: number): void;
  loopComplete(iterations: number, durationMs: number): void;
}

export function createToolLoopLogger(correlationId?: string): ToolLoopLogger {
  const base = createStructuredLogger('toolLoop', correlationId);
  return {
    ...base,
    iterationStart(iteration: number, maxIterations: number) {
      base.debug('Tool loop iteration started', { iteration, maxIterations });
    },
    iterationEnd(iteration: number, toolCount: number) {
      base.debug('Tool loop iteration completed', { iteration, toolCount });
    },
    maxIterationsReached(iterations: number) {
      base.warn('Max iterations reached', { iterations });
    },
    loopComplete(iterations: number, durationMs: number) {
      base.info('Tool loop completed', { iterations, durationMs });
    },
  };
}

// Log rotation (cleanup old logs)
export async function rotateOldLogs(retentionDays: number = 7): Promise<number> {
  ensureLogDir();
  
  const files = fs.readdirSync(LOG_DIR);
  const now = Date.now();
  const maxAge = retentionDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  
  for (const file of files) {
    if (!file.endsWith('.log')) continue;
    
    const filePath = path.join(LOG_DIR, file);
    const stat = fs.statSync(filePath);
    
    if (now - stat.mtime.getTime() > maxAge) {
      fs.unlinkSync(filePath);
      deleted++;
    }
  }
  
  return deleted;
}

// List log files
export function listLogFiles(): { name: string; size: number; modified: Date }[] {
  ensureLogDir();
  
  const files = fs.readdirSync(LOG_DIR);
  return files
    .filter(f => f.endsWith('.log'))
    .map(f => {
      const stat = fs.statSync(path.join(LOG_DIR, f));
      return {
        name: f,
        size: stat.size,
        modified: stat.mtime,
      };
    })
    .sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

// Tail log file
export function tailLogFile(filename?: string, lines: number = 50): string[] {
  ensureLogDir();
  
  const logFile = filename 
    ? path.join(LOG_DIR, filename)
    : getLogFilePath();
  
  if (!fs.existsSync(logFile)) {
    return [];
  }
  
  const content = fs.readFileSync(logFile, 'utf-8');
  const allLines = content.trim().split('\n');
  return allLines.slice(-lines);
}

// Search logs
export function searchLogs(query: string, options?: { 
  level?: LogLevel; 
  component?: string; 
  since?: Date;
  limit?: number;
}): string[] {
  ensureLogDir();
  
  const files = listLogFiles();
  const results: string[] = [];
  const limit = options?.limit || 100;
  
  for (const file of files) {
    if (options?.since && file.modified < options.since) continue;
    
    const lines = fs.readFileSync(path.join(LOG_DIR, file.name), 'utf-8').split('\n');
    
    for (const line of lines) {
      if (results.length >= limit) break;
      
      try {
        const log = JSON.parse(line);
        
        // Filter by level
        if (options?.level && log.level?.toLowerCase() !== options.level) continue;
        
        // Filter by component
        if (options?.component && log.component !== options.component) continue;
        
        // Search query
        if (line.toLowerCase().includes(query.toLowerCase())) {
          results.push(line);
        }
      } catch {
        // Skip malformed lines
      }
    }
    
    if (results.length >= limit) break;
  }
  
  return results;
}

// Export log directory for CLI
export const LOG_DIRECTORY = LOG_DIR;

// Default logger for quick use
export const logger = createStructuredLogger('main');
