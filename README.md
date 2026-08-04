# Azusa

Godzilla's workspace for learning and building AI agent programming tools.

Use this repo for small tools, agent utilities, MCP servers, and reusable skills.

## Structure

```text
azusa/
├── image-generator/  # Next.js GPT image generation app
├── tools/            # CLI tools and local scripts
├── mcp/              # MCP servers and tool definitions
└── skills/           # Reusable agent skills and workflows
```

## Current tools

### Decision Canvas Skill

Reusable interactive questionnaire source lives in [`skills/decision-canvas`](skills/decision-canvas). It supports inline forms in Codex and autosaving local browser forms in Codex CLI and OpenClaw. See the [`skills` index](skills/README.md) for installation and validation.

### Image Generator

`image-generator` is a standalone Next.js app for `gpt-image-2` image generation.

```bash
cd image-generator
npm install
npm run dev
```

Then open http://localhost:3000.

Enter your OpenAI API key and optional compatible API URL in the page. The
browser keeps these values in the current tab only.

Run checks:

```bash
npm test
npm run build
```

## Secrets

Keep API keys in local env files such as `.env.local`. Do not commit them.
