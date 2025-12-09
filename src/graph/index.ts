import { StateGraph, END, START } from '@langchain/langgraph';
import { tracer } from '../instrumentation';
import {
  SecurityAnalysisStateAnnotation,
  type GraphInput,
  type GraphOutput,
  type SecurityAnalysisState,
} from './state';
import {
  inputNode,
  enumerateTargetsNode,
  analyzeNode,
  aggregateNode,
  outputNode,
} from './nodes';

/**
 * Create the security analysis graph
 *
 * Graph flow:
 *   START -> input -> enumerate -> analyze -> aggregate -> output -> END
 *
 * Each node:
 * - Receives the current state
 * - Returns partial state updates
 * - Is traced via OpenTelemetry
 */
export function createSecurityAnalysisGraph() {
  // Create the graph with our state annotation
  const graph = new StateGraph(SecurityAnalysisStateAnnotation)
    // Add nodes
    .addNode('input', inputNode)
    .addNode('enumerate', enumerateTargetsNode)
    .addNode('analyze', analyzeNode)
    .addNode('aggregate', aggregateNode)
    .addNode('output', outputNode)
    // Define edges (linear flow for Phase 3)
    .addEdge(START, 'input')
    .addEdge('input', 'enumerate')
    .addEdge('enumerate', 'analyze')
    .addEdge('analyze', 'aggregate')
    .addEdge('aggregate', 'output')
    .addEdge('output', END);

  // Compile the graph
  return graph.compile();
}

/**
 * Run a security analysis scan
 *
 * This is the main entry point for executing the graph.
 * It wraps the execution in a top-level trace span.
 */
export async function runSecurityAnalysis(input: GraphInput): Promise<GraphOutput> {
  return tracer.startActiveSpan('security_analysis.run', async (span) => {
    try {
      const graph = createSecurityAnalysisGraph();

      // Set span attributes for the top-level trace
      span.setAttributes({
        'repo.path': input.repoPath ?? './nodejs-goof',
        'user.query': input.userQuery,
        'scope.filter': input.scopeFilter ?? 'none',
      });

      console.log('[graph] Starting security analysis...');

      // Invoke the graph with input
      const result = await graph.invoke({
        repoPath: input.repoPath ?? './nodejs-goof',
        userQuery: input.userQuery,
        scopeFilter: input.scopeFilter,
      });

      // Extract output from final state
      const state = result as SecurityAnalysisState;

      span.setAttributes({
        'scan.id': state.scanId,
        'scan.status': state.status,
        'findings.count': state.findings.length,
      });

      console.log(`[graph] Analysis complete: ${state.findings.length} findings`);

      return {
        scanId: state.scanId,
        status: state.status,
        findings: state.findings,
        summary: state.summary ?? '',
        analyzedCategories: state.analyzedCategories,
        errors: state.errors,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      };
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// Export types for use in other modules
export type { GraphInput, GraphOutput } from './state';
export {
  SecurityAnalysisStateAnnotation,
  OWASP_CATEGORIES,
  type SecurityAnalysisState,
  type SecurityFinding,
  type OwaspCategory,
  type Severity,
  type AnalysisTarget,
} from './state';
