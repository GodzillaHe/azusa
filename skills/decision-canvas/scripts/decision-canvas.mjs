#!/usr/bin/env node

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const skillDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pagePath = path.join(skillDir, 'assets', 'index.html');
const inlinePagePath = path.join(skillDir, 'assets', 'inline.html');
const args = parseArgs(process.argv.slice(2));

if (!args.config) fail('Usage: decision-canvas.mjs --config <questionnaire.json> [--answers <answers.json>] [--port 4178] [--check | --inline <output.html>]');

const configPath = path.resolve(args.config);
const config = JSON.parse(await readFile(configPath, 'utf8'));
validateConfig(config);

if (args.check && args.inline) fail('Use either --check or --inline, not both.');

if (args.check) {
  console.log(`Valid questionnaire: ${config.title} (${countQuestions(config)} questions)`);
  process.exit(0);
}

if (args.inline) {
  await renderInline(args.inline);
  process.exit(0);
}

const host = '127.0.0.1';
const initialPort = parseInteger(args.port ?? process.env.PORT ?? '4178', 'port');
const answersPath = path.resolve(
  args.answers ?? path.join(process.cwd(), '.questionnaires', config.slug, 'answers.json'),
);

const emptyDocument = {
  version: 1,
  questionnaire: config.slug,
  status: 'draft',
  updatedAt: null,
  completedAt: null,
  answers: {},
};
let saveQueue = Promise.resolve();

function parseArgs(values) {
  const parsed = {};
  const valueFlags = new Set(['config', 'answers', 'port', 'inline']);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--check') parsed.check = true;
    else if (value.startsWith('--')) {
      const key = value.slice(2);
      const next = values[index + 1];
      if (!valueFlags.has(key)) fail(`Unknown option: ${value}`);
      if (next === undefined || next.startsWith('--')) fail(`Missing value for ${value}`);
      parsed[key] = next;
      index += 1;
    }
    else fail(`Unexpected argument: ${value}`);
  }
  return parsed;
}

function parseInteger(value, label) {
  if (!/^\d+$/.test(String(value))) fail(`Invalid ${label}: ${value}`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) fail(`Invalid ${label}: ${value}`);
  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function countQuestions(document) {
  return document.sections.reduce((total, section) => total + section.questions.length, 0);
}

function isRecord(value) {
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
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) fail(`${label} must be a finite number.`);
}

function validateConfig(document) {
  if (!isRecord(document)) fail('Questionnaire config must be a JSON object.');
  if (document.version !== 1) fail('Questionnaire version must be 1.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(document.slug ?? '')) fail('Questionnaire slug must use lowercase hyphen-case.');
  if (!isNonEmptyString(document.title)) fail('Questionnaire title is required.');
  if (document.locale !== undefined && !['zh-CN', 'en'].includes(document.locale)) fail('Questionnaire locale must be zh-CN or en.');
  if (document.accent !== undefined && !/^#[0-9a-f]{6}$/i.test(document.accent)) fail('Questionnaire accent must be a six-digit hex color.');
  if (!Array.isArray(document.sections) || document.sections.length === 0) fail('At least one section is required.');

  const sectionIds = new Set();
  const questionIds = new Set();
  for (const section of document.sections) {
    if (!isRecord(section)) fail('Every section must be an object.');
    if (!isSafeKey(section.id) || sectionIds.has(section.id)) fail(`Invalid or duplicate section id: ${section.id ?? ''}`);
    sectionIds.add(section.id);
    if (!isNonEmptyString(section.title) || !Array.isArray(section.questions) || section.questions.length === 0) fail(`Section ${section.id} needs a title and questions.`);
    for (const question of section.questions) {
      if (!isRecord(question)) fail(`Section ${section.id} contains an invalid question.`);
      if (!isSafeKey(question.id) || questionIds.has(question.id)) fail(`Invalid or duplicate question id: ${question.id ?? ''}`);
      questionIds.add(question.id);
      if (!['radio', 'checkbox', 'text', 'textarea', 'number'].includes(question.type)) fail(`Unsupported question type: ${question.type}`);
      if (!isNonEmptyString(question.title) || typeof question.required !== 'boolean') fail(`Question ${question.id} needs a title and required boolean.`);
      if (!['radio', 'checkbox'].includes(question.type) && question.options !== undefined) fail(`Question ${question.id} cannot define options.`);
      if (!['number', 'checkbox'].includes(question.type) && question.max !== undefined) fail(`Question ${question.id} cannot define max.`);
      if (question.type !== 'number' && (question.min !== undefined || question.step !== undefined)) fail(`Question ${question.id} cannot define numeric bounds.`);
      if (question.type === 'number') {
        validateFiniteNumber(question.min, `Question ${question.id} min`);
        validateFiniteNumber(question.max, `Question ${question.id} max`);
        validateFiniteNumber(question.step, `Question ${question.id} step`);
        if (question.min !== undefined && question.max !== undefined && question.min > question.max) fail(`Question ${question.id} min cannot exceed max.`);
        if (question.step !== undefined && question.step <= 0) fail(`Question ${question.id} step must be positive.`);
      }
      if (['radio', 'checkbox'].includes(question.type)) {
        if (!Array.isArray(question.options) || question.options.length < 2) fail(`Question ${question.id} needs at least two options.`);
        if (question.type === 'checkbox' && question.max !== undefined
          && (!Number.isInteger(question.max) || question.max < 1 || question.max > question.options.length)) {
          fail(`Question ${question.id} max must be an integer between 1 and the option count.`);
        }
        const optionValues = new Set();
        for (const option of question.options) {
          if (!isRecord(option) || !isSafeKey(option.value) || !isNonEmptyString(option.label) || optionValues.has(option.value)) fail(`Question ${question.id} has an invalid or duplicate option.`);
          optionValues.add(option.value);
          if (option.detailPrompt !== undefined && (typeof option.detailPrompt !== 'string' || !option.detailPrompt.trim())) fail(`Question ${question.id} has an invalid detail prompt.`);
        }
      }
    }
  }
}

async function renderInline(output) {
  const marker = '__DECISION_CANVAS_CONFIG__';
  const rootMarker = '__DECISION_CANVAS_ROOT_ID__';
  const template = await readFile(inlinePagePath, 'utf8');
  if (!template.includes(marker) || !template.includes(rootMarker)) fail('Inline template is missing required markers.');
  const serialized = JSON.stringify(config).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const rootId = `decision-canvas-${config.slug}`;
  const outputPath = path.resolve(output);
  const fragment = template.replace(marker, serialized).replaceAll(rootMarker, rootId);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, fragment, 'utf8');
  console.log(`Inline questionnaire: ${outputPath}`);
}

function optionNeedsDetail(option) {
  return Boolean(option.detailPrompt?.trim() || /^(由你|其他|自定义|other|custom)/i.test(option.label));
}

function hasOwn(document, key) {
  return Object.prototype.hasOwnProperty.call(document, key);
}

function answerErrors(answers) {
  const errors = [];
  const allowedKeys = new Set();

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
          const key = `${question.id}__detail__${option.value}`;
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

function normalizeAnswers(answers) {
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
        const key = `${question.id}__detail__${option.value}`;
        if (hasOwn(answers, key)) normalized[key] = answers[key];
      }
    }
  }
  return normalized;
}

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': contentType });
  response.end(body);
}

async function readAnswers() {
  try {
    const saved = JSON.parse(await readFile(answersPath, 'utf8'));
    if (!isRecord(saved) || saved.questionnaire !== config.slug) return emptyDocument;
    const answers = normalizeAnswers(saved.answers);
    const validComplete = saved.status === 'complete' && answerErrors(answers).length === 0;
    const reconciled = {
      ...emptyDocument,
      ...saved,
      status: validComplete ? 'complete' : 'draft',
      completedAt: validComplete ? saved.completedAt : null,
      answers,
    };
    if (JSON.stringify(reconciled) !== JSON.stringify(saved)) await writeAnswerDocument(reconciled);
    return reconciled;
  } catch (error) {
    if (error.code === 'ENOENT') return emptyDocument;
    throw error;
  }
}

async function writeAnswerDocument(document) {
  const operation = saveQueue.then(async () => {
    await mkdir(path.dirname(answersPath), { recursive: true });
    const temporaryPath = `${answersPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, answersPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  });
  saveQueue = operation.catch(() => {});
  await operation;
}

async function saveAnswers(request, response) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) return send(response, 413, JSON.stringify({ error: 'Questionnaire data is too large.' }));
  }
  let document;
  try {
    document = JSON.parse(body);
  } catch {
    return send(response, 400, JSON.stringify({ error: 'Questionnaire data must be valid JSON.' }));
  }
  if (!document || !document.answers || typeof document.answers !== 'object' || Array.isArray(document.answers)) return send(response, 400, JSON.stringify({ error: 'Invalid questionnaire data.' }));
  const now = new Date().toISOString();
  const complete = document.status === 'complete';
  if (complete) {
    const errors = answerErrors(document.answers);
    if (errors.length) return send(response, 422, JSON.stringify({ error: 'Questionnaire is incomplete or invalid.', details: errors }));
  }
  const saved = {
    version: 1,
    questionnaire: config.slug,
    status: complete ? 'complete' : 'draft',
    updatedAt: now,
    completedAt: complete ? now : null,
    answers: normalizeAnswers(document.answers),
  };
  await writeAnswerDocument(saved);
  send(response, 200, JSON.stringify(saved));
}

function createApp() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? host}`);
      if (request.method === 'GET' && url.pathname === '/') return send(response, 200, await readFile(pagePath, 'utf8'), 'text/html; charset=utf-8');
      if (request.method === 'GET' && url.pathname === '/api/config') return send(response, 200, JSON.stringify(config));
      if (request.method === 'GET' && url.pathname === '/api/answers') return send(response, 200, JSON.stringify(await readAnswers()));
      if (request.method === 'POST' && url.pathname === '/api/answers') return await saveAnswers(request, response);
      send(response, 404, JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      console.error(error);
      send(response, 500, JSON.stringify({ error: 'Unable to save questionnaire.' }));
    }
  });
}

function listen(port) {
  const server = createApp();
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < initialPort + 10) return listen(port + 1);
    throw error;
  });
  server.listen(port, host, () => {
    console.log(`Questionnaire: http://${host}:${port}`);
    console.log(`Config: ${configPath}`);
    console.log(`Answers: ${answersPath}`);
  });
}

listen(initialPort);
