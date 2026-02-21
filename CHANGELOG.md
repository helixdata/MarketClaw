# Changelog

All notable changes to MarketClaw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-02-21

### Added

- **Multi-Provider Support**: Full support for 6 AI providers
  - Anthropic (Claude) - existing, improved
  - OpenAI (GPT) - existing, improved
  - Groq - new, ultra-fast inference
  - Google Gemini - new
  - Ollama - new, local models
  - OpenRouter - new, multi-provider gateway
  
- **Skills System**: Modular, installable capabilities
  - Skill loader for discovering and loading skills
  - Marketplace tools for searching/installing skills
  - CLI commands: `skill list`, `skill search`, `skill install`, etc.
  - Self-contained skill packages with manifest (skill.json)
  
- **Improved Setup Wizard**: Interactive, <5 minute setup
  - Clear step-by-step flow
  - API key validation
  - Environment variable detection
  - Missing secrets guidance
  
- **CLI Enhancements**
  - `provider list` - show available providers
  - `provider test <name>` - test provider connection
  - Full skill management commands
  
- **Documentation**
  - `docs/SETUP.md` - detailed setup guide
  - `docs/PROVIDERS.md` - provider configuration
  - `docs/TOOLS.md` - tool reference and creation guide
  - `docs/SKILLS.md` - skill system documentation
  - `docs/CONTRIBUTING.md` - contribution guidelines
  - Polished README with clear value prop

### Fixed

- TypeScript error in gmail-tools.ts (parameter type)

### Changed

- Provider registry now exports metadata for setup wizard
- Cleaner architecture for swappable providers
- README restructured for open source release

## [0.1.0] - 2025-02-20

### Added

- Initial release
- Telegram integration
- Multi-provider AI (Anthropic, OpenAI)
- Persistent memory (products, campaigns)
- Knowledge base with embeddings
- Scheduling system
- Built-in tools (email, scheduler, knowledge)
- Twitter, LinkedIn, Product Hunt tools
- Image generation
- Leads management (CRM-lite)
