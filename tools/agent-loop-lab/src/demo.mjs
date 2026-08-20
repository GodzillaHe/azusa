import { runAgent } from './agent.mjs';
import { createScriptedModel } from './scripted-model.mjs';

const result = await runAgent(
  {
    task: 'Decide what should happen next for this project.',
    projectId: 'azusa',
  },
  { model: createScriptedModel() },
);

console.log(JSON.stringify(result, null, 2));
