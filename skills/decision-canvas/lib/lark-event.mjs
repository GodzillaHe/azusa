import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  answerErrors,
  detailKey,
  isRecord,
  normalizeAnswers,
  optionNeedsDetail,
  sectionAnswerErrors,
} from './core.mjs';

class LarkEventError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'LarkEventError';
    this.details = details;
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    if (error instanceof SyntaxError) throw new LarkEventError(`Invalid JSON in ${filePath}.`);
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function parseFormValue(value) {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) throw new LarkEventError('The card event does not contain form_value.');
  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new LarkEventError('The card event form_value must be a JSON object.');
  }
}

function checkboxValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // lark-cli may flatten a multi-select into a comma-separated value.
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function sectionAnswers(section, rawAnswers) {
  const answers = {};
  const knownKeys = new Set();
  for (const question of section.questions) {
    knownKeys.add(question.id);
    for (const option of question.options ?? []) {
      if (optionNeedsDetail(option)) knownKeys.add(detailKey(question, option));
    }
  }
  const unknownKeys = Object.keys(rawAnswers).filter((key) => !knownKeys.has(key));
  if (unknownKeys.length) throw new LarkEventError('The card event contains unknown form fields.', unknownKeys);

  for (const question of section.questions) {
    if (!Object.prototype.hasOwnProperty.call(rawAnswers, question.id)) continue;
    const rawValue = rawAnswers[question.id];
    if (question.type === 'number') answers[question.id] = rawValue === '' ? '' : Number(rawValue);
    else if (question.type === 'checkbox') answers[question.id] = checkboxValue(rawValue);
    else answers[question.id] = rawValue;

    if (!question.options) continue;
    const selected = question.type === 'checkbox' ? answers[question.id] : [answers[question.id]];
    if (!Array.isArray(selected)) continue;
    for (const selectedValue of selected) {
      const option = question.options.find((item) => item.value === selectedValue);
      if (!option || !optionNeedsDetail(option)) continue;
      const key = detailKey(question, option);
      if (Object.prototype.hasOwnProperty.call(rawAnswers, key)) answers[key] = rawAnswers[key];
    }
  }
  return answers;
}

function resultFor({ manifest, state, submitted, larkDir, answersPath, idempotent }) {
  const next = manifest.sections[state.completedSections.length] ?? null;
  return {
    ok: true,
    status: next ? 'section-complete' : 'complete',
    idempotent,
    completedSection: submitted.id,
    nextSection: next?.id ?? null,
    nextCard: next ? path.join(larkDir, next.card) : null,
    answers: answersPath,
  };
}

export async function consumeLarkEvent({ config, eventPath, larkDir, answersPath, statePath }) {
  const manifestPath = path.join(larkDir, 'manifest.json');
  const manifest = await readJson(manifestPath);
  if (!isRecord(manifest) || manifest.version !== 1 || manifest.questionnaire !== config.slug || !Array.isArray(manifest.sections)) {
    throw new LarkEventError('The Feishu card manifest does not match the questionnaire.');
  }

  const event = await readJson(eventPath);
  if (!isRecord(event) || event.type !== 'card.action.trigger' || event.action_tag !== 'button') {
    throw new LarkEventError('Expected a card.action.trigger form submission event.');
  }
  if (typeof event.event_id !== 'string' || !event.event_id || typeof event.operator_id !== 'string' || !event.operator_id) {
    throw new LarkEventError('The card event is missing event_id or operator_id.');
  }
  const submitted = manifest.sections.find((section) => section.actionName === event.action_name);
  if (!submitted) throw new LarkEventError(`Unknown card action: ${event.action_name ?? ''}`);

  const emptyState = {
    version: 1,
    questionnaire: config.slug,
    operatorId: null,
    completedSections: [],
    eventIds: [],
  };
  const state = await readJson(statePath, emptyState);
  if (!isRecord(state) || state.version !== 1 || state.questionnaire !== config.slug
    || !Array.isArray(state.completedSections) || !Array.isArray(state.eventIds)) {
    throw new LarkEventError('The Feishu questionnaire state is invalid.');
  }
  if (state.operatorId && state.operatorId !== event.operator_id) {
    throw new LarkEventError('This answer document belongs to a different operator.');
  }
  if (state.eventIds.includes(event.event_id)) {
    return resultFor({ manifest, state, submitted, larkDir, answersPath, idempotent: true });
  }

  const expected = manifest.sections[state.completedSections.length];
  if (!expected) throw new LarkEventError('The questionnaire is already complete.');
  if (submitted.id !== expected.id) throw new LarkEventError(`Expected section ${expected.id}, received ${submitted.id}.`);
  const section = config.sections.find((item) => item.id === submitted.id);
  if (!section) throw new LarkEventError(`Unknown questionnaire section: ${submitted.id}`);

  const submittedAnswers = sectionAnswers(section, parseFormValue(event.form_value));
  const errors = sectionAnswerErrors(config, section.id, submittedAnswers);
  if (errors.length) throw new LarkEventError('The submitted section is incomplete or invalid.', errors);

  const existingDocument = await readJson(answersPath, {
    version: 1,
    questionnaire: config.slug,
    status: 'draft',
    updatedAt: null,
    completedAt: null,
    answers: {},
  });
  if (!isRecord(existingDocument) || existingDocument.questionnaire !== config.slug || !isRecord(existingDocument.answers)) {
    throw new LarkEventError('The answer document does not match the questionnaire.');
  }

  const completedSections = [...state.completedSections, section.id];
  const complete = completedSections.length === manifest.sections.length;
  const answers = normalizeAnswers(config, { ...existingDocument.answers, ...submittedAnswers });
  if (complete) {
    const completeErrors = answerErrors(config, answers);
    if (completeErrors.length) throw new LarkEventError('The complete questionnaire is invalid.', completeErrors);
  }
  const now = new Date().toISOString();
  const answerDocument = {
    version: 1,
    questionnaire: config.slug,
    status: complete ? 'complete' : 'draft',
    updatedAt: now,
    completedAt: complete ? now : null,
    answers,
  };
  const nextState = {
    version: 1,
    questionnaire: config.slug,
    operatorId: state.operatorId ?? event.operator_id,
    completedSections,
    eventIds: [...state.eventIds, event.event_id],
  };

  await writeJsonAtomic(answersPath, answerDocument);
  await writeJsonAtomic(statePath, nextState);
  return resultFor({ manifest, state: nextState, submitted, larkDir, answersPath, idempotent: false });
}

export function larkEventErrorDocument(error) {
  return {
    ok: false,
    error: {
      message: error.message,
      ...(Array.isArray(error.details) && error.details.length ? { details: error.details } : {}),
    },
  };
}
