  // ══ Echo metadata ══
  const ECHO_META = {
    azure:       { name: 'Frozen Bloom',  color: '#8cc8ff' },
    crimson:     { name: 'Ember Vow',     color: '#ff7060' },
    flowerYellow:{ name: 'Golden Rite',   color: '#f0c060' },
    medive:      { name: 'Verdant Oath',  color: '#60e090' },
    ribbon:      { name: 'Pale Thorn',    color: '#c880ff' },
  };

  // ══ CharacterList class ══
  export class CharacterList {

    constructor(options = {}) {
      this.echo        = options.echo        ?? null;
      this.echoName    = options.echoName    ?? '';
      this.accentColor = options.accentColor ?? '#8cc8ff';
      this.onSelect    = options.onSelect    ?? null;
      this.onBack      = options.onBack      ?? null;
      this._container  = null;
      this._boundKey   = (e) => this._onKey(e);
      this._boundKeyUp = (e) => this._onKeyUp(e);
      this._currentIdx = 0;
      this._cards      = [];
      this._locked     = false;
      this._scrollRAF  = null;
      this._navInterval = null;
      this._navHeldKey  = null;
    }

    // Single source of truth for hydrating inline SVGs (e.g. Aura).
    // Parses the fetched text safely, keeps only the <svg> element,
    // strips any embedded <script> tags (we drive animation ourselves
    // from _startBreatheForWrap, not from whatever script shipped
    // inside the source file), and sizes it to fill its wrapper.
    //
    // IMPORTANT: hindi na direkta dito nire-reveal (opacity/cl-loading)
    // ang card. Nagma-mark na lang siya via dataset.hydrated = '1' at
    // si _revealPreviewsCoordinated() na ang bahalang mag-reveal, kasabay
    // ng iframe-based cards, para consistent yung timing ng lahat.
    //
    // PERF: dito rin natin ini-cache ang mga SVG parts (torso groups,
    // iris groups, eyelids) sa wrap._svgParts, isang beses lang, para
    // hindi na kailangan mag-querySelectorAll kada focus change
    // (dati ito ang pinaka-mabigat na sanhi ng "lag" pag mabilis kang
    // gumagalaw gamit arrow keys / mouse).
    _hydrateSVGs() {
      if (!this._container) return Promise.resolve();
      const placeholders = Array.from(this._container.querySelectorAll('[data-aura-src]'));
      if (!placeholders.length) return Promise.resolve();

      const loads = placeholders.map((ph) => {
        const src = ph.getAttribute('data-aura-src');
        if (!src) return Promise.resolve();

        return fetch(src)
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status} for ${src}`);
            return r.text();
          })
          .then((txt) => {
            let svgEl = null;
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(txt, 'image/svg+xml');
              svgEl = doc.querySelector('svg');
              if (!svgEl || doc.querySelector('parsererror')) {
                const hdoc = parser.parseFromString(txt, 'text/html');
                svgEl = hdoc.querySelector('svg');
              }
            } catch (parseErr) {
              console.warn('[CharacterList] svg parse failed', parseErr);
            }

            if (!svgEl) {
              console.warn('[CharacterList] no <svg> found in', src);
              ph.dataset.hydrated = '1'; // mark as "done trying" para hindi humintay ang batch
              return;
            }

            svgEl.querySelectorAll('script').forEach((s) => s.remove());
            svgEl.style.width = '100%';
            svgEl.style.height = '100%';
            svgEl.style.display = 'block';
            svgEl.classList.add('cl-inline-svg');

            ph.innerHTML = '';
            ph.appendChild(svgEl);

            // Cache the animatable parts ONCE so _startBreatheForWrap /
            // _stopBreatheForWrap never have to re-query the SVG tree.
            ph._svgParts = {
              torso:     Array.from(svgEl.querySelectorAll('.torso')),
              irisLeft:  Array.from(svgEl.querySelectorAll('.iris-left')),
              irisRight: Array.from(svgEl.querySelectorAll('.iris-right')),
              lidL:      svgEl.querySelector('#eyelid-left'),
              lidR:      svgEl.querySelector('#eyelid-right'),
            };

            ph.dataset.hydrated = '1';
          })
          .catch((err) => {
            console.warn('[CharacterList] failed to load svg', src, err);
            // Kahit nag-fail, i-mark pa rin as hydrated para hindi
            // permanenteng maghintay ang coordinated reveal sa card na 'to.
            ph.dataset.hydrated = '1';
          });
      });

      return Promise.all(loads);
    }

    // Coordinated reveal: naghihintay muna LAHAT ng preview (SVG + iframes)
    // bago mag-fade in, tapos sabay silang lalabas nang may maliit na
    // stagger (70ms). Iframe loads mismo ay naka-stagger din (150ms bawat isa)
    // para hindi sabay-sabay na naglo-load ang 3 magkakahiwalay na pages.
    _revealPreviewsCoordinated() {
      if (!this._container) return;
      const wraps = Array.from(
        this._container.querySelectorAll('.cl-char-sprite-wrap.cl-loading')
      );
      if (!wraps.length) return;

      const MAX_WAIT = 1200; // per-item safety net

      const readiness = wraps.map((wrap, myIndex) => new Promise((resolve) => {
        const iframe = wrap.querySelector('iframe[data-src]');

        if (iframe) {
          let resolved = false;
          const done = () => {
            if (resolved) return;
            resolved = true;
            resolve();
          };
          iframe.addEventListener('load', done, { once: true });
          setTimeout(done, MAX_WAIT);

          // I-stagger ang pagsisimula ng bawat iframe load (150ms puwang)
          // para hindi mag-sabay ang 3 magkahiwalay na page loads.
          const dataSrc = iframe.getAttribute('data-src');
          setTimeout(() => {
            if (dataSrc) iframe.src = dataSrc;
          }, myIndex * 150);
          return;
        }

        if (wrap.hasAttribute('data-aura-src')) {
          // Naghihintay sa _hydrateSVGs() na mag-set ng dataset.hydrated = '1'.
          let resolved = false;
          const finish = () => {
            if (resolved) return;
            resolved = true;
            resolve();
          };
          const check = () => {
            if (resolved) return;
            if (wrap.dataset.hydrated === '1') {
              finish();
            } else {
              requestAnimationFrame(check);
            }
          };
          check();
          setTimeout(finish, MAX_WAIT);
          return;
        }

        // Walang kilalang async source (edge case) -- huwag i-block ang batch.
        resolve();
      }));

      Promise.all(readiness).then(() => {
        wraps.forEach((wrap, i) => {
          setTimeout(() => {
            wrap.classList.remove('cl-loading');
            wrap.style.opacity = '1';
          }, i * 70); // consistent visual cascade, hindi na load-speed dependent
        });
      });
    }

    show() {
      if (this._container) return;
      this._buildDOM();
      this._bindEvents();
      // Dalawang rAF: hinihintay munang maipinta ang layout bago simulan
      // ang mabibigat na trabaho (SVG fetch/parse, iframe loads).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this._hydrateSVGs()
            .then(() => this._startBreathAndBlink())
            .catch(() => this._startBreathAndBlink());
          this._updateSelectedInfo(this._currentIdx);
          this._revealPreviewsCoordinated();
        });
      });
    }

    destroy() { this._cleanup(); }

    static CHARACTERS_BY_ECHO = {
      azure: [
        { 
          id: 'frieren',  
          name: 'Frieren',  
          title: 'The Last Great Mage',            
          role: 'Mage',     
          rarity: 'Echoborn',
          class: 'Ancient Mage',
          weapon: 'Ancient Staff',
          origin: 'Elven Realm',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/FRIEREN/Character_idle_demo.html',
          quote: 'Time never stops. Neither does the journey.'
        },

        {
          id: 'flamme',   
          name: 'Flamme',  
          title: 'The Legendary Mentor',
          role: 'Mage',    
          rarity: 'Echoborn',  
          class: 'Archmage',
          weapon: 'Ancient Staff',
          origin: 'Human Kingdom',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/FLAMME/Flamme_animated_demo.html',
          quote: 'Magic exists to bring hope to every generation.'
        },

        { 
          id: 'serie',    
          name: 'Serie',    
          title: 'The Ancient Sage',
          role: 'Mage',     
          rarity: 'Legendary',
          class: 'Great Mage',
          weapon: 'Ancient Staff',
          origin: 'Elven Realm',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/SERIE/Serie_animated_demo.html',
          quote: 'Power begins with ambition.'
          },

        { 
          id: 'fern',     
          name: 'Fern',     
          title: 'The Arcane Prodigy',           
          role: 'Mage',     
          rarity: 'Legendary',
          class: 'Arcane Mage',
          weapon: 'Magic Staff',
          origin: 'Holy Kingdom',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/FERN/fern_blink_breathe.html',
          quote: 'Magic is the light that guides me forward.'
        },


        { 
          id: 'lawine',   
          name: 'Lawine',   
          title: 'The Frost Weaver',              
          role: 'Mage',     
          rarity: 'Epic',     
          class: 'Ice Mage',
          weapon: 'Magic Staff',
          origin: 'Northern Lands',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/LAWINE/lawine_idle_animation.html',
          quote: 'A calm mind creates the strongest ice.'
        },  
      ],

      crimson: [
        { 
          id: 'himmel',   
          name: 'Himmel',   
          title: 'The Hero of Hope',            
          role: 'Warrior',  
          rarity: 'Echoborn',
          class: 'Hero',
          weapon: 'Hero Sword',
          origin: 'Central Kingdom',
          iframeSrc: 'assets/characters/male/HIMMEL/Boy_animated_demo.html',
          quote: 'A true hero leaves hope behind, even after death.' 
        },

        { 
          id: 'eisen',    
          name: 'Eisen',    
          title: 'The Unbreakable Guardian',                 
          role: 'Fighter',  
          rarity: 'Echoborn',
          class: 'Warrior', 
          weapon: 'War Axe',
          origin: 'Dwarven Mountains',
          iframeSrc: 'assets/characters/male/EISEN/Eisen.html',
          quote: 'A sturdy body means nothing without a steadfast heart.'
        },

        { 
          id: 'denken',   
          name: 'Denken',   
          title: 'The Grand Strategist',       
          role: 'Mage',     
          rarity: 'Legendary',
          class: 'Imperial Mage',
          weapon: 'Magic Staff',
          origin: 'Empire',
          iframeSrc: 'assets/characters/male/DENKEN/denken_animated.html',
          quote: 'Victory belongs to those who prepare for it.'
        },

        { 
          id: 'stark',    
          name: 'Stark',    
          title: 'The Courageous Vanguard',          
          role: 'Vanguard', 
          rarity: 'Legendary',
          class: 'Warrior',
          weapon: 'Great Axe',
          origin: 'Warrior Village',
          iframeSrc: 'assets/characters/male/STARK/character-breathing-blink.html',
          quote: 'Being afraid does not mean I cannot fight.'
        },

        { 
          id: 'wirbel',   
          name: 'Wirbel',   
          title: 'The Battlefield Captain',             
          role: 'Mage',     
          rarity: 'Epic',
          class: 'War Mage',
          weapon: 'Magic Staff',
          origin: 'Northern Magic Corps',
          iframeSrc: 'assets/characters/male/WIRBEL/wirbel_blink_breathe.html',
          quote: 'A battle ends when there is no reason to fight.'
        },
      ],

      flowerYellow: [
        { 
          id: 'heiter',     
          name: 'Heiter',       
          title: 'The Faithful Priest', 
          role: 'Support',  
          rarity: 'Echoborn', 
          class: 'Priest',
          weapon: 'Holy Staff',
          origin: 'Holy Kingdom',
          iframeSrc: 'assets/characters/male/HEITER/Heiter_animated_demo.html',
          quote: 'Faith gives us the strength to move forward.'
        },

        { 
          id: 'methode',    
          name: 'Methode',     
          title: 'The Versatile Mage',          
          role: 'Mage',  
          rarity: 'Epic',
          class: 'Support Mage',
          weapon: 'Magic Staff',
          origin: 'Continental Magic Association',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/METHODE/methode_blink_breathe.html',
          quote: 'Every spell has its purpose.'
        },
        
        { 
          id: 'sein',       
          name: 'Sein',        
          title: 'The Wandering Priest',            
          role: 'Support',  
          rarity: 'Epic',
          class: 'Priest',
          weapon: 'Holy Staff',
          origin: 'Frontier Village',
          iframeSrc: 'assets/characters/male/SEIN/sein_idle_animation.html',
          quote: 'Live without leaving regrets.'
        },

        { 
          id: 'ehre',       
          name: 'Ehre',        
          title: 'The Keen Observer',        
          role: 'Mage',  
          rarity: 'Rare',
          class: 'Arcane Mage',
          weapon: 'Ring Staff',
          origin: 'Continental Magic Association',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/EHRE/character_blink_breathe.html',
          quote: 'Every battle begins with observation.'
        },

        { 
          id: 'graf_granat', 
          name: 'Graf Granat', 
          title: 'The Resolute Lord',            
          role: 'Leader',  
          rarity: 'Common',
          class: 'Lord',
          weapon: 'Sword',
          origin: 'Granat Domain',
          iframeSrc: 'assets/characters/male/GRANF GRANAT/granat_blink_breathe.html',
          quote: 'A ruler stands with the people until the very end.'
        },
      ],

      medive: [
        { 
          id: 'ubel',   
          name: 'Übel',   
          title: 'The Smiling Reaper',           
          role: 'Assassin', 
          rarity: 'Legendary',
          class: 'Mage',
          weapon: 'Enchanted Blade',
          origin: 'Northern Lands',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/ÜBEL/breathing_blinking_character.svg',
          quote: 'If I can understand you... I can cut through anything.'
        },

        { 
          id: 'sense',  
          name: 'Sense',  
          title: 'The Silent Examiner',     
          role: 'Support',  
          rarity: 'Legendary',
          class: 'Hair Mage',
          weapon: 'Living Hair',
          origin: 'Continental Magic Association',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/SENSE/sense_idle_animation.html',
          quote: 'True talent reveals itself under pressure.'
        },

        { 
          id: 'land',   
          name: 'Land',   
          title: 'The Phantom Mage',    
          role: 'Mage', 
          rarity: 'Epic',
          class: 'Clone Mage',
          weapon: 'Magic Staff',
          origin: 'Northern Lands',
          iframeSrc: 'assets/characters/male/LAND/land_idle_animation.html',
          quote: 'A wise mage never fights without a plan.' 
        },

        { 
          id: 'laufen', 
          name: 'Laufen', 
          title: 'The Swift Runner',    
          role: 'Mage',  
          rarity: 'Epic',
          class: 'Speed Mage',
          weapon: 'Magic Staff',
          origin: 'Central Lands',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/LAUFEN/laufen_blink_breathe.html',
          quote: 'Speed creates every opportunity.' 
        },

        { 
          id: 'kanne',  
          name: 'Kanne',  
          title: 'The Flowing Tide',     
          role: 'Support',  
          rarity: 'Epic',
          class: 'Water Mage',
          weapon: 'Crystal Staff',
          origin: 'Central Lands',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/KANNE/idle_animation.html',
          quote: 'Every drop finds its own path.' 
        },

        { 
          id: 'kraft', 
          name: 'Kraft',  
          title: 'The Wandering Monk',   
          role: 'Support',  
          rarity: 'Common', 
          class: 'Monk',
          weapon: 'Gauntlets',
          origin: 'Elven Realm',
          iframeSrc: 'assets/characters/male/KRAFT/kraft_blink_breathe.html',
          quote: 'Kindness leaves a mark that time cannot erase.'
        },
      ],

      ribbon: [
        {
          id: 'aura',
          name: 'Aura',
          title: 'The Guillotine',
          role: 'Demon General',
          rarity: 'Echoborn',
          class: 'Seven Sages of Destruction',
          weapon: 'Scales of Judgment',
          origin: 'The Demon Realm',
          quote: 'Kneel, and know your place.',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/AURA/Aura_animated_demo.html',
        },

        {
          id: 'lugner',
          name:   'Lügner',
          title:  'Demon Lieutenant',
          role:   'Blood Mage',
          rarity: 'Legendary',
          class:  'Demon',
          weapon: 'Blood Magic',
          origin: 'The Demon Realm',
          iframeSrc: 'assets/characters/male/LUGNER/lugner_animated_demo.html',
          quote: 'Your fate is written in your blood.'
        },

        {
          id: 'linie',
          name: 'Linie',
          title: 'Aura Elite Warrior',
          role: 'Mimic Fighter',
          rarity: 'Epic',
          class: 'Demon',
          weapon: 'Mana Weapons',
          origin: 'The Demon Realm',
          iframeSrc: 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/LINIE/linie_idle_animation.html',
          quote: 'I only need to see it once.'
          },

        {
          id: 'draht',
          name: 'Draht',
          title: 'Young Assassin',
          role: 'Assassin',
          rarity: 'Rare',
          class: 'Demon',
          weapon: 'Mana Threads',
          origin: 'The Demon Realm',
          iframeSrc: 'assets/characters/male/DRAFT/Draft_animated_demo.html',
          quote: 'One strike is all I need.'
        },
      ],
    };

    // Rarity color system 
    static RARITY_COLORS = {
      Common:    '#9CA3AF',
      Rare:      '#4EA8FF',
      Epic:      '#B46CFF',
      Legendary: '#F2C14E',
      Echoborn:  '#6EE7F9',
    };

    static RARITY_GRADIENTS = {
      Echoborn: 'linear-gradient(135deg, #6EE7F9 0%, #FFD86B 100%)',
    };

    static ROLE_ICONS = { Mage: '✦', Fighter: '⚔', Support: '✶', Assassin: '◈' };

    static BG_VIDEOS = {
      azure:        'assets/ui/menu/frieren-and-fern-pixel-art_1920x1080.mp4',
      crimson:      'assets/ui/menu/frieren-and-fern-pixel-art_1920x1080.mp4',
      flowerYellow: 'assets/ui/menu/frieren-and-fern-pixel-art_1920x1080.mp4',
      medive:       'assets/ui/menu/frieren-and-fern-pixel-art_1920x1080.mp4',
      ribbon:       'assets/ui/menu/frieren-and-fern-pixel-art_1920x1080.mp4',
    };

    _buildDOM() {
      const characters = CharacterList.CHARACTERS_BY_ECHO[this.echo] ?? [];
      const el = document.createElement('div');
      el.id = 'charListScreen';
      el.className = 'cl-screen';
      el.style.setProperty('--accent', this.accentColor);

      const bgVideoSrc = CharacterList.BG_VIDEOS[this.echo] ?? '';
      const bgHTML = bgVideoSrc
        ? `<video class="cl-bg" autoplay muted loop playsinline webkit-playsinline preload="auto">
            <source src="${bgVideoSrc}" type="video/mp4">
          </video>`
        : `<div class="cl-bg"></div>`;

      el.innerHTML = `
        ${bgHTML}
        <div class="cl-bg-overlay"></div>
        <div class="cl-layout">
              <header class="cl-header">
                  <button class="cl-back-btn" aria-label="Go back">
                    <span class="cl-back-label">Return</span>
                  </button>
                      <div class="cl-header-center">
                        <h1 class="cl-echo-name">${this.echoName}</h1>
                        <p class="cl-echo-subtitle">Summon an Echo to accompany your journey.</p>
                      </div>
                <div class="cl-header-right">
                  <span class="cl-char-count">${characters.length} Companions</span>
                </div>
              </header>
              <div class="cl-content-area">
                <main class="cl-grid" id="cl-grid" role="list">
                  ${characters.map((char, i) => this._cardHTML(char, i)).join('')}
                </main>
                <div class="cl-selected-info" id="cl-selected-info"></div>
              </div>
            </div>
            
      `;

      document.body.appendChild(el);
      this._container = el;
      this._cards = Array.from(el.querySelectorAll('.cl-card'));

      const bgVideo = el.querySelector('video.cl-bg');
      if (bgVideo && bgVideoSrc) {
        bgVideo.muted = true;
        bgVideo.playsInline = true;
        bgVideo.autoplay = true;
        bgVideo.loop = true;
        bgVideo.setAttribute('muted', '');
        bgVideo.setAttribute('playsinline', '');
        bgVideo.setAttribute('autoplay', '');
        bgVideo.setAttribute('loop', '');
        bgVideo.preload = 'auto';

        bgVideo.load();

        bgVideo.addEventListener('canplaythrough', () => {
          bgVideo.play().catch((err) => {
            console.warn('[CharacterList] bgVideo play failed', err);
          });
        }, { once: true });

        bgVideo.addEventListener('ended', () => {
          if (!bgVideo.loop) {
            bgVideo.currentTime = 0;
            bgVideo.play().catch((err) => {
              console.warn('[CharacterList] bgVideo restart failed', err);
            });
          }
        });

        bgVideo.addEventListener('error', (event) => {
          const mediaError = bgVideo.error;
          console.error('[CharacterList] bgVideo error', event, mediaError && mediaError.code, mediaError && mediaError.message);
        });
      }
    }

    _cardHTML(char, index) {
      const isEchoborn  = char.rarity === 'Echoborn';
      const rarityColor = CharacterList.RARITY_COLORS[char.rarity] ?? '#9CA3AF';
      const roleIcon    = CharacterList.ROLE_ICONS[char.role] ?? '◆';

      const rarityStyle = isEchoborn
        ? `--rarity-color:${rarityColor}; --rarity-gradient:${CharacterList.RARITY_GRADIENTS.Echoborn};`
        : `--rarity-color:${rarityColor};`;

      const hasBreathe = (char.breatheClosed && char.breatheOpen1 && char.breatheOpen2) || char.iframeSrc || char.svgSrc;
      const hasInlineSVG = !!char.svgSrc || char.id === 'aura';
      const isAura = char.id === 'aura';

      const safeEncode = (p) => {
        if (!p) return '';
        try {
          return encodeURI(decodeURIComponent(p));
        } catch (e) {
          try { return encodeURI(p); } catch (e2) { return p; }
        }
      };

      let portraitSrc       = safeEncode(char.portrait);
      let breatheClosedSrc  = safeEncode(char.breatheClosed);
      let breatheOpen1Src   = safeEncode(char.breatheOpen1);
      let breatheOpen2Src   = safeEncode(char.breatheOpen2);

      if (hasInlineSVG) {
        portraitSrc = '';
        breatheClosedSrc = '';
        breatheOpen1Src = '';
        breatheOpen2Src = '';
      }

      const auraSvgPath = 'assets/characters/female/craftpix-net-419402-free-base-4-direction-female-character-pixel-art/AURA/Aura_structured.svg';
      const inlineSvgPath = char.svgSrc || (isAura ? auraSvgPath : '');

    const framesHTML = hasInlineSVG
      ? `
      <div class="cl-char-sprite-wrap cl-loading" data-breathe data-aura-src="${inlineSvgPath}" style="opacity:0; transition: opacity 260ms ease-out;"></div>
    `
    : char.iframeSrc
      ? `
      <div class="cl-char-sprite-wrap cl-loading" style="overflow:hidden; opacity:0; transition: opacity 260ms ease-out;">
        <iframe 
          data-src="${char.iframeSrc}" 
          allowtransparency="true" 
          scrolling="no"
          frameborder="0"
          loading="eager"
          style="width:100%;height:100%;border:0;overflow:hidden;display:block;pointer-events:none;background:transparent;color-scheme:light;" 
          title="${char.name} animated portrait">
        </iframe>
      </div>
    `
        : `
        <div class="cl-char-sprite-wrap" data-breathe>
          <img class="cl-frame cl-frame--closed" data-frame-closed src="${breatheClosedSrc}" alt="" aria-hidden="true" style="opacity:0;">
          <img class="cl-frame cl-frame--open1" data-frame-open1 src="${breatheOpen1Src}" alt="" aria-hidden="true" style="opacity:0;">
          <img class="cl-frame cl-frame--open2" data-frame-open2 src="${breatheOpen2Src}" alt="" aria-hidden="true" style="opacity:0;">
        </div>
      `;

      const portraitHTML = portraitSrc
        ? (hasBreathe ? framesHTML : `<img class="cl-portrait-image" src="${portraitSrc}" alt="${char.name} portrait">`)
        : (hasBreathe ? framesHTML : `<span class="cl-portrait-initial">${char.name.charAt(0)}</span>`);

      return `
        <div class="cl-card ${isEchoborn ? 'cl-card--echoborn' : ''}" data-index="${index}" data-id="${char.id}"
          role="listitem" tabindex="0"
          aria-label="${char.name}, ${char.rarity} ${char.role}"
          style="${rarityStyle}">
          <div class="cl-card-inner">
            <div class="cl-rarity-tag">${char.rarity}</div>
            <div class="cl-portrait${hasBreathe ? ' cl-portrait--breathe' : ''}" aria-hidden="true">
              <div class="cl-portrait-bg"></div>
              ${portraitHTML}
            </div>
            <div class="cl-info">
              <h2 class="cl-char-name">${char.name}</h2>
              <p class="cl-char-title">${char.title}</p>
              <div class="cl-char-role">
                <span class="cl-role-icon">${roleIcon}</span>
                <span class="cl-role-label">${char.role}</span>
              </div>
            </div>
            <div class="cl-card-glow" aria-hidden="true"></div>
          </div>
        </div>`;
    }

    // Builds/refreshes the bottom "selected character" info panel.
    // Called whenever focus moves to a new card (arrow keys, hover, click).
    _updateSelectedInfo(index) {
      if (!this._container) return;
      const panel = this._container.querySelector('#cl-selected-info');
      if (!panel) return;

      const characters = CharacterList.CHARACTERS_BY_ECHO[this.echo] ?? [];
      const char = characters[index];
      if (!char) { panel.innerHTML = ''; return; }

      const rarityColor = CharacterList.RARITY_COLORS[char.rarity] ?? '#9CA3AF';
      panel.style.setProperty('--rarity-color', rarityColor);

      const statRow = (label, value) => value
        ? `<div class="cl-selected-stat">
            <span class="cl-stat-label">${label}</span>
            <span class="cl-stat-value">${value}</span>
          </div>`
        : '';

        panel.innerHTML = `
          <div class="cl-selected-header">
            <h2 class="cl-selected-name">${char.name}</h2>
            <span class="cl-selected-rarity-tag">${char.rarity}</span>
          </div>
          <p class="cl-selected-title">${char.title}</p>
          <div class="cl-selected-stats">
            ${statRow('Class', char.class)}
            ${statRow('Weapon', char.weapon)}
            ${statRow('Origin', char.origin)}
            ${statRow('Role', char.role)}
          </div>
          ${char.quote ? `<p class="cl-selected-quote">"${char.quote}"</p>` : ''}
        `;
      }

    // 
    //     Breathing + blinking (PER-WRAP).
    //   - Torso groups (.torso) -> subtle scaleY breathing
    //   - Iris groups (.iris-left/right) -> subtle scale "life" pulse
    //     synced with breathing (NOT used for blinking)
    //   - Eyelid rects (#eyelid-left/right) -> the actual blink,
    //     scaleY(0) = open (default), scaleY(1) = closed
    //
    //   Ang mga timer ay naka-store sa `wrap._breatheTimers` (hindi sa
    //   class instance) para maisa-isang i-stop ang bawat card nang hindi
    //   naaapektuhan ang iba. Tumatakbo lang ang animation ng CURRENTLY
    //   FOCUSED card -- ito ang bumabawas sa continuous CPU/render load
    //   habang naglalakad ang selection gamit arrow keys / mouse.
    //
    //   PERF: ang torso/iris/eyelid references ay hindi na kinukuha dito
    //   gamit querySelectorAll -- ginagamit na lang ang wrap._svgParts na
    //   na-cache na noong _hydrateSVGs(). Ito yung nag-aalis ng "lag" na
    //   nararamdaman kada galaw ng focus (keyboard/mouse), dahil dati
    //   nagre-requery ng buong SVG tree kada card switch.
    // 
    _startBreatheForWrap(wrap) {
      if (!wrap) return;
      // linisin muna kung may dati nang tumatakbo dito
      this._stopBreatheForWrap(wrap);
      wrap._breatheTimers = [];

      const svg = wrap.querySelector('svg');

      if (svg) {
        const parts = wrap._svgParts || {};
        const torsoGroups = parts.torso ?? Array.from(svg.querySelectorAll('.torso'));
        const irisLeft    = parts.irisLeft ?? Array.from(svg.querySelectorAll('.iris-left'));
        const irisRight   = parts.irisRight ?? Array.from(svg.querySelectorAll('.iris-right'));
        const lidL        = parts.lidL !== undefined ? parts.lidL : svg.querySelector('#eyelid-left');
        const lidR        = parts.lidR !== undefined ? parts.lidR : svg.querySelector('#eyelid-right');

        // ---- Blinking (eyelids only) ----
        const blinkClose = () => {
          if (lidL) { lidL.style.transition = 'transform 90ms ease-in';  lidL.style.transform = 'scaleY(1)'; }
          if (lidR) { lidR.style.transition = 'transform 90ms ease-in';  lidR.style.transform = 'scaleY(1)'; }
          const holdClosed = 120 + Math.random() * 140;
          const reopenTimer = setTimeout(blinkOpen, holdClosed);
          wrap._breatheTimers.push(reopenTimer);
        };

        const blinkOpen = () => {
          if (lidL) { lidL.style.transition = 'transform 140ms ease-out'; lidL.style.transform = 'scaleY(0)'; }
          if (lidR) { lidR.style.transition = 'transform 140ms ease-out'; lidR.style.transform = 'scaleY(0)'; }
          scheduleBlink();
        };

        const scheduleBlink = () => {
          const delay = 2600 + Math.random() * 2200;
          const blinkTimer = setTimeout(blinkClose, delay);
          wrap._breatheTimers.push(blinkTimer);
        };

        scheduleBlink();

        // ---- Breathing (torso + iris "life" pulse) ----
        const inhale = () => {
          torsoGroups.forEach((t) => { t.style.transition = 'transform 1900ms ease-in-out'; t.style.transform = 'scaleY(1.035)'; });
          irisLeft.concat(irisRight).forEach((g) => { g.style.transition = 'transform 1900ms ease-in-out'; g.style.transform = 'scale(1.08)'; });
          const t = setTimeout(exhale, 1900);
          wrap._breatheTimers.push(t);
        };
        const exhale = () => {
          torsoGroups.forEach((t) => { t.style.transition = 'transform 1900ms ease-in-out'; t.style.transform = 'scaleY(1)'; });
          irisLeft.concat(irisRight).forEach((g) => { g.style.transition = 'transform 1900ms ease-in-out'; g.style.transform = 'scale(1)'; });
          const t = setTimeout(inhale, 1900);
          wrap._breatheTimers.push(t);
        };
        const startTimer = setTimeout(inhale, 100);
        wrap._breatheTimers.push(startTimer);
        return;
      }

      // ---- Non-SVG (PNG frame-based) characters ----
      const closed = wrap.querySelector('[data-frame-closed]');
      const open1 = wrap.querySelector('[data-frame-open1]');
      const open2 = wrap.querySelector('[data-frame-open2]');
      if (!closed || !open1 || !open2) return;

      closed.style.opacity = '1';
      closed.style.transform = 'scaleY(0)';
      open1.style.opacity = '1';
      open2.style.opacity = '0';

      const blinkOpen = () => {
        closed.style.transform = 'scaleY(0)';
        scheduleBlink();
      };

      const blinkClose = () => {
        closed.style.transform = 'scaleY(1)';
        const holdClosed = 120 + Math.random() * 140;
        const reopenTimer = setTimeout(blinkOpen, holdClosed);
        wrap._breatheTimers.push(reopenTimer);
      };

      const scheduleBlink = () => {
        const delay = 4500 + Math.random() * 7000;
        const blinkTimer = setTimeout(blinkClose, delay);
        wrap._breatheTimers.push(blinkTimer);
      };

      scheduleBlink();

      const inhale = () => {
        wrap.style.transform = 'scaleY(1.035)';
        const t = setTimeout(exhale, 1900 + Math.random() * 400);
        wrap._breatheTimers.push(t);
      };

      const exhale = () => {
        wrap.style.transform = 'scaleY(1)';
        const t = setTimeout(inhale, 1200 + Math.random() * 800);
        wrap._breatheTimers.push(t);
      };

      const startDelay = 200 + Math.random() * 800;
      const startTimer = setTimeout(inhale, startDelay);
      wrap._breatheTimers.push(startTimer);
    }

    _stopBreatheForWrap(wrap) {
      if (!wrap) return;
      (wrap._breatheTimers ?? []).forEach((t) => clearTimeout(t));
      wrap._breatheTimers = [];

      try {
        wrap.style.transform = '';
        const closed = wrap.querySelector('[data-frame-closed]');
        if (closed) closed.style.transform = 'scaleY(0)';

        const parts = wrap._svgParts;
        if (parts) {
          parts.torso.forEach((t) => { t.style.transform = 'scaleY(1)'; });
          parts.irisLeft.concat(parts.irisRight).forEach((g) => { g.style.transform = 'scale(1)'; });
          if (parts.lidL) parts.lidL.style.transform = 'scaleY(0)';
          if (parts.lidR) parts.lidR.style.transform = 'scaleY(0)';
        } else {
          const svg = wrap.querySelector('svg');
          if (svg) {
            svg.querySelectorAll('.torso').forEach((t) => { t.style.transform = 'scaleY(1)'; });
            svg.querySelectorAll('.iris-left, .iris-right').forEach((g) => { g.style.transform = 'scale(1)'; });
            const lidL = svg.querySelector('#eyelid-left');
            const lidR = svg.querySelector('#eyelid-right');
            if (lidL) lidL.style.transform = 'scaleY(0)';
            if (lidR) lidR.style.transform = 'scaleY(0)';
          }
        }
      } catch (e) { /* ignore */ }
    }

    // Controller: sinisimulan lang ang animation ng CURRENTLY FOCUSED
    // card. Ang ibang cards ay hindi tumatakbo hangga't hindi sila
    // na-fofocus (tingnan ang _focusCard).
    _startBreathAndBlink() {
      this._stopBreathAndBlink();
      const wraps = this._container?.querySelectorAll('[data-breathe]') ?? [];
      wraps.forEach((wrap, i) => {
        if (i === this._currentIdx) this._startBreatheForWrap(wrap);
      });
    }

    _stopBreathAndBlink() {
      const wraps = this._container?.querySelectorAll('[data-breathe]') ?? [];
      wraps.forEach((wrap) => this._stopBreatheForWrap(wrap));
    }


    // Real event binding: keyboard navigation, click-to-select,
    // back button.
      _bindEvents() {
          if (!this._container) return;

          const backBtn = this._container.querySelector('.cl-back-btn');
          if (backBtn) backBtn.addEventListener('click', () => this._goBack());

          this._cards.forEach((card, i) => {
            card.addEventListener('pointerdown', () => {
              card.classList.add('cl-card--pressed');
            });
            card.addEventListener('pointerup', () => {
              card.classList.remove('cl-card--pressed');
            });
            card.addEventListener('pointerleave', () => {
              card.classList.remove('cl-card--pressed');
            });
            card.addEventListener('pointercancel', () => {
              card.classList.remove('cl-card--pressed');
            });

            card.addEventListener('click', () => {
              this._focusCard(i);
              this._selectCharacter(i);
            });
            card.addEventListener('focus', () => this._focusCard(i));

            card.addEventListener('mouseenter', () => {
              clearTimeout(this._hoverTimer);
              this._hoverTimer = setTimeout(() => this._focusCard(i), 20);
            });
          });

          window.addEventListener('keydown', this._boundKey);
          window.addEventListener('keyup', this._boundKeyUp); // NEW
      }

      // PERF: pinababa ang key-repeat cooldown mula 280ms -> 120ms, at
      // pinapayagan na ang e.repeat (auto-repeat habang naka-hold) para
      // mas responsive/smooth ang paggalaw gamit arrow keys.
      _onKey(e) {
        if (this._locked) return;

        const isNav = e.key === 'ArrowRight' || e.key === 'ArrowLeft';

        if (isNav) {
          e.preventDefault();
          clearTimeout(this._hoverTimer);
          if (e.repeat) return;
          if (this._navHeldKey === e.key) return;

          this._navHeldKey = e.key;
          const step = () => {
            if (e.key === 'ArrowRight') {
              this._focusCard(Math.min(this._currentIdx + 1, this._cards.length - 1));
            } else {
              this._focusCard(Math.max(this._currentIdx - 1, 0));
            }
          };

          step();
          clearInterval(this._navInterval);
          this._navInterval = setInterval(step, 120);
          return;
        }

        switch (e.key) {
          case 'Enter':
          case ' ':
            if (e.repeat) { e.preventDefault(); return; }
            e.preventDefault();
            {
              const card = this._cards[this._currentIdx];
              if (card) {
                card.classList.add('cl-card--pressed');
                setTimeout(() => card.classList.remove('cl-card--pressed'), 90);
              }
            }
            this._selectCharacter(this._currentIdx);
            return;
          case 'Escape':
            if (e.repeat) { e.preventDefault(); return; }
            e.preventDefault();
            this._goBack();
            return;
          default:
            return;
        }
      }

      _onKeyUp(e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          if (this._navHeldKey === e.key) {
            clearInterval(this._navInterval);
            this._navInterval = null;
            this._navHeldKey = null;
          }
        }

        this._keyBusy = true;
        clearTimeout(this._keyBusyTimer);
        this._keyBusyTimer = setTimeout(() => { this._keyBusy = false; }, 120);
      }

      _focusCard(index) {
        if (index < 0 || index >= this._cards.length) return;
        if (index === this._currentIdx && this._cards[index]?.classList.contains('cl-card--focused')) return;

        // I-stop ang animation ng dating naka-focus na card...
        const prevWrap = this._cards[this._currentIdx]?.querySelector('[data-breathe]');
        if (prevWrap) this._stopBreatheForWrap(prevWrap);

        this._cards.forEach(c => c.classList.remove('cl-card--focused'));
        this._currentIdx = index;
        const card = this._cards[index];
        card.classList.add('cl-card--focused');
        card.focus({ preventScroll: true });

        // ...at simulan lang sa BAGONG naka-focus na card.
        const newWrap = card.querySelector('[data-breathe]');
        if (newWrap) this._startBreatheForWrap(newWrap);

        this._updateSelectedInfo(index);

        // PERF: inalis ang dating 60ms setTimeout bago mag-scroll (dahil
        // sa bawat mabilis na galaw, nace-cancel/nire-reschedule ito
        // paulit-ulit, kaya parang "naghahabol" ang scroll). Ngayon,
        // isang rAF na lang ang ginagamit bilang debounce, kaya diretso
        // at hindi na artificially naaantala.
        if (this._scrollRAF) cancelAnimationFrame(this._scrollRAF);
        this._scrollRAF = requestAnimationFrame(() => {
          card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }

        _selectCharacter(index) {
            if (this._locked) return;
            console.log('[DEBUG] _selectCharacter called, index:', index);

            const characters = CharacterList.CHARACTERS_BY_ECHO[this.echo] ?? [];
            const char = characters[index];
            if (!char) return;

            this._locked = true;

            const card = this._cards[index];
            if (card) card.classList.add('cl-card--selected');

          setTimeout(() => {
            console.log('[DEBUG] setTimeout fired, calling onSelect...');
            if (this._container) {
              const layout = this._container.querySelector('.cl-layout');
              if (layout) layout.style.visibility = 'hidden';
            }
            if (this.onSelect) {
              console.log('[DEBUG] onSelect exists, calling it');
              this.onSelect({ ...char, echo: this.echo, echoName: this.echoName });
            } else {
              console.log('[DEBUG] onSelect is MISSING!');
            }
          }, 350);
        }
        
      _goBack() {
          if (this._locked) return;
          this._cleanup();
          if (this.onBack) this.onBack();
      }

    _cleanup() {
        this._stopBreathAndBlink();
        window.removeEventListener('keydown', this._boundKey);
        window.removeEventListener('keyup', this._boundKeyUp); // NEW
        clearInterval(this._navInterval); // NEW
        this._navInterval = null;
        this._navHeldKey = null;
        clearTimeout(this._hoverTimer);
        clearTimeout(this._keyBusyTimer);
        if (this._scrollRAF) cancelAnimationFrame(this._scrollRAF);
        if (this._container) {
          const vid = this._container.querySelector('video.cl-bg');
          if (vid) {
            vid.pause();
            vid.removeAttribute('src');
            vid.load();
          }
          this._container.remove();
          this._container = null;
        }
        this._cards  = [];
        this._locked = false;
    
      }
    }

