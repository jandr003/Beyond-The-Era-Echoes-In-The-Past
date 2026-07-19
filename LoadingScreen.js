export class LoadingScreen {
  constructor(options = {}) {
    this.duration = options.duration ?? 6500;
    this.onComplete = options.onComplete ?? null;

    this.funFacts = [
      "Fun Fact: Frieren has more spells than most mages have friends.",
      "Fun Fact: Himmel died years ago and still has more screen presence than some living characters.",
      "Fun Fact: Fern can cast advanced magic and manage one overgrown elf at the same time.",
      "Fun Fact: Stark can kill monsters. Talking to Fern is still harder.",
      "Fun Fact: Heiter called himself corrupt. Everyone else called him a hero.",
      "Fun Fact: Eisen fears heights. Dragons? No problem.",
      "Fun Fact: Serie has enough magic to end wars. She chooses to argue instead.",
      "Fun Fact: Ubel's strategy is simple: I think I can. Somehow, it works.",
      "Fun Fact: Denken is what happens when a veteran refuses to retire.",
      "Fun Fact: Every mimic chest sees Frieren as free food.",
      "Tip: If Frieren wants to open a chest, keep your healing spells ready.",
      "Tip: Never make Fern repeat herself.",
      "Tip: A party without a warrior is brave. A party without a healer is stupid.",
      "Tip: Running away is also a strategy. Ask Stark.",
      "Tip: The best adventures are remembered long after they're over.",
      "Tip: Some spells save lives. Others clean statues.",
      "Tip: If an elf says it's been a while, ask how long before agreeing.",
      "Tip: Heroes defeat demon kings. Friends change lives.",
      "Tip: Check every corner. Frieren would.",
      "Tip: Treasure can wait. Mimics can't."
    ];

    this.overlay   = document.getElementById('loadingScreen');
    this.fill      = document.getElementById('ls-fill');
    this.statusEl  = document.getElementById('ls-status');
    this.percentEl = document.getElementById('ls-percent');
    this.oreEl     = document.getElementById('ls-ore');
    this.trackEl   = document.querySelector('.ls-bar-track');

    this._startTime = null;
    this._rafId     = null;
    this._resolve   = null;
    this._trackWidth = 0;
    this._oreWidth   = 0;
    this._animationFrameActive = false;
    this._lastTickTime = null;
    this._dimensionsDirty = true;
    this._factInterval = null;
    this._boundResize = this.handleResize.bind(this);
    this._boundKeyBlock = null;

    // All 5 echoes.
    // We no longer load a separate "awakened" (colored) PNG per echo.
    // Instead, each echo only loads ONE image (the dormant/outline PNG),
    // and the "awakened" colored look is generated in-code by tinting
    // that exact same image via canvas compositing (source-in).
    // This guarantees the colored layer is pixel-perfect identical in
    // shape to the outline layer — no more mismatched/misaligned PNGs.
    this._echoKeys = ['azure', 'crimson', 'flowerYellow', 'medive', 'ribbon'];

    // Color each echo awakens into. Tweak these hex values to taste.
    // Deeper / more saturated shades than before — these read as bold,
    // solid color instead of pastel/washed-out. Tweak freely.
    this._echoColors = {
      azure:        '#00B4E6', // blue snowflake
      crimson:      '#E0102B', // red dragon emblem
      flowerYellow: '#FFC400', // yellow tulip
      medive:       '#12944F', // green peacock
      ribbon:       '#8A2BE2', // purple lotus
    };

    this._echoImages = {};
    const fileNames = {
      azure:        'azure-echo-dormant.png',
      crimson:      'crimson-echo-dormant.png',
      flowerYellow: 'flowerYellow-dormant.png',
      medive:       'medive-echo-dormant.png',
      ribbon:       'ribbon-echo-dormant.png',
    };

    // Builds a tinted version of `img` using the given hex color.
    // source-in keeps only the pixels where `img` has alpha, and fills
    // them with `color` — so the result has EXACTLY the same silhouette
    // as the original dormant PNG.
    const buildTinted = (img, color) => {
      const c = document.createElement('canvas');
      c.width  = img.naturalWidth;
      c.height = img.naturalHeight;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      cx.globalCompositeOperation = 'source-in';
      cx.fillStyle = color;
      cx.fillRect(0, 0, c.width, c.height);
      cx.globalCompositeOperation = 'source-over';
      return c;
    };

    for (const key of this._echoKeys) {
      const dormant = new Image();
      this._echoImages[key] = { dormant, tinted: null };

      dormant.onload = () => {
        console.log(`[LoadingScreen] ${key} Dormant loaded OK`);
        this._echoImages[key].tinted = buildTinted(dormant, this._echoColors[key]);
      };
      dormant.onerror = () => console.error(`[LoadingScreen] FAILED to load ${key} Dormant`);
      dormant.src = `assets/images/${fileNames[key]}`;
    }

    // Keep legacy ref for backward compat (azure is first/default)
    this._dormantImage = this._echoImages.azure.dormant;
  }

  _logStack(label) {
    if (!this.overlay) return;
    const cs = getComputedStyle(this.overlay);
    console.log(
      `[LoadingScreen] ${label} → overlay z:`, cs.zIndex,
      '| bg:', cs.background,
      '| display:', cs.display,
      '| opacity:', cs.opacity
    );
  }

  _updateDimensions() {
    if (this.trackEl) this._trackWidth = this.trackEl.clientWidth;
    if (this.oreEl) this._oreWidth = this.oreEl.offsetWidth;
    this._dimensionsDirty = false;
  }

  _setOrePosition(pct) {
    if (!this.oreEl || !this.trackEl) return;
    if (this._trackWidth === 0 || this._oreWidth === 0) {
      this._updateDimensions();
    }
    const maxTranslate = this._trackWidth - this._oreWidth;
    const translateX = (pct / 100) * maxTranslate;
    this.oreEl.style.transform = `translateX(${translateX}px)`;
  }

  _showRandomFact() {
    const randomIndex = Math.floor(Math.random() * this.funFacts.length);
    this.statusEl.textContent = this.funFacts[randomIndex];
  }

  _startFactRotation() {
    if (this._factInterval) clearInterval(this._factInterval);
    this._showRandomFact();
    this._factInterval = setInterval(() => {
      if (this._animationFrameActive) {
        this._showRandomFact();
      } else {
        if (this._factInterval) clearInterval(this._factInterval);
      }
    }, 3000);
  }

  // ── NEW HELPER ──────────────────────────────────────────────────────────
  // Pauses + hides the .ls-video element itself (instead of relying on
  // overlay background color or canvas opacity to cover it). This is the
  // actual fix for the Image-2 flash: the video was always still playing
  // underneath the echo-icon canvas, and whenever that canvas became
  // transparent (start/end of its fade), the video would peek through.
  _hideLsVideo() {
    const lsVideo = this.overlay.querySelector('video.ls-video');
    if (lsVideo) {
      lsVideo.pause();
      lsVideo.style.display = 'none';
    }
  }

  _showLsVideo() {
    const lsVideo = this.overlay.querySelector('video.ls-video');
    if (lsVideo) {
      lsVideo.style.display = '';
      lsVideo.currentTime = 0;
      lsVideo.play().catch(() => {});
    }
  }

  start() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._updateDimensions();

      // Make sure the video is visible/playing again at the start of a
      // fresh loading sequence (in case a previous run hid it).
      this._showLsVideo();

      this._boundKeyBlock = (e) => {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      window.addEventListener('keydown', this._boundKeyBlock, true);

      this.overlay.classList.remove('is-hidden');
      this.fill.style.width = '0%';
      this.percentEl.textContent = '0%';
      this._startFactRotation();
      this._setOrePosition(0);

      this._startTime = performance.now();
      this._animationFrameActive = true;
      this._lastTickTime = null;
      window.addEventListener('resize', this._boundResize);
      this._tick();
    });
  }

  _tick() {
    if (!this._animationFrameActive) return;
    const now = performance.now();
    if (!this._lastTickTime) this._lastTickTime = now;
    if (now - this._lastTickTime < 33) {
      this._rafId = requestAnimationFrame(() => this._tick());
      return;
    }
    this._lastTickTime = now;

    const elapsed = now - this._startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    const pct = Math.round(progress * 100);

    if (this._dimensionsDirty) this._updateDimensions();
    this.fill.style.width = pct + '%';
    this.percentEl.textContent = pct + '%';
    this._setOrePosition(pct);

    if (progress < 1) {
      this._rafId = requestAnimationFrame(() => this._tick());
    } else {
      this._finish();
    }
  }

  _finish() {
    this._animationFrameActive = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._factInterval) clearInterval(this._factInterval);
    window.removeEventListener('resize', this._boundResize);

    this.fill.style.width = '100%';
    this.percentEl.textContent = '100%';
    this._setOrePosition(100);

    const barWrap = this.overlay.querySelector('.ls-bar-wrap');
    barWrap.style.display = 'none';

    this.statusEl.textContent = '';
    this.statusEl.style.display = 'none';

    if (document.getElementById('ls-begin-text')) return;

    const beginText = document.createElement('p');
    beginText.id = 'ls-begin-text';
    beginText.textContent = 'CLICK TO FOLLOW THE ECHOES';
    beginText.style.cssText = `
      color: #e8dfc8;
      font-family: "Press Start 2P", monospace;
      font-size: clamp(0.8rem, 2vw, 1.2rem);
      letter-spacing: 0.15em;
      text-shadow: 0 0 12px rgba(199,168,255,0.8), 0 2px 6px rgba(0,0,0,0.9);
      background: rgba(0, 0, 0, 0.75);
      padding: 0.8em 0;
      border-top: 1px solid rgba(199,168,255,0.3);
      border-bottom: 1px solid rgba(199,168,255,0.3);
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      bottom: 3%;
      margin: 0;
      width: 100vw;
      box-sizing: border-box;
      z-index: 9999;
      opacity: 0;
      transition: opacity 1.2s ease;
      pointer-events: auto;
    `;

    this.overlay.appendChild(beginText);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        beginText.style.opacity = '1';
        beginText.addEventListener('transitionend', () => {
          beginText.style.transition = '';
          beginText.style.animation = 'pulseBegin 1.8s ease-in-out infinite';
        }, { once: true });
      });
    });

    this.overlay.addEventListener('click', () => {
      if (this._transitionStarted) return;
      this._transitionStarted = true;

      if (this._boundKeyBlock) {
        window.removeEventListener('keydown', this._boundKeyBlock, true);
        this._boundKeyBlock = null;
      }

      beginText.style.animation = '';
      beginText.style.transition = 'opacity 0.4s ease';
      beginText.style.opacity = '0';

      const onTextFaded = () => {
        beginText.remove();
        this.statusEl.style.display = '';

        this.overlay.style.background = '#0a0614';
        this.overlay.style.zIndex = '9998';

        this._runTransitionSequence(barWrap);
      };

      beginText.addEventListener('transitionend', onTextFaded, { once: true });
      setTimeout(onTextFaded, 400);

    }, { once: true });
  }

  // Smooth transition sequence:
  //  - Phase A: canvas fades IN, all 5 echoes appear dormant (gray)
  //  - Phase B (ECHO_FILL_MS long, 5–8s range): all 5 echoes visible —
  //    staggered awakening L→R per echo; petals float
  //  - Phase C: everything fades out
  _runTransitionSequence(barWrap) {
    // ── FIX: video-flash bug ─────────────────────────────────────────────
    // Dati, ang .ls-video ay laging tumatakbo sa likod ng echo-icon canvas
    // sa buong transition — natatakpan lang habang opaque ang canvas.
    // Sa dulo ng Phase C (canvas fading OUT), bumababa ulit ang canvas
    // opacity pabalik sa 0 BAGO matanggal ang overlay — kaya saglit na
    // "sumisilip" ulit ang video sa pagitan (yan ang Image-2 flash).
    // Pina-pause + pinapatago na natin ang video element MISMO dito,
    // bago pa man magsimula ang animation, kaya walang frame kung
    // kailan pa ito magiging visible kahit gaano pa bumaba ang opacity
    // ng canvas sa itaas nito.
    this._hideLsVideo();

    const PETAL_COLORS = [
      '#c7a8ff','#a891f5','#7F77DD',
      '#b8d4f8','#e8dfc8','#d4b8f8','#8ab4e8',
      '#c8b4ff','#9d7ff5','#e0d0ff'
    ];
    const PETAL_COUNT = 45;
    const BG_COLOR    = '#0a0614';

    // ── Echo fill timing ──
    // This is the ONLY number you need to touch to control how long the
    // 5 dormant echoes take to fully awaken (left → right, staggered).
    // Keep it between 5000–8000ms per spec. 6500 = 6.5s.
    const ECHO_FILL_MS = 6500;

    // Fade-in / fade-out durations (ms) — kept the same feel as before,
    // just decoupled from the fill time so they don't fight for budget.
    const PHASE_A_MS = 584;   // canvas + echoes fading in
    const PHASE_C_MS = 964;  // everything fading out

    const DURATION      = PHASE_A_MS + ECHO_FILL_MS + PHASE_C_MS;
    const PHASE_B_START = PHASE_A_MS / DURATION;
    const PHASE_B_END   = (PHASE_A_MS + ECHO_FILL_MS) / DURATION;

    const easeInOut = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    const clamp01   = t => Math.min(Math.max(t, 0), 1);

    // ── Petal helpers ──
    function makePetals(W, H) {
      return Array.from({ length: PETAL_COUNT }, () => {
        const rand = Math.random();
        const edge = rand < 0.28 ? 0 : rand < 0.50 ? 2 : rand < 0.72 ? 1 : 3;
        let baseX, baseY;
        const depth = Math.random() * 0.10;
        if (edge === 0) {
          baseX = Math.random() * W;
          baseY = depth * H;
        } else if (edge === 1) {
          baseX = Math.random() * W;
          baseY = H - (0.08 + Math.random() * 0.10) * H;
        } else if (edge === 2) {
          baseX = depth * W;
          baseY = Math.random() * H;
        } else {
          baseX = W - depth * W;
          baseY = Math.random() * H;
        }
        return {
          baseX,
          baseY,
          size:     6 + Math.random() * 16,
          color:    PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
          ampX:     8 + Math.random() * 12,
          ampY:     8 + Math.random() * 12,
          freqX:    0.3 + Math.random() * 0.6,
          freqY:    0.3 + Math.random() * 0.6,
          phaseX:   Math.random() * Math.PI * 2,
          phaseY:   Math.random() * Math.PI * 2,
          rot:      Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.15,
          phase:    Math.random(),
        };
      });
    }

    function drawPetals(ctx, petals, t) {
      let envelope;
      if (t < PHASE_B_START) {
        envelope = easeInOut(t / PHASE_B_START);
      } else if (t < PHASE_B_END) {
        envelope = 1;
      } else {
        envelope = 1 - easeInOut((t - PHASE_B_END) / (1 - PHASE_B_END));
      }

      petals.forEach(p => {
        const localT = clamp01(t - p.phase * 0.05);
        const px = p.baseX + Math.sin(localT * Math.PI * 2 * p.freqX + p.phaseX) * p.ampX;
        const py = p.baseY + Math.cos(localT * Math.PI * 2 * p.freqY + p.phaseY) * p.ampY;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rot + p.rotSpeed * localT * 80);
        ctx.globalAlpha = envelope * 0.95;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    }

    // ── Aspect-ratio-preserving fit helper ──
    // Forcing every icon into a hard size×size square stretches/squishes
    // each PNG differently depending on its real width/height ratio. This
    // computes a centered, proportional draw rect instead.
    function fitRect(img, x, y, size) {
      const nw = img.naturalWidth  || size;
      const nh = img.naturalHeight || size;
      const ratio = nw / nh;
      let dw, dh;
      if (ratio >= 1) {
        dw = size;
        dh = size / ratio;
      } else {
        dh = size;
        dw = size * ratio;
      }
      return {
        dx: x + (size - dw) / 2,
        dy: y + (size - dh) / 2,
        dw,
        dh,
      };
    }

    // ── All 5 Echo icons — horizontally centered, staggered awakening ──
    const echoKeys   = this._echoKeys;
    const echoImages = this._echoImages;

    // Stagger config: each echo starts awakening at a different point
    // within Phase B (PHASE_B_START → PHASE_B_END, which now spans
    // ECHO_FILL_MS real ms). Echo 0 starts first, echo 4 starts last.
    const PHASE_B_LEN = PHASE_B_END - PHASE_B_START;

    // Each echo awakens one by one within Phase B
    // fillDuration: how long ONE echo takes to fully fill (short and snappy)
    // staggerStep: delay between each echo's awakening start
    const fillDuration = PHASE_B_LEN * 0.25;                        // each echo fills in 25% of Phase B
    const staggerStep  = (PHASE_B_LEN - fillDuration) / (echoKeys.length - 1); // evenly space all 5

    function drawAllEchoes(ctx, W, H, t) {
      // Overall alpha envelope (same for all echoes as a group)
      let groupAlpha;
      if (t < PHASE_B_START) {
        groupAlpha = easeInOut(t / PHASE_B_START);
      } else if (t < PHASE_B_END) {
        groupAlpha = 1;
      } else {
        groupAlpha = 1 - easeInOut((t - PHASE_B_END) / (1 - PHASE_B_END));
      }
      if (groupAlpha <= 0.01) return;

      const COUNT   = echoKeys.length; // 5
      const size    = Math.min(W, H) * 0.11;   // bounding slot size, smaller so all 5 fit
      const gap     = size * 0.35;              // gap between each icon
      const totalW  = COUNT * size + (COUNT - 1) * gap;
      const startX  = W / 2 - totalW / 2;
      const centerY = H / 2 - size / 2;

      for (let i = 0; i < COUNT; i++) {
        const key     = echoKeys[i];
        const imgs    = echoImages[key];
        const x       = startX + i * (size + gap);
        const y       = centerY;

        // Per-echo fill progress — staggered start within Phase B
        const echoFillStart = PHASE_B_START + staggerStep * i;
        const echoFillEnd   = echoFillStart + fillDuration;
        let fillProgress;
        if (t < echoFillStart) {
          fillProgress = 0;
        } else if (t > echoFillEnd) {
          fillProgress = 1;
        } else {
          fillProgress = easeInOut(clamp01((t - echoFillStart) / fillDuration));
        }

        ctx.save();
        ctx.globalAlpha = groupAlpha;

        // Layer 1: Dormant (outline) — always drawn, aspect-ratio preserved.
        let dormantRect = null;
        if (imgs.dormant.complete && imgs.dormant.naturalWidth > 0) {
          dormantRect = fitRect(imgs.dormant, x, y, size);
          ctx.drawImage(imgs.dormant, dormantRect.dx, dormantRect.dy, dormantRect.dw, dormantRect.dh);
        }

        // Layer 2: Awakened (tinted) — revealed left-to-right per echo.
        // `imgs.tinted` is a canvas built from imgs.dormant itself (source-in
        // tint), so it has the EXACT same pixel silhouette as the outline.
        // We reuse `dormantRect` for both layers, so there is zero chance of
        // misalignment between outline and color anymore.
        if (imgs.tinted && dormantRect && fillProgress > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(dormantRect.dx, dormantRect.dy, dormantRect.dw * fillProgress, dormantRect.dh);
          ctx.clip();
          // Boost saturation/contrast so the awakened color reads bold and
          // solid instead of thin/washed-out. Raise the percentages further
          // if you want it even more intense.
          ctx.filter = 'saturate(180%) contrast(115%) brightness(106%)';
          ctx.drawImage(imgs.tinted, dormantRect.dx, dormantRect.dy, dormantRect.dw, dormantRect.dh);
          ctx.restore();
        }

        ctx.restore();
      }
    }

    // ── Canvas ──
    const canvas  = document.createElement('canvas');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10001;
      pointer-events: none;
      opacity: 0;
      transition: none;
    `;
    document.body.appendChild(canvas);

    const ctx    = canvas.getContext('2d');
    const W      = canvas.width;
    const H      = canvas.height;
    const petals = makePetals(W, H);

    this.overlay.style.background = BG_COLOR;
    this.overlay.style.zIndex     = '9998';

    // ── Animation ──
    const startTime = performance.now();

    const tick = (now) => {
      const t = clamp01((now - startTime) / DURATION);

      let canvasAlpha;
      if (t < PHASE_B_START) {
        canvasAlpha = easeInOut(t / PHASE_B_START);
      } else if (t < PHASE_B_END) {
        canvasAlpha = 1;
      } else {
        canvasAlpha = 1 - easeInOut((t - PHASE_B_END) / (1 - PHASE_B_END));
      }

      canvas.style.opacity = canvasAlpha;

      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.fillStyle   = BG_COLOR;
      ctx.fillRect(0, 0, W, H);

      // All 5 Echo icons sa center
      drawAllEchoes(ctx, W, H, t);

      // Petals sa edges
      drawPetals(ctx, petals, t);


      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        canvas.remove();

        this.overlay.style.transition = 'none';
        this.overlay.style.display    = 'none';
        this.overlay.classList.add('is-hidden');
        this.overlay.classList.remove('ls-fade-out');
        this.overlay.style.background = '';
        this.overlay.style.zIndex     = '';

        if (barWrap) barWrap.style.display = 'flex';

        requestAnimationFrame(() => {
          this.overlay.style.display    = '';
          this.overlay.style.transition = '';
          this._transitionStarted = false;
        });

        if (this.onComplete) this.onComplete();
        if (this._resolve) this._resolve();
      }
    };

    requestAnimationFrame(tick);
  }

  reset() {
    this._animationFrameActive = false;
    this._transitionStarted = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._factInterval) clearInterval(this._factInterval);
    window.removeEventListener('resize', this._boundResize);

    if (this._boundKeyBlock) {
      window.removeEventListener('keydown', this._boundKeyBlock, true);
      this._boundKeyBlock = null;
    }
    this.overlay.classList.add('is-hidden');
    this.overlay.classList.remove('ls-fade-out');
    this.overlay.style.background = '';
    this.overlay.style.zIndex = '';
    this.fill.style.width = '0%';
    this.percentEl.textContent = '0%';
    this._setOrePosition(0);
    this._startTime = null;
    this._trackWidth = 0;
    this._oreWidth = 0;
    this._lastTickTime = null;
    this._dimensionsDirty = true;

    const barWrap = this.overlay.querySelector('.ls-bar-wrap');
    if (barWrap) barWrap.style.display = 'flex';

    const existing = document.getElementById('ls-begin-text');
    if (existing) existing.remove();

    const existingSymbols = document.getElementById('ls-symbols-container');
    if (existingSymbols) existingSymbols.remove();

    const existingWhite = document.getElementById('ls-white-screen');
    if (existingWhite) existingWhite.remove();

    const existingRadial = document.getElementById('ls-radial-overlay');
    if (existingRadial) existingRadial.remove();

    this.statusEl.style.display = '';
    this.statusEl.textContent = '';

    // Restore video visibility/playback for next time the loading
    // screen is used (e.g. returning to main menu and starting again).
    this._showLsVideo();
  }

  handleResize() {
    this._dimensionsDirty = true;
  }
}

window.LoadingScreen = LoadingScreen;