/**
 * Supabase client wrapper for CodifierMcp
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface SupabaseClientConfig {
  url: string;
  serviceRoleKey: string;
}

/**
 * Thin wrapper around the Supabase JS client
 */
export class CodifierSupabaseClient {
  private client: SupabaseClient;
  private readonly url: string;

  constructor(config: SupabaseClientConfig) {
    this.url = config.url;
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  /** Extract project ref from URL (e.g., "abc123" from "https://abc123.supabase.co") */
  getProjectRef(): string {
    try {
      const hostname = new URL(this.url).hostname;
      const ref = hostname.split('.')[0];
      return ref;
    } catch {
      throw new SupabaseError(`Invalid Supabase URL: ${this.url}`);
    }
  }

  /** Get the raw Supabase client for direct queries */
  getClient(): SupabaseClient {
    return this.client;
  }

  /** Simple health check via a lightweight query */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client.from('projects').select('id').limit(1);
      if (error) {
        logger.warn('Supabase health check failed', { error: error.message });
        return false;
      }
      return true;
    } catch (error) {
      logger.warn('Supabase health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}
