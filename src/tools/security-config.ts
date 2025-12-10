/**
 * Security Configuration for Auggie SDK
 *
 * Provides security hardening configurations for vulnerability scanning.
 * The primary security measure is disabling file modification tools to ensure
 * scans are read-only and cannot accidentally modify the codebase.
 *
 * ## Security Principles
 *
 * 1. **Read-Only Scans**: Disable all file modification tools
 * 2. **Process Isolation**: Disable process execution tools
 * 3. **Least Privilege**: Only enable tools necessary for analysis
 *
 * ## Excluded Tools
 *
 * During security scans, the following tools are disabled:
 * - `save-file`: Prevents creating new files
 * - `str-replace-editor`: Prevents modifying existing files
 * - `remove-files`: Prevents deleting files
 * - `launch-process`: Prevents executing arbitrary commands
 * - `kill-process`: Prevents process termination
 * - `write-process`: Prevents writing to process stdin
 *
 * @module tools/security-config
 */

import type { PredefinedToolType } from '@augmentcode/auggie-sdk';

/**
 * Security profile for different scan modes
 */
export type SecurityProfile = 'strict' | 'moderate' | 'permissive';

/**
 * Tools that modify files or execute code
 * These should be disabled during security scans
 */
export const FILE_MODIFICATION_TOOLS: PredefinedToolType[] = [
  'save-file',
  'str-replace-editor',
  'remove-files',
];

/**
 * Tools that execute processes or commands
 * These should be disabled during security scans
 */
export const PROCESS_EXECUTION_TOOLS: PredefinedToolType[] = [
  'launch-process',
  'kill-process',
  'write-process',
];

/**
 * Tools that modify task lists
 * These may be disabled for stricter security
 */
export const TASK_MODIFICATION_TOOLS: PredefinedToolType[] = [
  'add_tasks',
  'update_tasks',
  'reorganize_tasklist',
];

/**
 * Get excluded tools based on security profile
 *
 * @param profile - Security profile to use
 * @returns Array of tool identifiers to exclude
 */
export function getExcludedTools(profile: SecurityProfile = 'strict'): PredefinedToolType[] {
  switch (profile) {
    case 'strict':
      // Disable all modification and execution tools
      return [
        ...FILE_MODIFICATION_TOOLS,
        ...PROCESS_EXECUTION_TOOLS,
        ...TASK_MODIFICATION_TOOLS,
      ];

    case 'moderate':
      // Disable file modification and process execution, but allow task management
      return [
        ...FILE_MODIFICATION_TOOLS,
        ...PROCESS_EXECUTION_TOOLS,
      ];

    case 'permissive':
      // Only disable file modification tools
      return FILE_MODIFICATION_TOOLS;

    default:
      // Default to strict for safety
      return [
        ...FILE_MODIFICATION_TOOLS,
        ...PROCESS_EXECUTION_TOOLS,
        ...TASK_MODIFICATION_TOOLS,
      ];
  }
}

/**
 * Validate that critical security tools are excluded
 *
 * @param excludedTools - Array of excluded tools
 * @returns True if all critical tools are excluded
 */
export function validateSecurityConfig(excludedTools: string[]): boolean {
  const criticalTools = FILE_MODIFICATION_TOOLS;
  return criticalTools.every((tool) => excludedTools.includes(tool));
}

/**
 * Get a human-readable description of excluded tools
 *
 * @param excludedTools - Array of excluded tools
 * @returns Description of security measures
 */
export function describeSecurityConfig(excludedTools: string[]): string {
  const categories: string[] = [];

  const hasFileModification = FILE_MODIFICATION_TOOLS.some((tool) =>
    excludedTools.includes(tool)
  );
  const hasProcessExecution = PROCESS_EXECUTION_TOOLS.some((tool) =>
    excludedTools.includes(tool)
  );
  const hasTaskModification = TASK_MODIFICATION_TOOLS.some((tool) =>
    excludedTools.includes(tool)
  );

  if (hasFileModification) {
    categories.push('file modification disabled');
  }
  if (hasProcessExecution) {
    categories.push('process execution disabled');
  }
  if (hasTaskModification) {
    categories.push('task modification disabled');
  }

  if (categories.length === 0) {
    return 'No security restrictions';
  }

  return `Security: ${categories.join(', ')}`;
}

/**
 * Security configuration for vulnerability scanning
 */
export interface SecurityConfig {
  /** Security profile to use */
  profile: SecurityProfile;
  /** Tools to exclude from the agent */
  excludedTools: PredefinedToolType[];
  /** Whether the configuration is valid */
  isValid: boolean;
  /** Human-readable description */
  description: string;
}

/**
 * Create a security configuration for vulnerability scanning
 *
 * @param profile - Security profile to use (default: 'strict')
 * @returns Security configuration
 */
export function createSecurityConfig(profile: SecurityProfile = 'strict'): SecurityConfig {
  const excludedTools = getExcludedTools(profile);
  const isValid = validateSecurityConfig(excludedTools);
  const description = describeSecurityConfig(excludedTools);

  return {
    profile,
    excludedTools,
    isValid,
    description,
  };
}

