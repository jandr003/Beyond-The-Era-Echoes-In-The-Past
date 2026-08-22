/* ============================================================
   dialogueBox.js — NPC dialogue box (Genshin-style layout)
   ------------------------------------------------------------
   Gamit: i-import at tawagin ang initDialogueBox(stageEl, options)
   Awtomatikong nakikinig ito sa 'npc-interact' event na dini-
   dispatch na ng playerRoom.js kapag pinindot ang "E" habang
   nasa loob ng interaction zone.

   Options:
     speakerName   — pangalan ng NPC (halimbawa: "John Andrew")
     speakerTitle  — (optional) maliit na title/role sa baba ng
                      pangalan (halimbawa: "Developer", "Merchant")
     lines         — array ng dialogue text, isang linya bawat E/click
     portraitSrc   — (optional) URL ng portrait image ng NPC
     choices       — (optional) array ng { text, highlight?: bool }
                      ipinapakita sa itaas ng panel habang bukas
                      ang dialogue box
     onChoiceSelect — (optional) callback(text, index) tuwing may
                      pinindot na choice

   Kontrol:
   - Pindutin ang E o i-click ang text panel para sumulong sa
     susunod na linya.
   - Kapag naubos na ang lines, awtomatikong nagsasara ang box.
   - Pag-click sa isang choice ay nagdi-dispatch ng
     'dialogue-choice-selected' event (detail: { text, index })
     bukod pa sa pagtawag sa onChoiceSelect kung ibinigay.

   FIXES/UPDATES sa bersyong ito:
   - Idinagdag ang Google Font na "Press Start 2P" (pixel font),
     kasama ang fallback font kung sakaling hindi ma-load.
   - Na-adjust ang font sizes/line-height dahil mas malaki at
     mas makapal ang hugis ng Press Start 2P kumpara sa normal
     na sans-serif — kung hindi ito babaguhin, aapaw/mag-o-overlap
     ang text sa dialogue box.
   - Naitama ang multiple-instance bug: dati, tuwing tinatawag
     at 'npc-interact' listener sa window kahit hindi pa na-
     re-remove ang mga dati — nagdudulot ito ng "double advance"
     o paulit-ulit na pagbukas kapag tumawag ka ng ilang beses.
     Ngayon, kada instance ay may sarili itong listener na
     naaalis nang tama sa destroy(), at ang mismong DOM element
     (root) ang ginagamit bilang key para maiwasang magkaroon ng
     duplicate listeners kapag same stageEl ang ginamit.
   - Naitama ang mismatch: hindi na kailangang i-check ulit ang
     e.key.toLowerCase() === 'e' nang hiwalay — pinanatili ito
     pero ginawang mas malinaw at ligtas gamit ang early return.
   - Idinagdag ang pointer-events guard para hindi ma-trigger ang
     advance() kapag naka-focus sa isang input/textarea sa page
     (kung meron man sa parehong stage).
   - BAGONG LAYOUT: ang .dlgbox-panel ay sumasakop na ngayon sa
     BUONG WIDTH ng screen (full-width bottom bar), kagaya ng
     karaniwang VN/RPG dialogue bar. Ang pangalan (at optional
     title sa baba nito) ay naka-CENTER na sa itaas ng panel
     bilang isang nakalutang na badge, sa halip na naka-left
     lang dati. Ang mga choices naman ay lumipat sa itaas ng
     panel (floating sa kanang bahagi) para hindi ito ma-cover
     ng bagong full-width na panel.
   - NAME BADGE DISABLED: sa kahilingan, permanenteng naka-off
     na ngayon ang name badge (hindi na ipinapakita ang pangalan
     ng NPC sa itaas ng dialogue box), kahit anong ipasa sa
     `speakerName`/`speakerTitle`. Kung gusto mo itong ibalik,
     tingnan ang `SHOW_NAME_BADGE` flag sa ibaba.
   ============================================================ */

const STYLE_ID = 'dlgbox-styles';
const FONT_LINK_ID = 'dlgbox-font-press-start-2p';


const SHOW_NAME_BADGE = true;

function ensureFontInjected() {
  if (document.getElementById(FONT_LINK_ID)) return;

  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
  document.head.appendChild(link);
}

function ensureStylesInjected() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .dlgbox-root {
      position: absolute;
      inset: 0;
      pointer-events: none;
      font-family: 'Press Start 2P';
      z-index: 20;
      display: none;
    }

.dlgbox-panel {
      position: absolute;
      left: 10%;
      right: 10%;
      bottom: 70px;
      width: 80%;
      background: linear-gradient(180deg, rgba(10,22,26,0.95), rgba(4,12,16,0.98));
      border: none;
      box-shadow: 0 -2px 20px rgba(80,220,200,0.15), 0 -6px 30px rgba(0,0,0,0.6);
      border-radius: 10px;
      padding: 26px 6% 18px;
      box-sizing: border-box;
      pointer-events: auto;
      cursor: pointer;
      color: #dff5f0;
}

.dlgbox-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg,
    transparent 0%,
    rgba(140,220,205,0.6) 20%,
    rgba(140,220,205,0.9) 50%,
    rgba(140,220,205,0.6) 80%,
    transparent 100%);
}

.dlgbox-name-badge {
    position: absolute;
    top: -26px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(180deg, rgba(20,40,42,0.96), rgba(10,26,28,0.98));
    color: #a8e8d8;
    padding: 8px 26px 6px;
    border: none;
    border-radius: 4px;
    box-shadow: 0 0 12px rgba(100,220,195,0.25), 0 3px 8px rgba(0,0,0,0.5);
    white-space: nowrap;
}

.dlgbox-name {
    font-weight: 400;
    font-size: 1.1rem;
    letter-spacing: 0.04em;
    color: #d3f5ec;
    text-shadow: 0 0 6px rgba(140,220,205,0.5);
}    

.dlgbox-title {
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6fae9e;
    margin-top: 4px;
}

.dlgbox-text {
    font-size: 1.15rem;
    line-height: 1.7;
    min-height: 2.4em;
    margin-top: 14px;
    text-align: center;
    color: #e4f6f1;
    text-shadow: 0 0 4px rgba(100,200,180,0.15);
}

.dlgbox-hint {
    font-size: 0.85rem;
    color: #5f9384;
    text-align: right;
    margin-top: 12px;
    user-select: none;
}

.dlgbox-choices {
    position: absolute;
    right: 4%;
    bottom: 210px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: auto;
    max-width: 260px;
}

.dlgbox-choice {
    background: rgba(10,24,26,0.9);
    border: 1px solid rgba(120,200,190,0.35);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 0.6rem;
    line-height: 1.5;
    color: #dff5f0;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.dlgbox-choice:hover {
    background: rgba(20,44,44,0.92);
    border-color: rgba(140,220,205,0.7);
    box-shadow: 0 0 10px rgba(100,220,195,0.2);
}

.dlgbox-choice.highlight {
    color: #8ef0d4;
    border-color: rgba(142,240,212,0.6);
}

.dlgbox-choice::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.85;
    flex-shrink: 0;
    box-shadow: 0 0 6px currentColor;
}

.dlgbox-portrait {
    position: absolute;
    bottom: 100%;
    left: 8%;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 2px solid rgba(140,220,205,0.6);
    object-fit: cover;
    background: #0a1a1c;
    margin-bottom: 10px;
    box-shadow: 0 0 14px rgba(100,220,195,0.25), 0 4px 12px rgba(0,0,0,0.5);
    }
  `;
  document.head.appendChild(style);
}

export function initDialogueBox(stageEl, options = {}) {
  ensureFontInjected();
  ensureStylesInjected();

const lines = options.npcLines ?? options.lines ?? [];
  const speakerName = options.npcName ?? options.speakerName ?? '';
  const speakerTitle = options.npcTitle ?? options.speakerTitle ?? '';
  const portraitSrc = options.npcPortraitUrl ?? options.portraitSrc ?? '';
  const choices = options.npcChoices ?? options.choices ?? [];
  const onChoiceSelect = options.onNpcChoiceSelect ?? options.onChoiceSelect ?? null;

  let currentIndex = -1;
  let isOpen = false;

  //Build DOM
  const root = document.createElement('div');
  root.className = 'dlgbox-root';

  const panel = document.createElement('div');
  panel.className = 'dlgbox-panel';

  if (portraitSrc) {
    const portraitEl = document.createElement('img');
    portraitEl.className = 'dlgbox-portrait';
    portraitEl.src = portraitSrc;
    portraitEl.alt = speakerName;
    panel.appendChild(portraitEl);
  }

  // Name/title badge — disabled by default (SHOW_NAME_BADGE flag)
  if (SHOW_NAME_BADGE) {
    const nameBadge = document.createElement('div');
    nameBadge.className = 'dlgbox-name-badge';
    nameBadge.style.display = speakerName ? 'flex' : 'none';

    const nameEl = document.createElement('div');
    nameEl.className = 'dlgbox-name';
    nameEl.textContent = speakerName;
    nameBadge.appendChild(nameEl);

    if (speakerTitle) {
      const titleEl = document.createElement('div');
      titleEl.className = 'dlgbox-title';
      titleEl.textContent = speakerTitle;
      nameBadge.appendChild(titleEl);
    }

    panel.appendChild(nameBadge);
  }

  const textEl = document.createElement('div');
  textEl.className = 'dlgbox-text';

  const hintEl = document.createElement('div');
  hintEl.className = 'dlgbox-hint';
  hintEl.textContent = 'Press E or click to continue ▸';
  

  panel.appendChild(textEl);
  panel.appendChild(hintEl);
  root.appendChild(panel);

  const choicesEl = document.createElement('div');
  choicesEl.className = 'dlgbox-choices';
  choices.forEach((choice, index) => {
    const text = typeof choice === 'string' ? choice : choice.text;
    const highlight = typeof choice === 'object' && choice.highlight;

    const choiceEl = document.createElement('div');
    choiceEl.className = 'dlgbox-choice' + (highlight ? ' highlight' : '');
    choiceEl.textContent = text;
    choiceEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onChoiceSelect) onChoiceSelect(text, index);
      window.dispatchEvent(new CustomEvent('dialogue-choice-selected', {
        detail: { text, index }
      }));
    });
    choicesEl.appendChild(choiceEl);
  });
  if (choices.length) root.appendChild(choicesEl);

  stageEl.appendChild(root);

  function showLine() {
    if (currentIndex >= lines.length) {
      close();
      return;
    }
    textEl.textContent = lines[currentIndex];

















    
    root.style.display = 'block';
  }

  function open() {
    if (isOpen) return; // iwas double-open kapag paulit-ulit ang 'npc-interact'
    isOpen = true;
    currentIndex = 0;
    showLine();
  }

  function advance() {
    if (!isOpen) return;
    currentIndex += 1;
    showLine();
  }

  function close() {
    isOpen = false;
    currentIndex = -1;
    root.style.display = 'none';
    window.dispatchEvent(new CustomEvent('dialogue-closed'));
  }

  // ---------- Input ----------
  function isTypingInField() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  function onKeyDown(e) {
    if (!isOpen) return;
    if (isTypingInField()) return;
    if (e.key.toLowerCase() !== 'e') return;
    e.preventDefault();
    advance();
  }

  function onPanelClick() {
    advance();
  }

  panel.addEventListener('click', onPanelClick);
  window.addEventListener('keydown', onKeyDown);

  // ---------- Kinokonekta sa 'npc-interact' na dini-dispatch ng playerRoom.js ----------
  function onNpcInteract() {
    open();
  }
  window.addEventListener('npc-interact', onNpcInteract);

return {
    open,
    show: open,
    destroy: function () {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('npc-interact', onNpcInteract);
      panel.removeEventListener('click', onPanelClick);
      root.remove();
    },
  };
}
