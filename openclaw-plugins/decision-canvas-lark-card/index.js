import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';

const MAX_CARD_BYTES = 256 * 1024;

function textResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function resolveAccount(config, accountId) {
  const feishu = config?.channels?.feishu;
  if (!feishu || feishu.enabled === false) throw new Error('The Feishu channel is not enabled.');
  const account = accountId === 'default' ? {} : feishu.accounts?.[accountId];
  if (accountId !== 'default' && (!account || account.enabled === false)) {
    throw new Error(`Feishu account ${accountId} is not enabled.`);
  }
  const appId = account?.appId ?? feishu.appId;
  const appSecret = account?.appSecret ?? feishu.appSecret;
  const domain = account?.domain ?? feishu.domain ?? 'feishu';
  if (typeof appId !== 'string' || !appId.trim()) throw new Error(`Feishu account ${accountId} has no appId.`);
  if (typeof appSecret !== 'string' || !appSecret.trim()) {
    throw new Error(`Feishu account ${accountId} has no runtime-resolved appSecret.`);
  }
  return { appId: appId.trim(), appSecret: appSecret.trim(), domain };
}

function resolveTarget(deliveryContext) {
  if (deliveryContext?.channel !== 'feishu') {
    throw new Error('decision_canvas_lark_send is only available in a Feishu conversation.');
  }
  const raw = String(deliveryContext.to ?? '').trim();
  const target = raw.replace(/^(?:user|chat):/i, '');
  if (/^ou_[A-Za-z0-9]+$/.test(target)) return { receiveId: target, receiveIdType: 'open_id' };
  if (/^oc_[A-Za-z0-9]+$/.test(target)) return { receiveId: target, receiveIdType: 'chat_id' };
  throw new Error('The active Feishu conversation has no supported delivery target.');
}

async function readCard(workspaceDir, cardPath) {
  if (!workspaceDir) throw new Error('The active agent has no workspace directory.');
  if (path.isAbsolute(cardPath)) throw new Error('card_path must be relative to the agent workspace.');
  const workspace = await realpath(workspaceDir);
  const candidate = path.resolve(workspace, cardPath);
  const resolved = await realpath(candidate);
  const relative = path.relative(workspace, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('card_path must stay inside the agent workspace.');
  }
  const normalized = relative.split(path.sep).join('/');
  if (!normalized.startsWith('.questionnaires/') || !normalized.endsWith('.card.json')) {
    throw new Error('card_path must point to .questionnaires/**/*.card.json.');
  }
  const fileStat = await stat(resolved);
  if (!fileStat.isFile() || fileStat.size > MAX_CARD_BYTES) {
    throw new Error(`The card file must be a regular file no larger than ${MAX_CARD_BYTES} bytes.`);
  }
  let card;
  try {
    card = JSON.parse(await readFile(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`The card file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!card || typeof card !== 'object' || Array.isArray(card) || card.schema !== '2.0') {
    throw new Error('The card file must contain a Feishu Card 2.0 object.');
  }
  return card;
}

async function readJsonResponse(response, operation) {
  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`${operation} returned HTTP ${response.status} with a non-JSON response.`);
  }
  if (!response.ok || data.code !== 0) {
    const code = data.code ?? response.status;
    const message = typeof data.msg === 'string' ? data.msg : 'unknown error';
    throw new Error(`${operation} failed (${code}): ${message}`);
  }
  return data;
}

async function sendCard({ account, target, card }) {
  const apiOrigin = account.domain === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn';
  const tokenResponse = await fetch(`${apiOrigin}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: account.appId, app_secret: account.appSecret }),
  });
  const tokenData = await readJsonResponse(tokenResponse, 'Feishu tenant token request');
  if (typeof tokenData.tenant_access_token !== 'string' || !tokenData.tenant_access_token) {
    throw new Error('Feishu tenant token response did not include a token.');
  }

  const content = JSON.stringify(card);
  const uuid = `dc-${createHash('sha256').update(`${target.receiveId}\0${content}`).digest('hex').slice(0, 32)}`;
  const query = new URLSearchParams({ receive_id_type: target.receiveIdType, uuid });
  const response = await fetch(`${apiOrigin}/open-apis/im/v1/messages?${query}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokenData.tenant_access_token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      receive_id: target.receiveId,
      msg_type: 'interactive',
      content,
    }),
  });
  const data = await readJsonResponse(response, 'Feishu card send');
  return {
    ok: true,
    message_id: data.data?.message_id ?? null,
    chat_id: data.data?.chat_id ?? null,
    idempotency_key: uuid,
  };
}

export default definePluginEntry({
  id: 'decision-canvas-lark-card',
  name: 'Decision Canvas Lark Card',
  description: 'Sends generated Decision Canvas Card 2.0 files to the active Feishu conversation.',
  register(api) {
    api.registerTool((context) => ({
      name: 'decision_canvas_lark_send',
      description: 'Send a generated Decision Canvas Card 2.0 file to the current Feishu conversation. Use only with a card_path returned by decision-canvas --lark.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['card_path'],
        properties: {
          card_path: {
            type: 'string',
            minLength: 1,
            description: 'Workspace-relative .questionnaires/**/*.card.json path.',
          },
        },
      },
      async execute(_toolCallId, params) {
        try {
          const runtimeConfig = context.getRuntimeConfig?.() ?? context.runtimeConfig ?? context.config;
          const accountId = context.deliveryContext?.accountId ?? context.agentAccountId ?? 'default';
          const account = resolveAccount(runtimeConfig, accountId);
          const target = resolveTarget(context.deliveryContext);
          const card = await readCard(context.workspaceDir, params.card_path);
          return textResult(await sendCard({ account, target, card }));
        } catch (error) {
          return textResult({ ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      },
    }), { names: ['decision_canvas_lark_send'] });
  },
});
