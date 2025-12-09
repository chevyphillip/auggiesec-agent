import { tracer } from '../../instrumentation';
import type { SecurityAnalysisState, GraphStatus } from '../state';

/**
 * Input node - initializes the scan and sets up tracking
 *
 * This is the entry point of the graph. It:
 * 1. Records the scan start time
 * 2. Sets status to 'running'
 * 3. Creates a trace span for observability
 */
export async function inputNode(
  state: SecurityAnalysisState
): Promise<Partial<SecurityAnalysisState>> {
  return tracer.startActiveSpan('node.input', async (span) => {
    try {
      const startedAt = new Date().toISOString();
      const status: GraphStatus = 'running';

      span.setAttributes({
        'scan.id': state.scanId,
        'repo.path': state.repoPath,
        'user.query': state.userQuery,
        'scope.filter': state.scopeFilter ?? 'none',
      });

      console.log(`[input] Starting scan ${state.scanId}`);
      console.log(`[input] Repository: ${state.repoPath}`);
      console.log(`[input] Query: ${state.userQuery}`);

      return {
        status,
        startedAt,
      };
    } finally {
      span.end();
    }
  });
}
