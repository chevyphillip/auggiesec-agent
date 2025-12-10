import { describe, expect, test } from 'bun:test';
import {
  getExcludedTools,
  validateSecurityConfig,
  describeSecurityConfig,
  createSecurityConfig,
  FILE_MODIFICATION_TOOLS,
  PROCESS_EXECUTION_TOOLS,
  TASK_MODIFICATION_TOOLS,
} from './security-config';

describe('Security Config', () => {
  describe('Tool Categories', () => {
    test('FILE_MODIFICATION_TOOLS includes critical tools', () => {
      expect(FILE_MODIFICATION_TOOLS).toContain('save-file');
      expect(FILE_MODIFICATION_TOOLS).toContain('str-replace-editor');
      expect(FILE_MODIFICATION_TOOLS).toContain('remove-files');
    });

    test('PROCESS_EXECUTION_TOOLS includes process tools', () => {
      expect(PROCESS_EXECUTION_TOOLS).toContain('launch-process');
      expect(PROCESS_EXECUTION_TOOLS).toContain('kill-process');
      expect(PROCESS_EXECUTION_TOOLS).toContain('write-process');
    });

    test('TASK_MODIFICATION_TOOLS includes task tools', () => {
      expect(TASK_MODIFICATION_TOOLS).toContain('add_tasks');
      expect(TASK_MODIFICATION_TOOLS).toContain('update_tasks');
      expect(TASK_MODIFICATION_TOOLS).toContain('reorganize_tasklist');
    });
  });

  describe('getExcludedTools', () => {
    test('strict profile excludes all modification tools', () => {
      const excluded = getExcludedTools('strict');

      // Should include all file modification tools
      expect(excluded).toContain('save-file');
      expect(excluded).toContain('str-replace-editor');
      expect(excluded).toContain('remove-files');

      // Should include all process execution tools
      expect(excluded).toContain('launch-process');
      expect(excluded).toContain('kill-process');
      expect(excluded).toContain('write-process');

      // Should include all task modification tools
      expect(excluded).toContain('add_tasks');
      expect(excluded).toContain('update_tasks');
      expect(excluded).toContain('reorganize_tasklist');
    });

    test('moderate profile excludes file and process tools but allows tasks', () => {
      const excluded = getExcludedTools('moderate');

      // Should include file modification tools
      expect(excluded).toContain('save-file');
      expect(excluded).toContain('str-replace-editor');

      // Should include process execution tools
      expect(excluded).toContain('launch-process');

      // Should NOT include task modification tools
      expect(excluded).not.toContain('add_tasks');
      expect(excluded).not.toContain('update_tasks');
    });

    test('permissive profile only excludes file modification tools', () => {
      const excluded = getExcludedTools('permissive');

      // Should include file modification tools
      expect(excluded).toContain('save-file');
      expect(excluded).toContain('str-replace-editor');
      expect(excluded).toContain('remove-files');

      // Should NOT include process execution tools
      expect(excluded).not.toContain('launch-process');

      // Should NOT include task modification tools
      expect(excluded).not.toContain('add_tasks');
    });

    test('defaults to strict profile', () => {
      const excluded = getExcludedTools();
      const strictExcluded = getExcludedTools('strict');

      expect(excluded).toEqual(strictExcluded);
    });
  });

  describe('validateSecurityConfig', () => {
    test('returns true when all critical tools are excluded', () => {
      const excluded = ['save-file', 'str-replace-editor', 'remove-files'];
      expect(validateSecurityConfig(excluded)).toBe(true);
    });

    test('returns false when critical tools are missing', () => {
      const excluded = ['save-file']; // Missing str-replace-editor and remove-files
      expect(validateSecurityConfig(excluded)).toBe(false);
    });

    test('returns true when critical tools plus others are excluded', () => {
      const excluded = [
        'save-file',
        'str-replace-editor',
        'remove-files',
        'launch-process',
        'web-search',
      ];
      expect(validateSecurityConfig(excluded)).toBe(true);
    });
  });

  describe('describeSecurityConfig', () => {
    test('describes file modification disabled', () => {
      const excluded = ['save-file', 'str-replace-editor'];
      const description = describeSecurityConfig(excluded);

      expect(description).toContain('file modification disabled');
    });

    test('describes process execution disabled', () => {
      const excluded = ['launch-process', 'kill-process'];
      const description = describeSecurityConfig(excluded);

      expect(description).toContain('process execution disabled');
    });

    test('describes task modification disabled', () => {
      const excluded = ['add_tasks', 'update_tasks'];
      const description = describeSecurityConfig(excluded);

      expect(description).toContain('task modification disabled');
    });

    test('describes multiple categories', () => {
      const excluded = ['save-file', 'launch-process', 'add_tasks'];
      const description = describeSecurityConfig(excluded);

      expect(description).toContain('file modification disabled');
      expect(description).toContain('process execution disabled');
      expect(description).toContain('task modification disabled');
    });

    test('returns no restrictions message when empty', () => {
      const excluded: string[] = [];
      const description = describeSecurityConfig(excluded);

      expect(description).toBe('No security restrictions');
    });
  });

  describe('createSecurityConfig', () => {
    test('creates strict config by default', () => {
      const config = createSecurityConfig();

      expect(config.profile).toBe('strict');
      expect(config.isValid).toBe(true);
      expect(config.excludedTools.length).toBeGreaterThan(0);
      expect(config.description).toContain('Security:');
    });

    test('creates moderate config', () => {
      const config = createSecurityConfig('moderate');

      expect(config.profile).toBe('moderate');
      expect(config.isValid).toBe(true);
      expect(config.excludedTools).toContain('save-file');
      expect(config.excludedTools).not.toContain('add_tasks');
    });

    test('creates permissive config', () => {
      const config = createSecurityConfig('permissive');

      expect(config.profile).toBe('permissive');
      expect(config.isValid).toBe(true);
      expect(config.excludedTools).toContain('save-file');
      expect(config.excludedTools).not.toContain('launch-process');
    });
  });
});

