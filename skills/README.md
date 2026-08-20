# Skills

[中文说明](README.zh-CN.md)

This directory contains reusable agent skills maintained in this repository. Codex and OpenClaw use separate installation directories, while the repository copy remains the source of truth.

## Index

| Skill | Purpose | Instructions |
| --- | --- | --- |
| [`decision-canvas`](decision-canvas/) | Collect related decisions in a Codex inline form, an autosaving local browser form, or section-based Feishu Card 2.0 forms. | [`SKILL.md`](decision-canvas/SKILL.md) |

## Layout

Each Skill keeps agent instructions in `SKILL.md`. Supporting files use the standard directories:

- `agents/` contains UI metadata.
- `scripts/` contains executable helpers.
- `references/` contains schemas and detailed guidance.
- `assets/` contains templates and runtime files.

Keep human-facing navigation in this index. Do not add a separate README inside each Skill because it would duplicate `SKILL.md`.

## Install in Codex

Copy a Skill into the Codex Skill directory:

```bash
mkdir -p ~/.codex/skills/<skill-name>
cp -Rp skills/<skill-name>/. ~/.codex/skills/<skill-name>/
```

## Install in OpenClaw

OpenClaw reads the same `SKILL.md`, scripts, references, and assets. It ignores `agents/openai.yaml`.

Run the following command from the repository root to install the Skill for every OpenClaw agent:

```bash
openclaw skills install --global --force "$PWD/skills/decision-canvas"
```

Install it for one agent when other agents should not see it:

```bash
openclaw skills install --agent main --force "$PWD/skills/decision-canvas"
```

Check the installed Skill:

```bash
openclaw skills info decision-canvas --json
openclaw skills check --json
```

OpenClaw stores globally installed Skills under `~/.openclaw/skills/`. Run the global install command again after updating the repository copy. Start a new conversation if an existing OpenClaw session still uses an older Skill snapshot.

The questionnaire runtime requires Node.js and a persistent process while the user fills the form. Its `127.0.0.1` URL works only on the Mac running OpenClaw. A phone or another computer cannot open that URL. Do not bind the current unauthenticated server to `0.0.0.0` or expose it to the public internet; add authentication and a private network such as Tailscale before supporting remote devices.

For Feishu, Decision Canvas generates Card 2.0 JSON and converts normalized callback events. Use the separate `lark-im` and `lark-event` skills for authentication, card delivery, and `card.action.trigger` consumption. Generate cards with:

```bash
node skills/decision-canvas/scripts/decision-canvas.mjs \
  --config <questionnaire.json> \
  --lark <output-directory>
```

## Validate

Validate the Decision Canvas Skill's config and runtime script:

```bash
node --check skills/decision-canvas/scripts/decision-canvas.mjs
node skills/decision-canvas/scripts/decision-canvas.mjs --config <questionnaire.json> --check
```
