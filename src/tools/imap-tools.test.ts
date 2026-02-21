/**
 * IMAP Tools Tests
 * Tests for himalaya-based email operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import {
  checkImapInboxTool,
  searchImapEmailsTool,
  readImapEmailTool,
  listImapFoldersTool,
  checkUnreadCountTool,
  replyImapEmailTool,
  sendImapEmailTool,
  checkImapAuthTool,
  imapTools,
} from './imap-tools.js';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('IMAP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ check_imap_inbox ============
  describe('checkImapInboxTool', () => {
    it('has correct metadata', () => {
      expect(checkImapInboxTool.name).toBe('check_imap_inbox');
      expect(checkImapInboxTool.description).toContain('IMAP');
    });

    it('returns emails from inbox', async () => {
      const mockEnvelopes = [
        {
          id: '123',
          date: '2024-01-15T10:00:00Z',
          from: { addr: 'sender@example.com' },
          subject: 'Test Email',
          flags: ['Seen'],
        },
        {
          id: '124',
          date: '2024-01-15T11:00:00Z',
          from: { addr: 'another@example.com' },
          subject: 'Another Email',
          flags: [],
        },
      ];
      mockExecSync.mockReturnValue(JSON.stringify(mockEnvelopes));

      const result = await checkImapInboxTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('2 email(s)');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: '123',
        date: '2024-01-15T10:00:00Z',
        from: 'sender@example.com',
        subject: 'Test Email',
        flags: ['Seen'],
      });
    });

    it('handles custom folder and limit', async () => {
      mockExecSync.mockReturnValue('[]');

      await checkImapInboxTool.execute({ folder: 'Sent', limit: 5 });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--folder "Sent"'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--page-size 5'),
        expect.any(Object)
      );
    });

    it('handles account parameter', async () => {
      mockExecSync.mockReturnValue('[]');

      await checkImapInboxTool.execute({ account: 'work' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--account work'),
        expect.any(Object)
      );
    });

    it('returns empty message when no emails', async () => {
      mockExecSync.mockReturnValue('[]');

      const result = await checkImapInboxTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No emails');
      expect(result.data).toEqual([]);
    });

    it('handles himalaya config error', async () => {
      const error = new Error('Command failed');
      (error as any).stderr = 'cannot find configuration file';
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await checkImapInboxTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Himalaya not configured');
    });

    it('handles generic error', async () => {
      const error = new Error('Connection refused');
      (error as any).stderr = 'Connection refused';
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await checkImapInboxTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
    });

    it('handles from as string (not object)', async () => {
      const mockEnvelopes = [
        {
          id: '123',
          date: '2024-01-15T10:00:00Z',
          from: 'plain@example.com',
          subject: 'Plain From',
          flags: [],
        },
      ];
      mockExecSync.mockReturnValue(JSON.stringify(mockEnvelopes));

      const result = await checkImapInboxTool.execute({});

      expect(result.data[0].from).toBe('plain@example.com');
    });
  });

  // ============ search_imap_emails ============
  describe('searchImapEmailsTool', () => {
    it('has correct metadata', () => {
      expect(searchImapEmailsTool.name).toBe('search_imap_emails');
      expect(searchImapEmailsTool.parameters.required).toContain('query');
    });

    it('searches with query', async () => {
      const mockResults = [
        {
          id: '200',
          date: '2024-01-10T09:00:00Z',
          from: { addr: 'match@example.com' },
          subject: 'Invoice 2024',
        },
      ];
      mockExecSync.mockReturnValue(JSON.stringify(mockResults));

      const result = await searchImapEmailsTool.execute({ query: 'invoice' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('1 result(s)');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('SUBJECT invoice OR FROM invoice OR BODY invoice'),
        expect.any(Object)
      );
    });

    it('uses custom folder and limit', async () => {
      mockExecSync.mockReturnValue('[]');

      await searchImapEmailsTool.execute({ 
        query: 'test', 
        folder: 'Archive', 
        limit: 50 
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--folder "Archive"'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--page-size 50'),
        expect.any(Object)
      );
    });

    it('returns empty results gracefully', async () => {
      mockExecSync.mockReturnValue('[]');

      const result = await searchImapEmailsTool.execute({ query: 'nonexistent' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('0 result(s)');
      expect(result.data).toEqual([]);
    });

    it('handles search error', async () => {
      const error = new Error('Search failed');
      (error as any).stderr = 'Invalid IMAP command';
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await searchImapEmailsTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid IMAP command');
    });
  });

  // ============ read_imap_email ============
  describe('readImapEmailTool', () => {
    it('has correct metadata', () => {
      expect(readImapEmailTool.name).toBe('read_imap_email');
      expect(readImapEmailTool.parameters.required).toContain('id');
    });

    it('reads email by id', async () => {
      const mockEmail = {
        id: '123',
        from: 'sender@example.com',
        to: 'me@example.com',
        subject: 'Important Message',
        body: 'Hello, this is the email body.',
      };
      mockExecSync.mockReturnValue(JSON.stringify(mockEmail));

      const result = await readImapEmailTool.execute({ id: '123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email retrieved');
      expect(result.data).toEqual(mockEmail);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('message read'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('123'),
        expect.any(Object)
      );
    });

    it('uses custom folder', async () => {
      mockExecSync.mockReturnValue('{}');

      await readImapEmailTool.execute({ id: '456', folder: 'Drafts' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--folder "Drafts"'),
        expect.any(Object)
      );
    });

    it('handles email not found', async () => {
      const error = new Error('Not found');
      (error as any).stderr = 'Message not found';
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await readImapEmailTool.execute({ id: '999' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Message not found');
    });
  });

  // ============ list_imap_folders ============
  describe('listImapFoldersTool', () => {
    it('has correct metadata', () => {
      expect(listImapFoldersTool.name).toBe('list_imap_folders');
    });

    it('lists all folders', async () => {
      const mockFolders = [
        { name: 'INBOX', delim: '/' },
        { name: 'Sent', delim: '/' },
        { name: 'Drafts', delim: '/' },
        { name: 'Archive', delim: '/' },
      ];
      mockExecSync.mockReturnValue(JSON.stringify(mockFolders));

      const result = await listImapFoldersTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('4 folder(s)');
      expect(result.data).toHaveLength(4);
      expect(result.data[0]).toEqual({ name: 'INBOX', delimiter: '/' });
    });

    it('handles empty folder list', async () => {
      mockExecSync.mockReturnValue('[]');

      const result = await listImapFoldersTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('0 folder(s)');
    });

    it('handles folder list error', async () => {
      const error = new Error('Failed');
      (error as any).stderr = 'Authentication failed';
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await listImapFoldersTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Authentication failed');
    });
  });

  // ============ check_unread_count ============
  describe('checkUnreadCountTool', () => {
    it('has correct metadata', () => {
      expect(checkUnreadCountTool.name).toBe('check_unread_count');
    });

    it('returns unread count', async () => {
      const mockUnread = [
        { id: '1', subject: 'Unread 1' },
        { id: '2', subject: 'Unread 2' },
        { id: '3', subject: 'Unread 3' },
      ];
      mockExecSync.mockReturnValue(JSON.stringify(mockUnread));

      const result = await checkUnreadCountTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('3 unread');
      expect(result.data.unread).toBe(3);
      expect(result.data.folder).toBe('INBOX');
    });

    it('checks UNSEEN query', async () => {
      mockExecSync.mockReturnValue('[]');

      await checkUnreadCountTool.execute({});

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--query "UNSEEN"'),
        expect.any(Object)
      );
    });

    it('handles zero unread', async () => {
      mockExecSync.mockReturnValue('[]');

      const result = await checkUnreadCountTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('No unread');
      expect(result.data.unread).toBe(0);
    });

    it('uses custom folder', async () => {
      mockExecSync.mockReturnValue('[]');

      const result = await checkUnreadCountTool.execute({ folder: 'Important' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--folder "Important"'),
        expect.any(Object)
      );
      expect(result.data.folder).toBe('Important');
    });
  });

  // ============ reply_imap_email ============
  describe('replyImapEmailTool', () => {
    it('has correct metadata', () => {
      expect(replyImapEmailTool.name).toBe('reply_imap_email');
      expect(replyImapEmailTool.parameters.required).toContain('id');
      expect(replyImapEmailTool.parameters.required).toContain('body');
    });

    it('sends reply successfully', async () => {
      mockExecSync.mockReturnValue('');

      const result = await replyImapEmailTool.execute({
        id: '123',
        body: 'Thanks for your message!',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Reply sent');
      expect(result.data.repliedTo).toBe('123');
    });

    it('uses piped echo command', async () => {
      mockExecSync.mockReturnValue('');

      await replyImapEmailTool.execute({
        id: '456',
        body: 'My reply',
        folder: 'Sent',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringMatching(/echo.*himalaya message reply/),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--folder "Sent"'),
        expect.any(Object)
      );
    });

    it('escapes quotes in body', async () => {
      mockExecSync.mockReturnValue('');

      await replyImapEmailTool.execute({
        id: '123',
        body: 'He said "hello"',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('\\"hello\\"'),
        expect.any(Object)
      );
    });

    it('handles reply error', async () => {
      const error = new Error('Failed');
      (error as any).stderr = 'SMTP error';
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await replyImapEmailTool.execute({
        id: '123',
        body: 'Reply',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('SMTP error');
    });
  });

  // ============ send_imap_email ============
  describe('sendImapEmailTool', () => {
    it('has correct metadata', () => {
      expect(sendImapEmailTool.name).toBe('send_imap_email');
      expect(sendImapEmailTool.parameters.required).toContain('to');
      expect(sendImapEmailTool.parameters.required).toContain('subject');
      expect(sendImapEmailTool.parameters.required).toContain('body');
    });

    it('sends email successfully', async () => {
      mockExecSync.mockReturnValue('');

      const result = await sendImapEmailTool.execute({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test body content',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('sent to recipient@example.com');
      expect(result.data.to).toBe('recipient@example.com');
      expect(result.data.subject).toBe('Test Subject');
    });

    it('includes CC when provided', async () => {
      mockExecSync.mockReturnValue('');

      await sendImapEmailTool.execute({
        to: 'main@example.com',
        subject: 'With CC',
        body: 'Body',
        cc: 'cc@example.com',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('Cc: cc@example.com'),
        expect.any(Object)
      );
    });

    it('uses message write command', async () => {
      mockExecSync.mockReturnValue('');

      await sendImapEmailTool.execute({
        to: 'test@example.com',
        subject: 'Subject',
        body: 'Body',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('himalaya message write'),
        expect.any(Object)
      );
    });

    it('handles send error', async () => {
      const error = new Error('Failed');
      (error as any).stderr = 'Recipient rejected';
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await sendImapEmailTool.execute({
        to: 'invalid',
        subject: 'Test',
        body: 'Body',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Recipient rejected');
    });
  });

  // ============ check_imap_auth ============
  describe('checkImapAuthTool', () => {
    it('has correct metadata', () => {
      expect(checkImapAuthTool.name).toBe('check_imap_auth');
    });

    it('returns authenticated with accounts', async () => {
      const mockAccounts = [
        { name: 'personal' },
        { name: 'work' },
      ];
      mockExecSync.mockReturnValue(JSON.stringify(mockAccounts));

      const result = await checkImapAuthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('2 account(s)');
      expect(result.data.authenticated).toBe(true);
      expect(result.data.accounts).toEqual(['personal', 'work']);
    });

    it('handles string account names', async () => {
      const mockAccounts = ['default', 'backup'];
      mockExecSync.mockReturnValue(JSON.stringify(mockAccounts));

      const result = await checkImapAuthTool.execute({});

      expect(result.data.accounts).toEqual(['default', 'backup']);
    });

    it('handles no accounts configured', async () => {
      mockExecSync.mockReturnValue('[]');

      const result = await checkImapAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('No accounts configured');
      expect(result.data.authenticated).toBe(false);
    });

    it('handles config file not found', async () => {
      const error = new Error('Failed');
      (error as any).stderr = 'cannot find configuration file';
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await checkImapAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Himalaya not configured');
      expect(result.data.authenticated).toBe(false);
    });

    it('handles other auth errors', async () => {
      const error = new Error('Failed');
      (error as any).stderr = 'Invalid credentials';
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await checkImapAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid credentials');
    });
  });

  // ============ imapTools export ============
  describe('imapTools array', () => {
    it('exports all 8 tools', () => {
      expect(imapTools).toHaveLength(8);
    });

    it('contains all expected tools', () => {
      const names = imapTools.map(t => t.name);
      expect(names).toContain('check_imap_inbox');
      expect(names).toContain('search_imap_emails');
      expect(names).toContain('read_imap_email');
      expect(names).toContain('list_imap_folders');
      expect(names).toContain('check_unread_count');
      expect(names).toContain('reply_imap_email');
      expect(names).toContain('send_imap_email');
      expect(names).toContain('check_imap_auth');
    });

    it('all tools have execute functions', () => {
      for (const tool of imapTools) {
        expect(typeof tool.execute).toBe('function');
      }
    });

    it('all tools have proper parameter definitions', () => {
      for (const tool of imapTools) {
        expect(tool.parameters.type).toBe('object');
        expect(tool.parameters.properties).toBeDefined();
      }
    });
  });

  // ============ execHimalaya edge cases ============
  describe('execHimalaya internal function', () => {
    it('handles non-JSON output gracefully', async () => {
      // Some himalaya commands return plain text
      mockExecSync.mockReturnValue('Success message');

      const result = await readImapEmailTool.execute({ id: '123' });

      // Should still succeed, data might be undefined
      expect(result.success).toBe(true);
    });

    it('handles error without stderr', async () => {
      const error = new Error('Generic error');
      mockExecSync.mockImplementation(() => { throw error; });

      const result = await checkImapInboxTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Generic error');
    });

    it('respects 30 second timeout', async () => {
      mockExecSync.mockReturnValue('[]');

      await checkImapInboxTool.execute({});

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('uses utf-8 encoding', async () => {
      mockExecSync.mockReturnValue('[]');

      await listImapFoldersTool.execute({});

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ encoding: 'utf-8' })
      );
    });

    it('appends --output json flag', async () => {
      mockExecSync.mockReturnValue('[]');

      await checkImapInboxTool.execute({});

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--output json'),
        expect.any(Object)
      );
    });
  });
});
