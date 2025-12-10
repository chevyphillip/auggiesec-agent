import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  collectFileMetadata,
  analyzeChanges,
  serializeFileMetadata,
  deserializeFileMetadata,
  type FileMetadata,
} from './incremental-indexer';

const TEST_DIR = '.test-incremental';

describe('Incremental Indexer', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('collectFileMetadata', () => {
    test('collects metadata for all files', async () => {
      // Create test files
      await writeFile(join(TEST_DIR, 'file1.ts'), 'content1');
      await writeFile(join(TEST_DIR, 'file2.ts'), 'content2');
      await mkdir(join(TEST_DIR, 'subdir'));
      await writeFile(join(TEST_DIR, 'subdir', 'file3.ts'), 'content3');

      const metadata = await collectFileMetadata(TEST_DIR);

      expect(metadata.size).toBe(3);
      expect(metadata.has('file1.ts')).toBe(true);
      expect(metadata.has('file2.ts')).toBe(true);
      expect(metadata.has('subdir/file3.ts')).toBe(true);

      const file1 = metadata.get('file1.ts');
      expect(file1?.path).toBe('file1.ts');
      expect(file1?.size).toBe(8); // 'content1' is 8 bytes
      expect(file1?.mtime).toBeGreaterThan(0);
    });

    test('excludes node_modules and .git directories', async () => {
      await mkdir(join(TEST_DIR, 'node_modules'));
      await writeFile(join(TEST_DIR, 'node_modules', 'package.js'), 'content');
      await mkdir(join(TEST_DIR, '.git'));
      await writeFile(join(TEST_DIR, '.git', 'config'), 'content');
      await writeFile(join(TEST_DIR, 'valid.ts'), 'content');

      const metadata = await collectFileMetadata(TEST_DIR);

      expect(metadata.size).toBe(1);
      expect(metadata.has('valid.ts')).toBe(true);
      expect(metadata.has('node_modules/package.js')).toBe(false);
      expect(metadata.has('.git/config')).toBe(false);
    });

    test('excludes binary file extensions', async () => {
      await writeFile(join(TEST_DIR, 'image.png'), 'binary');
      await writeFile(join(TEST_DIR, 'doc.pdf'), 'binary');
      await writeFile(join(TEST_DIR, 'code.ts'), 'code');

      const metadata = await collectFileMetadata(TEST_DIR);

      expect(metadata.size).toBe(1);
      expect(metadata.has('code.ts')).toBe(true);
      expect(metadata.has('image.png')).toBe(false);
      expect(metadata.has('doc.pdf')).toBe(false);
    });
  });

  describe('analyzeChanges', () => {
    test('detects new files', async () => {
      const previous = new Map<string, FileMetadata>();
      await writeFile(join(TEST_DIR, 'new.ts'), 'new content');

      const changes = await analyzeChanges(TEST_DIR, previous);

      expect(changes.toAdd.length).toBe(1);
      expect(changes.toAdd[0]?.path).toBe('new.ts');
      expect(changes.toRemove.length).toBe(0);
      expect(changes.unchanged.length).toBe(0);
    });

    test('detects deleted files', async () => {
      const previous = new Map<string, FileMetadata>([
        ['deleted.ts', { path: 'deleted.ts', mtime: Date.now(), size: 100 }],
      ]);

      const changes = await analyzeChanges(TEST_DIR, previous);

      expect(changes.toAdd.length).toBe(0);
      expect(changes.toRemove.length).toBe(1);
      expect(changes.toRemove[0]).toBe('deleted.ts');
      expect(changes.unchanged.length).toBe(0);
    });

    test('detects unchanged files', async () => {
      await writeFile(join(TEST_DIR, 'unchanged.ts'), 'content');
      const metadata = await collectFileMetadata(TEST_DIR);
      const previous = new Map(metadata);

      const changes = await analyzeChanges(TEST_DIR, previous);

      expect(changes.toAdd.length).toBe(0);
      expect(changes.toRemove.length).toBe(0);
      expect(changes.unchanged.length).toBe(1);
      expect(changes.unchanged[0]).toBe('unchanged.ts');
    });

    test('detects modified files by size change', async () => {
      await writeFile(join(TEST_DIR, 'modified.ts'), 'original');
      const metadata = await collectFileMetadata(TEST_DIR);
      const previous = new Map(metadata);

      // Modify the file
      await writeFile(join(TEST_DIR, 'modified.ts'), 'modified content');

      const changes = await analyzeChanges(TEST_DIR, previous);

      expect(changes.toAdd.length).toBe(1);
      expect(changes.toAdd[0]?.path).toBe('modified.ts');
      expect(changes.toRemove.length).toBe(0);
    });
  });

  describe('serializeFileMetadata', () => {
    test('converts Map to Record', () => {
      const map = new Map<string, FileMetadata>([
        ['file1.ts', { path: 'file1.ts', mtime: 123456, size: 100 }],
        ['file2.ts', { path: 'file2.ts', mtime: 789012, size: 200 }],
      ]);

      const serialized = serializeFileMetadata(map);

      expect(serialized['file1.ts']).toEqual({
        path: 'file1.ts',
        mtime: 123456,
        size: 100,
      });
      expect(serialized['file2.ts']).toEqual({
        path: 'file2.ts',
        mtime: 789012,
        size: 200,
      });
    });
  });

  describe('deserializeFileMetadata', () => {
    test('converts Record to Map', () => {
      const record = {
        'file1.ts': { path: 'file1.ts', mtime: 123456, size: 100 },
        'file2.ts': { path: 'file2.ts', mtime: 789012, size: 200 },
      };

      const map = deserializeFileMetadata(record);

      expect(map.size).toBe(2);
      expect(map.get('file1.ts')).toEqual({
        path: 'file1.ts',
        mtime: 123456,
        size: 100,
      });
      expect(map.get('file2.ts')).toEqual({
        path: 'file2.ts',
        mtime: 789012,
        size: 200,
      });
    });
  });
});

