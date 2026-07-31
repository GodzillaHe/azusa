# Momonogi

Godzilla's workspace for learning and building AI agent programming tools.

Use this repo for small tools, agent utilities, MCP servers, and reusable skills.

## Structure

```text
momonogi/
├── image-generator/  # Next.js GPT image generation app
├── tools/            # CLI tools and local scripts
├── mcp/              # MCP servers and tool definitions
└── skills/           # Reusable agent skills and workflows
```

## Current tools

### Local Questionnaire Skill

Reusable local browser questionnaire source lives in [`skills/local-questionnaire`](skills/local-questionnaire) and supports both Codex and OpenClaw. See the [`skills` index](skills/README.md) for installation, validation, and future Skill entries.

### Image Generator

`image-generator` is a standalone Next.js app for `gpt-image-2` image generation.

```bash
cd image-generator
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
