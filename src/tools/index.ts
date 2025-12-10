/**
 * GraphGuard Tools Module
 *
 * Provides tools for Auggie SDK integration and security analysis.
 * Tools follow the Vercel AI SDK format (ai-sdk compatible).
 *
 * @module tools
 */

// Auggie-based analysis (primary analysis method)
export { analyzeWithAuggie } from './auggie-analysis';
export type { AuggieAnalysisOptions, AuggieModel } from './auggie-analysis';

// Report vulnerability tool (used by Auggie during analysis)
export {
    clearFindings, getAndClearFindings, reportVulnerabilityTool
} from './report-vulnerability';
export type { ReportVulnerabilityInput } from './report-vulnerability';

// Langfuse prompt utilities
export {
    OWASP_PROMPTS,
    getLangfuseClient,
    getOwaspPrompt,
    getPrompt
} from './langfuse-prompts';
export type {
    CompiledPrompt,
    OwaspPromptName,
    PromptConfig
} from './langfuse-prompts';
