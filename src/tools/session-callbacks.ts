/**
 * Session Update Callbacks for Auggie SDK
 *
 * Provides real-time progress tracking during Auggie analysis sessions.
 * Uses the onSessionUpdate() callback to monitor agent activity and provide
 * user feedback during long-running operations.
 *
 * ## Session Updates
 *
 * The Auggie SDK emits session updates during analysis:
 * - `user_message_chunk`: Streaming text from the agent
 * - Tool calls and results
 * - Progress indicators
 *
 * This module processes these updates and provides structured progress information.
 *
 * @module tools/session-callbacks
 */

import type { SessionNotification } from '@agentclientprotocol/sdk';
import { SpanStatusCode } from '@opentelemetry/api';
import { tracer } from '../instrumentation';

/**
 * Progress information from session updates
 */
export interface SessionProgress {
  /** Total chunks received */
  chunksReceived: number;
  /** Total text length received */
  textLength: number;
  /** Last update timestamp */
  lastUpdate: Date;
  /** Whether the session is still active */
  isActive: boolean;
}

/**
 * Callback function for progress updates
 */
export type ProgressCallback = (progress: SessionProgress) => void;

/**
 * Create a session update handler with progress tracking
 *
 * @param scanId - Scan ID for tracing
 * @param category - OWASP category being analyzed
 * @param onProgress - Optional callback for progress updates
 * @returns Session update handler function
 */
export function createSessionUpdateHandler(
  scanId: string,
  category: string,
  onProgress?: ProgressCallback
): (update: SessionNotification) => void {
  const progress: SessionProgress = {
    chunksReceived: 0,
    textLength: 0,
    lastUpdate: new Date(),
    isActive: true,
  };

  return (update: SessionNotification) => {
    return tracer.startActiveSpan('session.update', (span) => {
      try {
        span.setAttributes({
          'scan.id': scanId,
          'owasp.category': category,
          'session.id': update.sessionId,
          'session.update_type': update.update.sessionUpdate,
        });

        // Process the update content
        if (
          'content' in update.update &&
          update.update.content &&
          !Array.isArray(update.update.content) &&
          'type' in update.update.content &&
          update.update.content.type === 'text'
        ) {
          const textContent = update.update.content.text;
          progress.chunksReceived++;
          progress.textLength += textContent.length;
          progress.lastUpdate = new Date();

          span.setAttributes({
            'session.chunks_received': progress.chunksReceived,
            'session.text_length': progress.textLength,
            'session.chunk_size': textContent.length,
          });

          // Log progress periodically (every 10 chunks)
          if (progress.chunksReceived % 10 === 0) {
            console.log(
              `[session] Progress: ${progress.chunksReceived} chunks, ` +
                `${progress.textLength} chars (${category})`
            );
          }

          // Call progress callback if provided
          if (onProgress) {
            onProgress({ ...progress });
          }
        }

        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        console.error('[session] Error processing update:', error);
      } finally {
        span.end();
      }
    });
  };
}

/**
 * Mark session as complete
 *
 * @param progress - Progress object to mark as complete
 */
export function markSessionComplete(progress: SessionProgress): void {
  progress.isActive = false;
  console.log(
    `[session] Complete: ${progress.chunksReceived} chunks, ` +
      `${progress.textLength} chars total`
  );
}

/**
 * Create a simple logging session handler
 *
 * This is a simplified version that just logs updates without progress tracking.
 * Useful for debugging or when detailed progress tracking isn't needed.
 *
 * @param scanId - Scan ID for logging
 * @param category - OWASP category being analyzed
 * @returns Session update handler function
 */
export function createLoggingSessionHandler(
  scanId: string,
  category: string
): (update: SessionNotification) => void {
  let chunkCount = 0;

  return (update: SessionNotification) => {
    chunkCount++;

    if (
      'content' in update.update &&
      update.update.content &&
      !Array.isArray(update.update.content) &&
      'type' in update.update.content &&
      update.update.content.type === 'text'
    ) {
      const textLength = update.update.content.text.length;

      // Log every 20 chunks to avoid spam
      if (chunkCount % 20 === 0) {
        console.log(
          `[session] ${category}: chunk ${chunkCount}, ${textLength} chars`
        );
      }
    }
  };
}
