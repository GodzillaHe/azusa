import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { detailKey, optionNeedsDetail } from './core.mjs';

const text = (content) => ({ tag: 'plain_text', content: String(content ?? '') });
const limited = (value, max = 100) => Array.from(String(value ?? '')).slice(0, max).join('');

function markdownEscape(value) {
  return String(value ?? '').replace(/[\\`*_~[\]]/g, '\\$&').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function questionIntroduction(question, locale) {
  const lines = [`**${markdownEscape(question.title)}**`];
  if (question.help) lines.push(`<font color='grey'>${markdownEscape(question.help)}</font>`);
  for (const option of question.options ?? []) {
    if (option.note) lines.push(`<font color='grey'>${markdownEscape(option.label)}：${markdownEscape(option.note)}</font>`);
  }
  if (question.type === 'checkbox' && question.max) {
    lines.push(`<font color='grey'>${locale === 'en' ? `Select at most ${question.max}.` : `最多选择 ${question.max} 项。`}</font>`);
  }
  return { tag: 'markdown', content: lines.join('\n'), text_size: 'normal' };
}

function optionControl(question, locale) {
  return {
    tag: question.type === 'checkbox' ? 'multi_select_static' : 'select_static',
    name: question.id,
    required: question.required,
    width: 'fill',
    placeholder: text(locale === 'en' ? 'Select an option' : '请选择'),
    options: question.options.map((option) => ({ text: text(limited(option.label)), value: option.value })),
  };
}

function inputControl(question, locale) {
  return {
    tag: 'input',
    name: question.id,
    required: question.required,
    width: 'fill',
    placeholder: text(limited(question.placeholder ?? (locale === 'en' ? 'Enter an answer' : '请输入'))),
    input_type: question.type === 'textarea' ? 'multiline_text' : 'text',
    ...(question.type === 'textarea' ? { rows: 4, auto_resize: true, max_rows: 8 } : {}),
  };
}

function detailControls(question, locale) {
  return (question.options ?? []).filter(optionNeedsDetail).map((option) => ({
    tag: 'input',
    name: detailKey(question, option),
    required: false,
    width: 'fill',
    label: text(limited(option.detailPrompt ?? (locale === 'en' ? 'Please describe' : '请具体说明'))),
    placeholder: text(locale === 'en' ? 'Required when this option is selected' : '选择该项时必须填写'),
    input_type: 'multiline_text',
    rows: 3,
    auto_resize: true,
    max_rows: 6,
  }));
}

function sectionCard(config, section, index) {
  const locale = config.locale ?? 'zh-CN';
  const total = config.sections.length;
  const actionName = `dc_submit_${config.slug}_${String(index + 1).padStart(2, '0')}`;
  const formElements = [];
  for (const question of section.questions) {
    formElements.push(questionIntroduction(question, locale));
    formElements.push(question.options ? optionControl(question, locale) : inputControl(question, locale));
    formElements.push(...detailControls(question, locale));
  }
  formElements.push({
    tag: 'button',
    name: actionName,
    value: {
      decision_canvas: {
        version: 1,
        questionnaire: config.slug,
        section: section.id,
      },
    },
    text: text(index === total - 1
      ? (locale === 'en' ? 'Complete questionnaire' : '完成问卷')
      : (locale === 'en' ? 'Submit and continue' : '提交并继续')),
    type: 'primary_filled',
    width: 'fill',
    form_action_type: 'submit',
  });

  const componentCount = 1 + formElements.length;
  if (componentCount > 200) throw new Error(`Section ${section.id} exceeds the Feishu Card 2.0 limit of 200 elements.`);
  return {
    actionName,
    card: {
      schema: '2.0',
      config: {
        update_multi: true,
        enable_forward: false,
        width_mode: 'default',
        summary: { content: limited(`${config.title} · ${section.title}`) },
      },
      header: {
        title: text(limited(config.title)),
        subtitle: text(`${index + 1}/${total} · ${limited(section.title, 80)}`),
        template: section.questions.some((question) => question.options) ? 'wathet' : 'blue',
        icon: { tag: 'standard_icon', token: 'todo_colorful' },
        text_tag_list: [{ tag: 'text_tag', text: text(locale === 'en' ? 'Questionnaire' : '结构化提问'), color: 'blue' }],
      },
      body: {
        direction: 'vertical',
        padding: '12px 12px 20px 12px',
        vertical_spacing: '12px',
        elements: [{
          tag: 'form',
          name: `dc_form_${String(index + 1).padStart(2, '0')}`,
          direction: 'vertical',
          vertical_spacing: '12px',
          elements: formElements,
        }],
      },
    },
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function renderLarkCards(config, output) {
  const outputPath = path.resolve(output);
  await mkdir(outputPath, { recursive: true });
  const sections = [];
  for (let index = 0; index < config.sections.length; index += 1) {
    const section = config.sections[index];
    const cardName = `${String(index + 1).padStart(2, '0')}-${section.id}.card.json`;
    const { actionName, card } = sectionCard(config, section, index);
    await writeJson(path.join(outputPath, cardName), card);
    sections.push({ id: section.id, index, card: cardName, actionName });
  }
  const manifest = { version: 1, questionnaire: config.slug, sections };
  await writeJson(path.join(outputPath, 'manifest.json'), manifest);
  return { outputPath, manifest };
}
