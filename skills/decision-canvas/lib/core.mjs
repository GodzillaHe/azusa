function invalid(message) {
  throw new Error(message);
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function isSafeKey(value) {
  return typeof value === 'string'
    && /^[a-z0-9][a-z0-9._-]*$/i.test(value)
    && !value.includes('__detail__')
    && !['__proto__', 'constructor', 'prototype'].includes(value);
}

function validateFiniteNumber(value, label) {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) invalid(`${label} must be a finite number.`);
}

export function countQuestions(document) {
  return document.sections.reduce((total, section) => total + section.questions.length, 0);
}

export function optionNeedsDetail(option) {
  return Boolean(option.detailPrompt?.trim() || /^(由你|其他|自定义|other|custom)/i.test(option.label));
}

export function detailKey(question, option) {
  return `${question.id}__detail__${option.value}`;
}

export function validateConfig(document) {
  if (!isRecord(document)) invalid('Questionnaire config must be a JSON object.');
  if (document.version !== 1) invalid('Questionnaire version must be 1.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(document.slug ?? '')) invalid('Questionnaire slug must use lowercase hyphen-case.');
  if (!isNonEmptyString(document.title)) invalid('Questionnaire title is required.');
  if (document.locale !== undefined && !['zh-CN', 'en'].includes(document.locale)) invalid('Questionnaire locale must be zh-CN or en.');
  if (document.accent !== undefined && !/^#[0-9a-f]{6}$/i.test(document.accent)) invalid('Questionnaire accent must be a six-digit hex color.');
  if (!Array.isArray(document.sections) || document.sections.length === 0) invalid('At least one section is required.');

  const sectionIds = new Set();
  const questionIds = new Set();
  for (const section of document.sections) {
    if (!isRecord(section)) invalid('Every section must be an object.');
    if (!isSafeKey(section.id) || sectionIds.has(section.id)) invalid(`Invalid or duplicate section id: ${section.id ?? ''}`);
    sectionIds.add(section.id);
    if (!isNonEmptyString(section.title) || !Array.isArray(section.questions) || section.questions.length === 0) invalid(`Section ${section.id} needs a title and questions.`);
    for (const question of section.questions) {
      if (!isRecord(question)) invalid(`Section ${section.id} contains an invalid question.`);
      if (!isSafeKey(question.id) || questionIds.has(question.id)) invalid(`Invalid or duplicate question id: ${question.id ?? ''}`);
      questionIds.add(question.id);
      if (!['radio', 'checkbox', 'text', 'textarea', 'number'].includes(question.type)) invalid(`Unsupported question type: ${question.type}`);
      if (!isNonEmptyString(question.title) || typeof question.required !== 'boolean') invalid(`Question ${question.id} needs a title and required boolean.`);
      if (!['radio', 'checkbox'].includes(question.type) && question.options !== undefined) invalid(`Question ${question.id} cannot define options.`);
      if (!['number', 'checkbox'].includes(question.type) && question.max !== undefined) invalid(`Question ${question.id} cannot define max.`);
      if (question.type !== 'number' && (question.min !== undefined || question.step !== undefined)) invalid(`Question ${question.id} cannot define numeric bounds.`);
      if (question.type === 'number') {
        validateFiniteNumber(question.min, `Question ${question.id} min`);
        validateFiniteNumber(question.max, `Question ${question.id} max`);
        validateFiniteNumber(question.step, `Question ${question.id} step`);
        if (question.min !== undefined && question.max !== undefined && question.min > question.max) invalid(`Question ${question.id} min cannot exceed max.`);
        if (question.step !== undefined && question.step <= 0) invalid(`Question ${question.id} step must be positive.`);
      }
      if (['radio', 'checkbox'].includes(question.type)) {
        if (!Array.isArray(question.options) || question.options.length < 2) invalid(`Question ${question.id} needs at least two options.`);
        if (question.type === 'checkbox' && question.max !== undefined
          && (!Number.isInteger(question.max) || question.max < 1 || question.max > question.options.length)) {
          invalid(`Question ${question.id} max must be an integer between 1 and the option count.`);
        }
        const optionValues = new Set();
        for (const option of question.options) {
          if (!isRecord(option) || !isSafeKey(option.value) || !isNonEmptyString(option.label) || optionValues.has(option.value)) invalid(`Question ${question.id} has an invalid or duplicate option.`);
          optionValues.add(option.value);
          if (option.detailPrompt !== undefined && (typeof option.detailPrompt !== 'string' || !option.detailPrompt.trim())) invalid(`Question ${question.id} has an invalid detail prompt.`);
        }
      }
    }
  }
}

function hasOwn(document, key) {
  return Object.prototype.hasOwnProperty.call(document, key);
}

export function answerErrors(config, answers) {
  const errors = [];
  const allowedKeys = new Set();

  if (!isRecord(answers)) return ['answers: must be an object'];
  for (const section of config.sections) {
    for (const question of section.questions) {
      allowedKeys.add(question.id);
      const present = hasOwn(answers, question.id);
      const value = answers[question.id];
      if (!present || value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
        if (question.required) errors.push(`${question.id}: answer is required`);
        continue;
      }

      if (question.type === 'text' || question.type === 'textarea') {
        if (typeof value !== 'string') errors.push(`${question.id}: answer must be text`);
        else if (!value.trim() && question.required) errors.push(`${question.id}: answer is required`);
      } else if (question.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${question.id}: answer must be a finite number`);
        else {
          if (question.min !== undefined && value < question.min) errors.push(`${question.id}: answer is below min`);
          if (question.max !== undefined && value > question.max) errors.push(`${question.id}: answer exceeds max`);
          if (question.step !== undefined) {
            const base = question.min ?? 0;
            const steps = (value - base) / question.step;
            if (Math.abs(steps - Math.round(steps)) > 1e-9) errors.push(`${question.id}: answer does not match step`);
          }
        }
      } else {
        const selected = question.type === 'checkbox' ? value : [value];
        if (!Array.isArray(selected) || selected.length === 0 || selected.some((item) => typeof item !== 'string')) {
          errors.push(`${question.id}: answer has the wrong type`);
          continue;
        }
        if (new Set(selected).size !== selected.length) errors.push(`${question.id}: answer contains duplicate options`);
        if (question.type === 'checkbox' && question.max !== undefined && selected.length > question.max) errors.push(`${question.id}: answer exceeds max selections`);
        for (const selectedValue of selected) {
          const option = question.options.find((item) => item.value === selectedValue);
          if (!option) {
            errors.push(`${question.id}: unknown option ${selectedValue}`);
            continue;
          }
          const key = detailKey(question, option);
          if (optionNeedsDetail(option)) {
            allowedKeys.add(key);
            if (typeof answers[key] !== 'string' || !answers[key].trim()) errors.push(`${question.id}: detail is required for ${option.value}`);
          }
        }
      }
    }
  }

  for (const key of Object.keys(answers)) {
    if (!allowedKeys.has(key)) errors.push(`${key}: unknown answer key`);
  }
  return errors;
}

export function sectionAnswerErrors(config, sectionId, answers) {
  const section = config.sections.find((item) => item.id === sectionId);
  if (!section) return [`section: unknown section ${sectionId}`];
  return answerErrors({ ...config, sections: [section] }, answers);
}

export function normalizeAnswers(config, answers) {
  const normalized = {};
  if (!isRecord(answers)) return normalized;
  for (const section of config.sections) {
    for (const question of section.questions) {
      if (!hasOwn(answers, question.id)) continue;
      normalized[question.id] = answers[question.id];
      if (!question.options) continue;
      const selected = question.type === 'checkbox' ? answers[question.id] : [answers[question.id]];
      if (!Array.isArray(selected)) continue;
      for (const selectedValue of selected) {
        const option = question.options.find((item) => item.value === selectedValue);
        if (!option || !optionNeedsDetail(option)) continue;
        const key = detailKey(question, option);
        if (hasOwn(answers, key)) normalized[key] = answers[key];
      }
    }
  }
  return normalized;
}
