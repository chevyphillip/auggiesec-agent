import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

// Store original environment
const originalEnv = { ...process.env };

describe('Graph', () => {
  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    // Set required env vars for tests
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test123';
    process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test456';
    process.env.LANGFUSE_HOST = 'https://cloud.langfuse.com';
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('createSecurityAnalysisGraph', () => {
    test('creates a compiled graph', async () => {
      const { createSecurityAnalysisGraph } = await import('./index');
      const graph = createSecurityAnalysisGraph();

      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe('function');
    });
  });

  describe('runSecurityAnalysis', () => {
    test('executes graph and returns output', async () => {
      const { runSecurityAnalysis } = await import('./index');

      const result = await runSecurityAnalysis({
        userQuery: 'Scan for injection vulnerabilities',
        repoPath: './test-repo',
      });

      expect(result).toBeDefined();
      expect(result.scanId).toMatch(/^scan_/);
      expect(result.status).toBe('completed');
      expect(Array.isArray(result.findings)).toBe(true);
      expect(Array.isArray(result.analyzedCategories)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.summary).toBe('string');
    });

    test('uses default repoPath when not provided', async () => {
      const { runSecurityAnalysis } = await import('./index');

      const result = await runSecurityAnalysis({
        userQuery: 'Test query',
      });

      expect(result.status).toBe('completed');
      expect(result.summary).toContain('./nodejs-goof');
    });

    test('generates real security findings', async () => {
      const { runSecurityAnalysis } = await import('./index');

      const result = await runSecurityAnalysis({
        userQuery: 'Find all security issues',
      });

      // Phase 4 real analysis generates actual findings from nodejs-goof
      expect(result.findings.length).toBeGreaterThanOrEqual(1);
      // Should find at least one OWASP category
      expect(result.analyzedCategories.length).toBeGreaterThanOrEqual(1);
      // Verify findings have required structure
      for (const finding of result.findings) {
        expect(finding.id).toBeDefined();
        expect(finding.category).toBeDefined();
        expect(finding.title).toBeDefined();
        expect(finding.severity).toBeDefined();
        expect(finding.evidence.file).toBeDefined();
        expect(finding.evidence.lineRange).toBeDefined();
        expect(finding.recommendedFix).toBeDefined();
      }
    });

    test('includes timing information', async () => {
      const { runSecurityAnalysis } = await import('./index');

      const result = await runSecurityAnalysis({
        userQuery: 'Test timing',
      });

      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();

      // Verify timestamps are valid ISO strings
      const started = new Date(result.startedAt!);
      const completed = new Date(result.completedAt!);
      expect(started.getTime()).toBeLessThanOrEqual(completed.getTime());
    });

    test('generates markdown summary', async () => {
      const { runSecurityAnalysis } = await import('./index');

      const result = await runSecurityAnalysis({
        userQuery: 'Generate report',
      });

      expect(result.summary).toContain('# Security Analysis Report');
      expect(result.summary).toContain('## Summary');
      expect(result.summary).toContain('## Findings');
      expect(result.summary).toContain('By Severity');
      expect(result.summary).toContain('By OWASP Category');
    });
  });

  describe('graph exports', () => {
    test('exports OWASP_CATEGORIES', async () => {
      const { OWASP_CATEGORIES } = await import('./index');
      expect(OWASP_CATEGORIES).toHaveLength(10);
    });

    test('exports SecurityAnalysisStateAnnotation', async () => {
      const { SecurityAnalysisStateAnnotation } = await import('./index');
      expect(SecurityAnalysisStateAnnotation).toBeDefined();
    });
  });
});
