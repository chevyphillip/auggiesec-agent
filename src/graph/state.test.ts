import { describe, test, expect } from 'bun:test';
import {
  SecurityAnalysisStateAnnotation,
  OWASP_CATEGORIES,
  type SecurityFinding,
  type AnalysisTarget,
  type OwaspCategory,
} from './state';

describe('OWASP Categories', () => {
  test('contains all 10 OWASP Top 10 2021 categories', () => {
    expect(OWASP_CATEGORIES).toHaveLength(10);
  });

  test('categories are properly formatted', () => {
    for (const category of OWASP_CATEGORIES) {
      // Each category should start with A followed by 2 digits
      expect(category).toMatch(/^A\d{2}:2021-/);
    }
  });

  test('includes injection category', () => {
    expect(OWASP_CATEGORIES).toContain('A03:2021-Injection');
  });

  test('includes broken access control', () => {
    expect(OWASP_CATEGORIES).toContain('A01:2021-Broken Access Control');
  });
});

describe('SecurityAnalysisStateAnnotation', () => {
  test('annotation is defined', () => {
    expect(SecurityAnalysisStateAnnotation).toBeDefined();
  });

  test('annotation spec has expected keys', () => {
    const spec = SecurityAnalysisStateAnnotation.spec;
    expect(spec).toHaveProperty('repoPath');
    expect(spec).toHaveProperty('userQuery');
    expect(spec).toHaveProperty('scanId');
    expect(spec).toHaveProperty('status');
    expect(spec).toHaveProperty('targets');
    expect(spec).toHaveProperty('findings');
    expect(spec).toHaveProperty('analyzedCategories');
    expect(spec).toHaveProperty('errors');
    expect(spec).toHaveProperty('summary');
  });
});

describe('SecurityFinding type', () => {
  test('can create a valid finding', () => {
    const finding: SecurityFinding = {
      id: 'finding_123',
      category: 'A03:2021-Injection',
      title: 'SQL Injection vulnerability',
      severity: 'high',
      evidence: {
        file: 'src/routes/users.js',
        lineRange: '45-52',
        codeSnippet: 'db.query(userInput)',
      },
      explanation: 'User input is directly concatenated into SQL query',
      recommendedFix: 'Use parameterized queries',
    };

    expect(finding.id).toBe('finding_123');
    expect(finding.category).toBe('A03:2021-Injection');
    expect(finding.severity).toBe('high');
    expect(finding.evidence.file).toBe('src/routes/users.js');
  });

  test('severity types are correct', () => {
    const severities: SecurityFinding['severity'][] = [
      'critical',
      'high',
      'medium',
      'low',
      'info',
    ];

    for (const severity of severities) {
      const finding: SecurityFinding = {
        id: 'test',
        category: 'A01:2021-Broken Access Control',
        title: 'Test',
        severity,
        evidence: { file: 'test.js', lineRange: '1-1' },
        explanation: 'Test',
        recommendedFix: 'Test',
      };
      expect(finding.severity).toBe(severity);
    }
  });
});

describe('AnalysisTarget type', () => {
  test('can create valid targets', () => {
    const targets: AnalysisTarget[] = [
      { path: 'app.js', type: 'file' },
      { path: '/api/users', type: 'route', metadata: { method: 'GET' } },
      { path: 'UserController', type: 'controller' },
      { path: 'package.json', type: 'dependency' },
    ];

    expect(targets).toHaveLength(4);

    const fileTarget = targets[0];
    const routeTarget = targets[1];

    expect(fileTarget).toBeDefined();
    expect(routeTarget).toBeDefined();
    expect(fileTarget!.type).toBe('file');
    expect(routeTarget!.type).toBe('route');
    expect(routeTarget!.metadata?.method).toBe('GET');
  });
});

describe('OwaspCategory type', () => {
  test('accepts valid OWASP categories', () => {
    const category: OwaspCategory = 'A03:2021-Injection';
    expect(category).toBe('A03:2021-Injection');
  });

  test('all categories are valid OwaspCategory values', () => {
    for (const cat of OWASP_CATEGORIES) {
      const typed: OwaspCategory = cat;
      expect(typed).toBe(cat);
    }
  });
});
