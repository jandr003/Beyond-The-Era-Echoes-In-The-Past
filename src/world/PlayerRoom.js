import { initDialogueBox } from './dialogueBox.js';

const OBSTACLES = [
  { name: 'table-center', left: 40, top: 45, right: 62, bottom: 68 },
  { name: 'bed', left: 5, top: 28, right: 27, bottom: 44 },
  { name: 'table-left', left: 2, top: 57, right: 19, bottom: 72 },
  { name: 'table-right', left: 77, top: 46, right: 98, bottom: 68 },
];


const NPC_POSITION = { xPercent: 62, yPercent: 60 };
const NPC_HALF_WIDTH = 4; 
const NPC_SIZE_PERCENT = 5; 

const NPC_BOUNDS = {
  name: 'npc',
  left: NPC_POSITION.xPercent - NPC_HALF_WIDTH,
  top: NPC_POSITION.yPercent - NPC_HALF_WIDTH,
  right: NPC_POSITION.xPercent + NPC_HALF_WIDTH,
  bottom: NPC_POSITION.yPercent + NPC_HALF_WIDTH,
};

const FLOOR_BOUNDS = {
  left: 2,
  top: 38,
  right: 98,
  bottom: 98,
};

const DEBUG_SHOW_COLLISION = false;

// Where the player appears on the full minimap image (%).
// left/top = top-left corner of the room.
// right/bottom = bottom-right corner.
const ROOM_MAP_REGION = { left: 30, top: 35, right: 42, bottom: 48 };

const TABLE_BOUNDS = OBSTACLES.find((o) => o.name === 'table-center');

const INTERACTION_MARGIN = 12;
const PLAYER_SPEED_PX = 240;

const SPRITE_FRAME_W = 118;
const SPRITE_FRAME_H = 164.5;
const SPRITE_FRAME_ASPECT = SPRITE_FRAME_H / SPRITE_FRAME_W;

const REVERSE_SIDE_WALK = false;
const SIDE_FRAME_MS = 100;

const BOB_AMPLITUDE_PX = 3.2;
const BOB_AMPLITUDE_SIDE_PX = 0;
const BOB_BOUNCES_PER_CYCLE = 2;

const FOOT_OFFSET_PERCENT = 82;

export function initPlayerRoom(stageEl, options = {}) {
  if (!stageEl) {
    throw new Error('initPlayerRoom: wala kang binigay na .stage element');
  }

const state = {
    x: options.startX ?? 20,
    y: options.startY ?? 75,
    facing: 'down',
    walking: false,
    keys: new Set(),
    lastTime: performance.now(),
    dialogueOpen: false,
  };

  const FRAME_COLS = 9;
  const FRAME_ROWS = 4;
  const DIRECTION_ROW = { up: 0, down: 1, left: 2, right: 3 };
  const FRAME_MS = 100;
  const IDLE_FRAME = 8;
  const WALK_FRAME_COUNT = 8;

  let currentFrame = 0;
  let frameTimer = 0;

  //Minimap dot (live tracking) 
  const mapDot = document.getElementById('mapPlayerDot');

  //Build player element
  const player = document.createElement('div');
  player.style.position = 'absolute';
  player.style.left = '0';
  player.style.top = '0';
  player.style.pointerEvents = 'none';
  player.style.zIndex = '5';
  player.style.willChange = 'transform';
  player.style.backfaceVisibility = 'hidden';

  let stageRect = stageEl.getBoundingClientRect();

  function syncPlayerSize() {
    const widthPercent = options.widthPercent ?? 6;
    const heightPx = (widthPercent / 100) * stageRect.width * SPRITE_FRAME_ASPECT;
    const heightPercent = stageRect.height > 0 ? (heightPx / stageRect.height) * 100 : 0;
    player.style.width = `${widthPercent}%`;
    player.style.height = `${heightPercent}%`;
  }

  syncPlayerSize();

  const resizeObserver = new ResizeObserver(() => {
    stageRect = stageEl.getBoundingClientRect();
    syncPlayerSize();
  });
  resizeObserver.observe(stageEl);

  if (options.spriteUrl) {
    player.style.backgroundImage = `url(${options.spriteUrl})`;
    player.style.backgroundSize = `${FRAME_COLS * 100}% ${FRAME_ROWS * 100}%`;
    player.style.backgroundRepeat = 'no-repeat';
  } else {
    player.style.background = 'rgba(255, 200, 120, 0.85)';
    player.style.border = '2px solid #7a3e12';
    player.style.borderRadius = '4px';
  }

  function updateSpriteFrame() {
    if (!options.spriteUrl) return;
    const row = DIRECTION_ROW[state.facing] ?? 1;
    const isSideDirection = state.facing === 'left' || state.facing === 'right';

    let col = state.walking ? currentFrame : IDLE_FRAME;

    if (state.walking && isSideDirection && REVERSE_SIDE_WALK) {
      col = (WALK_FRAME_COUNT - 1) - currentFrame;
    }

    const bgX = (col / (FRAME_COLS - 1)) * 100;
    const bgY = (row / (FRAME_ROWS - 1)) * 100;
    player.style.backgroundPosition = `${bgX}% ${bgY}%`;
  }

  stageEl.appendChild(player);

  //Build NPC element 
  const npc = document.createElement('div');
  npc.style.position = 'absolute';
  npc.style.left = `${NPC_POSITION.xPercent}%`;
  npc.style.top = `${NPC_POSITION.yPercent}%`;

  npc.style.width = `${NPC_SIZE_PERCENT}%`;
  npc.style.aspectRatio = `${SPRITE_FRAME_W} / ${SPRITE_FRAME_H}`;
  npc.style.transform = 'translate(-50%, -85%)';
  npc.style.zIndex = '4';
  npc.style.pointerEvents = 'none';

  if (options.npcSpriteUrl) {
    npc.style.backgroundImage = `url(${options.npcSpriteUrl})`;
    npc.style.backgroundSize = 'cover';
    npc.style.backgroundPosition = 'center';
  }

  stageEl.appendChild(npc);

  //Build Interact Prompt 
  const interactPrompt = document.createElement('div');
  interactPrompt.className = 'interact-prompt hidden';
  interactPrompt.innerHTML = `
    <span class="key-icon">E</span>
    <span class="interact-text">${options.npcInteractLabel ?? 'Talk to the Developer'}</span>
  `;
  interactPrompt.style.left = `${NPC_POSITION.xPercent + 3.7}%`;
  interactPrompt.style.top = `${NPC_POSITION.yPercent - NPC_SIZE_PERCENT * 1.3 + 5}%`;
  stageEl.appendChild(interactPrompt);

  if (DEBUG_SHOW_COLLISION) {
    function makeDebugBox(rect, color, label) {
      const box = document.createElement('div');
      box.style.position = 'absolute';
      box.style.left = `${rect.left}%`;
      box.style.top = `${rect.top}%`;
      box.style.width = `${rect.right - rect.left}%`;
      box.style.height = `${rect.bottom - rect.top}%`;
      box.style.background = `${color}`;
      box.style.border = `1px solid ${color.replace('0.25', '0.9')}`;
      box.style.boxSizing = 'border-box';
      box.style.zIndex = '999';
      box.style.pointerEvents = 'none';
      box.style.fontFamily = 'sans-serif';
      box.style.fontSize = '11px';
      box.style.color = '#fff';
      box.style.textShadow = '0 0 3px #000';
      box.textContent = label ?? '';
      stageEl.appendChild(box);
    }

    makeDebugBox(FLOOR_BOUNDS, 'rgba(80, 160, 255, 0.15)', 'FLOOR_BOUNDS');
    OBSTACLES.forEach((o) => makeDebugBox(o, 'rgba(255, 60, 60, 0.25)', o.name));
    makeDebugBox(NPC_BOUNDS, 'rgba(60, 255, 120, 0.25)', 'NPC_BOUNDS');
  }

  // Dialogue box: keep all settings in one place
  let dialogueController = null;

  function getDialogueController() {
    if (dialogueController) return dialogueController;
    try {
      dialogueController = initDialogueBox(stageEl, {
        npcName: options.npcName ?? 'John Andrew',
        npcTitle: options.npcTitle ?? 'Developer',
        npcLines: options.npcLines ?? [
          'Kumusta! Ako si John Andrew, ang developer ng game na ito.',
        ],
        npcPortraitUrl: options.npcPortraitUrl,
        npcChoices: options.npcChoices,
        onNpcChoiceSelect: options.onNpcChoiceSelect,
      });
    } catch (err) {
      console.error('[playerRoom] initDialogueBox failed:', err);
      dialogueController = null;
    }
    return dialogueController;
  }

  //Input handling 
  const MOVE_KEYS = new Set([
    'w', 'a', 's', 'd',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  ]);

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (MOVE_KEYS.has(k)) {
      state.keys.add(k);
      e.preventDefault();
    }
    if (k === 'e') tryInteract();
  }

  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (MOVE_KEYS.has(k)) {
      state.keys.delete(k);
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  try {
    window.focus();
  } catch (err) {
    //ignore
  }
  if (!document.body.hasAttribute('tabindex')) {
    document.body.setAttribute('tabindex', '-1');
  }
  const focusOnClick = () => {
    try {
      window.focus();
    } catch (err) {
      //ignore
    }
  };
  stageEl.addEventListener('click', focusOnClick);
  stageEl.addEventListener('pointerdown', focusOnClick);

  //Collision helper 
  function collidesWithObstacles(x, y) {
    return OBSTACLES.some(
      (o) => x > o.left && x < o.right && y > o.top && y < o.bottom
    );
  }

  function inInteractionZone(x, y) {
    return (
      x > NPC_BOUNDS.left - INTERACTION_MARGIN &&
      x < NPC_BOUNDS.right + INTERACTION_MARGIN &&
      y > NPC_BOUNDS.top - INTERACTION_MARGIN &&
      y < NPC_BOUNDS.bottom + INTERACTION_MARGIN
    );
  }

  function tryInteract() {
      const inZone = inInteractionZone(state.x, state.y);
      console.log('[interact] pos:', state.x.toFixed(1), state.y.toFixed(1), 'inZone:', inZone);

      if (!inZone) return;

      state.dialogueOpen = true;

      const controller = getDialogueController();
      if (controller && typeof controller.open === 'function') {
        controller.open();
      } else if (controller && typeof controller.show === 'function') {
        controller.show();
      } else {
        window.dispatchEvent(new CustomEvent('npc-interact'));
      }
    }

    function onDialogueClosed() {
      state.dialogueOpen = false;
    }

  window.addEventListener('dialogue-closed', onDialogueClosed);

  function getBobOffsetPx(activeFrameMs, isSideDirection) {
    if (!state.walking) return 0;
    const amplitude = isSideDirection ? BOB_AMPLITUDE_SIDE_PX : BOB_AMPLITUDE_PX;
    if (amplitude === 0) return 0;
    const cycleProgress = (currentFrame + frameTimer / activeFrameMs) / WALK_FRAME_COUNT;
    const wave = (1 - Math.cos(cycleProgress * Math.PI * 2 * BOB_BOUNCES_PER_CYCLE)) / 2;
    return wave * amplitude;
  }

  //Minimap dot updater
  function updateMapDot() {
    if (!mapDot) return;
    const mapX = ROOM_MAP_REGION.left + (state.x / 100) * (ROOM_MAP_REGION.right - ROOM_MAP_REGION.left);
    const mapY = ROOM_MAP_REGION.top + (state.y / 100) * (ROOM_MAP_REGION.bottom - ROOM_MAP_REGION.top);
    mapDot.style.left = `${mapX}%`;
    mapDot.style.top = `${mapY}%`;
  }

  // Set the dot to the correct starting position before the player moves,
  // so it does not appear in the wrong place while the room is loading.
  updateMapDot();

  //Main loop 
  function tick(now) {
    const dt = Math.min((now - state.lastTime) / 1000, 0.05);
    state.lastTime = now;

    if (stageRect.width === 0 || stageRect.height === 0) {
      stageRect = stageEl.getBoundingClientRect();
      requestAnimationFrame(tick);
      return;
    }

    let dx = 0;
    let dy = 0;
    if (state.keys.has('w') || state.keys.has('arrowup')) dy -= 1;
    if (state.keys.has('s') || state.keys.has('arrowdown')) dy += 1;
    if (state.keys.has('a') || state.keys.has('arrowleft')) dx -= 1;
    if (state.keys.has('d') || state.keys.has('arrowright')) dx += 1;

    const moving = dx !== 0 || dy !== 0;

    if (moving) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;

      const speedXPercent = (PLAYER_SPEED_PX / stageRect.width) * 100;
      const speedYPercent = (PLAYER_SPEED_PX / stageRect.height) * 100;

      const nextX = state.x + dx * speedXPercent * dt;
      const nextY = state.y + dy * speedYPercent * dt;

      const clampedX = Math.max(FLOOR_BOUNDS.left, Math.min(FLOOR_BOUNDS.right, nextX));
      const clampedY = Math.max(FLOOR_BOUNDS.top, Math.min(FLOOR_BOUNDS.bottom, nextY));

      const canMoveX = !collidesWithObstacles(clampedX, state.y);
      const canMoveY = !collidesWithObstacles(state.x, clampedY);

      if (canMoveX) state.x = clampedX;
      if (canMoveY) state.y = clampedY;

      if (Math.abs(dx) > Math.abs(dy)) {
        state.facing = dx > 0 ? 'right' : 'left';
      } else if (dy !== 0) {
        state.facing = dy > 0 ? 'down' : 'up';
      }
    }

    if (moving !== state.walking) {
      state.walking = moving;
      if (!state.walking) {
        currentFrame = 0;
        frameTimer = 0;
      }
    }

    const isSideDirection = state.facing === 'left' || state.facing === 'right';
    const activeFrameMs = isSideDirection ? SIDE_FRAME_MS : FRAME_MS;

    if (state.walking) {
      frameTimer += dt * 1000;
      if (frameTimer >= activeFrameMs) {
        frameTimer = 0;
        currentFrame = (currentFrame + 1) % WALK_FRAME_COUNT;
      }
    }

    updateSpriteFrame();
    const nearNPC = inInteractionZone(state.x, state.y);
    interactPrompt.classList.toggle('hidden', !nearNPC || state.dialogueOpen);

    const px = (state.x / 100) * stageRect.width;
    const py = (state.y / 100) * stageRect.height - getBobOffsetPx(activeFrameMs, isSideDirection);
    player.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -${FOOT_OFFSET_PERCENT}%)`;
    player.dataset.facing = state.facing;

    updateMapDot();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('dialogue-closed', onDialogueClosed);
    stageEl.removeEventListener('click', focusOnClick);
    stageEl.removeEventListener('pointerdown', focusOnClick);
    resizeObserver.disconnect();
    if (dialogueController && typeof dialogueController.destroy === 'function') {
      dialogueController.destroy();
    }
    dialogueController = null;
    player.remove();
    npc.remove();
    interactPrompt.remove();
  };
}