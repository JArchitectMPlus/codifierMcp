/**
 * Authentication middleware for HTTP transport
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AuthConfig {
  apiAuthToken: string;
}

/**
 * Express middleware that validates Bearer token authentication
 *
 * @param config - Authentication configuration containing the API token
 * @returns Express middleware function
 */
export function createAuthMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip authentication for health check and OAuth discovery endpoints
    if (req.path === '/health' || req.path.startsWith('/.well-known/') || req.method === 'OPTIONS') {
      next();
      return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Authentication failed: missing Authorization header', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(401).json({ error: 'unauthorized', error_description: 'Missing Authorization header' });
      return;
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      logger.warn('Authentication failed: invalid scheme', {
        path: req.path,
        method: req.method,
        scheme,
        ip: req.ip,
      });
      res.status(401).json({ error: 'unauthorized', error_description: 'Invalid authentication scheme (expected Bearer)' });
      return;
    }

    if (!token || token !== config.apiAuthToken) {
      logger.warn('Authentication failed: invalid token', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(401).json({ error: 'unauthorized', error_description: 'Invalid API token' });
      return;
    }

    logger.debug('Authentication successful', {
      path: req.path,
      method: req.method,
    });

    next();
  };
}
