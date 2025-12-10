import { describe, expect, test, mock } from 'bun:test';
import type { Auggie } from '@augmentcode/auggie-sdk';
import { CancellationController, createCancellationController } from './cancellation';

describe('Cancellation', () => {
  describe('CancellationController', () => {
    test('executes function successfully within timeout', async () => {
      const mockClient = {
        cancel: mock(async () => {}),
      } as unknown as Auggie;

      const controller = new CancellationController(mockClient, 1000, 'scan-123');

      const result = await controller.withTimeout(async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(controller.cancelled).toBe(false);
      expect(controller.reason).toBeNull();

      controller.cleanup();
    });

    test('throws error on timeout', async () => {
      const mockClient = {
        cancel: mock(async () => {}),
      } as unknown as Auggie;

      const controller = new CancellationController(mockClient, 100, 'scan-123');

      try {
        await controller.withTimeout(async () => {
          // Simulate long-running operation
          await new Promise((resolve) => setTimeout(resolve, 500));
          return 'should not reach here';
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('timed out');
        expect(controller.cancelled).toBe(true);
        expect(controller.reason).toBe('timeout');
      } finally {
        controller.cleanup();
      }
    });

    test('can be manually cancelled', async () => {
      const mockClient = {
        cancel: mock(async () => {}),
      } as unknown as Auggie;

      const controller = new CancellationController(mockClient, 5000, 'scan-123');

      await controller.cancel('user_request');

      expect(controller.cancelled).toBe(true);
      expect(controller.reason).toBe('user_request');
      expect(mockClient.cancel).toHaveBeenCalled();

      controller.cleanup();
    });

    test('prevents duplicate cancellation', async () => {
      const mockClient = {
        cancel: mock(async () => {}),
      } as unknown as Auggie;

      const controller = new CancellationController(mockClient, 5000, 'scan-123');

      await controller.cancel('user_request');
      await controller.cancel('timeout'); // Should be ignored

      expect(controller.reason).toBe('user_request'); // First reason preserved
      expect(mockClient.cancel).toHaveBeenCalledTimes(1);

      controller.cleanup();
    });

    test('cleanup clears timeout', async () => {
      const mockClient = {
        cancel: mock(async () => {}),
      } as unknown as Auggie;

      const controller = new CancellationController(mockClient, 5000, 'scan-123');

      // Start an operation but don't wait for it
      const promise = controller.withTimeout(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'done';
      });

      // Cleanup immediately
      controller.cleanup();

      // Operation should still complete
      const result = await promise;
      expect(result).toBe('done');
    });

    test('handles errors during cancellation', async () => {
      const mockClient = {
        cancel: mock(async () => {
          throw new Error('Cancel failed');
        }),
      } as unknown as Auggie;

      const controller = new CancellationController(mockClient, 5000, 'scan-123');

      try {
        await controller.cancel('user_request');
        // Should throw
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Cancel failed');
        expect(controller.cancelled).toBe(true); // Still marked as cancelled
      } finally {
        controller.cleanup();
      }
    });
  });

  describe('createCancellationController', () => {
    test('creates controller with default timeout', () => {
      const mockClient = {
        cancel: mock(async () => {}),
      } as unknown as Auggie;

      const controller = createCancellationController(mockClient);

      expect(controller).toBeInstanceOf(CancellationController);
      expect(controller.cancelled).toBe(false);

      controller.cleanup();
    });

    test('creates controller with custom timeout', () => {
      const mockClient = {
        cancel: mock(async () => {}),
      } as unknown as Auggie;

      const controller = createCancellationController(mockClient, 10000, 'scan-456');

      expect(controller).toBeInstanceOf(CancellationController);

      controller.cleanup();
    });
  });
});

