# OWASP GraphGuard

AI-powered security scanner that analyzes codebases for OWASP Top 10 2021 vulnerabilities with full observability via Langfuse.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    LangGraph State Machine                       │
├─────────────────────────────────────────────────────────────────┤
│  input → enumerate → analyze → aggregate → output               │
│            │            │                                        │
│            ▼            ▼                                        │
│      File Discovery   Claude LLM + Auggie SDK                   │
│                       (OWASP prompts from Langfuse)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Langfuse Observability
                    (traces, spans, agents)
```

1. **Enumerate** - Discovers analysis targets (routes, controllers, configs)
2. **Analyze** - Claude LLM evaluates code against OWASP categories using prompts from Langfuse
3. **Aggregate** - Consolidates findings with severity and remediation guidance

## Requirements

- [Bun](https://bun.sh) runtime
- [Langfuse](https://langfuse.com) account (for observability + prompt management)
- [Anthropic](https://anthropic.com) API key (Claude)

## Setup

```bash
bun install
cp .env.example .env
# Fill in your API keys
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Yes | Langfuse public key (`pk-lf-...`) |
| `LANGFUSE_SECRET_KEY` | Yes | Langfuse secret key (`sk-lf-...`) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key (`sk-ant-...`) |
| `WORKSPACE_ROOT` | No | Target repo path (default: `./nodejs-goof`) |

## Usage

```bash
bun run index.ts
```

## Example Output

```
[graphguard] Starting OWASP security analysis...
[graph] Analysis complete: 41 findings

===== Analysis Complete =====
Scan ID: scan_1733849012653_abc123
Status: completed
Total Findings: 41
Categories Analyzed: 6

Top Findings:
  1. [CRITICAL] Command Injection in exec()
     Category: A03:2021-Injection
     File: routes/index.js

  2. [CRITICAL] NoSQL Injection via $where
     Category: A03:2021-Injection
     File: routes/users.js

  3. [HIGH] Hardcoded Database Credentials
     Category: A02:2021-Cryptographic Failures
     File: app.js
```

## Tests

```bash
bun test           # Run all tests
bun run type-check # TypeScript validation
```
