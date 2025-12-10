import { END, START, StateGraph } from '@langchain/langgraph';
import { startActiveObservation, updateActiveTrace } from '@langfuse/tracing';
import { tracer } from '../instrumentation';
import {
    aggregateNode,
    analyzeNode,
    enumerateTargetsNode,
    inputNode,
    outputNode,
} from './nodes';
import {
    SecurityAnalysisStateAnnotation,
    type GraphInput,
    type GraphOutput,
    type SecurityAnalysisState,
} from './state';

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
 * Uses 'agent' observation type for top-level orchestration tracking.
 */
export async function runSecurityAnalysis(input: GraphInput): Promise<GraphOutput> {
  // Use 'agent' observation type for graph orchestration
  return startActiveObservation(
    'graphguard_security_analysis',
    async (agentObs) => {
      // Set trace-level context for all nested observations
      updateActiveTrace({
        name: `graphguard-scan`,
        tags: ['graphguard', 'owasp', 'security-analysis'],
        metadata: {
          repoPath: input.repoPath ?? './nodejs-goof',
          userQuery: input.userQuery,
        },
      });

      // Set agent observation input
      agentObs.update({
        input: {
          repoPath: input.repoPath ?? './nodejs-goof',
          userQuery: input.userQuery,
          scopeFilter: input.scopeFilter,
        },
        metadata: { agentType: 'security_analysis' },
      });

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
            augmentCredentials: input.augmentCredentials,
          });

          // Extract output from final state
          const state = result as SecurityAnalysisState;

          span.setAttributes({
            'scan.id': state.scanId,
            'scan.status': state.status,
            'findings.count': state.findings.length,
          });

          console.log(`[graph] Analysis complete: ${state.findings.length} findings`);

          const output: GraphOutput = {
            scanId: state.scanId,
            status: state.status,
            findings: state.findings,
            summary: state.summary ?? '',
            analyzedCategories: state.analyzedCategories,
            errors: state.errors,
            startedAt: state.startedAt,
            completedAt: state.completedAt,
          };

          // Update agent observation with output
          agentObs.update({
            output: {
              scanId: state.scanId,
              status: state.status,
              findingsCount: state.findings.length,
              analyzedCategories: state.analyzedCategories,
            },
          });

          return output;
        } catch (error) {
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      });
    },
    { asType: 'agent' }
  );
}

// Export types for use in other modules
export {
    OWASP_CATEGORIES, SecurityAnalysisStateAnnotation, type AnalysisTarget, type OwaspCategory, type SecurityAnalysisState,
    type SecurityFinding, type Severity
} from './state';
export type { GraphInput, GraphOutput } from './state';
