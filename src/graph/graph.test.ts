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

describe('Report Vulnerability Tool', () => {
  test('collects findings correctly', async () => {
    const {
      reportVulnerabilityTool,
      getAndClearFindings,
      clearFindings,
    } = await import('../tools/report-vulnerability');

    // Clear any previous findings
    clearFindings();

    // Execute the tool (assert execute exists)
    expect(reportVulnerabilityTool.execute).toBeDefined();
    const result = await reportVulnerabilityTool.execute!(
      {
        category: 'A03:2021-Injection',
        title: 'SQL Injection in user query',
        severity: 'critical',
        file: 'routes/users.js',
        lineRange: '45-52',
        codeSnippet: 'db.query(userInput)',
        explanation: 'User input is directly concatenated into SQL query',
        recommendedFix: 'Use parameterized queries',
      },
      {
        toolCallId: 'test-call-1',
        messages: [],
      }
    );

    expect(result).toContain('recorded');

    // Get findings
    const findings = getAndClearFindings();
    expect(findings).toHaveLength(1);
    expect(findings[0]!.category).toBe('A03:2021-Injection');
    expect(findings[0]!.title).toBe('SQL Injection in user query');
    expect(findings[0]!.severity).toBe('critical');
    expect(findings[0]!.evidence.file).toBe('routes/users.js');

    // Verify findings are cleared
    const emptyFindings = getAndClearFindings();
    expect(emptyFindings).toHaveLength(0);
  });

  test('generates unique finding IDs', async () => {
    const {
      reportVulnerabilityTool,
      getAndClearFindings,
      clearFindings,
    } = await import('../tools/report-vulnerability');

    clearFindings();

    // Add two findings
    await reportVulnerabilityTool.execute!(
      {
        category: 'A03:2021-Injection',
        title: 'Finding 1',
        severity: 'high',
        file: 'file1.js',
        lineRange: '1-5',
        explanation: 'Test',
        recommendedFix: 'Fix it',
      },
      { toolCallId: 'call-1', messages: [] }
    );

    await reportVulnerabilityTool.execute!(
      {
        category: 'A01:2021-Broken Access Control',
        title: 'Finding 2',
        severity: 'medium',
        file: 'file2.js',
        lineRange: '10-15',
        explanation: 'Test 2',
        recommendedFix: 'Fix it 2',
      },
      { toolCallId: 'call-2', messages: [] }
    );

    const findings = getAndClearFindings();
    expect(findings).toHaveLength(2);
    expect(findings[0]!.id).not.toBe(findings[1]!.id);
  });
});
