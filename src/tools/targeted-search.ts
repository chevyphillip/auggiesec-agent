/**
 * Targeted Search for Vulnerability Patterns
 *
 * Uses DirectContext.search() to find specific vulnerability patterns
 * before LLM analysis. This improves accuracy by:
 * - Pre-filtering code to relevant sections
 * - Reducing false positives
 * - Focusing LLM analysis on high-risk code
 *
 * ## Search Strategy
 *
 * Each OWASP category has tailored search queries that target:
 * - Common vulnerability patterns
 * - Security-sensitive APIs
 * - High-risk code constructs
 *
 * @module tools/targeted-search
 */

import type { DirectContext } from '@augmentcode/auggie-sdk';
import { SpanStatusCode } from '@opentelemetry/api';
import type { OwaspCategory } from '../graph/state';
import { tracer } from '../instrumentation';

/**
 * Search result with context
 */
export interface SearchResult {
  /** The formatted search results ready for LLM consumption */
  formattedResults: string;
  /** Number of code chunks found */
  chunkCount: number;
  /** Total characters in results */
  resultLength: number;
}

/**
 * Build targeted search queries for each OWASP category
 * These queries are designed to find specific vulnerability patterns
 */
export function buildVulnerabilitySearchQuery(category: OwaspCategory): string {
  const queries: Record<string, string> = {
    'A01:2021-Broken Access Control':
      'authorization checks, permission validation, role-based access control, ' +
      'access control middleware, authentication guards, user permissions',

    'A02:2021-Cryptographic Failures':
      'encryption, decryption, hashing, password storage, crypto libraries, ' +
      'sensitive data handling, TLS/SSL configuration, key management',

    'A03:2021-Injection':
      'SQL queries, database operations, user input handling, query building, ' +
      'command execution, eval, template rendering, LDAP queries',

    'A04:2021-Insecure Design':
      'security requirements, threat modeling, security controls, ' +
      'design patterns, architecture decisions, security boundaries',

    'A05:2021-Security Misconfiguration':
      'configuration files, environment variables, default settings, ' +
      'security headers, CORS configuration, error handling',

    'A06:2021-Vulnerable and Outdated Components':
      'package.json, dependencies, imports, require statements, ' +
      'third-party libraries, npm packages, version specifications',

    'A07:2021-Identification and Authentication Failures':
      'login, authentication, session management, password handling, ' +
      'token generation, credential storage, multi-factor authentication',

    'A08:2021-Software and Data Integrity Failures':
      'serialization, deserialization, data validation, integrity checks, ' +
      'digital signatures, checksum verification, untrusted data',

    'A09:2021-Security Logging and Monitoring Failures':
      'logging, monitoring, audit trails, error handling, ' +
      'security events, log aggregation, alerting',

    'A10:2021-Server-Side Request Forgery':
      'HTTP requests, URL handling, fetch, axios, request libraries, ' +
      'external API calls, URL validation, SSRF protection',
  };

  return queries[category] || category;
}

/**
 * Perform targeted search for vulnerability patterns
 *
 * @param context - DirectContext instance
 * @param category - OWASP category to search for
 * @param scanId - Scan ID for tracing
 * @param maxOutputLength - Maximum length of search results (default: 40000)
 * @returns Search results with metadata
 */
export async function searchForVulnerabilities(
  context: DirectContext,
  category: OwaspCategory,
  scanId: string,
  maxOutputLength = 40000
): Promise<SearchResult> {
  return tracer.startActiveSpan('targeted_search.search', async (span) => {
    try {
      span.setAttributes({
        'scan.id': scanId,
        'owasp.category': category,
        'search.max_output_length': maxOutputLength,
      });

      const searchQuery = buildVulnerabilitySearchQuery(category);
      console.log(`[targeted-search] Searching for ${category}`);
      console.log(`[targeted-search] Query: ${searchQuery.substring(0, 100)}...`);

      const formattedResults = await context.search(searchQuery, {
        maxOutputLength,
      });

      // Count chunks (each chunk is typically separated by file headers)
      const chunkCount = (formattedResults.match(/^##\s+/gm) || []).length;
      const resultLength = formattedResults.length;

      console.log(`[targeted-search] Found ${chunkCount} code chunks (${resultLength} chars)`);

      span.setAttributes({
        'search.chunk_count': chunkCount,
        'search.result_length': resultLength,
        'search.has_results': resultLength > 0,
      });

      span.setStatus({ code: SpanStatusCode.OK });

      return {
        formattedResults,
        chunkCount,
        resultLength,
      };
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}



/**
 * Perform combined search and LLM analysis in a single call
 *
 * This uses DirectContext.searchAndAsk() which:
 * 1. Searches for relevant code using semantic search
 * 2. Passes results to LLM for analysis
 * 3. Returns the LLM's answer
 *
 * This is more efficient than separate search + prompt calls.
 *
 * @param context - DirectContext instance
 * @param category - OWASP category to analyze
 * @param scanId - Scan ID for tracing
 * @returns LLM analysis of found vulnerabilities
 */
export async function searchAndAnalyze(
  context: DirectContext,
  category: OwaspCategory,
  scanId: string
): Promise<string> {
  return tracer.startActiveSpan('targeted_search.search_and_analyze', async (span) => {
    try {
      span.setAttributes({
        'scan.id': scanId,
        'owasp.category': category,
      });

      const searchQuery = buildVulnerabilitySearchQuery(category);

      // Build analysis prompt
      const analysisPrompt = buildAnalysisPrompt(category);

      console.log(`[targeted-search] Searching and analyzing for ${category}`);

      const answer = await context.searchAndAsk(searchQuery, analysisPrompt);

      span.setAttributes({
        'analysis.length': answer.length,
        'analysis.has_results': answer.length > 0,
      });

      span.setStatus({ code: SpanStatusCode.OK });

      return answer;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Build analysis prompt for a specific OWASP category
 */
function buildAnalysisPrompt(category: OwaspCategory): string {
  const categoryCode = category.split(':')[0] ?? 'A00';
  const categoryName = category.split('-')[1] ?? category;

  return `You are a security expert analyzing code for ${category} vulnerabilities.

Analyze the provided code for potential security issues related to ${categoryName}.

For each vulnerability found, provide:
1. **Severity**: CRITICAL, HIGH, MEDIUM, or LOW
2. **Title**: Brief description of the issue
3. **Description**: Detailed explanation of the vulnerability
4. **Location**: File path and line numbers
5. **Recommendation**: How to fix the issue

Return your findings as a JSON array with this structure:
\`\`\`json
[
  {
    "severity": "HIGH",
    "title": "SQL Injection in user query",
    "description": "User input is directly concatenated into SQL query without sanitization",
    "filePath": "src/database/users.ts",
    "lineStart": 45,
    "lineEnd": 47,
    "codeSnippet": "const query = 'SELECT * FROM users WHERE id = ' + userId;",
    "recommendation": "Use parameterized queries or an ORM to prevent SQL injection"
  }
]
\`\`\`

If no vulnerabilities are found, return an empty array: []

Focus on real security issues, not style or best practices unless they have security implications.`;
}
