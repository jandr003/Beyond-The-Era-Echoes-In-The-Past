import { LoadingScreen } from '../LoadingScreen.js';
import { CharacterSelection } from '../CharacterSelection.js';
import { CharacterConfirm } from '../CharacterConfirm.js';
import { CharacterList } from './world/CharacterList.js';

(function () {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const miniMapCanvas = document.querySelector("#miniMapCanvas");
  const miniCtx = miniMapCanvas.getContext("2d");
  const mainMenu = document.querySelector("#mainMenu");
  const gameView = document.querySelector("#gameView");
  const menuVideo = document.querySelector(".menu-video");
  const optionsDialog = document.querySelector("#optionsDialog");
  const creditsDialog = document.querySelector("#creditsDialog");
  const exitDialog = document.querySelector("#exitDialog");
  const loadJourneyButton = document.querySelector("#loadJourneyButton");
  const backToMenuButton = document.querySelector("#backToMenuButton");

  menuVideo.loop = true;
  menuVideo.addEventListener("ended", () => {
    menuVideo.currentTime = 0;
    menuVideo.play().catch(() => {});
  });

  let gameStarted = false;
  let gameStarting = false; 
  let menuIndex = 0;
  let player = {
    x: 512,
    y: 384,
    speed: 4,
    direction: "down",
    lastMoveAt: 0,
    sprite: null
  };
  let gameLoopId = null;
  let screenFlashActive = false;
  let screenFlashTimer = null;

  ctx.imageSmoothingEnabled = false;
  miniCtx.imageSmoothingEnabled = false;

  function createImage(src) {
    if (!src) return null;
    const img = new Image();
    img.src = src;
    return img;
  }

  function loadCharacterSprite(character) {
    const config = character?.sprites;
    if (!config?.idle && !config?.walk) return null;

    return {
      frameWidth: config.frameWidth ?? 32,
      frameHeight: config.frameHeight ?? 32,
      idleFrames: config.idleFrames ?? 1,
      walkFrames: config.walkFrames ?? 1,
      rows: config.rows ?? { down: 0, right: 1, left: 1, up: 2 },
      scale: config.scale ?? 2,
      idleImage: createImage(config.idle),
      walkImage: createImage(config.walk ?? config.idle)
    };
  }


  function applyMenuFlash(btn) {
    if (!btn) return;
    btn.style.transition = "60ms ease";
    btn.style.color = "#ffe7b1";
    btn.style.transform = "translateX(4px) scale(0.96)";
    btn.style.textShadow =
      "2px 0 0 #163128, -2px 0 0 #163128, 0 2px 0 #163128, 0 -2px 0 #163128, 3px 3px 0 rgba(10,18,17,0.92)";
  }

  function removeMenuFlash(btn) {
    if (!btn) return;
    btn.style.color = "";
    btn.style.transform = "";
    btn.style.textShadow = "";
  }

  function getVisibleMenuButtons() {
    return Array.from(
      document.querySelectorAll(".menu-actions [data-action]:not(.is-hidden)")
    );
  }

  function setMenuSelection(index) {
    const buttons = getVisibleMenuButtons();
    if (!buttons.length) return;
    menuIndex = ((index % buttons.length) + buttons.length) % buttons.length;
    buttons.forEach((btn, i) => {
      btn.classList.toggle("selected", i === menuIndex);
    });
  }

  function focusMenuButton(index) {
    const buttons = getVisibleMenuButtons();
    if (!buttons.length) return;
    setMenuSelection(index);
    if (buttons[menuIndex]) buttons[menuIndex].focus({ preventScroll: true });
  }

  function triggerAction(action) {
    switch (action) {
      case "start": startGame(); break;
      case "load":
        if (!hasSaveData()) return;
        alert("Load Journey is ready once save data is available.");
        break;
      case "settings": openDialog(optionsDialog); break;
      case "credits": openDialog(creditsDialog); break;
      case "exit": openDialog(exitDialog); break;
    }
  }

  function flashThenAct(button, action) {
    if (!button) return;
    applyMenuFlash(button);
    setTimeout(() => {
      removeMenuFlash(button);
      triggerAction(action);
    }, 150);
  }

  function hasSaveData() {
    return Boolean(localStorage.getItem("beyondTheEraSave"));
  }

  function updateMainMenuButtons() {
    if (loadJourneyButton) {
      loadJourneyButton.classList.toggle("is-hidden", !hasSaveData());
    }
  }


function startGame() {
    if (gameStarting) return;   
    gameStarting = true;

    if (window.removeMenuVideoPermanently) {
      window.removeMenuVideoPermanently();
    }
    mainMenu.classList.add("is-hidden");
 
    const ls = new LoadingScreen({
      duration: 6500,
      statusMessages: [
        'Loading assets...',
        'Preparing world...',
        'Almost there...'
      ],
      onComplete: showCharacterSelection
    });
 
    ls.start();
  }

  function showCharacterSelection() {
    mainMenu.classList.add("is-hidden");

    const existing = document.getElementById('charSelectScreen');
    if (existing) existing.remove();

    const characterSelection = new CharacterSelection({
      onSelect: (character) => {
        openCharacterList(character.echo);
      }
    });

    characterSelection.show();
  }
  window.showCharacterSelection = showCharacterSelection;


  function openCharacterList(echoKey) {
    const meta = ECHO_META[echoKey];
    if (!meta) return;

    const cl = new CharacterList({
      echo:        echoKey,
      echoName:    meta.name,
      accentColor: meta.color,
      onSelect(char) {
        const confirm = new CharacterConfirm({
          character: char,
          echoName:  meta.name,
          onComplete: () => {
            window.dispatchEvent(new CustomEvent('characterSelected', {
              detail: { char, echo: meta }
            }));
          }
        });
        confirm.play();
      },
      onBack() {
        if (typeof showCharacterSelection === 'function') {
          showCharacterSelection();
        } else {
          console.error('showCharacterSelection() not found — check script load order.');
        }
      },
    });
    cl.show();
  }

  function playNarrativeIntro(char, accentColor = '#f0c060') {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: #000; color: #fff;
      display: flex; align-items: center; justify-content: center;
      text-align: center; font-family: inherit; z-index: 9999;
      opacity: 0; transition: opacity 1s ease;
    `;
    const textEl = document.createElement('div');
    textEl.style.cssText = `
      font-size: 1.5rem; max-width: 80%; line-height: 1.8;
      opacity: 0; transition: opacity 0.6s ease;
    `;

    overlay.appendChild(textEl);
    document.body.appendChild(overlay);


    requestAnimationFrame(() => { overlay.style.opacity = '1'; });

    const lines = [
          { text: 'In an age where memories fade...', wait: 2500 },
          { text: 'And kingdoms crumble beneath the passage of time...', wait: 3000 },
          { text: 'Only the Echoes remain.', wait: 2200 },
          { text: 'The chosen one has awakened...', wait: 2000 },
          { text: `<span style="color:${accentColor}; font-size:1.8rem; font-weight:bold;">${char.name}</span>\n<span style="color:#cfcfcf; font-size:1.1rem;">${char.title}</span>`, wait: 2500 },
          { text: 'May your journey uncover what time chose to forget.', wait: 3000 },
        ];

    let delay = 1000; 
        lines.forEach((line) => {
          setTimeout(() => {
            textEl.style.opacity = '0';
          }, delay - 400);

          setTimeout(() => {
            textEl.innerHTML = line.text.replace('\n', '<br>');
            textEl.style.opacity = '1';
          }, delay);

          delay += line.wait;
        });

    // Fade out to the tavern room.
    setTimeout(() => {
      overlay.style.opacity = '0';
    }, delay);

    setTimeout(() => {
      localStorage.setItem('selectedCharacter', JSON.stringify({
        id: char.id,
        spriteUrl: char.spriteUrl ?? null,
      }));
      window.location.href = 'assets/ui/menu/tavern_room_animated.html';
    }, delay + 1000);
  }

  window.addEventListener('characterSelected', (e) => {
      const { char, echo } = e.detail;
      playNarrativeIntro(char, echo.color);
    });

  function beginGameplay(character) {
    gameStarted = true;
    mainMenu.classList.add("is-hidden");
    gameView.classList.remove("is-hidden");
    player.x = 512;
    player.y = 384;
    player.direction = "down";
    player.lastMoveAt = 0;
    player.sprite = loadCharacterSprite(character);
    screenFlashActive = false;
    if (screenFlashTimer) clearTimeout(screenFlashTimer);
    stopGameLoop();
    gameLoop();

    if (character) {
      const statusName = document.querySelector(".status-copy strong");
      if (statusName) statusName.textContent = character.name;

      const portraitSlot = document.querySelector("#portraitSlot");
      if (portraitSlot) {
        portraitSlot.textContent = character.role || "Portrait";
      }
    }

    if (backToMenuButton) {
      backToMenuButton.tabIndex = -1;
      backToMenuButton.blur();
    }
  }

  function showMainMenu() {
    gameStarted = false;
    gameStarting = false;
    stopGameLoop();
    if (screenFlashTimer) clearTimeout(screenFlashTimer);
    screenFlashActive = false;
    gameView.classList.add("is-hidden");
    mainMenu.classList.remove("is-hidden");
    updateMainMenuButtons();

    if (backToMenuButton) backToMenuButton.tabIndex = 0;

    setTimeout(() => focusMenuButton(0), 60);
  }

  function openDialog(dialog) {
    dialog.showModal();
    const firstFocusable = dialog.querySelector("button");
    if (firstFocusable) {
      requestAnimationFrame(() => firstFocusable.focus({ preventScroll: true }));
    }
  }

  function onDialogClosed() {
    updateMainMenuButtons();
    setTimeout(() => {
      if (mainMenu.classList.contains("is-hidden")) return;
      focusMenuButton(0);
    }, 80);
  }

  [optionsDialog, creditsDialog, exitDialog].forEach((dialog) => {
    dialog.addEventListener("close", onDialogClosed);
    const closeBtn = dialog.querySelector("button");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        closeBtn.style.color = "#ffe7b1";
        closeBtn.style.transform = "translateY(2px) scale(0.97)";
        setTimeout(() => {
          closeBtn.style.color = "";
          closeBtn.style.transform = "";
          dialog.close();
        }, 150);
      });
      closeBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          closeBtn.style.color = "#ffe7b1";
          closeBtn.style.transform = "translateY(2px) scale(0.97)";
          setTimeout(() => {
            closeBtn.style.color = "";
            closeBtn.style.transform = "";
            dialog.close();
          }, 150);
        }
      });
    }
  });

  document.querySelectorAll(".menu-actions [data-action]").forEach((button) => {
    button.addEventListener("mouseenter", () => {
      const buttons = getVisibleMenuButtons();
      const index = buttons.indexOf(button);
      if (index !== -1) setMenuSelection(index);
    });
    button.addEventListener("focus", () => {
      const buttons = getVisibleMenuButtons();
      const index = buttons.indexOf(button);
      if (index !== -1) setMenuSelection(index);
    });
    button.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const buttons = getVisibleMenuButtons();
      const index = buttons.indexOf(button);
      if (index !== -1) setMenuSelection(index);
      button.focus({ preventScroll: true });
    });
    button.addEventListener("click", () => {
      flashThenAct(button, button.dataset.action);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (mainMenu.classList.contains("is-hidden")) return;
    if (optionsDialog.open || creditsDialog.open || exitDialog.open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      focusMenuButton(menuIndex + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusMenuButton(menuIndex - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const buttons = getVisibleMenuButtons();
      const button = buttons[menuIndex];
      if (button) flashThenAct(button, button.dataset.action);
    }
  });

  function drawFallbackPlayer() {
    ctx.fillStyle = screenFlashActive ? "#ffffff" : "#f6df9a";
    ctx.fillRect(player.x - 16, player.y - 16, 32, 32);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x - 16, player.y - 16, 32, 32);
  }

  function drawPlayerSprite(now) {
    const sprite = player.sprite;
    if (!sprite) return false;

    const isMoving = now - player.lastMoveAt < 140;
    const image = isMoving ? sprite.walkImage : sprite.idleImage;
    if (!image?.complete || image.naturalWidth <= 0) return false;

    const frameWidth = sprite.frameWidth;
    const frameHeight = sprite.frameHeight;
    const frameCount = isMoving ? sprite.walkFrames : sprite.idleFrames;
    const frame = Math.floor(now / (isMoving ? 90 : 180)) % frameCount;
    const row = sprite.rows[player.direction] ?? 0;
    const sx = frame * frameWidth;
    const sy = row * frameHeight;
    const drawWidth = frameWidth * sprite.scale;
    const drawHeight = frameHeight * sprite.scale;
    const dx = Math.round(player.x - drawWidth / 2);
    const dy = Math.round(player.y - drawHeight / 2);
    const mirrorLeft = player.direction === "left" && sprite.rows.left === sprite.rows.right;

    if (mirrorLeft) {
      ctx.save();
      ctx.translate(dx + drawWidth, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(image, sx, sy, frameWidth, frameHeight, 0, 0, drawWidth, drawHeight);
      ctx.restore();
      return true;
    }

    ctx.drawImage(image, sx, sy, frameWidth, frameHeight, dx, dy, drawWidth, drawHeight);
    return true;
  }

  function drawGame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a2e1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (screenFlashActive) {
      ctx.fillStyle = "rgba(255, 0, 0, 0.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (!drawPlayerSprite(now)) drawFallbackPlayer();

    miniCtx.clearRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);
    miniCtx.fillStyle = "#0a0f0a";
    miniCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);
    const sx = miniMapCanvas.width / canvas.width;
    const sy = miniMapCanvas.height / canvas.height;
    miniCtx.fillStyle = screenFlashActive ? "#fff" : "#f6df9a";
    miniCtx.fillRect(player.x * sx - 2, player.y * sy - 2, 4, 4);
  }

  function gameLoop() {
    if (!gameStarted) return;
    drawGame(performance.now());
    gameLoopId = requestAnimationFrame(gameLoop);
  }

  function stopGameLoop() {
    if (gameLoopId) {
      cancelAnimationFrame(gameLoopId);
      gameLoopId = null;
    }
  }

  window.addEventListener("keydown", (e) => {
    if (!gameStarted || gameView.classList.contains("is-hidden")) return;
    if (optionsDialog.open || creditsDialog.open || exitDialog.open) return;

    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      switch (e.key) {
        case "ArrowUp":
          player.direction = "up";
          player.y = Math.max(16, player.y - player.speed);
          break;
        case "ArrowDown":
          player.direction = "down";
          player.y = Math.min(canvas.height - 16, player.y + player.speed);
          break;
        case "ArrowLeft":
          player.direction = "left";
          player.x = Math.max(16, player.x - player.speed);
          break;
        case "ArrowRight":
          player.direction = "right";
          player.x = Math.min(canvas.width - 16, player.x + player.speed);
          break;
      }
      player.lastMoveAt = performance.now();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      screenFlashActive = true;
      if (screenFlashTimer) clearTimeout(screenFlashTimer);
      screenFlashTimer = setTimeout(() => { screenFlashActive = false; }, 1000);
    }
  });

  backToMenuButton.addEventListener("click", showMainMenu);

  updateMainMenuButtons();
  focusMenuButton(0);
})();

(function () {
  'use strict';

  const canvas = document.getElementById('butterflyCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let W = 0, H = 0;
  const PALETTES = [
    ['#a99bff', '#c8bbff'],
    ['#7fd8ff', '#aaeeff'],
    ['#b8aaff', '#7fd8ff'],
    ['#99ccff', '#d4aaff'],
  ];
  const PETAL_COLORS = [
    '#c4aaff', '#aad4ff', '#ffaad4', '#d4aaff', '#b8e0ff',
  ];

  function drawButterfly(cx, cy, size, flapT, colMain, colAcc, alpha, rot) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(cx), Math.round(cy));
    ctx.rotate(rot || 0);

    const p    = Math.max(1, Math.round(size / 8));
    const flap = Math.abs(Math.sin(flapT));

    const blk = (gx, gy, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(gx * p), Math.round(gy * p), p, p);
    };

    const upperPx  = [[1,-3],[2,-3],[3,-3],[1,-2],[2,-2],[3,-2],[4,-2],[1,-1],[2,-1],[3,-1],[4,-1],[5,-1]];
    const upperAcc = new Set(['2,-2','3,-2','2,-1']);
    const lowerPx  = [[1,0],[2,0],[3,0],[1,1],[2,1],[3,1],[1,2],[2,2]];
    const lowerAcc = new Set(['2,0','2,1']);

    const sU = 1 + flap * 0.40;
    const sL = 1 + flap * 0.20;

    [-1, 1].forEach(side => {
      upperPx.forEach(([gx, gy]) => {
        blk(side * Math.round(gx * sU), gy,
            upperAcc.has(`${gx},${gy}`) ? colAcc : colMain);
      });
      lowerPx.forEach(([gx, gy]) => {
        blk(side * Math.round(gx * sL), gy,
            lowerAcc.has(`${gx},${gy}`) ? colAcc : colMain);
      });
    });

    for (let by = -3; by <= 2; by++) blk(0, by, '#2a1540');

    ctx.restore();
  }

  function drawPetal(x, y, size, rot, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    const p   = Math.max(1, Math.round(size / 5));
    const pts = [[0,-2],[0,-1],[1,-1],[-1,-1],[0,0]];
    ctx.fillStyle = color;
    pts.forEach(([px, py]) =>
      ctx.fillRect(px * p - Math.floor(p / 2), py * p, p, p)
    );
    ctx.restore();
  }

  class Butterfly {
    constructor(init) { this.spawn(init); }

    spawn(init) {
      this.x  = Math.random() * W;
      this.y  = init
        ? Math.random() * H
        : (Math.random() < 0.5 ? -24 : H + 24);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.35 + Math.random() * 0.55;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;

      this.phase     = Math.random() * Math.PI * 2;
      this.flapSpeed = 0.10 + Math.random() * 0.08;
      this.size      = 14 + Math.random() * 10;
      this.alpha     = 0.65 + Math.random() * 0.35;

      const [cm, ca]  = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      this.colMain    = cm;
      this.colAcc     = ca;

      this.wander      = (Math.random() - 0.5) * 0.025;
      this.wanderTimer = 0;

      this.rot = Math.atan2(this.vy, this.vx) + Math.PI / 2;
    }

    update() {
      this.phase += this.flapSpeed;

      if (++this.wanderTimer > 60 + Math.random() * 120) {
        this.wander      = (Math.random() - 0.5) * 0.03;
        this.wanderTimer = 0;
      }

      this.vx = Math.max(-1.2, Math.min(1.2,
        this.vx * 0.99 + this.wander + (Math.random() - 0.5) * 0.03));
      this.vy = Math.max(-1.2, Math.min(1.2,
        this.vy * 0.99 + this.wander + (Math.random() - 0.5) * 0.03));

      this.x += this.vx;
      this.y += this.vy;

      const targetRot = Math.atan2(this.vy, this.vx) + Math.PI / 2;
      let diff = targetRot - this.rot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.rot += diff * 0.08;

      if (this.x < -32 || this.x > W + 32 ||
          this.y < -32 || this.y > H + 32) {
        this.spawn(false);
      }
    }

    draw() {
      drawButterfly(
        this.x, this.y,
        this.size, this.phase,
        this.colMain, this.colAcc,
        this.alpha, this.rot
      );
    }
  }

  class Petal {
    constructor() { this.reset(true); }

    reset(init) {
      this.x       = Math.random() * W;
      this.y       = init ? Math.random() * H : -12;
      this.vy      = 0.25 + Math.random() * 0.55;
      this.vx      = (Math.random() - 0.5) * 0.35;
      this.rot     = Math.random() * Math.PI * 2;
      this.rotV    = (Math.random() - 0.5) * 0.05;
      this.size    = 16 + Math.random() * 14;
      this.alpha   = 0.40 + Math.random() * 0.50;
      this.color   = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
      this.wobble  = Math.random() * Math.PI * 2;
      this.wobbleS = 0.018 + Math.random() * 0.018;
    }

    update() {
      this.wobble += this.wobbleS;
      this.x += this.vx + Math.sin(this.wobble) * 0.35;
      this.y += this.vy;
      this.rot += this.rotV;
      if (this.y > H + 16) this.reset(false);
    }

    draw() {
      drawPetal(this.x, this.y, this.size, this.rot, this.color, this.alpha);
    }
  }

  class Sparkle {
    constructor() { this.reset(); }

    reset() {
      this.x       = Math.random() * W;
      this.y       = Math.random() * H;
      this.life    = 0;
      this.maxLife = 50 + Math.random() * 80;
      this.size    = Math.random() < 0.5 ? 1 : 2;
      this.color   = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
    }

    update() {
      this.life++;
      if (this.life > this.maxLife) this.reset();
    }

    draw() {
      ctx.fillStyle   = this.color;
      ctx.globalAlpha = Math.sin(Math.PI * this.life / this.maxLife) * 0.65;
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
      ctx.globalAlpha = 1;
    }
  }

  const count = n => Math.max(Math.round(n * Math.min(W / 1280, 1)), Math.round(n * 0.4));

  let butterflies = [];
  let petals      = [];
  let sparkles    = [];

  function seed() {
    butterflies = Array.from({ length: count(10) }, () => new Butterfly(true));
    petals      = Array.from({ length: count(14) }, () => new Petal());
    sparkles    = Array.from({ length: count(22) }, () => new Sparkle());
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    sparkles.forEach(s => { s.update(); s.draw(); });
    petals.forEach(p   => { p.update(); p.draw(); });
    butterflies.forEach(b => { b.update(); b.draw(); });
    requestAnimationFrame(loop);
  }

  seed();

  const titleEl  = document.querySelector('.menu-title');
  const titleImg = titleEl ? titleEl.querySelector('img') : null;

  function resize() {
    if (!titleEl) return;
    const rect = titleEl.getBoundingClientRect();
    const w = rect.width  || window.innerWidth;
    const h = rect.height || window.innerHeight;
    if (w === W && h === H) return;
    W = canvas.width  = w;
    H = canvas.height = h;
    seed();
  }

  resize();
  window.addEventListener('resize', resize);

  if (titleImg) {
    if (titleImg.complete) {
      resize();
    } else {
      titleImg.addEventListener('load', resize);
    }
  }

  if (titleEl && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(titleEl);
  }

  loop();
})();
