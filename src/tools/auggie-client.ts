/**
 * Auggie SDK Client Wrapper
 *
 * Provides a singleton-pattern client for interacting with the Auggie SDK.
 * Handles initialization, configuration, and lifecycle management.
 *
 * @module tools/auggie-client
 */

import { Auggie } from '@augmentcode/auggie-sdk';
import { SpanStatusCode } from '@opentelemetry/api';
import { tracer } from '../instrumentation';

/** Valid Auggie model identifiers (matches SDK's models type) */
export type AuggieModel = 'haiku4.5' | 'sonnet4.5' | 'sonnet4' | 'gpt5';

/**
 * Auggie client configuration options
 */
export interface AuggieClientConfig {
  /** Path to the workspace root directory (default: './nodejs-goof') */
  workspaceRoot?: string;
  /** Model to use for analysis (default: 'sonnet4.5') */
  model?: AuggieModel;
  /** Path to the Auggie executable (optional) */
  auggiePath?: string;
}

/** Auggie client type */
export type AuggieClientType = Awaited<ReturnType<typeof Auggie.create>>;

/**
 * Singleton Auggie client instance
 */
let auggieClient: AuggieClientType | null = null;
let clientConfig: AuggieClientConfig | null = null;

/**
 * Initialize or get the Auggie client instance
 *
 * Uses a singleton pattern to ensure only one client is active at a time.
 * If the client is already initialized with the same config, returns the existing instance.
 *
 * @param config - Client configuration options
 * @returns Promise<Auggie client instance>
 */
export async function getAuggieClient(
  config: AuggieClientConfig = {}
): Promise<AuggieClientType> {
  return tracer.startActiveSpan('auggie.get_client', async (span) => {
    try {
      const resolvedConfig: Required<Omit<AuggieClientConfig, 'auggiePath'>> & Pick<AuggieClientConfig, 'auggiePath'> = {
        workspaceRoot: config.workspaceRoot || './nodejs-goof',
        model: config.model || 'sonnet4.5',
        auggiePath: config.auggiePath,
      };

      span.setAttributes({
        'auggie.workspace_root': resolvedConfig.workspaceRoot,
        'auggie.model': resolvedConfig.model,
      });

      // Check if we need to create a new client
      const configChanged =
        !auggieClient ||
        !clientConfig ||
        clientConfig.workspaceRoot !== resolvedConfig.workspaceRoot ||
        clientConfig.model !== resolvedConfig.model;

      if (configChanged) {
        // Close existing client if any
        if (auggieClient) {
          await closeAuggieClient();
        }

        console.log(`[auggie] Initializing client for workspace: ${resolvedConfig.workspaceRoot}`);

        // Create new client
        auggieClient = await Auggie.create({
          workspaceRoot: resolvedConfig.workspaceRoot,
          model: resolvedConfig.model,
          ...(resolvedConfig.auggiePath && { auggiePath: resolvedConfig.auggiePath }),
        });

        clientConfig = resolvedConfig;
        console.log('[auggie] Client initialized successfully');
      }

      span.setStatus({ code: SpanStatusCode.OK });
      // At this point auggieClient is guaranteed to be non-null
      return auggieClient!;
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
 * Close the Auggie client and release resources
 *
 * Should be called when the application is shutting down or
 * when switching to a different workspace.
 */
export async function closeAuggieClient(): Promise<void> {
  return tracer.startActiveSpan('auggie.close_client', async (span) => {
    try {
      if (auggieClient) {
        console.log('[auggie] Closing client...');
        await auggieClient.close();
        auggieClient = null;
        clientConfig = null;
        console.log('[auggie] Client closed');
      }
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

/**
 * Check if the Auggie client is initialized
 */
export function isAuggieClientInitialized(): boolean {
  return auggieClient !== null;
}

/**
 * Get the current client configuration (if initialized)
 */
export function getClientConfig(): AuggieClientConfig | null {
  return clientConfig ? { ...clientConfig } : null;
}
