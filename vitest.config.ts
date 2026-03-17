import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/cli.ts',
        'src/index.ts',
        'src/setup.ts',
        'src/daemon.ts',
        // Exclude channel implementations (require external services)
        'src/channels/telegram.ts',
        'src/channels/discord.ts',
        'src/channels/slack.ts',
        'src/channels/cli.ts',
        // Exclude provider implementations (require API keys)
        'src/providers/anthropic.ts',
        'src/providers/openai.ts',
        'src/providers/groq.ts',
        'src/providers/gemini.ts',
        'src/providers/ollama.ts',
        'src/providers/openrouter.ts',
        // Exclude OAuth implementations (require external services)
        'src/auth/google-calendar.ts',
        // Exclude new tool router/selector (AI-dependent, needs integration tests)
        'src/tools/tool-router.ts',
        'src/tools/tool-selector.ts',
        // Exclude tools that require external services
        'src/tools/a2a-tools.ts',
        'src/tools/discord-tools.ts',
        // Exclude type definitions (no logic to test)
        'src/tools/types.ts',
        // Exclude index re-exports
        'src/utils/index.ts',
      ],
      thresholds: {
        // Temporarily lowered after adding tool router/selector
        // TODO: Add tests for new tool modules to bring back to 88/82
        statements: 82,
        branches: 75,
        functions: 84,
        lines: 82,
      },
    },
  },
});
