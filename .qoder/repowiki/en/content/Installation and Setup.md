# Installation and Setup

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [.env.example](file://.env.example)
- [index.ts](file://index.ts)
- [src/config.ts](file://src/config.ts)
- [src/instrumentation.ts](file://src/instrumentation.ts)
- [src/observability/index.ts](file://src/observability/index.ts)
- [src/tools/auggie-analysis.ts](file://src/tools/auggie-analysis.ts)
- [docs/AUGMENT_SDK_INTEGRATION.md](file://docs/AUGMENT_SDK_INTEGRATION.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Installation](#step-by-step-installation)
4. [Environment Configuration](#environment-configuration)
5. [Credential Management and Security Best Practices](#credential-management-and-security-best-practices)
6. [Validation and Scripts](#validation-and-scripts)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Conclusion](#conclusion)

## Introduction
This guide helps you prepare the OWASP GraphGuard environment from scratch. It focuses on installing dependencies, configuring environment variables, authenticating with Augment using the Auggie CLI, and validating your setup. The instructions are beginner-friendly while providing advanced details on credential management and security.

## Prerequisites
Before installing, ensure you have:
- Bun runtime installed
- A Langfuse account and API keys
- An Augment account and Auggie CLI installed and authenticated
- A target repository path configured (default included)

These requirements are described in the project’s README and validated by the configuration system.

**Section sources**
- [README.md](file://README.md#L27-L33)

## Step-by-Step Installation
Follow these steps to install and prepare the environment:

1. Install dependencies using Bun.
   - Use the command shown in the README.
   - This installs all runtime and development dependencies.

2. Create your local environment file.
   - Copy the example environment file to .env.
   - Fill in the required variables as documented below.

3. Start the application.
   - Run the main entrypoint script as shown in the README.

Notes:
- The README includes exact commands for installing dependencies, copying the environment file, and running the application.
- The package.json defines convenient scripts for development, testing, and type checking.

**Section sources**
- [README.md](file://README.md#L34-L41)
- [README.md](file://README.md#L65-L70)
- [package.json](file://package.json#L6-L12)

## Environment Configuration
Create and configure your .env file by copying the example and filling in the required values.

Key variables and their purposes:
- LANGFUSE_PUBLIC_KEY: Your Langfuse public key (starts with pk-lf-)
- LANGFUSE_SECRET_KEY: Your Langfuse secret key (starts with sk-lf-)
- LANGFUSE_BASE_URL: Optional base URL for Langfuse host (defaults to cloud endpoint if not set)
- AUGMENT_SESSION_AUTH: Recommended full JSON token from auggie token print (includes accessToken and tenantURL)
- AUGMENT_API_TOKEN: Alternative to SESSION_AUTH; your Augment API token
- AUGMENT_API_URL: Required with API_TOKEN; your Augment API URL
- ANTHROPIC_API_KEY: Required for LLM-based analysis (provider defaults to Anthropic)
- LLM_MODEL: Optional; defaults to a specific model if not set
- WORKSPACE_ROOT: Target repository path (default provided)
- NODE_ENV: Application environment (development by default)
- LOG_LEVEL: Logging verbosity (info by default)

Important notes:
- One of the following is required:
  - AUGMENT_SESSION_AUTH (full JSON token)
  - AUGMENT_API_TOKEN + AUGMENT_API_URL (separated credentials)
- The configuration system validates keys and rejects invalid formats.

**Section sources**
- [README.md](file://README.md#L42-L55)
- [.env.example](file://.env.example#L6-L33)
- [src/config.ts](file://src/config.ts#L35-L81)
- [src/config.ts](file://src/config.ts#L118-L153)

## Authenticating with Augment Using Auggie CLI
To authenticate with Augment:
1. Install and authenticate the Auggie CLI.
2. Print the token using the Auggie CLI command.
3. Copy the full JSON output and set it as the AUGMENT_SESSION_AUTH environment variable.

Why this method is recommended:
- The configuration system parses and validates the full JSON token at startup.
- It includes both the access token and tenant URL, reducing misconfiguration risk.

What the configuration expects:
- The JSON must include accessToken and tenantURL; scopes are optional.
- The system enforces URL validity and rejects malformed values.

**Section sources**
- [README.md](file://README.md#L56-L63)
- [src/config.ts](file://src/config.ts#L24-L28)
- [src/config.ts](file://src/config.ts#L46-L58)
- [docs/AUGMENT_SDK_INTEGRATION.md](file://docs/AUGMENT_SDK_INTEGRATION.md#L355-L368)

## Purpose of Each Environment Variable
Below is a concise explanation of each environment variable and its role in the system:

- LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY:
  - Required for observability and tracing via Langfuse.
  - Instrumentation validates their presence and format.

- LANGFUSE_BASE_URL:
  - Optional; sets the Langfuse host endpoint.
  - Defaults to the cloud endpoint if not provided.

- AUGMENT_SESSION_AUTH:
  - Recommended; full JSON token from auggie token print.
  - Contains accessToken and tenantURL; parsed and validated at startup.

- AUGMENT_API_TOKEN and AUGMENT_API_URL:
  - Alternative to SESSION_AUTH.
  - Must be provided together; URL must be valid.

- ANTHROPIC_API_KEY:
  - Required for LLM-based analysis (Anthropic provider).
  - Must start with the expected prefix.

- LLM_MODEL:
  - Optional; defaults to a specific model if not set.

- WORKSPACE_ROOT:
  - Target repository path scanned by the agent.
  - Defaults to a provided example path.

- NODE_ENV and LOG_LEVEL:
  - Runtime environment and logging verbosity.

**Section sources**
- [README.md](file://README.md#L42-L55)
- [.env.example](file://.env.example#L6-L33)
- [src/instrumentation.ts](file://src/instrumentation.ts#L94-L101)
- [src/config.ts](file://src/config.ts#L35-L81)

## Validation and Scripts
The project provides scripts to help you validate your setup:

- Development run:
  - Use the dev script to run the main entrypoint.

- Tests:
  - Run all tests or watch mode for continuous feedback.

- Type checking:
  - Validate TypeScript types without emitting JavaScript.

These scripts rely on the configuration system to validate environment variables and on instrumentation to initialize tracing.

**Section sources**
- [package.json](file://package.json#L6-L12)
- [index.ts](file://index.ts#L1-L10)
- [src/instrumentation.ts](file://src/instrumentation.ts#L118-L120)

## Credential Management and Security Best Practices
Managing credentials securely is critical. Follow these best practices:

- Prefer AUGMENT_SESSION_AUTH:
  - It reduces the chance of splitting credentials and avoids exposing separate tokens.
  - The configuration validates the JSON structure and URL format.

- Avoid committing secrets:
  - Keep .env out of version control.
  - Use OS-level secret stores or CI/CD secret management for automation.

- Scope least privilege:
  - Use the smallest scope necessary for analysis.
  - Review tenant URL and scopes in the session token.

- Rotate regularly:
  - Replace tokens periodically.
  - Update environment variables after rotation.

- Network and host configuration:
  - Ensure LANGFUSE_BASE_URL points to the correct host (cloud or self-hosted).
  - Validate URLs for both Langfuse and Augment endpoints.

- Observability and tracing:
  - Instrumentation initializes tracing early; ensure keys are present to avoid startup failures.
  - Use trace context and tool observations to monitor operations.

**Section sources**
- [src/config.ts](file://src/config.ts#L46-L58)
- [src/config.ts](file://src/config.ts#L35-L44)
- [src/instrumentation.ts](file://src/instrumentation.ts#L94-L101)
- [src/observability/index.ts](file://src/observability/index.ts#L28-L41)

## Troubleshooting Guide
Common issues and resolutions:

- Missing Langfuse keys:
  - Symptom: Startup exits immediately due to missing required keys.
  - Fix: Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env.

- Invalid or missing Augment credentials:
  - Symptom: Configuration validation fails for session or API token fields.
  - Fix: Provide either AUGMENT_SESSION_AUTH (JSON) or both AUGMENT_API_TOKEN and AUGMENT_API_URL. Ensure tenant URL is valid.

- Incorrect Anthropic key format:
  - Symptom: Validation error indicating wrong prefix.
  - Fix: Set ANTHROPIC_API_KEY to a valid value starting with the expected prefix.

- Missing WORKSPACE_ROOT:
  - Symptom: Default path used if not set.
  - Fix: Set WORKSPACE_ROOT to your target repository path.

- Auggie CLI not installed or unauthenticated:
  - Symptom: Cannot obtain a valid session token.
  - Fix: Install Auggie CLI, authenticate, and copy the full JSON output to AUGMENT_SESSION_AUTH.

- Traces not appearing in Langfuse:
  - Symptom: No traces observed.
  - Fix: Confirm keys are present and LANGFUSE_BASE_URL is correct; ensure the application runs to completion so spans flush.

**Section sources**
- [src/instrumentation.ts](file://src/instrumentation.ts#L94-L101)
- [src/config.ts](file://src/config.ts#L35-L81)
- [README.md](file://README.md#L56-L63)

## Conclusion
You now have the essentials to install, configure, and run OWASP GraphGuard. By following the steps above—installing dependencies, copying and editing .env, authenticating with Auggie CLI, and validating with the provided scripts—you can reliably scan codebases for OWASP Top 10 vulnerabilities with full observability. For advanced scenarios, leverage DirectContext, targeted search, and security profiles as documented in the integration guide.