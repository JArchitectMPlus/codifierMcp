/**
 * RepoMix integration — programmatic pack() API wrapper
 *
 * Uses repomix's programmatic API to condense a repository into a
 * single text snapshot suitable for LLM context.
 */

import { pack, mergeConfigs } from 'repomix';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { logger } from '../utils/logger.js';
import { CodifierError } from '../utils/errors.js';

/**
 * Inject a VCS token into an HTTPS URL as a credential.
 * Reads GITHUB_TOKEN, GITLAB_TOKEN, BITBUCKET_TOKEN from the environment.
 * No-ops for SSH URLs or when no matching token is set.
 */
function injectToken(url: string): string {
  if (!url.startsWith('https://')) return url;

  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  let token: string | undefined;
  if (host.includes('github.com')) token = process.env['GITHUB_TOKEN'];
  else if (host.includes('gitlab.com') || host.includes('gitlab.')) token = process.env['GITLAB_TOKEN'];
  else if (host.includes('bitbucket.org')) token = process.env['BITBUCKET_TOKEN'];

  if (!token) return url;

  // GitHub/GitLab: https://token@host/...
  // Bitbucket: https://x-token-auth:token@host/...
  if (host.includes('bitbucket.org')) {
    parsed.username = 'x-token-auth';
    parsed.password = token;
  } else {
    parsed.username = token;
    parsed.password = '';
  }

  return parsed.toString();
}

export interface PackResult {
  snapshot: string;
  tokenCount: number;
  fileCount: number;
}

/**
 * Pack a repository (remote URL or local path) into a text snapshot.
 *
 * For remote URLs, repomix clones the repo to a temp directory before packing.
 * Token count is estimated at 1 token per 4 characters when not provided by repomix.
 *
 * @param url - Repository URL (https://github.com/...) or local directory path
 * @returns PackResult with snapshot text, estimated token count, and file count
 * @throws {CodifierError} If packing fails
 */
export async function packRepository(url: string): Promise<PackResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codifier-repomix-'));
  const outputFile = path.join(tmpDir, 'output.txt');

  logger.info('Packing repository with repomix', { url, outputFile });

  try {
    const isRemote = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('git@');
    const resolvedUrl = isRemote ? injectToken(url) : url;

    const rootDirs = isRemote ? [tmpDir] : [resolvedUrl];

    // Build a proper RepomixConfigMerged via mergeConfigs
    const fileConfig = {
      output: { filePath: outputFile, style: 'plain' as const },
      ignore: { useGitignore: true, useDefaultPatterns: true },
      security: { enableSecurityCheck: false },
      ...(isRemote ? { remote: { url: resolvedUrl } } : {}),
    };
    const packConfig = mergeConfigs(isRemote ? tmpDir : resolvedUrl, fileConfig, {});

    logger.debug('repomix pack config', { url, outputFile });

    const result = await pack(rootDirs, packConfig);

    // Read the output file that repomix wrote
    let snapshot: string;
    try {
      snapshot = await fs.readFile(outputFile, 'utf-8');
    } catch {
      // Fallback: repomix may have placed output elsewhere or returned content directly
      snapshot = typeof result === 'object' && result !== null && 'content' in result
        ? String((result as Record<string, unknown>).content)
        : JSON.stringify(result);
    }

    // Extract metrics from result when available
    let fileCount = 0;
    let tokenCount = 0;

    if (typeof result === 'object' && result !== null) {
      const metrics = result as unknown as Record<string, unknown>;
      fileCount = typeof metrics.totalFiles === 'number' ? metrics.totalFiles : 0;
      tokenCount = typeof metrics.totalTokens === 'number'
        ? metrics.totalTokens
        : Math.ceil(snapshot.length / 4);
    } else {
      tokenCount = Math.ceil(snapshot.length / 4);
    }

    logger.info('Repository packed successfully', {
      url,
      fileCount,
      tokenCount,
      snapshotBytes: snapshot.length,
    });

    return { snapshot, tokenCount, fileCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to pack repository', { url, error: message });
    throw new CodifierError(`Failed to pack repository "${url}": ${message}`);
  } finally {
    // Clean up temp directory regardless of success or failure
    await fs.rm(tmpDir, { recursive: true, force: true }).catch((err) => {
      logger.warn('Failed to clean up repomix temp dir', {
        tmpDir,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    });
  }
}
