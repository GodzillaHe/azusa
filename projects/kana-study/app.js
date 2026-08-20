const KANA_ROWS = [
  { id: "vowel", label: "あ行", items: [["あ", "ア", "a"], ["い", "イ", "i"], ["う", "ウ", "u"], ["え", "エ", "e"], ["お", "オ", "o"]] },
  { id: "k", label: "か行", items: [["か", "カ", "ka"], ["き", "キ", "ki"], ["く", "ク", "ku"], ["け", "ケ", "ke"], ["こ", "コ", "ko"]] },
  { id: "s", label: "さ行", items: [["さ", "サ", "sa"], ["し", "シ", "shi"], ["す", "ス", "su"], ["せ", "セ", "se"], ["そ", "ソ", "so"]] },
  { id: "t", label: "た行", items: [["た", "タ", "ta"], ["ち", "チ", "chi"], ["つ", "ツ", "tsu"], ["て", "テ", "te"], ["と", "ト", "to"]] },
  { id: "n", label: "な行", items: [["な", "ナ", "na"], ["に", "ニ", "ni"], ["ぬ", "ヌ", "nu"], ["ね", "ネ", "ne"], ["の", "ノ", "no"]] },
  { id: "h", label: "は行", items: [["は", "ハ", "ha"], ["ひ", "ヒ", "hi"], ["ふ", "フ", "fu"], ["へ", "ヘ", "he"], ["ほ", "ホ", "ho"]] },
  { id: "m", label: "ま行", items: [["ま", "マ", "ma"], ["み", "ミ", "mi"], ["む", "ム", "mu"], ["め", "メ", "me"], ["も", "モ", "mo"]] },
  { id: "y", label: "や行", items: [["や", "ヤ", "ya"], ["ゆ", "ユ", "yu"], ["よ", "ヨ", "yo"]] },
  { id: "r", label: "ら行", items: [["ら", "ラ", "ra"], ["り", "リ", "ri"], ["る", "ル", "ru"], ["れ", "レ", "re"], ["ろ", "ロ", "ro"]] },
  { id: "w", label: "わ行", items: [["わ", "ワ", "wa"], ["を", "ヲ", "wo"], ["ん", "ン", "n"]] }
];

const KANA = KANA_ROWS.flatMap((row) => row.items.map(([hiragana, katakana, romaji]) => ({
  hiragana,
  katakana,
  romaji,
  row: row.id,
  rowLabel: row.label
})));

const STORAGE_KEYS = {
  mastered: "kana-garden:mastered",
  best: "kana-garden:quiz-best",
  days: "kana-garden:study-days"
};

const state = {
  script: "hiragana",
  row: "all",
  showRomaji: true,
  mastered: new Set(loadJSON(STORAGE_KEYS.mastered, [])),
  cardIndex: 0,
  cardFlipped: false,
  writingScript: "hiragana",
  writingMode: "trace",
  writingIndex: 0,
  writingGuideVisible: true,
  writingStrokes: new Map(),
  writingPointerId: null,
  writingCurrentStroke: null,
  quiz: null,
  toastTimer: null
};

const elements = {
  kanaGrid: document.querySelector("#kanaGrid"),
  rowFilters: document.querySelector("#rowFilters"),
  romajiToggle: document.querySelector("#romajiToggle"),
  navProgressText: document.querySelector("#navProgressText"),
  navProgressBar: document.querySelector("#navProgressBar"),
  masteredCount: document.querySelector("#masteredCount"),
  quizBest: document.querySelector("#quizBest"),
  studyDays: document.querySelector("#studyDays"),
  flashcard: document.querySelector("#flashcard"),
  cardKana: document.querySelector("#cardKana"),
  cardRomaji: document.querySelector("#cardRomaji"),
  cardPair: document.querySelector("#cardPair"),
  cardScriptLabel: document.querySelector("#cardScriptLabel"),
  cardCounter: document.querySelector("#cardCounter"),
  writingCanvas: document.querySelector("#writingCanvas"),
  writingGuideToggle: document.querySelector("#writingGuideToggle"),
  writingReferenceKana: document.querySelector("#writingReferenceKana"),
  writingRomaji: document.querySelector("#writingRomaji"),
  writingRowLabel: document.querySelector("#writingRowLabel"),
  writingScriptLabel: document.querySelector("#writingScriptLabel"),
  writingHint: document.querySelector("#writingHint"),
  writingSectionNote: document.querySelector("#writingSectionNote"),
  writingHeading: document.querySelector("#writingHeading"),
  writingDescription: document.querySelector("#writingDescription"),
  writingGuideControl: document.querySelector("#writingGuideControl"),
  writingResult: document.querySelector("#writingResult"),
  writingScore: document.querySelector("#writingScore"),
  writingResultTitle: document.querySelector("#writingResultTitle"),
  writingResultCopy: document.querySelector("#writingResultCopy"),
  writingKanaStrip: document.querySelector("#writingKanaStrip"),
  undoWriting: document.querySelector("#undoWriting"),
  clearWriting: document.querySelector("#clearWriting"),
  finishWriting: document.querySelector("#finishWriting"),
  quizStart: document.querySelector("#quizStart"),
  quizPlay: document.querySelector("#quizPlay"),
  quizResult: document.querySelector("#quizResult"),
  quizProgressText: document.querySelector("#quizProgressText"),
  quizScoreText: document.querySelector("#quizScoreText"),
  quizProgressBar: document.querySelector("#quizProgressBar"),
  quizPrompt: document.querySelector("#quizPrompt"),
  quizGlyph: document.querySelector("#quizGlyph"),
  quizOptions: document.querySelector("#quizOptions"),
  quizFeedback: document.querySelector("#quizFeedback"),
  resultScore: document.querySelector("#resultScore"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCopy: document.querySelector("#resultCopy"),
  toast: document.querySelector("#toast")
};

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast("浏览器未允许保存进度。");
  }
}

function masteryKey(item, script = state.script) {
  return `${script}:${item.romaji}`;
}

function registerStudyDay() {
  const today = new Date().toISOString().slice(0, 10);
  const days = loadJSON(STORAGE_KEYS.days, []);
  if (!days.includes(today)) {
    days.push(today);
    saveJSON(STORAGE_KEYS.days, days.slice(-180));
  }
}

function renderFilters() {
  const filters = [{ id: "all", label: "全部" }, ...KANA_ROWS.map(({ id, label }) => ({ id, label }))];
  elements.rowFilters.replaceChildren(...filters.map((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${state.row === filter.id ? " is-active" : ""}`;
    button.textContent = filter.label;
    button.dataset.row = filter.id;
    button.setAttribute("aria-pressed", String(state.row === filter.id));
    return button;
  }));
}

function renderKanaGrid() {
  const visible = state.row === "all" ? KANA : KANA.filter((item) => item.row === state.row);
  elements.kanaGrid.replaceChildren(...visible.map((item, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "kana-item";
    wrapper.style.setProperty("--stagger", `${Math.min(index, 12) * 24}ms`);

    const card = document.createElement("button");
    card.type = "button";
    card.className = `kana-card${state.showRomaji ? "" : " hide-romaji"}`;
    card.dataset.romaji = item.romaji;
    card.dataset.action = "speak";
    card.setAttribute("aria-label", `${item[state.script]}，${item.romaji}，点击听发音`);
    card.innerHTML = `<strong>${item[state.script]}</strong><span>${item.romaji}</span>`;

    const learned = document.createElement("button");
    const isMastered = state.mastered.has(masteryKey(item));
    learned.type = "button";
    learned.className = `kana-learned${isMastered ? " is-mastered" : ""}`;
    learned.dataset.romaji = item.romaji;
    learned.dataset.action = "master";
    learned.setAttribute("aria-label", isMastered ? `将 ${item[state.script]} 标记为待学习` : `将 ${item[state.script]} 标记为已记住`);
    learned.setAttribute("aria-pressed", String(isMastered));
    learned.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m20 6-11 11-5-5" /></svg>`;

    wrapper.append(card, learned);
    return wrapper;
  }));
}

function setScript(script) {
  state.script = script;
  document.querySelectorAll("[data-script]").forEach((button) => {
    const active = button.dataset.script === script;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  state.cardFlipped = false;
  renderKanaGrid();
  renderCard();
}

function filteredCards() {
  return state.row === "all" ? KANA : KANA.filter((item) => item.row === state.row);
}

function renderCard() {
  const cards = filteredCards();
  if (state.cardIndex >= cards.length) state.cardIndex = 0;
  const item = cards[state.cardIndex];
  elements.flashcard.classList.toggle("is-flipped", state.cardFlipped);
  elements.cardKana.textContent = item[state.script];
  elements.cardRomaji.textContent = item.romaji;
  elements.cardPair.textContent = state.script === "hiragana" ? `片假名 ${item.katakana}` : `平假名 ${item.hiragana}`;
  elements.cardScriptLabel.textContent = state.script === "hiragana" ? "平假名" : "片假名";
  elements.cardCounter.textContent = `${state.cardIndex + 1} / ${cards.length}`;
}

function moveCard(direction) {
  const cards = filteredCards();
  state.cardIndex = (state.cardIndex + direction + cards.length) % cards.length;
  state.cardFlipped = false;
  renderCard();
}

function currentWritingItem() {
  return KANA[state.writingIndex];
}

function writingKey() {
  return `${state.writingScript}:${state.writingMode}:${currentWritingItem().romaji}`;
}

function currentWritingStrokes() {
  const key = writingKey();
  if (!state.writingStrokes.has(key)) state.writingStrokes.set(key, []);
  return state.writingStrokes.get(key);
}

function updateWritingControls() {
  const hasStrokes = currentWritingStrokes().length > 0;
  const expectedCount = currentStrokePaths().length;
  const writtenCount = currentWritingStrokes().length;
  elements.undoWriting.disabled = !hasStrokes;
  elements.clearWriting.disabled = !hasStrokes;
  elements.finishWriting.disabled = !hasStrokes;
  if (hasStrokes) elements.writingHint.textContent = `已写 ${writtenCount} / ${expectedCount} 笔，可以检查或继续`;
  else if (state.writingMode === "trace") elements.writingHint.textContent = `从圆点起笔，这个假名共 ${expectedCount} 笔`;
  else elements.writingHint.textContent = "看罗马音或听发音，凭记忆写下来";
}

function resetWritingResult() {
  elements.writingResult.hidden = true;
  elements.writingResult.removeAttribute("data-grade");
  elements.writingCanvas.classList.remove("is-correct", "is-retry");
}

function renderWritingReference() {
  const item = currentWritingItem();
  const scriptLabel = state.writingScript === "hiragana" ? "平假名" : "片假名";
  const isRecall = state.writingMode === "recall";
  elements.writingReferenceKana.textContent = isRecall ? "?" : item[state.writingScript];
  elements.writingRomaji.textContent = item.romaji;
  elements.writingRowLabel.textContent = item.rowLabel;
  elements.writingScriptLabel.textContent = scriptLabel;
  elements.writingCanvas.setAttribute("aria-label", isRecall
    ? `根据读音 ${item.romaji} 默写${scriptLabel}的书写板`
    : `临摹${scriptLabel}${item[state.writingScript]}的书写板`);
  elements.writingSectionNote.textContent = isRecall ? "记忆默写" : "描红练习";
  elements.writingHeading.textContent = isRecall ? "不看字帖，凭记忆写下来" : "顺着字形，亲手写一遍";
  elements.writingDescription.textContent = isRecall
    ? "只看罗马音，也可以先听一遍发音。写完后检查字形，再决定是否进入下一个。"
    : "用手指、触控笔或鼠标沿着浅色字帖书写。先慢一点，感受每一笔的方向。";
  elements.writingGuideControl.hidden = isRecall;
  elements.writingGuideToggle.disabled = isRecall;
  document.querySelector("#view-write").dataset.writingMode = state.writingMode;
  document.querySelectorAll("[data-write-script]").forEach((button) => {
    const active = button.dataset.writeScript === state.writingScript;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-write-mode]").forEach((button) => {
    const active = button.dataset.writeMode === state.writingMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  updateWritingControls();
  drawWritingCanvas();
}

function renderWritingKanaStrip() {
  elements.writingKanaStrip.replaceChildren(...KANA.map((item, index) => {
    const button = document.createElement("button");
    const active = index === state.writingIndex;
    const mastered = state.mastered.has(masteryKey(item, state.writingScript));
    button.type = "button";
    button.className = `writing-kana-choice${active ? " is-active" : ""}${mastered ? " is-mastered" : ""}`;
    button.dataset.writingIndex = String(index);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", `${item[state.writingScript]}，${item.romaji}${mastered ? "，已掌握" : ""}`);
    button.innerHTML = `<strong>${item[state.writingScript]}</strong><span>${item.romaji}</span>`;
    return button;
  }));
}

function resizeWritingCanvas() {
  const { writingCanvas: canvas } = elements;
  const size = Math.round(canvas.getBoundingClientRect().width);
  if (!size) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const renderSize = Math.round(size * pixelRatio);
  if (canvas.width !== renderSize || canvas.height !== renderSize) {
    canvas.width = renderSize;
    canvas.height = renderSize;
  }
  drawWritingCanvas();
}

function drawWritingCanvas() {
  const { writingCanvas: canvas } = elements;
  const context = canvas.getContext("2d");
  const size = canvas.getBoundingClientRect().width;
  if (!context || !size) return;

  const scale = canvas.width / size;
  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue("--color-ink").trim();
  const paper = styles.getPropertyValue("--color-paper").trim();
  const coral = styles.getPropertyValue("--color-coral").trim();

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, size, size);
  context.fillStyle = paper;
  context.fillRect(0, 0, size, size);

  context.save();
  context.strokeStyle = ink;
  context.globalAlpha = 0.18;
  context.lineWidth = Math.max(1, size * 0.003);
  context.setLineDash([size * 0.025, size * 0.025]);
  context.beginPath();
  context.moveTo(size / 2, 0);
  context.lineTo(size / 2, size);
  context.moveTo(0, size / 2);
  context.lineTo(size, size / 2);
  context.stroke();
  context.restore();

  if (state.writingMode === "trace" && state.writingGuideVisible) {
    const paths = currentStrokePaths();
    const writtenCount = currentWritingStrokes().length - (state.writingCurrentStroke ? 1 : 0);
    const nextStrokeIndex = Math.min(writtenCount, Math.max(0, paths.length - 1));
    context.save();
    context.scale(size / 109, size / 109);
    paths.forEach((path, index) => {
      context.strokeStyle = index === nextStrokeIndex ? coral : ink;
      context.globalAlpha = index === nextStrokeIndex ? 0.3 : 0.1;
      context.lineWidth = index === nextStrokeIndex ? 7.5 : 6.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke(new Path2D(path));
    });
    const nextPath = paths[nextStrokeIndex];
    if (nextPath && writtenCount < paths.length) {
      const start = sampleTemplateStroke(nextPath, 2)[0];
      context.fillStyle = coral;
      context.globalAlpha = 0.72;
      context.beginPath();
      context.arc(start.x, start.y, 2.8, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  context.strokeStyle = ink;
  context.fillStyle = ink;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(6, size * 0.024);
  currentWritingStrokes().forEach((stroke) => drawWritingStroke(context, stroke, size));
}

function drawWritingStroke(context, stroke, size) {
  if (!stroke.length) return;
  const first = stroke[0];
  if (stroke.length === 1) {
    context.beginPath();
    context.arc(first.x * size, first.y * size, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(first.x * size, first.y * size);
  for (let index = 1; index < stroke.length - 1; index += 1) {
    const point = stroke[index];
    const next = stroke[index + 1];
    context.quadraticCurveTo(point.x * size, point.y * size, (point.x + next.x) * size / 2, (point.y + next.y) * size / 2);
  }
  const last = stroke[stroke.length - 1];
  context.lineTo(last.x * size, last.y * size);
  context.stroke();
}

function writingPoint(event) {
  const rect = elements.writingCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function startWritingStroke(event) {
  if (state.writingPointerId !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  resetWritingResult();
  state.writingPointerId = event.pointerId;
  state.writingCurrentStroke = [writingPoint(event)];
  currentWritingStrokes().push(state.writingCurrentStroke);
  elements.writingCanvas.setPointerCapture(event.pointerId);
  updateWritingControls();
  drawWritingCanvas();
}

function continueWritingStroke(event) {
  if (event.pointerId !== state.writingPointerId || !state.writingCurrentStroke) return;
  event.preventDefault();
  const coalescedEvents = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
  const samples = coalescedEvents.length ? coalescedEvents : [event];
  samples.forEach((sample) => state.writingCurrentStroke.push(writingPoint(sample)));
  drawWritingCanvas();
}

function endWritingStroke(event) {
  if (event.pointerId !== state.writingPointerId) return;
  if (state.writingCurrentStroke && event.type === "pointerup") {
    state.writingCurrentStroke.push(writingPoint(event));
  }
  if (elements.writingCanvas.hasPointerCapture(event.pointerId)) elements.writingCanvas.releasePointerCapture(event.pointerId);
  state.writingPointerId = null;
  state.writingCurrentStroke = null;
  updateWritingControls();
  drawWritingCanvas();
}

function moveWritingKana(direction) {
  state.writingIndex = (state.writingIndex + direction + KANA.length) % KANA.length;
  state.writingPointerId = null;
  state.writingCurrentStroke = null;
  resetWritingResult();
  renderWritingReference();
  renderWritingKanaStrip();
}

function setWritingScript(script) {
  state.writingScript = script;
  state.writingPointerId = null;
  state.writingCurrentStroke = null;
  resetWritingResult();
  renderWritingReference();
  renderWritingKanaStrip();
}

function setWritingMode(mode) {
  state.writingMode = mode;
  state.writingPointerId = null;
  state.writingCurrentStroke = null;
  resetWritingResult();
  renderWritingReference();
  renderWritingKanaStrip();
}

const templateStrokeCache = new Map();

function currentStrokePaths() {
  return window.KANA_STROKES?.[currentWritingItem()[state.writingScript]] || [];
}

function sampleTemplateStroke(pathData, count = 48) {
  const cacheKey = `${count}:${pathData}`;
  if (templateStrokeCache.has(cacheKey)) return templateStrokeCache.get(cacheKey);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  const length = path.getTotalLength();
  const points = Array.from({ length: count }, (_, index) => {
    const point = path.getPointAtLength(length * index / Math.max(1, count - 1));
    return { x: point.x, y: point.y };
  });
  templateStrokeCache.set(cacheKey, points);
  return points;
}

function pointDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function resampleStroke(points, count = 48) {
  const source = points.map((point) => ({ x: point.x * 109, y: point.y * 109 }));
  if (source.length === 1) return Array.from({ length: count }, () => ({ ...source[0] }));
  const distances = [0];
  for (let index = 1; index < source.length; index += 1) {
    distances.push(distances[index - 1] + pointDistance(source[index - 1], source[index]));
  }
  const total = distances[distances.length - 1];
  if (!total) return Array.from({ length: count }, () => ({ ...source[0] }));

  return Array.from({ length: count }, (_, sampleIndex) => {
    const target = total * sampleIndex / Math.max(1, count - 1);
    let segment = 1;
    while (segment < distances.length - 1 && distances[segment] < target) segment += 1;
    const startDistance = distances[segment - 1];
    const segmentLength = distances[segment] - startDistance || 1;
    const ratio = (target - startDistance) / segmentLength;
    return {
      x: source[segment - 1].x + (source[segment].x - source[segment - 1].x) * ratio,
      y: source[segment - 1].y + (source[segment].y - source[segment - 1].y) * ratio
    };
  });
}

function pointsBounds(strokes) {
  const points = strokes.flat();
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}

function alignStrokes(strokes, sourceBounds, targetBounds) {
  const sourceWidth = Math.max(1, sourceBounds.maxX - sourceBounds.minX);
  const sourceHeight = Math.max(1, sourceBounds.maxY - sourceBounds.minY);
  const targetWidth = Math.max(1, targetBounds.maxX - targetBounds.minX);
  const targetHeight = Math.max(1, targetBounds.maxY - targetBounds.minY);
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const sourceCenter = { x: (sourceBounds.minX + sourceBounds.maxX) / 2, y: (sourceBounds.minY + sourceBounds.maxY) / 2 };
  const targetCenter = { x: (targetBounds.minX + targetBounds.maxX) / 2, y: (targetBounds.minY + targetBounds.maxY) / 2 };
  return strokes.map((stroke) => stroke.map((point) => ({
    x: (point.x - sourceCenter.x) * scale + targetCenter.x,
    y: (point.y - sourceCenter.y) * scale + targetCenter.y
  })));
}

function averageStrokeDistance(first, second) {
  return first.reduce((total, point, index) => total + pointDistance(point, second[index]), 0) / first.length;
}

function clampScore(value) {
  return Math.max(0, Math.min(1, value));
}

function evaluateWriting() {
  const templatePaths = currentStrokePaths();
  const userRaw = currentWritingStrokes().map((stroke) => resampleStroke(stroke));
  const template = templatePaths.map((path) => sampleTemplateStroke(path));
  if (!template.length) {
    return { passed: false, score: 0, issue: { type: "unavailable" } };
  }

  const expectedCount = template.length;
  const actualCount = userRaw.length;
  const countScore = clampScore(1 - Math.abs(expectedCount - actualCount) / expectedCount);
  const userBounds = pointsBounds(userRaw);
  const templateBounds = pointsBounds(template);
  const alignedUser = userBounds ? alignStrokes(userRaw, userBounds, templateBounds) : [];
  const comparedCount = Math.min(actualCount, expectedCount);
  const strokeScores = [];
  let directionIssue = null;
  let orderIssue = null;

  for (let index = 0; index < comparedCount; index += 1) {
    const directDistance = averageStrokeDistance(alignedUser[index], template[index]);
    const reverseDistance = averageStrokeDistance([...alignedUser[index]].reverse(), template[index]);
    const shapeScore = clampScore(1 - directDistance / 22);
    strokeScores.push(shapeScore);
    if (!directionIssue && reverseDistance + 2 < directDistance) directionIssue = index;

    const alternatives = template.map((templateStroke, templateIndex) => ({
      templateIndex,
      distance: averageStrokeDistance(alignedUser[index], templateStroke)
    })).sort((first, second) => first.distance - second.distance);
    if (!orderIssue && alternatives[0].templateIndex !== index && alternatives[0].distance + 3 < directDistance) {
      orderIssue = index;
    }
  }

  const shapeScore = strokeScores.length
    ? strokeScores.reduce((total, score) => total + score, 0) / strokeScores.length
    : 0;
  const worstStroke = strokeScores.length
    ? strokeScores.indexOf(Math.min(...strokeScores))
    : 0;
  let positionScore = 0;
  if (userBounds && templateBounds) {
    const userCenter = { x: (userBounds.minX + userBounds.maxX) / 2, y: (userBounds.minY + userBounds.maxY) / 2 };
    const templateCenter = { x: (templateBounds.minX + templateBounds.maxX) / 2, y: (templateBounds.minY + templateBounds.maxY) / 2 };
    const centerPenalty = pointDistance(userCenter, templateCenter) / 32;
    const userWidth = Math.max(1, userBounds.maxX - userBounds.minX);
    const userHeight = Math.max(1, userBounds.maxY - userBounds.minY);
    const templateWidth = Math.max(1, templateBounds.maxX - templateBounds.minX);
    const templateHeight = Math.max(1, templateBounds.maxY - templateBounds.minY);
    const sizePenalty = (Math.abs(userWidth - templateWidth) / templateWidth + Math.abs(userHeight - templateHeight) / templateHeight) / 2;
    positionScore = clampScore(1 - centerPenalty - sizePenalty * 0.55);
  }

  const directionScore = comparedCount ? 1 - (directionIssue === null ? 0 : 1 / comparedCount) : 0;
  const score = Math.round((countScore * 0.2 + shapeScore * 0.45 + positionScore * 0.2 + directionScore * 0.15) * 100);
  let issue = null;
  if (actualCount !== expectedCount) issue = { type: "count", expected: expectedCount, actual: actualCount };
  else if (orderIssue !== null) issue = { type: "order", stroke: orderIssue + 1 };
  else if (directionIssue !== null) issue = { type: "direction", stroke: directionIssue + 1 };
  else if (shapeScore < 0.62 || strokeScores[worstStroke] < 0.5) issue = { type: "shape", stroke: worstStroke + 1 };
  else if (positionScore < 0.45) issue = { type: "position" };

  return {
    passed: issue === null && score >= 68,
    score,
    issue,
    expectedCount,
    strokeScores,
    positionScore
  };
}

function showWritingResult(result) {
  elements.writingResult.hidden = false;
  elements.writingResult.dataset.grade = result.passed ? "pass" : "retry";
  elements.writingScore.textContent = result.passed ? "通过" : "再试";
  elements.writingCanvas.classList.toggle("is-correct", result.passed);
  elements.writingCanvas.classList.toggle("is-retry", !result.passed);

  if (result.passed) {
    elements.writingResultTitle.textContent = "笔顺和字形都对了";
    elements.writingResultCopy.textContent = state.writingMode === "recall"
      ? `没有字帖也按 ${result.expectedCount} 笔写对了。`
      : `共 ${result.expectedCount} 笔，方向和位置都合格。`;
    return;
  }

  const issue = result.issue || { type: "shape", stroke: 1 };
  if (issue.type === "count") {
    elements.writingResultTitle.textContent = "笔画数量不对";
    elements.writingResultCopy.textContent = `标准是 ${issue.expected} 笔，你写了 ${issue.actual} 笔。撤销或补齐后再检查。`;
  } else if (issue.type === "order") {
    elements.writingResultTitle.textContent = `第 ${issue.stroke} 笔顺序不对`;
    elements.writingResultCopy.textContent = "按字帖高亮的顺序重新写这一笔。";
  } else if (issue.type === "direction") {
    elements.writingResultTitle.textContent = `第 ${issue.stroke} 笔方向反了`;
    elements.writingResultCopy.textContent = "从高亮圆点处起笔，沿着笔画方向写。";
  } else if (issue.type === "position") {
    elements.writingResultTitle.textContent = "整体位置或大小不合适";
    elements.writingResultCopy.textContent = "让字形落在格子中央，并保持和字帖接近的大小。";
  } else if (issue.type === "unavailable") {
    elements.writingResultTitle.textContent = "这个字暂时无法检查";
    elements.writingResultCopy.textContent = "标准笔画数据没有加载，请刷新页面后重试。";
  } else {
    elements.writingResultTitle.textContent = `第 ${issue.stroke} 笔形状需要调整`;
    elements.writingResultCopy.textContent = state.writingMode === "recall"
      ? "切回临摹查看这笔的转折，再重新默写。"
      : "沿着高亮路径调整这一笔的转折和长度。";
  }
}

function finishWriting(event) {
  const item = currentWritingItem();
  const button = event.currentTarget;
  const result = evaluateWriting();
  showWritingResult(result);
  if (!result.passed) {
    button.dataset.state = "error";
    showToast("还需要调整，看看具体提示。");
    window.setTimeout(() => { delete button.dataset.state; }, 700);
    return;
  }
  const key = masteryKey(item, state.writingScript);
  if (!state.mastered.has(key)) {
    state.mastered.add(key);
    saveJSON(STORAGE_KEYS.mastered, [...state.mastered]);
    updateProgress();
    renderKanaGrid();
  }
  renderWritingKanaStrip();
  button.dataset.state = "success";
  burstAt(button);
  showToast(`${item[state.writingScript]} 的笔顺和字形通过了。`);
  window.setTimeout(() => {
    delete button.dataset.state;
    moveWritingKana(1);
  }, prefersReducedMotion() ? 250 : 1150);
}

function speak(item) {
  if (!("speechSynthesis" in window)) {
    showToast("这个浏览器暂不支持发音。");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(item.hiragana);
  utterance.lang = "ja-JP";
  utterance.rate = 0.72;
  utterance.pitch = 1.05;
  const japaneseVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("ja"));
  if (japaneseVoice) utterance.voice = japaneseVoice;
  window.speechSynthesis.speak(utterance);
}

function toggleMastered(item, sourceElement) {
  const key = masteryKey(item);
  const nowMastered = !state.mastered.has(key);
  if (nowMastered) state.mastered.add(key);
  else state.mastered.delete(key);
  saveJSON(STORAGE_KEYS.mastered, [...state.mastered]);
  renderKanaGrid();
  updateProgress();
  if (nowMastered && sourceElement) burstAt(sourceElement);
}

function markCurrentCard(event) {
  const item = filteredCards()[state.cardIndex];
  const key = masteryKey(item);
  if (!state.mastered.has(key)) {
    state.mastered.add(key);
    saveJSON(STORAGE_KEYS.mastered, [...state.mastered]);
    updateProgress();
    renderKanaGrid();
    burstAt(event.currentTarget);
  }
  window.setTimeout(() => moveCard(1), 260);
}

function updateProgress() {
  const count = state.mastered.size;
  const total = KANA.length * 2;
  const percentage = Math.min(100, Math.round((count / total) * 100));
  elements.navProgressText.textContent = `${count} / ${total}`;
  elements.navProgressBar.style.transform = `scaleX(${percentage / 100})`;
  elements.masteredCount.textContent = count;

  const best = Number(loadJSON(STORAGE_KEYS.best, 0));
  elements.quizBest.textContent = best ? `${best} / 10` : "--";
  elements.studyDays.textContent = loadJSON(STORAGE_KEYS.days, []).length || 1;
}

function showView(name) {
  document.querySelectorAll("[data-view]").forEach((panel) => {
    const active = panel.dataset.view === name;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
    panel.classList.toggle("is-entering", active);
  });
  document.querySelectorAll(".view-tab").forEach((button) => {
    const active = button.dataset.viewTarget === name;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const panel = document.querySelector(`[data-view="${name}"]`);
  panel?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  panel?.focus({ preventScroll: true });
  if (name === "write") window.requestAnimationFrame(resizeWritingCanvas);
  window.setTimeout(() => panel?.classList.remove("is-entering"), 560);
}

function startQuiz() {
  const questions = shuffle([...KANA]).slice(0, 10).map((item, index) => makeQuestion(item, index));
  state.quiz = { questions, index: 0, score: 0, answered: false };
  elements.quizStart.hidden = true;
  elements.quizResult.hidden = true;
  elements.quizPlay.hidden = false;
  renderQuestion();
}

function makeQuestion(item, index) {
  const script = index % 2 === 0 ? "hiragana" : "katakana";
  const direction = index % 3 === 0 ? "romaji-to-kana" : "kana-to-romaji";
  const answer = direction === "kana-to-romaji" ? item.romaji : item[script];
  const pool = KANA.filter((candidate) => candidate.romaji !== item.romaji);
  const distractors = shuffle(pool).slice(0, 3).map((candidate) => direction === "kana-to-romaji" ? candidate.romaji : candidate[script]);
  return {
    item,
    script,
    direction,
    answer,
    options: shuffle([answer, ...distractors])
  };
}

function renderQuestion() {
  const { questions, index, score } = state.quiz;
  const question = questions[index];
  state.quiz.answered = false;
  elements.quizProgressText.textContent = `第 ${index + 1} 题 / ${questions.length}`;
  elements.quizScoreText.textContent = `得分 ${score}`;
  elements.quizProgressBar.style.transform = `scaleX(${(index + 1) / questions.length})`;
  elements.quizFeedback.textContent = "";

  if (question.direction === "kana-to-romaji") {
    elements.quizPrompt.textContent = "这个假名怎么读？";
    elements.quizGlyph.textContent = question.item[question.script];
  } else {
    elements.quizPrompt.textContent = "哪个假名读这个音？";
    elements.quizGlyph.textContent = question.item.romaji;
  }

  elements.quizOptions.replaceChildren(...question.options.map((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-option";
    button.textContent = option;
    button.dataset.answer = option;
    return button;
  }));
}

function answerQuestion(event) {
  const button = event.target.closest(".quiz-option");
  if (!button || !state.quiz || state.quiz.answered) return;

  state.quiz.answered = true;
  const question = state.quiz.questions[state.quiz.index];
  const correct = button.dataset.answer === question.answer;
  if (correct) {
    state.quiz.score += 1;
    button.classList.add("is-correct");
    elements.quizFeedback.textContent = `答对了，${question.item.hiragana} 读 ${question.item.romaji}。`;
    const key = masteryKey(question.item, question.script);
    state.mastered.add(key);
    saveJSON(STORAGE_KEYS.mastered, [...state.mastered]);
    updateProgress();
    burstAt(button);
  } else {
    button.classList.add("is-wrong");
    elements.quizFeedback.textContent = `正确答案是 ${question.answer}。`;
    const correctButton = [...elements.quizOptions.children].find((option) => option.dataset.answer === question.answer);
    correctButton?.classList.add("is-correct");
  }
  [...elements.quizOptions.children].forEach((option) => { option.disabled = true; });
  speak(question.item);

  window.setTimeout(() => {
    state.quiz.index += 1;
    if (state.quiz.index >= state.quiz.questions.length) finishQuiz();
    else renderQuestion();
  }, prefersReducedMotion() ? 250 : 1050);
}

function finishQuiz() {
  const score = state.quiz.score;
  const best = Math.max(score, Number(loadJSON(STORAGE_KEYS.best, 0)));
  saveJSON(STORAGE_KEYS.best, best);
  elements.quizPlay.hidden = true;
  elements.quizResult.hidden = false;
  elements.resultScore.textContent = `${score} / 10`;
  if (score >= 9) {
    elements.resultTitle.textContent = "这些声音，已经很熟悉了。";
    elements.resultCopy.textContent = "可以切换另一种假名，继续巩固字形。";
  } else if (score >= 6) {
    elements.resultTitle.textContent = "很好，这些声音已经开始留下来了。";
    elements.resultCopy.textContent = "再回看答错的假名，会记得更牢。";
  } else {
    elements.resultTitle.textContent = "慢慢来，耳朵和眼睛正在学会配合。";
    elements.resultCopy.textContent = "先用翻卡练习一行，再回来试试。";
  }
  updateProgress();
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 1800);
}

function burstAt(element) {
  if (prefersReducedMotion()) return;
  const rect = element.getBoundingClientRect();
  const burst = document.createElement("span");
  burst.className = "star-burst";
  burst.setAttribute("aria-hidden", "true");
  burst.style.left = `${rect.left + rect.width / 2 - 12}px`;
  burst.style.top = `${rect.top + rect.height / 2 - 12}px`;
  document.body.append(burst);
  window.setTimeout(() => burst.remove(), 450);
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view-target]");
  if (viewButton) {
    showView(viewButton.dataset.viewTarget);
    return;
  }

  const scrollButton = event.target.closest("[data-scroll-to]");
  if (scrollButton) {
    document.querySelector(`#${scrollButton.dataset.scrollTo}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }
});

document.querySelectorAll("[data-script]").forEach((button) => {
  button.addEventListener("click", () => setScript(button.dataset.script));
});

elements.romajiToggle.addEventListener("change", () => {
  state.showRomaji = elements.romajiToggle.checked;
  renderKanaGrid();
});

elements.rowFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-row]");
  if (!button) return;
  state.row = button.dataset.row;
  state.cardIndex = 0;
  state.cardFlipped = false;
  renderFilters();
  renderKanaGrid();
  renderCard();
});

elements.kanaGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const item = KANA.find((candidate) => candidate.romaji === button.dataset.romaji);
  if (!item) return;
  if (button.dataset.action === "speak") speak(item);
  if (button.dataset.action === "master") toggleMastered(item, button);
});

elements.flashcard.addEventListener("click", () => {
  state.cardFlipped = !state.cardFlipped;
  renderCard();
});
document.querySelector("#prevCard").addEventListener("click", () => moveCard(-1));
document.querySelector("#nextCard").addEventListener("click", () => moveCard(1));
document.querySelector("#speakCard").addEventListener("click", () => speak(filteredCards()[state.cardIndex]));
document.querySelector("#knowCard").addEventListener("click", markCurrentCard);
document.querySelectorAll("[data-write-script]").forEach((button) => {
  button.addEventListener("click", () => setWritingScript(button.dataset.writeScript));
});
document.querySelectorAll("[data-write-mode]").forEach((button) => {
  button.addEventListener("click", () => setWritingMode(button.dataset.writeMode));
});
elements.writingGuideToggle.addEventListener("change", () => {
  state.writingGuideVisible = elements.writingGuideToggle.checked;
  resetWritingResult();
  drawWritingCanvas();
});
elements.writingCanvas.addEventListener("pointerdown", startWritingStroke);
elements.writingCanvas.addEventListener("pointermove", continueWritingStroke);
elements.writingCanvas.addEventListener("pointerup", endWritingStroke);
elements.writingCanvas.addEventListener("pointercancel", endWritingStroke);
document.querySelector("#previousWritingKana").addEventListener("click", () => moveWritingKana(-1));
document.querySelector("#nextWritingKana").addEventListener("click", () => moveWritingKana(1));
document.querySelector("#speakWriting").addEventListener("click", () => speak(currentWritingItem()));
elements.undoWriting.addEventListener("click", () => {
  currentWritingStrokes().pop();
  resetWritingResult();
  updateWritingControls();
  drawWritingCanvas();
});
elements.clearWriting.addEventListener("click", () => {
  currentWritingStrokes().length = 0;
  resetWritingResult();
  updateWritingControls();
  drawWritingCanvas();
});
elements.finishWriting.addEventListener("click", finishWriting);
elements.writingKanaStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-writing-index]");
  if (!button) return;
  state.writingIndex = Number(button.dataset.writingIndex);
  resetWritingResult();
  renderWritingReference();
  renderWritingKanaStrip();
});
document.querySelector("#startQuiz").addEventListener("click", startQuiz);
document.querySelector("#restartQuiz").addEventListener("click", startQuiz);
elements.quizOptions.addEventListener("click", answerQuestion);

registerStudyDay();
renderFilters();
renderKanaGrid();
renderCard();
renderWritingReference();
renderWritingKanaStrip();
updateProgress();

if ("ResizeObserver" in window) {
  new ResizeObserver(resizeWritingCanvas).observe(elements.writingCanvas);
} else {
  window.addEventListener("resize", resizeWritingCanvas);
}
