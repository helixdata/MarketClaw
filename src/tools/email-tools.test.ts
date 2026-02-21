/**
 * Email Tools Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmailTool, draftEmailTool, sendLaunchAnnouncementTool, checkEmailAuthTool } from './email-tools.js';

// Mock the config module
vi.mock('./config.js', () => ({
  getResendConfig: vi.fn().mockResolvedValue({
    apiKey: 'test-api-key',
    from: 'Test <test@example.com>',
  }),
  getGlobalToolConfig: vi.fn().mockResolvedValue({}),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('email-tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ send_email ============
  describe('send_email', () => {
    it('sends email successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-123' }),
      });

      const result = await sendEmailTool.execute({
        to: 'user@example.com',
        subject: 'Test Subject',
        body: 'Hello, this is a test email.',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Email sent to 1 recipient');
      expect(result.data?.id).toBe('email-123');
      expect(result.cost?.usd).toBe(0.001);
      expect(result.cost?.provider).toBe('resend');

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      // Verify body was sent as text (not HTML)
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.text).toBe('Hello, this is a test email.');
      expect(body.html).toBeUndefined();
    });

    it('returns preview in dry run mode', async () => {
      const result = await sendEmailTool.execute({
        to: 'user@example.com',
        subject: 'Test Subject',
        body: 'Test body content',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('preview');
      expect(result.data?.to).toBe('user@example.com');
      expect(result.data?.subject).toBe('Test Subject');
      expect(result.data?.bodyPreview).toContain('Test body');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('auto-detects HTML content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-456' }),
      });

      await sendEmailTool.execute({
        to: 'user@example.com',
        subject: 'HTML Email',
        body: '<h1>Hello</h1><p>This is HTML</p>',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.html).toBe('<h1>Hello</h1><p>This is HTML</p>');
      expect(body.text).toBeUndefined();
    });

    it('respects explicit isHtml flag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-789' }),
      });

      // Even without HTML tags, if isHtml is true, send as HTML
      await sendEmailTool.execute({
        to: 'user@example.com',
        subject: 'Plain as HTML',
        body: 'Plain text but treating as HTML',
        isHtml: true,
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.html).toBe('Plain text but treating as HTML');
      expect(body.text).toBeUndefined();
    });

    it('handles multiple recipients', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-multi' }),
      });

      const result = await sendEmailTool.execute({
        to: 'user1@example.com, user2@example.com, user3@example.com',
        subject: 'Multi Recipient',
        body: 'Hello everyone!',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('3 recipient');
      expect(result.data?.to).toHaveLength(3);
      expect(result.cost?.usd).toBe(0.003); // 3 * 0.001
      expect(result.cost?.units).toBe(3);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.to).toEqual(['user1@example.com', 'user2@example.com', 'user3@example.com']);
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid API key' }),
      });

      const result = await sendEmailTool.execute({
        to: 'user@example.com',
        subject: 'Test',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to send email');
      expect(result.message).toContain('Invalid API key');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await sendEmailTool.execute({
        to: 'user@example.com',
        subject: 'Test',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });

    it('uses custom from address when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-custom-from' }),
      });

      await sendEmailTool.execute({
        to: 'user@example.com',
        subject: 'Custom From',
        body: 'Test',
        from: 'Custom Sender <custom@example.com>',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.from).toBe('Custom Sender <custom@example.com>');
    });

    it('includes replyTo when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-reply' }),
      });

      await sendEmailTool.execute({
        to: 'user@example.com',
        subject: 'With Reply-To',
        body: 'Test',
        replyTo: 'reply@example.com',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.replyTo).toBe('reply@example.com');
    });
  });

  // ============ draft_email ============
  describe('draft_email', () => {
    it('returns email guidelines', async () => {
      const result = await draftEmailTool.execute({
        purpose: 'outreach to blogger',
      });

      expect(result.success).toBe(true);
      expect(result.data?.purpose).toBe('outreach to blogger');
      expect(result.data?.guidelines).toBeInstanceOf(Array);
      expect(result.data?.guidelines.length).toBeGreaterThan(0);
      expect(result.data?.templates).toBeDefined();
    });

    it('includes recipient context when provided', async () => {
      const result = await draftEmailTool.execute({
        purpose: 'follow-up',
        recipient: 'John from TechBlog',
      });

      expect(result.success).toBe(true);
      expect(result.data?.recipient).toBe('John from TechBlog');
    });

    it('sets default tone to professional', async () => {
      const result = await draftEmailTool.execute({
        purpose: 'cold outreach',
      });

      expect(result.data?.tone).toBe('professional');
    });

    it('uses specified tone', async () => {
      const result = await draftEmailTool.execute({
        purpose: 'thank you note',
        tone: 'friendly',
      });

      expect(result.data?.tone).toBe('friendly');
    });

    it('provides relevant templates', async () => {
      const result = await draftEmailTool.execute({
        purpose: 'launch announcement',
      });

      expect(result.data?.templates?.outreach).toBeDefined();
      expect(result.data?.templates?.announcement).toBeDefined();
      expect(result.data?.templates?.followUp).toBeDefined();
    });
  });

  // ============ send_launch_announcement ============
  describe('send_launch_announcement', () => {
    it('sends launch announcement successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'launch-123' }),
      });

      const result = await sendLaunchAnnouncementTool.execute({
        to: 'subscriber@example.com',
        productName: 'AwesomeApp',
        launchUrl: 'https://awesomeapp.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Launch announcement sent');
      expect(result.data?.id).toBe('launch-123');
      expect(result.cost?.provider).toBe('resend');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.subject).toContain('AwesomeApp');
      expect(body.subject).toContain('Live');
      expect(body.html).toContain('AwesomeApp');
      expect(body.html).toContain('https://awesomeapp.com');
    });

    it('returns preview in dry run mode', async () => {
      const result = await sendLaunchAnnouncementTool.execute({
        to: 'subscriber@example.com',
        productName: 'TestProduct',
        launchUrl: 'https://testproduct.com',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('preview');
      expect(result.data?.subject).toContain('TestProduct');
      expect(result.data?.htmlPreview).toBeDefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('includes offer when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'launch-offer' }),
      });

      await sendLaunchAnnouncementTool.execute({
        to: 'subscriber@example.com',
        productName: 'ProApp',
        launchUrl: 'https://proapp.com',
        offer: '50% off first month',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.html).toContain('50% off first month');
      expect(body.html).toContain('Launch offer');
    });

    it('includes tagline when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'launch-tagline' }),
      });

      await sendLaunchAnnouncementTool.execute({
        to: 'subscriber@example.com',
        productName: 'CoolTool',
        launchUrl: 'https://cooltool.com',
        tagline: 'The best tool ever made',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.html).toContain('The best tool ever made');
    });

    it('handles multiple recipients', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'launch-multi' }),
      });

      const result = await sendLaunchAnnouncementTool.execute({
        to: 'user1@example.com, user2@example.com',
        productName: 'MultiApp',
        launchUrl: 'https://multiapp.com',
      });

      expect(result.success).toBe(true);
      expect(result.cost?.units).toBe(2);
      expect(result.cost?.usd).toBe(0.002);
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      const result = await sendLaunchAnnouncementTool.execute({
        to: 'user@example.com',
        productName: 'FailApp',
        launchUrl: 'https://failapp.com',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to send');
    });
  });

  // ============ check_email_auth ============
  describe('check_email_auth', () => {
    it('returns authenticated with domains', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { name: 'example.com' },
            { name: 'myapp.io' },
          ],
        }),
      });

      const result = await checkEmailAuthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Resend connected');
      expect(result.message).toContain('example.com');
      expect(result.message).toContain('myapp.io');
      expect(result.data?.authenticated).toBe(true);
      expect(result.data?.domains).toEqual(['example.com', 'myapp.io']);
      expect(result.data?.defaultFrom).toBe('Test <test@example.com>');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/domains',
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer test-api-key' },
        })
      );
    });

    it('returns authenticated with no domains', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const result = await checkEmailAuthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.authenticated).toBe(true);
      expect(result.data?.domains).toEqual([]);
    });

    it('returns not configured when API key missing', async () => {
      // Override mock for this test
      const { getResendConfig } = await import('./config.js');
      vi.mocked(getResendConfig).mockResolvedValueOnce(null);

      // Also clear env var
      const originalEnv = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      const result = await checkEmailAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
      expect(result.data?.authenticated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();

      // Restore
      if (originalEnv) process.env.RESEND_API_KEY = originalEnv;
    });

    it('returns invalid when API key is rejected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      const result = await checkEmailAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid');
      expect(result.data?.authenticated).toBe(false);
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await checkEmailAuthTool.execute({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to verify');
      expect(result.message).toContain('Connection refused');
      expect(result.data?.authenticated).toBe(false);
    });

    it('accepts productId for per-product config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const { getResendConfig } = await import('./config.js');
      
      await checkEmailAuthTool.execute({ productId: 'my-product' });

      expect(getResendConfig).toHaveBeenCalledWith('my-product');
    });
  });

  // ============ Tool definitions ============
  describe('tool definitions', () => {
    it('send_email has correct structure', () => {
      expect(sendEmailTool.name).toBe('send_email');
      expect(sendEmailTool.description).toBeDefined();
      expect(sendEmailTool.parameters.required).toContain('to');
      expect(sendEmailTool.parameters.required).toContain('subject');
      expect(sendEmailTool.parameters.required).toContain('body');
    });

    it('draft_email has correct structure', () => {
      expect(draftEmailTool.name).toBe('draft_email');
      expect(draftEmailTool.parameters.required).toContain('purpose');
    });

    it('send_launch_announcement has correct structure', () => {
      expect(sendLaunchAnnouncementTool.name).toBe('send_launch_announcement');
      expect(sendLaunchAnnouncementTool.parameters.required).toContain('to');
      expect(sendLaunchAnnouncementTool.parameters.required).toContain('productName');
      expect(sendLaunchAnnouncementTool.parameters.required).toContain('launchUrl');
    });

    it('check_email_auth has correct structure', () => {
      expect(checkEmailAuthTool.name).toBe('check_email_auth');
      expect(checkEmailAuthTool.parameters.type).toBe('object');
    });
  });
});
