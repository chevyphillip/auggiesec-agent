/**
 * Auggie SDK Tool Wrappers for GraphGuard
 *
 * These tools wrap Auggie SDK functionality for use in LangGraph nodes.
 * Tools follow the Vercel AI SDK format (ai-sdk compatible).
 *
 * @module tools
 */

// Auggie client
export {
    closeAuggieClient, getAuggieClient, getClientConfig, isAuggieClientInitialized
} from './auggie-client';
export type { AuggieClientConfig } from './auggie-client';

// Tools
export { analyzeDependenciesTool } from './analyze-dependencies';
export { getFileContentTool } from './get-file-content';
export { searchCodeTool } from './search-code';

// Langfuse prompt utilities
export {
    OWASP_PROMPTS, getLangfuseClient,
    getOwaspPrompt,
    getPrompt
} from './langfuse-prompts';
export type { CompiledPrompt, OwaspPromptName, PromptConfig } from './langfuse-prompts';

// Re-export types
export type {
    AnalyzeDependenciesInput,
    AnalyzeDependenciesResult
} from './analyze-dependencies';
export type { GetFileContentInput, GetFileContentResult } from './get-file-content';
export type { SearchCodeInput, SearchCodeResult } from './search-code';
