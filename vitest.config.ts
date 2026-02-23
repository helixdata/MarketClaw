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
      ],
      thresholds: {
        statements: 85,
        branches: 84,  // Slightly lowered due to hard-to-test OAuth flows
        functions: 85,
        lines: 85,
      },
    },
  },
});
