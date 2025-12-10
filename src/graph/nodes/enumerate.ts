import { startActiveObservation } from '@langfuse/tracing';
import * as fs from 'fs';
import * as path from 'path';
import type { AnalysisTarget, SecurityAnalysisState } from '../state';

/**
 * File patterns that indicate security-relevant code
 */
const SECURITY_RELEVANT_PATTERNS = {
  routes: ['routes/', 'router/', 'api/', 'controllers/'],
  database: ['db.js', 'database.js', 'mongoose', 'typeorm', 'sequelize', 'knex'],
  auth: ['auth', 'login', 'password', 'session', 'token', 'jwt'],
  userInput: ['form', 'input', 'upload', 'file'],
  config: ['config', '.env', 'settings'],
};

/**
 * File extensions to scan for security analysis
 */
const SCANNABLE_EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx'];

/**
 * Directories to skip during enumeration
 */
const SKIP_DIRECTORIES = ['node_modules', '.git', 'dist', 'build', 'coverage', '.nyc_output'];

/**
 * Recursively enumerate files in a directory
 */
async function enumerateFilesRecursively(
  dirPath: string,
  basePath: string
): Promise<{ path: string; relativePath: string }[]> {
  const files: { path: string; relativePath: string }[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (SKIP_DIRECTORIES.includes(entry.name)) {
          continue;
        }
        // Recurse into subdirectories
        const subFiles = await enumerateFilesRecursively(fullPath, basePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // Include JavaScript/TypeScript files and specific config files
        if (
          SCANNABLE_EXTENSIONS.includes(ext) ||
          entry.name === 'package.json' ||
          entry.name === 'package-lock.json'
        ) {
          files.push({ path: fullPath, relativePath });
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return files;
}

/**
 * Determine the target type based on file path and content patterns
 */
function determineTargetType(relativePath: string): AnalysisTarget['type'] {
  const pathLower = relativePath.toLowerCase();

  // Check for route patterns
  if (SECURITY_RELEVANT_PATTERNS.routes.some((p) => pathLower.includes(p))) {
    return 'route';
  }

  // Check for controller patterns
  if (pathLower.includes('controller') || pathLower.includes('handler')) {
    return 'controller';
  }

  // Check for dependency files
  if (pathLower.includes('package.json') || pathLower.includes('package-lock.json')) {
    return 'dependency';
  }

  return 'file';
}

/**
 * Generate metadata for a target based on its path
 */
function generateTargetMetadata(relativePath: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  const pathLower = relativePath.toLowerCase();

  // Add relevant tags based on patterns
  const tags: string[] = [];

  if (SECURITY_RELEVANT_PATTERNS.database.some((p) => pathLower.includes(p))) {
    tags.push('database');
  }
  if (SECURITY_RELEVANT_PATTERNS.auth.some((p) => pathLower.includes(p))) {
    tags.push('authentication');
  }
  if (SECURITY_RELEVANT_PATTERNS.userInput.some((p) => pathLower.includes(p))) {
    tags.push('user-input');
  }
  if (SECURITY_RELEVANT_PATTERNS.config.some((p) => pathLower.includes(p))) {
    tags.push('configuration');
  }

  // Add entry point detection
  if (relativePath === 'app.js' || relativePath === 'index.js' || relativePath === 'server.js') {
    tags.push('entrypoint');
  }

  if (tags.length > 0) {
    metadata.tags = tags.join(',');
  }

  return metadata;
}

/**
 * Enumerate targets node - identifies files and code locations to analyze
 *
 * Phase 4 implementation:
 * - Recursively scans the repository for JavaScript/TypeScript files
 * - Identifies routes, controllers, database access code, and user input handling
 * - Tags files based on security-relevant patterns
 * - Returns prioritized list of targets for analysis
 */
export async function enumerateTargetsNode(
  state: SecurityAnalysisState
): Promise<Partial<SecurityAnalysisState>> {
  return startActiveObservation(
    'node.enumerate_targets',
    async (obs) => {
      // Capture input state for Langfuse tracing (retriever type for file discovery)
      obs.update({
        input: {
          query: `Enumerate security-relevant files in ${state.repoPath}`,
          scanId: state.scanId,
          repoPath: state.repoPath,
        },
        metadata: {
          nodeType: 'enumerate',
          phase: 'target_discovery',
          retrievalType: 'filesystem',
        },
      });

      console.log(`[enumerate] Enumerating targets in ${state.repoPath}`);

      // Resolve the repository path
      const absoluteRepoPath = path.resolve(state.repoPath);

      // Check if the repository exists
      if (!fs.existsSync(absoluteRepoPath)) {
        console.warn(`[enumerate] Repository path does not exist: ${absoluteRepoPath}`);
        obs.update({
          output: { targets: [], error: `Repository path does not exist: ${absoluteRepoPath}` },
          level: 'ERROR',
          statusMessage: `Repository path does not exist: ${absoluteRepoPath}`,
        });
        return { targets: [] };
      }

      // Enumerate all scannable files
      const files = await enumerateFilesRecursively(absoluteRepoPath, absoluteRepoPath);

      // Convert to analysis targets with type and metadata
      const targets: AnalysisTarget[] = files.map(({ path: fullPath, relativePath }) => ({
        path: fullPath,
        type: determineTargetType(relativePath),
        metadata: {
          relativePath,
          ...generateTargetMetadata(relativePath),
        },
      }));

      // Sort targets by priority (routes and controllers first, then files, then dependencies)
      const priorityOrder: Record<AnalysisTarget['type'], number> = {
        route: 1,
        controller: 2,
        file: 3,
        dependency: 4,
      };

      targets.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);

      // Calculate target breakdown
      const breakdown = {
        routes: targets.filter((t) => t.type === 'route').length,
        controllers: targets.filter((t) => t.type === 'controller').length,
        files: targets.filter((t) => t.type === 'file').length,
        dependencies: targets.filter((t) => t.type === 'dependency').length,
      };

      console.log(`[enumerate] Found ${targets.length} targets`);
      console.log(
        `[enumerate] Breakdown: ${breakdown.routes} routes, ` +
          `${breakdown.controllers} controllers, ` +
          `${breakdown.files} files, ` +
          `${breakdown.dependencies} dependencies`
      );

      // Capture output for Langfuse tracing
      obs.update({
        output: {
          targetCount: targets.length,
          breakdown,
          // Include sample of target paths (not full list to avoid bloat)
          samplePaths: targets.slice(0, 10).map((t) => t.metadata?.relativePath ?? t.path),
        },
      });

      return { targets };
    },
    { asType: 'retriever' }
  );
}
