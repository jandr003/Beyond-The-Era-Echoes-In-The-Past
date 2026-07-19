import { LoadingScreen } from './LoadingScreen.js';
import { CharacterList } from './src/world/CharacterList.js';
import { CharacterConfirm } from './CharacterConfirm.js';

window.removeMenuVideoPermanently = function () {
  const mainMenu = document.getElementById('mainMenu');
  if (!mainMenu) return;
  const video = mainMenu.querySelector('video.menu-video');
  if (video) {
    const replacement = document.createElement('div');
    replacement.className = 'menu-video';
    replacement.style.position = 'absolute';
    replacement.style.inset = '0';
    replacement.style.width = '100%';
    replacement.style.height = '100%';
    replacement.style.background = '#14110d';
    video.replaceWith(replacement);
  }
};

(function () {
  if (document.getElementById('cs-safeguard-style')) return;
  const style = document.createElement('style');
  style.id = 'cs-safeguard-style';
  style.textContent = `
    body.cs-active #mainMenu,
    body.cs-active #mainMenu video,
    body.cs-active .menu-video,
    body.cs-active #loadingScreen,
    body.cs-active #loadingScreen video,
    body.cs-active .ls-video {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    body.cs-active #charSelectScreen {
      display: block !important;
    }
  `;
  document.head.appendChild(style);
})();

const ECHO_NAMES = {
  azure: 'Frozen Bloom',
  crimson: 'Ember Vow',
  flowerYellow: 'Golden Rite',
  medive: 'Verdant Oath',
  ribbon: 'Pale Thorn',
};

export class CharacterSelection {
  constructor(options = {}) {
    const characters = options.characters ?? CharacterSelection.DEFAULT_CHARACTERS;
    const echoOrder = ['azure', 'crimson', 'flowerYellow', 'medive', 'ribbon'];
    const orderedCharacters = echoOrder
      .map(echo => characters.find(character => character.echo === echo))
      .filter(Boolean);
    const orderedSet = new Set(orderedCharacters);
    const remainingCharacters = characters.filter(character => !orderedSet.has(character));

    this.characters = orderedCharacters.concat(remainingCharacters);
    this.onSelect   = options.onSelect ?? null;

    this.backgroundImage = options.backgroundImage ?? 'assets/ui/menu/THEFINALBACKGROUND.png';
    this.bannerSVG = options.bannerSVG ?? 'assets/ui/menu/banner-template-FROST.svg';

    this._bannerByEcho = options.bannerByEcho ?? {
      azure: 'assets/ui/menu/banner-template-FROST.svg',
      crimson: 'assets/ui/menu/banner-template-BLOOD.svg',
      flowerYellow: 'assets/ui/menu/banner-template-SUN.svg',
      medive: 'assets/ui/menu/banner-template-VERDANT.svg',
      ribbon:       'assets/ui/menu/banner-template-VOID.svg',
    };

    this._echoColors = {
      azure:        '#00B4E6',
      crimson:      '#E0102B',
      flowerYellow: '#FFC400',
      medive:       '#12944F',
      ribbon:       '#8A2BE2',
    };

    this._currentIndex = 0;
    this._locked       = false;
    this._container    = null;
    this._boundKey      = this._onKey.bind(this);
    this._isShowing     = false;
    this._sparkTimeout  = null;
    this._slots         = []; 
    this._nameElements  = []; // ✅ Track all name elements
  }

  show() {
    if (this._isShowing || this._container) return;
    this._isShowing = true;
    document.body.classList.add('cs-active');
    this._buildDOM();
    this._showUI();
    this._updateSelection(0); // ✅ set first banner as selected
  }

  destroy() {
    this._cleanup();
  }

  _buildDOM() {
    if (this._container) return;

    window.removeMenuVideoPermanently();

    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) {
      mainMenu.classList.add('is-hidden');
      mainMenu.style.display = 'none';
    }

    const el = document.createElement('div');
    el.id = 'charSelectScreen';
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = '10002';
    el.style.background = '#090410';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';

    const bannersHTML = this.characters.map((char, i) => {
      const accent = this._echoColors[char.echo] ?? '#8cc8ff';
      const bannerSrc = this._bannerByEcho[char.echo] ?? this.bannerSVG;
      return `
        <div class="cs-banner-doorway" data-index="${i}">
          <button type="button" class="cs-banner-slot" data-echo="${char.echo}" data-index="${i}" style="--accent-color:${accent};" aria-label="Select ${char.name || 'this echo'}">
            <img src="${bannerSrc}" alt="" class="cs-card-banner" />
            <svg class="cs-banner-spark" viewBox="0 0 200 420" aria-hidden="true">
              <path class="cs-spark-path cs-spark-path--1" d="M100 10 L80 90 L115 100 L70 200 L110 205 L60 330 L130 230 L95 222 L140 120 L105 112 Z" />
              <path class="cs-spark-path cs-spark-path--2" d="M100 10 L120 95 L88 102 L132 205 L92 210 L142 335 L72 235 L107 226 L62 122 L97 116 Z" />
            </svg>
          </button> 
          <p class="cs-banner-name" data-banner-index="${i}" data-offset="${i === 0 ? '10%' : i === 1 ? '12%' : '10%'}">
          ${char.name || ''}
          </p>
        </div>
      `;
    }).join('');

    el.innerHTML = `
      <div id="cs-bg-image" style="
        background-image:
          linear-gradient(180deg, rgba(9,4,16,0.55), rgba(9,4,16,0.78)),
          url('${this.backgroundImage}');
      ">
      </div>

      <div class="cs-ui" id="cs-ui" style="opacity:0; pointer-events:none;">
        <h1 class="cs-header">Which Echo Will You Follow?</h1>
        ${bannersHTML}
      </div>
    `;

    document.body.appendChild(el);
    this._container = el;

    const bgProbe = new Image();
    bgProbe.onload = () => console.log('[CharacterSelection] background image loaded OK:', this.backgroundImage, `(${bgProbe.naturalWidth}x${bgProbe.naturalHeight})`);
    bgProbe.onerror = () => console.error('[CharacterSelection] background image FAILED to load:', this.backgroundImage);
    bgProbe.src = this.backgroundImage;

    // ✅ Store all slots and name elements
    this._slots = Array.from(this._container.querySelectorAll('.cs-banner-slot'));
    this._nameElements = Array.from(this._container.querySelectorAll('.cs-banner-name'));

 
    // ✅ PAPALITAN MO NG GANITO:
    // ✅ Click + hover listeners
    this._slots.forEach((slot) => {
      slot.addEventListener('click', (e) => {
        const index = parseInt(slot.dataset.index, 10);
        if (!isNaN(index)) {
          if (index !== this._currentIndex) {
            // ← I-update lang ang selection, HUWAG pang magbukas
            this._updateSelection(index, true);
          }
          // ← Palaging magbukas pagka-click, selected man o hindi
          requestAnimationFrame(() => this._fireSpark(slot));
          setTimeout(() => this._openCurrentEcho(), 500);
        }
      });

      slot.addEventListener('mouseenter', () => {
        const index = parseInt(slot.dataset.index, 10);
        if (!isNaN(index) && index !== this._currentIndex) {
          this._updateSelection(index, false);
        }
      });
    });

  window.addEventListener('keydown', this._boundKey);
}

  _showUI() {
    if (!this._container) return;
    const ui = this._container.querySelector('#cs-ui');
    ui.style.transition = 'opacity 0.6s ease';
    setTimeout(() => {
      ui.style.opacity = '1';
    }, 400);
  }

  // ✅ UPDATE SELECTION - Manages which banner is selected + shows name
  _updateSelection(newIndex, fromClick = false) {
    if (newIndex < 0) newIndex = this.characters.length - 1;
    if (newIndex >= this.characters.length) newIndex = 0;
    this._currentIndex = newIndex;

    // ✅ Remove selected state from ALL banners + hide ALL names
    this._slots.forEach((slot, idx) => {
      slot.classList.remove('cs-banner-slot--selected');
    });

    this._nameElements.forEach((nameEl) => {
      nameEl.classList.remove('cs-name--visible');
    });

    // ✅ Add selected state to CURRENT banner + show CURRENT name
    const currentSlot = this._slots[this._currentIndex];
    if (currentSlot) {
      currentSlot.classList.add('cs-banner-slot--selected');
      
      // ✅ Show the name for this banner
      const currentName = this._nameElements[this._currentIndex];
      if (currentName) {
        currentName.classList.add('cs-name--visible');
      }

      if (fromClick) {
        this._fireSpark(currentSlot);
      }
    }
  }

  _fireSpark(slot) {
    const spark = slot.querySelector('.cs-banner-spark');
    if (!spark) return;

    spark.classList.remove('cs-banner-spark--active');

    // Sa halip na force reflow gamit offsetWidth (mabigat), gamitin
    // ang requestAnimationFrame nang dalawang beses -- ito rin ay
    // nagre-restart ng CSS animation pero hindi na nagfo-force ng
    // synchronous layout sa buong page.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        spark.classList.add('cs-banner-spark--active');
      });
    });

    clearTimeout(this._sparkTimeout);
    this._sparkTimeout = setTimeout(() => {
      spark.classList.remove('cs-banner-spark--active');
    }, 500);
  }

  _confirm() {
    if (this._locked) return;
    this._locked = true;

    const char = this.characters[this._currentIndex];
    setTimeout(() => {
      this._cleanup();
      if (this.onSelect) this.onSelect(char);
    }, 200);
  }

  _openCurrentEcho() {
    if (this._locked) return;
    const char = this.characters[this._currentIndex];
    if (!char) return;

    const echoName = ECHO_NAMES[char.echo];
    const accentColor = this._echoColors[char.echo] ?? '#8cc8ff';
    if (!echoName) return;

    // Itago lang ang screen, HUWAG i-destroy
    if (this._container) this._container.style.display = 'none';
    document.body.classList.remove('cs-active');

    const self = this;

    const cl = new CharacterList({
      echo:        char.echo,
      echoName:    echoName,
      accentColor: accentColor,
      onSelect(selectedChar) {
        const confirm = new CharacterConfirm({
          character:   selectedChar,
          echoName:    echoName,
          accentColor: accentColor,
          onComplete: () => {
            window.dispatchEvent(new CustomEvent('characterSelected', {
              detail: { char: selectedChar, echo: { name: echoName, color: accentColor } }
            }));
            cl._cleanup();     
            self._cleanup();    
          },
          onCancel: () => {
            const layout = cl._container ? cl._container.querySelector('.cl-layout') : null;
            if (layout) layout.style.visibility = 'visible';
            cl._locked = false;
            const card = cl._cards[cl._currentIdx ?? 0];
            if (card) card.classList.remove('cl-card--selected');
          }
        });
        confirm.play();
      },
      onBack() {
        if (self._container) {
          self._container.style.display = 'block';
          document.body.classList.add('cs-active');
        }
      },
    });
    cl.show();
  }

  // ✅ KEYBOARD HANDLER - LEFT/RIGHT/ENTER
  _onKey(e) {
    if (this._locked) return;
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this._updateSelection(this._currentIndex - 1, false);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this._updateSelection(this._currentIndex + 1, false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentSlot = this._slots[this._currentIndex];
      if (currentSlot) this._fireSpark(currentSlot);
      setTimeout(() => this._openCurrentEcho(), 200);
    }
  }

  _cleanup() {
    document.body.classList.remove('cs-active');
    this._isShowing = false;
    window.removeEventListener('keydown', this._boundKey);
    clearTimeout(this._sparkTimeout);
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
    this._slots = [];
    this._nameElements = [];
  }
}

CharacterSelection.DEFAULT_CHARACTERS = [
  { name: 'Frozen Bloom',    echo: 'azure' },
  { name: 'Burning Oath',    echo: 'crimson' },
  { name: 'Radiant Dawn',    echo: 'flowerYellow' },
  { name: 'Wildwood Heart',  echo: 'medive' },
  { name: 'Umbral Veil',     echo: 'ribbon' },
];

document.addEventListener('DOMContentLoaded', function() {
  var wraps = document.querySelectorAll('.es-banner-wrap');
  wraps.forEach(function(wrap) {
    wrap.addEventListener('click', function() {
      openCharacterList(wrap.dataset.echo);
    });
  });
});



