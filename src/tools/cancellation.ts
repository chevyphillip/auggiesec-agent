/**
 * Request Cancellation for Auggie SDK
 *
 * Provides timeout handling and graceful cancellation for long-running
 * Auggie analysis operations. Uses the Auggie.cancel() method to interrupt
 * in-progress requests and clean up resources.
 *
 * ## Cancellation Scenarios
 *
 * 1. **Timeout**: Analysis exceeds maximum allowed time
 * 2. **User Interrupt**: User manually cancels the operation
 * 3. **Error Recovery**: Cancel on unrecoverable errors
 *
 * ## Usage
 *
 * ```typescript
 * const controller = createCancellationController(client, 300000); // 5 min timeout
 *
 * try {
 *   const result = await controller.withTimeout(async () => {
 *     return await client.prompt("Analyze this code...");
 *   });
 * } finally {
 *   controller.cleanup();
 * }
 * ```
 *
 * @module tools/cancellation
 */

import type { Auggie } from '@augmentcode/auggie-sdk';
import { SpanStatusCode } from '@opentelemetry/api';
import { tracer } from '../instrumentation';

/**
 * Cancellation reason
 */
export type CancellationReason = 'timeout' | 'user_request' | 'error';

/**
 * Cancellation controller for managing timeouts and cancellation
 */
export class CancellationController {
  private timeoutId: Timer | null = null;
  private isCancelled = false;
  private cancellationReason: CancellationReason | null = null;

  constructor(
    private readonly client: Auggie,
    private readonly timeoutMs: number,
    private readonly scanId: string
  ) {}

  /**
   * Execute a function with timeout protection
   *
   * @param fn - Async function to execute
   * @returns Result of the function
   * @throws Error if timeout occurs or operation is cancelled
   */
  async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return tracer.startActiveSpan('cancellation.with_timeout', async (span) => {
      try {
        span.setAttributes({
          'scan.id': this.scanId,
          'timeout.ms': this.timeoutMs,
        });

        // Set up timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          this.timeoutId = setTimeout(() => {
            this.cancel('timeout');
            reject(new Error(`Operation timed out after ${this.timeoutMs}ms`));
          }, this.timeoutMs);
        });

        // Race between the operation and timeout
        const result = await Promise.race([fn(), timeoutPromise]);

        // Clear timeout if operation completed successfully
        this.clearTimeout();

        span.setAttributes({
          'cancellation.occurred': false,
        });
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        span.setAttributes({
          'cancellation.occurred': this.isCancelled,
          'cancellation.reason': this.cancellationReason || 'unknown',
        });
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
   * Cancel the current operation
   *
   * @param reason - Reason for cancellation
   */
  async cancel(reason: CancellationReason = 'user_request'): Promise<void> {
    if (this.isCancelled) {
      console.log(`[cancellation] Already cancelled (${this.cancellationReason})`);
      return;
    }

    return tracer.startActiveSpan('cancellation.cancel', async (span) => {
      try {
        this.isCancelled = true;
        this.cancellationReason = reason;

        span.setAttributes({
          'scan.id': this.scanId,
          'cancellation.reason': reason,
        });

        console.log(`[cancellation] Cancelling operation: ${reason}`);

        // Call Auggie's cancel method
        await this.client.cancel();

        console.log(`[cancellation] Cancellation complete`);

        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        console.error('[cancellation] Error during cancellation:', error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Clear the timeout timer
   */
  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.clearTimeout();
  }

  /**
   * Check if the operation was cancelled
   */
  get cancelled(): boolean {
    return this.isCancelled;
  }

  /**
   * Get the cancellation reason
   */
  get reason(): CancellationReason | null {
    return this.cancellationReason;
  }
}

/**
 * Create a cancellation controller
 *
 * @param client - Auggie client instance
 * @param timeoutMs - Timeout in milliseconds (default: 5 minutes)
 * @param scanId - Scan ID for tracing
 * @returns Cancellation controller
 */
export function createCancellationController(
  client: Auggie,
  timeoutMs: number = 300000, // 5 minutes default
  scanId: string = 'unknown'
): CancellationController {
  return new CancellationController(client, timeoutMs, scanId);
}

