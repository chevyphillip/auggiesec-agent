# Contributing to OWASP GraphGuard

Thank you for your interest in contributing to OWASP GraphGuard!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/auggiesec-agent.git`
3. Install dependencies: `bun install`
4. Copy `.env.example` to `.env` and fill in your credentials
5. Run tests: `bun test`

## Development

### Prerequisites

- [Bun](https://bun.sh) runtime
- [Langfuse](https://langfuse.com) account
- [Augment](https://augmentcode.com) account with Auggie CLI

### Running Tests

```bash
bun test              # Run all tests
bun run type-check    # TypeScript validation
```

### Code Style

- TypeScript with strict mode enabled
- ES modules only (no CommonJS)
- Zod schemas for all input validation
- OpenTelemetry spans for all significant operations

## Submitting Changes

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run tests: `bun test && bun run type-check`
4. Commit with a clear message
5. Push and open a Pull Request

## Reporting Issues

Please use GitHub Issues to report bugs or request features. Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment details (Bun version, OS)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
