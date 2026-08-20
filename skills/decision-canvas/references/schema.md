# Decision Canvas Schema

Create one JSON document:

```json
{
  "version": 1,
  "slug": "api-design",
  "locale": "zh-CN",
  "title": "API 设计决策问卷",
  "eyebrow": "Architecture",
  "description": "完成后将生成 API 设计配置。",
  "completionText": "答案会由 Agent 读取并用于生成配置。",
  "accent": "#8F3F52",
  "sections": [
    {
      "id": "scope",
      "title": "范围",
      "description": "确定边界和主要使用者。",
      "questions": [
        {
          "id": "audience",
          "type": "radio",
          "required": true,
          "title": "主要调用者是谁？",
          "options": [
            { "value": "internal", "label": "内部服务", "note": "优先组织内一致性。" },
            { "value": "custom", "label": "由你定义", "detailPrompt": "请说明调用者及其约束。" }
          ]
        },
        {
          "id": "goals",
          "type": "checkbox",
          "required": true,
          "max": 3,
          "title": "最重要的目标是什么？",
          "options": [
            { "value": "speed", "label": "交付速度" },
            { "value": "stability", "label": "长期稳定" }
          ]
        },
        {
          "id": "notes",
          "type": "textarea",
          "required": false,
          "title": "还有哪些约束？",
          "placeholder": "例如兼容版本、截止时间或已有系统。"
        }
      ]
    }
  ]
}
```

## Root Fields

- `version`: Must be `1`.
- `slug`: Lowercase letters, digits, and hyphens. Answers default to `.questionnaires/<slug>/answers.json`.
- `locale`: `zh-CN` or `en`. Defaults to `zh-CN`.
- `title`: Browser title and main heading.
- `eyebrow`: Optional short context label.
- `description`: Why the questionnaire exists and what follows.
- `completionText`: Optional text shown before completion.
- `accent`: Optional accessible CSS color for local-browser mode. Defaults to `#315c55`; Codex inline mode follows the host theme.
- `sections`: One or more sections with unique IDs.

## Question Types

- `radio`: One option. Requires `options`.
- `checkbox`: Multiple options. Requires `options`; optional `max` limits selections.
- `text`: Single-line text.
- `textarea`: Multi-line text.
- `number`: Numeric input; optional `min`, `max`, and `step`.

Every question requires unique `id`, `type`, `title`, and boolean `required`. It may include `help` and `placeholder`.

Use `placeholder` for an answer-neutral input hint, such as `按顺序填写 3 个助词` or `写出完整句子`. In quizzes, exercises, and assessments, neither `placeholder` nor `help` may reveal the expected answer, an answer-equivalent example, or text that can be copied to solve the current question. Put answer keys and grading references outside the questionnaire config.

Only radio and checkbox questions may define `options`. Only checkbox questions may define selection `max`. Only number questions may define `min` and `step`; their `max` is the numeric upper bound.

Section IDs, question IDs, and option values must contain only letters, digits, `.`, `_`, or `-`, start with a letter or digit, and must not contain `__detail__`. Avoid changing IDs after answers have been collected.

For checkbox questions, `max` must be a positive integer no larger than the option count. For number questions, `min`, `max`, and `step` must be finite numbers, `min` cannot exceed `max`, and `step` must be positive.

## Options

Each option requires unique `value` and `label`. It may include `note` and `detailPrompt`.

When an option needs the user to define or qualify it, set `detailPrompt`. The runtime also automatically requires details for labels beginning with `由你`, `其他`, `自定义`, `Other`, or `Custom`.

Answer keys use the question ID. Option detail answers use `<question-id>__detail__<option-value>`.

The server accepts incomplete values while saving drafts, but independently validates the complete answer document before writing `status: "complete"`. Unknown answer keys and option values are rejected at completion.
