import type { DirectContext as DirectContextType } from '@augmentcode/auggie-sdk';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { DirectContextConfig } from './direct-context-analysis';

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
};

// Mock the SDK module before importing the module under test
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

// Default test config - all tests must pass validated config
const defaultTestConfig: DirectContextConfig = {
  augment: {
    apiToken: 'test-token',
    apiUrl: 'https://test.api.com',
    sessionAuth: undefined,
  },
  nodeEnv: 'test',
};

describe('DirectContext Analysis', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    (mockDirectContext.addToIndex as ReturnType<typeof mock>).mockClear();
    (mockDirectContext.search as ReturnType<typeof mock>).mockClear();
    (mockDirectContext.getIndexedPaths as ReturnType<typeof mock>).mockClear();
    (mockDirectContext.exportToFile as ReturnType<typeof mock>).mockClear();
    mockCreate.mockClear();
    mockImportFromFile.mockClear();
  });

  afterEach(() => {
    // Clean up after tests
  });

  describe('createDirectContext', () => {
    test('creates a new DirectContext instance when no state file provided', async () => {
      const context = await createDirectContext(defaultTestConfig);

      expect(context).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockImportFromFile).not.toHaveBeenCalled();
    });

    test('imports from file when state file path provided', async () => {
      const stateFilePath = '/path/to/state.json';
      const context = await createDirectContext(defaultTestConfig, stateFilePath);

      expect(context).toBeDefined();
      expect(mockImportFromFile).toHaveBeenCalledTimes(1);
      expect(mockImportFromFile).toHaveBeenCalledWith(
        stateFilePath,
        expect.objectContaining({})
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('uses config credentials', async () => {
      const config: DirectContextConfig = {
        augment: {
          apiToken: 'custom-token',
          apiUrl: 'https://custom.api.com',
          sessionAuth: undefined,
        },
        nodeEnv: 'test',
      };

      await createDirectContext(config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'custom-token',
          apiUrl: 'https://custom.api.com',
          debug: false,
        })
      );
    });

    test('parses sessionAuth JSON when provided in config', async () => {
      const config: DirectContextConfig = {
        augment: {
          sessionAuth: {
            accessToken: 'session-token',
            tenantURL: 'https://tenant.api.com',
          },
          apiToken: undefined,
          apiUrl: undefined,
        },
        nodeEnv: 'development',
      };

      await createDirectContext(config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'session-token',
          apiUrl: 'https://tenant.api.com',
          debug: true,
        })
      );
    });

    test('enables debug mode when nodeEnv is development', async () => {
      const config: DirectContextConfig = {
        augment: { apiToken: 'token' },
        nodeEnv: 'development',
      };

      await createDirectContext(config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ debug: true })
      );
    });

    test('disables debug mode when nodeEnv is production', async () => {
      const config: DirectContextConfig = {
        augment: { apiToken: 'token' },
        nodeEnv: 'production',
      };

      await createDirectContext(config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ debug: false })
      );
    });
  });

  describe('indexRepository', () => {
    test('indexes repository files and returns count', async () => {
      const context = await createDirectContext(defaultTestConfig);
      const result = await indexRepository(context, '.', 'scan-123');

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('searchForVulnerabilities', () => {
    test('searches for injection vulnerabilities', async () => {
      const context = await createDirectContext(defaultTestConfig);
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
      const context = await createDirectContext(defaultTestConfig);
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
      const context = await createDirectContext(defaultTestConfig);
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
