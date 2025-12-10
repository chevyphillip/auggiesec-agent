import type { SessionNotification } from '@agentclientprotocol/sdk';
import { describe, expect, test } from 'bun:test';
import {
    createLoggingSessionHandler,
    createSessionUpdateHandler,
    markSessionComplete,
    type SessionProgress,
} from './session-callbacks';

describe('Session Callbacks', () => {
  describe('createSessionUpdateHandler', () => {
    test('tracks progress for text updates', () => {
      let capturedProgress: SessionProgress | undefined;

      const handler = createSessionUpdateHandler(
        'scan-123',
        'A03:2021-Injection',
        (progress) => {
          capturedProgress = progress;
        }
      );

      const update: SessionNotification = {
        sessionId: 'session-456',
        update: {
          content: {
            type: 'text',
            text: 'Hello world',
          },
          sessionUpdate: 'user_message_chunk',
        },
      };

      handler(update);

      expect(capturedProgress).toBeDefined();
      expect(capturedProgress!.chunksReceived).toBe(1);
      expect(capturedProgress!.textLength).toBe(11); // "Hello world" = 11 chars
      expect(capturedProgress!.isActive).toBe(true);
    });

    test('accumulates text length across multiple chunks', () => {
      let capturedProgress: SessionProgress | undefined;

      const handler = createSessionUpdateHandler(
        'scan-123',
        'A03:2021-Injection',
        (progress) => {
          capturedProgress = progress;
        }
      );

      const update1: SessionNotification = {
        sessionId: 'session-456',
        update: {
          content: {
            type: 'text',
            text: 'First chunk',
          },
          sessionUpdate: 'user_message_chunk',
        },
      };

      const update2: SessionNotification = {
        sessionId: 'session-456',
        update: {
          content: {
            type: 'text',
            text: 'Second chunk',
          },
          sessionUpdate: 'user_message_chunk',
        },
      };

      handler(update1);
      handler(update2);

      expect(capturedProgress).toBeDefined();
      expect(capturedProgress!.chunksReceived).toBe(2);
      expect(capturedProgress!.textLength).toBe(23); // 11 + 12 = 23
    });

    test('works without progress callback', () => {
      const handler = createSessionUpdateHandler('scan-123', 'A03:2021-Injection');

      const update: SessionNotification = {
        sessionId: 'session-456',
        update: {
          content: {
            type: 'text',
            text: 'Test',
          },
          sessionUpdate: 'user_message_chunk',
        },
      };

      // Should not throw
      expect(() => handler(update)).not.toThrow();
    });

    test('updates lastUpdate timestamp', () => {
      let capturedProgress: SessionProgress | undefined;

      const handler = createSessionUpdateHandler(
        'scan-123',
        'A03:2021-Injection',
        (progress) => {
          capturedProgress = progress;
        }
      );

      const before = new Date();

      const update: SessionNotification = {
        sessionId: 'session-456',
        update: {
          content: {
            type: 'text',
            text: 'Test',
          },
          sessionUpdate: 'user_message_chunk',
        },
      };

      handler(update);

      const after = new Date();

      expect(capturedProgress).toBeDefined();
      expect(capturedProgress!.lastUpdate).toBeDefined();
      expect(capturedProgress!.lastUpdate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(capturedProgress!.lastUpdate.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('markSessionComplete', () => {
    test('marks session as inactive', () => {
      const progress: SessionProgress = {
        chunksReceived: 10,
        textLength: 100,
        lastUpdate: new Date(),
        isActive: true,
      };

      markSessionComplete(progress);

      expect(progress.isActive).toBe(false);
    });
  });

  describe('createLoggingSessionHandler', () => {
    test('creates a handler that processes updates', () => {
      const handler = createLoggingSessionHandler('scan-123', 'A03:2021-Injection');

      const update: SessionNotification = {
        sessionId: 'session-456',
        update: {
          content: {
            type: 'text',
            text: 'Test message',
          },
          sessionUpdate: 'user_message_chunk',
        },
      };

      // Should not throw
      expect(() => handler(update)).not.toThrow();
    });
  });
});
