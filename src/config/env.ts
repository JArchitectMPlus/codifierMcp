/**
 * Environment configuration with Zod validation
 */

import { z } from 'zod';
import { ConfigurationError } from '../utils/errors.js';
import { logger, LogLevel } from '../utils/logger.js';

/**
 * Environment configuration schema
 */
const envSchema = z.object({
  // Confluence Authentication
  CONFLUENCE_BASE_URL: z
    .string()
    .url('CONFLUENCE_BASE_URL must be a valid URL')
    .describe('Confluence base URL (e.g., https://yoursite.atlassian.net)'),

  CONFLUENCE_USERNAME: z
    .string()
    .email('CONFLUENCE_USERNAME must be a valid email')
    .describe('Confluence username (email address)'),

  CONFLUENCE_API_TOKEN: z
    .string()
    .min(1, 'CONFLUENCE_API_TOKEN is required')
    .describe('Confluence API token for authentication'),

  // Confluence Configuration
  CONFLUENCE_SPACE_KEY: z
    .string()
    .min(1, 'CONFLUENCE_SPACE_KEY is required')
    .describe('The space key for the Confluence workspace (e.g., "TT")'),

  RULES_PAGE_TITLE: z
    .string()
    .default('Rules')
    .describe('The title of the page containing rules'),

  INSIGHTS_PARENT_PAGE_TITLE: z
    .string()
    .default('Memory Insights')
    .describe('The title of the parent page for insights'),

  // Logging Configuration
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info')
    .describe('Logging level'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Load and validate environment configuration
 * @throws {ConfigurationError} If configuration is invalid
 */
export function loadConfig(): EnvConfig {
  try {
    const config = envSchema.parse(process.env);

    // Update logger level based on config
    logger.setLogLevel(config.LOG_LEVEL as LogLevel);

    logger.debug('Configuration loaded successfully', config);

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

      throw new ConfigurationError(
        `Environment configuration validation failed: ${errorMessages}`
      );
    }
    throw new ConfigurationError(
      `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a singleton configuration instance
 * Cached after first load
 */
let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}