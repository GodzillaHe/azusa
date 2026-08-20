import { projects, recentEvents } from './data.mjs';

export class ToolExecutionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ToolExecutionError';
    this.code = code;
  }
}

function validateProjectId(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new ToolExecutionError('invalid_arguments', 'Tool arguments must be an object.');
  }
  if (typeof args.projectId !== 'string' || !args.projectId.trim()) {
    throw new ToolExecutionError('invalid_arguments', 'projectId must be a non-empty string.');
  }
  return args.projectId.trim();
}

function requireProject(projectId) {
  const project = projects[projectId];
  if (!project) {
    throw new ToolExecutionError('project_not_found', `Project ${projectId} was not found.`);
  }
  return project;
}

const tools = Object.freeze({
  get_project_status: Object.freeze({
    description: 'Get the current status and next step for one project.',
    parameters: Object.freeze({
      type: 'object',
      required: Object.freeze(['projectId']),
      properties: Object.freeze({ projectId: Object.freeze({ type: 'string' }) }),
      additionalProperties: false,
    }),
    execute(args) {
      const projectId = validateProjectId(args);
      return { ...requireProject(projectId) };
    },
  }),
  get_recent_events: Object.freeze({
    description: 'Get recent recorded events for one project.',
    parameters: Object.freeze({
      type: 'object',
      required: Object.freeze(['projectId']),
      properties: Object.freeze({ projectId: Object.freeze({ type: 'string' }) }),
      additionalProperties: false,
    }),
    execute(args) {
      const projectId = validateProjectId(args);
      requireProject(projectId);
      return { projectId, events: [...(recentEvents[projectId] ?? [])] };
    },
  }),
});

export function getToolSchemas() {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export async function executeTool(name, args) {
  const tool = tools[name];
  if (!tool) {
    throw new ToolExecutionError('unknown_tool', `Unknown tool: ${String(name)}`);
  }
  return tool.execute(args);
}
