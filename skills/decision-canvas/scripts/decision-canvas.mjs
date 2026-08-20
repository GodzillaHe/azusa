#!/usr/bin/env node

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  answerErrors,
  countQuestions,
  isRecord,
  normalizeAnswers,
  validateConfig,
} from '../lib/core.mjs';
import { renderLarkCards } from '../lib/lark-card.mjs';
import { consumeLarkEvent, larkEventErrorDocument } from '../lib/lark-event.mjs';

const skillDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pagePath = path.join(skillDir, 'assets', 'index.html');
const inlinePagePath = path.join(skillDir, 'assets', 'inline.html');
const args = parseArgs(process.argv.slice(2));

if (!args.config) fail('Usage: decision-canvas.mjs --config <questionnaire.json> [--answers <answers.json>] [--port 4178] [--check | --inline <output.html> | --lark <output-dir> [--lark-event <event.json>]]');

const configPath = path.resolve(args.config);
const config = JSON.parse(await readFile(configPath, 'utf8'));
try {
  validateConfig(config);
} catch (error) {
  fail(error.message);
}

if (args['lark-event'] && (args.check || args.inline)) fail('--lark-event cannot be combined with --check or --inline.');
if (args['lark-state'] && !args['lark-event']) fail('--lark-state requires --lark-event.');
if ([args.check, args.inline, args.lark && !args['lark-event']].filter(Boolean).length > 1) fail('Use only one of --check, --inline, or --lark.');

if (args.check) {
  console.log(`Valid questionnaire: ${config.title} (${countQuestions(config)} questions)`);
  process.exit(0);
}

if (args.inline) {
  await renderInline(args.inline);
  process.exit(0);
}

if (args['lark-event']) {
  const larkAnswersPath = path.resolve(
    args.answers ?? path.join(process.cwd(), '.questionnaires', config.slug, 'answers.json'),
  );
  const larkDir = path.resolve(args.lark ?? path.join(path.dirname(larkAnswersPath), 'lark'));
  const statePath = path.resolve(args['lark-state'] ?? path.join(path.dirname(larkAnswersPath), 'lark-state.json'));
  try {
    const result = await consumeLarkEvent({
      config,
      eventPath: path.resolve(args['lark-event']),
      larkDir,
      answersPath: larkAnswersPath,
      statePath,
    });
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify(larkEventErrorDocument(error)));
    process.exit(1);
  }
}

if (args.lark) {
  try {
    const result = await renderLarkCards(config, args.lark);
    console.log(`Feishu cards: ${result.outputPath}`);
    process.exit(0);
  } catch (error) {
    fail(error.message);
  }
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
  const valueFlags = new Set(['config', 'answers', 'port', 'inline', 'lark', 'lark-event', 'lark-state']);
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

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': contentType });
  response.end(body);
}

async function readAnswers() {
  try {
    const saved = JSON.parse(await readFile(answersPath, 'utf8'));
    if (!isRecord(saved) || saved.questionnaire !== config.slug) return emptyDocument;
    const answers = normalizeAnswers(config, saved.answers);
    const validComplete = saved.status === 'complete' && answerErrors(config, answers).length === 0;
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
    const errors = answerErrors(config, document.answers);
    if (errors.length) return send(response, 422, JSON.stringify({ error: 'Questionnaire is incomplete or invalid.', details: errors }));
  }
  const saved = {
    version: 1,
    questionnaire: config.slug,
    status: complete ? 'complete' : 'draft',
    updatedAt: now,
    completedAt: complete ? now : null,
    answers: normalizeAnswers(config, document.answers),
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
