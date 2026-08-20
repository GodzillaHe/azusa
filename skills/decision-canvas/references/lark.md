# Feishu Card 2.0 Workflow

Use this renderer whenever the source conversation is Feishu. Decision Canvas
owns card generation and answer conversion. OpenClaw may expose the narrow
`decision_canvas_lark_send` tool for delivery; otherwise follow the Lark skills
for authentication, permissions, message delivery, and event consumption.

## Generate Cards

Validate the questionnaire, then generate one card per section:

```bash
node <skill-dir>/scripts/decision-canvas.mjs \
  --config .questionnaires/<slug>/questionnaire.json \
  --check

node <skill-dir>/scripts/decision-canvas.mjs \
  --config .questionnaires/<slug>/questionnaire.json \
  --lark .questionnaires/<slug>/lark
```

Read `lark/manifest.json`. Do not edit the generated card payload by hand.

In an OpenClaw Feishu conversation, prefer the workspace-scoped delivery tool:

```text
decision_canvas_lark_send({
  "card_path": ".questionnaires/<slug>/lark/01-<section-id>.card.json"
})
```

The tool accepts only workspace-relative generated card paths and sends to the
active Feishu conversation with the active agent's bound account. It derives a
stable idempotency key shorter than 50 characters. Do not pass an arbitrary
recipient or card JSON through another tool.

When the bridge tool is unavailable outside OpenClaw, send the first section's
card JSON as an `interactive` message by following the `lark-im` Card 2.0
workflow. When using `lark-cli im +messages-send`, use a stable idempotency key
no longer than 50 characters, for example `dc-<slug-hash>-01`. Feishu reports
an overlong key as the generic `99992402 field validation failed` error even
when the card JSON is valid.

## Receive A Submission

Enable Feishu callback delivery in the developer console and consume
`card.action.trigger` as bot identity by following `lark-event`. Save one
normalized event object to a JSON file.

Inspect `operator_id` before choosing the answer path. In group chats, always
isolate participants:

```text
.questionnaires/<slug>/participants/<operator-id>/answers.json
.questionnaires/<slug>/participants/<operator-id>/lark-state.json
```

Convert the event:

```bash
node <skill-dir>/scripts/decision-canvas.mjs \
  --config .questionnaires/<slug>/questionnaire.json \
  --lark .questionnaires/<slug>/lark \
  --lark-event <event.json> \
  --answers .questionnaires/<slug>/participants/<operator-id>/answers.json
```

The converter defaults `lark-state.json` to the answer directory. Use
`--lark-state <path>` only when the caller must place transport state elsewhere.

## Continue Or Complete

Parse the command's stdout JSON:

- `status: "section-complete"`: send the generated file in `nextCard` to the
  same participant. In OpenClaw Feishu, call `decision_canvas_lark_send` with
  the workspace-relative `nextCard` path.
- `status: "complete"`: read the returned `answers` path, revalidate that its
  status is complete, then continue the Decision Canvas artifact workflow.
- `idempotent: true`: the event was already processed; do not send another copy
  of the next card.

Errors are JSON on stderr. Do not advance or generate the final artifact after
an invalid, out-of-order, repeated-section, or cross-operator submission.

## Field Mapping

| Questionnaire | Card 2.0 | Callback normalization |
| --- | --- | --- |
| `radio` | `select_static` | String option value |
| `checkbox` | `multi_select_static` | String array |
| `text` | `input` | String |
| `textarea` | Multiline `input` | String |
| `number` | `input` | Finite number |
| `detailPrompt` | Always-visible multiline `input` | Kept only for a selected custom option |

Feishu enforces required form controls. The shared Decision Canvas validator
still enforces required values, valid options, checkbox `max`, numeric bounds
and `step`, and selected custom-option details after callback conversion.

## Operational Boundaries

- Do not ask for or place secrets in a questionnaire.
- Do not use one answer path for multiple `operator_id` values.
- Do not rely on delayed card updates; each section is a separate message.
- Do not generate an artifact from `status: "draft"`.
- Preserve generated cards, answer documents, and state unless the user asks to
  restart the questionnaire.
