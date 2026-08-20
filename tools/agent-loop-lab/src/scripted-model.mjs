function findObservation(observations, toolName) {
  return observations.find((item) => item.kind === 'tool_result' && item.tool === toolName);
}

export function createScriptedModel() {
  return {
    async decide({ projectId, observations }) {
      const status = findObservation(observations, 'get_project_status');
      if (!status) {
        return {
          type: 'tool_call',
          name: 'get_project_status',
          arguments: { projectId },
        };
      }

      const events = findObservation(observations, 'get_recent_events');
      if (!events) {
        return {
          type: 'tool_call',
          name: 'get_recent_events',
          arguments: { projectId },
        };
      }

      const project = status.result;
      const eventList = events.result.events;
      const recommendedAction = project.status === 'archived'
        ? 'no_action'
        : project.nextStep
          ? 'advance_next_step'
          : 'collect_more_evidence';

      return {
        type: 'final',
        output: {
          projectId,
          diagnosis: project.status === 'archived'
            ? 'The project is archived and has no active commitment.'
            : `The project is ${project.status} with a defined next step.`,
          recommendedAction,
          evidence: [
            `status=${project.status}`,
            `updatedAt=${project.updatedAt}`,
            `recentEvents=${eventList.length}`,
          ],
          confidence: eventList.length > 0 ? 0.9 : 0.65,
        },
      };
    },
  };
}
