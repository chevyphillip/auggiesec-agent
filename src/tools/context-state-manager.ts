/**
 * DirectContext State Management
 *
 * Manages persistent state for DirectContext to enable:
 * - Scan resumption after interruption
 * - State sharing across environments
 * - Incremental indexing tracking
 *
 * ## State File Format
 *
 * The state file is a JSON file containing:
 * - checkpointId: Backend checkpoint identifier
 * - blobs: Array of [blobName, path] tuples for indexed files
 * - addedBlobs: Pending additions not yet checkpointed
 * - deletedBlobs: Pending deletions not yet checkpointed
 * - metadata: Scan metadata (scanId, timestamp, repoPath)
 *
 * @module tools/context-state-manager
 */

import type { DirectContextState } from '@augmentcode/auggie-sdk';
import { SpanStatusCode } from '@opentelemetry/api';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tracer } from '../instrumentation';
import type { FileMetadata } from './incremental-indexer';

/**
 * Extended state with scan metadata
 */
export interface ScanState extends DirectContextState {
  metadata: {
    scanId: string;
    timestamp: string;
    repoPath: string;
    indexedFileCount: number;
  };
  /** File metadata for incremental indexing */
  fileMetadata?: Record<string, FileMetadata>;
}

/**
 * Default state directory (relative to workspace root)
 */
const DEFAULT_STATE_DIR = '.auggie-state';

/**
 * Get the state file path for a scan
 *
 * @param scanId - Scan identifier
 * @param stateDir - Optional custom state directory
 * @returns Full path to state file
 */
export function getStateFilePath(scanId: string, stateDir?: string): string {
  const dir = stateDir || DEFAULT_STATE_DIR;
  return join(dir, `scan-${scanId}.json`);
}

/**
 * Save DirectContext state with scan metadata
 *
 * @param state - DirectContext state to save
 * @param scanId - Scan identifier
 * @param repoPath - Repository path
 * @param stateDir - Optional custom state directory
 * @param fileMetadata - Optional file metadata for incremental indexing
 */
export async function saveContextState(
  state: DirectContextState,
  scanId: string,
  repoPath: string,
  stateDir?: string,
  fileMetadata?: Map<string, FileMetadata>
): Promise<string> {
  return tracer.startActiveSpan('context_state.save', async (span) => {
    try {
      const stateFilePath = getStateFilePath(scanId, stateDir);
      span.setAttribute('state.file', stateFilePath);
      span.setAttribute('scan.id', scanId);

      // Ensure state directory exists
      await mkdir(dirname(stateFilePath), { recursive: true });

      const scanState: ScanState = {
        ...state,
        metadata: {
          scanId,
          timestamp: new Date().toISOString(),
          repoPath,
          indexedFileCount: state.blobs.length,
        },
        fileMetadata: fileMetadata ? Object.fromEntries(fileMetadata) : undefined,
      };

      await writeFile(stateFilePath, JSON.stringify(scanState, null, 2), 'utf-8');

      console.log(`[state-manager] State saved to ${stateFilePath}`);
      console.log(`[state-manager] Indexed files: ${scanState.metadata.indexedFileCount}`);

      span.setAttributes({
        'state.indexed_files': scanState.metadata.indexedFileCount,
        'state.checkpoint_id': state.checkpointId || 'none',
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return stateFilePath;
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
 * Load DirectContext state from a previous scan
 *
 * @param scanId - Scan identifier
 * @param stateDir - Optional custom state directory
 * @returns DirectContext state or null if not found
 */
export async function loadContextState(
  scanId: string,
  stateDir?: string
): Promise<ScanState | null> {
  return tracer.startActiveSpan('context_state.load', async (span) => {
    try {
      const stateFilePath = getStateFilePath(scanId, stateDir);
      span.setAttribute('state.file', stateFilePath);
      span.setAttribute('scan.id', scanId);

      const content = await readFile(stateFilePath, 'utf-8');
      const state = JSON.parse(content) as ScanState;

      console.log(`[state-manager] State loaded from ${stateFilePath}`);
      console.log(`[state-manager] Indexed files: ${state.metadata.indexedFileCount}`);
      console.log(`[state-manager] Last updated: ${state.metadata.timestamp}`);

      span.setAttributes({
        'state.indexed_files': state.metadata.indexedFileCount,
        'state.checkpoint_id': state.checkpointId || 'none',
        'state.timestamp': state.metadata.timestamp,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`[state-manager] No existing state found for scan ${scanId}`);
        span.setAttribute('state.found', false);
        span.setStatus({ code: SpanStatusCode.OK });
        return null;
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
