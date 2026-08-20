# Plugins

This directory contains runtime extensions for specific agent hosts. Unlike the portable workflows in [`skills/`](../skills/), plugins can depend on a host's SDK, configuration, and conversation context.

Use the layout `plugins/<host>/<plugin-name>/` so host ownership remains explicit.

## Index

| Host | Plugin | Purpose |
| --- | --- | --- |
| OpenClaw | [`decision-canvas-lark-card`](openclaw/decision-canvas-lark-card/) | Send Decision Canvas Card 2.0 files to the active Feishu conversation. |
