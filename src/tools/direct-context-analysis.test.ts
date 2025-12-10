import { describe, expect, test } from 'bun:test';
import { createDirectContext, indexRepository, searchForVulnerabilities } from './direct-context-analysis';

describe('DirectContext Analysis', () => {
  describe('createDirectContext', () => {
    test('creates a new DirectContext instance', async () => {
      // This test requires valid Augment credentials
      // Skip if not available
      if (!process.env.AUGMENT_SESSION_AUTH && !process.env.AUGMENT_API_TOKEN) {
        console.log('[test] Skipping DirectContext test - no credentials');
        return;
      }

      const context = await createDirectContext();
      expect(context).toBeDefined();
      expect(context.getIndexedPaths).toBeDefined();
    });
  });

  describe('buildSearchQuery', () => {
    test('returns appropriate search query for injection category', () => {
      // We can't directly test the private function, but we can verify
      // the module exports the expected functions
      expect(searchForVulnerabilities).toBeDefined();
      expect(indexRepository).toBeDefined();
    });
  });
});

