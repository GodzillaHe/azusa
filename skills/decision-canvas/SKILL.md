---
name: decision-canvas
description: Create and run a structured interactive questionnaire in Codex, a local browser, or Feishu Card 2.0 that collects and validates related user decisions for a downstream artifact such as a config, specification, or plan. Use when the user explicitly asks for a decision canvas, questionnaire, or structured interview; when several unresolved choices materially affect the result and should be answered and reviewed together; or when answers need draft persistence or asynchronous completion. Do not use for a single clarification, a few independent low-impact preferences, information discoverable from existing context, or requests where the user wants the agent to decide.
---

# Decision Canvas

Use a structured form when the user needs to answer several related questions. Keep the conversation for alignment and exceptions; use the canvas for collection.

## Workflow

1. Inspect the task and existing project context before writing questions.
2. Decide the artifact the answers must enable. Every question must affect that artifact or remove meaningful ambiguity.
3. Create `.questionnaires/<slug>/questionnaire.json` in the active workspace. Read [references/schema.md](references/schema.md) for the schema and option-detail rules.
4. Validate it:

   ```bash
   node <skill-dir>/scripts/decision-canvas.mjs --config .questionnaires/<slug>/questionnaire.json --check
   ```

5. Choose exactly one renderer in this order. The first matching rule wins:

   - **Feishu Card 2.0 (highest priority):** When the source conversation is Feishu, always use this renderer. Read [references/lark.md](references/lark.md), generate one form card per section, and send the generated card file with `decision_canvas_lark_send` when that tool is available. Keep authentication and event transport in the Lark/OpenClaw integration. Do not start a localhost server or generate Codex inline HTML from a Feishu conversation. If card delivery fails, report the blocker instead of silently falling back to another renderer.

   - **Codex inline:** Use when the current Codex surface supports inline visualizations and durable draft storage is unnecessary. Render into the thread-scoped visualization directory:

     ```bash
     node <skill-dir>/scripts/decision-canvas.mjs --config .questionnaires/<slug>/questionnaire.json --inline <visualization-dir>/<slug>.html
     ```

     Introduce the questionnaire in one short sentence, then emit `::codex-inline-vis{file="<slug>.html"}`. The completed form returns a JSON answer document through a follow-up message. Validate that document before generating the requested artifact.

   - **Local browser:** Use for OpenClaw conversations outside Feishu, Codex surfaces without inline visualizations, long-lived drafts, or workflows that require `answers.json`. Check for an existing questionnaire server before starting another. Probe `/api/config` to confirm it serves the same questionnaire. Otherwise run:

     ```bash
     node <skill-dir>/scripts/decision-canvas.mjs --config .questionnaires/<slug>/questionnaire.json
     ```

6. For local-browser mode, give the user the printed URL, open it when local GUI access is available, and keep the server running while the user fills the form.
7. Continue only with an answer document whose `status` is `complete`. In local-browser mode, read `.questionnaires/<slug>/answers.json`; in inline mode, use the JSON returned in the follow-up message; in Feishu mode, use the operator-specific path returned by the callback converter. Revalidate against the current questionnaire before trusting a previously completed document.
8. Review all answers together. Resolve contradictions from project evidence when safe; ask a short follow-up only when a conflict materially changes the result.
9. Generate the requested artifact from the complete answer set, validate it, and report its path.

## Question Design

- Group questions into short sections with a clear purpose.
- Put high-impact decisions first.
- Prefer radio choices when answers are mutually exclusive and checkboxes when several may apply.
- Include concise option notes that explain consequences, not sales copy.
- Use free text only when bounded choices would distort the answer.
- In quizzes, exercises, and assessments, keep `placeholder` and `help` answer-neutral. They may explain the response format or scoring rule, but must not contain the expected answer, an answer-equivalent example, or text the user can copy to solve the current question.
- Add `detailPrompt` to every option whose meaning depends on the user's own definition.
- Treat labels beginning with `由你`, `其他`, `自定义`, `Other`, or `Custom` as requiring a linked detail input even if `detailPrompt` is omitted.
- Keep stable, descriptive IDs because answer keys become part of the generated artifact workflow.
- Do not ask for secrets, passwords, tokens, recovery codes, or private keys.

## Completion Rules

- Required questions must be answered.
- A selected custom option is incomplete until its linked detail input is filled.
- Checkbox limits must be enforced in the browser.
- Preserve drafts and completed answers; never overwrite them with a new questionnaire unless the user asks to restart.
- Do not generate the final artifact from a draft unless the user explicitly requests a partial result.

## Boundaries

Use the bundled zero-dependency Node runtime and static pages. Do not add a database, frontend framework, form builder, authentication layer, or hosted service. Inline mode is a Codex enhancement, not a claim of A2UI protocol compatibility. Feishu mode generates and converts Card 2.0 data; `decision_canvas_lark_send` is a narrow OpenClaw delivery bridge, while Lark/OpenClaw still owns authentication and event transport. Keep local-browser mode as the portable fallback for Codex CLI and OpenClaw outside Feishu.
