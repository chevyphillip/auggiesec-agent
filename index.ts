// CRITICAL: Instrumentation MUST be imported first
// OpenTelemetry SDK must initialize before any other code runs
import './src/instrumentation';

import { loadConfig } from './src/config';

// Validate configuration
const config = loadConfig();

console.log(`[graphguard] Environment: ${config.nodeEnv}`);
console.log('[graphguard] Configuration validated successfully');
console.log('[graphguard] Hello via Bun!');
