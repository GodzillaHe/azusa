# Decision Canvas Lark Card

OpenClaw-only delivery bridge for the portable [`decision-canvas`](../../../skills/decision-canvas/) Skill.

The Skill generates Feishu Card 2.0 files. This plugin registers `decision_canvas_lark_send`, resolves the active OpenClaw Feishu account and conversation, validates the generated card path, and sends the card through the Feishu API.

It intentionally does not own questionnaire generation, callback conversion, OpenClaw Feishu authentication, or `card.action.trigger` event consumption.

## Requirements

- OpenClaw 2026.7.1 or newer
- An enabled OpenClaw Feishu channel
- The `decision-canvas` Skill installed separately

## Validate

```bash
node --check plugins/openclaw/decision-canvas-lark-card/index.js
```
