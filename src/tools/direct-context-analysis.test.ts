import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { DirectContext as DirectContextType } from '@augmentcode/auggie-sdk';

// Create mock DirectContext instance
const mockDirectContext: Partial<DirectContextType> = {
  addToIndex: mock(() =>
    Promise.resolve({
      newlyUploaded: ['file1.ts', 'file2.ts'],
      alreadyUploaded: [],
    })
  ) as DirectContextType['addToIndex'],
  search: mock(() =>
    Promise.resolve('mock search results for vulnerabilities')
  ) as DirectContextType['search'],
  getIndexedPaths: mock(() => ['src/index.ts', 'src/utils.ts']) as DirectContextType['getIndexedPaths'],
  exportToFile: mock(() => Promise.resolve()) as DirectContextType['exportToFile'],
  close: mock(() => Promise.resolve()) as DirectContextType['close'],
};

// Mock the SDK module before importing the module under test
// Note: Bun's mock.module requires the module to be installed
const mockCreate = mock(() => Promise.resolve(mockDirectContext as DirectContextType));
const mockImportFromFile = mock(() => Promise.resolve(mockDirectContext as DirectContextType));

mock.module('@augmentcode/auggie-sdk', () => ({
  DirectContext: {
    create: mockCreate,
    importFromFile: mockImportFromFile,
  },
  APIError: class APIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'APIError';
      this.status = status;
    }
  },
  BlobTooLargeError: class BlobTooLargeError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'BlobTooLargeError';
    }
  },
}));

// Import module under test after mocking
import {
  createDirectContext,
  exportContextState,
  indexRepository,
  searchForVulnerabilities,
} from './direct-context-analysis';

describe('DirectContext Analysis', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    (mockDirectContext.addToIndex as ReturnType<typeof mock>).mockClear();
    (mockDirectContext.search as ReturnType<typeof mock>).mockClear();
    (mockDirectContext.getIndexedPaths as ReturnType<typeof mock>).mockClear();
    (mockDirectContext.exportToFile as ReturnType<typeof mock>).mockClear();
    (mockDirectContext.close as ReturnType<typeof mock>).mockClear();
    mockCreate.mockClear();
    mockImportFromFile.mockClear();
  });

  afterEach(() => {
    // Clean up after tests
  });

  describe('createDirectContext', () => {
    test('creates a new DirectContext instance when no state file provided', async () => {
      const context = await createDirectContext();

      expect(context).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockImportFromFile).not.toHaveBeenCalled();
    });

    test('imports from file when state file path provided', async () => {
      const stateFilePath = '/path/to/state.json';
      const context = await createDirectContext(stateFilePath);

      expect(context).toBeDefined();
      expect(mockImportFromFile).toHaveBeenCalledTimes(1);
      expect(mockImportFromFile).toHaveBeenCalledWith(
        stateFilePath,
        expect.objectContaining({})
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('uses config credentials when provided', async () => {
      const config = {
        augment: {
          apiToken: 'test-token',
          apiUrl: 'https://test.api.com',
          sessionAuth: undefined,
          apiKey: undefined,
        },
        nodeEnv: 'test' as const,
      };

      await createDirectContext(undefined, config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-token',
          apiUrl: 'https://test.api.com',
          debug: false,
        })
      );
    });

    test('parses sessionAuth JSON when provided in config', async () => {
      const config = {
        augment: {
          sessionAuth: JSON.stringify({
            accessToken: 'session-token',
            tenantURL: 'https://tenant.api.com',
          }),
          apiToken: undefined,
          apiUrl: undefined,
          apiKey: undefined,
        },
        nodeEnv: 'development' as const,
      };

      await createDirectContext(undefined, config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'session-token',
          apiUrl: 'https://tenant.api.com',
          debug: true,
        })
      );
    });
  });

  describe('indexRepository', () => {
    test('indexes repository files and returns count', async () => {
      const context = await createDirectContext();
      // indexRepository reads files from the repo path, which may not exist in test
      // We're verifying it doesn't crash and uses the mock
      const result = await indexRepository(context, '.', 'scan-123');

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('searchForVulnerabilities', () => {
    test('searches for injection vulnerabilities', async () => {
      const context = await createDirectContext();
      const result = await searchForVulnerabilities(
        context,
        'A03:2021-Injection',
        'scan-123'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(mockDirectContext.search).toHaveBeenCalled();
    });

    test('searches for broken access control vulnerabilities', async () => {
      const context = await createDirectContext();
      const result = await searchForVulnerabilities(
        context,
        'A01:2021-Broken Access Control',
        'scan-123'
      );

      expect(result).toBeDefined();
      expect(mockDirectContext.search).toHaveBeenCalled();
    });
  });

  describe('exportContextState', () => {
    test('exports state to file', async () => {
      const context = await createDirectContext();
      const stateFilePath = '/path/to/export-state.json';

      await exportContextState(context, stateFilePath);

      expect(mockDirectContext.exportToFile).toHaveBeenCalledWith(stateFilePath);
    });
  });

  describe('module exports', () => {
    test('exports expected functions', () => {
      expect(createDirectContext).toBeDefined();
      expect(indexRepository).toBeDefined();
      expect(searchForVulnerabilities).toBeDefined();
      expect(exportContextState).toBeDefined();
    });
  });
});
