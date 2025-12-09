import { SpanStatusCode } from '@opentelemetry/api';
import * as fs from 'fs';
import { tracer } from '../../instrumentation';
import type {
    AnalysisTarget,
    OwaspCategory,
    SecurityAnalysisState,
    SecurityFinding,
} from '../state';

/**
 * Security patterns to detect in code - organized by OWASP category
 */
const VULNERABILITY_PATTERNS: Record<
  OwaspCategory,
  { pattern: RegExp; title: string; severity: SecurityFinding['severity']; fix: string }[]
> = {
  'A01:2021-Broken Access Control': [
    {
      pattern: /\.(admin|isAdmin|role)\s*[=!]==?\s*['"]?(true|admin|root)/gi,
      title: 'Hard-coded admin check',
      severity: 'high',
      fix: 'Use proper RBAC (Role-Based Access Control) with database-backed permissions.',
    },
  ],
  'A02:2021-Cryptographic Failures': [
    {
      pattern: /md5|sha1(?!-)|createHash\(['"](?:md5|sha1)['"]\)/gi,
      title: 'Weak cryptographic algorithm',
      severity: 'medium',
      fix: 'Use SHA-256 or stronger hashing algorithms. For passwords, use bcrypt, scrypt, or Argon2.',
    },
    {
      pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi,
      title: 'Hard-coded password',
      severity: 'critical',
      fix: 'Remove hard-coded passwords and use environment variables or secrets management.',
    },
  ],
  'A03:2021-Injection': [
    {
      pattern: /exec\s*\(\s*[`'"].*\$\{/gi,
      title: 'Command injection via template literal',
      severity: 'critical',
      fix: 'Sanitize user input and use parameterized commands or child_process.execFile().',
    },
    {
      pattern: /exec\s*\([^)]*\+[^)]*\)/gi,
      title: 'Command injection via string concatenation',
      severity: 'critical',
      fix: 'Use child_process.execFile() with an array of arguments instead of exec().',
    },
    {
      pattern: /child_process.*exec\(/gi,
      title: 'Potential command injection via exec()',
      severity: 'high',
      fix: 'Use child_process.execFile() with an array of arguments instead of exec().',
    },
    {
      pattern: /eval\s*\(/gi,
      title: 'Use of eval() - potential code injection',
      severity: 'high',
      fix: 'Avoid eval(). Use JSON.parse() for JSON data or safer alternatives.',
    },
    {
      pattern: /new\s+Function\s*\(/gi,
      title: 'Dynamic function creation - potential code injection',
      severity: 'high',
      fix: 'Avoid dynamically creating functions from strings.',
    },
    {
      pattern: /\$where|mapReduce|group.*\$function/gi,
      title: 'MongoDB operator injection risk',
      severity: 'high',
      fix: 'Avoid $where and other JavaScript execution operators. Use aggregation pipeline instead.',
    },
    {
      pattern: /query\s*\+\s*req\.|SELECT.*\+.*req\.|INSERT.*\+.*req\./gi,
      title: 'SQL injection via string concatenation',
      severity: 'critical',
      fix: 'Use parameterized queries or an ORM with prepared statements.',
    },
  ],
  'A04:2021-Insecure Design': [],
  'A05:2021-Security Misconfiguration': [
    {
      pattern: /cors\(\s*\)|cors\(\s*\{\s*origin:\s*['"]\*['"]/gi,
      title: 'Permissive CORS configuration',
      severity: 'medium',
      fix: 'Restrict CORS to specific trusted origins instead of allowing all.',
    },
    {
      pattern: /helmet|security.*headers/gi,
      title: 'Security headers may be missing',
      severity: 'low',
      fix: 'Use helmet.js or manually set security headers (CSP, X-Frame-Options, etc.).',
    },
  ],
  'A06:2021-Vulnerable and Outdated Components': [],
  'A07:2021-Identification and Authentication Failures': [
    {
      pattern: /session\s*\(\s*\{[^}]*secret:\s*['"][^'"]{0,32}['"]/gi,
      title: 'Weak or short session secret',
      severity: 'high',
      fix: 'Use a cryptographically random session secret of at least 32 characters.',
    },
    {
      pattern: /secret:\s*['"](?:keyboard cat|secret|password|changeme|test|demo)['"]/gi,
      title: 'Common/default session secret',
      severity: 'critical',
      fix: 'Use a cryptographically random session secret. Never use common or default values.',
    },
    {
      pattern: /jwt\.sign\([^)]*expiresIn:\s*['"]?\d{1,2}[dh]['"]?/gi,
      title: 'Long JWT expiration',
      severity: 'medium',
      fix: 'Use shorter JWT expiration times and implement refresh tokens.',
    },
  ],
  'A08:2021-Software and Data Integrity Failures': [
    {
      pattern: /JSON\.parse\s*\(\s*req\./gi,
      title: 'Unsafe JSON parsing of user input',
      severity: 'medium',
      fix: 'Validate and sanitize input before parsing. Use a schema validator like Zod or Joi.',
    },
    {
      pattern: /_\.merge\s*\([^)]*req\./gi,
      title: 'Prototype pollution via lodash merge with user input',
      severity: 'critical',
      fix: 'Use Object.assign() with a null prototype object, or validate input against a whitelist of allowed properties.',
    },
    {
      pattern: /Object\.assign\s*\(\s*\{\s*\}[^)]*req\./gi,
      title: 'Potential prototype pollution via Object.assign',
      severity: 'high',
      fix: 'Use Object.assign(Object.create(null), ...) or validate input properties.',
    },
    {
      pattern: /extractAllTo|extractAll\s*\(/gi,
      title: 'Potential Zip Slip vulnerability',
      severity: 'high',
      fix: 'Validate that extracted file paths do not contain path traversal sequences (../) before extraction.',
    },
  ],
  'A09:2021-Security Logging and Monitoring Failures': [],
  'A10:2021-Server-Side Request Forgery': [
    {
      pattern: /fetch\s*\(\s*req\.|axios\s*\(\s*req\.|request\s*\(\s*req\./gi,
      title: 'Potential SSRF - user-controlled URL in HTTP request',
      severity: 'high',
      fix: 'Validate and whitelist URLs. Block internal IP ranges and localhost.',
    },
  ],
};

/**
 * Read file content safely
 */
function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Find line number for a match in content
 */
function findLineNumber(content: string, matchIndex: number): number {
  const lines = content.substring(0, matchIndex).split('\n');
  return lines.length;
}

/**
 * Extract code snippet around a match
 */
function extractCodeSnippet(
  content: string,
  matchIndex: number,
  contextLines: number = 2
): { snippet: string; startLine: number; endLine: number } {
  const lines = content.split('\n');
  const matchLine = findLineNumber(content, matchIndex);
  const startLine = Math.max(1, matchLine - contextLines);
  const endLine = Math.min(lines.length, matchLine + contextLines);

  const snippet = lines
    .slice(startLine - 1, endLine)
    .map((line, i) => `${startLine + i}: ${line}`)
    .join('\n');

  return { snippet, startLine, endLine };
}

/**
 * Analyze a single target for vulnerabilities
 */
async function analyzeTarget(
  target: AnalysisTarget,
  scanId: string
): Promise<SecurityFinding[]> {
  return tracer.startActiveSpan('analyze.target', async (span) => {
    const findings: SecurityFinding[] = [];

    try {
      span.setAttributes({
        'scan.id': scanId,
        'target.path': target.path,
        'target.type': target.type,
      });

      // Skip dependency files for pattern analysis (handled separately)
      if (target.type === 'dependency') {
        span.setStatus({ code: SpanStatusCode.OK });
        return findings;
      }

      // Read file content
      const content = readFileContent(target.path);
      if (!content) {
        span.setStatus({ code: SpanStatusCode.OK, message: 'File not readable' });
        return findings;
      }

      // Check each OWASP category
      for (const [category, patterns] of Object.entries(VULNERABILITY_PATTERNS) as [
        OwaspCategory,
        typeof VULNERABILITY_PATTERNS[OwaspCategory],
      ][]) {
        for (const { pattern, title, severity, fix } of patterns) {
          // Reset regex lastIndex for global patterns
          pattern.lastIndex = 0;
          let match: RegExpExecArray | null;

          while ((match = pattern.exec(content)) !== null) {
            const { snippet, startLine, endLine } = extractCodeSnippet(content, match.index);

            const finding: SecurityFinding = {
              id: `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              category,
              title,
              severity,
              evidence: {
                file: target.path,
                lineRange: `${startLine}-${endLine}`,
                codeSnippet: snippet,
              },
              explanation: `Found pattern matching "${title}" at line ${startLine}. Match: "${match[0].substring(0, 50)}${match[0].length > 50 ? '...' : ''}"`,
              recommendedFix: fix,
            };

            findings.push(finding);

            span.addEvent('vulnerability_found', {
              category,
              severity,
              line: startLine,
            });
          }
        }
      }

      span.setAttributes({
        'findings.count': findings.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
    } finally {
      span.end();
    }

    return findings;
  });
}

/**
 * Analyze node - performs OWASP-based security analysis
 *
 * Phase 4 implementation:
 * - Scans each target file for vulnerability patterns
 * - Matches patterns against OWASP Top 10 categories
 * - Extracts code snippets and line numbers for evidence
 * - Returns findings with recommended fixes
 */
export async function analyzeNode(
  state: SecurityAnalysisState
): Promise<Partial<SecurityAnalysisState>> {
  return tracer.startActiveSpan('node.analyze', async (span) => {
    try {
      span.setAttributes({
        'scan.id': state.scanId,
        'targets.count': state.targets.length,
      });

      console.log(`[analyze] Analyzing ${state.targets.length} targets`);

      const allFindings: SecurityFinding[] = [];
      const analyzedCategories = new Set<OwaspCategory>();

      // Analyze each target
      for (const target of state.targets) {
        const targetFindings = await analyzeTarget(target, state.scanId);
        allFindings.push(...targetFindings);

        // Track which categories were analyzed
        for (const finding of targetFindings) {
          analyzedCategories.add(finding.category);
        }
      }

      // Deduplicate findings by title + file + line range
      const uniqueFindings = allFindings.filter(
        (finding, index, self) =>
          index ===
          self.findIndex(
            (f) =>
              f.title === finding.title &&
              f.evidence.file === finding.evidence.file &&
              f.evidence.lineRange === finding.evidence.lineRange
          )
      );

      // Sort by severity
      const severityOrder: Record<SecurityFinding['severity'], number> = {
        critical: 1,
        high: 2,
        medium: 3,
        low: 4,
        info: 5,
      };
      uniqueFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      span.setAttributes({
        'findings.count': uniqueFindings.length,
        'findings.critical': uniqueFindings.filter((f) => f.severity === 'critical').length,
        'findings.high': uniqueFindings.filter((f) => f.severity === 'high').length,
        'findings.medium': uniqueFindings.filter((f) => f.severity === 'medium').length,
        'findings.low': uniqueFindings.filter((f) => f.severity === 'low').length,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      console.log(`[analyze] Generated ${uniqueFindings.length} findings`);
      console.log(
        `[analyze] Breakdown: ${uniqueFindings.filter((f) => f.severity === 'critical').length} critical, ` +
          `${uniqueFindings.filter((f) => f.severity === 'high').length} high, ` +
          `${uniqueFindings.filter((f) => f.severity === 'medium').length} medium, ` +
          `${uniqueFindings.filter((f) => f.severity === 'low').length} low`
      );

      return {
        findings: uniqueFindings,
        analyzedCategories: Array.from(analyzedCategories),
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
