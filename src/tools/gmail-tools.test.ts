/**
 * Gmail Tools Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import {
  checkInboxTool,
  searchEmailsTool,
  readEmailThreadTool,
  getEmailTool,
  checkRepliesTool,
  monitorMarketingInboxTool,
  gmailTools,
} from './gmail-tools.js';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

// Sample test data
const mockThreads = [
  {
    id: 'thread-123',
    date: '2024-01-15T10:30:00Z',
    from: 'sender@example.com',
    subject: 'Test Email Subject',
    labels: ['INBOX', 'UNREAD'],
    messageCount: 1,
  },
  {
    id: 'thread-456',
    date: '2024-01-14T09:00:00Z',
    from: 'another@example.com',
    subject: 'Another Email',
    labels: ['INBOX'],
    messageCount: 3,
  },
];

const mockMessage = {
  id: 'msg-789',
  threadId: 'thread-123',
  date: '2024-01-15T10:30:00Z',
  from: 'sender@example.com',
  to: 'me@example.com',
  cc: 'cc@example.com',
  subject: 'Test Email Subject',
  body: 'This is the email body content.',
  labels: ['INBOX', 'UNREAD'],
  attachments: [],
};

const mockThread = {
  id: 'thread-123',
  subject: 'Test Thread Subject',
  messages: [
    {
      id: 'msg-1',
      date: '2024-01-15T10:00:00Z',
      from: 'sender@example.com',
      to: 'me@example.com',
      snippet: 'First message snippet',
      body: 'First message body',
    },
    {
      id: 'msg-2',
      date: '2024-01-15T11:00:00Z',
      from: 'me@example.com',
      to: 'sender@example.com',
      snippet: 'Reply snippet',
      body: 'Reply body',
    },
  ],
};

describe('Gmail Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('gmailTools export', () => {
    it('should export all 6 tools', () => {
      expect(gmailTools).toHaveLength(6);
      const names = gmailTools.map((t) => t.name);
      expect(names).toContain('check_inbox');
      expect(names).toContain('search_emails');
      expect(names).toContain('read_email_thread');
      expect(names).toContain('get_email');
      expect(names).toContain('check_email_replies');
      expect(names).toContain('monitor_marketing_inbox');
    });
  });

  describe('checkInboxTool', () => {
    it('should have correct metadata', () => {
      expect(checkInboxTool.name).toBe('check_inbox');
      expect(checkInboxTool.description).toContain('Gmail inbox');
      expect(checkInboxTool.parameters.properties).toHaveProperty('unreadOnly');
      expect(checkInboxTool.parameters.properties).toHaveProperty('limit');
      expect(checkInboxTool.parameters.properties).toHaveProperty('from');
    });

    it('should check unread emails by default', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: mockThreads }));

      const result = await checkInboxTool.execute({});

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail search "is:unread" --limit 10 --json',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('2 email(s)');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: 'thread-123',
        from: 'sender@example.com',
        subject: 'Test Email Subject',
      });
    });

    it('should search all inbox when unreadOnly is false', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      await checkInboxTool.execute({ unreadOnly: false });

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail search "in:inbox" --limit 10 --json',
        expect.any(Object)
      );
    });

    it('should respect custom limit', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      await checkInboxTool.execute({ limit: 25 });

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail search "is:unread" --limit 25 --json',
        expect.any(Object)
      );
    });

    it('should filter by sender when from is provided', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: mockThreads }));

      await checkInboxTool.execute({ from: 'boss@company.com' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail search "is:unread from:boss@company.com" --limit 10 --json',
        expect.any(Object)
      );
    });

    it('should return appropriate message for empty inbox', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      const result = await checkInboxTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('No unread emails');
      expect(result.data).toEqual([]);
    });

    it('should return different message for empty non-unread search', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      const result = await checkInboxTool.execute({ unreadOnly: false });

      expect(result.message).toBe('Inbox is empty');
    });

    it('should handle gog CLI errors', async () => {
      const error = new Error('CLI failed') as any;
      error.stderr = 'Authentication required';
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      const result = await checkInboxTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to check inbox');
      expect(result.message).toContain('Authentication required');
    });

    it('should handle missing stderr in error', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Generic error');
      });

      const result = await checkInboxTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Generic error');
    });
  });

  describe('searchEmailsTool', () => {
    it('should have correct metadata', () => {
      expect(searchEmailsTool.name).toBe('search_emails');
      expect(searchEmailsTool.parameters.required).toContain('query');
    });

    it('should execute search with query', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: mockThreads }));

      const result = await searchEmailsTool.execute({ query: 'from:test@example.com has:attachment' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail search "from:test@example.com has:attachment" --limit 10 --json',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('2 result(s)');
      expect(result.data).toHaveLength(2);
    });

    it('should use custom limit', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      await searchEmailsTool.execute({ query: 'subject:urgent', limit: 50 });

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail search "subject:urgent" --limit 50 --json',
        expect.any(Object)
      );
    });

    it('should handle search failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Search failed');
      });

      const result = await searchEmailsTool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Search failed');
    });

    it('should include query in result message', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      const result = await searchEmailsTool.execute({ query: 'important stuff' });

      expect(result.message).toContain('"important stuff"');
    });
  });

  describe('readEmailThreadTool', () => {
    it('should have correct metadata', () => {
      expect(readEmailThreadTool.name).toBe('read_email_thread');
      expect(readEmailThreadTool.parameters.required).toContain('threadId');
    });

    it('should fetch and format thread', async () => {
      mockExecSync.mockReturnValue(JSON.stringify(mockThread));

      const result = await readEmailThreadTool.execute({ threadId: 'thread-123' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail thread thread-123 --json',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test Thread Subject');
      expect(result.data.id).toBe('thread-123');
      expect(result.data.messages).toHaveLength(2);
      expect(result.data.messages[0].from).toBe('sender@example.com');
    });

    it('should truncate long message bodies', async () => {
      const longBody = 'x'.repeat(2000);
      const threadWithLongBody = {
        ...mockThread,
        messages: [{ ...mockThread.messages[0], body: longBody }],
      };
      mockExecSync.mockReturnValue(JSON.stringify(threadWithLongBody));

      const result = await readEmailThreadTool.execute({ threadId: 'thread-123' });

      expect(result.data.messages[0].body.length).toBe(1000);
    });

    it('should handle thread fetch failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Thread not found');
      });

      const result = await readEmailThreadTool.execute({ threadId: 'invalid-id' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to read thread');
    });

    it('should handle thread with no subject', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ id: 'thread-123', messages: [] }));

      const result = await readEmailThreadTool.execute({ threadId: 'thread-123' });

      expect(result.message).toContain('No subject');
    });

    it('should handle missing messages array', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ id: 'thread-123', subject: 'Test' }));

      const result = await readEmailThreadTool.execute({ threadId: 'thread-123' });

      expect(result.success).toBe(true);
      expect(result.data.messages).toEqual([]);
    });
  });

  describe('getEmailTool', () => {
    it('should have correct metadata', () => {
      expect(getEmailTool.name).toBe('get_email');
      expect(getEmailTool.parameters.required).toContain('messageId');
    });

    it('should fetch single email', async () => {
      mockExecSync.mockReturnValue(JSON.stringify(mockMessage));

      const result = await getEmailTool.execute({ messageId: 'msg-789' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail get msg-789 --json',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test Email Subject');
      expect(result.data).toMatchObject({
        id: 'msg-789',
        threadId: 'thread-123',
        from: 'sender@example.com',
        to: 'me@example.com',
        cc: 'cc@example.com',
        body: 'This is the email body content.',
        hasAttachments: false,
      });
    });

    it('should detect attachments', async () => {
      const msgWithAttachment = {
        ...mockMessage,
        attachments: [{ filename: 'doc.pdf', mimeType: 'application/pdf' }],
      };
      mockExecSync.mockReturnValue(JSON.stringify(msgWithAttachment));

      const result = await getEmailTool.execute({ messageId: 'msg-789' });

      expect(result.data.hasAttachments).toBe(true);
    });

    it('should handle message fetch failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Message not found');
      });

      const result = await getEmailTool.execute({ messageId: 'invalid-id' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to get email');
    });

    it('should handle message with no subject', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ id: 'msg-1' }));

      const result = await getEmailTool.execute({ messageId: 'msg-1' });

      expect(result.message).toContain('No subject');
    });
  });

  describe('checkRepliesTool', () => {
    it('should have correct metadata', () => {
      expect(checkRepliesTool.name).toBe('check_email_replies');
      expect(checkRepliesTool.parameters.properties).toHaveProperty('since');
      expect(checkRepliesTool.parameters.properties).toHaveProperty('limit');
    });

    it('should search for replies without date filter', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: mockThreads }));

      const result = await checkRepliesTool.execute({});

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail search "in:inbox -from:me" --limit 20 --json',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should filter to threads with multiple messages (replies)', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: mockThreads }));

      const result = await checkRepliesTool.execute({});

      // Only thread-456 has messageCount > 1
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('thread-456');
      expect(result.data[0].replyCount).toBe(2); // messageCount - 1
    });

    it('should parse "Xd" date format', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      // Mock Date.now for predictable test
      const mockDate = new Date('2024-01-20T12:00:00Z').getTime();
      vi.spyOn(Date, 'now').mockReturnValue(mockDate);

      await checkRepliesTool.execute({ since: '7d' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('after:2024-01-13'),
        expect.any(Object)
      );

      vi.restoreAllMocks();
    });

    it('should use explicit date format', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      await checkRepliesTool.execute({ since: '2024-01-01' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'gog gmail search "in:inbox -from:me after:2024-01-01" --limit 20 --json',
        expect.any(Object)
      );
    });

    it('should respect custom limit', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      await checkRepliesTool.execute({ limit: 50 });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--limit 50'),
        expect.any(Object)
      );
    });

    it('should handle search failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Search failed');
      });

      const result = await checkRepliesTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to check replies');
    });
  });

  describe('monitorMarketingInboxTool', () => {
    it('should have correct metadata', () => {
      expect(monitorMarketingInboxTool.name).toBe('monitor_marketing_inbox');
      expect(monitorMarketingInboxTool.parameters.properties).toHaveProperty('keywords');
    });

    it('should use default keywords when none provided', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      await monitorMarketingInboxTool.execute({});

      const call = mockExecSync.mock.calls[0][0] as string;
      expect(call).toContain('is:unread');
      expect(call).toContain('"partnership"');
      expect(call).toContain('"collaboration"');
      expect(call).toContain('"press"');
      expect(call).toContain('"review"');
      expect(call).toContain(' OR ');
    });

    it('should use custom keywords', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      await monitorMarketingInboxTool.execute({ keywords: 'startup,funding,investor' });

      const call = mockExecSync.mock.calls[0][0] as string;
      expect(call).toContain('"startup"');
      expect(call).toContain('"funding"');
      expect(call).toContain('"investor"');
    });

    it('should return found emails', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: mockThreads }));

      const result = await monitorMarketingInboxTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('2 potentially relevant email(s)');
      expect(result.data).toHaveLength(2);
    });

    it('should return appropriate message when no matches', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      const result = await monitorMarketingInboxTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('No matching emails found');
    });

    it('should handle search failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Search failed');
      });

      const result = await monitorMarketingInboxTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to search');
    });
  });

  describe('execGog internals', () => {
    it('should handle non-JSON output gracefully', async () => {
      // Return plain text instead of JSON
      mockExecSync.mockReturnValue('Success: email sent');

      const result = await checkInboxTool.execute({});

      // Should still succeed, but data parsing will handle missing threads
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should set timeout on execSync', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ threads: [] }));

      await checkInboxTool.execute({});

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 30000,
          encoding: 'utf-8',
        })
      );
    });

    it('should handle thrown string errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw 'String error';
      });

      const result = await checkInboxTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('String error');
    });
  });
});
