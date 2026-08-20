(() => {
  'use strict';

  const DATA_PATH = 'https://cdn.emulatorjs.org/stable/data/';
  const SYSTEMS = {
    md: {
      core: 'segaMD',
      label: 'MEGA DRIVE / GENESIS',
      cartridgeLabel: 'MD',
    },
    fc: {
      core: 'nes',
      label: 'FAMILY COMPUTER / NES',
      cartridgeLabel: 'FC',
    },
    gba: {
      core: 'gba',
      label: 'GAME BOY ADVANCE',
      cartridgeLabel: 'GBA',
    },
  };
  const BUILT_IN_GAMES = {
    md: [
      {
        id: 'yu-yu-hakusho-makyo-toitsusen-zh',
        title: '幽游白书 魔强统一战',
        edition: '简体中文版',
        fileName: 'yu-yu-hakusho-makyo-toitsusen-zh.bin',
        romUrl: './assets/roms/yu-yu-hakusho-makyo-toitsusen-zh.bin',
        coverUrl: './assets/covers/yu-yu-hakusho-makyo-toitsusen.png',
      },
    ],
    fc: [
      {
        id: 'super-mario-bros-europe',
        title: '超级马里奥兄弟',
        edition: '欧洲版',
        fileName: 'super-mario-bros-europe.nes',
        romUrl: './assets/roms/super-mario-bros-europe.nes',
        coverUrl: './assets/covers/super-mario-bros-europe.png',
      },
    ],
    gba: [],
  };
  const EXTENSION_SYSTEMS = {
    bin: 'md',
    fds: 'fc',
    gba: 'gba',
    gen: 'md',
    md: 'md',
    nes: 'fc',
    smd: 'md',
  };
  const SUPPORTED_EXTENSIONS = new Set([
    ...Object.keys(EXTENSION_SYSTEMS),
    'zip',
  ]);
  const MAX_ROM_SIZE = 64 * 1024 * 1024;
  const LIBRARY_DB_NAME = 'find-childhood-rom-library';
  const LIBRARY_DB_VERSION = 2;
  const LIBRARY_STORE_NAME = 'games';
  const STATE_STORE_NAME = 'states';
  const MAX_STATES_PER_GAME = 8;
  const PLAY_LIMIT_MS = 5 * 60 * 1000;
  const PLAY_LIMIT_STORAGE_KEY = 'find-childhood-play-limit-v1';
  const PLAY_LIMIT_BYPASS_STORAGE_KEY = 'find-childhood-play-limit-bypass-v1';
  const PLAY_LIMIT_HEARTBEAT_MS = 1000;
  const PLAY_LIMIT_UNLOCK_HOLD_MS = 3000;
  const PLAY_LIMIT_UNLOCK_SEQUENCE_MS = 15000;
  const PLAY_LIMIT_UNLOCK_SEQUENCE = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'b', 'a', 'b', 'a',
  ];
  const GAMEPAD_BINDINGS = {
    0: 'BUTTON_2',
    1: 'BUTTON_4',
    2: 'SELECT',
    3: 'START',
    4: 'DPAD_UP',
    5: 'DPAD_DOWN',
    6: 'DPAD_LEFT',
    7: 'DPAD_RIGHT',
    8: 'BUTTON_1',
    9: 'BUTTON_3',
    10: 'LEFT_TOP_SHOULDER',
    11: 'RIGHT_TOP_SHOULDER',
  };
  const KEYBOARD_BINDINGS = {
    md: {
      0: 'k', 1: 'j', 2: 'v', 3: 'b', 4: 'w', 5: 's',
      6: 'a', 7: 'd', 8: 'l', 9: 'i', 10: 'u', 11: 'o',
    },
    standard: {
      0: 'k', 1: '', 2: 'v', 3: 'b', 4: 'w', 5: 's',
      6: 'a', 7: 'd', 8: 'j', 9: '', 10: 'q', 11: 'e',
    },
  };
  const KEYBOARD_DIRECTION_INPUTS = {
    KeyW: 4,
    KeyS: 5,
    KeyA: 6,
    KeyD: 7,
  };

  const elements = {
    actionKeyRow: document.querySelector('#action-key-row'),
    actionLabel: document.querySelector('#action-label'),
    cartridgeLabel: document.querySelector('#cartridge-label'),
    changeGameButton: document.querySelector('#change-game-button'),
    consoleFrame: document.querySelector('#console-frame'),
    emulatorStage: document.querySelector('#emulator-stage'),
    errorMessage: document.querySelector('#error-message'),
    errorScreen: document.querySelector('#error-screen'),
    fullscreenButton: document.querySelector('#fullscreen-button'),
    gameMeta: document.querySelector('#game-meta'),
    gameName: document.querySelector('#game-name'),
    gameLibrary: document.querySelector('#game-library'),
    gameShelf: document.querySelector('#game-shelf'),
    idleScreen: document.querySelector('#idle-screen'),
    libraryLabel: document.querySelector('#library-label'),
    libraryStatus: document.querySelector('#library-status'),
    loadingScreen: document.querySelector('#loading-screen'),
    menuLabel: document.querySelector('#menu-label'),
    mobileActionPanel: document.querySelector('#mobile-action-panel'),
    mobileGameControls: document.querySelector('#mobile-game-controls'),
    mobileStick: document.querySelector('#mobile-stick'),
    mobileStickHandle: document.querySelector('#mobile-stick-handle'),
    powerLed: document.querySelector('#power-led'),
    returnToShelfButton: document.querySelector('#return-to-shelf-button'),
    retryButton: document.querySelector('#retry-button'),
    romDropCopy: document.querySelector('#rom-drop-copy'),
    romDropTitle: document.querySelector('#rom-drop-title'),
    romDropzone: document.querySelector('#rom-dropzone'),
    romInput: document.querySelector('#rom-input'),
    saveStatus: document.querySelector('#save-status'),
    screen: document.querySelector('#screen'),
    shelfDropOverlay: document.querySelector('#shelf-drop-overlay'),
    stateLibrary: document.querySelector('#state-library'),
    stateLibraryClose: document.querySelector('#state-library-close'),
    stateLibraryNote: document.querySelector('#state-library-note'),
    stateList: document.querySelector('#state-list'),
    systemLabel: document.querySelector('#system-label'),
    systemOptions: document.querySelectorAll('.system-option'),
    toolbar: document.querySelector('#toolbar'),
    workReminder: document.querySelector('#work-reminder'),
  };

  let romUrl = null;
  let emulatorLoader = null;
  let selectedSystem = 'fc';
  let storedGames = [];
  let playLimitTimer = null;
  let playStartedAt = 0;
  let playLimitDay = '';
  let dailyPlayedMs = 0;
  let playLocked = false;
  let playLimitDisabled = false;
  let unlockHoldTimer = null;
  let unlockSequenceArmed = false;
  let unlockSequenceIndex = 0;
  let unlockSequenceExpiresAt = 0;
  let libraryReady = Promise.resolve();
  let shelfDragDepth = 0;
  let draggedShelfGame = null;
  let activeStateGameId = null;
  let currentGameContext = null;
  const activeVirtualInputs = new Set();
  const activeKeyboardDirections = new Set();

  const setView = (view) => {
    elements.screen.classList.toggle('is-idle', view === 'idle');
    elements.idleScreen.hidden = view !== 'idle';
    elements.loadingScreen.hidden = view !== 'loading';
    elements.emulatorStage.hidden = view !== 'playing';
    elements.errorScreen.hidden = view !== 'error';
    elements.mobileGameControls.hidden = view !== 'playing';
  };

  const getExtension = (fileName) => {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : '';
  };

  const getGameName = (fileName) => fileName.replace(/\.[^.]+$/, '');

  const decodeRomText = (bytes) => new TextDecoder('ascii')
    .decode(bytes)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const readMegaDriveHeader = async (file) => {
    if (getExtension(file.name) !== 'smd') {
      return new Uint8Array(await file.slice(0, 0x200).arrayBuffer());
    }

    const interleaved = new Uint8Array(
      await file.slice(0x200, 0x200 + 0x4000).arrayBuffer(),
    );
    if (interleaved.length < 0x4000) return interleaved;

    const deinterleaved = new Uint8Array(0x4000);
    for (let index = 0; index < 0x2000; index += 1) {
      deinterleaved[index * 2] = interleaved[0x2000 + index];
      deinterleaved[index * 2 + 1] = interleaved[index];
    }
    return deinterleaved;
  };

  const parseRomMetadata = async (file, systemId) => {
    const fallbackTitle = getGameName(file.name).replace(/_/g, ' ').trim();

    if (systemId === 'md' && getExtension(file.name) !== 'zip') {
      const header = await readMegaDriveHeader(file);
      if (decodeRomText(header.slice(0x100, 0x110)).includes('SEGA')) {
        const domesticTitle = decodeRomText(header.slice(0x120, 0x150));
        const internationalTitle = decodeRomText(header.slice(0x150, 0x180));
        const serial = decodeRomText(header.slice(0x180, 0x18e));
        const regionCode = decodeRomText(header.slice(0x1f0, 0x200)).toUpperCase();
        const regions = [
          regionCode.includes('J') && '日本版',
          regionCode.includes('U') && '美版',
          regionCode.includes('E') && '欧版',
        ].filter(Boolean);

        return {
          title: internationalTitle || domesticTitle || fallbackTitle,
          edition: [...regions, serial].filter(Boolean).join(' · ') || 'MD 卡带',
        };
      }
    }

    if (systemId === 'gba' && getExtension(file.name) === 'gba') {
      const header = new Uint8Array(await file.slice(0xa0, 0xb0).arrayBuffer());
      const title = decodeRomText(header.slice(0, 12));
      const gameCode = decodeRomText(header.slice(12, 16));
      const regionNames = { E: '美版', J: '日本版', P: '欧版' };
      const region = regionNames[gameCode.at(-1)];
      return {
        title: title || fallbackTitle,
        edition: [region, gameCode].filter(Boolean).join(' · ') || 'GBA 卡带',
      };
    }

    return { title: fallbackTitle, edition: '浏览器收藏' };
  };

  const wrapCoverTitle = (context, title, maxWidth) => {
    const units = title.includes(' ') ? title.split(/\s+/) : [...title];
    const separator = title.includes(' ') ? ' ' : '';
    const lines = [];
    let line = '';
    units.forEach((unit) => {
      const candidate = line ? `${line}${separator}${unit}` : unit;
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = unit;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines.slice(0, 3);
  };

  const createGeneratedCoverUrl = (game, systemId) => {
    const palettes = {
      md: { background: '#11161f', accent: '#ef4965', secondary: '#28a2c9' },
      fc: { background: '#211b18', accent: '#f2cc3f', secondary: '#df435a' },
      gba: { background: '#151c24', accent: '#55c495', secondary: '#7987e8' },
    };
    const palette = palettes[systemId] || palettes.fc;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d');

    context.fillStyle = palette.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 0.22;
    context.strokeStyle = palette.secondary;
    context.lineWidth = 2;
    for (let x = -360; x < 760; x += 44) {
      context.beginPath();
      context.moveTo(x, 360);
      context.lineTo(x + 360, 0);
      context.stroke();
    }
    context.globalAlpha = 1;
    context.fillStyle = palette.accent;
    context.fillRect(0, 0, 22, 360);
    context.fillRect(44, 42, 118, 42);
    context.fillStyle = palette.background;
    context.font = '800 22px "JetBrains Mono", monospace';
    context.fillText(SYSTEMS[systemId].cartridgeLabel, 68, 71);

    context.fillStyle = '#f8f5e8';
    context.font = '800 47px "Plus Jakarta Sans", sans-serif';
    const titleLines = wrapCoverTitle(context, game.title.toUpperCase(), 530);
    titleLines.forEach((line, index) => context.fillText(line, 48, 145 + index * 54));

    context.fillStyle = palette.secondary;
    context.font = '600 18px "JetBrains Mono", monospace';
    context.fillText((game.edition || 'LOCAL ROM').toUpperCase().slice(0, 48), 48, 326);
    return canvas.toDataURL('image/jpeg', 0.86);
  };

  const validateRom = (file) => {
    if (!file) return '没有读取到游戏文件。';
    if (!SUPPORTED_EXTENSIONS.has(getExtension(file.name))) {
      return '请选择 MD、FC 或 GBA 游戏文件。';
    }
    if (file.size === 0) return '这个文件是空的。';
    if (file.size > MAX_ROM_SIZE) return '文件超过 64 MB，请确认它是支持的游戏 ROM。';
    return null;
  };

  const showError = (message) => {
    elements.errorMessage.textContent = message;
    elements.powerLed.classList.remove('is-on');
    elements.saveStatus.textContent = '启动失败';
    setView('error');
  };

  const cleanupRomUrl = () => {
    if (romUrl) {
      URL.revokeObjectURL(romUrl);
      romUrl = null;
    }
  };

  const getLocalDayKey = (date = new Date()) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  const isRestDay = (date = new Date()) => [0, 6].includes(date.getDay());

  const readDailyPlayTime = (day) => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAY_LIMIT_STORAGE_KEY));
      if (saved?.day !== day || !Number.isFinite(saved.playedMs)) return 0;
      return Math.max(0, Math.min(saved.playedMs, PLAY_LIMIT_MS));
    } catch {
      return 0;
    }
  };

  const writeDailyPlayTime = () => {
    try {
      localStorage.setItem(PLAY_LIMIT_STORAGE_KEY, JSON.stringify({
        day: playLimitDay,
        playedMs: Math.round(dailyPlayedMs),
      }));
    } catch {
      // The current session still keeps its limit when storage is unavailable.
    }
  };

  const readPlayLimitDisabled = () => {
    try {
      return localStorage.getItem(PLAY_LIMIT_BYPASS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  };

  const persistPlayLimitDisabled = () => {
    try {
      localStorage.setItem(PLAY_LIMIT_BYPASS_STORAGE_KEY, 'true');
    } catch {
      // The current session remains unlocked when storage is unavailable.
    }
  };

  const persistPlayProgress = (now = Date.now()) => {
    if (!playStartedAt) return;
    const currentDate = new Date(now);
    const currentDay = getLocalDayKey(currentDate);

    if (currentDay !== playLimitDay) {
      playLimitDay = currentDay;
      dailyPlayedMs = readDailyPlayTime(currentDay);
      playStartedAt = now;
      return;
    }

    if (!isRestDay(currentDate)) {
      dailyPlayedMs = Math.min(
        PLAY_LIMIT_MS,
        dailyPlayedMs + Math.max(0, now - playStartedAt),
      );
      writeDailyPlayTime();
    }
    playStartedAt = now;
  };

  const clearPlayLimit = () => {
    persistPlayProgress();
    if (playLimitTimer) window.clearInterval(playLimitTimer);
    playLimitTimer = null;
    playStartedAt = 0;
  };

  const lockGameForWork = () => {
    if (playLimitDisabled || playLocked || !playStartedAt) return;
    playLocked = true;
    releaseKeyboardDirections();
    clearPlayLimit();
    window.EJS_emulator?.pause?.(true);
    elements.screen.classList.add('is-play-locked');
    elements.workReminder.hidden = false;
    elements.saveStatus.textContent = '游戏时间已到 · 好好工作';
    elements.returnToShelfButton.focus();
  };

  const checkPlayLimit = () => {
    if (playLimitDisabled || playLocked || !playStartedAt) return;
    persistPlayProgress();
    if (!isRestDay() && dailyPlayedMs >= PLAY_LIMIT_MS) {
      lockGameForWork();
    }
  };

  const startPlayLimit = () => {
    clearPlayLimit();
    playLocked = false;
    elements.screen.classList.remove('is-play-locked');
    elements.workReminder.hidden = true;
    if (playLimitDisabled) {
      return { locked: false, limitDisabled: true };
    }
    const now = Date.now();
    const currentDate = new Date(now);
    playLimitDay = getLocalDayKey(currentDate);
    dailyPlayedMs = readDailyPlayTime(playLimitDay);
    playStartedAt = now;
    if (!isRestDay(currentDate) && dailyPlayedMs >= PLAY_LIMIT_MS) {
      lockGameForWork();
      return { locked: true, restDay: false, remainingMs: 0 };
    }
    playLimitTimer = window.setInterval(checkPlayLimit, PLAY_LIMIT_HEARTBEAT_MS);
    return {
      locked: false,
      restDay: isRestDay(currentDate),
      remainingMs: Math.max(0, PLAY_LIMIT_MS - dailyPlayedMs),
    };
  };

  const formatRemainingPlayTime = (milliseconds) => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const resetUnlockSequence = () => {
    unlockSequenceArmed = false;
    unlockSequenceIndex = 0;
    unlockSequenceExpiresAt = 0;
  };

  const disablePlayLimit = () => {
    playLimitDisabled = true;
    persistPlayLimitDisabled();
    clearPlayLimit();
    playLocked = false;
    elements.screen.classList.remove('is-play-locked');
    elements.workReminder.hidden = true;
    window.EJS_emulator?.pause?.(false);
    elements.saveStatus.textContent = '防沉迷模式已关闭 · 自动保存已开启';
    resetUnlockSequence();
  };

  const trackPlayLimitUnlock = (event) => {
    if (!(event instanceof KeyboardEvent) || !event.isTrusted || playLimitDisabled) return;
    const isSpaceKey = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';

    if (event.type === 'keyup' && isSpaceKey) {
      if (unlockHoldTimer) window.clearTimeout(unlockHoldTimer);
      unlockHoldTimer = null;
      return;
    }

    if (event.type !== 'keydown') return;
    if (isSpaceKey) {
      if (event.repeat || unlockHoldTimer) return;
      unlockHoldTimer = window.setTimeout(() => {
        unlockHoldTimer = null;
        unlockSequenceArmed = true;
        unlockSequenceIndex = 0;
        unlockSequenceExpiresAt = Date.now() + PLAY_LIMIT_UNLOCK_SEQUENCE_MS;
      }, PLAY_LIMIT_UNLOCK_HOLD_MS);
      return;
    }

    if (!unlockSequenceArmed || Date.now() > unlockSequenceExpiresAt || event.repeat) {
      if (unlockSequenceArmed) resetUnlockSequence();
      return;
    }

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!key || key === 'Unidentified') return;
    if (key !== PLAY_LIMIT_UNLOCK_SEQUENCE[unlockSequenceIndex]) {
      unlockSequenceIndex = key === PLAY_LIMIT_UNLOCK_SEQUENCE[0] ? 1 : 0;
      return;
    }

    unlockSequenceIndex += 1;
    if (unlockSequenceIndex === PLAY_LIMIT_UNLOCK_SEQUENCE.length) disablePlayLimit();
  };

  const blockLockedGameInput = (event) => {
    trackPlayLimitUnlock(event);
    const isUnlockHold = event instanceof KeyboardEvent
      && (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar');
    if (playLocked && isUnlockHold) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (playLocked && unlockSequenceArmed && event instanceof KeyboardEvent) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const targetsReminder = event.target instanceof Node
      && elements.workReminder.contains(event.target);
    if (!playLocked || targetsReminder) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const loadEmulatorScript = () => {
    if (emulatorLoader) emulatorLoader.remove();
    emulatorLoader = document.createElement('script');
    emulatorLoader.src = `${DATA_PATH}loader.js`;
    emulatorLoader.async = true;
    emulatorLoader.onerror = () => {
      showError('模拟器组件下载失败，请检查网络后重试。');
    };
    document.body.appendChild(emulatorLoader);
  };

  const getDefaultControls = (systemId) => {
    const keyboardBindings = systemId === 'md'
      ? KEYBOARD_BINDINGS.md
      : KEYBOARD_BINDINGS.standard;
    const playerOne = {};

    Object.entries(GAMEPAD_BINDINGS).forEach(([index, gamepadBinding]) => {
      playerOne[index] = {
        value: keyboardBindings[index],
        value2: gamepadBinding,
      };
    });

    return { 0: playerOne, 1: {}, 2: {}, 3: {} };
  };

  const setVirtualInput = (inputIndex, pressed) => {
    if (playLocked && pressed) return;
    const gameManager = window.EJS_emulator?.gameManager;
    if (!gameManager?.simulateInput) return;
    gameManager.simulateInput(0, Number(inputIndex), pressed ? 1 : 0);
  };

  const releaseKeyboardDirections = () => {
    activeKeyboardDirections.forEach((inputIndex) => setVirtualInput(inputIndex, false));
    activeKeyboardDirections.clear();
  };

  const focusEmulator = () => {
    window.requestAnimationFrame(() => {
      if (elements.emulatorStage.hidden || activeStateGameId) return;
      elements.emulatorStage.querySelector('.ejs_parent')?.focus({ preventScroll: true });
    });
  };

  const handleKeyboardDirection = (event) => {
    const inputIndex = KEYBOARD_DIRECTION_INPUTS[event.code];
    if (inputIndex === undefined) return;

    if (event.type === 'keyup' && activeKeyboardDirections.has(inputIndex)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activeKeyboardDirections.delete(inputIndex);
      setVirtualInput(inputIndex, false);
      return;
    }

    const targetAcceptsText = event.target instanceof HTMLElement
      && (event.target.matches('input, textarea, select') || event.target.isContentEditable);
    const gameCanReceiveInput = event.type === 'keydown'
      && !event.repeat
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey
      && !targetAcceptsText
      && !elements.emulatorStage.hidden
      && !activeStateGameId
      && !playLocked
      && window.EJS_emulator?.gameManager;
    if (!gameCanReceiveInput) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (activeKeyboardDirections.has(inputIndex)) return;
    activeKeyboardDirections.add(inputIndex);
    setVirtualInput(inputIndex, true);
  };

  const releaseVirtualInputs = () => {
    activeVirtualInputs.forEach((inputIndex) => setVirtualInput(inputIndex, false));
    activeVirtualInputs.clear();
  };

  const updateJoystick = (event) => {
    if (playLocked) return;
    const bounds = elements.mobileStick.getBoundingClientRect();
    const centerX = bounds.left + (bounds.width / 2);
    const centerY = bounds.top + (bounds.height / 2);
    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;
    const maxDistance = bounds.width * 0.28;
    const distance = Math.hypot(deltaX, deltaY);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    elements.mobileStickHandle.style.transform = `translate(${deltaX * scale}px, ${deltaY * scale}px)`;

    const nextInputs = new Set();
    const deadZone = bounds.width * 0.12;
    if (distance >= deadZone) {
      const normalizedX = deltaX / distance;
      const normalizedY = deltaY / distance;
      if (normalizedY < -0.38) nextInputs.add(4);
      if (normalizedY > 0.38) nextInputs.add(5);
      if (normalizedX < -0.38) nextInputs.add(6);
      if (normalizedX > 0.38) nextInputs.add(7);
    }

    activeVirtualInputs.forEach((inputIndex) => {
      if (!nextInputs.has(inputIndex)) setVirtualInput(inputIndex, false);
    });
    nextInputs.forEach((inputIndex) => {
      if (!activeVirtualInputs.has(inputIndex)) setVirtualInput(inputIndex, true);
    });
    activeVirtualInputs.clear();
    nextInputs.forEach((inputIndex) => activeVirtualInputs.add(inputIndex));
  };

  const resetJoystick = () => {
    releaseVirtualInputs();
    elements.mobileStickHandle.style.transform = 'translate(0, 0)';
  };

  const updateControlGuide = (systemId) => {
    const isMd = systemId === 'md';
    const keys = isMd ? ['J', 'K', 'L', 'U', 'I', 'O'] : ['J', 'K'];
    elements.actionLabel.textContent = isMd ? 'A B C / X Y Z' : 'A / B';
    elements.menuLabel.textContent = isMd ? '开始 / 模式' : '开始 / 选择';
    elements.actionKeyRow.replaceChildren(...keys.map((key) => {
      const keyElement = document.createElement('kbd');
      keyElement.textContent = key;
      return keyElement;
    }));
  };

  const openLibraryDatabase = () => new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = window.indexedDB.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LIBRARY_STORE_NAME)) {
        database.createObjectStore(LIBRARY_STORE_NAME, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STATE_STORE_NAME)) {
        const stateStore = database.createObjectStore(STATE_STORE_NAME, { keyPath: 'id' });
        stateStore.createIndex('gameId', 'gameId', { unique: false });
        stateStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const completeRequest = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const readStoredGames = async () => {
    const database = await openLibraryDatabase();
    try {
      const store = database.transaction(LIBRARY_STORE_NAME, 'readonly')
        .objectStore(LIBRARY_STORE_NAME);
      const games = await completeRequest(store.getAll());
      return games.sort((left, right) => right.addedAt - left.addedAt);
    } finally {
      database.close();
    }
  };

  const readGameStates = async (gameId) => {
    const database = await openLibraryDatabase();
    try {
      const store = database.transaction(STATE_STORE_NAME, 'readonly')
        .objectStore(STATE_STORE_NAME);
      const states = await completeRequest(store.index('gameId').getAll(gameId));
      return states.sort((left, right) => right.createdAt - left.createdAt);
    } finally {
      database.close();
    }
  };

  const putGameState = async (gameState) => {
    const database = await openLibraryDatabase();
    try {
      const store = database.transaction(STATE_STORE_NAME, 'readwrite')
        .objectStore(STATE_STORE_NAME);
      await completeRequest(store.put(gameState));
    } finally {
      database.close();
    }
  };

  const deleteGameState = async (stateId) => {
    const database = await openLibraryDatabase();
    try {
      const store = database.transaction(STATE_STORE_NAME, 'readwrite')
        .objectStore(STATE_STORE_NAME);
      await completeRequest(store.delete(stateId));
    } finally {
      database.close();
    }
  };

  const deleteStatesForGame = async (gameId) => {
    const states = await readGameStates(gameId);
    await Promise.all(states.map((gameState) => deleteGameState(gameState.id)));
  };

  const createStoredGameId = (file, systemId) => {
    const safeName = getGameName(file.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'rom';
    return `${systemId}-${safeName}-${file.size}-${file.lastModified}`;
  };

  const saveRomToLibrary = async (file, systemId) => {
    const metadata = await parseRomMetadata(file, systemId);
    const existingGame = storedGames.find(
      (storedGame) => storedGame.id === createStoredGameId(file, systemId),
    );
    const game = {
      id: createStoredGameId(file, systemId),
      systemId,
      title: metadata.title,
      edition: metadata.edition,
      fileName: file.name,
      rom: file,
      size: file.size,
      addedAt: Date.now(),
    };
    game.coverUrl = existingGame?.coverUrl || createGeneratedCoverUrl(game, systemId);
    game.coverSource = existingGame?.coverSource || 'generated';
    const database = await openLibraryDatabase();
    try {
      const store = database.transaction(LIBRARY_STORE_NAME, 'readwrite')
        .objectStore(LIBRARY_STORE_NAME);
      await completeRequest(store.put(game));
    } finally {
      database.close();
    }

    storedGames = [game, ...storedGames.filter((storedGame) => storedGame.id !== game.id)];
    navigator.storage?.persist?.().catch(() => {});
    return game;
  };

  const updateStoredGameCover = async (gameId, coverUrl) => {
    const game = storedGames.find((storedGame) => storedGame.id === gameId);
    if (!game) return;
    const updatedGame = { ...game, coverUrl, coverSource: 'gameplay' };
    const database = await openLibraryDatabase();
    try {
      const store = database.transaction(LIBRARY_STORE_NAME, 'readwrite')
        .objectStore(LIBRARY_STORE_NAME);
      await completeRequest(store.put(updatedGame));
    } finally {
      database.close();
    }
    storedGames = storedGames.map((storedGame) => (
      storedGame.id === gameId ? updatedGame : storedGame
    ));
    renderGameShelf(updatedGame.systemId);
  };

  const captureEmulatorImage = () => {
    const sourceCanvas = [...elements.emulatorStage.querySelectorAll('canvas')]
      .filter((canvas) => canvas.width > 0 && canvas.height > 0)
      .sort((left, right) => right.width * right.height - left.width * left.height)[0];
    if (!sourceCanvas) return null;

    try {
      const coverCanvas = document.createElement('canvas');
      coverCanvas.width = 640;
      coverCanvas.height = 360;
      const context = coverCanvas.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.fillStyle = '#090b0f';
      context.fillRect(0, 0, coverCanvas.width, coverCanvas.height);
      const scale = Math.min(
        coverCanvas.width / sourceCanvas.width,
        coverCanvas.height / sourceCanvas.height,
      );
      const width = sourceCanvas.width * scale;
      const height = sourceCanvas.height * scale;
      context.drawImage(
        sourceCanvas,
        (coverCanvas.width - width) / 2,
        (coverCanvas.height - height) / 2,
        width,
        height,
      );
      return coverCanvas.toDataURL('image/jpeg', 0.84);
    } catch {
      return null;
    }
  };

  const captureGameplayCover = async (gameId) => {
    if (!storedGames.some((game) => game.id === gameId)) return;
    const coverUrl = captureEmulatorImage();
    if (coverUrl) await updateStoredGameCover(gameId, coverUrl);
  };

  const formatStateTime = (timestamp) => new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));

  const hideEmulatorMenu = () => {
    elements.emulatorStage.querySelector('.ejs_menu_bar')
      ?.classList.add('ejs_menu_bar_hidden');
  };

  const closeStateLibrary = () => {
    elements.stateLibrary.hidden = true;
    activeStateGameId = null;
    window.EJS_emulator?.play?.(true);
    focusEmulator();
  };

  const loadBrowserState = (gameState) => {
    try {
      window.EJS_emulator.gameManager.loadState(new Uint8Array(gameState.state));
      elements.saveStatus.textContent = `已读取存档 · ${formatStateTime(gameState.createdAt)}`;
      window.EJS_emulator.displayMessage?.('已读取浏览器存档');
      closeStateLibrary();
    } catch {
      elements.stateLibraryNote.textContent = '读取失败，这个存档可能与当前游戏不匹配';
    }
  };

  const createStateItem = (gameState, index) => {
    const item = document.createElement('article');
    const loadButton = document.createElement('button');
    const preview = gameState.screenshot
      ? document.createElement('img')
      : document.createElement('span');
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    const time = document.createElement('small');
    const action = document.createElement('span');
    const deleteButton = document.createElement('button');

    item.className = 'state-item';
    loadButton.className = 'state-load-button';
    loadButton.type = 'button';
    loadButton.setAttribute('aria-label', `读取 ${formatStateTime(gameState.createdAt)} 的存档`);
    loadButton.addEventListener('click', () => loadBrowserState(gameState));

    preview.className = 'state-preview';
    if (gameState.screenshot) {
      preview.src = gameState.screenshot;
      preview.alt = '';
    } else {
      preview.textContent = SYSTEMS[gameState.systemId]?.cartridgeLabel || 'SAVE';
    }

    copy.className = 'state-item-copy';
    title.textContent = `即时存档 ${index + 1}`;
    time.textContent = `${gameState.title} · ${formatStateTime(gameState.createdAt)}`;
    action.className = 'state-load-label';
    action.textContent = '读取';
    copy.append(title, time);
    loadButton.append(preview, copy, action);

    deleteButton.className = 'state-delete-button';
    deleteButton.type = 'button';
    deleteButton.textContent = '×';
    deleteButton.setAttribute('aria-label', `删除 ${formatStateTime(gameState.createdAt)} 的存档`);
    deleteButton.addEventListener('click', async () => {
      await deleteGameState(gameState.id);
      await renderStateList(gameState.gameId);
    });

    item.append(loadButton, deleteButton);
    return item;
  };

  const renderStateList = async (gameId) => {
    const states = await readGameStates(gameId);
    if (states.length === 0) {
      const empty = document.createElement('div');
      const title = document.createElement('strong');
      const description = document.createElement('span');
      empty.className = 'state-list-empty';
      title.textContent = '还没有即时存档';
      description.textContent = '按 F5 保存当前进度';
      empty.append(title, description);
      elements.stateList.replaceChildren(empty);
    } else {
      elements.stateList.replaceChildren(
        ...states.map((gameState, index) => createStateItem(gameState, index)),
      );
    }
    elements.stateLibraryNote.textContent = `${states.length} / ${MAX_STATES_PER_GAME} 个存档 · 仅保存在当前浏览器`;
  };

  const openStateLibrary = async (gameId) => {
    activeStateGameId = gameId;
    releaseKeyboardDirections();
    hideEmulatorMenu();
    window.EJS_emulator?.pause?.(true);
    elements.stateLibrary.hidden = false;
    elements.stateList.replaceChildren();
    elements.stateLibraryNote.textContent = '正在读取存档…';
    try {
      await renderStateList(gameId);
      elements.stateList.querySelector('.state-load-button')?.focus();
    } catch {
      elements.stateLibraryNote.textContent = '存档列表读取失败';
    }
  };

  const saveBrowserState = async (state, gameContext) => {
    const createdAt = Date.now();
    const gameState = {
      id: `${gameContext.gameId}-${createdAt}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
      gameId: gameContext.gameId,
      systemId: gameContext.systemId,
      title: gameContext.title,
      createdAt,
      screenshot: captureEmulatorImage(),
      state: state instanceof Uint8Array ? state : new Uint8Array(state),
    };
    await putGameState(gameState);
    const states = await readGameStates(gameContext.gameId);
    await Promise.all(states.slice(MAX_STATES_PER_GAME).map((oldState) => (
      deleteGameState(oldState.id)
    )));
    hideEmulatorMenu();
    elements.saveStatus.textContent = `即时存档已保存 · ${formatStateTime(createdAt)}`;
    window.EJS_emulator?.displayMessage?.('即时存档已保存到浏览器');
  };

  const saveCurrentGameState = async () => {
    const gameManager = window.EJS_emulator?.gameManager;
    if (!gameManager || !currentGameContext) return;
    try {
      const state = gameManager.getState();
      await saveBrowserState(state, currentGameContext);
    } catch {
      elements.saveStatus.textContent = '即时存档保存失败';
      window.EJS_emulator?.displayMessage?.('即时存档保存失败');
    }
  };

  const deleteStoredGame = async (gameId) => {
    const game = storedGames.find((storedGame) => storedGame.id === gameId);
    const database = await openLibraryDatabase();
    try {
      const store = database.transaction(LIBRARY_STORE_NAME, 'readwrite')
        .objectStore(LIBRARY_STORE_NAME);
      await completeRequest(store.delete(gameId));
    } finally {
      database.close();
    }
    if (game) await deleteStatesForGame(`childhood-${game.systemId}-${game.id}`);
    storedGames = storedGames.filter((game) => game.id !== gameId);
  };

  const startShelfGame = (game, systemId) => {
    cleanupRomUrl();
    selectSystem(systemId);

    if (game.source === 'stored') {
      romUrl = URL.createObjectURL(game.rom);
    }
    const gameUrl = game.source === 'stored'
      ? romUrl
      : new URL(game.romUrl, window.location.href).href;

    setView('loading');
    elements.saveStatus.textContent = `正在加载 ${game.title}`;
    configureEmulator({
      fileName: game.fileName,
      displayName: game.title,
      saveName: game.id,
    }, systemId, gameUrl);
    loadEmulatorScript();
  };

  const createGameArtwork = (game, systemId) => {
    const cover = document.createElement('img');
    cover.src = game.coverUrl || createGeneratedCoverUrl(game, systemId);
    cover.alt = '';
    cover.loading = 'eager';
    return cover;
  };

  const createShelfItem = (game, systemId) => {
    const item = document.createElement('article');
    const playButton = document.createElement('button');
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    const edition = document.createElement('small');
    const playLabel = document.createElement('span');

    item.className = 'shelf-game';
    item.dataset.gameId = game.id;
    item.draggable = true;
    item.addEventListener('dragstart', (event) => {
      draggedShelfGame = { game, systemId };
      item.classList.add('is-being-dragged');
      event.dataTransfer.effectAllowed = 'link';
      event.dataTransfer.setData('text/plain', `azusa-game:${systemId}:${game.id}`);
      elements.romDropzone.classList.add('accepts-cartridge');
      elements.romDropTitle.textContent = '拖到这里插入卡带';
      elements.romDropCopy.textContent = '松开后直接启动游戏';
    });
    item.addEventListener('dragend', () => {
      draggedShelfGame = null;
      item.classList.remove('is-being-dragged');
      elements.romDropzone.classList.remove('accepts-cartridge', 'is-dragging');
      elements.romDropTitle.textContent = '选择本地 ROM';
      elements.romDropCopy.textContent = '或将文件拖到这里';
    });
    playButton.className = 'shelf-game-play';
    playButton.type = 'button';
    playButton.addEventListener('click', () => startShelfGame(game, systemId));
    copy.className = 'shelf-game-copy';
    title.textContent = game.title;
    edition.textContent = `${game.edition} · ${SYSTEMS[systemId].cartridgeLabel}`;
    playLabel.className = 'play-label';
    playLabel.textContent = '开玩';
    copy.append(title, edition, playLabel);
    playButton.append(createGameArtwork(game, systemId), copy);
    item.append(playButton);

    if (game.source === 'stored') {
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-game-button';
      removeButton.type = 'button';
      removeButton.title = `从陈列架移除 ${game.title}`;
      removeButton.setAttribute('aria-label', removeButton.title);
      removeButton.textContent = '×';
      removeButton.addEventListener('click', async () => {
        try {
          await deleteStoredGame(game.id);
          renderGameShelf(systemId);
          elements.libraryStatus.textContent = '已从此浏览器移除';
        } catch {
          elements.libraryStatus.textContent = '移除失败，请稍后重试';
        }
      });
      item.append(removeButton);
    }

    return item;
  };

  const renderGameShelf = (systemId) => {
    const builtInGames = (BUILT_IN_GAMES[systemId] || [])
      .map((game) => ({ ...game, source: 'built-in' }));
    const browserGames = storedGames
      .filter((game) => game.systemId === systemId)
      .map((game) => ({ ...game, source: 'stored' }));
    const games = [...builtInGames, ...browserGames];

    elements.libraryLabel.textContent = `${SYSTEMS[systemId].cartridgeLabel} 游戏陈列架`;
    elements.libraryStatus.textContent = browserGames.length > 0
      ? `${browserGames.length} 个浏览器收藏`
      : '拖入 ROM 自动收藏';

    if (games.length === 0) {
      const emptyState = document.createElement('div');
      const title = document.createElement('strong');
      const description = document.createElement('span');
      emptyState.className = 'shelf-empty';
      title.textContent = '陈列架还是空的';
      description.textContent = `把 ${SYSTEMS[systemId].cartridgeLabel} ROM 拖到上方`;
      emptyState.append(title, description);
      elements.gameShelf.replaceChildren(emptyState);
      return;
    }

    elements.gameShelf.replaceChildren(...games.map((game) => createShelfItem(game, systemId)));
  };

  const selectSystem = (systemId) => {
    if (!SYSTEMS[systemId]) return;
    selectedSystem = systemId;
    elements.systemLabel.textContent = SYSTEMS[systemId].label;
    elements.cartridgeLabel.textContent = SYSTEMS[systemId].cartridgeLabel;
    elements.mobileActionPanel.dataset.system = systemId;
    elements.mobileActionPanel.querySelector('.mobile-action-a').dataset.input = systemId === 'md' ? '1' : '8';
    updateControlGuide(systemId);
    renderGameShelf(systemId);
    elements.systemOptions.forEach((option) => {
      const isActive = option.dataset.system === systemId;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-pressed', String(isActive));
    });
  };

  const configureEmulator = (game, systemId, gameUrl) => {
    const gameName = getGameName(game.fileName);
    const displayName = game.displayName || gameName;
    const system = SYSTEMS[systemId];
    const stateGameId = `childhood-${systemId}-${game.saveName || gameName}`;
    currentGameContext = {
      gameId: stateGameId,
      systemId,
      title: displayName,
    };

    window.EJS_player = '#game';
    window.EJS_gameName = stateGameId;
    window.EJS_gameUrl = gameUrl;
    window.EJS_core = system.core;
    window.EJS_pathtodata = DATA_PATH;
    window.EJS_startOnLoaded = true;
    window.EJS_language = 'zh-CN';
    window.EJS_color = '#e4384f';
    window.EJS_defaultControls = getDefaultControls(systemId);
    window.EJS_defaultOptions = {
      'save-state-location': 'browser',
    };
    window.EJS_askBeforeExit = false;
    window.EJS_fixedSaveInterval = 10;
    window.EJS_cacheConfig = {
      enabled: true,
      cacheMaxSizeMB: 256,
      cacheMaxAgeMins: 43200,
    };
    window.EJS_onGameStart = () => {
      setView('playing');
      focusEmulator();
      const playSchedule = startPlayLimit();
      if (!playSchedule.locked) {
        elements.saveStatus.textContent = playSchedule.limitDisabled
          ? '防沉迷模式已关闭 · 自动保存已开启'
          : playSchedule.restDay
          ? '休息日 · 游戏时间不限 · 自动保存已开启'
          : `工作日 · 今日剩余 ${formatRemainingPlayTime(playSchedule.remainingMs)} · 自动保存已开启`;
      }
      if (game.saveName) {
        window.setTimeout(() => captureGameplayCover(game.saveName), 3500);
      }
    };
    window.EJS_onSaveSave = () => {
      const time = new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());
      elements.saveStatus.textContent = `存档已写入浏览器 · ${time}`;
    };
    window.EJS_onSaveState = ({ state }) => {
      saveBrowserState(state, currentGameContext).catch(() => {
        elements.saveStatus.textContent = '即时存档保存失败';
        window.EJS_emulator?.displayMessage?.('即时存档保存失败');
      });
    };
    window.EJS_onLoadState = () => {
      openStateLibrary(stateGameId);
    };
    window.EJS_onExit = () => {
      clearPlayLimit();
      currentGameContext = null;
      elements.saveStatus.textContent = '游戏已停止';
      elements.powerLed.classList.remove('is-on');
    };

    elements.gameName.textContent = `${system.cartridgeLabel} · ${displayName.toUpperCase()}`;
    elements.gameMeta.hidden = false;
    elements.toolbar.hidden = false;
    elements.powerLed.classList.add('is-on');
  };

  const importRom = async (file, { startAfterImport = false } = {}) => {
    const validationError = validateRom(file);
    if (validationError) {
      showError(validationError);
      return;
    }

    await libraryReady;

    const detectedSystem = EXTENSION_SYSTEMS[getExtension(file.name)];
    if (detectedSystem) selectSystem(detectedSystem);
    const gameSystem = selectedSystem;
    elements.libraryStatus.textContent = '正在解析卡带信息…';
    elements.saveStatus.textContent = '正在加入游戏陈列架';

    try {
      const game = await saveRomToLibrary(file, gameSystem);
      renderGameShelf(gameSystem);
      const newGame = elements.gameShelf.querySelector(
        `[data-game-id="${CSS.escape(game.id)}"]`,
      );
      newGame?.classList.add('is-new');
      newGame?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      newGame?.querySelector('.shelf-game-play')?.focus({ preventScroll: true });
      elements.libraryStatus.textContent = '新游戏已入架';
      elements.saveStatus.textContent = startAfterImport
        ? `${game.title} 已入架 · 正在启动`
        : `${game.title} 已加入 · 点击卡带开玩`;
      navigator.storage?.persist?.().catch(() => {});
      if (startAfterImport) {
        startShelfGame({ ...game, source: 'stored' }, gameSystem);
      }
    } catch {
      elements.libraryStatus.textContent = '收藏保存失败，请检查浏览器存储空间';
      if (startAfterImport) {
        startShelfGame({
          id: createStoredGameId(file, gameSystem),
          title: getGameName(file.name),
          fileName: file.name,
          rom: file,
          source: 'stored',
        }, gameSystem);
      } else {
        elements.saveStatus.textContent = 'ROM 未能加入陈列架';
      }
    } finally {
      elements.romInput.value = '';
    }
  };

  const initializeLibrary = async () => {
    try {
      storedGames = await readStoredGames();
      renderGameShelf(selectedSystem);
    } catch {
      elements.libraryStatus.textContent = '当前浏览器无法保存收藏';
    }
  };

  const selectAnotherGame = () => {
    if (window.EJS_emulator) {
      window.location.reload();
      return;
    }
    setView('idle');
    elements.romInput.value = '';
    elements.romInput.click();
  };

  elements.romInput.addEventListener('change', (event) => {
    importRom(event.target.files[0], { startAfterImport: true });
  });

  elements.systemOptions.forEach((option) => {
    option.addEventListener('click', () => selectSystem(option.dataset.system));
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    elements.romDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = draggedShelfGame ? 'link' : 'copy';
      elements.romDropzone.classList.add('is-dragging');
      if (draggedShelfGame) {
        elements.romDropTitle.textContent = '松开插入卡带';
        elements.romDropCopy.textContent = `启动 ${draggedShelfGame.game.title}`;
      }
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    elements.romDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.romDropzone.classList.remove('is-dragging');
      if (draggedShelfGame && eventName === 'dragleave') {
        elements.romDropTitle.textContent = '拖到这里插入卡带';
        elements.romDropCopy.textContent = '松开后直接启动游戏';
      }
    });
  });

  elements.romDropzone.addEventListener('drop', (event) => {
    if (draggedShelfGame) {
      const cartridge = draggedShelfGame;
      draggedShelfGame = null;
      elements.romDropzone.classList.remove('accepts-cartridge', 'is-dragging');
      elements.romDropTitle.textContent = '选择本地 ROM';
      elements.romDropCopy.textContent = '或将文件拖到这里';
      startShelfGame(cartridge.game, cartridge.systemId);
      return;
    }
    importRom(event.dataTransfer.files[0], { startAfterImport: true });
  });

  elements.gameLibrary.addEventListener('dragenter', (event) => {
    event.preventDefault();
    if (draggedShelfGame) return;
    shelfDragDepth += 1;
    elements.gameLibrary.classList.add('is-dragging');
  });

  elements.gameLibrary.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = draggedShelfGame ? 'none' : 'copy';
  });

  elements.gameLibrary.addEventListener('dragleave', (event) => {
    event.preventDefault();
    if (draggedShelfGame) return;
    shelfDragDepth = Math.max(0, shelfDragDepth - 1);
    if (shelfDragDepth === 0) elements.gameLibrary.classList.remove('is-dragging');
  });

  elements.gameLibrary.addEventListener('drop', (event) => {
    event.preventDefault();
    shelfDragDepth = 0;
    elements.gameLibrary.classList.remove('is-dragging');
    if (draggedShelfGame) return;
    importRom(event.dataTransfer.files[0]);
  });

  elements.fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await elements.consoleFrame.requestFullscreen();
      }
    } catch {
      elements.saveStatus.textContent = '当前浏览器不允许全屏';
    }
  });
  document.addEventListener('fullscreenchange', focusEmulator);

  elements.changeGameButton.addEventListener('click', selectAnotherGame);
  elements.retryButton.addEventListener('click', selectAnotherGame);
  elements.returnToShelfButton.addEventListener('click', () => window.location.reload());
  elements.stateLibraryClose.addEventListener('click', closeStateLibrary);
  elements.stateLibrary.addEventListener('click', (event) => {
    if (event.target === elements.stateLibrary) closeStateLibrary();
  });
  elements.mobileStick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    elements.mobileStick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  elements.mobileStick.addEventListener('pointermove', (event) => {
    if (!elements.mobileStick.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    updateJoystick(event);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((eventName) => {
    elements.mobileStick.addEventListener(eventName, resetJoystick);
  });
  elements.mobileActionPanel.querySelectorAll('button[data-input]').forEach((button) => {
    const releaseButton = () => {
      setVirtualInput(button.dataset.input, false);
      button.classList.remove('is-pressed');
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setVirtualInput(button.dataset.input, true);
      button.classList.add('is-pressed');
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((eventName) => {
      button.addEventListener(eventName, releaseButton);
    });
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeStateGameId) {
      event.preventDefault();
      closeStateLibrary();
      return;
    }

    if (!['F5', 'F8'].includes(event.key)) return;
    const gameIsRunning = !elements.emulatorStage.hidden
      && window.EJS_emulator?.gameManager
      && currentGameContext
      && !playLocked;
    if (!gameIsRunning) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;

    if (event.key === 'F5') {
      saveCurrentGameState();
      return;
    }
    if (!activeStateGameId) openStateLibrary(currentGameContext.gameId);
  });

  ['keydown', 'keyup'].forEach((eventName) => {
    window.addEventListener(eventName, blockLockedGameInput, true);
    window.addEventListener(eventName, handleKeyboardDirection, true);
  });
  ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchend', 'touchmove']
    .forEach((eventName) => {
      elements.screen.addEventListener(eventName, blockLockedGameInput, {
        capture: true,
        passive: false,
      });
    });
  window.addEventListener('focus', checkPlayLimit);
  window.addEventListener('blur', releaseKeyboardDirections);
  document.addEventListener('visibilitychange', () => {
    checkPlayLimit();
    if (document.hidden) releaseKeyboardDirections();
  });

  playLimitDisabled = readPlayLimitDisabled();
  selectSystem(selectedSystem);
  libraryReady = initializeLibrary();
  window.addEventListener('beforeunload', () => {
    clearPlayLimit();
    cleanupRomUrl();
  });
})();
