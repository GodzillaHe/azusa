# Azusa

Godzilla's monorepo for learning and building AI agent programming tools.

Use this repo for small applications, agent tools, reusable skills, and host-specific plugins.

## Structure

```text
azusa/
├── projects/         # Standalone small applications
│   ├── fanxuan/         # Restaurant picker
│   ├── gen-simulator/   # Browser-based retro game emulator
│   ├── image-generator/ # Next.js GPT image generation app
│   └── kana-study/      # Japanese kana learning page
├── tools/            # CLI tools and local scripts
├── skills/           # Reusable agent skills and workflows
├── plugins/          # Host-specific runtime extensions
│   └── openclaw/     # OpenClaw plugins
├── package.json      # Workspace commands
└── pnpm-workspace.yaml
```

## Workspace

JavaScript packages are managed from the repository root with pnpm. Static applications and agent Skills remain in the same repository without being forced into a package format.

```bash
pnpm install
pnpm test
pnpm lint
pnpm build
```

Run a command for one package with a workspace filter:

```bash
pnpm --filter image-generator test
pnpm --filter fanxuan dev
```

## Current tools

### Decision Canvas Skill

Reusable interactive questionnaire source lives in [`skills/decision-canvas`](skills/decision-canvas). It supports inline forms in Codex, autosaving local browser forms in Codex CLI and OpenClaw, and section-based Feishu Card 2.0 forms. See the [`skills` index](skills/README.md) for installation and validation.

The OpenClaw-only Feishu delivery bridge lives separately in [`plugins/openclaw/decision-canvas-lark-card`](plugins/openclaw/decision-canvas-lark-card). Skills contain portable agent workflows; plugins integrate with a specific host runtime.

### Momonogi

Momonogi is maintained as an independent project at [GodzillaHe/momonogi](https://github.com/GodzillaHe/momonogi).

### Kana Garden

`projects/kana-study` is a storybook-style Japanese kana learning page with a kana chart, browser pronunciation, flashcards, quizzes, and local progress tracking.

```bash
cd projects/kana-study
python3 -m http.server 4174
```

Then open http://127.0.0.1:4174.

### Image Generator

`projects/image-generator` is a standalone Next.js app for `gpt-image-2` image generation.

```bash
cd projects/image-generator
npm install
cp .env.example .env.local
npm run dev
```

Then open http://localhost:3000.

Run checks:

```bash
npm test
npm run build
```

## Secrets

Keep API keys in local env files such as `.env.local`. Do not commit them.
