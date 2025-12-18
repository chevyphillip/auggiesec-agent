# Security Policy

## Reporting Security Vulnerabilities

We take the security of OWASP GraphGuard seriously. If you discover a security vulnerability, please follow responsible disclosure practices.

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, please report security issues by:

1. **Email**: Send details to the maintainers via GitHub's private vulnerability reporting feature
2. **GitHub Security Advisories**: Use the "Security" tab on this repository to report privately

### What to Include

Please provide:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if available)
- Your contact information for follow-up

### Response Timeline

- **Initial Response**: Within 48 hours of report
- **Status Update**: Within 7 days with assessment and timeline
- **Resolution**: Severity-dependent, critical issues prioritized

### Disclosure Policy

- We ask that you give us reasonable time to address the issue before public disclosure
- We will credit researchers who report valid vulnerabilities (unless you prefer to remain anonymous)
- Once a fix is released, we will publish a security advisory with details

### Security Best Practices for Users

When using OWASP GraphGuard:

- **NEVER commit your `.env` file** - it contains sensitive credentials
- Verify `.env` is listed in `.gitignore` before committing
- Use environment-specific configuration files for different deployments
- Rotate API tokens and credentials regularly
- Review security findings carefully before sharing scan results (may contain sensitive code snippets)

### Supported Versions

We provide security updates for:

- The latest release on the `main` branch
- The most recent tagged version

Older versions may not receive security patches. Please upgrade to the latest version.

### Security Features

OWASP GraphGuard includes built-in security measures:

- **Read-only security profiles**: Prevents AI models from modifying code
- **Sensitive data redaction**: Filters secrets from observability traces
- **Environment variable validation**: Zod schemas ensure proper configuration
- **No code execution**: Static analysis only, does not run target code

## Questions?

For general security questions (not vulnerability reports), please open a GitHub Discussion or contact the maintainers.
