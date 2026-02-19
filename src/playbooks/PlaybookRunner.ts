/**
 * PlaybookRunner — linear state machine for executing playbook sessions.
 *
 * Accepts IDataStore for session and memory persistence, keeping PlaybookRunner
 * decoupled from any specific backend implementation.
 */

import { loadPlaybook } from './loader.js';
import type { Playbook, PlaybookSession, PlaybookStep } from './types.js';
import type { IDataStore, MemoryType, SessionRow } from '../datastore/interface.js';
import { CodifierError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Public return types
// ---------------------------------------------------------------------------

export interface StartPlaybookResult {
  session: PlaybookSession;
  step: PlaybookStep;
  prompt: string;
}

export interface AdvanceStepResult {
  session: PlaybookSession;
  step?: PlaybookStep;
  prompt?: string;
  completed: boolean;
  generate_request?: {
    generator: string;
    context: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// PlaybookRunner
// ---------------------------------------------------------------------------

export class PlaybookRunner {
  constructor(private readonly dataStore: IDataStore) {}

  /**
   * Start a new playbook session.
   *
   * Creates a row in the `sessions` table and returns the first step prompt.
   */
  async startPlaybook(params: {
    playbook_id: string;
    project_id: string;
  }): Promise<StartPlaybookResult> {
    logger.info('Starting playbook', params);

    const playbook: Playbook = await loadPlaybook(params.playbook_id);

    if (playbook.steps.length === 0) {
      throw new CodifierError(`Playbook "${params.playbook_id}" has no steps`);
    }

    const row: SessionRow = await this.dataStore.createSession({
      project_id: params.project_id,
      playbook_id: params.playbook_id,
    });

    const session = rowToSession(row);
    const firstStep = playbook.steps[0];

    logger.debug('Playbook session created', {
      sessionId: session.id,
      playbookId: params.playbook_id,
      firstStep: firstStep.id,
    });

    return { session, step: firstStep, prompt: firstStep.prompt };
  }

  /**
   * Advance the active session by one step.
   *
   * Merges the user's input into `collected_data`, handles side-effects for
   * `store` action steps, increments `current_step`, and returns the next
   * step (or a completion signal with an optional generate_request).
   */
  async advanceStep(params: {
    session_id: string;
    input: Record<string, unknown>;
  }): Promise<AdvanceStepResult> {
    logger.info('Advancing playbook step', { sessionId: params.session_id });

    const session = await this.loadSession(params.session_id);

    if (session.status !== 'active') {
      throw new CodifierError(
        `Session "${params.session_id}" is not active (status: ${session.status})`
      );
    }

    const playbook: Playbook = await loadPlaybook(session.playbook_id);
    const currentStepDef = playbook.steps[session.current_step];

    if (!currentStepDef) {
      throw new CodifierError(
        `Session "${params.session_id}" references out-of-bounds step index ${session.current_step}`
      );
    }

    // Merge input into running collected_data
    const updatedData: Record<string, unknown> = {
      ...session.collected_data,
      ...params.input,
    };

    // Side-effect: persist a memory row when the step action is 'store'
    if (currentStepDef.action === 'store' && currentStepDef.store_as) {
      await this.storeCollectedData({
        projectId: session.project_id,
        step: currentStepDef,
        collectedData: updatedData,
      });
    }

    const nextStepIndex = session.current_step + 1;
    const isLastStep = nextStepIndex >= playbook.steps.length;
    const newStatus = isLastStep ? 'completed' : 'active';

    const updatedRow: SessionRow = await this.dataStore.updateSession(params.session_id, {
      current_step: isLastStep ? session.current_step : nextStepIndex,
      collected_data: updatedData,
      status: newStatus,
    });

    const updatedSession = rowToSession(updatedRow);

    if (isLastStep) {
      logger.info('Playbook session completed', { sessionId: params.session_id });
      return { session: updatedSession, completed: true };
    }

    const nextStep = playbook.steps[nextStepIndex];

    // For generate steps, return the generator name and full collected context
    if (nextStep.action === 'generate' && nextStep.generator) {
      logger.debug('Returning generate_request for step', { generator: nextStep.generator });
      return {
        session: updatedSession,
        step: nextStep,
        prompt: nextStep.prompt,
        completed: false,
        generate_request: {
          generator: nextStep.generator,
          context: updatedData,
        },
      };
    }

    return {
      session: updatedSession,
      step: nextStep,
      prompt: nextStep.prompt,
      completed: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async loadSession(id: string): Promise<PlaybookSession> {
    const row = await this.dataStore.getSession(id);

    if (!row) {
      throw new CodifierError(`Session not found: "${id}"`);
    }

    return rowToSession(row);
  }

  /**
   * Persist a memory row for a completed `store` step.
   * Storage failures are logged as warnings so that they never block the user
   * from advancing through the playbook.
   */
  private async storeCollectedData(params: {
    projectId: string;
    step: PlaybookStep;
    collectedData: Record<string, unknown>;
  }): Promise<void> {
    const { projectId, step, collectedData } = params;

    // Narrow the payload to only the declared collect fields when available
    const contentPayload: Record<string, unknown> =
      step.collect && step.collect.length > 0
        ? Object.fromEntries(step.collect.map((key) => [key, collectedData[key]]))
        : collectedData;

    logger.debug('Storing memory for step', {
      stepId: step.id,
      memoryType: step.store_as,
      projectId,
    });

    try {
      await this.dataStore.upsertMemory({
        project_id: projectId,
        memory_type: step.store_as as MemoryType,
        title: step.title,
        content: contentPayload,
        tags: [],
        confidence: 1.0,
        source_role: 'playbook',
      });
    } catch (error) {
      logger.warn('Failed to store memory for playbook step — continuing', {
        stepId: step.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function rowToSession(row: SessionRow): PlaybookSession {
  return {
    id: row.id,
    project_id: row.project_id,
    playbook_id: row.playbook_id,
    current_step: row.current_step,
    collected_data: row.collected_data,
    status: row.status,
  };
}
