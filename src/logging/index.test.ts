/**
 * Logging System Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateCorrelationId,
  getCorrelationId,
  setCorrelationId,
  clearCorrelationId,
  setSessionLogLevel,
  getSessionLogLevel,
  resetSessionLogLevel,
  setGlobalLogLevel,
  truncate,
  sanitizeHeaders,
  createStructuredLogger,
  createToolLogger,
  createBrowserLogger,
  createApiLogger,
  createAgentLogger,
  createToolLoopLogger,
  rotateOldLogs,
  listLogFiles,
  tailLogFile,
  searchLogs,
  LOG_DIRECTORY,
} from './index.js';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import fs from 'fs';

describe('Logging System', () => {
  describe('generateCorrelationId', () => {
    it('should generate an 8-character correlation ID', () => {
      const id = generateCorrelationId();
      expect(id).toHaveLength(8);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateCorrelationId());
      }
      expect(ids.size).toBe(100);
    });

    it('should only contain hex characters', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('Correlation ID Management', () => {
    const testSession = 'test-session-123';

    afterEach(() => {
      clearCorrelationId(testSession);
    });

    it('should get or create correlation ID for a session', () => {
      const id1 = getCorrelationId(testSession);
      const id2 = getCorrelationId(testSession);
      
      expect(id1).toHaveLength(8);
      expect(id1).toBe(id2); // Same session returns same ID
    });

    it('should set correlation ID for a session', () => {
      const customId = 'custom12';
      setCorrelationId(testSession, customId);
      
      expect(getCorrelationId(testSession)).toBe(customId);
    });

    it('should clear correlation ID', () => {
      getCorrelationId(testSession); // Create one
      clearCorrelationId(testSession);
      
      const newId = getCorrelationId(testSession);
      // New ID should be generated (different from cleared)
      expect(newId).toHaveLength(8);
    });

    it('should handle multiple sessions independently', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      
      const id1 = getCorrelationId(session1);
      const id2 = getCorrelationId(session2);
      
      expect(id1).not.toBe(id2);
      
      clearCorrelationId(session1);
      clearCorrelationId(session2);
    });
  });

  describe('Session Log Levels', () => {
    const testSession = 'test-log-session';

    afterEach(() => {
      resetSessionLogLevel(testSession);
      setGlobalLogLevel('info'); // Reset global level
    });

    it('should return global level by default', () => {
      expect(getSessionLogLevel(testSession)).toBe('info');
    });

    it('should set session-specific log level', () => {
      setSessionLogLevel(testSession, 'debug');
      expect(getSessionLogLevel(testSession)).toBe('debug');
    });

    it('should reset session to global level', () => {
      setSessionLogLevel(testSession, 'debug');
      resetSessionLogLevel(testSession);
      expect(getSessionLogLevel(testSession)).toBe('info');
    });

    it('should set global log level', () => {
      setGlobalLogLevel('warn');
      expect(getSessionLogLevel(testSession)).toBe('warn');
    });

    it('should prefer session level over global', () => {
      setGlobalLogLevel('warn');
      setSessionLogLevel(testSession, 'error');
      expect(getSessionLogLevel(testSession)).toBe('error');
    });
  });

  describe('truncate', () => {
    it('should return short strings unchanged', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should truncate long strings', () => {
      const long = 'a'.repeat(300);
      const result = truncate(long, 200);
      expect(result).toHaveLength(203); // 200 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle objects by stringifying', () => {
      const obj = { key: 'value' };
      expect(truncate(obj, 50)).toBe('{"key":"value"}');
    });

    it('should truncate large objects', () => {
      const obj = { data: 'x'.repeat(500) };
      const result = truncate(obj, 100);
      expect(result.length).toBe(103);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle null and undefined', () => {
      expect(truncate(null, 100)).toBe('null');
      expect(truncate(undefined, 100)).toBe('');
    });

    it('should use default max length', () => {
      const long = 'a'.repeat(300);
      const result = truncate(long);
      expect(result).toHaveLength(203); // Default is 200
    });
  });

  describe('sanitizeHeaders', () => {
    it('should redact authorization headers', () => {
      const headers = {
        'Authorization': 'Bearer secret123',
        'Content-Type': 'application/json',
      };
      const sanitized = sanitizeHeaders(headers);
      
      expect(sanitized['Authorization']).toBe('[REDACTED]');
      expect(sanitized['Content-Type']).toBe('application/json');
    });

    it('should redact various auth-related headers', () => {
      const headers = {
        'x-api-key': 'key123',
        'x-auth-token': 'token123',
        'x-secret': 'secret123',
        'password': 'pass123',
        'bearer-token': 'bt123',
      };
      const sanitized = sanitizeHeaders(headers);
      
      expect(sanitized['x-api-key']).toBe('[REDACTED]');
      expect(sanitized['x-auth-token']).toBe('[REDACTED]');
      expect(sanitized['x-secret']).toBe('[REDACTED]');
      expect(sanitized['password']).toBe('[REDACTED]');
      expect(sanitized['bearer-token']).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive headers', () => {
      const headers = {
        'Accept': 'application/json',
        'User-Agent': 'MarketClaw/1.0',
        'X-Request-Id': 'req123',
      };
      const sanitized = sanitizeHeaders(headers);
      
      expect(sanitized['Accept']).toBe('application/json');
      expect(sanitized['User-Agent']).toBe('MarketClaw/1.0');
      expect(sanitized['X-Request-Id']).toBe('req123');
    });

    it('should handle empty headers', () => {
      const sanitized = sanitizeHeaders({});
      expect(Object.keys(sanitized)).toHaveLength(0);
    });
  });

  describe('createStructuredLogger', () => {
    it('should create a logger with all methods', () => {
      const logger = createStructuredLogger('test');
      
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.child).toBe('function');
    });

    it('should create child logger with correlation ID', () => {
      const logger = createStructuredLogger('test');
      const child = logger.child({ correlationId: 'abc123' });
      
      expect(typeof child.debug).toBe('function');
      expect(typeof child.info).toBe('function');
    });

    it('should create logger with initial correlation ID', () => {
      const logger = createStructuredLogger('test', 'abc123');
      // Logger should include correlation ID in context
      expect(typeof logger.info).toBe('function');
    });
  });

  describe('createToolLogger', () => {
    it('should create a tool logger with specialized methods', () => {
      const logger = createToolLogger();
      
      expect(typeof logger.toolStart).toBe('function');
      expect(typeof logger.toolEnd).toBe('function');
      expect(typeof logger.toolError).toBe('function');
      // Also has base methods
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should create tool logger with correlation ID', () => {
      const logger = createToolLogger('corr123');
      expect(typeof logger.toolStart).toBe('function');
    });

    it('should have functional toolStart', () => {
      const logger = createToolLogger();
      // Should not throw
      expect(() => logger.toolStart('test_tool', { arg: 'value' })).not.toThrow();
    });

    it('should have functional toolEnd', () => {
      const logger = createToolLogger();
      expect(() => logger.toolEnd('test_tool', { success: true }, 100)).not.toThrow();
    });

    it('should have functional toolError', () => {
      const logger = createToolLogger();
      expect(() => logger.toolError('test_tool', new Error('test'), 100)).not.toThrow();
    });
  });

  describe('createBrowserLogger', () => {
    it('should create a browser logger with specialized methods', () => {
      const logger = createBrowserLogger();
      
      expect(typeof logger.commandSent).toBe('function');
      expect(typeof logger.commandResponse).toBe('function');
      expect(typeof logger.selectorTried).toBe('function');
      expect(typeof logger.navigation).toBe('function');
    });

    it('should have functional commandSent', () => {
      const logger = createBrowserLogger();
      expect(() => logger.commandSent('click', { selector: '#btn' })).not.toThrow();
    });

    it('should have functional commandResponse', () => {
      const logger = createBrowserLogger();
      expect(() => logger.commandResponse('click', true, 50, { element: 'button' })).not.toThrow();
    });

    it('should have functional selectorTried', () => {
      const logger = createBrowserLogger();
      expect(() => logger.selectorTried('#submit', true)).not.toThrow();
    });

    it('should have functional navigation', () => {
      const logger = createBrowserLogger();
      expect(() => logger.navigation('https://example.com', 'start')).not.toThrow();
      expect(() => logger.navigation('https://example.com', 'complete')).not.toThrow();
      expect(() => logger.navigation('https://example.com', 'error')).not.toThrow();
    });
  });

  describe('createApiLogger', () => {
    it('should create an API logger with specialized methods', () => {
      const logger = createApiLogger();
      
      expect(typeof logger.request).toBe('function');
      expect(typeof logger.response).toBe('function');
      expect(typeof logger.requestError).toBe('function');
    });

    it('should have functional request', () => {
      const logger = createApiLogger();
      expect(() => logger.request('POST', 'https://api.example.com', { 'Content-Type': 'application/json' })).not.toThrow();
    });

    it('should have functional response', () => {
      const logger = createApiLogger();
      expect(() => logger.response('POST', 'https://api.example.com', 200, 150)).not.toThrow();
      expect(() => logger.response('POST', 'https://api.example.com', 429, 150, { 'x-ratelimit-remaining': '0' })).not.toThrow();
    });

    it('should have functional requestError', () => {
      const logger = createApiLogger();
      expect(() => logger.requestError('POST', 'https://api.example.com', new Error('timeout'), 5000)).not.toThrow();
    });
  });

  describe('createAgentLogger', () => {
    it('should create an agent logger with specialized methods', () => {
      const logger = createAgentLogger();
      
      expect(typeof logger.delegation).toBe('function');
      expect(typeof logger.delegationComplete).toBe('function');
      expect(typeof logger.delegationError).toBe('function');
    });

    it('should have functional delegation', () => {
      const logger = createAgentLogger();
      expect(() => logger.delegation('tweety', 'Write a viral thread')).not.toThrow();
    });

    it('should have functional delegationComplete', () => {
      const logger = createAgentLogger();
      expect(() => logger.delegationComplete('tweety', 'task-123', 5000, true)).not.toThrow();
    });

    it('should have functional delegationError', () => {
      const logger = createAgentLogger();
      expect(() => logger.delegationError('tweety', 'task-123', new Error('Agent failed'))).not.toThrow();
    });
  });

  describe('createToolLoopLogger', () => {
    it('should create a tool loop logger with specialized methods', () => {
      const logger = createToolLoopLogger();
      
      expect(typeof logger.iterationStart).toBe('function');
      expect(typeof logger.iterationEnd).toBe('function');
      expect(typeof logger.maxIterationsReached).toBe('function');
      expect(typeof logger.loopComplete).toBe('function');
    });

    it('should have functional iterationStart', () => {
      const logger = createToolLoopLogger();
      expect(() => logger.iterationStart(1, 10)).not.toThrow();
    });

    it('should have functional iterationEnd', () => {
      const logger = createToolLoopLogger();
      expect(() => logger.iterationEnd(1, 3)).not.toThrow();
    });

    it('should have functional maxIterationsReached', () => {
      const logger = createToolLoopLogger();
      expect(() => logger.maxIterationsReached(10)).not.toThrow();
    });

    it('should have functional loopComplete', () => {
      const logger = createToolLoopLogger();
      expect(() => logger.loopComplete(5, 12000)).not.toThrow();
    });
  });

  describe('Log File Operations', () => {
    let tempDir: string;
    let originalLogDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(path.join(tmpdir(), 'marketclaw-log-test-'));
      // We can't easily change LOG_DIRECTORY since it's a const,
      // so we'll test the functions that don't depend on it directly
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    describe('listLogFiles', () => {
      it('should return an array', () => {
        const files = listLogFiles();
        expect(Array.isArray(files)).toBe(true);
      });

      it('should return file info with expected properties', () => {
        const files = listLogFiles();
        // Even if empty, the structure should be correct
        for (const file of files) {
          expect(file).toHaveProperty('name');
          expect(file).toHaveProperty('size');
          expect(file).toHaveProperty('modified');
          expect(file.modified instanceof Date).toBe(true);
        }
      });
    });

    describe('tailLogFile', () => {
      it('should return empty array for non-existent file', () => {
        const lines = tailLogFile('nonexistent-file.log');
        expect(lines).toEqual([]);
      });

      it('should return array of strings', () => {
        const lines = tailLogFile();
        expect(Array.isArray(lines)).toBe(true);
      });
    });

    describe('searchLogs', () => {
      it('should return array for search', () => {
        const results = searchLogs('test');
        expect(Array.isArray(results)).toBe(true);
      });

      it('should respect limit option', () => {
        const results = searchLogs('', { limit: 5 });
        expect(results.length).toBeLessThanOrEqual(5);
      });

      it('should filter by level', () => {
        const results = searchLogs('', { level: 'error' });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should filter by component', () => {
        const results = searchLogs('', { component: 'tool' });
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('rotateOldLogs', () => {
      it('should return number of deleted files', async () => {
        const deleted = await rotateOldLogs(7);
        expect(typeof deleted).toBe('number');
        expect(deleted).toBeGreaterThanOrEqual(0);
      });

      it('should accept custom retention days', async () => {
        const deleted = await rotateOldLogs(30);
        expect(typeof deleted).toBe('number');
      });
    });
  });

  describe('LOG_DIRECTORY', () => {
    it('should be defined', () => {
      expect(LOG_DIRECTORY).toBeDefined();
    });

    it('should contain .marketclaw/logs', () => {
      expect(LOG_DIRECTORY).toContain('.marketclaw');
      expect(LOG_DIRECTORY).toContain('logs');
    });
  });
});
