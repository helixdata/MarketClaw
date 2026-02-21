# Contributing to MarketClaw

Thanks for your interest in contributing! This guide will help you get started.

## Quick Links

- [Issues](https://github.com/marketclaw/marketclaw/issues) — Bug reports, feature requests
- [Discussions](https://github.com/marketclaw/marketclaw/discussions) — Questions, ideas
- [Code of Conduct](./CODE_OF_CONDUCT.md)

## Ways to Contribute

### 🐛 Report Bugs

1. Check if the issue already exists
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version)

### 💡 Suggest Features

1. Open a Discussion or Issue
2. Describe the use case
3. Explain why it would help

### 📖 Improve Documentation

- Fix typos, clarify explanations
- Add examples
- Translate to other languages

### 🔧 Submit Code

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/marketclaw.git
cd marketclaw

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run type checking
npm run typecheck

# Run linting
npm run lint
```

## Project Structure

```
marketclaw/
├── src/
│   ├── index.ts           # Main entry, agent startup
│   ├── cli.ts             # CLI commands
│   ├── providers/         # AI providers (anthropic, openai, etc.)
│   ├── channels/          # Interaction channels (telegram)
│   ├── tools/             # Agent tools
│   ├── memory/            # Persistent memory
│   ├── knowledge/         # Product knowledge base
│   ├── scheduler/         # Cron-like scheduling
│   ├── auth/              # Authentication
│   └── config/            # Configuration
├── docs/                  # Documentation
└── skills/                # Skill packages (future)
```

## Code Style

- **TypeScript** — All code in TypeScript
- **ESLint** — Run `npm run lint` before committing
- **Formatting** — 2 spaces, single quotes, semicolons
- **Naming** — camelCase for variables, PascalCase for classes

### Example Tool

```typescript
import { Tool, ToolResult } from './types.js';

export const exampleTool: Tool = {
  name: 'example_action',
  description: 'Does something useful. Called when user wants to...',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'The input to process' },
    },
    required: ['input'],
  },

  async execute(params): Promise<ToolResult> {
    const { input } = params;
    
    // Validate
    if (!input) {
      return { success: false, message: 'Input is required' };
    }
    
    // Do work
    const result = await doSomething(input);
    
    return {
      success: true,
      message: `Processed: ${input}`,
      data: result,
    };
  },
};
```

## Commit Messages

Use conventional commits:

```
feat: Add Twitter thread posting
fix: Correct timezone handling in scheduler
docs: Update provider setup instructions
refactor: Simplify tool registration
chore: Update dependencies
```

## Pull Request Process

1. **Create a branch**
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make changes**
   - Write code
   - Add tests if applicable
   - Update documentation

3. **Test locally**
   ```bash
   npm run typecheck
   npm run lint
   npm run dev  # Test manually
   ```

4. **Commit**
   ```bash
   git add .
   git commit -m "feat: Add cool new feature"
   ```

5. **Push and create PR**
   ```bash
   git push origin feat/my-feature
   ```
   Then open a PR on GitHub.

6. **Respond to feedback**
   - Address review comments
   - Push additional commits if needed

## Adding a New Provider

1. Create `src/providers/myprovider.ts`
2. Implement the `Provider` interface
3. Add to `src/providers/index.ts`
4. Update `PROVIDER_INFO` with metadata
5. Add documentation to `docs/PROVIDERS.md`

## Adding a New Tool

1. Create tool in appropriate file under `src/tools/`
2. Export from the file
3. Register in `src/tools/index.ts`
4. Document in `docs/TOOLS.md`

## Testing

Currently, testing is manual:

```bash
# Start dev mode
npm run dev

# In another terminal, interact via Telegram
# or test CLI commands
npx tsx src/cli.ts status
```

Automated testing is on the roadmap.

## Release Process

(For maintainers)

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Commit: `git commit -m "chore: Release v0.2.0"`
4. Tag: `git tag v0.2.0`
5. Push: `git push && git push --tags`
6. Publish: `npm publish`

## Questions?

- Open a [Discussion](https://github.com/marketclaw/marketclaw/discussions)
- Ask in issues with the `question` label

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
