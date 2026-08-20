import { validateTriageOutput } from './schema.mjs';
import { executeTool, getToolSchemas } from './tools.mjs';

export class AgentRunError extends Error {
  constructor(code, message, trace = []) {
    super(message);
    this.name = 'AgentRunError';
    this.code = code;
    this.trace = trace;
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function failureSignature(tool, args, error) {
  return JSON.stringify({ tool, args: stableValue(args), code: error.code ?? 'tool_error' });
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AgentRunError('invalid_input', 'Agent input must be an object.');
  }
  if (typeof input.task !== 'string' || !input.task.trim()) {
    throw new AgentRunError('invalid_input', 'task must be a non-empty string.');
  }
  if (typeof input.projectId !== 'string' || !input.projectId.trim()) {
    throw new AgentRunError('invalid_input', 'projectId must be a non-empty string.');
  }
  return { task: input.task.trim(), projectId: input.projectId.trim() };
}

function validateDecision(decision, trace) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new AgentRunError('invalid_model_decision', 'Model decision must be an object.', trace);
  }
  if (decision.type === 'tool_call') {
    if (typeof decision.name !== 'string' || !decision.name
      || !decision.arguments || typeof decision.arguments !== 'object' || Array.isArray(decision.arguments)) {
      throw new AgentRunError('invalid_model_decision', 'Tool call decision is invalid.', trace);
    }
    return;
  }
  if (decision.type === 'final') return;
  throw new AgentRunError('invalid_model_decision', `Unknown model decision type: ${String(decision.type)}`, trace);
}

export async function runAgent(input, { model, maxSteps = 4, toolExecutor = executeTool } = {}) {
  const normalized = validateInput(input);
  if (!model || typeof model.decide !== 'function') {
    throw new AgentRunError('invalid_model', 'model.decide is required.');
  }
  if (!Number.isInteger(maxSteps) || maxSteps < 1) {
    throw new AgentRunError('invalid_budget', 'maxSteps must be a positive integer.');
  }

  const observations = [];
  const trace = [];
  let previousFailure = null;
  let repeatedFailureCount = 0;

  for (let step = 1; step <= maxSteps; step += 1) {
    const decision = await model.decide({
      ...normalized,
      observations: structuredClone(observations),
      tools: getToolSchemas(),
      step,
      maxSteps,
    });
    validateDecision(decision, trace);
    trace.push({ step, event: 'model_decision', decision: structuredClone(decision) });

    if (decision.type === 'final') {
      const validation = validateTriageOutput(decision.output);
      if (!validation.ok) {
        throw new AgentRunError(
          'invalid_final_output',
          `Final output failed schema validation: ${validation.errors.join('; ')}`,
          trace,
        );
      }
      trace.push({ step, event: 'completed' });
      return { output: validation.data, trace };
    }

    try {
      const result = await toolExecutor(decision.name, decision.arguments);
      const observation = {
        kind: 'tool_result',
        tool: decision.name,
        arguments: structuredClone(decision.arguments),
        result: structuredClone(result),
      };
      observations.push(observation);
      trace.push({ step, event: 'tool_result', observation: structuredClone(observation) });
      previousFailure = null;
      repeatedFailureCount = 0;
    } catch (error) {
      const normalizedError = {
        code: typeof error.code === 'string' ? error.code : 'tool_error',
        message: error instanceof Error ? error.message : String(error),
      };
      const observation = {
        kind: 'tool_error',
        tool: decision.name,
        arguments: structuredClone(decision.arguments),
        error: normalizedError,
      };
      observations.push(observation);
      trace.push({ step, event: 'tool_error', observation: structuredClone(observation) });

      const signature = failureSignature(decision.name, decision.arguments, normalizedError);
      repeatedFailureCount = signature === previousFailure ? repeatedFailureCount + 1 : 1;
      previousFailure = signature;
      if (repeatedFailureCount >= 2) {
        throw new AgentRunError(
          'repeated_tool_failure',
          `The same tool call failed twice: ${decision.name} (${normalizedError.code}).`,
          trace,
        );
      }
    }
  }

  throw new AgentRunError('step_budget_exceeded', `Agent exceeded the ${maxSteps}-step budget.`, trace);
}
