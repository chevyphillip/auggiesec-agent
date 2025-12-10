/**
 * DirectContext-based Security Analysis
 *
 * Uses DirectContext for persistent indexing with state management.
 * This approach is significantly faster than Auggie for repeated scans
 * because it maintains indexed state between runs.
 *
 * ## Key Features
 *
 * - **Persistent Indexing**: Index once, reuse across scans
 * - **State Export/Import**: Save and restore indexed state
 * - **Incremental Updates**: Only re-index changed files
 * - **Targeted Search**: Find specific vulnerability patterns efficiently
 *
 * ## Authentication
 *
 * Same as Auggie SDK:
 * 1. **AUGMENT_SESSION_AUTH** - Full JSON token from `auggie token print`
 * 2. **AUGMENT_API_TOKEN + AUGMENT_API_URL** - Separated credentials
 * 3. **~/.augment/session.json** - Automatic from `auggie login`
 *
 * @module tools/direct-context-analysis
 */

import type { File } from '@augmentcode/auggie-sdk';
import { APIError, BlobTooLargeError, DirectContext } from '@augmentcode/auggie-sdk';
import { SpanStatusCode } from '@opentelemetry/api';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { Config } from '../config';
import type { OwaspCategory } from '../graph/state';
import { tracer } from '../instrumentation';

/**
 * Augment-specific configuration subset for DirectContext
 */
export type DirectContextConfig = Pick<Config, 'augment' | 'nodeEnv'>;

interface DirectContextCredentials {
  apiKey?: string;
  apiUrl?: string;
}

/**
 * Get DirectContext credentials from config or environment variables (fallback)
 * @param config - Optional validated config from loadConfig()
 */
function getDirectContextCredentials(config?: DirectContextConfig): DirectContextCredentials {
  // Use validated config if provided
  const sessionAuth = config?.augment?.sessionAuth ?? process.env.AUGMENT_SESSION_AUTH;
  if (sessionAuth) {
    try {
      const parsed = JSON.parse(sessionAuth);
      if (parsed.accessToken && parsed.tenantURL) {
        return {
          apiKey: parsed.accessToken,
          apiUrl: parsed.tenantURL,
        };
      }
    } catch {
      console.warn('[direct-context] Failed to parse AUGMENT_SESSION_AUTH');
    }
  }

  // Fallback to separated token/URL from config or env vars
  return {
    apiKey: config?.augment?.apiToken ?? process.env.AUGMENT_API_TOKEN,
    apiUrl: config?.augment?.apiUrl ?? process.env.AUGMENT_API_URL,
  };
}

/**
 * Recursively read all files from a directory
 * Filters out common non-source files and directories
 */
async function readDirectoryFiles(dirPath: string): Promise<File[]> {
  const files: File[] = [];
  const excludeDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '.cache',
  ]);
  const excludeExtensions = new Set(['.jpg', '.png', '.gif', '.pdf', '.zip']);

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = entry.name.substring(entry.name.lastIndexOf('.'));
        if (!excludeExtensions.has(ext) && !entry.name.startsWith('.')) {
          try {
            const contents = await readFile(fullPath, 'utf-8');
            const relativePath = relative(dirPath, fullPath);
            files.push({ path: relativePath, contents });
          } catch (error) {
            console.warn(`[direct-context] Failed to read ${fullPath}:`, error);
          }
        }
      }
    }
  }

  await walk(dirPath);
  return files;
}

/**
 * Create or restore a DirectContext instance
 *
 * @param stateFilePath - Optional path to saved state file
 * @param config - Optional validated config from loadConfig()
 * @returns DirectContext instance
 */
export async function createDirectContext(
  stateFilePath?: string,
  config?: DirectContextConfig
): Promise<DirectContext> {
  return tracer.startActiveSpan('direct_context.create', async (span) => {
    try {
      const credentials = getDirectContextCredentials(config);
      const nodeEnv = config?.nodeEnv ?? process.env.NODE_ENV;
      const isDebug = nodeEnv === 'development';
      let context: DirectContext;

      if (stateFilePath) {
        console.log(`[direct-context] Importing state from ${stateFilePath}`);
        span.setAttribute('state.import', true);
        span.setAttribute('state.file', stateFilePath);

        context = await DirectContext.importFromFile(stateFilePath, {
          ...credentials,
          debug: isDebug,
        });

        const indexedPaths = context.getIndexedPaths();
        console.log(`[direct-context] Restored ${indexedPaths.length} indexed files`);
        span.setAttribute('state.indexed_files', indexedPaths.length);
      } else {
        console.log('[direct-context] Creating new context');
        span.setAttribute('state.import', false);

        context = await DirectContext.create({
          ...credentials,
          debug: isDebug,
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return context;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Index a repository using DirectContext
 *
 * @param context - DirectContext instance
 * @param repoPath - Path to repository
 * @param scanId - Scan ID for tracing
 * @returns Number of files indexed
 */
export async function indexRepository(
  context: DirectContext,
  repoPath: string,
  scanId: string
): Promise<number> {
  return tracer.startActiveSpan('direct_context.index_repository', async (span) => {
    try {
      span.setAttributes({
        'scan.id': scanId,
        'repo.path': repoPath,
      });

      console.log(`[direct-context] Reading files from ${repoPath}`);
      const files = await readDirectoryFiles(repoPath);
      console.log(`[direct-context] Found ${files.length} files to index`);

      span.setAttribute('files.total', files.length);

      if (files.length === 0) {
        console.warn('[direct-context] No files found to index');
        span.setStatus({ code: SpanStatusCode.OK });
        return 0;
      }

      console.log('[direct-context] Adding files to index...');
      const result = await context.addToIndex(files, { waitForIndexing: true });

      console.log(
        `[direct-context] Indexed ${result.newlyUploaded.length} new files, ` +
        `${result.alreadyUploaded.length} already indexed`
      );

      span.setAttributes({
        'files.newly_uploaded': result.newlyUploaded.length,
        'files.already_uploaded': result.alreadyUploaded.length,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return result.newlyUploaded.length + result.alreadyUploaded.length;
    } catch (error) {
      if (error instanceof APIError) {
        console.error(`[direct-context] API Error (${error.status}):`, error.message);
        span.setAttributes({
          'error.type': 'APIError',
          'error.status': error.status,
        });
      } else if (error instanceof BlobTooLargeError) {
        console.error('[direct-context] File too large:', error.message);
        span.setAttribute('error.type', 'BlobTooLargeError');
      }

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Search for vulnerability patterns in the indexed codebase
 *
 * @param context - DirectContext instance
 * @param category - OWASP category to search for
 * @param scanId - Scan ID for tracing
 * @returns Formatted search results
 */
export async function searchForVulnerabilities(
  context: DirectContext,
  category: OwaspCategory,
  scanId: string
): Promise<string> {
  return tracer.startActiveSpan('direct_context.search', async (span) => {
    try {
      span.setAttributes({
        'scan.id': scanId,
        'owasp.category': category,
      });

      // Build search query based on OWASP category
      const searchQuery = buildSearchQuery(category);
      console.log(`[direct-context] Searching for: ${searchQuery}`);

      const results = await context.search(searchQuery, {
        maxOutputLength: 40000, // Increased for comprehensive results
      });

      span.setAttribute('results.length', results.length);
      span.setStatus({ code: SpanStatusCode.OK });

      return results;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Build a search query for a specific OWASP category
 */
function buildSearchQuery(category: OwaspCategory): string {
  const queries: Record<string, string> = {
    'A01:2021-Broken Access Control': 'authentication authorization access control permissions role-based access',
    'A02:2021-Cryptographic Failures': 'encryption crypto hash password secret key sensitive data',
    'A03:2021-Injection': 'SQL injection XSS command injection LDAP injection user input sanitization',
    'A04:2021-Insecure Design': 'security design threat model security requirements',
    'A05:2021-Security Misconfiguration': 'configuration settings environment variables default credentials',
    'A06:2021-Vulnerable and Outdated Components': 'dependencies packages imports require npm package.json',
    'A07:2021-Identification and Authentication Failures': 'login authentication session password credentials token',
    'A08:2021-Software and Data Integrity Failures': 'serialization deserialization integrity validation checksum',
    'A09:2021-Security Logging and Monitoring Failures': 'logging monitoring audit trail error handling',
    'A10:2021-Server-Side Request Forgery': 'SSRF HTTP request URL fetch external request',
  };

  return queries[category] || category;
}

/**
 * Export DirectContext state to a file
 *
 * @param context - DirectContext instance
 * @param stateFilePath - Path to save state file
 */
export async function exportContextState(
  context: DirectContext,
  stateFilePath: string
): Promise<void> {
  return tracer.startActiveSpan('direct_context.export_state', async (span) => {
    try {
      span.setAttribute('state.file', stateFilePath);

      await context.exportToFile(stateFilePath);
      console.log(`[direct-context] State exported to ${stateFilePath}`);

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
