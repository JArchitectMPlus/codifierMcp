/**
 * Custom error classes for CodifierMcp
 */

/**
 * Base error class for all CodifierMcp errors
 */
export class CodifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodifierError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when data store operations fail
 */
export class DataStoreError extends CodifierError {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DataStoreError';
  }
}

/**
 * Error thrown when Confluence operations fail via Atlassian MCP
 */
export class ConfluenceError extends DataStoreError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ConfluenceError';
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigurationError extends CodifierError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when content parsing fails
 */
export class ParseError extends CodifierError {
  constructor(message: string, public readonly content?: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Error thrown when rule validation fails
 */
export class ValidationError extends CodifierError {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when MCP tool execution fails
 */
export class McpToolError extends CodifierError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}