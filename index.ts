await import('./src/instrumentation'); // CRITICAL: MUST be imported first

import { loadConfig } from './src/config';
import { runSecurityAnalysis } from './src/graph';
import { sdk } from './src/instrumentation';

// Validate configuration
const config = loadConfig();

console.log(`[graphguard] Environment: ${config.nodeEnv}`);
console.log('[graphguard] Configuration validated successfully');
console.log('[graphguard] Starting OWASP security analysis...');

try {
  // Run security analysis on nodejs-goof
  const result = await runSecurityAnalysis({
    repoPath: config.workspaceRoot,
    userQuery: 'Analyze for OWASP Top 10 vulnerabilities',
  });

  console.log('\n[graphguard] ===== Analysis Complete =====');
  console.log(`[graphguard] Scan ID: ${result.scanId}`);
  console.log(`[graphguard] Status: ${result.status}`);
  console.log(`[graphguard] Total Findings: ${result.findings.length}`);
  console.log(`[graphguard] Categories Analyzed: ${result.analyzedCategories.length}`);

  if (result.findings.length > 0) {
    console.log('\n[graphguard] Top Findings:');
    result.findings.slice(0, 5).forEach((f, i) => {
      console.log(`  ${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
      console.log(`     Category: ${f.category}`);
      console.log(`     File: ${f.evidence.file}`);
    });
  }

  if (result.errors.length > 0) {
    console.log('\n[graphguard] Errors:');
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log('\n[graphguard] Summary:');
  console.log(result.summary);
} catch (error) {
  console.error('[graphguard] Analysis failed:', error);
} finally {
  // Flush spans before exit - critical for short-lived processes
  await sdk.shutdown();
  console.log('\n[graphguard] Traces flushed to Langfuse successfully');
}
