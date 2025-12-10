/**
 * Test script for enhanced Langfuse observability
 *
 * Runs a full security analysis and verifies traces are sent to Langfuse
 * with the correct observation types (agent, chain, retriever, tool).
 *
 * Usage: bun run scripts/test-observability.ts
 */

await import('../src/instrumentation'); // CRITICAL: MUST be imported first

import { getAugmentCredentials, loadConfig } from '../src/config';
import { sdk } from '../src/instrumentation';
import { runSecurityAnalysis } from '../src/graph';

// Validate configuration
const config = loadConfig();
const augmentCredentials = getAugmentCredentials(config);
console.log(`[test] Environment: ${config.nodeEnv}`);
console.log('[test] Configuration validated successfully');

console.log('\n=== Testing Enhanced Langfuse Observability ===\n');

try {
  // Run a full security analysis
  console.log('[test] Running security analysis on nodejs-goof...');

  const result = await runSecurityAnalysis({
    repoPath: './nodejs-goof',
    userQuery: 'Scan for all OWASP Top 10 vulnerabilities',
    augmentCredentials,
  });

  console.log('\n=== Analysis Results ===');
  console.log(`Scan ID: ${result.scanId}`);
  console.log(`Status: ${result.status}`);
  console.log(`Total Findings: ${result.findings.length}`);
  console.log(`Analyzed Categories: ${result.analyzedCategories.length}`);

  // Breakdown by severity
  const severityCounts = result.findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\nFindings by Severity:');
  for (const [severity, count] of Object.entries(severityCounts)) {
    console.log(`  ${severity}: ${count}`);
  }

  console.log('\n=== Expected Langfuse Observations ===');
  console.log('Check your Langfuse dashboard for:');
  console.log('1. Agent: graphguard_security_analysis (purple icon)');
  console.log('2. Span: security_analysis.run (blue icon)');
  console.log('3. Span: node.input, node.enumerate, node.analyze, etc.');
  console.log('4. Trace metadata: tags=[graphguard, owasp, security-analysis]');
  console.log('\nNote: Retriever/Tool observations will appear when tools are invoked.');
  console.log('      Generation observations will appear when LLM calls are made (Phase 4+).');
} catch (error) {
  console.error('[test] Error running security analysis:', error);
  process.exit(1);
} finally {
  // Flush all traces to Langfuse
  console.log('\n[test] Flushing traces to Langfuse...');
  await sdk.shutdown();
  console.log('[test] Traces flushed successfully!');
  console.log('\nVisit your Langfuse dashboard to verify the observations.');
}

