const ACTIONS = new Set(['advance_next_step', 'collect_more_evidence', 'no_action']);

export function validateTriageOutput(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['output must be an object'] };
  }
  if (typeof value.projectId !== 'string' || !value.projectId.trim()) {
    errors.push('projectId must be a non-empty string');
  }
  if (typeof value.diagnosis !== 'string' || !value.diagnosis.trim()) {
    errors.push('diagnosis must be a non-empty string');
  }
  if (!ACTIONS.has(value.recommendedAction)) {
    errors.push('recommendedAction is invalid');
  }
  if (!Array.isArray(value.evidence) || value.evidence.length === 0
    || value.evidence.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push('evidence must contain at least one non-empty string');
  }
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) {
    errors.push('confidence must be a number between 0 and 1');
  }
  return errors.length ? { ok: false, errors } : { ok: true, data: value };
}
