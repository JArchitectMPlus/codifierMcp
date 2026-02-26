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
  // Data Store Selection
  DATA_STORE: z
    .enum(['confluence', 'supabase'])
    .default('supabase')
    .describe('Data store backend: supabase (default) or confluence'),

  // Supabase Configuration
  SUPABASE_URL: z
    .string()
    .url('SUPABASE_URL must be a valid URL')
    .optional()
    .describe('Supabase project URL (e.g., https://abc123.supabase.co)'),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1)
    .optional()
    .describe('Supabase service role key for server-side access'),

  SUPABASE_PROJECT_ID: z
    .string()
    .optional()
    .describe('Supabase project ID (UUID). If omitted, auto-creates a default project'),

  // Confluence Authentication (optional — only needed when DATA_STORE=confluence)
  CONFLUENCE_BASE_URL: z
    .string()
    .url('CONFLUENCE_BASE_URL must be a valid URL')
    .optional()
    .describe('Confluence base URL (e.g., https://yoursite.atlassian.net)'),

  CONFLUENCE_USERNAME: z
    .string()
    .email('CONFLUENCE_USERNAME must be a valid email')
    .optional()
    .describe('Confluence username (email address)'),

  CONFLUENCE_API_TOKEN: z
    .string()
    .min(1, 'CONFLUENCE_API_TOKEN is required')
    .optional()
    .describe('Confluence API token for authentication'),

  // Confluence Configuration
  CONFLUENCE_SPACE_KEY: z
    .string()
    .min(1, 'CONFLUENCE_SPACE_KEY is required')
    .optional()
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

  // AWS Athena Configuration (optional — only needed when using query_data tool)
  AWS_REGION: z
    .string()
    .optional()
    .describe('AWS region for Athena queries'),

  AWS_ACCESS_KEY_ID: z
    .string()
    .optional()
    .describe('AWS access key ID for Athena authentication'),

  AWS_SECRET_ACCESS_KEY: z
    .string()
    .optional()
    .describe('AWS secret access key for Athena authentication'),

  ATHENA_S3_OUTPUT_LOCATION: z
    .string()
    .optional()
    .describe('S3 URI for Athena query output (e.g., s3://my-bucket/athena-results/)'),

  ATHENA_DATABASE: z
    .string()
    .default('default')
    .describe('Athena database/catalog name (default: "default")'),

  ATHENA_WORKGROUP: z
    .string()
    .default('primary')
    .describe('Athena workgroup name (default: "primary")'),

  ATHENA_TIMEOUT_SECONDS: z
    .string()
    .default('60')
    .describe('Athena query timeout in seconds (default: "60")'),

  // VCS Token Configuration (optional — used by pack_repo for private repositories)
  GITHUB_TOKEN: z
    .string()
    .optional()
    .describe('GitHub personal access token for cloning private repositories'),

  GITLAB_TOKEN: z
    .string()
    .optional()
    .describe('GitLab personal access token for cloning private repositories'),

  BITBUCKET_TOKEN: z
    .string()
    .optional()
    .describe('Bitbucket app password or access token for cloning private repositories'),

  // Transport Configuration
  TRANSPORT_MODE: z
    .enum(['stdio', 'http'])
    .default('stdio')
    .describe('Transport mode: stdio for local use, http for remote server'),

  HTTP_PORT: z
    .coerce.number()
    .int()
    .positive()
    .default(3000)
    .describe('HTTP server port (used when TRANSPORT_MODE=http)'),

  API_AUTH_TOKEN: z
    .string()
    .optional()
    .describe('API authentication token (required when TRANSPORT_MODE=http)'),
}).superRefine((data, ctx) => {
  // Conditional validation: Supabase fields required when DATA_STORE=supabase
  if (data.DATA_STORE === 'supabase') {
    if (!data.SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SUPABASE_URL is required when DATA_STORE is supabase',
        path: ['SUPABASE_URL'],
      });
    }
    if (!data.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SUPABASE_SERVICE_ROLE_KEY is required when DATA_STORE is supabase',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
      });
    }
  }

  // Conditional validation: Confluence fields required when DATA_STORE=confluence
  if (data.DATA_STORE === 'confluence') {
    if (!data.CONFLUENCE_BASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CONFLUENCE_BASE_URL is required when DATA_STORE is confluence',
        path: ['CONFLUENCE_BASE_URL'],
      });
    }
    if (!data.CONFLUENCE_USERNAME) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CONFLUENCE_USERNAME is required when DATA_STORE is confluence',
        path: ['CONFLUENCE_USERNAME'],
      });
    }
    if (!data.CONFLUENCE_API_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CONFLUENCE_API_TOKEN is required when DATA_STORE is confluence',
        path: ['CONFLUENCE_API_TOKEN'],
      });
    }
    if (!data.CONFLUENCE_SPACE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CONFLUENCE_SPACE_KEY is required when DATA_STORE is confluence',
        path: ['CONFLUENCE_SPACE_KEY'],
      });
    }
  }

  // Conditional validation: API_AUTH_TOKEN required when TRANSPORT_MODE is http
  if (data.TRANSPORT_MODE === 'http' && !data.API_AUTH_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'API_AUTH_TOKEN is required when TRANSPORT_MODE is http',
      path: ['API_AUTH_TOKEN'],
    });
  }
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
