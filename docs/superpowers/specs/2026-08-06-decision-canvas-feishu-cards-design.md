# Decision Canvas Feishu Cards Design

## Goal

Add Feishu Card 2.0 as a third Decision Canvas renderer while preserving the
existing questionnaire schema and answer-document format. Decision Canvas
generates cards and converts callback events; the existing `lark-im` and
`lark-event` skills remain responsible for authentication, delivery, and event
consumption.

## Scope

This change generates one Card 2.0 form per questionnaire section, converts a
normalized `card.action.trigger` event into section answers, enforces ordered
completion, and writes the existing `answers.json` format.

It does not send messages, configure a Feishu application, keep a long-running
event listener alive, update a card in place, or store Feishu credentials.

## Architecture

The runtime is split into four focused units:

- `lib/core.mjs` owns questionnaire validation, answer normalization, and
  answer validation for every renderer.
- `lib/lark-card.mjs` maps a validated questionnaire to Card 2.0 JSON and a
  manifest.
- `lib/lark-event.mjs` maps one normalized callback event to a section answer,
  progression state, and the standard answer document.
- `scripts/decision-canvas.mjs` remains the CLI and local-browser entry point.

The browser and Codex inline renderers continue to use their existing assets.
Moving validation into `core.mjs` prevents the three renderers from developing
different completion rules.

## Card Generation

The command below writes a manifest and one card per section:

```bash
node skills/decision-canvas/scripts/decision-canvas.mjs \
  --config .questionnaires/<slug>/questionnaire.json \
  --lark .questionnaires/<slug>/lark
```

The output uses stable, ordered names:

```text
lark/
├── manifest.json
├── 01-<section-id>.card.json
└── 02-<section-id>.card.json
```

Every card is a Card 2.0 root containing one `form`. Radio questions use
`select_static`, checkbox questions use `multi_select_static`, and text,
textarea, and number questions use `input`. Textarea controls use multiline
input. Number values remain text in Feishu and are converted before shared
validation.

Custom-option detail inputs are always visible but optional at the Card 2.0
layer. Shared validation requires the detail only when its option is selected.
Checkbox limits and numeric bounds are also enforced after callback conversion
because Card 2.0 does not express the full Decision Canvas constraints.

Each submit button has a deterministic action name. The manifest maps that name
to a section and card file, avoiding reliance on delayed-update tokens.

## Callback Conversion

The callback command accepts one normalized event emitted by `lark-event`:

```bash
node skills/decision-canvas/scripts/decision-canvas.mjs \
  --config .questionnaires/<slug>/questionnaire.json \
  --lark .questionnaires/<slug>/lark \
  --lark-event event.json \
  --answers .questionnaires/<slug>/participants/<operator-id>/answers.json
```

It validates `type`, `action_tag`, `action_name`, `event_id`, `operator_id`, and
`form_value`. It rejects unknown form fields, converts values according to the
question schema, validates the submitted section, merges it with prior answers,
and validates the entire document when the last section completes.

Successful output is one machine-readable JSON object. An intermediate result
uses `status: "section-complete"` and provides `nextSection` and `nextCard`. The
last result uses `status: "complete"` and has no next card.

## State And Isolation

`answers.json` keeps the renderer-neutral version 1 answer schema. A separate
`lark-state.json` beside it stores the bound operator, completed section IDs,
and processed event IDs.

The first callback binds an answer path to its `operator_id`. Later callbacks
from another operator are rejected. Group-chat workflows must therefore choose
an operator-specific answer directory before invoking the converter.

Sections must arrive in manifest order. Replaying the same `event_id` is an
idempotent success; a different event that skips or repeats a section is
rejected. Answer and state files are each written through a temporary file and
an atomic rename.

## Error Handling

Generation fails for invalid questionnaires or sections exceeding the Card 2.0
element limit. Callback failures emit structured JSON on stderr and exit with
status 1. Validation failures do not write answer or progression state.

The CLI rejects incompatible modes, including combining `--lark-event` with
`--check` or `--inline`, and rejects `--lark-state` without an event.

## Verification

Verification covers:

- One Card 2.0 form per section and stable manifest mappings.
- Ordered two-section progression to a complete answer document.
- Custom-detail validation, numeric conversion, and checkbox normalization.
- Event idempotency, out-of-order rejection, and operator isolation.
- Existing config checking, inline rendering, and local-browser GET/POST flows.
- Node syntax checks and Skill folder validation.

No live Feishu message is sent during repository verification. Delivery and
callback transport are exercised by the dedicated Lark skills.
