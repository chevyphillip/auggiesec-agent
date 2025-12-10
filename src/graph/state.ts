import { Annotation } from '@langchain/langgraph';
import type { AugmentCredentials } from '../config';

/**
 * OWASP Top 10 2021 Categories
 * Reference: https://owasp.org/Top10/
 */
export const OWASP_CATEGORIES = [
  'A01:2021-Broken Access Control',
  'A02:2021-Cryptographic Failures',
  'A03:2021-Injection',
  'A04:2021-Insecure Design',
  'A05:2021-Security Misconfiguration',
  'A06:2021-Vulnerable and Outdated Components',
  'A07:2021-Identification and Authentication Failures',
  'A08:2021-Software and Data Integrity Failures',
  'A09:2021-Security Logging and Monitoring Failures',
  'A10:2021-Server-Side Request Forgery',
] as const;

export type OwaspCategory = (typeof OWASP_CATEGORIES)[number];

/**
 * Severity levels for security findings
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Evidence for a security finding - where in the code the issue was found
 */
export interface FindingEvidence {
  file: string;
  lineRange: string; // e.g., "45-52"
  codeSnippet?: string;
}

/**
 * A security finding aligned to OWASP Top 10 2021
 * Per PRD Section 6.2: each finding must have category, title, severity, evidence, explanation, and recommended fix
 */
export interface SecurityFinding {
  id: string;
  category: OwaspCategory;
  title: string;
  severity: Severity;
  evidence: FindingEvidence;
  explanation: string;
  recommendedFix: string;
}

/**
 * Target file or code location to analyze
 */
export interface AnalysisTarget {
  path: string;
  type: 'file' | 'route' | 'controller' | 'dependency';
  metadata?: Record<string, string>;
}

/**
 * Graph execution status
 */
export type GraphStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * LangGraph state annotation for SecurityAnalysisState
 *
 * Uses LangGraph's Annotation pattern for proper state management.
 * The state flows through nodes: input -> enumerate -> analyze -> aggregate -> output
 */
export const SecurityAnalysisStateAnnotation = Annotation.Root({
  // Input fields (set at graph invocation)
  repoPath: Annotation<string>({
    reducer: (_, next) => next,
    default: () => './nodejs-goof',
  }),
  userQuery: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  scopeFilter: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Scan metadata
  scanId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  }),
  status: Annotation<GraphStatus>({
    reducer: (_, next) => next,
    default: () => 'pending',
  }),
  startedAt: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  completedAt: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Enumeration results (populated by enumerate_targets node)
  targets: Annotation<AnalysisTarget[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Analysis progress (updated by analysis nodes)
  analyzedCategories: Annotation<OwaspCategory[]>({
    reducer: (prev, next) => [...new Set([...prev, ...next])],
    default: () => [],
  }),
  currentCategory: Annotation<OwaspCategory | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Findings (accumulated across all analysis nodes)
  findings: Annotation<SecurityFinding[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Error tracking
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Output (populated by aggregate node)
  summary: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Augment credentials (set at graph invocation, immutable during execution)
  augmentCredentials: Annotation<AugmentCredentials>({
    reducer: (_, next) => next,
    default: () => ({ apiKey: '', apiUrl: '' }),
  }),
});

/**
 * Type inference for SecurityAnalysisState
 */
export type SecurityAnalysisState = typeof SecurityAnalysisStateAnnotation.State;

/**
 * Input type for graph invocation
 */
export interface GraphInput {
  repoPath?: string;
  userQuery: string;
  scopeFilter?: string;
  augmentCredentials: AugmentCredentials;
}

/**
 * Output type from graph execution
 */
export interface GraphOutput {
  scanId: string;
  status: GraphStatus;
  findings: SecurityFinding[];
  summary: string;
  analyzedCategories: OwaspCategory[];
  errors: string[];
  startedAt?: string;
  completedAt?: string;
}
