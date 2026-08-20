import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentRunError, runAgent } from '../src/agent.mjs';
import { createScriptedModel } from '../src/scripted-model.mjs';

test('completes after observing status and recent events', async () => {
  const result = await runAgent(
    { task: 'Triage the project.', projectId: 'azusa' },
    { model: createScriptedModel() },
  );

  assert.equal(result.output.projectId, 'azusa');
  assert.equal(result.output.recommendedAction, 'advance_next_step');
  assert.deepEqual(
    result.trace.filter((entry) => entry.event === 'tool_result').map((entry) => entry.observation.tool),
    ['get_project_status', 'get_recent_events'],
  );
});

test('rejects invalid input before calling the model', async () => {
  let called = false;
  const model = { async decide() { called = true; } };

  await assert.rejects(
    runAgent({ task: '', projectId: 'azusa' }, { model }),
    (error) => error instanceof AgentRunError && error.code === 'invalid_input',
  );
  assert.equal(called, false);
});

test('stops after the same unknown tool fails twice', async () => {
  const model = {
    async decide() {
      return { type: 'tool_call', name: 'delete_everything', arguments: { projectId: 'azusa' } };
    },
  };

  await assert.rejects(
    runAgent({ task: 'Triage the project.', projectId: 'azusa' }, { model }),
    (error) => error instanceof AgentRunError
      && error.code === 'repeated_tool_failure'
      && error.trace.filter((entry) => entry.event === 'tool_error').length === 2,
  );
});

test('stops after the same missing-project lookup fails twice', async () => {
  const model = {
    async decide() {
      return { type: 'tool_call', name: 'get_project_status', arguments: { projectId: 'missing' } };
    },
  };

  await assert.rejects(
    runAgent({ task: 'Triage the project.', projectId: 'missing' }, { model }),
    (error) => error instanceof AgentRunError && error.code === 'repeated_tool_failure',
  );
});

test('rejects a final answer that does not match the output schema', async () => {
  const model = {
    async decide() {
      return { type: 'final', output: { projectId: 'azusa' } };
    },
  };

  await assert.rejects(
    runAgent({ task: 'Triage the project.', projectId: 'azusa' }, { model }),
    (error) => error instanceof AgentRunError && error.code === 'invalid_final_output',
  );
});

test('stops when the model never produces a final answer', async () => {
  const model = {
    async decide({ step }) {
      return {
        type: 'tool_call',
        name: step % 2 === 1 ? 'get_project_status' : 'get_recent_events',
        arguments: { projectId: 'azusa' },
      };
    },
  };

  await assert.rejects(
    runAgent({ task: 'Triage the project.', projectId: 'azusa' }, { model, maxSteps: 4 }),
    (error) => error instanceof AgentRunError
      && error.code === 'step_budget_exceeded'
      && error.trace.filter((entry) => entry.event === 'model_decision').length === 4,
  );
});
