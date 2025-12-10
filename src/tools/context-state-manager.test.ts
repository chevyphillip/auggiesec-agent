import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { DirectContextState } from '@augmentcode/auggie-sdk';
import {
  saveContextState,
  loadContextState,
  getStateFilePath,
  type ScanState,
} from './context-state-manager';

const TEST_STATE_DIR = '.test-auggie-state';
const TEST_SCAN_ID = 'test-scan-123';
const TEST_REPO_PATH = '/test/repo';

describe('Context State Manager', () => {
  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await rm(TEST_STATE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await rm(TEST_STATE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  describe('getStateFilePath', () => {
    test('returns correct path with default directory', () => {
      const path = getStateFilePath(TEST_SCAN_ID);
      expect(path).toContain('.auggie-state');
      expect(path).toContain('scan-test-scan-123.json');
    });

    test('returns correct path with custom directory', () => {
      const path = getStateFilePath(TEST_SCAN_ID, TEST_STATE_DIR);
      expect(path).toContain(TEST_STATE_DIR);
      expect(path).toContain('scan-test-scan-123.json');
    });
  });

  describe('saveContextState', () => {
    test('saves state with metadata', async () => {
      const mockState: DirectContextState = {
        checkpointId: 'checkpoint-123',
        addedBlobs: [],
        deletedBlobs: [],
        blobs: [
          ['blob1', 'src/file1.ts'],
          ['blob2', 'src/file2.ts'],
        ],
      };

      const savedPath = await saveContextState(
        mockState,
        TEST_SCAN_ID,
        TEST_REPO_PATH,
        TEST_STATE_DIR
      );

      expect(savedPath).toBeDefined();
      expect(savedPath).toContain(TEST_STATE_DIR);

      // Verify we can load it back
      const loaded = await loadContextState(TEST_SCAN_ID, TEST_STATE_DIR);
      expect(loaded).not.toBeNull();
      expect(loaded?.checkpointId).toBe('checkpoint-123');
      expect(loaded?.blobs.length).toBe(2);
      expect(loaded?.metadata.scanId).toBe(TEST_SCAN_ID);
      expect(loaded?.metadata.repoPath).toBe(TEST_REPO_PATH);
      expect(loaded?.metadata.indexedFileCount).toBe(2);
    });

    test('creates directory if it does not exist', async () => {
      const mockState: DirectContextState = {
        addedBlobs: [],
        deletedBlobs: [],
        blobs: [],
      };

      const savedPath = await saveContextState(
        mockState,
        TEST_SCAN_ID,
        TEST_REPO_PATH,
        TEST_STATE_DIR
      );

      expect(savedPath).toBeDefined();
    });
  });

  describe('loadContextState', () => {
    test('returns null when state file does not exist', async () => {
      const loaded = await loadContextState('non-existent-scan', TEST_STATE_DIR);
      expect(loaded).toBeNull();
    });

    test('loads previously saved state', async () => {
      const mockState: DirectContextState = {
        checkpointId: 'checkpoint-456',
        addedBlobs: ['blob3'],
        deletedBlobs: ['blob4'],
        blobs: [
          ['blob1', 'src/file1.ts'],
          ['blob2', 'src/file2.ts'],
          ['blob3', 'src/file3.ts'],
        ],
      };

      await saveContextState(mockState, TEST_SCAN_ID, TEST_REPO_PATH, TEST_STATE_DIR);
      const loaded = await loadContextState(TEST_SCAN_ID, TEST_STATE_DIR);

      expect(loaded).not.toBeNull();
      expect(loaded?.checkpointId).toBe('checkpoint-456');
      expect(loaded?.addedBlobs).toEqual(['blob3']);
      expect(loaded?.deletedBlobs).toEqual(['blob4']);
      expect(loaded?.blobs.length).toBe(3);
      expect(loaded?.metadata.indexedFileCount).toBe(3);
    });

    test('preserves metadata on load', async () => {
      const mockState: DirectContextState = {
        addedBlobs: [],
        deletedBlobs: [],
        blobs: [['blob1', 'src/file1.ts']],
      };

      await saveContextState(mockState, TEST_SCAN_ID, TEST_REPO_PATH, TEST_STATE_DIR);
      const loaded = await loadContextState(TEST_SCAN_ID, TEST_STATE_DIR);

      expect(loaded?.metadata.scanId).toBe(TEST_SCAN_ID);
      expect(loaded?.metadata.repoPath).toBe(TEST_REPO_PATH);
      expect(loaded?.metadata.timestamp).toBeDefined();
      expect(new Date(loaded!.metadata.timestamp)).toBeInstanceOf(Date);
    });
  });
});

