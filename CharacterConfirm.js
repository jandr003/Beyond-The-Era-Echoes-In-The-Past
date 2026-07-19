
const ECHO_LINES = {
  "Ember Vow": "The ember has answered your vow.",
  "Frozen Bloom": "The frost has answered your call.",
  "Golden Rite": "The gold has answered your rite.",
  "Verdant Oath": "The verdant has answered your oath.",
  "Pale Thorn": "The thorn has answered your call.",
};

const DEFAULT_ECHO_LINE = "The echo has answered your call.";

export class CharacterConfirm {
  constructor({ character, echoName, accentColor, onComplete, onCancel, skippable = true }) {
    this.character = character;
    this.echoName = echoName;
    this.accentColor = accentColor || '#ff7060';
    this.onComplete = onComplete || (() => {});
    this.onCancel = onCancel || (() => {});
    this.skippable = skippable;

    this.overlay = null;
    this.timeouts = [];
    this._skipped = false;
  }



  play() {
    this._buildOverlay();
    document.body.appendChild(this.overlay);
    void this.overlay.offsetWidth;
    this.overlay.classList.add('is-visible');
  }

  skip() {
    if (this._skipped) return;
    this._skipped = true;
    this._clearTimeouts();
    this._finish();
  }


  _handleBegin() {
    this.confirmStep.classList.add('is-hiding');
    setTimeout(() => {
      this.confirmStep.style.display = 'none';
      this.cinematicStep.style.display = 'flex';
      void this.cinematicStep.offsetWidth;
      this._runSequence();
    }, 250);
  }

  _handleCancel() {
    this._clearTimeouts();
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.onCancel();
  }


  _runSequence() {
    const t = (fn, delay) => this.timeouts.push(setTimeout(fn, delay));

    const cardsRoot = document.querySelector('.character-list-root');
    if (cardsRoot) cardsRoot.classList.add('fade-out');

    t(() => { this.lineEcho.classList.add('is-visible'); }, 300);
    t(() => { this.lineName.classList.add('is-visible'); }, 300 + 800);
    t(() => { this.lineClosing.classList.add('is-visible'); }, 300 + 800 + 1500);
    t(() => { this.cinematicStep.classList.add('is-fading'); }, 300 + 800 + 1500 + 1800);
    t(() => { this._finish(); }, 300 + 800 + 1500 + 1800 + 800);
  }

  _finish() {
    this._clearTimeouts();
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    const cardsRoot = document.querySelector('.character-list-root');
    if (cardsRoot) cardsRoot.classList.remove('fade-out');

    this.onComplete();
  }

  _clearTimeouts() {
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
  }

  _buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'char-confirm-overlay';
    overlay.style.setProperty('--accent', this.accentColor);

    if (this.skippable) {
      overlay.addEventListener('click', (e) => {
        // huwag mag-skip kapag naka-click pa rin sa confirm step
        if (this.confirmStep.style.display !== 'none') return;
        this.skip();
      });
    }

    const echoLine = ECHO_LINES[this.echoName] || DEFAULT_ECHO_LINE;

    overlay.innerHTML = `
      <div class="char-confirm-step char-confirm-step--select" data-step="confirm">
        <span class="cl-corner cl-corner--tl"></span>
        <span class="cl-corner cl-corner--tr"></span>
        <span class="cl-corner cl-corner--bl"></span>
        <span class="cl-corner cl-corner--br"></span>
        
        <div class="char-confirm-echo-tag">${this.echoName || ''}</div>
        <div class="char-confirm-select-name">${this.character.name}</div>
        <div class="char-confirm-select-title">${this.character.title}</div>

        <p class="char-confirm-select-prompt">Begin your journey with this companion?</p>

        <div class="char-confirm-actions">
          <button class="char-confirm-btn char-confirm-btn--cancel" type="button">Back</button>
          <button class="char-confirm-btn char-confirm-btn--begin" type="button">Begin</button>
        </div>
      </div>

      <div class="char-confirm-step char-confirm-step--cinematic" data-step="cinematic" style="display:none;">
        <span class="cl-corner cl-corner--tl"></span>
        <span class="cl-corner cl-corner--tr"></span>
        <span class="cl-corner cl-corner--bl"></span>
        <span class="cl-corner cl-corner--br"></span>

        <div class="char-confirm-line char-confirm-echo">${echoLine}</div>
        <div class="char-confirm-line char-confirm-name">
          <span class="char-confirm-name-main">${this.character.name}</span>
          <span class="char-confirm-name-title">${this.character.title}</span>
        </div>
        <div class="char-confirm-line char-confirm-closing">will accompany your journey.</div>
        ${this.skippable ? '<div class="char-confirm-skip-hint">tap to skip</div>' : ''}
      </div>
    `;

    this.overlay = overlay;
    this.confirmStep = overlay.querySelector('.char-confirm-step--select');
    this.cinematicStep = overlay.querySelector('.char-confirm-step--cinematic');
    this.lineEcho = overlay.querySelector('.char-confirm-echo');
    this.lineName = overlay.querySelector('.char-confirm-name');
    this.lineClosing = overlay.querySelector('.char-confirm-closing');

    overlay.querySelector('.char-confirm-btn--begin').addEventListener('click', (e) => {
      e.stopPropagation();
      this._handleBegin();
    });
    overlay.querySelector('.char-confirm-btn--cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      this._handleCancel();
    });
  }
}


