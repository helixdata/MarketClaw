# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to **brett@oneway.co.nz**.

You should receive a response within 48 hours. If for some reason you do not,
please follow up via email to ensure we received your original message.

Please include the following information:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the issue
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## What to Expect

- **Acknowledgment**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

We will work with you to understand and resolve the issue quickly.

## Security Best Practices for Users

### API Keys

- Never commit API keys to version control
- Use environment variables or `.env` files (add to `.gitignore`)
- Rotate keys periodically
- Use the minimum required permissions

### Telegram Bot

- Set `allowedUsers` in config to restrict access
- Use `adminUsers` for sensitive operations
- Keep your bot token secret

### Deployment

- Run as a non-root user
- Use HTTPS for any web endpoints
- Keep dependencies updated (`npm audit`)
- Review the [DAEMON.md](./docs/DAEMON.md) for secure deployment

## Dependencies

We regularly audit dependencies for known vulnerabilities:

```bash
npm audit
```

If you discover a vulnerability in a dependency, please report it to us
so we can assess the impact and update accordingly.
