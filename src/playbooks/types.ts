/**
 * Playbook Engine types for CodifierMcp v2.0
 */

export type StepActionType = 'store' | 'skill-invoke' | 'generate' | 'data-query';

export interface PlaybookStep {
  /** Slug identifier for this step, e.g. "collect-objective" */
  id: string;
  title: string;
  /** Prompt shown to the user for this step */
  prompt: string;
  action: StepActionType;
  /** For 'store' action: which memory_type to persist collected data as */
  store_as?: string;
  /** For 'generate' action: which generator template to invoke */
  generator?: string;
  /** For 'data-query' action: the operation to run */
  query_operation?: string;
  /** Fields to collect from user input */
  collect?: string[];
}

export interface Playbook {
  /** Unique identifier, e.g. "initialize-project" */
  id: string;
  name: string;
  role: 'developer' | 'researcher';
  description: string;
  steps: PlaybookStep[];
}

export interface PlaybookSession {
  id: string;
  project_id: string;
  playbook_id: string;
  /** Zero-based index of the step currently awaiting input */
  current_step: number;
  collected_data: Record<string, unknown>;
  status: 'active' | 'completed' | 'abandoned';
}
